import { Hono } from "@hono/core";
import { validateJson } from "../../shared/utils/validator.ts";
import type { UserService } from "./user.service.ts";
import { extractPagination } from "../../shared/utils/pagination.ts";
import { authMiddleware } from "../../shared/middlewares/auth.middleware.ts";
import { requireRole } from "../../shared/middlewares/rbac.middleware.ts";
import { cacheResponse } from "../../shared/middlewares/cache.middleware.ts";
import { sanitizeUser } from "../../shared/utils/sanitize.ts";
import type { AppEnv } from "../../core/context.ts";
import { validateUUID } from "../../shared/middlewares/validate-uuid.middleware.ts";
import { AuditService } from "../../core/audit.ts";
import { AppError } from "../../shared/errors/AppError.ts";
import {
  type CreateUserInput,
  createUserSchema,
  type UpdateUserInput,
  updateUserSchema,
} from "./user.validation.ts";

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

  // POST /api/users — Tạo user mới (Admin)
  router.post("/", validateJson(createUserSchema), async (c) => {
    const body = c.req.valid("json") as CreateUserInput;
    const user = await service.create(body);

    c.header("Location", `/api/users/${user.id}`);
    return c.json({ success: true, data: sanitizeUser(user) }, 201);
  });

  // PATCH /api/users/:id — Cập nhật user (Partial Update)
  router.patch(
    "/:id",
    validateUUID(),
    validateJson(updateUserSchema),
    async (c) => {
      const id = c.req.param("id")!;
      const body = c.req.valid("json") as UpdateUserInput;

      const user = await service.update(id, body);
      return c.json({ success: true, data: sanitizeUser(user) });
    },
  );

  // DELETE /api/users/:id — Xóa user (Hỗ trợ query ?force=true để xóa cứng)
  router.delete("/:id", validateUUID(), async (c) => {
    const id = c.req.param("id")!;
    const requesterId = c.get("jwtPayload")?.id;
    const isForce = c.req.query("force") === "true";

    // Ngăn Admin tự xóa chính mình
    if (id === requesterId) {
      throw AppError.badRequest(
        isForce
          ? "You cannot permanently delete your own account."
          : "You cannot delete your own account.",
      );
    }

    if (isForce) {
      await service.hardDelete(id);

      await AuditService.log({
        actorId: requesterId,
        action: "user.hard_delete",
        targetType: "user",
        targetId: id,
      });

      // 204 No Content — xóa cứng không còn resource để trả về
      return new Response(null, { status: 204 });
    } else {
      await service.softDelete(id);

      await AuditService.log({
        actorId: requesterId,
        action: "user.soft_delete",
        targetType: "user",
        targetId: id,
      });

      return c.json({
        success: true,
        message: "User has been soft-deleted and can be restored.",
      });
    }
  });

  // POST /api/users/:id/restore — Phục hồi user đã bị soft delete
  // Dùng POST thay vì PATCH vì đây là "hành động" (action), không phải partial update resource
  router.post("/:id/restore", validateUUID(), async (c) => {
    const id = c.req.param("id")!;
    const user = await service.restore(id);

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

  return router;
};
