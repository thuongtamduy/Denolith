/**
 * Tier hành vi hệ thống — cố định, không thay đổi tại runtime.
 *
 * Quyết định cách hệ thống xử lý user:
 *  - owner : Bypass HOÀN TOÀN mọi permission check, toàn quyền
 *  - admin : Phải được cấp PermissionProfile, KHÔNG tự do hành động
 *  - user  : Bị giới hạn theo PermissionProfile được assign
 */
export type UserTier = "owner" | "admin" | "user";

/**
 * Role code — FK tới bảng `roles.code`.
 * Có thể là bất kỳ string nào tồn tại trong bảng roles tại runtime.
 * Ví dụ: "owner", "admin", "user", "supervisor", "moderator", ...
 */
export type UserRole = string;

export interface User {
  id: string;
  username: string;
  email: string;
  password: string;
  role: UserRole;      // FK → roles.code
  tier?: UserTier;     // Populated via JOIN roles — không lưu trong DB, chỉ có khi auth query
  phone: string | null;
  active: boolean;
  // --- Audit Fields (bắt buộc có ở mọi bảng) ---
  created_at: Date; // Auto-set bởi DB khi INSERT
  updated_at: Date; // Auto-set bởi PostgreSQL Trigger khi UPDATE
  deleted: boolean; // Flag: false = đang hoạt động, true = đã bị xóa mềm
  deleted_at: Date | null; // Timestamp xóa mềm: null nếu chưa xóa
}

export interface CreateUserData {
  username: string;
  email: string;
  password: string;
  phone?: string;
  role?: UserRole; // Mặc định "user" nếu không truyền (enforce ở DB DEFAULT)
}

export interface UpdateUserData {
  username?: string;
  phone?: string | null;
  active?: boolean;
  // Không cho phép update role, email, password qua đây — chống Mass Assignment
}

