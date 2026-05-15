import * as v from "valibot";

/**
 * Schema cho POST /auth/register — Tạo tài khoản mới.
 */
export const registerSchema = v.object({
  username: v.pipe(
    v.string(),
    v.minLength(3),
    v.maxLength(50),
    v.regex(
      /^[a-zA-Z0-9_ áàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ]+$/i,
      "Username chỉ được chứa chữ cái, số và khoảng trắng",
    ),
  ),
  email: v.pipe(v.string(), v.email(), v.maxLength(255)),
  password: v.pipe(v.string(), v.minLength(6), v.maxLength(100)),
});

/**
 * Schema cho POST /auth/login — Đăng nhập.
 */
export const loginSchema = v.object({
  email: v.pipe(
    v.string("Email is required"),
    v.email("Invalid email format"),
    v.maxLength(255),
  ),
  password: v.pipe(
    v.string("Password is required"),
    v.minLength(1, "Password cannot be empty"),
    v.maxLength(100),
  ),
});

// Infer types để dùng trong route handlers
export type RegisterInput = v.InferOutput<typeof registerSchema>;
export type LoginInput = v.InferOutput<typeof loginSchema>;
