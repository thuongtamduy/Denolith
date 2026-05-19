import type { MiddlewareHandler } from "@hono/core";
import type { AppEnv } from "../../core/context.ts";

const REQUEST_ID_HEADER = "x-request-id";

export const requestIdMiddleware: MiddlewareHandler<AppEnv> = async (
  c,
  next,
) => {
  const incomingRequestId = c.req.header(REQUEST_ID_HEADER);
  const requestId = incomingRequestId || crypto.randomUUID();

  c.set("requestId", requestId);
  c.header("X-Request-Id", requestId);

  await next();
};
