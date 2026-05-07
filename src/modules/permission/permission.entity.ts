import type { UserTier } from "../user/user.entity.ts";

/**
 * Tier được phép assign permission_profile.
 * OWNER không cần profile — bypass hoàn toàn.
 */
export type ProfileTier = Exclude<UserTier, "owner">;

/**
 * Một quyền nguyên tử trong hệ thống.
 * Format: "<resource>.<action>" — ví dụ: "users.read", "reports.export"
 *
 * Developer định nghĩa code, không ai tự thêm được tại runtime.
 * Thay đổi code phải qua migration.
 */
export interface Permission {
  id: string;
  code: string; // "users.read" | "reports.export" | "products.create" | ...
  description: string | null; // Mô tả ngắn gọn để Admin hiểu
  created_at: Date;
}

/**
 * Bộ quyền được đặt tên — tương đương "ADMIN_1", "ADMIN_2" trong thiết kế.
 * Admin tạo và cấu hình tại runtime.
 *
 * Mỗi profile gắn với một tier cụ thể (admin | user).
 * Profile của tier "admin" chỉ assign được cho user có role "admin".
 * Profile của tier "user" chỉ assign được cho user có role "user".
 */
export interface PermissionProfile {
  id: string;
  name: string; // "Sales Manager", "Report Viewer", "Super Admin"
  tier: ProfileTier; // "admin" | "user"
  description: string | null;
  active: boolean; // false = profile bị vô hiệu hóa, toàn bộ assignment bị thu hồi
  created_at: Date;
  updated_at: Date;
}

/**
 * Mapping: PermissionProfile → Permission.
 * Một profile chứa nhiều permissions.
 * granted=false cho phép tường minh cấm 1 quyền trong profile.
 */
export interface ProfilePermission {
  profile_id: string; // → permission_profiles.id
  permission_code: string; // → permissions.code (dùng code thay UUID cho readability)
  granted: boolean; // true = cấp | false = cấm tường minh
}

/**
 * Mapping: User → PermissionProfile.
 * Một user có thể được assign nhiều profiles (union quyền).
 */
export interface UserProfile {
  user_id: string; // → users.id
  profile_id: string; // → permission_profiles.id
  assigned_at: Date;
  assigned_by: string | null; // UUID của admin thực hiện (null nếu system)
}

/**
 * Override quyền cá nhân — cấp/thu hồi 1 quyền riêng lẻ cho 1 user cụ thể.
 * Có độ ưu tiên CAO HƠN profile.
 *
 * Dùng khi cần exception: "user này không được export dù profile cho phép"
 */
export interface UserPermission {
  user_id: string; // → users.id
  permission_code: string; // → permissions.code
  granted: boolean; // true = cấp thêm | false = thu hồi
  assigned_at: Date;
  assigned_by: string | null; // UUID của admin thực hiện
}

/**
 * DTO gọn để check quyền nhanh trong middleware/service.
 * Được tổng hợp từ user_profiles + user_permissions và cache vào Redis.
 */
export interface ResolvedPermissions {
  userId: string;
  tier: UserTier; // Tier hành vi — dùng để check owner bypass
  // Set các quyền cuối cùng sau khi đã merge profile + individual overrides
  granted: Set<string>; // "users.read", "reports.export", ...
  denied: Set<string>; // Quyền bị cấm tường minh (override > profile)
}
