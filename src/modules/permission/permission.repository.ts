import type { Client, Transaction } from "@db/postgres";
import { BaseRepository } from "../../core/base.repository.ts";
import type {
  Permission,
  PermissionProfile,
  UserPermission,
  UserProfile,
} from "./permission.entity.ts";
import type {
  PaginatedResult,
  PaginationParams,
} from "../../shared/utils/pagination.ts";

/** Raw permission row được resolve từ DB — chứa cả profile-based và individual */
interface RawPermissionRow {
  permission_code: string;
  granted: boolean;
}

/** DTO tạo mới permission profile */
export interface CreateProfileData {
  name: string;
  tier: "admin" | "user";
  description?: string;
}

/** DTO cập nhật permission profile */
export interface UpdateProfileData {
  name?: string;
  description?: string | null; // null = xóa mô tả
  active?: boolean;
}

export class PermissionRepository extends BaseRepository {
  constructor(db: Client) {
    super(db);
  }

  // ─────────────────────────────────────────────
  // RESOLVE: Tổng hợp quyền cuối cùng cho 1 user
  // ─────────────────────────────────────────────

  /**
   * Tổng hợp toàn bộ quyền của user từ 2 nguồn:
   *   1. Profile-based: union các profile đang active được assign
   *   2. Individual override: user_permissions (ưu tiên cao hơn)
   *
   * Trả về: danh sách { code, granted } cuối cùng sau khi merge.
   */
  async resolveForUser(
    userId: string,
    tx?: Transaction,
  ): Promise<RawPermissionRow[]> {
    // Bước 1: Tổng hợp profile-based permissions
    // bool_or(granted) = true nếu BẤT KỲ profile nào cấp quyền đó
    const profileRows = await this.queryMany<RawPermissionRow>(
      `SELECT pp.permission_code,
              bool_or(pp.granted) AS granted
       FROM user_profiles up
       JOIN permission_profiles ppr ON up.profile_id = ppr.id
                                   AND ppr.active = true
       JOIN profile_permissions pp  ON pp.profile_id = ppr.id
       WHERE up.user_id = $1
       GROUP BY pp.permission_code`,
      [userId],
      tx,
    );

    // Bước 2: Individual overrides (luôn ghi đè profile)
    const overrideRows = await this.queryMany<RawPermissionRow>(
      `SELECT permission_code, granted
       FROM user_permissions
       WHERE user_id = $1`,
      [userId],
      tx,
    );

    // Bước 3: Merge — override ghi đè profile
    const permMap = new Map<string, boolean>();
    for (const row of profileRows) {
      permMap.set(row.permission_code, row.granted);
    }
    for (const row of overrideRows) {
      permMap.set(row.permission_code, row.granted); // Override wins
    }

    return Array.from(permMap.entries()).map(([permission_code, granted]) => ({
      permission_code,
      granted,
    }));
  }

  /** Lấy role + tier của user — dùng để check tier khi assign profile */
  async findUserRole(
    userId: string,
    tx?: Transaction,
  ): Promise<{ role: string; tier: string } | undefined> {
    return await this.queryOne<{ role: string; tier: string }>(
      `SELECT u.role, r.tier
       FROM users u
       JOIN roles r ON u.role = r.code
       WHERE u.id = $1 AND u.deleted = false`,
      [userId],
      tx,
    );
  }

  // ─────────────────────────────────────────────
  // PERMISSIONS (atomic — developer-managed)
  // ─────────────────────────────────────────────

  async findAllPermissions(tx?: Transaction): Promise<Permission[]> {
    return await this.queryMany<Permission>(
      `SELECT id, code, description, created_at
       FROM permissions
       ORDER BY code ASC`,
      [],
      tx,
    );
  }

  // ─────────────────────────────────────────────
  // PERMISSION PROFILES (admin-managed)
  // ─────────────────────────────────────────────

  async findManyProfiles(
    params: PaginationParams,
    tier?: "admin" | "user",
    tx?: Transaction,
  ): Promise<PaginatedResult<PermissionProfile>> {
    const whereClauses: string[] = [];
    const queryParams: unknown[] = [];

    if (tier) {
      queryParams.push(tier);
      whereClauses.push(`tier = $${queryParams.length}`);
    }

    const where = whereClauses.length > 0
      ? `WHERE ${whereClauses.join(" AND ")}`
      : "";

    return await this.paginate<PermissionProfile>(
      `SELECT id, name, tier, description, active, created_at, updated_at
       FROM permission_profiles
       ${where}
       ORDER BY tier ASC, name ASC`,
      queryParams,
      params,
      tx,
    );
  }

  async findProfileById(
    id: string,
    tx?: Transaction,
  ): Promise<PermissionProfile | undefined> {
    return await this.queryOne<PermissionProfile>(
      `SELECT id, name, tier, description, active, created_at, updated_at
       FROM permission_profiles
       WHERE id = $1`,
      [id],
      tx,
    );
  }

  async createProfile(
    data: CreateProfileData,
    tx?: Transaction,
  ): Promise<PermissionProfile> {
    const profile = await this.queryOne<PermissionProfile>(
      `INSERT INTO permission_profiles (name, tier, description)
       VALUES ($1, $2, $3)
       RETURNING id, name, tier, description, active, created_at, updated_at`,
      [data.name, data.tier, data.description ?? null],
      tx,
    );
    return profile!;
  }

  async updateProfile(
    id: string,
    data: UpdateProfileData,
    tx?: Transaction,
  ): Promise<PermissionProfile | undefined> {
    const updates = Object.entries(data).filter(([_, val]) =>
      val !== undefined
    );
    if (updates.length === 0) return await this.findProfileById(id, tx);

    const setClauses = updates.map(([key, _], i) => `${key} = $${i + 2}`).join(
      ", ",
    );
    const values = updates.map(([_, val]) => val);

    return await this.queryOne<PermissionProfile>(
      `UPDATE permission_profiles
       SET ${setClauses}
       WHERE id = $1
       RETURNING id, name, tier, description, active, created_at, updated_at`,
      [id, ...values],
      tx,
    );
  }

  async deleteProfile(id: string, tx?: Transaction): Promise<boolean> {
    const rowCount = await this.execute(
      `DELETE FROM permission_profiles WHERE id = $1`,
      [id],
      tx,
    );
    return rowCount > 0;
  }

  // ─────────────────────────────────────────────
  // PROFILE ↔ PERMISSIONS
  // ─────────────────────────────────────────────

  /** Lấy toàn bộ permissions của 1 profile */
  async findProfilePermissions(
    profileId: string,
    tx?: Transaction,
  ): Promise<Array<{ permission_code: string; granted: boolean }>> {
    return await this.queryMany(
      `SELECT permission_code, granted
       FROM profile_permissions
       WHERE profile_id = $1
       ORDER BY permission_code ASC`,
      [profileId],
      tx,
    );
  }

  /** Set (upsert) permission vào profile */
  async setProfilePermission(
    profileId: string,
    permissionCode: string,
    granted: boolean,
    tx?: Transaction,
  ): Promise<void> {
    await this.execute(
      `INSERT INTO profile_permissions (profile_id, permission_code, granted)
       VALUES ($1, $2, $3)
       ON CONFLICT (profile_id, permission_code)
       DO UPDATE SET granted = EXCLUDED.granted`,
      [profileId, permissionCode, granted],
      tx,
    );
  }

  /** Xóa permission khỏi profile */
  async removeProfilePermission(
    profileId: string,
    permissionCode: string,
    tx?: Transaction,
  ): Promise<boolean> {
    const rowCount = await this.execute(
      `DELETE FROM profile_permissions
       WHERE profile_id = $1 AND permission_code = $2`,
      [profileId, permissionCode],
      tx,
    );
    return rowCount > 0;
  }

  // ─────────────────────────────────────────────
  // USER ↔ PROFILES
  // ─────────────────────────────────────────────

  async findUserProfiles(
    userId: string,
    tx?: Transaction,
  ): Promise<UserProfile[]> {
    return await this.queryMany<UserProfile>(
      `SELECT user_id, profile_id, assigned_at, assigned_by
       FROM user_profiles
       WHERE user_id = $1`,
      [userId],
      tx,
    );
  }

  async assignProfileToUser(
    userId: string,
    profileId: string,
    assignedBy: string | null,
    tx?: Transaction,
  ): Promise<void> {
    await this.execute(
      `INSERT INTO user_profiles (user_id, profile_id, assigned_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, profile_id) DO NOTHING`,
      [userId, profileId, assignedBy],
      tx,
    );
  }

  async revokeProfileFromUser(
    userId: string,
    profileId: string,
    tx?: Transaction,
  ): Promise<boolean> {
    const rowCount = await this.execute(
      `DELETE FROM user_profiles
       WHERE user_id = $1 AND profile_id = $2`,
      [userId, profileId],
      tx,
    );
    return rowCount > 0;
  }

  // ─────────────────────────────────────────────
  // USER INDIVIDUAL OVERRIDES
  // ─────────────────────────────────────────────

  async findUserPermissions(
    userId: string,
    tx?: Transaction,
  ): Promise<UserPermission[]> {
    return await this.queryMany<UserPermission>(
      `SELECT user_id, permission_code, granted, assigned_at, assigned_by
       FROM user_permissions
       WHERE user_id = $1
       ORDER BY permission_code ASC`,
      [userId],
      tx,
    );
  }

  /** Upsert: cấp hoặc thu hồi 1 quyền riêng lẻ cho user */
  async setUserPermission(
    userId: string,
    permissionCode: string,
    granted: boolean,
    assignedBy: string | null,
    tx?: Transaction,
  ): Promise<void> {
    await this.execute(
      `INSERT INTO user_permissions (user_id, permission_code, granted, assigned_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, permission_code)
       DO UPDATE SET granted = EXCLUDED.granted,
                     assigned_by = EXCLUDED.assigned_by,
                     assigned_at = NOW()`,
      [userId, permissionCode, granted, assignedBy],
      tx,
    );
  }

  /** Xóa override cá nhân — user sẽ fallback về quyền từ profile */
  async removeUserPermission(
    userId: string,
    permissionCode: string,
    tx?: Transaction,
  ): Promise<boolean> {
    const rowCount = await this.execute(
      `DELETE FROM user_permissions
       WHERE user_id = $1 AND permission_code = $2`,
      [userId, permissionCode],
      tx,
    );
    return rowCount > 0;
  }
}
