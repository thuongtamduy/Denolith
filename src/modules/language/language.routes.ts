import { Hono } from "@hono/core";
import { validateJson, validateQuery } from "../../shared/utils/validator.ts";
import { requirePermission } from "../../shared/middlewares/permission.middleware.ts";
import type { AppEnv } from "../../core/context.ts";
import {
  extractPagination,
  paginationQuerySchema,
} from "../../shared/utils/pagination.ts";
import type { LanguageService } from "./language.service.ts";
import {
  type CreateLanguageInput,
  createLanguageSchema,
  type UpdateLanguageInput,
  updateLanguageSchema,
} from "./language.validation.ts";
import { authMiddleware } from "../../shared/middlewares/auth.middleware.ts";
import { describeRoute } from "../../shared/utils/openapi.ts";

export const createLanguageRoutes = (service: LanguageService) => {
  const router = new Hono<AppEnv>();

  // Guard chung: Phải đăng nhập
  router.use("*", authMiddleware);

  /**
   * GET /v1/languages
   * Lấy danh sách toàn bộ ngôn ngữ (hỗ trợ phân trang).
   */
  router.get(
    "/",
    describeRoute({
      tags: ["Languages"],
      summary: "Get Languages List",
      responses: {
        200: { description: "Get languages successfully" },
        401: { description: "Unauthorized" },
        500: { description: "Internal server error" },
      },
    }),
    validateQuery(paginationQuerySchema),
    async (c) => {
      const params = extractPagination(c.req.query());
      const result = await service.findMany(params);
      return c.json({ success: true, ...result });
    },
  );

  /**
   * GET /v1/languages/active
   * Lấy danh sách các ngôn ngữ đang hoạt động (không phân trang, cho FE render dropdown).
   */
  router.get(
    "/active",
    describeRoute({
      tags: ["Languages"],
      summary: "Get Active Languages",
      responses: {
        200: { description: "Get active languages successfully" },
        401: { description: "Unauthorized" },
        500: { description: "Internal server error" },
      },
    }),
    async (c) => {
      const data = await service.findActive();
      return c.json({ success: true, data });
    },
  );

  /**
   * GET /v1/languages/:code
   * Lấy chi tiết 1 ngôn ngữ.
   */
  router.get(
    "/:code",
    describeRoute({
      tags: ["Languages"],
      summary: "Get Language Details",
      responses: {
        200: { description: "Get language details successfully" },
        401: { description: "Unauthorized" },
        404: { description: "Language not found" },
        500: { description: "Internal server error" },
      },
    }),
    async (c) => {
      const code = c.req.param("code")!;
      const lang = await service.findByCode(code);
      return c.json({ success: true, data: lang });
    },
  );

  /**
   * POST /v1/languages
   * Thêm ngôn ngữ mới.
   */
  router.post(
    "/",
    describeRoute({
      tags: ["Languages"],
      summary: "Create Language",
      responses: {
        201: { description: "Language created successfully" },
        400: { description: "Bad request or validation error" },
        401: { description: "Unauthorized" },
        409: { description: "Language code already exists" },
        500: { description: "Internal server error" },
      },
    }),
    requirePermission("permissions.manage"),
    validateJson(createLanguageSchema),
    async (c) => {
      const body = c.req.valid("json") as CreateLanguageInput;
      const actorId = c.get("jwtPayload").id;
      const lang = await service.create(body, actorId);

      c.header("Location", `/v1/languages/${lang.code}`);
      return c.json({ success: true, data: lang }, 201);
    },
  );

  /**
   * PATCH /v1/languages/:code
   * Cập nhật thông tin ngôn ngữ.
   */
  router.patch(
    "/:code",
    describeRoute({
      tags: ["Languages"],
      summary: "Update Language",
      responses: {
        200: { description: "Language updated successfully" },
        400: { description: "Bad request or validation error" },
        401: { description: "Unauthorized" },
        404: { description: "Language not found" },
        500: { description: "Internal server error" },
      },
    }),
    requirePermission("permissions.manage"),
    validateJson(updateLanguageSchema),
    async (c) => {
      const code = c.req.param("code")!;
      const body = c.req.valid("json") as UpdateLanguageInput;
      const actorId = c.get("jwtPayload").id;

      const lang = await service.update(code, body, actorId);
      return c.json({ success: true, data: lang });
    },
  );

  /**
   * DELETE /v1/languages/:code
   * Xóa ngôn ngữ.
   */
  router.delete(
    "/:code",
    describeRoute({
      tags: ["Languages"],
      summary: "Delete Language",
      responses: {
        200: { description: "Language deleted successfully" },
        401: { description: "Unauthorized" },
        404: { description: "Language not found" },
        500: { description: "Internal server error" },
      },
    }),
    requirePermission("permissions.manage"),
    async (c) => {
      const code = c.req.param("code")!;
      const actorId = c.get("jwtPayload").id;

      await service.delete(code, actorId);
      return c.json({
        success: true,
        message: `Language '${code}' has been deleted.`,
      });
    },
  );

  return router;
};
