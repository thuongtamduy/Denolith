import type { Context, Next } from "@hono/core";
import { AppError } from "../errors/AppError.ts";

// Regex UUID chung (chấp nhận mọi version, thay vì chỉ ép buộc v4)
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Middleware kiểm tra tham số `:id` trong URL có đúng định dạng UUID v4 không.
 * Nếu sai → trả về 400 Bad Request ngay lập tức, không cho request đến DB.
 *
 * Cách dùng:
 *   router.get("/:id", validateUUID("id"), handler)
 *   router.delete("/:id", validateUUID("id"), handler)
 */
export const validateUUID = (paramName = "id") => {
  return async (c: Context, next: Next) => {
    const value = c.req.param(paramName);

    if (!value || !UUID_REGEX.test(value)) {
      throw AppError.badRequest(
        `Invalid ${paramName}: "${value}" is not a valid UUID.`,
      );
    }

    await next();
  };
};
