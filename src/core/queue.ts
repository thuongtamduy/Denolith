import { redisClient, redisQueueClient } from "./redis.ts";
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
  isShuttingDown: false,
  activeJobs: new Set<Promise<any>>(),

  async shutdown() {
    logger.info("🛑 Shutting down Worker Queue...");
    Queue.isShuttingDown = true;

    if (Queue.activeJobs.size > 0) {
      logger.info(
        `⏳ Waiting for ${Queue.activeJobs.size} active background job(s) to finish (max 5s)...`,
      );

      const timeoutPromise = new Promise((resolve) =>
        setTimeout(resolve, 5000)
      );
      const jobsPromise = Promise.allSettled(Array.from(Queue.activeJobs));

      const winner = await Promise.race([jobsPromise, timeoutPromise]);
      if (!winner) {
        logger.warn(
          "⚠️ Shutdown timeout reached! Forcing exit with dangling jobs.",
        );
      } else {
        logger.info("✅ All active jobs finished cleanly.");
      }
    }

    if (memoryQueue.length > 0) {
      logger.info(
        `📦 Processing ${memoryQueue.length} remaining job(s) in memory queue before exit...`,
      );
    }
    await Queue.processMemoryQueue();
  },
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
          const jobPromise = handler(job.payload);
          Queue.activeJobs.add(jobPromise);
          try {
            await jobPromise;
          } catch (e) {
            logger.error(`❌ Memory Job [${job.type}] failed`, e);
          } finally {
            Queue.activeJobs.delete(jobPromise);
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

    while (!Queue.isShuttingDown) {
      if (!redisQueueClient) {
        // Nếu không có Redis, ngủ 5s để tiết kiệm CPU
        await new Promise((res) => setTimeout(res, 5000));
        continue;
      }

      try {
        // BRPOP (Blocking Pop) - tự động chặn luồng 5s chờ job, phản hồi 0ms, không tốn CPU
        // DÙNG CONNECTION RIÊNG ĐỂ KHÔNG BLOCK CÁC LỆNH KHÁC
        const result = await redisQueueClient.brpop(5, queueName);
        if (result && result.length === 2) {
          const job: JobData = JSON.parse(result[1]);
          const handler = handlers.get(job.type);
          if (handler) {
            const jobPromise = handler(job.payload);
            Queue.activeJobs.add(jobPromise);
            try {
              await jobPromise;
            } catch (e) {
              logger.error(`❌ Job [${job.type}] failed`, e);
            } finally {
              Queue.activeJobs.delete(jobPromise);
            }
          }
        }
      } catch {
        if (Queue.isShuttingDown) break;
        // Bất ngờ đứt mạng Redis -> Ngủ 5s
        await new Promise((res) => setTimeout(res, 5000));
      }
    }
  },
};
