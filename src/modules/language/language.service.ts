import type { PrismaClient } from "@db";
import { AppError } from "../../shared/errors/AppError.ts";
import { AuditService } from "../../core/audit.ts";
import type { PaginationParams } from "../../shared/utils/pagination.ts";
import type {
  CreateLanguageInput,
  UpdateLanguageInput,
} from "./language.validation.ts";

export class LanguageService {
  constructor(private prisma: PrismaClient) {}

  async findMany(params: PaginationParams) {
    const { page, limit } = params;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.language.findMany({
        skip,
        take: limit,
        orderBy: { code: "asc" },
      }),
      this.prisma.language.count(),
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

  async findActive() {
    return await this.prisma.language.findMany({
      where: { active: true },
      orderBy: { code: "asc" },
    });
  }

  async findByCode(code: string) {
    const lang = await this.prisma.language.findUnique({ where: { code } });
    if (!lang) {
      throw AppError.notFound(`Language '${code}' not found.`);
    }
    return lang;
  }

  async create(data: CreateLanguageInput, actorId?: string) {
    const existing = await this.prisma.language.findUnique({
      where: { code: data.code },
    });
    if (existing) {
      throw AppError.conflict(`Language code '${data.code}' already exists.`);
    }

    if (data.isDefault && data.active === false) {
      throw AppError.badRequest("Default language must be active.");
    }

    if (data.isDefault) {
      await this.prisma.language.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const lang = await this.prisma.language.create({
      data: {
        code: data.code,
        name: data.name,
        active: data.active ?? true,
        isDefault: data.isDefault ?? false,
      },
    });

    await AuditService.log({
      actorId,
      action: "language.create",
      targetType: "language",
      targetId: lang.id,
      metadata: { newLanguage: lang },
    });

    return lang;
  }

  async update(code: string, data: UpdateLanguageInput, actorId?: string) {
    const existing = await this.prisma.language.findUnique({
      where: { code },
    });
    if (!existing) {
      throw AppError.notFound(`Language '${code}' not found.`);
    }

    const nextDefault = data.isDefault !== undefined
      ? data.isDefault
      : existing.isDefault;
    const nextActive = data.active !== undefined
      ? data.active
      : existing.active;

    if (nextDefault && !nextActive) {
      throw AppError.badRequest("Default language must remain active.");
    }

    if (data.isDefault) {
      await this.prisma.language.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const updated = await this.prisma.language.update({
      where: { code },
      data: {
        name: data.name,
        active: data.active,
        isDefault: data.isDefault,
      },
    });

    await AuditService.log({
      actorId,
      action: "language.update",
      targetType: "language",
      targetId: code,
      metadata: { old: existing, new: updated },
    });

    return updated;
  }

  async delete(code: string, actorId?: string): Promise<void> {
    const existing = await this.prisma.language.findUnique({
      where: { code },
    });
    if (!existing) {
      throw AppError.notFound(`Language '${code}' not found.`);
    }

    if (existing.isDefault) {
      throw AppError.forbidden(`Cannot delete default language '${code}'.`);
    }

    try {
      await this.prisma.language.delete({ where: { code } });
    } catch (err: unknown) {
      if ((err as { code?: string }).code === "P2003") {
        throw AppError.conflict(
          `Cannot delete language '${code}' because it is still used in translations.`,
        );
      }
      throw err;
    }

    await AuditService.log({
      actorId,
      action: "language.delete",
      targetType: "language",
      targetId: code,
      metadata: { language: existing },
    });
  }
}
