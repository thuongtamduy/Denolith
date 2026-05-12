import type { User } from "@db";

/**
 * Loại bỏ các trường nhạy cảm (password) khỏi User object
 * trước khi trả về cho Client — tránh Sensitive Data Exposure.
 */
export function sanitizeUser(user: User): Omit<User, "password"> {
  const { password: _password, ...safeUser } = user;
  return safeUser;
}
