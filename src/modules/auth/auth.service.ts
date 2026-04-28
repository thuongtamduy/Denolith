import { sign } from "@hono/jwt";
import type { UserRepository } from "../user/user.repository.ts";
import type { AuthRepository } from "./auth.repository.ts";
import { hashPassword, verifyPassword } from "../../shared/utils/hash.ts";
import { AppError } from "../../shared/errors/AppError.ts";
import { config } from "../../core/config.ts";
import { Queue } from "../../core/queue.ts";

export interface RegisterData {
  username: string;
  email: string;
  password: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  constructor(
    private userRepo: UserRepository,
    private authRepo: AuthRepository,
  ) {}

  async register(data: RegisterData) {
    const existing = await this.userRepo.findByEmail(data.email);
    if (existing) throw AppError.conflict("Email already in use");

    const hashedPassword = await hashPassword(data.password);
    const user = await this.userRepo.create({
      username: data.username,
      email: data.email,
      password: hashedPassword,
    });

    const accessToken = await sign(
      {
        id: user.id,
        role: user.role,
        exp: Math.floor(Date.now() / 1000) + 15 * 60,
      },
      config.jwtSecret,
    );

    const refreshToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.authRepo.saveRefreshToken(user.id, refreshToken, expiresAt);

    // Ném tác vụ cực nặng vào Queue để giải phóng API lập tức!
    await Queue.enqueue("send_welcome_email", {
      email: user.email,
      username: user.username,
    });

    return { user, accessToken, refreshToken };
  }

  async login(data: LoginData) {
    const user = await this.userRepo.findByEmail(data.email);
    if (!user) throw AppError.unauthorized("Invalid email or password");

    const valid = await verifyPassword(data.password, user.password);
    if (!valid) throw AppError.unauthorized("Invalid email or password");

    const accessToken = await sign(
      {
        id: user.id,
        role: user.role,
        exp: Math.floor(Date.now() / 1000) + 15 * 60,
      },
      config.jwtSecret,
    );

    const refreshToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.authRepo.saveRefreshToken(user.id, refreshToken, expiresAt);

    return { user, accessToken, refreshToken };
  }

  async refreshToken(oldToken: string): Promise<AuthTokens> {
    const session = await this.authRepo.findRefreshToken(oldToken);
    if (!session) throw AppError.unauthorized("Invalid refresh token");

    if (new Date() > new Date(session.expires_at)) {
      await this.authRepo.deleteRefreshToken(oldToken);
      throw AppError.unauthorized("Refresh token expired");
    }

    const user = await this.userRepo.findById(session.user_id);
    if (!user) throw AppError.unauthorized("User not found");

    await this.authRepo.deleteRefreshToken(oldToken);

    const accessToken = await sign(
      {
        id: user.id,
        role: user.role,
        exp: Math.floor(Date.now() / 1000) + 15 * 60,
      },
      config.jwtSecret,
    );
    const refreshToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.authRepo.saveRefreshToken(user.id, refreshToken, expiresAt);

    return { accessToken, refreshToken };
  }

  async logout(refreshToken: string) {
    await this.authRepo.deleteRefreshToken(refreshToken);
  }
}
