import type { Context, Next } from "@hono/core";
import type { AppEnv } from "../../core/context.ts";
import { AppError } from "../errors/AppError.ts";

/**
 * Middleware kiểm tra tier của user từ JWT payload.
 * Hỗ trợ nhiều tiers — truyền vào dạng rest params.
 *
 * Ví dụ:
 *   requireRole("admin")           — tất cả roles có tier="admin"
 *   requireRole("admin", "owner")  — tier admin hoặc owner
 *
 * Lưu ý: check TIER, không phải role code cụ thể.
 * Nếu cần check role code cụ thể, dùng requirePermission().
 */
export const requireRole = (...allowedTiers: string[]) => {
  return async (c: Context<AppEnv>, next: Next) => {
    const payload = c.get("jwtPayload");

    if (!payload?.tier) {
      throw AppError.forbidden("Access denied. No tier provided.");
    }

    // OWNER bypass mọi RBAC
    if (payload.tier === "owner") {
      await next();
      return;
    }

    if (!allowedTiers.includes(payload.tier)) {
      throw AppError.forbidden(
        `Access denied. Requires one of [${
          allowedTiers.join(", ")
        }] tier, but found '${payload.tier}'.`,
      );
    }

    await next();
  };
};

