import { connectDb } from "./database.ts";
import { initRedis } from "./redis.ts";
import type { Client } from "@db/postgres";

// Repositories
import { UserRepository } from "../modules/user/user.repository.ts";
import { AuthRepository } from "../modules/auth/auth.repository.ts";
import { PermissionRepository } from "../modules/permission/permission.repository.ts";
import { RoleRepository } from "../modules/role/role.repository.ts";

// Services
import { UserService } from "../modules/user/user.service.ts";
import { AuthService } from "../modules/auth/auth.service.ts";
import { PermissionService } from "../modules/permission/permission.service.ts";
import { RoleService } from "../modules/role/role.service.ts";

export class AppContainer {
  public db!: Client;
  public userService!: UserService;
  public authService!: AuthService;
  public permissionService!: PermissionService;
  public roleService!: RoleService;

  async init() {
    // 0. Khởi tạo Redis (Optional)
    await initRedis();

    // 1. Khởi tạo Database
    this.db = await connectDb();

    // 2. Khởi tạo Repositories
    const userRepo = new UserRepository(this.db);
    const authRepo = new AuthRepository(this.db);
    const permissionRepo = new PermissionRepository(this.db);
    const roleRepo = new RoleRepository(this.db);

    // 3. Khởi tạo Services (Inject Repositories)
    this.userService = new UserService(userRepo);
    this.authService = new AuthService(userRepo, authRepo);
    this.permissionService = new PermissionService(permissionRepo);
    this.roleService = new RoleService(roleRepo);
  }
}

// Xuất ra một instance duy nhất (Singleton)
export const container = new AppContainer();
