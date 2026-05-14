import { Hono } from "@hono/core";
import { describeRoute } from "../../shared/utils/openapi.ts";
import { validateJson, validateQuery } from "../../shared/utils/validator.ts";
import type { UserService } from "./user.service.ts";
import {
  extractPagination,
  paginationQuerySchema,
} from "../../shared/utils/pagination.ts";
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
  type UpdateUserRoleInput,
  updateUserRoleSchema,
  updateUserSchema,
} from "./user.validation.ts";
import { requirePermission } from "../../shared/middlewares/permission.middleware.ts";

export const createUserRoutes = (service: UserService) => {
  const router = new Hono<AppEnv>();

  // Phân quyền RBAC: Chỉ Admin mới được truy cập các đường dẫn quản lý Users
  router.use("*", authMiddleware, requireRole("admin"));

  // GET /api/users — Lấy danh sách user (chỉ user chưa bị xóa)
  router.get(
    "/",
    describeRoute({
      tags: ["Users"],
      summary: "Get list of users",
      responses: {
        200: { description: "Successful response" },
        400: { description: "Bad request or validation error" },
        401: { description: "Unauthorized" },
        500: { description: "Internal server error" },
      },
    }),
    validateQuery(paginationQuerySchema),
    cacheResponse(60),
    async (c) => {
      const params = extractPagination(c.req.query());
      const result = await service.findMany(params);
      return c.json({
        success: true,
        data: result.data,
        meta: result.meta,
      });
    },
  );

  // GET /api/users/:id — Lấy thông tin một user
  router.get(
    "/:id",
    describeRoute({
      tags: ["Users"],
      summary: "Get user details",
      responses: {
        200: { description: "Successful response" },
        404: { description: "User not found" },
      },
    }),
    validateUUID(),
    async (c) => {
      const id = c.req.param("id")!; // validateUUID() đã đảm bảo id luôn hợp lệ
      const user = await service.findById(id);
      return c.json({ success: true, data: sanitizeUser(user) });
    },
  );

  // POST /api/users — Tạo user mới (Admin)
  router.post(
    "/",
    describeRoute({
      tags: ["Users"],
      summary: "Create a new user",
      requestBody: {
        content: {
          "application/json": {
            example: {
              username: "owner",
              email: "owner@denolith.dev",
              password: "Owner@123456",
              roleCode: "owner",
              firstName: "System",
              lastName: "Owner",
              displayName: "Owner",
              gender: "male",
              bio: "System owner account",
            },
          },
        },
      },
      responses: {
        201: { description: "User created successfully" },
        400: { description: "Bad request or validation error" },
        401: { description: "Unauthorized" },
        500: { description: "Internal server error" },
      },
    }),
    validateJson(createUserSchema),
    async (c) => {
      const body = c.req.valid("json") as CreateUserInput;
      const user = await service.create(body);

      c.header("Location", `/api/users/${user.id}`);
      return c.json({ success: true, data: sanitizeUser(user) }, 201);
    },
  );

  // PATCH /api/users/:id — Cập nhật user (Partial Update)
  router.patch(
    "/:id",
    describeRoute({
      tags: ["Users"],
      summary: "Update user details",
      requestBody: {
        content: {
          "application/json": {
            example: {
              firstName: "Updated System",
              lastName: "Owner",
              bio: "Updated owner account bio",
            },
          },
        },
      },
      responses: {
        200: { description: "User updated successfully" },
        400: { description: "Bad request or validation error" },
        401: { description: "Unauthorized" },
        500: { description: "Internal server error" },
      },
    }),
    validateUUID(),
    validateJson(updateUserSchema),
    async (c) => {
      const id = c.req.param("id")!;
      const body = c.req.valid("json") as UpdateUserInput;

      const user = await service.update(id, body);
      return c.json({ success: true, data: sanitizeUser(user) });
    },
  );

  // PATCH /api/users/:id/role — Cập nhật role của user (Thăng cấp / Hạ cấp)
  // Yêu cầu quyền permissions.manage (hoặc OWNER bypass)
  router.patch(
    "/:id/role",
    describeRoute({
      tags: ["Users"],
      summary: "Update user role",
      requestBody: {
        content: {
          "application/json": {
            example: {
              role: "admin",
            },
          },
        },
      },
      responses: {
        200: { description: "User role updated successfully" },
        400: { description: "Bad request or validation error" },
        401: { description: "Unauthorized" },
        500: { description: "Internal server error" },
      },
    }),
    requirePermission("permissions.manage"),
    validateUUID(),
    validateJson(updateUserRoleSchema),
    async (c) => {
      const id = c.req.param("id")!;
      const body = c.req.valid("json") as UpdateUserRoleInput;
      const actorId = c.get("jwtPayload")?.id;

      const user = await service.updateRole(id, body.role, actorId);
      return c.json({ success: true, data: sanitizeUser(user) });
    },
  );

  // DELETE /api/users/:id — Xóa user (Hỗ trợ query ?force=true để xóa cứng)
  router.delete(
    "/:id",
    describeRoute({
      tags: ["Users"],
      summary: "Delete user",
      responses: {
        200: { description: "User soft-deleted successfully" },
        204: { description: "User hard-deleted successfully" },
      },
    }),
    validateUUID(),
    async (c) => {
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
    },
  );

  // POST /api/users/:id/restore — Phục hồi user đã bị soft delete
  // Dùng POST thay vì PATCH vì đây là "hành động" (action), không phải partial update resource
  router.post(
    "/:id/restore",
    describeRoute({
      tags: ["Users"],
      summary: "Restore soft-deleted user",
      responses: {
        200: { description: "User restored successfully" },
        400: { description: "Bad request or validation error" },
        401: { description: "Unauthorized" },
        500: { description: "Internal server error" },
      },
    }),
    validateUUID(),
    async (c) => {
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
    },
  );

  return router;
};

/**
 * Public User Routes (v0)
 * Các route ở đây KHÔNG đi qua authMiddleware, nên ai cũng có thể gọi được.
 * Chỉ cung cấp các API Read-Only an toàn (GET).
 */
export const createPublicUserRoutes = (service: UserService) => {
  const router = new Hono<AppEnv>();

  // GET /api/v0/users — Lấy danh sách user
  router.get(
    "/",
    describeRoute({
      tags: ["Public Users (v0)"],
      summary: "Get list of public users",
      security: [],
      responses: {
        200: { description: "Successful response" },
        400: { description: "Bad request or validation error" },
        401: { description: "Unauthorized" },
        500: { description: "Internal server error" },
      },
    }),
    validateQuery(paginationQuerySchema),
    cacheResponse(60),
    async (c) => {
      const params = extractPagination(c.req.query());
      const result = await service.findMany(params);
      return c.json({
        success: true,
        data: result.data,
        meta: result.meta,
      });
    },
  );

  // GET /api/v0/users/:id — Lấy thông tin chi tiết
  router.get(
    "/:id",
    describeRoute({
      tags: ["Public Users (v0)"],
      summary: "Get public user details",
      security: [],
      responses: {
        200: { description: "Successful response" },
        404: { description: "User not found" },
      },
    }),
    validateUUID(),
    async (c) => {
      const id = c.req.param("id")!;
      const user = await service.findById(id);
      return c.json({ success: true, data: sanitizeUser(user) });
    },
  );

  return router;
};
