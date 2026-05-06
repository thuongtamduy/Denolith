import { Hono } from "@hono/core";
import { validateJson } from "../../shared/utils/validator.ts";
import * as v from "valibot";
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

  const phoneSchema = v.pipe(
    v.string(),
    v.regex(
      /^(0|\+)\d{9,10}$/,
      "Số điện thoại phải dài 10-11 ký tự và bắt đầu bằng 0 hoặc +",
    ),
  );

  // POST /api/users — Tạo user mới (Admin)
  const createUserSchema = v.object({
    username: v.pipe(v.string(), v.minLength(3)),
    email: v.pipe(v.string(), v.email()),
    password: v.pipe(v.string(), v.minLength(6)),
    phone: v.optional(phoneSchema),
  });

  router.post("/", validateJson(createUserSchema), async (c) => {
    const body = c.req.valid("json") as Parameters<UserService["create"]>[0];
    // TODO: Nên hash password trước khi truyền vào repo ở tầng service
    // Hiện tại auth.service.ts đang tự gọi userRepo.create.
    // Tạm thời Admin tạo sẽ chạy qua userService.create
    const user = await service.create(body);

    c.header("Location", `/api/users/${user.id}`);
    return c.json({ success: true, data: sanitizeUser(user) }, 201);
  });

  // PATCH /api/users/:id — Cập nhật user (Partial Update)
  const updateUserSchema = v.partial(v.object({
    username: v.pipe(v.string(), v.minLength(3)),
    phone: phoneSchema,
    active: v.boolean(),
  }));

  router.patch(
    "/:id",
    validateUUID(),
    validateJson(updateUserSchema),
    async (c) => {
      const id = c.req.param("id")!;
      const body = c.req.valid("json") as Parameters<UserService["update"]>[1];

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

      return c.json({
        success: true,
        message:
          "User has been permanently deleted. This action cannot be undone.",
      });
    } else {
      const user = await service.softDelete(id);

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
    }
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

  return router;
};
