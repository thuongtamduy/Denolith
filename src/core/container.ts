import { connectDb } from "./database.ts";
import { initRedis } from "./redis.ts";
import type { Client } from "@db/postgres";

// Repositories
import { UserRepository } from "../modules/user/user.repository.ts";
import { AuthRepository } from "../modules/auth/auth.repository.ts";

// Services
import { UserService } from "../modules/user/user.service.ts";
import { AuthService } from "../modules/auth/auth.service.ts";

export class AppContainer {
  public db!: Client;
  public userService!: UserService;
  public authService!: AuthService;

  async init() {
    // 0. Khởi tạo Redis (Optional)
    await initRedis();

    // 1. Khởi tạo Database
    this.db = await connectDb();

    // 2. Khởi tạo Repositories
    const userRepo = new UserRepository(this.db);
    const authRepo = new AuthRepository(this.db);

    // 3. Khởi tạo Services (Inject Repositories)
    this.userService = new UserService(userRepo);
    this.authService = new AuthService(userRepo, authRepo);
  }
}

// Xuất ra một instance duy nhất (Singleton)
export const container = new AppContainer();
