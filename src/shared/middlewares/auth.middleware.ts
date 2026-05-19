import { verify } from "@hono/jwt";
import type { Context, Next } from "@hono/core";
import { config } from "../../core/config.ts";
import { redisClient } from "../../core/redis.ts";
import { prisma } from "../../core/database.ts";
import { AppError } from "../errors/AppError.ts";
import { requestContextStore } from "../../core/context.ts";

const USER_STATUS_TTL = 30; // Cache user active/deleted status for 30 seconds
const userStatusKey = (id: string) => `user_status:${id}`;

/**
 * Auth Middleware với Blacklist Check và Redis-cached User Verification.
 *
 * Luồng xử lý:
 * 1. Đọc Bearer token từ Authorization header
 * 2. Verify JWT (signature + expiry)
 * 3. Kiểm tra token có trong Redis blacklist không (user đã logout)
 * 4. Verify user vẫn tồn tại và active (Redis-cached, TTL 30s)
 * 5. Gán payload vào context để các handler phía sau dùng
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
    } catch (err) {
      if (err instanceof AppError) throw err;
      // Redis lỗi → không chặn request, token tự hết hạn tự nhiên sau 15 phút
    }
  }

  // Bước 3.5: Verify user vẫn tồn tại và active — ưu tiên Redis cache để giảm tải DB
  const userId = payload.id as string;

  // Thử đọc từ Redis cache trước
  let userStatus:
    | { roleCode: string; tier: string; storeIds: string[] }
    | null = null;

  if (redisClient) {
    try {
      const cached = await redisClient.get(userStatusKey(userId));
      if (cached) {
        userStatus = JSON.parse(cached);
      }
    } catch {
      // Redis fail → fall through to DB
    }
  }

  // Cache miss → truy vấn DB
  if (!userStatus) {
    const user = await prisma.user.findFirst({
      where: { id: userId, deleted: false, active: true },
      select: {
        roleCode: true,
        role: { select: { tier: true } },
        userStores: { select: { storeId: true } },
      },
    });

    if (!user) {
      throw AppError.unauthorized(
        "User account no longer exists or has been disabled.",
      );
    }

    userStatus = {
      roleCode: user.roleCode,
      tier: user.role.tier,
      storeIds: user.userStores.map((us) => us.storeId),
    };

    // Ghi vào Redis cache (TTL 30s) — lần truy vấn tiếp theo sẽ không chạm DB
    if (redisClient) {
      try {
        await redisClient.set(
          userStatusKey(userId),
          JSON.stringify(userStatus),
          { EX: USER_STATUS_TTL }, // Cache theo TTL
        );
      } catch {
        // Ignore cache write failure
      }
    }
  }

  // Ghi đè role + tier từ source of truth (DB/cache) — luôn dùng giá trị mới nhất
  payload.role = userStatus.roleCode;
  payload.tier = userStatus.tier;

  // Bước 4: Gán payload vào context để RBAC middleware và handler dùng
  c.set("jwtPayload", payload);

  // Bước 5: Bắt buộc truyền x-api-key (storeId) cho user thường (không phải owner)
  if (userStatus.tier !== "owner") {
    const path = c.req.path;
    // Bỏ qua cho các API không cần context của store
    const isExcluded = path.endsWith("/auth/logout") ||
      path.endsWith("/users/me");

    if (!isExcluded) {
      const clientCtx = c.get("clientContext") as
        | { storeId?: string }
        | undefined;
      if (!clientCtx?.storeId) {
        throw AppError.forbidden(
          "Header 'x-api-key' (Store ID) is required to perform this action.",
        );
      }

      // Kiểm tra xem Store ID truyền lên có thuộc danh sách cửa hàng của User hay không
      if (!userStatus.storeIds.includes(clientCtx.storeId)) {
        throw AppError.forbidden(
          "You don't have permission to access this store context.",
        );
      }
    }
  }

  await requestContextStore.run({ actorId: userId }, async () => {
    await next();
  });
};
