import { verify } from "@hono/jwt";
import type { Context, Next } from "@hono/core";
import { config } from "../../core/config.ts";
import { redisClient } from "../../core/redis.ts";
import { AppError } from "../errors/AppError.ts";

/**
 * Auth Middleware với Blacklist Check.
 *
 * Luồng xử lý:
 * 1. Đọc Bearer token từ Authorization header
 * 2. Verify JWT (signature + expiry)
 * 3. Kiểm tra token có trong Redis blacklist không (user đã logout)
 * 4. Gán payload vào context để các handler phía sau dùng
 */
export const authMiddleware = async (c: Context, next: Next) => {
  // Bước 1: Đọc token
  const authHeader = c.req.header("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    throw AppError.unauthorized("Missing or invalid Authorization header.");
  }
  const token = authHeader.slice(7);

  // Bước 2: Verify chữ ký & thời hạn JWT
  let payload: Record<string, unknown>;
  try {
    payload = await verify(token, config.jwtSecret, "HS256") as Record<
      string,
      unknown
    >;
  } catch {
    throw AppError.unauthorized("Invalid or expired token.");
  }

  // Bước 3: Kiểm tra Redis Blacklist (token đã logout chưa?)
  if (redisClient) {
    try {
      const isBlacklisted = await redisClient.get(`blacklist:${token}`);
      if (isBlacklisted) {
        throw AppError.unauthorized(
          "Token has been revoked. Please log in again.",
        );
      }
    } catch {
      // Redis lỗi → không chặn request, token tự hết hạn tự nhiên sau 15 phút
    }
  }

  // Bước 3.5: Truy vấn Database để đảm bảo User vẫn tồn tại và chưa bị khóa/xóa
  // Đây là lớp bảo vệ (Defense-in-depth) tối quan trọng cho hệ thống Enterprise.
  try {
    const { container } = await import("../../core/container.ts");
    const userId = payload.id as string;

    // Dùng query trực tiếp để tối ưu tốc độ và tránh circular dependency
    const res = await container.db.queryObject<{ role: string }>(
      "SELECT role FROM users WHERE id = $1 AND deleted = false",
      [userId],
    );

    if (res.rows.length === 0) {
      throw AppError.unauthorized(
        "User account no longer exists or has been disabled.",
      );
    }

    // Ghi đè role từ Database vào payload để đảm bảo luôn sử dụng quyền mới nhất
    payload.role = res.rows[0].role;
  } catch (err) {
    // Re-throw AppError để giữ nguyên status code (vd: 401 Unauthorized)
    // Chỉ wrap lỗi thực sự unknown (DB crash, network error...) thành 500
    if (err instanceof AppError) throw err;
    throw AppError.internal("Error verifying user identity.");
  }

  // Bước 4: Gán payload vào context để RBAC middleware và handler dùng
  c.set("jwtPayload", payload);

  await next();
};
