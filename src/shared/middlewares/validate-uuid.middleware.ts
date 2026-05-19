import type { Context, Next } from "@hono/core";
import { AppError } from "../errors/AppError.ts";
import { isUuid } from "../utils/uuid.ts";

/**
 * Middleware kiểm tra tham số `:id` trong URL có đúng định dạng UUID không.
 * Nếu sai → trả về 400 Bad Request ngay lập tức, không cho request đến DB.
 *
 * Cách dùng:
 *   router.get("/:id", validateUUID("id"), handler)
 *   router.delete("/:id", validateUUID("id"), handler)
 */
export const validateUUID = (paramName = "id") => {
  return async (c: Context, next: Next) => {
    const value = c.req.param(paramName);

    if (!isUuid(value)) {
      throw AppError.badRequest(
        `Invalid ${paramName}: "${value}" is not a valid UUID.`,
      );
    }

    await next();
  };
};
