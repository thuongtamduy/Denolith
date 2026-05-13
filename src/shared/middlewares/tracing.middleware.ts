import type { Context, Next } from "@hono/core";
import { logger } from "../../core/logger.ts";

export const tracingMiddleware = async (c: Context, next: Next) => {
  // Sinh hoặc lấy Request ID từ Header
  const requestId = c.req.header("X-Request-Id") || crypto.randomUUID();
  c.set("requestId", requestId);
  c.res.headers.set("X-Request-Id", requestId);

  const start = performance.now();
  const method = c.req.method;
  const url = c.req.url;

  // Log khi request bắt đầu
  logger.info(`[${requestId}] ➡️ ${method} ${url}`);

  await next();

  // Log khi request kết thúc
  const end = performance.now();
  const duration = (end - start).toFixed(2);
  const status = c.res.status;

  if (status >= 500) {
    logger.error(
      `[${requestId}] ❌ ${method} ${url} - ${status} (${duration}ms)`,
    );
  } else if (status >= 400) {
    logger.warn(
      `[${requestId}] ⚠️ ${method} ${url} - ${status} (${duration}ms)`,
    );
  } else {
    logger.info(
      `[${requestId}] ✅ ${method} ${url} - ${status} (${duration}ms)`,
    );
  }
};
