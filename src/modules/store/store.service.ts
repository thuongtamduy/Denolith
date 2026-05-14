import { Prisma, type PrismaClient } from "@db";
import { AppError } from "../../shared/errors/AppError.ts";
import { AuditService } from "../../core/audit.ts";
import type { PaginationParams } from "../../shared/utils/pagination.ts";
import type { CreateStoreInput, UpdateStoreInput } from "./store.validation.ts";

export class StoreService {
  constructor(private prisma: PrismaClient) {}

  async findMany(params: PaginationParams) {
    const { page, limit } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.StoreWhereInput = { deleted: false };

    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: "insensitive" } },
        { code: { contains: params.search, mode: "insensitive" } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.store.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.store.count({ where }),
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
    const store = await this.prisma.store.findFirst({
      where: { id, deleted: false },
    });

    if (!store) throw AppError.notFound(`Store with id ${id} not found`);
    return store;
  }

  async create(data: CreateStoreInput, actorId?: string) {
    return await this.prisma.$transaction(async (tx) => {
      const existing = await tx.store.findUnique({
        where: { code: data.code },
      });
      if (existing) throw AppError.conflict("Store code already exists");

      const store = await tx.store.create({
        data: {
          code: data.code,
          name: data.name,
          latitude: data.latitude,
          longitude: data.longitude,
          metadata: data.metadata
            ? (data.metadata as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          workingHours: data.workingHours
            ? (data.workingHours as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          status: data.status,
        },
      });

      await AuditService.log({
        actorId,
        action: "store.create",
        targetType: "store",
        targetId: store.id,
      });

      return store;
    });
  }

  async update(id: string, data: UpdateStoreInput, actorId?: string) {
    return await this.prisma.$transaction(async (tx) => {
      const store = await tx.store.findFirst({ where: { id, deleted: false } });
      if (!store) throw AppError.notFound(`Store with id ${id} not found`);

      if (data.code && data.code !== store.code) {
        const existing = await tx.store.findUnique({
          where: { code: data.code },
        });
        if (existing) throw AppError.conflict("Store code already exists");
      }

      const updatedStore = await tx.store.update({
        where: { id },
        data: {
          code: data.code,
          name: data.name,
          latitude: data.latitude,
          longitude: data.longitude,
          metadata: data.metadata !== undefined
            ? (data.metadata as Prisma.InputJsonValue)
            : undefined,
          workingHours: data.workingHours !== undefined
            ? (data.workingHours as Prisma.InputJsonValue)
            : undefined,
          status: data.status,
        },
      });

      await AuditService.log({
        actorId,
        action: "store.update",
        targetType: "store",
        targetId: store.id,
      });

      return updatedStore;
    });
  }

  async softDelete(id: string, actorId?: string) {
    try {
      const store = await this.prisma.store.update({
        where: { id, deleted: false },
        data: { deleted: true, deletedAt: new Date() },
      });

      await AuditService.log({
        actorId,
        action: "store.soft_delete",
        targetType: "store",
        targetId: id,
      });

      return store;
    } catch (_error) {
      throw AppError.notFound(`Store with id ${id} not found`);
    }
  }

  async restore(id: string, actorId?: string) {
    try {
      const store = await this.prisma.store.update({
        where: { id, deleted: true },
        data: { deleted: false, deletedAt: null },
      });

      await AuditService.log({
        actorId,
        action: "store.restore",
        targetType: "store",
        targetId: id,
      });

      return store;
    } catch (_error) {
      throw AppError.notFound(
        `Store with id ${id} not found or is not deleted`,
      );
    }
  }

  async hardDelete(id: string, actorId?: string): Promise<void> {
    try {
      await this.prisma.store.delete({
        where: { id, deleted: true },
      });

      await AuditService.log({
        actorId,
        action: "store.hard_delete",
        targetType: "store",
        targetId: id,
      });
    } catch (_error) {
      throw AppError.notFound(
        `Store with id ${id} not found or must be soft-deleted first`,
      );
    }
  }
}
