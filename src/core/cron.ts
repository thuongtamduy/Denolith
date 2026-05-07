import { logger } from "./logger.ts";
import { container } from "./container.ts";

/**
 * Helper: Hẹn giờ chạy mỗi ngày vào khung giờ cố định
 * Trả về hàm stop() để có thể hủy khi tắt app (Hot reload an toàn)
 */
export function scheduleDailyTask(
  hour: number,
  minute: number,
  task: () => void,
): { stop: () => void } {
  const now = new Date();
  const nextRun = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    hour,
    minute,
    0,
    0,
  );

  // Nếu thời điểm đó của ngày hôm nay đã qua, thì chuyển sang ngày mai
  if (nextRun.getTime() <= now.getTime()) {
    nextRun.setDate(nextRun.getDate() + 1);
  }

  const msUntilNextRun = nextRun.getTime() - now.getTime();

  let intervalId: number | undefined;

  const timeoutId = setTimeout(() => {
    task();
    // Lặp lại chính xác sau mỗi 24 tiếng
    intervalId = setInterval(task, 24 * 60 * 60 * 1000);
  }, msUntilNextRun);

  return {
    stop: () => {
      clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    },
  };
}

/**
 * Khởi tạo toàn bộ Cronjobs cho hệ thống.
 * Trả về hàm stopCrons() để gọi khi graceful shutdown.
 */
export function initCrons() {
  logger.info("⏰ Initializing background cronjobs...");

  // 1. Dọn rác Refresh Token (Mỗi 6 tiếng)
  const cleanupTokensInterval = setInterval(async () => {
    try {
      const res = await container.db.queryObject<{ count: bigint }>(
        "WITH deleted AS (DELETE FROM refresh_tokens WHERE expires_at < NOW() RETURNING *) SELECT COUNT(*) FROM deleted",
      );
      const deletedCount = Number(res.rows[0].count);
      if (deletedCount > 0) {
        logger.info(
          `🧹 [Cronjob] Cleaned up ${deletedCount} expired refresh token(s).`,
        );
      }
    } catch (err) {
      logger.error("❌ [Cronjob] Failed to clean up expired tokens", err);
    }
  }, 6 * 60 * 60 * 1000);

  // 2. Dùng scheduleDailyTask để cài đặt Cronjob
  const dailyScanTask = scheduleDailyTask(3, 0, () => {
    logger.info(`🧹 [Cronjob] Daily scan running at 3:00 AM...`);
    // Ở đây có thể Query bảng emails, push vào Queue, v.v...
  });

  // Trả về hàm dọn dẹp
  return {
    stopCrons: () => {
      logger.info("🛑 Shutting down Cronjobs...");
      clearInterval(cleanupTokensInterval);
      dailyScanTask.stop();
    },
  };
}
