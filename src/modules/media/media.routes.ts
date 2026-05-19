import { Hono } from "@hono/core";
import { describeRoute } from "../../shared/utils/openapi.ts";
import { validateJson, validateQuery } from "../../shared/utils/validator.ts";
import type { MediaService } from "./media.service.ts";
import {
  createFolderSchema,
  downloadQuerySchema,
  listMediaQuerySchema,
  uploadQuerySchema,
} from "./media.validation.ts";
import { authMiddleware } from "../../shared/middlewares/auth.middleware.ts";
import type { AppEnv } from "../../core/context.ts";
import { validateUUID } from "../../shared/middlewares/validate-uuid.middleware.ts";
import { AppError } from "../../shared/errors/AppError.ts";

export const createMediaRoutes = (service: MediaService) => {
  const router = new Hono<AppEnv>();

  // 1. TẠO THƯ MỤC
  router.post(
    "/folders",
    describeRoute({
      tags: ["Media"],
      summary: "Create a new folder",
      responses: {
        201: {
          description: "Folder created successfully",
        },
      },
    }),
    authMiddleware,
    validateJson(createFolderSchema),
    async (c) => {
      const body = c.req.valid("json");
      const clientCtx = c.get("clientContext");
      const payload = c.get("jwtPayload");

      // Bắt buộc Multi-Store Context cho non-owner
      if (payload.tier !== "owner") {
        body.storeId = clientCtx?.storeId;
      } else {
        body.storeId = body.storeId || clientCtx?.storeId;
      }

      const folder = await service.createFolder(
        body.name,
        body.parentId,
        body.storeId,
        payload.id,
      );

      return c.json({ success: true, data: folder }, 201);
    },
  );

  // 2. UPLOAD FILE
  router.post(
    "/upload",
    describeRoute({
      tags: ["Media"],
      summary: "Upload a file (Multipart Form Data)",
      requestBody: {
        required: true,
        content: {
          "multipart/form-data": {
            schema: {
              type: "object",
              properties: {
                file: {
                  type: "string",
                  format: "binary",
                  description: "The file to upload",
                },
              },
              required: ["file"],
            },
          },
        },
      },
      responses: {
        201: {
          description: "File uploaded successfully",
        },
      },
    }),
    authMiddleware,
    validateQuery(uploadQuerySchema),
    async (c) => {
      const query = c.req.valid("query");
      const clientCtx = c.get("clientContext");
      const payload = c.get("jwtPayload");

      // Bắt buộc Multi-Store Context cho non-owner
      if (payload.tier !== "owner") {
        query.storeId = clientCtx?.storeId;
      } else {
        query.storeId = query.storeId || clientCtx?.storeId;
      }

      // Xử lý multipart form data
      const body = await c.req.parseBody();
      const file = body["file"];

      if (!file || typeof file === "string") {
        throw AppError.badRequest("Missing 'file' in form-data");
      }

      const seoData = {
        altText: query.altText,
        title: query.title,
        description: query.description,
      };

      const mediaFile = await service.uploadFile(
        file as File,
        query.folderId,
        query.storeId,
        seoData,
        payload.id,
        query.storage_type || "local",
      );

      return c.json({ success: true, data: mediaFile }, 201);
    },
  );

  // 3. LẤY DANH SÁCH FILES VÀ FOLDERS
  router.get(
    "/",
    describeRoute({
      tags: ["Media"],
      summary: "List folders and files in a directory",
      responses: {
        200: {
          description: "List of media files and folders",
        },
      },
    }),
    authMiddleware,
    validateQuery(listMediaQuerySchema),
    async (c) => {
      const query = c.req.valid("query");
      const clientCtx = c.get("clientContext");
      const payload = c.get("jwtPayload");

      // Multi-Store Context Check
      if (payload.tier !== "owner") {
        query.storeId = clientCtx?.storeId;
      } else {
        query.storeId = query.storeId || clientCtx?.storeId;
      }

      const page = parseInt(query.page || "1", 10);
      const limit = parseInt(query.limit || "50", 10);

      const result = await service.listMedia(
        query.storeId,
        query.parentId,
        page,
        limit,
      );

      return c.json({ success: true, data: result });
    },
  );

  // 4. DOWNLOAD / XEM ẢNH CÓ HỖ TRỢ SCALE (Chuyển hướng trực tiếp)
  router.get(
    "/:id/view",
    describeRoute({
      tags: ["Media"],
      summary: "View or download file with optional image scaling (Redirects)",
      responses: {
        302: {
          description: "Redirect to file's direct download URL",
        },
      },
    }),
    validateUUID("id"),
    validateQuery(downloadQuerySchema),
    async (c) => {
      const id = c.req.param("id");
      const query = c.req.valid("query");

      const w = query.w ? parseInt(query.w, 10) : undefined;
      const h = query.h ? parseInt(query.h, 10) : undefined;
      const fit = query.fit || "cover";

      const publicUrl = await service.getDownloadUrl(
        id,
        w,
        h,
        fit as "cover" | "contain" | "fill" | "inside" | "outside",
      );

      if (!publicUrl) {
        throw AppError.notFound("File link not generated properly");
      }

      // Xử lý Local Storage: Nếu publicUrl bắt đầu bằng /uploads, ta có thể route nó cho Hono serve tĩnh,
      // Nhưng theo chuẩn REST và yêu cầu, ta dùng 302 Redirect thẳng đến publicUrl (dù là local hay s3)
      return c.redirect(publicUrl, 302);
    },
  );

  // 5. XÓA FILE (Soft Delete DB + Hard Delete Storage)
  router.delete(
    "/files/:id",
    describeRoute({
      tags: ["Media"],
      summary: "Delete a media file",
      responses: {
        200: {
          description: "File deleted successfully",
        },
      },
    }),
    authMiddleware,
    validateUUID("id"),
    async (c) => {
      const id = c.req.param("id");
      const clientCtx = c.get("clientContext");
      const payload = c.get("jwtPayload");

      let storeId = clientCtx?.storeId;
      if (payload.tier === "owner") {
        storeId = undefined; // Owner bypass context
      }

      const result = await service.deleteFile(id, storeId, payload.id);
      return c.json({ success: true, data: result });
    },
  );

  // 6. XÓA THƯ MỤC ĐỆ QUY (Soft Delete DB)
  router.delete(
    "/folders/:id",
    describeRoute({
      tags: ["Media"],
      summary: "Delete a folder and all its contents recursively",
      responses: {
        200: {
          description: "Folder and contents deleted successfully",
        },
      },
    }),
    authMiddleware,
    validateUUID("id"),
    async (c) => {
      const id = c.req.param("id");
      const clientCtx = c.get("clientContext");
      const payload = c.get("jwtPayload");

      let storeId = clientCtx?.storeId;
      if (payload.tier === "owner") {
        storeId = undefined; // Owner bypass context
      }

      const result = await service.deleteFolder(id, storeId, payload.id);
      return c.json({ success: true, data: result });
    },
  );

  return router;
};
