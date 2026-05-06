import type { Context, Next } from "@hono/core";
import type { AppEnv } from "../../core/context.ts";
import { AppError } from "../errors/AppError.ts";

/**
 * Middleware kiểm tra role của user từ JWT payload.
 * Hỗ trợ nhiều roles — truyền vào dạng rest params.
 *
 * Ví dụ:
 *   requireRole("admin")                  — chỉ admin
 *   requireRole("admin", "superadmin")    — admin hoặc superadmin
 */
export const requireRole = (...allowedRoles: string[]) => {
  return async (c: Context<AppEnv>, next: Next) => {
    // authMiddleware (JWT) tự động gán thông tin giải mã vào 'jwtPayload'
    const payload = c.get("jwtPayload");

    if (!payload?.role) {
      throw AppError.forbidden("Access denied. No role provided.");
    }

    if (!allowedRoles.includes(payload.role)) {
      throw AppError.forbidden(
        `Access denied. Requires one of [${
          allowedRoles.join(", ")
        }], but found '${payload.role}'.`,
      );
    }

    await next();
  };
};
