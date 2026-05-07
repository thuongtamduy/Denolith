import * as v from "valibot";

/**
 * Schema cho POST /api/permissions/profiles — Tạo permission profile mới.
 */
export const createProfileSchema = v.object({
  name: v.pipe(
    v.string("Tên profile không được để trống"),
    v.minLength(1),
    v.maxLength(100, "Tên profile tối đa 100 ký tự"),
  ),
  tier: v.union(
    [v.literal("admin"), v.literal("user")],
    "Tier phải là 'admin' hoặc 'user'",
  ),
  description: v.optional(v.pipe(v.string(), v.maxLength(500))),
});

/**
 * Schema cho PATCH /api/permissions/profiles/:id — Cập nhật profile.
 */
export const updateProfileSchema = v.partial(v.object({
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(100)),
  description: v.nullable(v.pipe(v.string(), v.maxLength(500))),
  active: v.boolean(),
}));

/**
 * Schema cho PUT /api/permissions/profiles/:id/codes/:code
 * Thêm hoặc cập nhật permission vào profile.
 */
export const setProfilePermissionSchema = v.object({
  granted: v.boolean("Trường 'granted' phải là boolean"),
});

/**
 * Schema cho POST /api/permissions/users/:userId/profiles
 * Assign permission profile cho user.
 */
export const assignProfileSchema = v.object({
  profileId: v.pipe(
    v.string("profileId không được để trống"),
    v.uuid("profileId phải là UUID hợp lệ"),
  ),
});

/**
 * Schema cho PUT /api/permissions/users/:userId/overrides/:code
 * Set quyền override cá nhân.
 */
export const setOverrideSchema = v.object({
  granted: v.boolean("Trường 'granted' phải là boolean"),
});

// Infer types để dùng trong route handlers
export type CreateProfileInput = v.InferOutput<typeof createProfileSchema>;
export type UpdateProfileInput = v.InferOutput<typeof updateProfileSchema>;
export type SetProfilePermissionInput = v.InferOutput<
  typeof setProfilePermissionSchema
>;
export type AssignProfileInput = v.InferOutput<typeof assignProfileSchema>;
export type SetOverrideInput = v.InferOutput<typeof setOverrideSchema>;
