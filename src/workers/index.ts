import { Queue } from "../core/queue.ts";
import { logger } from "../core/logger.ts";
import { container } from "../core/container.ts";

import { EmailTemplates, sendEmail } from "../core/email.ts";

export const initWorkers = () => {
  // Worker: Gửi Email chào mừng
  Queue.registerWorker(
    "send_welcome_email",
    async (payload: unknown) => {
      // Runtime guard: kiểm tra payload hợp lệ trước khi dùng
      const data = payload as { email?: string; username?: string };
      if (!data?.email || !data?.username) {
        logger.error("❌ [Worker] Invalid send_welcome_email payload", payload);
        return;
      }
      const emailContent = EmailTemplates.welcome(data.username);
      await sendEmail({
        to: data.email,
        ...emailContent,
      });
    },
  );

  // Worker: Ghi Audit Log vào Database
  Queue.registerWorker("audit_log", async (payload: unknown) => {
    // Runtime guard: kiểm tra payload hợp lệ trước khi dùng
    const entry = payload as { action?: string } & Record<string, unknown>;
    if (!entry?.action) {
      logger.error("❌ [Worker] Invalid audit_log payload", payload);
      return;
    }
    try {
      await container.db.queryObject(
        `INSERT INTO audit_logs (actor_id, action, target_type, target_id, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          (entry as { actorId?: string }).actorId ?? null,
          entry.action,
          (entry as { targetType?: string }).targetType ?? null,
          (entry as { targetId?: string }).targetId ?? null,
          JSON.stringify((entry as { metadata?: unknown }).metadata ?? {}),
        ],
      );
    } catch (err) {
      logger.error("❌ [Worker] Failed to write audit log", err);
    }
  });
};
