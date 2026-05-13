import { Hono } from "@hono/core";
import { deleteCookie, getCookie, setCookie } from "@hono/cookie";
import { AppError } from "../../shared/errors/AppError.ts";
import { sendMessage, sendSuccess } from "../../shared/utils/response.ts";
import { validateJson } from "../../shared/utils/validator.ts";
import type { AuthService } from "./auth.service.ts";
import { rateLimiter } from "../../shared/middlewares/rate-limit.middleware.ts";
import { config } from "../../core/config.ts";
import { sanitizeUser } from "../../shared/utils/sanitize.ts";
import {
  type LoginInput,
  loginSchema,
  type RegisterInput,
  registerSchema,
} from "./auth.validation.ts";

export const createPublicAuthRoutes = (service: AuthService) => {
  const router = new Hono();

  // Chống Brute force: tối đa 5 lần thử đăng ký / đăng nhập mỗi 15 phút
  const strictRateLimit = rateLimiter({
    windowMs: 15 * 60 * 1000, // 15 phút
    max: 5,
    message: "Too many attempts. Please try again in 15 minutes.",
    keyPrefix: "auth", // Tách biệt rate limit của Auth khỏi Global Rate Limit
  });

  router.post(
    "/register",
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
        path: "/api/auth",
      });

      c.header("Location", `/api/users/${result.user.id}`);
      c.header("Location", `/api/users/${result.user.id}`);
      return sendSuccess(
        c,
        {
          user: sanitizeUser(result.user),
          accessToken: result.accessToken,
        },
        undefined,
        201,
      );
    },
  );

  router.post(
    "/login",
    strictRateLimit,
    validateJson(loginSchema),
    async (c) => {
      const body = c.req.valid("json") as LoginInput;
      const ip = c.req.header("x-forwarded-for") || "unknown";
      const result = await service.login(body, ip);

      setCookie(c, "refresh_token", result.refreshToken, {
        httpOnly: true,
        secure: config.env === "production",
        sameSite: config.env === "production" ? "None" : "Lax",
        maxAge: 7 * 24 * 60 * 60,
        path: "/api/auth",
      });

      return sendSuccess(c, {
        user: sanitizeUser(result.user),
        accessToken: result.accessToken,
      });
    },
  );

  return router;
};

export const createProtectedAuthRoutes = (service: AuthService) => {
  const router = new Hono();

  router.post("/refresh", async (c) => {
    const token = getCookie(c, "refresh_token");
    if (!token) {
      throw AppError.unauthorized("No refresh token found");
    }
    const result = await service.refreshToken(token);

    setCookie(c, "refresh_token", result.refreshToken, {
      httpOnly: true,
      secure: config.env === "production",
      sameSite: config.env === "production" ? "None" : "Lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/api/auth",
    });

    return sendSuccess(c, { accessToken: result.accessToken });
  });

  router.post("/logout", async (c) => {
    const refreshToken = getCookie(c, "refresh_token");

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
        path: "/api/auth",
        secure: config.env === "production",
        sameSite: config.env === "production" ? "None" : "Lax",
      });
    }

    return sendMessage(c, "Logged out successfully");
  });

  return router;
};
