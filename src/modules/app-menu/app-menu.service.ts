import type { PrismaClient } from "@db";
import { AppError } from "../../shared/errors/AppError.ts";
import { AuditService } from "../../core/audit.ts";
import type { PaginationParams } from "../../shared/utils/pagination.ts";
import { isUuid } from "../../shared/utils/uuid.ts";
import type {
  CreateAppMenuInput,
  UpdateAppMenuInput,
} from "./app-menu.validation.ts";

export class AppMenuService {
  constructor(private prisma: PrismaClient) {}

  private async findExistingByIdOrCode(idOrCode: string) {
    const where = isUuid(idOrCode) ? { id: idOrCode } : { code: idOrCode };
    return await this.prisma.appMenu.findUnique({ where });
  }

  async findMany(
    params: PaginationParams & { storeId?: string; lang?: string },
  ) {
    const { page, limit, search, storeId, lang } = params;
    const skip = (page - 1) * limit;

    const where = {
      ...(search
        ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { code: { contains: search, mode: "insensitive" as const } },
          ],
        }
        : {}),
      ...(storeId ? { storeId } : {}),
      ...(lang ? { lang } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.appMenu.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.appMenu.count({ where }),
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
    const menu = await this.prisma.appMenu.findUnique({ where: { code } });
    if (!menu) {
      throw AppError.notFound(`App menu '${code}' not found.`);
    }
    return menu;
  }

  async findById(id: string) {
    const menu = await this.prisma.appMenu.findUnique({ where: { id } });
    if (!menu) {
      throw AppError.notFound(`App menu '${id}' not found.`);
    }
    return menu;
  }

  async create(data: CreateAppMenuInput, actorId?: string) {
    const existing = await this.prisma.appMenu.findUnique({
      where: { code: data.code },
    });
    if (existing) {
      throw AppError.conflict(`App menu code '${data.code}' already exists.`);
    }

    const menu = await this.prisma.appMenu.create({
      data: {
        code: data.code,
        lang: data.lang ?? "vi",
        name: data.name,
        data: data.data,
        storeId: data.storeId,
      },
    });

    await AuditService.log({
      actorId,
      action: "app_menu.create",
      targetType: "app_menu",
      targetId: menu.id,
      metadata: { code: menu.code, name: menu.name },
    });

    return menu;
  }

  async update(idOrCode: string, data: UpdateAppMenuInput, actorId?: string) {
    const existing = await this.findExistingByIdOrCode(idOrCode);
    if (!existing) {
      throw AppError.notFound(`App menu '${idOrCode}' not found.`);
    }

    const updated = await this.prisma.appMenu.update({
      where: { id: existing.id },
      data: {
        ...(data.lang !== undefined ? { lang: data.lang } : {}),
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.data !== undefined ? { data: data.data } : {}),
        ...(data.storeId !== undefined ? { storeId: data.storeId } : {}),
        ...(data.active !== undefined ? { active: data.active } : {}),
      },
    });

    await AuditService.log({
      actorId,
      action: "app_menu.update",
      targetType: "app_menu",
      targetId: existing.id,
      metadata: { old: { name: existing.name }, new: { name: updated.name } },
    });

    return updated;
  }

  async delete(idOrCode: string, actorId?: string): Promise<void> {
    const existing = await this.findExistingByIdOrCode(idOrCode);
    if (!existing) {
      throw AppError.notFound(`App menu '${idOrCode}' not found.`);
    }

    await this.prisma.appMenu.delete({ where: { id: existing.id } });

    await AuditService.log({
      actorId,
      action: "app_menu.delete",
      targetType: "app_menu",
      targetId: existing.id,
      metadata: { code: existing.code, name: existing.name },
    });
  }
}
