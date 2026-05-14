import { prisma } from "./database.ts";
import { UserService } from "../modules/user/user.service.ts";
import { AuthService } from "../modules/auth/auth.service.ts";
import { PermissionService } from "../modules/permission/permission.service.ts";
import { RoleService } from "../modules/role/role.service.ts";
import { AppMenuService } from "../modules/app-menu/app-menu.service.ts";

// Lightweight Lazy Dependency Injection Container (10/10 Pattern)
class DIContainer {
  private _userService?: UserService;
  private _authService?: AuthService;
  private _permissionService?: PermissionService;
  private _roleService?: RoleService;
  private _appMenuService?: AppMenuService;

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

  get appMenuService() {
    if (!this._appMenuService) {
      this._appMenuService = new AppMenuService(prisma);
    }
    return this._appMenuService;
  }
}

export const container = new DIContainer();
