import { Hono } from "@hono/core";
import { validateJson } from "../../shared/utils/validator.ts";
import { requirePermission } from "../../shared/middlewares/permission.middleware.ts";
import type { AppEnv } from "../../core/context.ts";
import { extractPagination } from "../../shared/utils/pagination.ts";
import type { RoleService } from "./role.service.ts";
import {
  type CreateRoleInput,
  createRoleSchema,
  type UpdateRoleInput,
  updateRoleSchema,
} from "./role.validation.ts";

/**
 * Role management routes.
 *
 * Yêu cầu quyền "permissions.manage". (OWNER auto bypass).
 *
 * Base: /api/roles
 */
export const createRoleRoutes = (service: RoleService) => {
  const router = new Hono<AppEnv>();

  // Guard chung: Phải có quyền permissions.manage
  router.use("*", requirePermission("permissions.manage"));

  /**
   * GET /api/roles
   * Lấy danh sách toàn bộ roles.
   */
  router.get("/", async (c) => {
    const params = extractPagination(c.req.query());
    const result = await service.findMany(params);
    return c.json({ success: true, ...result });
  });

  /**
   * GET /api/roles/:code
   * Lấy chi tiết 1 role.
   */
  router.get("/:code", async (c) => {
    const code = c.req.param("code")!;
    const role = await service.findByCode(code);
    return c.json({ success: true, data: role });
  });

  /**
   * POST /api/roles
   * Tạo role mới. (Chỉ admin/user tier)
   */
  router.post("/", validateJson(createRoleSchema), async (c) => {
    const body = c.req.valid("json") as CreateRoleInput;
    const actorId = c.get("jwtPayload").id;
    const role = await service.create(body, actorId);

    c.header("Location", `/api/roles/${role.code}`);
    return c.json({ success: true, data: role }, 201);
  });

  /**
   * PATCH /api/roles/:code
   * Cập nhật thông tin role (name, description, active). Không được sửa code, tier, system.
   */
  router.patch(
    "/:code",
    validateJson(updateRoleSchema),
    async (c) => {
      const code = c.req.param("code")!;
      const body = c.req.valid("json") as UpdateRoleInput;
      const actorId = c.get("jwtPayload").id;

      const role = await service.update(code, body, actorId);
      return c.json({ success: true, data: role });
    },
  );

  /**
   * DELETE /api/roles/:code
   * Xóa role. Không cho xóa system role.
   */
  router.delete("/:code", async (c) => {
    const code = c.req.param("code")!;
    const actorId = c.get("jwtPayload").id;

    await service.delete(code, actorId);
    return c.json({
      success: true,
      message: `Role '${code}' has been deleted.`,
    });
  });

  return router;
};
