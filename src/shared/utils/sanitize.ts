import type { User } from "../../modules/user/user.entity.ts";

/**
 * Loại bỏ các trường nhạy cảm (password) khỏi User object
 * trước khi trả về cho Client — tránh Sensitive Data Exposure.
 */
export function sanitizeUser(user: User): Omit<User, "password"> {
  const { password: _password, ...safeUser } = user;
  return safeUser;
}
