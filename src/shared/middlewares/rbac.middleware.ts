import type { Context, Next } from "@hono/core";

export const requireRole = (allowedRole: string) => {
  return async (c: Context, next: Next) => {
    // authMiddleware (JWT) tự động gán thông tin giải mã vào 'jwtPayload'
    const payload = c.get("jwtPayload");

    if (!payload || !payload.role) {
      return c.json({
        success: false,
        error: "Access denied. No role provided.",
      }, 403);
    }

    if (payload.role !== allowedRole) {
      return c.json(
        {
          success: false,
          error:
            `Access denied. Requires '${allowedRole}' role, but found '${payload.role}'.`,
        },
        403,
      );
    }

    await next();
  };
};
