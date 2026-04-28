import { Queue } from "../core/queue.ts";
import { logger } from "../core/logger.ts";

export const initWorkers = () => {
  Queue.registerWorker(
    "send_welcome_email",
    async (payload: { email: string; username: string }) => {
      logger.info(
        `⏳ [Worker] Bắt đầu xử lý Job: Gửi Email Welcome tới ${payload.email}...`,
      );

      // Giả lập một tác vụ siêu nặng mất 3 giây (Resize ảnh, Call API ngoài, Gửi Mail...)
      await new Promise((resolve) => setTimeout(resolve, 3000));

      logger.info(`✅ [Worker] Đã hoàn tất gửi Email cho ${payload.username}!`);
    },
  );
};
