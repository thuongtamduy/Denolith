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
  }),
);

// Infer types để dùng trực tiếp trong route handlers (type-safe, không cần cast)
export type CreateUserInput = v.InferOutput<typeof createUserSchema>;
export type UpdateUserInput = v.InferOutput<typeof updateUserSchema>;
