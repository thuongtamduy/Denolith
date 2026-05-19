import type { PrismaClient } from "@db";
import { AppError } from "../../shared/errors/AppError.ts";
import { storage } from "../../core/storage.ts";
import sharp from "sharp";
import { logger } from "../../core/logger.ts";

export class MediaService {
  constructor(private prisma: PrismaClient) {}

  async createFolder(
    name: string,
    parentId?: string,
    storeId?: string,
    createdBy?: string,
  ) {
    let path = "/";
    if (parentId) {
      const parent = await this.prisma.mediaFolder.findUnique({
        where: { id: parentId },
      });
      if (!parent) throw AppError.notFound("Parent folder not found");
      // Phân quyền store: Thư mục cha khác store thì chặn
      if (parent.storeId && parent.storeId !== storeId) {
        throw AppError.forbidden(
          "Cannot create folder in another store's folder",
        );
      }
      path = `${parent.path}${parent.name}/`;
    }

    return this.prisma.mediaFolder.create({
      data: { name, parentId, storeId, path, createdBy },
    });
  }

  async uploadFile(
    file: File,
    folderId?: string,
    storeId?: string,
    seo?: { altText?: string; title?: string; description?: string },
    createdBy?: string,
    storageType: string = "local",
  ) {
    const buffer = await file.arrayBuffer();
    const mimeType = file.type || "application/octet-stream";

    let width: number | undefined;
    let height: number | undefined;

    // Detect kích thước ảnh nếu là image
    if (mimeType.startsWith("image/")) {
      try {
        const metadata = await sharp(buffer).metadata();
        width = metadata.width;
        height = metadata.height;
      } catch (err) {
        logger.warn(`Could not extract image metadata: ${err}`);
      }
    }

    const fileId = crypto.randomUUID();
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");

    // Tạo đường dẫn lưu trữ
    const storagePath = `media/${storeId || "global"}/${
      folderId || "root"
    }/${fileId}-${safeName}`;

    // Upload lên storage (Local, S3, Supabase)
    const publicUrl = await storage.upload(
      "assets", // Tên bucket (cấu hình tuỳ ý)
      storagePath,
      buffer,
      mimeType,
      storageType,
    );

    // Lưu DB
    return this.prisma.mediaFile.create({
      data: {
        id: fileId,
        folderId,
        storeId,
        fileName: file.name,
        mimeType,
        sizeBytes: file.size,
        storageType: storageType || "local",
        storagePath,
        publicUrl,
        altText: seo?.altText,
        title: seo?.title,
        description: seo?.description,
        width,
        height,
        createdBy,
      },
    });
  }

  async getDownloadUrl(
    fileId: string,
    w?: number,
    h?: number,
    fit: "cover" | "contain" | "fill" | "inside" | "outside" = "cover",
  ): Promise<string> {
    const media = await this.prisma.mediaFile.findUnique({
      where: { id: fileId },
    });

    if (!media || media.deleted) {
      throw AppError.notFound("Media file not found");
    }

    // Nếu không scale, hoặc không phải file ảnh -> trả thẳng link gốc
    if (!media.mimeType.startsWith("image/") || (!w && !h)) {
      return media.publicUrl || "";
    }

    const variants = (media.variants as Record<string, string>) || {};
    const variantKey = `${w || "auto"}x${h || "auto"}_${fit}`;

    // Cache hit: Trả về link ảnh đã scale sẵn trong DB
    if (variants[variantKey]) {
      return variants[variantKey];
    }

    // Cache miss: Tải ảnh gốc về -> Dùng Sharp Scale -> Lưu lên Storage -> Cập nhật JSON
    try {
      const buffer = await storage.download(
        "assets",
        media.storagePath,
        media.storageType,
      );

      // Process image using sharp
      const scaledBuffer = await sharp(buffer)
        .resize({
          width: w,
          height: h,
          fit: sharp.fit[fit],
          withoutEnlargement: true, // Tránh bể ảnh nếu scale to hơn gốc
        })
        .toBuffer();

      const ext = media.fileName.split(".").pop() || "jpg";
      const variantStoragePath =
        `media-variants/${media.id}_${variantKey}.${ext}`;

      // Upload scaled image lên Storage cùng provider
      const scaledPublicUrl = await storage.upload(
        "assets",
        variantStoragePath,
        scaledBuffer,
        media.mimeType,
        media.storageType,
      );

      // Cập nhật Database
      await this.prisma.mediaFile.update({
        where: { id: media.id },
        data: {
          variants: { ...variants, [variantKey]: scaledPublicUrl },
        },
      });

      return scaledPublicUrl;
    } catch (err) {
      logger.error(`Failed to scale image ${fileId}: ${err}`);
      // Lỗi scale thì fallback về ảnh gốc thay vì crash
      return media.publicUrl || "";
    }
  }

  async listMedia(
    storeId?: string,
    parentId?: string,
    page: number = 1,
    limit: number = 50,
  ) {
    const skip = (page - 1) * limit;

    const [folders, files, totalFiles] = await Promise.all([
      // Lấy folders (thường không phân trang để hiển thị đầy đủ cây thư mục con)
      this.prisma.mediaFolder.findMany({
        where: {
          storeId: storeId || null,
          parentId: parentId || null,
          deleted: false,
        },
        orderBy: { createdAt: "desc" },
      }),
      // Lấy files (có phân trang)
      this.prisma.mediaFile.findMany({
        where: {
          storeId: storeId || null,
          folderId: parentId || null,
          deleted: false,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      // Đếm tổng số file của folder hiện tại phục vụ phân trang
      this.prisma.mediaFile.count({
        where: {
          storeId: storeId || null,
          folderId: parentId || null,
          deleted: false,
        },
      }),
    ]);

    const totalPages = Math.ceil(totalFiles / limit);

    return {
      folders,
      files,
      meta: {
        total: totalFiles,
        page,
        limit,
        totalPages,
      },
    };
  }

  async deleteFile(fileId: string, storeId?: string, actorId?: string) {
    const file = await this.prisma.mediaFile.findFirst({
      where: { id: fileId, deleted: false },
    });

    if (!file) throw AppError.notFound("Media file not found");

    // Nếu không phải owner và storeId không khớp
    if (storeId && file.storeId && file.storeId !== storeId) {
      throw AppError.forbidden("Cannot delete file in another store");
    }

    // Soft delete trong DB
    await this.prisma.mediaFile.update({
      where: { id: fileId },
      data: {
        deleted: true,
        deletedAt: new Date(),
        deletedBy: actorId,
      },
    });

    // Hard delete thực tế trên storage để tiết kiệm dung lượng
    try {
      // 1. Xóa file gốc
      await storage.delete("assets", file.storagePath, file.storageType);

      // 2. Xóa các biến thể scale đã được sinh ra (nếu có)
      const variants = (file.variants as Record<string, string>) || {};
      for (const variantUrl of Object.values(variants)) {
        let variantPath = "";
        if (file.storageType === "local") {
          variantPath = variantUrl.replace("/uploads/assets/", "");
        } else {
          variantPath = variantUrl.substring(
            variantUrl.indexOf("media-variants/"),
          );
        }
        if (variantPath) {
          await storage.delete("assets", variantPath, file.storageType);
        }
      }
    } catch (err) {
      logger.warn(`Could not delete physical files from storage: ${err}`);
    }

    return { id: fileId };
  }

  async deleteFolder(folderId: string, storeId?: string, actorId?: string) {
    const folder = await this.prisma.mediaFolder.findFirst({
      where: { id: folderId, deleted: false },
    });

    if (!folder) throw AppError.notFound("Folder not found");

    if (storeId && folder.storeId && folder.storeId !== storeId) {
      throw AppError.forbidden("Cannot delete folder in another store");
    }

    const absoluteFolderPath = `${folder.path}${folder.name}/`;

    await this.prisma.$transaction(async (tx) => {
      // 1. Soft delete chính thư mục này
      await tx.mediaFolder.update({
        where: { id: folderId },
        data: {
          deleted: true,
          deletedAt: new Date(),
          deletedBy: actorId,
        },
      });

      // 2. Tìm và soft delete tất cả thư mục con cháu
      await tx.mediaFolder.updateMany({
        where: {
          path: { startsWith: absoluteFolderPath },
          deleted: false,
          storeId: storeId || undefined,
        },
        data: {
          deleted: true,
          deletedAt: new Date(),
          deletedBy: actorId,
        },
      });

      // 3. Tìm tất cả các file nằm trong thư mục này hoặc con cháu của nó
      const subFolders = await tx.mediaFolder.findMany({
        where: {
          path: { startsWith: absoluteFolderPath },
          storeId: storeId || undefined,
        },
        select: { id: true },
      });

      const folderIds = [folderId, ...subFolders.map((sf) => sf.id)];

      await tx.mediaFile.updateMany({
        where: {
          folderId: { in: folderIds },
          deleted: false,
        },
        data: {
          deleted: true,
          deletedAt: new Date(),
          deletedBy: actorId,
        },
      });
    });

    return { id: folderId };
  }
}
