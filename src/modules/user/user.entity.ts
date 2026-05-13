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
  role: UserRole; // FK → roles.code
  tier?: UserTier; // Populated via JOIN roles — không lưu trong DB, chỉ có khi auth query

  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  avatar: string | null;
  date_of_birth: Date | null;
  gender: string | null;
  bio: string | null;

  phone: string | null;
  phone_verified: boolean;
  email_verified: boolean;

  address: string | null;
  city: string | null;
  country: string | null;

  last_login_at: Date | null;
  last_login_ip: string | null;

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
  first_name?: string | null;
  last_name?: string | null;
  display_name?: string | null;
  avatar?: string | null;
  date_of_birth?: Date | null;
  gender?: string | null;
  bio?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  active?: boolean;
  last_login_at?: Date | null;
  last_login_ip?: string | null;
  // Không cho phép update role, email, password qua đây — chống Mass Assignment
}
