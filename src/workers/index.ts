import { Queue } from "../core/queue.ts";
import { logger } from "../core/logger.ts";
import { container } from "../core/container.ts";
import type { AuditEntry } from "../core/audit.ts";

import { EmailTemplates, sendEmail } from "../core/email.ts";

export const initWorkers = () => {
  // Worker: Gửi Email chào mừng
  Queue.registerWorker(
    "send_welcome_email",
    async (payload: unknown) => {
      const data = payload as { email: string; username: string };
      const emailContent = EmailTemplates.welcome(data.username);
      await sendEmail({
        to: data.email,
        ...emailContent,
      });
    },
  );

  // Worker: Ghi Audit Log vào Database
  Queue.registerWorker("audit_log", async (payload: unknown) => {
    const entry = payload as AuditEntry;
    try {
      await container.db.queryObject(
        `INSERT INTO audit_logs (actor_id, action, target_type, target_id, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          entry.actorId ?? null,
          entry.action,
          entry.targetType ?? null,
          entry.targetId ?? null,
          JSON.stringify(entry.metadata ?? {}),
        ],
      );
    } catch (err) {
      logger.error("❌ [Worker] Lỗi ghi Audit Log", err);
    }
  });
};
