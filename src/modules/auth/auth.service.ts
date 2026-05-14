import { sign } from "@hono/jwt";
import type { PrismaClient } from "@db";
import { hashPassword, verifyPassword } from "../../shared/utils/hash.ts";
import { AppError } from "../../shared/errors/AppError.ts";
import { config } from "../../core/config.ts";
import { Queue } from "../../core/queue.ts";
import { AuditService } from "../../core/audit.ts";
import { redisClient } from "../../core/redis.ts";

const DUMMY_HASH =
  "00000000000000000000000000000000:0000000000000000000000000000000000000000000000000000000000000000";

export interface RegisterData {
  username: string;
  email: string;
  password: string;
}

export interface LoginData {
  email: string;
  password: string;
  clientIp?: string;
  clientUserAgent?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  constructor(private prisma: PrismaClient) {}

  async register(data: RegisterData) {
    // Check existing before transaction to fail fast
    const existing = await this.prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existing) throw AppError.conflict("Email already in use");

    // Hash password outside transaction (slow operation)
    const hashedPassword = await hashPassword(data.password);

    const refreshToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Transaction only handles DB writes
    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          username: data.username,
          email: data.email,
          password: hashedPassword,
        },
        include: { role: { select: { tier: true } } },
      });

      await tx.refreshToken.create({
        data: {
          userId: createdUser.id,
          token: refreshToken,
          expiresAt,
        },
      });

      return createdUser;
    });

    // Generate token outside transaction
    const accessToken = await sign(
      {
        id: user.id,
        role: user.roleCode,
        tier: user.role.tier,
        exp: Math.floor(Date.now() / 1000) + 15 * 60,
      },
      config.jwtSecret,
    );

    // Run side effects outside transaction
    await Queue.enqueue("send_welcome_email", {
      email: user.email,
      username: user.username,
    });

    await AuditService.log({
      actorId: user.id,
      action: "auth.register",
      targetType: "user",
      targetId: user.id,
    });

    return { user, accessToken, refreshToken };
  }

  async login(data: LoginData) {
    const user = await this.prisma.user.findUnique({
      where: { email: data.email, deleted: false },
      include: { role: { select: { tier: true } } },
    });

    const hashToVerify = user ? user.password : DUMMY_HASH;
    const valid = await verifyPassword(data.password, hashToVerify);

    if (!user || !valid) {
      await AuditService.log({
        action: "auth.login_failed",
        status: "failure",
        ipAddress: data.clientIp,
        userAgent: data.clientUserAgent,
        metadata: { email: data.email },
      });
      throw AppError.unauthorized("Invalid email or password");
    }

    if (!user.active) {
      throw AppError.forbidden(
        "Your account has been disabled. Please contact admin.",
      );
    }

    const accessToken = await sign(
      {
        id: user.id,
        role: user.roleCode,
        tier: user.role.tier,
        exp: Math.floor(Date.now() / 1000) + 15 * 60,
      },
      config.jwtSecret,
    );

    const refreshToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt,
        ipAddress: data.clientIp ?? null,
        userAgent: data.clientUserAgent ?? null,
      },
    });

    // Cập nhật thông tin đăng nhập cuối cùng
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: data.clientIp ?? null,
      },
    });

    await AuditService.log({
      actorId: user.id,
      action: "auth.login",
      targetType: "user",
      targetId: user.id,
      ipAddress: data.clientIp,
      userAgent: data.clientUserAgent,
    });

    return { user, accessToken, refreshToken };
  }

  async refreshToken(oldToken: string): Promise<AuthTokens> {
    const session = await this.prisma.refreshToken.findUnique({
      where: { token: oldToken },
    });

    if (!session) {
      throw AppError.unauthorized("Invalid or already consumed refresh token");
    }

    // --- BẪY PHÁT HIỆN TÁI SỬ DỤNG (REVOCATION TRAP / TOKEN FAMILY INVALIDATION) ---
    // Nếu token đã bị thu hồi (revokedAt != null), đây là dấu hiệu Replay Attack / Bị đánh cắp token.
    if (session.revokedAt) {
      // Tiêu diệt toàn bộ chuỗi phiên: Xóa sạch toàn bộ refresh tokens đang hoạt động của tài khoản này
      await this.prisma.refreshToken.deleteMany({
        where: { userId: session.userId },
      });

      // Ghi Audit Log cảnh báo bảo mật nghiêm trọng
      await AuditService.log({
        action: "auth.security_compromised",
        status: "failure",
        targetType: "user",
        targetId: session.userId,
        metadata: {
          reason: "Replay attack detected: consumed refresh token reused",
          token: oldToken,
        },
      });

      throw AppError.unauthorized(
        "Security alert: Token reuse detected. All active sessions have been revoked. Please log in again.",
      );
    }

    if (new Date() > new Date(session.expiresAt)) {
      throw AppError.unauthorized("Refresh token expired");
    }

    // Đánh dấu thu hồi token hiện tại (Revoke) thay vì xóa vật lý
    await this.prisma.refreshToken.update({
      where: { token: oldToken },
      data: { revokedAt: new Date() },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: session.userId, deleted: false },
      include: { role: { select: { tier: true } } },
    });

    if (!user) throw AppError.unauthorized("User not found");

    const accessToken = await sign(
      {
        id: user.id,
        role: user.roleCode,
        tier: user.role.tier,
        exp: Math.floor(Date.now() / 1000) + 15 * 60,
      },
      config.jwtSecret,
    );
    const refreshToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  async logout(refreshToken: string, accessToken?: string, exp?: number) {
    // Xóa refresh token đang đăng xuất
    await this.prisma.refreshToken.deleteMany({
      where: { token: refreshToken },
    });

    // Blacklist access token in Redis so it can't be reused until expiry
    if (accessToken && exp && redisClient) {
      const ttl = exp - Math.floor(Date.now() / 1000);
      if (ttl > 0) {
        try {
          await redisClient.set(`blacklist:${accessToken}`, "1", { EX: ttl });
        } catch {
          // Redis failure is non-critical — token will expire naturally
        }
      }
    }
  }
}
