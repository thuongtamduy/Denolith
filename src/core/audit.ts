import { Queue } from "./queue.ts";

export interface AuditEntry {
  actorId?: string; // ID của user thực hiện (undefined = system/anonymous)
  action: string; // Loại hành động
  targetType?: string; // Loại đối tượng: "user", "post"...
  targetId?: string; // ID của đối tượng bị tác động
  status?: "success" | "failure"; // Kết quả hành động (default: success)
  ipAddress?: string; // IP client thực hiện
  userAgent?: string; // User-Agent header
  duration?: number; // Thời gian xử lý (ms)
  metadata?: Record<string, unknown>; // Thông tin bổ sung
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
