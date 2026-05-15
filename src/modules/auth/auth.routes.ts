import { Hono } from "@hono/core";
import { describeRoute } from "../../shared/utils/openapi.ts";
import { deleteCookie, getCookie, setCookie } from "@hono/cookie";
import { AppError } from "../../shared/errors/AppError.ts";
import { validateJson } from "../../shared/utils/validator.ts";
import type { AuthService } from "./auth.service.ts";
import { rateLimiter } from "../../shared/middlewares/rate-limit.middleware.ts";
import { config } from "../../core/config.ts";
import { sanitizeUser } from "../../shared/utils/sanitize.ts";
import { authMiddleware } from "../../shared/middlewares/auth.middleware.ts";
import { requireRole } from "../../shared/middlewares/rbac.middleware.ts";
import {
  type LoginInput,
  loginSchema,
  type RegisterInput,
  registerSchema,
} from "./auth.validation.ts";

const RATE_LIMIT_WINDOW = 5;
const RATE_LIMIT_MAX = 10;
export const createPublicAuthRoutes = (service: AuthService) => {
  const router = new Hono();
  // Chống Brute force: tối đa 10 lần thử đăng ký / đăng nhập mỗi 5 phút
  const strictRateLimit = rateLimiter({
    windowMs: RATE_LIMIT_WINDOW * 60 * 1000,
    max: RATE_LIMIT_MAX,
    message:
      `Too many attempts. Please try again in ${RATE_LIMIT_WINDOW} minutes.`,
    keyPrefix: "auth", // Tách biệt rate limit của Auth khỏi Global Rate Limit
  });

  router.post(
    "/register",
    describeRoute({
      tags: ["Auth"],
      summary: "User Registration",
      security: [],
      responses: {
        201: { description: "User registered successfully" },
        400: { description: "Bad request or validation error" },
        401: { description: "Unauthorized" },
        500: { description: "Internal server error" },
      },
    }),
    strictRateLimit,
    validateJson(registerSchema),
    async (c) => {
      const body = c.req.valid("json") as RegisterInput;
      const result = await service.register(body);

      setCookie(c, "refresh_token", result.refreshToken, {
        httpOnly: true,
        secure: config.env === "production", // Yêu cầu HTTPS (khi Production)
        sameSite: config.env === "production" ? "None" : "Lax",
        maxAge: 7 * 24 * 60 * 60,
        path: "/",
      });

      c.header("Location", `/v1/users/${result.user.id}`);
      return c.json({
        success: true,
        data: {
          user: sanitizeUser(result.user),
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        },
      }, 201);
    },
  );

  router.post(
    "/login",
    describeRoute({
      tags: ["Auth"],
      summary: "User Login",
      security: [],
      responses: {
        200: { description: "Successful login" },
        400: { description: "Bad request or validation error" },
        401: { description: "Unauthorized" },
        500: { description: "Internal server error" },
      },
    }),
    strictRateLimit,
    validateJson(loginSchema),
    async (c) => {
      const body = c.req.valid("json") as LoginInput;

      // Lấy IP client (ưu tiên X-Forwarded-For khi qua reverse proxy)
      const clientIp = c.req.header("X-Forwarded-For")?.split(",")[0]?.trim() ||
        c.req.header("X-Real-Ip") ||
        "unknown";
      const clientUserAgent = c.req.header("User-Agent") || "unknown";

      const result = await service.login({
        ...body,
        clientIp,
        clientUserAgent,
      });

      setCookie(c, "refresh_token", result.refreshToken, {
        httpOnly: true,
        secure: config.env === "production",
        sameSite: config.env === "production" ? "None" : "Lax",
        maxAge: 7 * 24 * 60 * 60,
        path: "/",
      });

      return c.json({
        success: true,
        data: {
          user: sanitizeUser(result.user),
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        },
      });
    },
  );

  router.post(
    "/clear-cache",
    describeRoute({
      tags: ["Auth"],
      summary: "Clear Cache Data",
      description: "Xoá toàn bộ dữ liệu Redis (bao gồm Rate Limit).",
      responses: {
        200: { description: "Data cleared successfully" },
        401: { description: "Unauthorized" },
        403: { description: "Forbidden" },
      },
    }),
    authMiddleware,
    requireRole("owner"),
    async (c) => {
      const { redisClient } = await import("../../core/redis.ts");
      if (redisClient) {
        await redisClient.flushAll();
      }
      return c.json({ success: true, message: "Data cleared successfully" });
    },
  );

  router.get(
    "/cache",
    describeRoute({
      tags: ["Auth"],
      summary: "Get Cache Data",
      description:
        "Xem dữ liệu đang có trong Redis (hiển thị tối đa 100 keys).",
      responses: {
        200: { description: "Data retrieved successfully" },
        401: { description: "Unauthorized" },
        403: { description: "Forbidden" },
      },
    }),
    authMiddleware,
    requireRole("owner"),
    async (c) => {
      const { redisClient } = await import("../../core/redis.ts");
      if (!redisClient) {
        return c.json(
          { success: false, message: "Redis is not connected" },
          500,
        );
      }

      const keys = await redisClient.keys("*");
      const data: Record<string, unknown> = {};

      const limitedKeys = keys.slice(0, 100);

      for (const key of limitedKeys) {
        const type = await redisClient.type(key);
        if (type === "string") {
          data[key] = await redisClient.get(key);
        } else if (type === "hash") {
          data[key] = await redisClient.hGetAll(key);
        } else if (type === "list") {
          data[key] = await redisClient.lRange(key, 0, -1);
        } else if (type === "set") {
          data[key] = await redisClient.sMembers(key);
        } else {
          data[key] = `[Unsupported type: ${type}]`;
        }
      }

      return c.json({
        success: true,
        totalKeys: keys.length,
        showing: limitedKeys.length,
        data,
      });
    },
  );

  return router;
};
export const createAuthRoutes = (service: AuthService) => {
  const router = new Hono();

  router.post(
    "/refresh",
    describeRoute({
      tags: ["Auth"],
      summary: "Refresh Token",
      requestBody: {
        content: {
          "application/json": {
            example: {
              refreshToken: "123e4567-e89b-12d3-a456-426614174000",
            },
          },
        },
      },
      responses: {
        200: { description: "Token refreshed successfully" },
        401: { description: "No refresh token found" },
      },
    }),
    async (c) => {
      let token = getCookie(c, "refresh_token");
      if (!token) {
        try {
          const body = await c.req.json();
          token = body?.refreshToken;
        } catch {
          // No json body
        }
      }
      if (!token) {
        throw AppError.unauthorized("No refresh token found (cookie or body)");
      }
      const result = await service.refreshToken(token);

      setCookie(c, "refresh_token", result.refreshToken, {
        httpOnly: true,
        secure: config.env === "production",
        sameSite: config.env === "production" ? "None" : "Lax",
        maxAge: 7 * 24 * 60 * 60,
        path: "/",
      });

      return c.json({
        success: true,
        data: {
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        },
      });
    },
  );

  router.post(
    "/logout",
    describeRoute({
      tags: ["Auth"],
      summary: "User Logout",
      requestBody: {
        content: {
          "application/json": {
            example: {
              refreshToken: "123e4567-e89b-12d3-a456-426614174000",
            },
          },
        },
      },
      responses: {
        200: { description: "Logged out successfully" },
        400: { description: "Bad request or validation error" },
        401: { description: "Unauthorized" },
        500: { description: "Internal server error" },
      },
    }),
    async (c) => {
      let refreshToken = getCookie(c, "refresh_token");
      if (!refreshToken) {
        try {
          const body = await c.req.json();
          refreshToken = body?.refreshToken;
        } catch {
          // No json body
        }
      }

      // Lấy Access Token từ Authorization header để blacklist
      const authHeader = c.req.header("Authorization") ?? "";
      const accessToken = authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : undefined;

      // Lấy exp từ JWT payload nếu có (để tính TTL blacklist)
      let exp: number | undefined;
      if (accessToken) {
        try {
          const { verify } = await import("@hono/jwt");
          const payload = await verify(accessToken, config.jwtSecret, "HS256");
          exp = payload.exp as number | undefined;
        } catch {
          // Token không hợp lệ hoặc đã hết hạn — không cần blacklist
        }
      }

      if (refreshToken) {
        await service.logout(refreshToken, accessToken, exp);
        deleteCookie(c, "refresh_token", {
          path: "/",
          secure: config.env === "production",
          sameSite: config.env === "production" ? "None" : "Lax",
        });
      }

      return c.json({ success: true, message: "Logged out successfully" });
    },
  );

  return router;
};
