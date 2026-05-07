import type { UserTier } from "../modules/user/user.entity.ts";
import type { ResolvedPermissions } from "../modules/permission/permission.entity.ts";

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
  id: string;      // User UUID
  role: string;    // Role code: "admin", "supervisor", "sales_manager", ...
  tier: UserTier;  // Tier hành vi: "owner" | "admin" | "user" (lấy từ roles.tier)
  exp: number;     // Unix timestamp hết hạn (15 phút)
  iat?: number;    // Unix timestamp phát hành (tự inject bởi @hono/jwt)
}

export type AppEnv = {
  Variables: {
    // Được set bởi authMiddleware sau khi xác thực token thành công
    jwtPayload: JwtPayload;
    // Được set bởi requirePermission() sau khi resolve permissions từ cache/DB
    // undefined = chưa load (OWNER không cần load)
    resolvedPermissions?: ResolvedPermissions;
  };
};
