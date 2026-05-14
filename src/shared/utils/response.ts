import type { Context } from "@hono/core";
import type { PaginationMeta } from "./pagination.ts";
import type { StatusCode } from "@hono/http-status";

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  meta?: PaginationMeta;
  errors?: unknown;
}

/**
 * Standardize API Response outputs to Frontend
 */
export const ApiResponse = {
  /**
   * Trả về kết quả thành công kèm dữ liệu (200 OK)
   */
  success<T>(c: Context, data: T, message?: string, status: StatusCode = 200) {
    return c.json(
      {
        success: true,
        message,
        data,
      } satisfies ApiResponse<T>,
      status as any,
    );
  },

  /**
   * Trả về kết quả khởi tạo thành công (201 Created)
   */
  created<T>(c: Context, data: T, message = "Resource created successfully") {
    return c.json(
      {
        success: true,
        message,
        data,
      } satisfies ApiResponse<T>,
      201,
    );
  },

  /**
   * Trả về danh sách phân trang (200 OK)
   */
  paginated<T>(
    c: Context,
    data: T[],
    meta: PaginationMeta,
    message?: string,
  ) {
    return c.json(
      {
        success: true,
        message,
        data,
        meta,
      } satisfies ApiResponse<T[]>,
      200,
    );
  },

  /**
   * Trả về thành công nhưng không có nội dung (204 No Content)
   * Phù hợp cho Hard Delete.
   */
  noContent(_c: Context) {
    return new Response(null, { status: 204 });
  },

  /**
   * Trả về lỗi chung chung có kiểm soát (400, 401, 403, 404, 500)
   */
  error(
    c: Context,
    message: string,
    status: StatusCode = 400,
    errors?: unknown,
  ) {
    return c.json(
      {
        success: false,
        message,
        errors,
      } satisfies ApiResponse<null>,
      status as any,
    );
  },
};
