import type { Context, Next } from "@hono/core";
import { Queue } from "../../core/queue.ts";
import { logger } from "../../core/logger.ts";

export const auditMiddleware = async (c: Context, next: Next) => {
  await next(); // Cho phép request xử lý xong trước

  // Chỉ ghi log các hành động thay đổi dữ liệu và phải thành công
  const method = c.req.method;
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) return;
  if (c.res.status >= 400) return;

  try {
    // Lấy thông tin người thực hiện
    const jwtPayload = c.get("jwtPayload") as
      | Record<string, unknown>
      | undefined;
    const actorId = (jwtPayload?.id as string) || null;

    // Phân tích URL để lấy đối tượng bị tác động (Target)
    // VD: /api/v1/users/uuid-1234 -> targetType = "users", targetId = "uuid-1234"
    const url = new URL(c.req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);

    // Nếu URL format chuẩn là /api/v1/<resource>/<id>
    const targetType = pathParts[2] || "system";
    const targetId = pathParts[3] || null;
    const action = `${method} /${targetType}`;

    // Lấy IP và Meta
    const ip = c.req.header("x-forwarded-for") || "unknown";
    const requestId = c.get("requestId") || "unknown";
    const userAgent = c.req.header("user-agent") || "unknown";

    // Đẩy tác vụ vào Redis Queue một cách không đồng bộ (bỏ qua await)
    Queue.enqueue("audit_log", {
      actorId,
      action,
      targetType,
      targetId,
      metadata: {
        ip,
        requestId,
        userAgent,
      },
    }).catch((err) => {
      logger.error("❌ Failed to enqueue audit log:", err);
    });
  } catch (err) {
    // Không bao giờ để lỗi Audit làm chết API chính
    logger.error("❌ Audit Middleware error:", err);
  }
};
