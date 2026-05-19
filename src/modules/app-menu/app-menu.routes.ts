import { Hono } from "@hono/core";
import { validateJson, validateQuery } from "../../shared/utils/validator.ts";
import { requirePermission } from "../../shared/middlewares/permission.middleware.ts";
import type { AppEnv } from "../../core/context.ts";
import {
  extractPagination,
  paginationQuerySchema,
} from "../../shared/utils/pagination.ts";
import type { AppMenuService } from "./app-menu.service.ts";
import {
  type CreateAppMenuInput,
  createAppMenuSchema,
  type UpdateAppMenuInput,
  updateAppMenuSchema,
} from "./app-menu.validation.ts";
import { authMiddleware } from "../../shared/middlewares/auth.middleware.ts";
import { describeRoute } from "../../shared/utils/openapi.ts";
import { isUuid } from "../../shared/utils/uuid.ts";
import * as v from "valibot";

/**
 * App Menu management routes.
 *
 * Base: /v1/app-menus
 */
export const createAppMenuRoutes = (service: AppMenuService) => {
  const router = new Hono<AppEnv>();

  // Guard: Phải đăng nhập
  router.use("*", authMiddleware);

  /**
   * GET /v1/app-menus
   * Lấy danh sách menu (hỗ trợ phân trang, tìm kiếm, filter storeId, lang).
   */
  router.get(
    "/",
    describeRoute({
      tags: ["App Menus"],
      summary: "List App Menus",
      responses: {
        200: { description: "Get app menus successfully" },
        401: { description: "Unauthorized" },
        500: { description: "Internal server error" },
      },
    }),
    requirePermission("app_menu.read"),
    validateQuery(
      v.object({
        ...paginationQuerySchema.entries,
        storeId: v.optional(v.string()),
        lang: v.optional(v.string()),
      }),
    ),
    async (c) => {
      const clientCtx = c.get("clientContext");
      const payload = c.get("jwtPayload");
      const query = c.req.query();

      let forcedStoreId: string | undefined = query.storeId;
      if (payload.tier !== "owner") {
        forcedStoreId = clientCtx.storeId;
      } else {
        forcedStoreId = query.storeId ?? clientCtx.storeId;
      }

      const params = {
        ...extractPagination(query),
        storeId: forcedStoreId,
        lang: query.lang ?? clientCtx.lang,
      };
      const result = await service.findMany(params);
      return c.json({ success: true, ...result });
    },
  );

  /**
   * GET /v1/app-menus/:idOrCode
   * Lấy chi tiết 1 menu (bao gồm data cấu trúc đầy đủ).
   */
  router.get(
    "/:idOrCode",
    describeRoute({
      tags: ["App Menus"],
      summary: "Get App Menu Detail",
      responses: {
        200: { description: "Get app menu detail successfully" },
        401: { description: "Unauthorized" },
        404: { description: "App menu not found" },
        500: { description: "Internal server error" },
      },
    }),
    requirePermission("app_menu.read"),
    async (c) => {
      const idOrCode = c.req.param("idOrCode")!;
      const menu = isUuid(idOrCode)
        ? await service.findById(idOrCode)
        : await service.findByCode(idOrCode);
      return c.json({ success: true, data: menu });
    },
  );

  /**
   * POST /v1/app-menus
   * Tạo menu mới.
   */
  router.post(
    "/",
    describeRoute({
      tags: ["App Menus"],
      summary: "Create App Menu",
      responses: {
        201: { description: "App menu created successfully" },
        400: { description: "Bad request or validation error" },
        401: { description: "Unauthorized" },
        409: { description: "App menu code already exists" },
        500: { description: "Internal server error" },
      },
    }),
    requirePermission("app_menu.create"),
    validateJson(createAppMenuSchema),
    async (c) => {
      const body = c.req.valid("json") as CreateAppMenuInput;
      const actorId = c.get("jwtPayload").id;
      const clientCtx = c.get("clientContext");

      // Bổ sung lang/storeId từ header nếu client không gửi trong body
      const inputData = {
        ...body,
        lang: body.lang ?? clientCtx.lang,
        storeId: body.storeId ?? clientCtx.storeId,
      };

      const menu = await service.create(inputData, actorId);

      c.header("Location", `/v1/app-menus/${menu.code}`);
      return c.json({ success: true, data: menu }, 201);
    },
  );

  /**
   * PATCH /v1/app-menus/:idOrCode
   * Cập nhật menu (lang, name, data, storeId, active).
   */
  router.patch(
    "/:idOrCode",
    describeRoute({
      tags: ["App Menus"],
      summary: "Update App Menu (Partial)",
      responses: {
        200: { description: "App menu updated successfully" },
        400: { description: "Bad request or validation error" },
        401: { description: "Unauthorized" },
        404: { description: "App menu not found" },
        500: { description: "Internal server error" },
      },
    }),
    requirePermission("app_menu.update"),
    validateJson(updateAppMenuSchema),
    async (c) => {
      const idOrCode = c.req.param("idOrCode")!;
      const body = c.req.valid("json") as UpdateAppMenuInput;
      const actorId = c.get("jwtPayload").id;

      const menu = await service.update(idOrCode, body, actorId);
      return c.json({ success: true, data: menu });
    },
  );

  /**
   * PUT /v1/app-menus/:idOrCode
   * Cập nhật menu (Full/Alias).
   */
  router.put(
    "/:idOrCode",
    describeRoute({
      tags: ["App Menus"],
      summary: "Update App Menu (Full/Alias)",
      responses: {
        200: { description: "App menu updated successfully" },
        400: { description: "Bad request or validation error" },
        401: { description: "Unauthorized" },
        404: { description: "App menu not found" },
        500: { description: "Internal server error" },
      },
    }),
    requirePermission("app_menu.update"),
    validateJson(updateAppMenuSchema), // Sử dụng chung schema
    async (c) => {
      const idOrCode = c.req.param("idOrCode")!;
      const body = c.req.valid("json") as UpdateAppMenuInput;
      const actorId = c.get("jwtPayload").id;

      const menu = await service.update(idOrCode, body, actorId);
      return c.json({ success: true, data: menu });
    },
  );

  /**
   * DELETE /v1/app-menus/:idOrCode
   * Xóa menu.
   */
  router.delete(
    "/:idOrCode",
    describeRoute({
      tags: ["App Menus"],
      summary: "Delete App Menu",
      responses: {
        200: { description: "App menu deleted successfully" },
        401: { description: "Unauthorized" },
        404: { description: "App menu not found" },
        500: { description: "Internal server error" },
      },
    }),
    requirePermission("app_menu.delete"),
    async (c) => {
      const idOrCode = c.req.param("idOrCode")!;
      const actorId = c.get("jwtPayload").id;

      await service.delete(idOrCode, actorId);
      return c.json({
        success: true,
        message: `App menu '${idOrCode}' has been deleted.`,
      });
    },
  );

  return router;
};
