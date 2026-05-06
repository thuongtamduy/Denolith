import type { Context, Next } from "@hono/core";
import { getConnInfo } from "@hono/hono/deno";
import { redisClient } from "../../core/redis.ts";
import { logger } from "../../core/logger.ts";
import { config } from "../../core/config.ts";

interface RateLimitInfo {
  count: number;
  resetTime: number;
}

// In-memory store cho rate limiting
const store = new Map<string, RateLimitInfo>();

// Dọn dẹp Memory Leak định kỳ mỗi 1 phút
setInterval(() => {
  const now = Date.now();
  for (const [ip, info] of store.entries()) {
    if (now > info.resetTime) {
      store.delete(ip);
    }
  }
}, 60000);

interface RateLimitOptions {
  windowMs: number; // Khoảng thời gian (millisecond)
  max: number; // Số request tối đa trong khoảng thời gian đó
  message?: string; // Tin nhắn báo lỗi
  keyPrefix?: string; // Tiền tố để phân biệt các Rate Limiter khác nhau
}

export const rateLimiter = (options: RateLimitOptions) => {
  const prefix = options.keyPrefix || "global"; // Mặc định là global

  return async (c: Context, next: Next) => {
    let ip = "unknown-ip";

    try {
      const info = getConnInfo(c);
      if (info?.remote?.address) {
        ip = info.remote.address;
      }
    } catch {
      // Fallback nếu không chạy qua Deno adapter
    }

    // Chỉ đọc IP từ header nếu Server đang đặt sau Reverse Proxy uy tín (Nginx/Cloudflare)
    if (config.trustProxy) {
      const forwarded = c.req.header("x-forwarded-for");
      if (forwarded) {
        ip = forwarded.split(",")[0].trim();
      } else {
        ip = c.req.header("cf-connecting-ip") || ip;
      }
    }

    const now = Date.now();
    let count = 0;
    let resetTime = now + options.windowMs;

    // 1. Ưu tiên Redis nếu kết nối thành công
    if (redisClient) {
      try {
        const key = `ratelimit:${prefix}:${ip}`; // Thêm prefix vào Redis key

        // Dùng Lua script để đảm bảo tính nguyên tử (Atomic) chống Race-Condition
        const luaScript = `
          local current = redis.call("INCR", KEYS[1])
          if current == 1 then
            redis.call("PEXPIRE", KEYS[1], ARGV[1])
          end
          return current
        `;

        const result = await redisClient.eval(luaScript, [key], [
          options.windowMs.toString(),
        ]);
        count = Number(result);

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
      const memKey = `${prefix}:${ip}`; // Thêm prefix vào Memory key
      let info = store.get(memKey);
      if (!info || now > info.resetTime) {
        info = { count: 0, resetTime: now + options.windowMs };
      }
      info.count++;
      store.set(memKey, info);

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
      // Tuân thủ RFC 6585: Thông báo cho client biết phải đợi bao nhiêu giây
      c.header("Retry-After", Math.ceil((resetTime - now) / 1000).toString());
      return c.json(
        {
          success: false,
          error: options.message || "Quá nhiều yêu cầu, vui lòng thử lại sau.",
        },
        429,
      );
    }

    await next();
  };
};
