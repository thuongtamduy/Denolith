export type UserTier = "owner" | "admin" | "user";

/**
 * Thông tin quyền hạn đã được xử lý và đóng gói cho một user.
 * - Được định nghĩa ở core để tất cả các tầng (module, middleware) có thể tham chiếu
 *   mà không gây lỗi circular dependency.
 * - Middleware requirePermission() sẽ tự động fill vào đây sau khi xác thực token.
 */
export interface ResolvedPermissions {
  userId: string;
  tier: UserTier;
  granted: Set<string>;
  denied: Set<string>;
}

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
  role: string; // Role code: "admin", "supervisor", "sales_manager", ...
  tier: UserTier; // Tier hành vi: "owner" | "admin" | "user" (lấy từ roles.tier)
  exp: number; // Unix timestamp hết hạn (15 phút)
  iat?: number; // Unix timestamp phát hành (tự inject bởi @hono/jwt)
}

export interface ClientContext {
  lang: string; // "vi" | "en", default: "vi"
  apiKey?: string;
  storeId?: string; // Resolved from x-api-key or token
}

export type AppEnv = {
  Variables: {
    // Được set bởi authMiddleware sau khi xác thực token thành công
    jwtPayload: JwtPayload;
    // Được set bởi requirePermission() sau khi resolve permissions từ cache/DB
    // undefined = chưa load (OWNER không cần load)
    resolvedPermissions?: ResolvedPermissions;
    // Được set bởi clientContextMiddleware từ header (x-lang, x-api-key)
    clientContext: ClientContext;
  };
};
