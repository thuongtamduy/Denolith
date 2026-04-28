import { Hono } from "@hono/core";
import { deleteCookie, getCookie, setCookie } from "@hono/cookie";
import { vValidator } from "@hono/valibot-validator";
import * as v from "valibot";
import type { AuthService } from "./auth.service.ts";
import { rateLimiter } from "../../shared/middlewares/rate-limit.middleware.ts";
import { config } from "../../core/config.ts";

export const createAuthRoutes = (service: AuthService) => {
  const router = new Hono();

  const registerSchema = v.object({
    username: v.pipe(v.string(), v.minLength(3)),
    email: v.pipe(v.string(), v.email()),
    password: v.pipe(v.string(), v.minLength(6)),
  });

  // Chống Brute force: tối đa 5 lần thử đăng ký / đăng nhập mỗi 15 phút
  const strictRateLimit = rateLimiter({
    windowMs: 15 * 60 * 1000, // 15 phút
    max: 5,
    message: "Bạn đã thao tác quá nhiều lần, vui lòng chờ 15 phút.",
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
        data: { user: result.user, token: result.accessToken },
      }, 201);
    },
  );

  const loginSchema = v.object({
    email: v.pipe(v.string(), v.email()),
    password: v.pipe(v.string(), v.minLength(1)),
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
        data: { user: result.user, token: result.accessToken },
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
    const token = getCookie(c, "refresh_token");
    if (token) {
      await service.logout(token);
      deleteCookie(c, "refresh_token", { path: "/api/auth" });
    }
    return c.json({ success: true, message: "Logged out" });
  });

  return router;
};
