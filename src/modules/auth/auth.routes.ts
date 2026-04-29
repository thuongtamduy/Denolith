import { Hono } from "@hono/core";
import { deleteCookie, getCookie, setCookie } from "@hono/cookie";
import { vValidator } from "@hono/valibot-validator";
import * as v from "valibot";
import type { AuthService } from "./auth.service.ts";
import { rateLimiter } from "../../shared/middlewares/rate-limit.middleware.ts";
import { config } from "../../core/config.ts";
import { sanitizeUser } from "../../shared/utils/sanitize.ts";

export const createAuthRoutes = (service: AuthService) => {
  const router = new Hono();

  const registerSchema = v.object({
    username: v.pipe(v.string(), v.minLength(3), v.maxLength(50)),
    email: v.pipe(v.string(), v.email(), v.maxLength(255)),
    password: v.pipe(v.string(), v.minLength(6), v.maxLength(100)),
  });

  // Chống Brute force: tối đa 5 lần thử đăng ký / đăng nhập mỗi 15 phút
  const strictRateLimit = rateLimiter({
    windowMs: 15 * 60 * 1000, // 15 phút
    max: 5,
    message: "Bạn đã thao tác quá nhiều lần, vui lòng chờ 15 phút.",
    keyPrefix: "auth", // Tách biệt rate limit của Auth khỏi Global Rate Limit
  });

  router.post(
    "/register",
    strictRateLimit,
    vValidator("json", registerSchema),
    async (c) => {
      const body = c.req.valid("json");
      const result = await service.register(body);

      setCookie(c, "refresh_token", result.refreshToken, {
        httpOnly: true,
        secure: config.env === "production", // Yêu cầu HTTPS (khi Production)
        sameSite: "Strict",
        maxAge: 7 * 24 * 60 * 60,
        path: "/api/auth",
      });

      return c.json({
        success: true,
        data: { user: sanitizeUser(result.user), token: result.accessToken },
      }, 201);
    },
  );

  const loginSchema = v.object({
    email: v.pipe(v.string(), v.email(), v.maxLength(255)),
    password: v.pipe(v.string(), v.minLength(1), v.maxLength(100)),
  });

  router.post(
    "/login",
    strictRateLimit,
    vValidator("json", loginSchema),
    async (c) => {
      const body = c.req.valid("json");
      const result = await service.login(body);

      setCookie(c, "refresh_token", result.refreshToken, {
        httpOnly: true,
        secure: config.env === "production",
        sameSite: "Strict",
        maxAge: 7 * 24 * 60 * 60,
        path: "/api/auth",
      });

      return c.json({
        success: true,
        data: { user: sanitizeUser(result.user), token: result.accessToken },
      });
    },
  );

  router.post("/refresh", async (c) => {
    const token = getCookie(c, "refresh_token");
    if (!token) {
      return c.json({ success: false, error: "No refresh token found" }, 401);
    }
    const result = await service.refreshToken(token);

    setCookie(c, "refresh_token", result.refreshToken, {
      httpOnly: true,
      secure: config.env === "production",
      sameSite: "Strict",
      maxAge: 7 * 24 * 60 * 60,
      path: "/api/auth",
    });

    return c.json({ success: true, data: { token: result.accessToken } });
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
      deleteCookie(c, "refresh_token", { path: "/api/auth" });
    }

    return c.json({ success: true, message: "Logged out successfully" });
  });

  return router;
};
