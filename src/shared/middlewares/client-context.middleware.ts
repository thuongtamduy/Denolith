import type { MiddlewareHandler } from "@hono/core";
import type { AppEnv } from "../../core/context.ts";

/**
 * Middleware trích xuất và phân giải thông tin Client Context từ HTTP Headers:
 * - `x-lang`: Ngôn ngữ của client (mặc định 'vi')
 * - `x-api-key`: API Key xác thực/định danh ứng dụng hoặc store
 */
export const clientContextMiddleware: MiddlewareHandler<AppEnv> = async (
  c,
  next,
) => {
  const lang = c.req.header("x-lang") ?? "vi";
  const apiKey = c.req.header("x-api-key");

  const storeId: string | undefined = undefined;

  if (apiKey) {
    // TODO: Truy vấn cache hoặc DB để lấy storeId tương ứng với apiKey nếu cần
    // Ví dụ: storeId = await redisClient.get(`apikey:${apiKey}:storeId`);
  }

  c.set("clientContext", { lang, apiKey, storeId });
  await next();
};
