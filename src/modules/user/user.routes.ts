import { Hono } from "@hono/core";
import type { UserService } from "./user.service.ts";
import { extractPagination } from "../../shared/utils/pagination.ts";
import { authMiddleware } from "../../shared/middlewares/auth.middleware.ts";
import { requireRole } from "../../shared/middlewares/rbac.middleware.ts";
import { cacheResponse } from "../../shared/middlewares/cache.middleware.ts";
import { sanitizeUser } from "../../shared/utils/sanitize.ts";

export const createUserRoutes = (service: UserService) => {
  const router = new Hono();

  // Phân quyền RBAC: Chỉ Admin mới được truy cập các đường dẫn quản lý Users
  router.use("*", authMiddleware, requireRole("admin"));

  // Áp dụng Caching (60 giây) cho API lấy danh sách User
  router.get("/", cacheResponse(60), async (c) => {
    const params = extractPagination(c.req.query());
    const result = await service.findMany(params);
    return c.json({
      success: true,
      ...result,
      data: result.data.map(sanitizeUser), // Lọc password hash khỏi từng user
    });
  });

  router.get("/:id", async (c) => {
    const id = c.req.param("id");
    const user = await service.findById(id);
    return c.json({ success: true, data: sanitizeUser(user) });
  });

  return router;
};
