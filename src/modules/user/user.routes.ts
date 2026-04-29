import { Hono } from "@hono/core";
import type { UserService } from "./user.service.ts";
import { extractPagination } from "../../shared/utils/pagination.ts";
import { authMiddleware } from "../../shared/middlewares/auth.middleware.ts";
import { requireRole } from "../../shared/middlewares/rbac.middleware.ts";
import { cacheResponse } from "../../shared/middlewares/cache.middleware.ts";
import { sanitizeUser } from "../../shared/utils/sanitize.ts";
import type { AppEnv } from "../../core/context.ts";
import { validateUUID } from "../../shared/middlewares/validate-uuid.middleware.ts";
import { AuditService } from "../../core/audit.ts";

export const createUserRoutes = (service: UserService) => {
  const router = new Hono<AppEnv>();

  // Phân quyền RBAC: Chỉ Admin mới được truy cập các đường dẫn quản lý Users
  router.use("*", authMiddleware, requireRole("admin"));

  // GET /api/users — Lấy danh sách user (chỉ user chưa bị xóa)
  router.get("/", cacheResponse(60), async (c) => {
    const params = extractPagination(c.req.query());
    const result = await service.findMany(params);
    return c.json({
      success: true,
      ...result,
      data: result.data.map(sanitizeUser),
    });
  });

  // GET /api/users/:id — Lấy thông tin một user
  router.get("/:id", validateUUID(), async (c) => {
    const id = c.req.param("id")!; // validateUUID() đã đảm bảo id luôn hợp lệ
    const user = await service.findById(id);
    return c.json({ success: true, data: sanitizeUser(user) });
  });

  // DELETE /api/users/:id — Soft Delete user
  router.delete("/:id", validateUUID(), async (c) => {
    const id = c.req.param("id")!;
    const requesterId = c.get("jwtPayload")?.id;

    // Ngăn Admin tự xóa chính mình
    if (id === requesterId) {
      return c.json(
        { success: false, error: "You cannot delete your own account." },
        400,
      );
    }

    const user = await service.softDelete(id);

    // Ghi Audit Log bất đồng bộ (không block response)
    await AuditService.log({
      actorId: requesterId,
      action: "user.soft_delete",
      targetType: "user",
      targetId: id,
    });

    return c.json({
      success: true,
      message: `User '${user.username}' has been soft-deleted.`,
      data: sanitizeUser(user),
    });
  });

  // PATCH /api/users/:id/restore — Phục hồi user đã bị soft delete
  router.patch("/:id/restore", validateUUID(), async (c) => {
    const id = c.req.param("id")!;
    const user = await service.restore(id);

    // Ghi Audit Log bất đồng bộ
    await AuditService.log({
      actorId: c.get("jwtPayload")?.id,
      action: "user.restore",
      targetType: "user",
      targetId: id,
    });

    return c.json({
      success: true,
      message: `User '${user.username}' has been restored successfully.`,
      data: sanitizeUser(user),
    });
  });

  // POST /api/users/:id/hard-delete — Hard Delete (Xóa vĩnh viễn — phải soft delete trước)
  // Dùng POST thay vì DELETE để tránh conflict route với DELETE /:id
  router.post("/:id/hard-delete", validateUUID(), async (c) => {
    const id = c.req.param("id")!;
    const requesterId = c.get("jwtPayload")?.id;

    // Ngăn Admin tự xóa vĩnh viễn chính mình
    if (id === requesterId) {
      return c.json(
        { success: false, error: "You cannot permanently delete your own account." },
        400,
      );
    }

    await service.hardDelete(id);

    // Ghi Audit Log bất đồng bộ
    await AuditService.log({
      actorId: requesterId,
      action: "user.hard_delete",
      targetType: "user",
      targetId: id,
    });

    return c.json({
      success: true,
      message: "User has been permanently deleted. This action cannot be undone.",
    });
  });

  return router;
};
