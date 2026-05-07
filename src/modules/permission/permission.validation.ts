import * as v from "valibot";

/**
 * Schema cho POST /api/permissions/profiles — Tạo permission profile mới.
 */
export const createProfileSchema = v.object({
  name: v.pipe(
    v.string("Profile name must not be empty."),
    v.minLength(1),
    v.maxLength(100, "Profile name must not exceed 100 characters."),
  ),
  tier: v.union(
    [v.literal("admin"), v.literal("user")],
    "Tier must be 'admin' or 'user'.",
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
  granted: v.boolean("Field 'granted' must be a boolean."),
});

/**
 * Schema cho POST /api/permissions/users/:userId/profiles
 * Assign permission profile cho user.
 */
export const assignProfileSchema = v.object({
  profileId: v.pipe(
    v.string("profileId must not be empty."),
    v.uuid("profileId must be a valid UUID."),
  ),
});

/**
 * Schema cho PUT /api/permissions/users/:userId/overrides/:code
 * Set quyền override cá nhân.
 */
export const setOverrideSchema = v.object({
  granted: v.boolean("Field 'granted' must be a boolean."),
});

// Infer types để dùng trong route handlers
export type CreateProfileInput = v.InferOutput<typeof createProfileSchema>;
export type UpdateProfileInput = v.InferOutput<typeof updateProfileSchema>;
export type SetProfilePermissionInput = v.InferOutput<
  typeof setProfilePermissionSchema
>;
export type AssignProfileInput = v.InferOutput<typeof assignProfileSchema>;
export type SetOverrideInput = v.InferOutput<typeof setOverrideSchema>;
