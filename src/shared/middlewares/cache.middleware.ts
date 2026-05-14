import type { Context, Next } from "@hono/core";
import { redisClient } from "../../core/redis.ts";
import type { AppEnv } from "../../core/context.ts";

interface CacheEntry {
  data: string;
  expiresAt: number;
}

// Memory Store dự phòng cho trường hợp hệ thống ko xài Redis
const memoryCache = new Map<string, CacheEntry>();

// Dọn dẹp Memory Leak định kỳ mỗi 1 phút
setInterval(() => {
  const now = Date.now();
  for (const [key, mem] of memoryCache.entries()) {
    if (now > mem.expiresAt) {
      memoryCache.delete(key);
    }
  }
}, 60000);

export const cacheResponse = (ttlSeconds: number) => {
  return async (c: Context<AppEnv>, next: Next) => {
    // Chỉ Cache các request có tính chất ĐỌC (GET)
    if (c.req.method !== "GET") {
      return await next();
    }

    const payload = c.get("jwtPayload");
    const userId = payload?.id ?? "anonymous";
    const key = `cache:${userId}:${c.req.url}`;
    const now = Date.now();

    let cachedData: string | null = null;
    let cacheSource = "";

    // 1. Thử lấy từ Redis
    if (redisClient) {
      try {
        cachedData = await redisClient.get(key);
        if (cachedData) cacheSource = "HIT-REDIS";
      } catch {
        // Lỗi Redis (đứt mạng) -> Bỏ qua để chui xuống Memory
      }
    }

    // 2. Nếu Redis không có (hoặc bị lỗi), thử lấy từ Memory
    if (!cachedData) {
      const mem = memoryCache.get(key);
      if (mem && now < mem.expiresAt) {
        cachedData = mem.data;
        cacheSource = "HIT-MEMORY";
      } else if (mem) {
        // Đã hết hạn
        memoryCache.delete(key);
      }
    }

    // 3. Nếu tìm thấy Cache -> Trả về ngay lập tức (Tốc độ ánh sáng)
    if (cachedData) {
      return new Response(cachedData, {
        headers: {
          "Content-Type": "application/json",
          "X-Cache": cacheSource,
        },
      });
    }

    // 4. Nếu MISS -> Cho request đi tiếp xuống DB
    await next();

    // 5. Sau khi DB xử lý xong, bắt lấy kết quả và nạp vào Cache
    if (c.res.status === 200) {
      const responseClone = c.res.clone();
      const bodyStr = await responseClone.text();

      c.res.headers.set("X-Cache", "MISS");

      let savedToRedis = false;
      if (redisClient) {
        try {
          await redisClient.setEx(key, ttlSeconds, bodyStr);
          savedToRedis = true;
        } catch { /* Ignore Redis error */ }
      }

      if (!savedToRedis) {
        const MAX_MEMORY_KEYS = 1000;

        // Cơ chế LRU sơ khai: Nếu vượt quá giới hạn, xóa phần tử cũ nhất (đầu tiên)
        if (memoryCache.size >= MAX_MEMORY_KEYS) {
          const oldestKey = memoryCache.keys().next().value;
          if (oldestKey) memoryCache.delete(oldestKey);
        }

        memoryCache.set(key, {
          data: bodyStr,
          expiresAt: now + ttlSeconds * 1000,
        });
      }
    }
  };
};
