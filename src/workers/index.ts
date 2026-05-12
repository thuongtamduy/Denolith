import { Queue } from "../core/queue.ts";
import { logger } from "../core/logger.ts";
import { prisma } from "../core/database.ts";

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
      await prisma.auditLog.create({
        data: {
          actorId: (entry as { actorId?: string }).actorId ?? null,
          action: entry.action,
          targetType: (entry as { targetType?: string }).targetType ?? null,
          targetId: (entry as { targetId?: string }).targetId ?? null,
          metadata: (entry as { metadata?: unknown }).metadata ?? {},
        },
      });
    } catch (err) {
      logger.error("❌ [Worker] Failed to write audit log", err);
    }
  });
};
