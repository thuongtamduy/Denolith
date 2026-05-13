import type { Context } from "@hono/core";
import type { ContentfulStatusCode } from "@hono/http-status";
import type { ApiResponse, PaginationMeta } from "../types/index.ts";

/**
 * Gửi response thành công có data (kèm meta/pagination tùy chọn).
 */
export const sendSuccess = <T>(
  c: Context,
  data: T,
  meta?: Record<string, unknown> & { pagination?: PaginationMeta },
  status: ContentfulStatusCode = 200,
) => {
  const requestId = c.get("requestId") as string | undefined;

  return c.json<ApiResponse<T>>(
    {
      success: true,
      data,
      meta: {
        ...meta,
        requestId: requestId ?? meta?.requestId,
      },
    },
    status,
  );
};

/**
 * Gửi response thông báo (không có data), như "Logout success".
 */
export const sendMessage = (
  c: Context,
  message: string,
  status: ContentfulStatusCode = 200,
) => {
  const requestId = c.get("requestId") as string | undefined;

  return c.json<ApiResponse>(
    {
      success: true,
      message,
      meta: { requestId },
    },
    status,
  );
};
