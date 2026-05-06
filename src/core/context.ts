/**
 * Định nghĩa kiểu dữ liệu cho Hono Context Variables.
 * Dùng chung cho toàn bộ Routes, Middlewares trong hệ thống.
 *
 * Cách dùng:
 *   const app = new Hono<AppEnv>();
 *   const router = new Hono<AppEnv>();
 */

// Khớp chính xác với payload được sign trong auth.service.ts
export interface JwtPayload {
  id: string; // User UUID
  role: string; // "user" | "admin"
  exp: number; // Unix timestamp hết hạn (15 phút)
  iat?: number; // Unix timestamp phát hành (tự inject bởi @hono/jwt)
}

export type AppEnv = {
  Variables: {
    // Được set bởi authMiddleware (jwt()) sau khi xác thực token thành công
    jwtPayload: JwtPayload;
  };
};
