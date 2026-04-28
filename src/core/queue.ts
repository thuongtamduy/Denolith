import { redisClient } from "./redis.ts";
import { logger } from "./logger.ts";

export interface JobData {
  type: string;
  payload: any;
}

type JobHandler = (payload: any) => Promise<void>;
const handlers = new Map<string, JobHandler>();

// Hàng đợi dự phòng khi Redis bị tắt
const memoryQueue: JobData[] = [];
let isMemoryProcessing = false;

export const Queue = {
  // Đăng ký các chức năng xử lý ngầm
  registerWorker(type: string, handler: JobHandler) {
    handlers.set(type, handler);
  },

  // Đẩy tác vụ vào Queue (Chỉ mất 0.001s)
  async enqueue(type: string, payload: any) {
    const job: JobData = { type, payload };
    const queueName = "denolith:queue";

    if (redisClient) {
      try {
        await redisClient.lpush(queueName, JSON.stringify(job));
        return;
      } catch {
        logger.warn("⚠️ Redis Queue failed, pushing to Memory Queue");
      }
    }

    // Fallback: Xử lý bằng RAM
    memoryQueue.push(job);
    if (!isMemoryProcessing) {
      isMemoryProcessing = true;
      setTimeout(Queue.processMemoryQueue, 0);
    }
  },

  // Hàm xử lý Memory Queue
  async processMemoryQueue() {
    while (memoryQueue.length > 0) {
      const job = memoryQueue.shift();
      if (job) {
        const handler = handlers.get(job.type);
        if (handler) {
          try {
            await handler(job.payload);
          } catch (e) {
            logger.error(`❌ Memory Job [${job.type}] failed`, e);
          }
        }
      }
    }
    isMemoryProcessing = false;
  },

  // Con Worker chạy ngầm miệt mài 24/7 để hốt Job từ Redis
  async startWorkerLoop() {
    logger.info("👷 Background Worker ready. Listening for jobs...");
    const queueName = "denolith:queue";

    while (true) {
      if (!redisClient) {
        // Nếu không có Redis, ngủ 5s để tiết kiệm CPU
        await new Promise((res) => setTimeout(res, 5000));
        continue;
      }

      try {
        // RPOP lấy phần tử cuối cùng trong List của Redis
        const result = await redisClient.rpop(queueName);
        if (result) {
          const job: JobData = JSON.parse(result);
          const handler = handlers.get(job.type);
          if (handler) {
            try {
              await handler(job.payload);
            } catch (e) {
              logger.error(`❌ Job [${job.type}] failed`, e);
            }
          }
        } else {
          // Hàng đợi rỗng -> Ngủ 1 giây
          await new Promise((res) => setTimeout(res, 1000));
        }
      } catch {
        // Bất ngờ đứt mạng Redis -> Ngủ 5s
        await new Promise((res) => setTimeout(res, 5000));
      }
    }
  },
};
