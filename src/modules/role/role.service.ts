import type { PrismaClient } from "@db";
import { AppError } from "../../shared/errors/AppError.ts";
import { AuditService } from "../../core/audit.ts";
import type { PaginationParams } from "../../shared/utils/pagination.ts";
import type { CreateRoleInput, UpdateRoleInput } from "./role.validation.ts";

export class RoleService {
  constructor(private prisma: PrismaClient) {}

  async findMany(params: PaginationParams) {
    const { page, limit } = params;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.role.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.role.count(),
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

  async findByCode(code: string) {
    const role = await this.prisma.role.findUnique({ where: { code } });
    if (!role) {
      throw AppError.notFound(`Role '${code}' not found.`);
    }
    return role;
  }

  async create(data: CreateRoleInput, actorId?: string) {
    const existing = await this.prisma.role.findUnique({
      where: { code: data.code },
    });
    if (existing) {
      throw AppError.conflict(`Role code '${data.code}' already exists.`);
    }

    const role = await this.prisma.role.create({
      data: {
        code: data.code,
        tier: data.tier,
        name: data.name,
        description: data.description,
      },
    });

    await AuditService.log({
      actorId,
      action: "role.create",
      targetType: "role",
      targetId: role.code,
      metadata: { newRole: role },
    });

    return role;
  }

  async update(
    code: string,
    data: UpdateRoleInput,
    actorId?: string,
  ) {
    const existing = await this.prisma.role.findUnique({ where: { code } });
    if (!existing) {
      throw AppError.notFound(`Role '${code}' not found.`);
    }

    if (existing.system) {
      throw AppError.forbidden(`Cannot update system role '${code}'.`);
    }

    const updated = await this.prisma.role.update({
      where: { code },
      data: {
        name: data.name,
        description: data.description,
        active: data.active,
      },
    });

    await AuditService.log({
      actorId,
      action: "role.update",
      targetType: "role",
      targetId: code,
      metadata: { old: existing, new: updated },
    });

    return updated;
  }

  async delete(code: string, actorId?: string): Promise<void> {
    const existing = await this.prisma.role.findUnique({ where: { code } });
    if (!existing) {
      throw AppError.notFound(`Role '${code}' not found.`);
    }

    if (existing.system) {
      throw AppError.forbidden(`Cannot delete system role '${code}'.`);
    }

    try {
      await this.prisma.role.delete({ where: { code } });
    } catch (err: unknown) {
      // Prisma error code for foreign key violation: P2003
      if ((err as { code?: string }).code === "P2003") {
        throw AppError.conflict(
          `Cannot delete role '${code}' because it is still assigned to users.`,
        );
      }
      throw err;
    }

    await AuditService.log({
      actorId,
      action: "role.delete",
      targetType: "role",
      targetId: code,
      metadata: { role: existing },
    });
  }
}
