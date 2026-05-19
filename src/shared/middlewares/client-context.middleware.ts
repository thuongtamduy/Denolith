import type { MiddlewareHandler } from "@hono/core";
import type { AppEnv } from "../../core/context.ts";
import { prisma } from "../../core/database.ts";
import { redisClient } from "../../core/redis.ts";
import { AppError } from "../errors/AppError.ts";

/**
 * Middleware trích xuất và phân giải thông tin Client Context từ HTTP Headers:
 * - `x-lang`: Ngôn ngữ của client (mặc định 'vi')
 * - `x-api-key`: API Key xác thực/định danh ứng dụng hoặc store (thực chất là storeId)
 */
export const clientContextMiddleware: MiddlewareHandler<AppEnv> = async (
  c,
  next,
) => {
  const lang = c.req.header("x-lang") ?? "vi";
  const apiKey = c.req.header("x-api-key");

  let storeId: string | undefined = undefined;

  if (apiKey) {
    storeId = apiKey;
    const cacheKey = `store:active:${storeId}`;
    let isStoreValid = false;

    // 1. Kiểm tra cache trước (nếu Redis hoạt động)
    if (redisClient) {
      const cached = await redisClient.get(cacheKey);
      if (cached === "1") isStoreValid = true;
    }

    // 2. Nếu chưa có trong cache, truy vấn DB
    if (!isStoreValid) {
      try {
        const store = await prisma.store.findFirst({
          where: {
            id: storeId,
            status: "active",
            deleted: false,
          },
          select: { id: true },
        });

        if (!store) {
          throw AppError.unauthorized("Invalid API Key or Store is inactive");
        }

        // Lưu vào cache 1 giờ để giảm tải DB cho các request sau
        if (redisClient) {
          await redisClient.set(cacheKey, "1", { EX: 3600 });
        }
      } catch (err: unknown) {
        // Nếu truyền API Key không đúng định dạng UUID, Prisma sẽ ném lỗi.
        // Ta cũng gom chung thành lỗi Unauthorized.
        if (err instanceof AppError) throw err;
        throw AppError.unauthorized(
          "Invalid API Key format or Store not found",
        );
      }
    }
  }

  c.set("clientContext", { lang, apiKey, storeId });
  await next();
};
