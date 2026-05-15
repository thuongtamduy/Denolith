import { redisClient } from "../../core/redis.ts";
import { logger } from "../../core/logger.ts";
import { AppError } from "../../shared/errors/AppError.ts";
import { AuditService } from "../../core/audit.ts";
import type { PrismaClient } from "@db";
import type { PaginationParams } from "../../shared/utils/pagination.ts";
import type {
  CreateProfileInput,
  UpdateProfileInput,
} from "./permission.validation.ts";

import type { ResolvedPermissions, UserTier } from "../../core/context.ts";
export type { ResolvedPermissions, UserTier };

const CACHE_TTL_SECONDS = 300;
const cacheKey = (userId: string) => `perm:v1:${userId}`;

export class PermissionService {
  constructor(private prisma: PrismaClient) {}

  async resolvePermissions(
    userId: string,
    tier: UserTier,
  ): Promise<ResolvedPermissions> {
    if (tier === "owner") {
      return { userId, tier, granted: new Set(), denied: new Set() };
    }

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
        logger.warn(`⚠️ [Permission] Redis cache miss for user ${userId}`);
      }
    }

    // Resolve via Prisma
    // Fetch profile permissions
    const userProfiles = await this.prisma.userProfile.findMany({
      where: { userId, profile: { active: true } },
      include: { profile: { include: { profilePermissions: true } } },
    });

    const profilePerms = userProfiles.flatMap((up) =>
      up.profile.profilePermissions
    );

    // Fetch individual overrides
    const userOverrides = await this.prisma.userPermission.findMany({
      where: { userId },
    });

    const granted = new Set<string>();
    const denied = new Set<string>();

    // 1. Apply profile permissions first
    for (const p of profilePerms) {
      if (p.granted) granted.add(p.permissionCode);
      else denied.add(p.permissionCode);
    }

    // 2. Overrides have higher precedence
    for (const o of userOverrides) {
      if (o.granted) {
        granted.add(o.permissionCode);
        denied.delete(o.permissionCode);
      } else {
        denied.add(o.permissionCode);
        granted.delete(o.permissionCode);
      }
    }

    if (redisClient) {
      try {
        await redisClient.set(
          cacheKey(userId),
          JSON.stringify({
            granted: Array.from(granted),
            denied: Array.from(denied),
          }),
          { EX: CACHE_TTL_SECONDS },
        );
      } catch {
        // Ignore
      }
    }

    return { userId, tier, granted, denied };
  }

  async invalidateCache(userId: string): Promise<void> {
    if (!redisClient) return;
    try {
      await redisClient.del(cacheKey(userId));
    } catch {
      // Ignore
    }
  }

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
  ) {
    const { page, limit } = params;
    const skip = (page - 1) * limit;

    const where = tier ? { tier } : {};

    const [data, total] = await Promise.all([
      this.prisma.permissionProfile.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.permissionProfile.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findProfileById(id: string) {
    const profile = await this.prisma.permissionProfile.findUnique({
      where: { id },
    });
    if (!profile) throw AppError.notFound(`Permission profile ${id} not found`);
    return profile;
  }

  async createProfile(
    data: CreateProfileInput,
    actorId: string,
  ) {
    const profile = await this.prisma.permissionProfile.create({
      data: {
        name: data.name,
        tier: data.tier,
        description: data.description,
      },
    });

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
    data: UpdateProfileInput,
    actorId: string,
  ) {
    const existing = await this.prisma.permissionProfile.findUnique({
      where: { id },
    });
    if (!existing) {
      throw AppError.notFound(`Permission profile ${id} not found`);
    }

    const profile = await this.prisma.permissionProfile.update({
      where: { id },
      data: {
        name: data.name,
        tier: data.tier,
        description: data.description,
        active: data.active,
      },
    });

    await AuditService.log({
      actorId,
      action: "permission.profile_updated",
      targetType: "permission_profile",
      targetId: id,
    });

    return profile;
  }

  async deleteProfile(id: string, actorId: string): Promise<void> {
    try {
      await this.prisma.permissionProfile.delete({ where: { id } });
    } catch (_error) {
      throw AppError.notFound(`Permission profile ${id} not found`);
    }

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

  async assignProfile(
    userId: string,
    profileId: string,
    actorId: string,
  ): Promise<void> {
    const userInfo = await this.prisma.user.findUnique({
      where: { id: userId, deleted: false },
      include: { role: { select: { tier: true } } },
    });

    if (!userInfo) {
      throw AppError.notFound(`User ${userId} not found.`);
    }
    if (userInfo.role.tier === "owner") {
      throw AppError.badRequest("OWNER does not require a permission profile.");
    }

    const profile = await this.findProfileById(profileId);

    if (!profile.active) {
      throw AppError.badRequest(
        `Profile "${profile.name}" is currently inactive.`,
      );
    }

    if (profile.tier !== userInfo.role.tier) {
      throw AppError.badRequest(
        `Profile tier "${profile.tier}" does not match user tier "${userInfo.role.tier}" (role: "${userInfo.roleCode}").`,
      );
    }

    await this.prisma.userProfile.upsert({
      where: { userId_profileId: { userId, profileId } },
      create: { userId, profileId, assignedBy: actorId },
      update: { assignedAt: new Date(), assignedBy: actorId },
    });

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
    try {
      await this.prisma.userProfile.delete({
        where: { userId_profileId: { userId, profileId } },
      });
    } catch {
      throw AppError.notFound("Profile assignment not found for this user.");
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
    await this.prisma.userPermission.upsert({
      where: { userId_permissionCode: { userId, permissionCode } },
      create: { userId, permissionCode, granted, assignedBy: actorId },
      update: { granted, assignedAt: new Date(), assignedBy: actorId },
    });

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
    try {
      await this.prisma.userPermission.delete({
        where: { userId_permissionCode: { userId, permissionCode } },
      });
    } catch {
      throw AppError.notFound(
        `Override for permission "${permissionCode}" does not exist.`,
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
  // CONVENIENCE
  // ─────────────────────────────────────────────

  async findAllPermissions() {
    return await this.prisma.permission.findMany({
      orderBy: { code: "asc" },
    });
  }

  async findProfilePermissions(profileId: string) {
    return await this.prisma.profilePermission.findMany({
      where: { profileId },
      include: { permission: true },
    });
  }

  async findUserProfiles(userId: string) {
    return await this.prisma.userProfile.findMany({
      where: { userId },
      include: { profile: true },
    });
  }

  async findUserOverrides(userId: string) {
    return await this.prisma.userPermission.findMany({
      where: { userId },
      include: { permission: true },
    });
  }

  async removeProfilePermission(
    profileId: string,
    permissionCode: string,
  ): Promise<void> {
    try {
      await this.prisma.profilePermission.delete({
        where: { profileId_permissionCode: { profileId, permissionCode } },
      });
    } catch {
      throw AppError.notFound(
        `Permission "${permissionCode}" does not exist in this profile.`,
      );
    }
  }

  async setProfilePermission(
    profileId: string,
    permissionCode: string,
    granted: boolean,
  ): Promise<void> {
    await this.findProfileById(profileId);
    await this.prisma.profilePermission.upsert({
      where: { profileId_permissionCode: { profileId, permissionCode } },
      create: { profileId, permissionCode, granted },
      update: { granted },
    });
  }
}
