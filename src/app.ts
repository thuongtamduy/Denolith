import { Hono } from "@hono/core";
import { swaggerUI } from "@hono/swagger-ui";
import { openAPIRouteHandler } from "hono-openapi";
import { cors } from "@hono/cors";
import { secureHeaders } from "@hono/secure-headers";
import { globalErrorHandler } from "./shared/errors/error.handler.ts";
import { rateLimiter } from "./shared/middlewares/rate-limit.middleware.ts";
import { requestIdMiddleware } from "./shared/middlewares/request-id.middleware.ts";
import { metricsMiddleware } from "./shared/middlewares/metrics.middleware.ts";
import { logger } from "./core/logger.ts";
import { config } from "./core/config.ts";
import { prisma } from "./core/database.ts";
import { redisClient } from "./core/redis.ts";
import { renderPrometheusMetrics } from "./core/metrics.ts";
import { createApiRouter, createNormalRouter } from "./app.router.ts";

export const createApp = () => {
  const app = new Hono();
  app.onError(globalErrorHandler);

  app.use("*", requestIdMiddleware);
  app.use("*", metricsMiddleware);
  app.use("*", secureHeaders());
  app.use(
    "*",
    cors({
      origin: config.frontendUrl,
      credentials: true,
    }),
  );

  app.use("*", rateLimiter({ windowMs: 60 * 1000, max: 100 }));

  app.get("/", async (c) => {
    try {
      await prisma.$queryRaw`SELECT 1`;

      if (redisClient) {
        await redisClient.ping();
      }

      return c.json({
        status: "ok",
        db: "connected",
        redis: redisClient ? "connected" : "memory_fallback",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Health check failed", error);
      return c.json({ status: "error", message: "Service unavailable" }, 503);
    }
  });

  app.get("/metrics", (c) => {
    c.header("Content-Type", "text/plain; version=0.0.4");
    return c.body(renderPrometheusMetrics());
  });

  const publicRouter = new Hono();
  publicRouter.route("/", createNormalRouter());
  app.route("/", publicRouter);

  const apiRouter = new Hono();
  apiRouter.route("/", createApiRouter());
  app.route("/v1", apiRouter);

  app.get(
    "/swagger",
    // deno-lint-ignore no-explicit-any
    swaggerUI({ url: "/swagger/openapi.json" }) as any,
  );
  app.get(
    "/swagger/openapi.json",
    // deno-lint-ignore no-explicit-any
    openAPIRouteHandler(app as any, {
      documentation: {
        info: {
          title: "Denolith API",
          version: "1.0.0",
          description: "API for Denolith",
        },
        components: {
          securitySchemes: {
            BearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
            ApiKeyAuth: {
              type: "apiKey",
              in: "header",
              name: "x-api-key",
              description: "Store ID",
            },
          },
        },
        security: [{ BearerAuth: [], ApiKeyAuth: [] }],
      },
      // deno-lint-ignore no-explicit-any
    }) as any,
  );

  return app;
};
