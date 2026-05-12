import * as v from "valibot";

/**
 * Shared phone schema — dùng chung cho cả create và update.
 * Chuẩn VN: 10-11 ký tự, bắt đầu bằng 0 hoặc +
 */
export const phoneSchema = v.pipe(
  v.string(),
  v.regex(
    /^(0|\+)\d{9,10}$/,
    "Số điện thoại phải dài 10-11 ký tự và bắt đầu bằng 0 hoặc +",
  ),
);

/**
 * Schema cho POST /api/users — Admin tạo user mới.
 */
export const createUserSchema = v.object({
  username: v.pipe(v.string(), v.minLength(3), v.maxLength(50)),
  email: v.pipe(v.string(), v.email(), v.maxLength(255)),
  password: v.pipe(v.string(), v.minLength(6), v.maxLength(100)),
  phone: v.optional(phoneSchema),
  roleCode: v.optional(v.string(), "user"),
  firstName: v.optional(v.pipe(v.string(), v.maxLength(100))),
  lastName: v.optional(v.pipe(v.string(), v.maxLength(100))),
  displayName: v.optional(v.pipe(v.string(), v.maxLength(100))),
  gender: v.optional(v.picklist(["male", "female", "other"])),
  bio: v.optional(v.pipe(v.string(), v.maxLength(500))),
});

/**
 * Schema cho PATCH /api/users/:id — Partial update, chỉ các field được phép chỉnh sửa.
 * Không bao gồm: email, role, password, deleted — chống Mass Assignment ở tầng validation.
 */
export const updateUserSchema = v.partial(
  v.object({
    username: v.pipe(v.string(), v.minLength(3), v.maxLength(50)),
    phone: phoneSchema,
    active: v.boolean(),
    firstName: v.pipe(v.string(), v.maxLength(100)),
    lastName: v.pipe(v.string(), v.maxLength(100)),
    displayName: v.pipe(v.string(), v.maxLength(100)),
    gender: v.picklist(["male", "female", "other"]),
    bio: v.pipe(v.string(), v.maxLength(500)),
  }),
);

// Infer types để dùng trực tiếp trong route handlers (type-safe, không cần cast)
export type CreateUserInput = v.InferOutput<typeof createUserSchema>;
export type UpdateUserInput = v.InferOutput<typeof updateUserSchema>;

/**
 * Schema cho PATCH /api/users/:id/role
 */
export const updateUserRoleSchema = v.object({
  role: v.pipe(v.string(), v.minLength(3), v.maxLength(50)),
});
export type UpdateUserRoleInput = v.InferOutput<typeof updateUserRoleSchema>;
