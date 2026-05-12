import { Hono } from "@hono/core";
import { swaggerUI } from "@hono/swagger-ui";
import { openAPIRouteHandler } from "hono-openapi";

// Core & Middlewares
import { cors } from "@hono/cors";
import { secureHeaders } from "@hono/secure-headers";
import { globalErrorHandler } from "./src/shared/errors/error.handler.ts";
import { rateLimiter } from "./src/shared/middlewares/rate-limit.middleware.ts";
import { logger } from "./src/core/logger.ts";
import { config } from "./src/core/config.ts";
import { closeDb, prisma } from "./src/core/database.ts";
import { closeRedis, initRedis, redisClient } from "./src/core/redis.ts";
import { initWorkers } from "./src/workers/index.ts";
import { Queue } from "./src/core/queue.ts";
import { initCrons } from "./src/core/cron.ts";

// Router trung tâm
import { createApiRouter, createNormalRouter } from "./src/app.router.ts";

// 2.5 Kết nối Redis (phải trước khi khởi động Workers/Queue)
await initRedis();

// 2.6 Khởi động Background Workers
initWorkers();
setTimeout(() => Queue.startWorkerLoop(), 0);

// 2.6 Khởi động Cronjobs
const { stopCrons } = initCrons();

// 3. Cấu hình Hono App
const app = new Hono();
app.onError(globalErrorHandler);

// Áp dụng Security & CORS Global
app.use("*", secureHeaders());
app.use(
  "*",
  cors({
    origin: config.frontendUrl,
    credentials: true,
  }),
);

// Áp dụng Rate Limit Global: Tối đa 100 requests / 1 phút
app.use("*", rateLimiter({ windowMs: 60 * 1000, max: 100 }));

// Advanced Health Check (Chủ động Ping DB & Redis)
app.get("/health", async (c) => {
  try {
    await prisma.$queryRaw`SELECT 1`; // Ping Database

    if (redisClient) {
      await redisClient.ping(); // Ping Redis
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

// Đăng ký toàn bộ các Route thông qua Router trung tâm
app.route("/api", createApiRouter());
app.route("/api/v0", createNormalRouter());

// Thêm Swagger UI ở root
app.get(
  "/api/swagger",
  // deno-lint-ignore no-explicit-any
  swaggerUI({ url: "/api/swagger/openapi.json" }) as any,
);
app.get(
  "/api/swagger/openapi.json",
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
        },
      },
      security: [{ BearerAuth: [] }],
    },
    // deno-lint-ignore no-explicit-any
  }) as any,
);

// 4. Khởi động Server
logger.info(
  `🚀 Denolith is running on http://localhost:${config.port} (${config.env} mode)`,
);

const abortController = new AbortController();

let isShuttingDown = false;
const shutdown = async () => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info("Shutting down gracefully...");

  // Bắt buộc thoát sau 3 giây nếu các connection bị treo (đảm bảo không bị đơ Terminal)
  const fallbackTimer = setTimeout(() => {
    logger.error("Force quitting after 3s due to hanging connections...");
    Deno.exit(1);
  }, 3000);
  Deno.unrefTimer(fallbackTimer);

  stopCrons(); // Dừng toàn bộ cronjob
  abortController.abort(); // Dừng HTTP server
  await Queue.shutdown();
  await closeRedis();
  await closeDb();

  // Chỉ gọi Deno.exit() trong production — ở dev mode, để Deno --watch tự restart
  if (config.env === "production") {
    Deno.exit(0);
  }
};

Deno.addSignalListener("SIGINT", shutdown);

// Tín hiệu SIGTERM được Docker sử dụng, nhưng không hoạt động trên Windows gốc
if (Deno.build.os !== "windows") {
  Deno.addSignalListener("SIGTERM", shutdown);
}

Deno.serve({ port: config.port, signal: abortController.signal }, app.fetch);
