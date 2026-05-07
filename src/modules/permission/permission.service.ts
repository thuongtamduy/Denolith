import { redisClient } from "../../core/redis.ts";
import { logger } from "../../core/logger.ts";
import { AppError } from "../../shared/errors/AppError.ts";
import { AuditService } from "../../core/audit.ts";
import type { UserTier } from "../user/user.entity.ts";
import type {
  CreateProfileData,
  PermissionRepository,
  UpdateProfileData,
} from "./permission.repository.ts";
import type {
  PermissionProfile,
  ResolvedPermissions,
} from "./permission.entity.ts";
import type {
  PaginatedResult,
  PaginationParams,
} from "../../shared/utils/pagination.ts";


/** Cache TTL = 5 phút — ngắn để đảm bảo revoke quyền có hiệu lực sớm */
const CACHE_TTL_SECONDS = 300;

/** Cache key versioned — dễ invalidate toàn bộ khi đổi schema */
const cacheKey = (userId: string) => `perm:v1:${userId}`;

export class PermissionService {
  constructor(private repo: PermissionRepository) {}

  // ─────────────────────────────────────────────
  // CORE: Resolve & Cache permissions
  // ─────────────────────────────────────────────

  /**
   * Resolve toàn bộ quyền của user và cache vào Redis.
   * - OWNER: trả về empty ResolvedPermissions (bypass mọi check)
   * - ADMIN/USER: tổng hợp từ profiles + individual overrides
   *
   * Luồng:
   *   1. Thử đọc từ Redis cache
   *   2. Cache miss → query DB → ghi cache
   *   3. Trả về ResolvedPermissions (dùng Set để O(1) lookup)
   */
  async resolvePermissions(
    userId: string,
    tier: UserTier,
  ): Promise<ResolvedPermissions> {
    // OWNER không cần load permission gì cả
    if (tier === "owner") {
      return { userId, tier, granted: new Set(), denied: new Set() };
    }

    // Thử cache
    if (redisClient) {
      try {
        const cached = await redisClient.get(cacheKey(userId));
        if (cached) {
          const parsed = JSON.parse(cached) as {
            granted: string[];
            denied: string[];
          };
          return {
            userId,
            tier,
            granted: new Set(parsed.granted),
            denied: new Set(parsed.denied),
          };
        }
      } catch {
        // Cache lỗi → fallback DB
        logger.warn(`⚠️ [Permission] Redis cache miss for user ${userId}`);
      }
    }

    // Cache miss: query DB
    const rows = await this.repo.resolveForUser(userId);

    const granted = new Set<string>();
    const denied = new Set<string>();
    for (const row of rows) {
      if (row.granted) granted.add(row.permission_code);
      else denied.add(row.permission_code);
    }

    // Ghi cache
    if (redisClient) {
      try {
        await redisClient.set(
          cacheKey(userId),
          JSON.stringify({
            granted: Array.from(granted),
            denied: Array.from(denied),
          }),
          { ex: CACHE_TTL_SECONDS },
        );
      } catch {
        // Cache write fail không phải lỗi nghiêm trọng
      }
    }

    return { userId, tier, granted, denied };
  }

  /**
   * Invalidate cache của 1 user — gọi khi:
   *   - Assign/revoke profile
   *   - Set/remove individual override
   *   - Profile bị update hoặc deactivate
   */
  async invalidateCache(userId: string): Promise<void> {
    if (!redisClient) return;
    try {
      await redisClient.del(cacheKey(userId));
    } catch {
      // Ignore
    }
  }

  /**
   * Kiểm tra 1 permission cụ thể trong ResolvedPermissions đã có sẵn.
   * Thứ tự ưu tiên:
   *   1. OWNER → luôn true
   *   2. denied set → false (tường minh cấm)
   *   3. granted set → true
   *   4. Mặc định → false (deny-by-default)
   */
  hasPermission(resolved: ResolvedPermissions, code: string): boolean {
    if (resolved.tier === "owner") return true;
    if (resolved.denied.has(code)) return false;
    return resolved.granted.has(code);
  }

  // ─────────────────────────────────────────────
  // PERMISSION PROFILES (Admin quản lý)
  // ─────────────────────────────────────────────

  async findManyProfiles(
    params: PaginationParams,
    tier?: "admin" | "user",
  ): Promise<PaginatedResult<PermissionProfile>> {
    return await this.repo.findManyProfiles(params, tier);
  }

  async findProfileById(id: string): Promise<PermissionProfile> {
    const profile = await this.repo.findProfileById(id);
    if (!profile) throw AppError.notFound(`Permission profile ${id} not found`);
    return profile;
  }

  async createProfile(
    data: CreateProfileData,
    actorId: string,
  ): Promise<PermissionProfile> {
    const profile = await this.repo.createProfile(data);

    await AuditService.log({
      actorId,
      action: "permission.profile_created",
      targetType: "permission_profile",
      targetId: profile.id,
      metadata: { name: data.name, tier: data.tier },
    });

    return profile;
  }

  async updateProfile(
    id: string,
    data: UpdateProfileData,
    actorId: string,
  ): Promise<PermissionProfile> {
    const profile = await this.repo.updateProfile(id, data);
    if (!profile) throw AppError.notFound(`Permission profile ${id} not found`);

    await AuditService.log({
      actorId,
      action: "permission.profile_updated",
      targetType: "permission_profile",
      targetId: id,
    });

    return profile;
  }

  async deleteProfile(id: string, actorId: string): Promise<void> {
    const deleted = await this.repo.deleteProfile(id);
    if (!deleted) throw AppError.notFound(`Permission profile ${id} not found`);

    await AuditService.log({
      actorId,
      action: "permission.profile_deleted",
      targetType: "permission_profile",
      targetId: id,
    });
  }

  // ─────────────────────────────────────────────
  // USER ↔ PROFILES
  // ─────────────────────────────────────────────

  /**
   * Assign profile cho user — tự động kiểm tra tier compatibility.
   * ADMIN chỉ nhận profile tier="admin", USER chỉ nhận tier="user".
   * Service tự lookup role từ DB để route handler không cần biết.
   */
  async assignProfile(
    userId: string,
    profileId: string,
    actorId: string,
  ): Promise<void> {
    const userInfo = await this.repo.findUserRole(userId);
    if (!userInfo) {
      throw AppError.notFound(`User ${userId} không tồn tại.`);
    }
    if (userInfo.tier === "owner") {
      throw AppError.badRequest("OWNER không cần permission profile.");
    }

    const profile = await this.findProfileById(profileId);

    if (!profile.active) {
      throw AppError.badRequest(
        `Profile "${profile.name}" đang bị vô hiệu hóa.`,
      );
    }

    // So sánh tier của profile với tier của user
    if (profile.tier !== userInfo.tier) {
      throw AppError.badRequest(
        `Profile tier "${profile.tier}" không khớp với user tier "${userInfo.tier}" (role: "${userInfo.role}").`,
      );
    }

    await this.repo.assignProfileToUser(userId, profileId, actorId);
    await this.invalidateCache(userId);

    await AuditService.log({
      actorId,
      action: "permission.user_profile_assigned",
      targetType: "user",
      targetId: userId,
      metadata: { profileId, profileName: profile.name },
    });
  }


  async revokeProfile(
    userId: string,
    profileId: string,
    actorId: string,
  ): Promise<void> {
    const revoked = await this.repo.revokeProfileFromUser(userId, profileId);
    if (!revoked) {
      throw AppError.notFound(
        `User không có profile này hoặc profile không tồn tại.`,
      );
    }
    await this.invalidateCache(userId);

    await AuditService.log({
      actorId,
      action: "permission.user_profile_revoked",
      targetType: "user",
      targetId: userId,
      metadata: { profileId },
    });
  }

  // ─────────────────────────────────────────────
  // INDIVIDUAL OVERRIDES
  // ─────────────────────────────────────────────

  async setOverride(
    userId: string,
    permissionCode: string,
    granted: boolean,
    actorId: string,
  ): Promise<void> {
    await this.repo.setUserPermission(userId, permissionCode, granted, actorId);
    await this.invalidateCache(userId);

    await AuditService.log({
      actorId,
      action: "permission.user_override_set",
      targetType: "user",
      targetId: userId,
      metadata: { permissionCode, granted },
    });
  }

  async removeOverride(
    userId: string,
    permissionCode: string,
    actorId: string,
  ): Promise<void> {
    const removed = await this.repo.removeUserPermission(userId, permissionCode);
    if (!removed) {
      throw AppError.notFound(
        `Override cho permission "${permissionCode}" không tồn tại.`,
      );
    }
    await this.invalidateCache(userId);

    await AuditService.log({
      actorId,
      action: "permission.user_override_removed",
      targetType: "user",
      targetId: userId,
      metadata: { permissionCode },
    });
  }

  // ─────────────────────────────────────────────
  // CONVENIENCE — Delegate trực tiếp xuống repo
  // ─────────────────────────────────────────────

  /** Lấy toàn bộ atomic permission codes (developer-seeded) */
  async findAllPermissions() {
    return await this.repo.findAllPermissions();
  }

  /** Lấy permissions bên trong 1 profile cụ thể */
  async findProfilePermissions(profileId: string) {
    return await this.repo.findProfilePermissions(profileId);
  }

  /** Lấy danh sách profiles đang assign cho user */
  async findUserProfiles(userId: string) {
    return await this.repo.findUserProfiles(userId);
  }

  /** Lấy toàn bộ individual overrides của user */
  async findUserOverrides(userId: string) {
    return await this.repo.findUserPermissions(userId);
  }

  /** Xóa 1 permission khỏi profile */
  async removeProfilePermission(
    profileId: string,
    permissionCode: string,
  ): Promise<void> {
    const removed = await this.repo.removeProfilePermission(
      profileId,
      permissionCode,
    );
    if (!removed) {
      throw AppError.notFound(
        `Permission "${permissionCode}" không có trong profile này.`,
      );
    }
  }

  /** Set (upsert) 1 permission vào profile */
  async setProfilePermission(
    profileId: string,
    permissionCode: string,
    granted: boolean,
  ): Promise<void> {
    // Kiểm tra profile tồn tại trước
    await this.findProfileById(profileId);
    await this.repo.setProfilePermission(profileId, permissionCode, granted);
  }
}

