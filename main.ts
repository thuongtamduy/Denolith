import { logger } from "./src/core/logger.ts";
import { config } from "./src/core/config.ts";
import { closeDb } from "./src/core/database.ts";
import { closeRedis, initRedis } from "./src/core/redis.ts";
import { initWorkers } from "./src/workers/index.ts";
import { Queue } from "./src/core/queue.ts";
import { initCrons } from "./src/core/cron.ts";
import { createApp } from "./src/app.ts";

// 2.5 Kết nối Redis (phải trước khi khởi động Workers/Queue)
await initRedis();

// 2.6 Khởi động Background Workers
initWorkers();
setTimeout(() => Queue.startWorkerLoop(), 0);

// 2.6 Khởi động Cronjobs
const { stopCrons } = initCrons();

// 3. Cấu hình Hono App
const app = createApp();

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

  // Bắt buộc thoát sau 3 giây nếu các connection bị treo — chỉ trong production
  // Ở dev mode KHÔNG gọi Deno.exit() để Deno --watch có thể hot-reload
  if (config.env === "production") {
    const fallbackTimer = setTimeout(() => {
      logger.error("Force quitting after 3s due to hanging connections...");
      Deno.exit(1);
    }, 3000);
    Deno.unrefTimer(fallbackTimer);
  }

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
