import { prisma } from "./database.ts";
import { UserService } from "../modules/user/user.service.ts";
import { AuthService } from "../modules/auth/auth.service.ts";
import { PermissionService } from "../modules/permission/permission.service.ts";
import { RoleService } from "../modules/role/role.service.ts";

// Lightweight Lazy Dependency Injection Container (10/10 Pattern)
class DIContainer {
  private _userService?: UserService;
  private _authService?: AuthService;
  private _permissionService?: PermissionService;
  private _roleService?: RoleService;

  get userService() {
    if (!this._userService) this._userService = new UserService(prisma);
    return this._userService;
  }

  get authService() {
    if (!this._authService) this._authService = new AuthService(prisma);
    return this._authService;
  }

  get permissionService() {
    if (!this._permissionService) {
      this._permissionService = new PermissionService(prisma);
    }
    return this._permissionService;
  }

  get roleService() {
    if (!this._roleService) this._roleService = new RoleService(prisma);
    return this._roleService;
  }
}

export const container = new DIContainer();
