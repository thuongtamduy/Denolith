import { Queue } from "./queue.ts";

export type AuditAction =
  | "auth.login"
  | "auth.login_failed"
  | "auth.logout"
  | "auth.register"
  | "user.soft_delete"
  | "user.restore"
  | "user.hard_delete";

export interface AuditEntry {
  actorId?: string;        // ID của user thực hiện (undefined = system/anonymous)
  action: AuditAction;     // Loại hành động
  targetType?: string;     // Loại đối tượng: "user", "post"...
  targetId?: string;       // ID của đối tượng bị tác động
  metadata?: Record<string, unknown>; // IP, user-agent, thông tin bổ sung
}

/**
 * Ghi Audit Log bất đồng bộ qua Queue.
 * KHÔNG làm chậm request — log được xử lý ngầm bởi Worker.
 *
 * Cách dùng:
 *   await AuditService.log({ actorId, action: "user.soft_delete", targetType: "user", targetId: id });
 */
export const AuditService = {
  async log(entry: AuditEntry): Promise<void> {
    // Đẩy vào Queue thay vì ghi DB trực tiếp — không block request
    await Queue.enqueue("audit_log", entry);
  },
};
