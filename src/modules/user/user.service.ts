import type { Prisma, PrismaClient } from "@db";
import { AppError } from "../../shared/errors/AppError.ts";
import { AuditService } from "../../core/audit.ts";
import { hashPassword } from "../../shared/utils/hash.ts";
import type { PaginationParams } from "../../shared/utils/pagination.ts";

export class UserService {
  constructor(private prisma: PrismaClient) {}

  async findMany(params: PaginationParams) {
    const { page, limit } = params;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where: { deleted: false },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          username: true,
          email: true,
          roleCode: true,
          firstName: true,
          lastName: true,
          displayName: true,
          avatar: true,
          dateOfBirth: true,
          gender: true,
          bio: true,
          phone: true,
          phoneVerified: true,
          emailVerified: true,
          address: true,
          city: true,
          country: true,
          lastLoginAt: true,
          lastLoginIp: true,
          active: true,
          createdAt: true,
          updatedAt: true,
          role: { select: { tier: true } },
        },
      }),
      this.prisma.user.count({ where: { deleted: false } }),
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

  async findById(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deleted: false },
      include: {
        role: { select: { tier: true } },
        userStores: {
          include: {
            store: {
              select: {
                id: true,
                code: true,
                name: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!user) throw AppError.notFound(`User with id ${id} not found`);
    return user;
  }

  async create(data: Prisma.UserCreateInput) {
    return await this.prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({
        where: { email: data.email },
      });
      if (existing) throw AppError.conflict("Email already exists");

      const hashedPassword = await hashPassword(data.password);

      return await tx.user.create({
        data: {
          ...data,
          password: hashedPassword,
        },
        include: { role: { select: { tier: true } } },
      });
    });
  }

  async update(id: string, data: Prisma.UserUpdateInput) {
    try {
      const user = await this.prisma.user.update({
        where: { id, deleted: false },
        data,
      });
      return user;
    } catch (error: unknown) {
      // P2025 = Record to update not found
      if ((error as { code?: string }).code === "P2025") {
        throw AppError.notFound(`User with id ${id} not found`);
      }
      throw error;
    }
  }

  async updateRole(
    id: string,
    roleCode: string,
    actorId?: string,
  ) {
    try {
      const user = await this.prisma.user.update({
        where: { id, deleted: false },
        data: { roleCode },
        include: { role: { select: { tier: true } } },
      });

      await AuditService.log({
        actorId,
        action: "user.update_role",
        targetType: "user",
        targetId: id,
        metadata: { roleCode },
      });

      return user;
    } catch (_err) {
      throw AppError.badRequest(
        `Role '${roleCode}' does not exist or user not found.`,
      );
    }
  }

  async assignStores(userId: string, storeIds: string[], actorId?: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deleted: false },
    });
    if (!user) throw AppError.notFound(`User with id ${userId} not found`);

    const existingStores = await this.prisma.store.findMany({
      where: { id: { in: storeIds }, deleted: false },
      select: { id: true },
    });
    const validStoreIds = existingStores.map((s) => s.id);

    if (validStoreIds.length === 0) {
      throw AppError.badRequest(
        "None of the provided store IDs are valid or exist.",
      );
    }

    const existingAssignments = await this.prisma.userStore.findMany({
      where: { userId, storeId: { in: validStoreIds } },
      select: { storeId: true },
    });
    const assignedStoreIds = new Set(
      existingAssignments.map((ea) => ea.storeId),
    );

    const newStoreIds = validStoreIds.filter((id) => !assignedStoreIds.has(id));

    if (newStoreIds.length === 0) {
      return {
        count: 0,
        message: "All valid stores provided are already assigned to this user",
      };
    }

    const dataToInsert = newStoreIds.map((storeId) => ({
      userId,
      storeId,
    }));

    const result = await this.prisma.userStore.createMany({
      data: dataToInsert,
      skipDuplicates: true,
    });

    await AuditService.log({
      actorId,
      action: "user.assign_stores",
      targetType: "user",
      targetId: userId,
      metadata: { assignedStoreIds: newStoreIds },
    });

    return { count: result.count, assigned: newStoreIds };
  }

  async unassignStores(userId: string, storeIds: string[], actorId?: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deleted: false },
    });
    if (!user) throw AppError.notFound(`User with id ${userId} not found`);

    if (storeIds.length === 0) {
      return { count: 0, message: "No store IDs provided" };
    }

    const result = await this.prisma.userStore.deleteMany({
      where: {
        userId,
        storeId: { in: storeIds },
      },
    });

    if (result.count > 0) {
      await AuditService.log({
        actorId,
        action: "user.unassign_stores",
        targetType: "user",
        targetId: userId,
        metadata: { unassignedStoreIds: storeIds },
      });
    }

    return {
      count: result.count,
      message: `Successfully unassigned ${result.count} store(s)`,
    };
  }

  async softDelete(id: string) {
    try {
      return await this.prisma.user.update({
        where: { id, deleted: false },
        data: { deleted: true, deletedAt: new Date() },
      });
    } catch (_error) {
      throw AppError.notFound(`User with id ${id} not found`);
    }
  }

  async restore(id: string) {
    try {
      return await this.prisma.user.update({
        where: { id, deleted: true },
        data: { deleted: false, deletedAt: null },
      });
    } catch (_error) {
      throw AppError.notFound(`User with id ${id} not found or is not deleted`);
    }
  }

  async hardDelete(id: string): Promise<void> {
    try {
      await this.prisma.user.delete({
        where: { id, deleted: true },
      });
    } catch (_error) {
      throw AppError.notFound(
        `User with id ${id} not found or must be soft-deleted first`,
      );
    }
  }
}
