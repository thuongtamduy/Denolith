import type { Context } from "@hono/core";
import type { ContentfulStatusCode } from "@hono/http-status";
import { AppError } from "./AppError.ts";
import { logger } from "../../core/logger.ts";
import type { ApiErrorResponse } from "../types/index.ts";

/**
 * Global Hono error handler.
 */
export const globalErrorHandler = (err: Error, c: Context) => {
  const requestId = c.get("requestId") || "unknown-request-id";
  const method = c.req.method;
  const path = c.req.path;

  if (err instanceof AppError) {
    logger.warn(`[${requestId}] [${method} ${path}] [${err.code}] ${err.message}`);
    return c.json<ApiErrorResponse>(
      {
        success: false as const,
        error: { code: err.code, message: err.message },
      },
      err.statusCode as ContentfulStatusCode,
    );
  }

  logger.error(
    `[${requestId}] [${method} ${path}] [UNHANDLED] ${err.message}`,
    err.stack,
  );
  return c.json<ApiErrorResponse>(
    {
      success: false as const,
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
      },
    },
    500,
  );
};
