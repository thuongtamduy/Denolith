import type { Context, Next } from "@hono/core";
import { redisClient } from "../../core/redis.ts";
import { logger } from "../../core/logger.ts";

interface RateLimitInfo {
  count: number;
  resetTime: number;
}

// In-memory store cho rate limiting (sẽ tự động dọn dẹp khi restart)
// Trong tương lai nếu chạy multi-instance, có thể đổi sang Redis hoặc Deno KV
const store = new Map<string, RateLimitInfo>();

interface RateLimitOptions {
  windowMs: number; // Khoảng thời gian (millisecond)
  max: number; // Số request tối đa trong khoảng thời gian đó
  message?: string; // Tin nhắn báo lỗi
}

export const rateLimiter = (options: RateLimitOptions) => {
  return async (c: Context, next: Next) => {
    // Lấy IP của người dùng (ưu tiên proxy header)
    const ip = c.req.header("x-forwarded-for") ||
      c.req.header("cf-connecting-ip") || "unknown-ip";

    const now = Date.now();
    let count = 0;
    let resetTime = now + options.windowMs;

    // 1. Ưu tiên Redis nếu kết nối thành công
    if (redisClient) {
      try {
        const key = `ratelimit:${ip}`;
        count = await redisClient.incr(key);

        if (count === 1) {
          // Set expire tính bằng mili-giây
          await redisClient.pexpire(key, options.windowMs);
        }

        // Lấy TTL để set header cho chuẩn
        const ttl = await redisClient.pttl(key);
        if (ttl > 0) resetTime = now + ttl;
      } catch {
        logger.warn(
          `Redis rate limit error, falling back to memory for IP ${ip}`,
        );
        count = 0; // Đặt về 0 để kích hoạt memory fallback
      }
    }

    // 2. Memory Fallback: Dùng nếu Redis tắt hoặc vừa gặp lỗi
    if (!redisClient || count === 0) {
      let info = store.get(ip);
      if (!info || now > info.resetTime) {
        info = { count: 0, resetTime: now + options.windowMs };
      }
      info.count++;
      store.set(ip, info);

      count = info.count;
      resetTime = info.resetTime;
    }

    // 3. Đính kèm thông tin Rate Limit vào Response Header
    c.header("X-RateLimit-Limit", options.max.toString());
    c.header(
      "X-RateLimit-Remaining",
      Math.max(0, options.max - count).toString(),
    );
    c.header("X-RateLimit-Reset", new Date(resetTime).toUTCString());

    // 4. Chặn nếu vượt quá giới hạn
    if (count > options.max) {
      return c.json(
        {
          success: false,
          error: options.message || "Quá nhiều yêu cầu, vui lòng thử lại sau.",
        },
        429, // HTTP Status: Too Many Requests
      );
    }

    await next();
  };
};
