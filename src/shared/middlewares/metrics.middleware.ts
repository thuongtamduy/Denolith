import type { MiddlewareHandler } from "@hono/core";
import type { AppEnv } from "../../core/context.ts";
import {
  recordHttpErrorMetric,
  recordHttpRequestMetric,
} from "../../core/metrics.ts";

function normalizeRoute(path: string): string {
  // Reduce cardinality for UUID-like and numeric segments.
  return path
    .replaceAll(
      /\/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}(?=\/|$)/g,
      "/:id",
    )
    .replaceAll(/\/\d+(?=\/|$)/g, "/:num");
}

export const metricsMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const startedAt = performance.now();
  await next();
  const durationMs = performance.now() - startedAt;

  const route = normalizeRoute(c.req.path);
  const labels = {
    method: c.req.method,
    route,
    status: String(c.res.status),
  };

  recordHttpRequestMetric(labels, durationMs);

  if (c.res.status >= 400) {
    recordHttpErrorMetric({
      ...labels,
      error_class: c.res.status >= 500 ? "5xx" : "4xx",
    });
  }
};
