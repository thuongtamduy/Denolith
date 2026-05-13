import { vValidator } from "@hono/valibot-validator";
import { AppError } from "../errors/AppError.ts";
import type { GenericSchema, GenericSchemaAsync } from "valibot";

/**
 * Wrapper cho vValidator của Hono để đồng nhất lỗi trả về theo chuẩn AppError.
 * Tránh việc Valibot ném ra toàn bộ issues rác làm Frontend bối rối.
 */
export const validateJson = <T extends GenericSchema | GenericSchemaAsync>(
  schema: T,
) => {
  return vValidator("json", schema, (result, _c) => {
    if (!result.success) {
      // Lấy câu thông báo lỗi đầu tiên (ví dụ: "Số điện thoại phải dài 10-11 ký tự...")
      const firstIssue = result.issues[0];
      const message = firstIssue?.message || "Invalid input data";

      // Ném lỗi Validation kèm danh sách chi tiết các field bị lỗi
      const details = result.issues.map((issue) => ({
        field: issue.path?.map((p) => p.key).join(".") || "unknown",
        message: issue.message,
      }));

      throw AppError.validationError(message, details);
    }
  });
};
