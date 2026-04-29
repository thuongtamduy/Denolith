import type { Client } from "@db/postgres";
import { redisClient } from "../../core/redis.ts";

export class AuthRepository {
  constructor(private db: Client) {}

  async saveRefreshToken(
    userId: string,
    token: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.db.queryObject(
      "INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)",
      [userId, token, expiresAt.toISOString()],
    );
  }

  // Đã bị loại bỏ để chống Race Condition (TOCTOU). Sử dụng consumeRefreshToken thay thế.
  // Không bao giờ được dùng thao tác Read rồi Delete tách biệt trong môi trường async.

  async deleteRefreshToken(token: string): Promise<void> {
    await this.db.queryObject("DELETE FROM refresh_tokens WHERE token = $1", [
      token,
    ]);
  }

  /**
   * Chống Race Condition (Token Multiplication):
   * Thực hiện XÓA và TRẢ VỀ dữ liệu trong một transaction Atomic duy nhất ở cấp độ CSDL.
   * Kẻ tấn công spam 100 request đồng thời cũng chỉ có 1 request lấy được token.
   */
  async consumeRefreshToken(token: string) {
    const res = await this.db.queryObject<
      { user_id: string; expires_at: Date }
    >(
      "DELETE FROM refresh_tokens WHERE token = $1 RETURNING user_id, expires_at",
      [token],
    );
    return res.rows[0];
  }

  /**
   * Blacklist một Access Token (JWT) khi user logout.
   * Redis key sẽ tự xóa sau khi token hết hạn (TTL = thời gian còn lại).
   * Nếu không có Redis, bỏ qua (fallback graceful — token vẫn hết hạn tự nhiên sau 15 phút).
   *
   * @param token - Raw JWT string
   * @param exp   - Unix timestamp hết hạn của token (lấy từ payload.exp)
   */
  async blacklistAccessToken(token: string, exp: number): Promise<void> {
    if (!redisClient) return; // Fallback graceful khi không có Redis

    const ttlSeconds = exp - Math.floor(Date.now() / 1000);
    if (ttlSeconds <= 0) return; // Token đã hết hạn, không cần blacklist

    const key = `blacklist:${token}`;
    await redisClient.setex(key, ttlSeconds, "1");
  }

  /**
   * Kiểm tra một Access Token có trong danh sách blacklist không.
   */
  async isAccessTokenBlacklisted(token: string): Promise<boolean> {
    if (!redisClient) return false; // Không có Redis → không kiểm tra được
    const value = await redisClient.get(`blacklist:${token}`);
    return value !== null;
  }
}
