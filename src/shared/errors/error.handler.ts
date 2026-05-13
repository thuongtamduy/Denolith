import type { Context } from "@hono/core";
import type { ContentfulStatusCode } from "@hono/http-status";
import { AppError } from "./AppError.ts";
import { logger } from "../../core/logger.ts";
import type { ApiErrorResponse } from "../types/index.ts";

/**
 * Global Hono error handler.
 */
export const globalErrorHandler = (err: Error, c: Context) => {
  const requestId = c.get("requestId") as string | undefined;

  if (err instanceof AppError) {
    logger.warn(`[${requestId || "SYS"}] [${err.code}] ${err.message}`);
    return c.json<ApiErrorResponse>(
      {
        success: false as const,
        error: { code: err.code, message: err.message },
        meta: { requestId },
      },
      err.statusCode as ContentfulStatusCode,
    );
  }

  logger.error(`[${requestId || "SYS"}] [UNHANDLED] ${err.message}`, err.stack);
  return c.json<ApiErrorResponse>(
    {
      success: false as const,
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
      },
      meta: { requestId },
    },
    500,
  );
};
