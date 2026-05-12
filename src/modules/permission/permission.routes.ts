import { Hono } from "@hono/core";
import { validateJson } from "../../shared/utils/validator.ts";
import { validateUUID } from "../../shared/middlewares/validate-uuid.middleware.ts";
import { requirePermission } from "../../shared/middlewares/permission.middleware.ts";
import type { PermissionService } from "./permission.service.ts";
import type { AppEnv } from "../../core/context.ts";
import { extractPagination } from "../../shared/utils/pagination.ts";
import {
  type AssignProfileInput,
  assignProfileSchema,
  type CreateProfileInput,
  createProfileSchema,
  type SetOverrideInput,
  setOverrideSchema,
  type SetProfilePermissionInput,
  setProfilePermissionSchema,
  type UpdateProfileInput,
  updateProfileSchema,
} from "./permission.validation.ts";

import { authMiddleware } from "../../shared/middlewares/auth.middleware.ts";

/**
 * Permission management routes.
 *
 * Tất cả routes yêu cầu "permissions.manage".
 * OWNER bypass tự động — không cần check.
 *
 * Base: /api/permissions
 */
export const createPermissionRoutes = (service: PermissionService) => {
  const router = new Hono<AppEnv>();

  // Guard chung cho toàn bộ router — phải đăng nhập và chỉ OWNER hoặc user có "permissions.manage"
  router.use("*", authMiddleware, requirePermission("permissions.manage"));

  // ───────────────────────────────────────────
  // ATOMIC PERMISSIONS (developer-seeded, read-only)
  // ───────────────────────────────────────────

  /**
   * GET /api/permissions/codes
   * Xem toàn bộ permission codes đang có trong hệ thống.
   */
  router.get("/codes", async (c) => {
    const permissions = await service.findAllPermissions();
    return c.json({ success: true, data: permissions });
  });

  // ───────────────────────────────────────────
  // PERMISSION PROFILES
  // ───────────────────────────────────────────

  /**
   * GET /api/permissions/profiles?page=1&limit=20&tier=admin
   * Danh sách profiles, có thể filter theo tier.
   */
  router.get("/profiles", async (c) => {
    const params = extractPagination(c.req.query());
    const tier = c.req.query("tier") as "admin" | "user" | undefined;
    const result = await service.findManyProfiles(params, tier);
    return c.json({ success: true, ...result });
  });

  /**
   * POST /api/permissions/profiles
   * Tạo permission profile mới.
   */
  router.post("/profiles", validateJson(createProfileSchema), async (c) => {
    const body = c.req.valid("json") as CreateProfileInput;
    const actorId = c.get("jwtPayload").id;
    const profile = await service.createProfile(body, actorId);
    c.header("Location", `/api/permissions/profiles/${profile.id}`);
    return c.json({ success: true, data: profile }, 201);
  });

  /**
   * GET /api/permissions/profiles/:id
   * Chi tiết 1 profile kèm danh sách permissions bên trong.
   */
  router.get("/profiles/:id", validateUUID("id"), async (c) => {
    const id = c.req.param("id")!;
    const profile = await service.findProfileById(id);
    const codes = await service.findProfilePermissions(id);
    return c.json({ success: true, data: { ...profile, permissions: codes } });
  });

  /**
   * PATCH /api/permissions/profiles/:id
   * Cập nhật tên, mô tả, hoặc trạng thái active của profile.
   */
  router.patch(
    "/profiles/:id",
    validateUUID("id"),
    validateJson(updateProfileSchema),
    async (c) => {
      const id = c.req.param("id")!;
      const body = c.req.valid("json") as UpdateProfileInput;
      const actorId = c.get("jwtPayload").id;
      const profile = await service.updateProfile(id, body, actorId);
      return c.json({ success: true, data: profile });
    },
  );

  /**
   * DELETE /api/permissions/profiles/:id
   * Xóa profile. Toàn bộ user_profiles assignment bị cascade xóa.
   */
  router.delete("/profiles/:id", validateUUID("id"), async (c) => {
    const id = c.req.param("id")!;
    const actorId = c.get("jwtPayload").id;
    await service.deleteProfile(id, actorId);
    return c.json({ success: true, message: "Profile deleted successfully." });
  });

  // ───────────────────────────────────────────
  // PROFILE ↔ PERMISSION CODES
  // ───────────────────────────────────────────

  /**
   * PUT /api/permissions/profiles/:id/codes/:code
   * Thêm hoặc cập nhật 1 permission code vào profile.
   * Body: { granted: boolean }
   */
  router.put(
    "/profiles/:id/codes/:code",
    validateUUID("id"),
    validateJson(setProfilePermissionSchema),
    async (c) => {
      const profileId = c.req.param("id")!;
      const permissionCode = c.req.param("code")!;
      const { granted } = c.req.valid("json") as SetProfilePermissionInput;
      await service.setProfilePermission(profileId, permissionCode, granted);
      return c.json({
        success: true,
        message: `Permission "${permissionCode}" has been ${
          granted ? "granted to" : "denied in"
        } the profile.`,
      });
    },
  );

  /**
   * DELETE /api/permissions/profiles/:id/codes/:code
   * Xóa 1 permission code khỏi profile.
   */
  router.delete("/profiles/:id/codes/:code", validateUUID("id"), async (c) => {
    const profileId = c.req.param("id")!;
    const permissionCode = c.req.param("code")!;
    await service.removeProfilePermission(profileId, permissionCode);
    return c.json({
      success: true,
      message: `Permission "${permissionCode}" removed from profile.`,
    });
  });

  // ───────────────────────────────────────────
  // USER ↔ PROFILES
  // ───────────────────────────────────────────

  /**
   * GET /api/permissions/users/:userId/profiles
   * Xem danh sách profiles đang được assign cho user.
   */
  router.get(
    "/users/:userId/profiles",
    validateUUID("userId"),
    async (c) => {
      const userId = c.req.param("userId")!;
      const profiles = await service.findUserProfiles(userId);
      return c.json({ success: true, data: profiles });
    },
  );

  /**
   * POST /api/permissions/users/:userId/profiles
   * Assign 1 profile cho user.
   * Body: { profileId: UUID }
   */
  router.post(
    "/users/:userId/profiles",
    validateUUID("userId"),
    validateJson(assignProfileSchema),
    async (c) => {
      const userId = c.req.param("userId")!;
      const { profileId } = c.req.valid("json") as AssignProfileInput;
      const actorId = c.get("jwtPayload").id;
      await service.assignProfile(userId, profileId, actorId);
      return c.json({
        success: true,
        message: "Profile assigned to user successfully.",
      });
    },
  );

  /**
   * DELETE /api/permissions/users/:userId/profiles/:profileId
   * Thu hồi 1 profile khỏi user.
   */
  router.delete(
    "/users/:userId/profiles/:profileId",
    validateUUID("userId"),
    validateUUID("profileId"),
    async (c) => {
      const userId = c.req.param("userId")!;
      const profileId = c.req.param("profileId")!;
      const actorId = c.get("jwtPayload").id;
      await service.revokeProfile(userId, profileId, actorId);
      return c.json({
        success: true,
        message: "Profile revoked from user successfully.",
      });
    },
  );

  // ───────────────────────────────────────────
  // USER INDIVIDUAL OVERRIDES
  // ───────────────────────────────────────────

  /**
   * GET /api/permissions/users/:userId/overrides
   * Xem các override cá nhân của user.
   */
  router.get(
    "/users/:userId/overrides",
    validateUUID("userId"),
    async (c) => {
      const userId = c.req.param("userId")!;
      const overrides = await service.findUserOverrides(userId);
      return c.json({ success: true, data: overrides });
    },
  );

  /**
   * PUT /api/permissions/users/:userId/overrides/:code
   * Cấp hoặc thu hồi 1 quyền cụ thể cho user (override cá nhân).
   * Body: { granted: boolean }
   */
  router.put(
    "/users/:userId/overrides/:code",
    validateUUID("userId"),
    validateJson(setOverrideSchema),
    async (c) => {
      const userId = c.req.param("userId")!;
      const permissionCode = c.req.param("code")!;
      const { granted } = c.req.valid("json") as SetOverrideInput;
      const actorId = c.get("jwtPayload").id;
      await service.setOverride(userId, permissionCode, granted, actorId);
      return c.json({
        success: true,
        message: `Override "${permissionCode}" has been ${
          granted ? "granted" : "revoked"
        }.`,
      });
    },
  );

  /**
   * DELETE /api/permissions/users/:userId/overrides/:code
   * Xóa override — user sẽ fallback về quyền từ profile.
   */
  router.delete(
    "/users/:userId/overrides/:code",
    validateUUID("userId"),
    async (c) => {
      const userId = c.req.param("userId")!;
      const permissionCode = c.req.param("code")!;
      const actorId = c.get("jwtPayload").id;
      await service.removeOverride(userId, permissionCode, actorId);
      return c.json({
        success: true,
        message: `Override "${permissionCode}" removed successfully.`,
      });
    },
  );

  return router;
};
