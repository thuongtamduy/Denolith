import type { UserTier } from "../user/user.entity.ts";

/**
 * Entity `roles` — quản lý tại runtime qua API (trừ 3 roles system).
 * tier: gôm nhóm hành vi (owner | admin | user) — cố định trong code.
 * system=true: không được xóa hoặc đổi tier.
 */
export interface Role {
  code: string; // PK — "owner", "supervisor", "accountant"...
  tier: UserTier; // Hành vi bucket: "owner" | "admin" | "user"
  name: string; // Tên hiển thị: "Chủ sở hữu", "Giám sát viên"
  description: string | null;
  system: boolean; // true = 3 roles gốc, không được xóa
  active: boolean;
  created_at: Date;
}

export interface CreateRoleData {
  code: string;
  tier: "admin" | "user"; // Không được phép tạo role tier 'owner'
  name: string;
  description?: string;
}

export interface UpdateRoleData {
  name?: string;
  description?: string | null;
  active?: boolean;
}
