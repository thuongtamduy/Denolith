import type { Context } from "@hono/core";
import type { ContentfulStatusCode } from "@hono/http-status";
import { AppError } from "./AppError.ts";
import { logger } from "../../core/logger.ts";

/**
 * Global Hono error handler.
 */
export const globalErrorHandler = (err: Error, c: Context) => {
  if (err instanceof AppError) {
    logger.warn(`[${err.code}] ${err.message}`);
    return c.json(
      {
        success: false as const,
        error: { code: err.code, message: err.message },
      },
      err.statusCode as ContentfulStatusCode,
    );
  }

  logger.error(`[UNHANDLED] ${err.message}`, err.stack);
  return c.json(
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
