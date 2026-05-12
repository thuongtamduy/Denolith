import type { Context, Next } from "@hono/core";
import type { AppEnv } from "../../core/context.ts";
import { AppError } from "../errors/AppError.ts";
import { container } from "../../core/container.ts";

/**
 * Middleware kiểm tra permission nguyên tử — AND logic.
 * Tự động resolve và cache permissions vào context nếu chưa có.
 *
 * - OWNER: bypass ngay lập tức, không query DB/Redis
 * - ADMIN/USER: load từ Redis (hoặc DB nếu cache miss), kiểm tra code
 *
 * User phải có TẤT CẢ codes được truyền vào.
 * Để OR logic, dùng requireAnyPermission().
 *
 * Cách dùng:
 *   router.get("/users", requirePermission("users.read"), handler)
 *   router.delete("/users/:id", requirePermission("users.delete"), handler)
 */
export const requirePermission = (...codes: string[]) => {
  return async (c: Context<AppEnv>, next: Next) => {
    const payload = c.get("jwtPayload");
    if (!payload) throw AppError.unauthorized("Not authenticated.");

    // OWNER bypass hoàn toàn — check tier, không check role code
    if (payload.tier === "owner") {
      await next();
      return;
    }

    // Lazy-load permissions nếu chưa có trong context (tránh query trùng)
    let resolved = c.get("resolvedPermissions");
    if (!resolved) {
      resolved = await container.permissionService.resolvePermissions(
        payload.id,
        payload.tier, // dùng tier, không dùng role code
      );
      c.set("resolvedPermissions", resolved);
    }

    // AND check: phải có TẤT CẢ codes
    for (const code of codes) {
      if (!container.permissionService.hasPermission(resolved!, code)) {
        throw AppError.forbidden(
          `You do not have permission to perform this action. Required: "${code}"`,
        );
      }
    }

    await next();
  };
};

/**
 * Middleware kiểm tra permission — OR logic.
 * User chỉ cần có ÍT NHẤT 1 trong các codes.
 *
 * Cách dùng:
 *   router.get("/reports", requireAnyPermission("reports.view", "reports.export"), handler)
 */
export const requireAnyPermission = (...codes: string[]) => {
  return async (c: Context<AppEnv>, next: Next) => {
    const payload = c.get("jwtPayload");

    if (!payload) throw AppError.unauthorized("Not authenticated.");

    // OWNER bypass hoàn toàn — check tier, không check role code
    if (payload.tier === "owner") {
      await next();
      return;
    }

    let resolved = c.get("resolvedPermissions");
    if (!resolved) {
      resolved = await container.permissionService.resolvePermissions(
        payload.id,
        payload.tier, // dùng tier, không dùng role code
      );
      c.set("resolvedPermissions", resolved);
    }

    const hasAny = codes.some((code) =>
      container.permissionService.hasPermission(resolved!, code)
    );

    if (!hasAny) {
      throw AppError.forbidden(
        `You do not have permission to perform this action. Required one of: [${
          codes.join(", ")
        }]`,
      );
    }

    await next();
  };
};
