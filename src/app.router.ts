import { Hono } from "@hono/core";
import type { AppEnv } from "./core/context.ts";
import { container } from "./core/container.ts";
import {
  createPublicUserRoutes,
  createUserRoutes,
} from "./modules/user/user.routes.ts";
import { createAuthRoutes } from "./modules/auth/auth.routes.ts";
import { createPermissionRoutes } from "./modules/permission/permission.routes.ts";
import { createRoleRoutes } from "./modules/role/role.routes.ts";

export const createApiRouter = () => {
  const router = new Hono<AppEnv>();

  // Đăng ký các Route modules
  router.route("/auth", createAuthRoutes(container.authService));
  router.route("/users", createUserRoutes(container.userService));
  router.route(
    "/permissions",
    createPermissionRoutes(container.permissionService),
  );
  router.route("/roles", createRoleRoutes(container.roleService));

  return router;
};

export const createNormalRouter = () => {
  const router = new Hono<AppEnv>();

  // Sử dụng router công cộng (chỉ có API đọc) cho v0
  router.route("/users", createPublicUserRoutes(container.userService));

  return router;
};
