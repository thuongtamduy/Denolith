import type { PrismaClient } from "@db";
import { AppError } from "../../shared/errors/AppError.ts";
import { AuditService } from "../../core/audit.ts";
import type { PaginationParams } from "../../shared/utils/pagination.ts";
import { isUuid } from "../../shared/utils/uuid.ts";
import type {
  CreateAppMenuInput,
  CreateAppMenuTranslationInput,
  UpdateAppMenuInput,
} from "./app-menu.validation.ts";

export class AppMenuService {
  constructor(private prisma: PrismaClient) {}

  async findMany(
    params: PaginationParams & { storeId?: string | null; lang?: string },
  ) {
    const { page, limit, search, storeId, lang = "vi" } = params;
    const skip = (page - 1) * limit;

    const where = {
      ...(search
        ? {
          OR: [
            { code: { contains: search, mode: "insensitive" as const } },
            {
              translations: {
                some: {
                  name: { contains: search, mode: "insensitive" as const },
                },
              },
            },
          ],
        }
        : {}),
      storeId: storeId ?? null,
    };

    const [rawMenus, total] = await Promise.all([
      this.prisma.appMenu.findMany({
        where,
        skip,
        take: limit,
        include: {
          translations: {
            where: {
              OR: [
                { lang },
                { isLangRef: false }, // Fallback to original language
              ],
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.appMenu.count({ where }),
    ]);

    // Map each menu to extract the correct translation matching requested lang,
    // or fallback to the original/default translation.
    const data = rawMenus.map((menu) => {
      let translation = menu.translations.find((t) => t.lang === lang);
      if (!translation && menu.translations.length > 0) {
        // Fallback to original/default translation
        translation = menu.translations.find((t) => !t.isLangRef) ||
          menu.translations[0];
      }

      return {
        id: menu.id,
        code: menu.code,
        storeId: menu.storeId,
        active: menu.active,
        createdAt: menu.createdAt,
        createdBy: menu.createdBy,
        updatedAt: menu.updatedAt,
        updatedBy: menu.updatedBy,
        name: translation?.name ?? "",
        data: translation?.data ?? "[]",
        lang: translation?.lang ?? "",
      };
    });

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

  async findByCode(code: string, storeId?: string | null, lang: string = "vi") {
    const menu = await this.prisma.appMenu.findFirst({
      where: { code, storeId: storeId ?? null },
      include: {
        translations: {
          where: {
            OR: [
              { lang },
              { isLangRef: false },
            ],
          },
        },
      },
    });

    if (!menu) {
      throw AppError.notFound(`App menu '${code}' not found.`);
    }

    let translation = menu.translations.find((t) => t.lang === lang);
    if (!translation && menu.translations.length > 0) {
      translation = menu.translations.find((t) => !t.isLangRef) ||
        menu.translations[0];
    }

    return {
      id: menu.id,
      code: menu.code,
      storeId: menu.storeId,
      active: menu.active,
      createdAt: menu.createdAt,
      createdBy: menu.createdBy,
      updatedAt: menu.updatedAt,
      updatedBy: menu.updatedBy,
      name: translation?.name ?? "",
      data: translation?.data ?? "[]",
      lang: translation?.lang ?? "",
    };
  }

  async findById(id: string, lang: string = "vi") {
    const menu = await this.prisma.appMenu.findUnique({
      where: { id },
      include: {
        translations: {
          where: {
            OR: [
              { lang },
              { isLangRef: false },
            ],
          },
        },
      },
    });

    if (!menu) {
      throw AppError.notFound(`App menu '${id}' not found.`);
    }

    let translation = menu.translations.find((t) => t.lang === lang);
    if (!translation && menu.translations.length > 0) {
      translation = menu.translations.find((t) => !t.isLangRef) ||
        menu.translations[0];
    }

    return {
      id: menu.id,
      code: menu.code,
      storeId: menu.storeId,
      active: menu.active,
      createdAt: menu.createdAt,
      createdBy: menu.createdBy,
      updatedAt: menu.updatedAt,
      updatedBy: menu.updatedBy,
      name: translation?.name ?? "",
      data: translation?.data ?? "[]",
      lang: translation?.lang ?? "",
    };
  }

  async findAllTranslations(idOrCode: string, storeId?: string | null) {
    const where = isUuid(idOrCode)
      ? { id: idOrCode }
      : { code: idOrCode, storeId: storeId ?? null };

    const menu = await this.prisma.appMenu.findFirst({
      where,
      include: {
        translations: true,
      },
    });

    if (!menu) {
      throw AppError.notFound(`App menu '${idOrCode}' not found.`);
    }

    return menu;
  }

  async create(data: CreateAppMenuInput, actorId?: string) {
    const langCode = data.lang ?? "vi";
    const language = await this.prisma.language.findUnique({
      where: { code: langCode },
    });
    if (!language) {
      throw AppError.badRequest(
        `Language '${langCode}' is not supported in the system.`,
      );
    }

    const existing = await this.prisma.appMenu.findFirst({
      where: { code: data.code, storeId: data.storeId ?? null },
    });
    if (existing) {
      throw AppError.conflict(
        `App menu code '${data.code}' already exists for this store.`,
      );
    }

    const menu = await this.prisma.$transaction(async (tx) => {
      const master = await tx.appMenu.create({
        data: {
          code: data.code,
          storeId: data.storeId ?? null,
          active: data.active ?? true,
        },
      });

      const translation = await tx.appMenuTranslation.create({
        data: {
          menuId: master.id,
          langId: language.id,
          lang: langCode,
          name: data.name,
          data: data.data,
          isLangRef: false, // Original language translation
        },
      });

      return {
        ...master,
        translations: [translation],
        name: translation.name,
        data: translation.data,
        lang: translation.lang,
      };
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

  async addTranslation(
    idOrCode: string,
    storeId: string | null,
    data: CreateAppMenuTranslationInput,
    actorId?: string,
  ) {
    const masterWhere = isUuid(idOrCode)
      ? { id: idOrCode }
      : { code: idOrCode, storeId: storeId ?? null };

    const master = await this.prisma.appMenu.findFirst({
      where: masterWhere,
    });
    if (!master) {
      throw AppError.notFound(`App menu '${idOrCode}' not found.`);
    }

    const language = await this.prisma.language.findUnique({
      where: { code: data.lang },
    });
    if (!language) {
      throw AppError.badRequest(
        `Language '${data.lang}' is not supported in the system.`,
      );
    }

    const existingTranslation = await this.prisma.appMenuTranslation
      .findUnique({
        where: {
          menuId_lang: {
            menuId: master.id,
            lang: data.lang,
          },
        },
      });
    if (existingTranslation) {
      throw AppError.conflict(
        `Translation for language '${data.lang}' already exists for this menu.`,
      );
    }

    const translation = await this.prisma.appMenuTranslation.create({
      data: {
        menuId: master.id,
        langId: language.id,
        lang: data.lang,
        name: data.name,
        data: data.data,
        isLangRef: true, // Translated reference
      },
    });

    await AuditService.log({
      actorId,
      action: "app_menu.add_translation",
      targetType: "app_menu",
      targetId: master.id,
      metadata: { code: master.code, lang: translation.lang },
    });

    return translation;
  }

  async update(
    idOrCode: string,
    storeId: string | null,
    data: UpdateAppMenuInput,
    actorId?: string,
  ) {
    const masterWhere = isUuid(idOrCode)
      ? { id: idOrCode }
      : { code: idOrCode, storeId: storeId ?? null };

    const master = await this.prisma.appMenu.findFirst({
      where: masterWhere,
      include: {
        translations: true,
      },
    });
    if (!master) {
      throw AppError.notFound(`App menu '${idOrCode}' not found.`);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // 1. Update master fields if provided
      const masterUpdates: Record<string, unknown> = {};
      if (data.active !== undefined) masterUpdates.active = data.active;
      if (data.storeId !== undefined) masterUpdates.storeId = data.storeId;
      if (data.code !== undefined) masterUpdates.code = data.code;

      let updatedMaster = master;
      if (Object.keys(masterUpdates).length > 0) {
        updatedMaster = await tx.appMenu.update({
          where: { id: master.id },
          data: masterUpdates,
          include: { translations: true },
        });
      }

      // 2. Update translation fields if provided
      if (data.name !== undefined || data.data !== undefined) {
        let targetLangCode = data.lang;
        if (!targetLangCode) {
          const originalTrans = master.translations.find((t) => !t.isLangRef);
          targetLangCode = originalTrans?.lang ?? "vi";
        }

        const language = await tx.language.findUnique({
          where: { code: targetLangCode },
        });
        if (!language) {
          throw AppError.badRequest(
            `Language '${targetLangCode}' is not supported.`,
          );
        }

        const transUpdates: Record<string, unknown> = {};
        if (data.name !== undefined) transUpdates.name = data.name;
        if (data.data !== undefined) transUpdates.data = data.data;

        await tx.appMenuTranslation.upsert({
          where: {
            menuId_lang: {
              menuId: master.id,
              lang: targetLangCode,
            },
          },
          update: transUpdates,
          create: {
            menuId: master.id,
            langId: language.id,
            lang: targetLangCode,
            name: data.name ?? "",
            data: data.data ?? "[]",
            isLangRef: targetLangCode !== "vi",
          },
        });
      }

      return updatedMaster;
    });

    const responseLang = data.lang ??
      master.translations.find((t) => !t.isLangRef)?.lang ?? "vi";
    const finalMenu = await this.findById(updated.id, responseLang);

    await AuditService.log({
      actorId,
      action: "app_menu.update",
      targetType: "app_menu",
      targetId: master.id,
      metadata: { old: { code: master.code }, new: { code: finalMenu.code } },
    });

    return finalMenu;
  }

  async delete(
    idOrCode: string,
    storeId: string | null,
    actorId?: string,
  ): Promise<void> {
    const masterWhere = isUuid(idOrCode)
      ? { id: idOrCode }
      : { code: idOrCode, storeId: storeId ?? null };

    const master = await this.prisma.appMenu.findFirst({
      where: masterWhere,
    });
    if (!master) {
      throw AppError.notFound(`App menu '${idOrCode}' not found.`);
    }

    await this.prisma.appMenu.delete({ where: { id: master.id } });

    await AuditService.log({
      actorId,
      action: "app_menu.delete",
      targetType: "app_menu",
      targetId: master.id,
      metadata: { code: master.code },
    });
  }
}
