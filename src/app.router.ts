import { Hono } from "@hono/core";
import type { AppEnv } from "./core/context.ts";
import { container } from "./core/container.ts";
import {
  createPublicUserRoutes,
  createUserRoutes,
} from "./modules/user/user.routes.ts";
import {
  createAuthRoutes,
  createPublicAuthRoutes,
} from "./modules/auth/auth.routes.ts";
import { createPermissionRoutes } from "./modules/permission/permission.routes.ts";
import { createRoleRoutes } from "./modules/role/role.routes.ts";
import { createAppMenuRoutes } from "./modules/app-menu/app-menu.routes.ts";
import { createStoreRoutes } from "./modules/store/store.routes.ts";
import { createMediaRoutes } from "./modules/media/media.routes.ts";
import { createLanguageRoutes } from "./modules/language/language.routes.ts";
import { clientContextMiddleware } from "./shared/middlewares/client-context.middleware.ts";

export const createApiRouter = () => {
  const router = new Hono<AppEnv>();

  // Áp dụng middleware trích xuất client context từ header (x-lang, x-api-key)
  router.use("*", clientContextMiddleware);

  // Đăng ký các Route modules
  router.route("/auth", createAuthRoutes(container.authService));
  router.route("/users", createUserRoutes(container.userService));
  router.route(
    "/permissions",
    createPermissionRoutes(container.permissionService),
  );
  router.route("/roles", createRoleRoutes(container.roleService));
  router.route("/app-menus", createAppMenuRoutes(container.appMenuService));
  router.route("/stores", createStoreRoutes(container.storeService));
  router.route("/media", createMediaRoutes(container.mediaService));
  router.route("/languages", createLanguageRoutes(container.languageService));

  return router;
};

export const createNormalRouter = () => {
  const router = new Hono<AppEnv>();

  // Áp dụng middleware trích xuất client context từ header
  router.use("*", clientContextMiddleware);

  // Sử dụng router công cộng (chỉ có API đọc)
  router.route("/auth", createPublicAuthRoutes(container.authService));
  router.route("/users", createPublicUserRoutes(container.userService));

  return router;
};
