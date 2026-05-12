import { describeRoute as openapiDescribeRoute } from "hono-openapi";
import type { MiddlewareHandler } from "@hono/core";

/**
 * Safe wrapper around describeRoute from hono-openapi to bypass TypeScript conflicts
 * between npm:hono and jsr:@hono/hono.
 */
export const describeRoute = (
  options: Parameters<typeof openapiDescribeRoute>[0],
): MiddlewareHandler => {
  // deno-lint-ignore no-explicit-any
  return openapiDescribeRoute(options) as any;
};
