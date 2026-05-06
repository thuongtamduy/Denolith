import { Hono } from "@hono/core";

// Khởi tạo Dependency Injection Container
import { container } from "./src/core/container.ts";

// Core & Middlewares
import { cors } from "@hono/cors";
import { secureHeaders } from "@hono/secure-headers";
import { globalErrorHandler } from "./src/shared/errors/error.handler.ts";
import { authMiddleware } from "./src/shared/middlewares/auth.middleware.ts";
import { rateLimiter } from "./src/shared/middlewares/rate-limit.middleware.ts";
import { Migrator } from "./src/core/migrator.ts";
import { allMigrations } from "./src/migrations/index.ts";
import { logger } from "./src/core/logger.ts";
import { config } from "./src/core/config.ts";
import { closeDb } from "./src/core/database.ts";
import { closeRedis, redisClient } from "./src/core/redis.ts";
import { initWorkers } from "./src/workers/index.ts";
import { Queue } from "./src/core/queue.ts";

// Routes
import { createUserRoutes } from "./src/modules/user/user.routes.ts";
import { createAuthRoutes } from "./src/modules/auth/auth.routes.ts";

// 1. Boot Container
await container.init();

// 2. Tự động kiểm tra Migration khi khởi động
const migrator = new Migrator(container.db);
const migrationResult = await migrator.migrate(allMigrations);
if (migrationResult.applied.length > 0) {
  logger.info(
    `Applied ${migrationResult.applied.length} migration(s) on startup.`,
  );
} else {
  logger.debug("Database schema is up to date.");
}

// 2.5 Khởi động Background Workers
initWorkers();
setTimeout(() => Queue.startWorkerLoop(), 0);

// 2.6 Cronjob dọn rác Database (Refresh Token) mỗi 6 tiếng
setInterval(async () => {
  try {
    const res = await container.db.queryObject<{ count: bigint }>(
      "WITH deleted AS (DELETE FROM refresh_tokens WHERE expires_at < NOW() RETURNING *) SELECT COUNT(*) FROM deleted",
    );
    const deletedCount = Number(res.rows[0].count);
    if (deletedCount > 0) {
      logger.info(
        `🧹 [Cronjob] Đã dọn dẹp ${deletedCount} refresh token hết hạn.`,
      );
    }
  } catch (err) {
    logger.error("❌ [Cronjob] Lỗi dọn dẹp DB", err);
  }
}, 6 * 60 * 60 * 1000);

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
    await container.db.queryObject("SELECT 1"); // Ping Database

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

// Bảo vệ toàn bộ route profiles bằng JWT — PHẢI đăng ký TRƯỚC khi mount routes
app.use("/api/profiles/*", authMiddleware);

// Đăng ký các Route (Sử dụng Service từ Container)
app.route("/api/auth", createAuthRoutes(container.authService));
app.route("/api/users", createUserRoutes(container.userService));

// 4. Khởi động Server
logger.info(
  `🚀 Denolith is running on http://localhost:${config.port} (${config.env} mode)`,
);

const shutdown = async () => {
  logger.info("Shutting down gracefully...");
  await Queue.shutdown();
  await closeRedis();
  await closeDb();
  Deno.exit(0);
};

Deno.addSignalListener("SIGINT", shutdown);

// Tín hiệu SIGTERM được Docker sử dụng, nhưng không hoạt động trên Windows gốc
if (Deno.build.os !== "windows") {
  Deno.addSignalListener("SIGTERM", shutdown);
}

Deno.serve({ port: config.port }, app.fetch);
