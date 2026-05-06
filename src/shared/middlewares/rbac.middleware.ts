import type { Context, Next } from "@hono/core";
import type { AppEnv } from "../../core/context.ts";
import { AppError } from "../errors/AppError.ts";

export const requireRole = (allowedRole: string) => {
  return async (c: Context<AppEnv>, next: Next) => {
    // authMiddleware (JWT) tự động gán thông tin giải mã vào 'jwtPayload'
    const payload = c.get("jwtPayload");

    if (!payload || !payload.role) {
      throw AppError.forbidden("Access denied. No role provided.");
    }

    if (payload.role !== allowedRole) {
      throw AppError.forbidden(
        `Access denied. Requires '${allowedRole}' role, but found '${payload.role}'.`,
      );
    }

    await next();
  };
};
