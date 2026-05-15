import { Hono } from "@hono/core";
import { describeRoute } from "../../shared/utils/openapi.ts";
import { validateJson, validateQuery } from "../../shared/utils/validator.ts";
import type { StoreService } from "./store.service.ts";
import {
  extractPagination,
  paginationQuerySchema,
} from "../../shared/utils/pagination.ts";
import { authMiddleware } from "../../shared/middlewares/auth.middleware.ts";
import { requirePermission } from "../../shared/middlewares/permission.middleware.ts";
import { cacheResponse } from "../../shared/middlewares/cache.middleware.ts";
import type { AppEnv } from "../../core/context.ts";
import { validateUUID } from "../../shared/middlewares/validate-uuid.middleware.ts";
import {
  type CreateStoreInput,
  createStoreSchema,
  type UpdateStoreInput,
  updateStoreSchema,
} from "./store.validation.ts";

export const createStoreRoutes = (service: StoreService) => {
  const router = new Hono<AppEnv>();

  // Cần đăng nhập để sử dụng
  router.use("*", authMiddleware);

  // GET /v1/stores
  router.get(
    "/",
    describeRoute({
      tags: ["Stores"],
      summary: "Get list of stores",
      responses: {
        200: { description: "Successful response" },
      },
    }),
    validateQuery(paginationQuerySchema),
    cacheResponse(60),
    async (c) => {
      const params = extractPagination(c.req.query());
      const result = await service.findMany(params);
      return c.json({
        success: true,
        data: result.data,
        meta: result.meta,
      });
    },
  );

  // GET /v1/stores/:id
  router.get(
    "/:id",
    describeRoute({
      tags: ["Stores"],
      summary: "Get store details",
      responses: {
        200: { description: "Successful response" },
        404: { description: "Store not found" },
      },
    }),
    validateUUID(),
    async (c) => {
      const id = c.req.param("id")!;
      const store = await service.findById(id);
      return c.json({ success: true, data: store });
    },
  );

  // POST /v1/stores
  router.post(
    "/",
    describeRoute({
      tags: ["Stores"],
      summary: "Create a new store",
      responses: {
        201: { description: "Store created successfully" },
      },
    }),
    requirePermission("stores.manage"),
    validateJson(createStoreSchema),
    async (c) => {
      const body = c.req.valid("json") as CreateStoreInput;
      const actorId = c.get("jwtPayload")?.id;
      const store = await service.create(body, actorId);

      c.header("Location", `/v1/stores/${store.id}`);
      return c.json({ success: true, data: store }, 201);
    },
  );

  // PATCH /v1/stores/:id
  router.patch(
    "/:id",
    describeRoute({
      tags: ["Stores"],
      summary: "Update store details (Partial)",
      responses: {
        200: { description: "Store updated successfully" },
      },
    }),
    requirePermission("stores.manage"),
    validateUUID(),
    validateJson(updateStoreSchema),
    async (c) => {
      const id = c.req.param("id")!;
      const body = c.req.valid("json") as UpdateStoreInput;
      const actorId = c.get("jwtPayload")?.id;

      const store = await service.update(id, body, actorId);
      return c.json({ success: true, data: store });
    },
  );

  // PUT /v1/stores/:id
  router.put(
    "/:id",
    describeRoute({
      tags: ["Stores"],
      summary: "Update store details (Full/Alias)",
      responses: {
        200: { description: "Store updated successfully" },
      },
    }),
    requirePermission("stores.manage"),
    validateUUID(),
    validateJson(updateStoreSchema), // Sử dụng chung schema update
    async (c) => {
      const id = c.req.param("id")!;
      const body = c.req.valid("json") as UpdateStoreInput;
      const actorId = c.get("jwtPayload")?.id;

      const store = await service.update(id, body, actorId);
      return c.json({ success: true, data: store });
    },
  );

  // DELETE /v1/stores/:id
  router.delete(
    "/:id",
    describeRoute({
      tags: ["Stores"],
      summary: "Delete store",
      responses: {
        200: { description: "Store soft-deleted successfully" },
        204: { description: "Store hard-deleted successfully" },
      },
    }),
    requirePermission("stores.manage"),
    validateUUID(),
    async (c) => {
      const id = c.req.param("id")!;
      const actorId = c.get("jwtPayload")?.id;
      const isForce = c.req.query("force") === "true";

      if (isForce) {
        await service.hardDelete(id, actorId);
        return new Response(null, { status: 204 });
      } else {
        await service.softDelete(id, actorId);
        return c.json({
          success: true,
          message: "Store has been soft-deleted and can be restored.",
        });
      }
    },
  );

  // POST /v1/stores/:id/restore
  router.post(
    "/:id/restore",
    describeRoute({
      tags: ["Stores"],
      summary: "Restore soft-deleted store",
      responses: {
        200: { description: "Store restored successfully" },
      },
    }),
    requirePermission("stores.manage"),
    validateUUID(),
    async (c) => {
      const id = c.req.param("id")!;
      const actorId = c.get("jwtPayload")?.id;
      const store = await service.restore(id, actorId);

      return c.json({
        success: true,
        message: `Store '${store.name}' has been restored successfully.`,
        data: store,
      });
    },
  );

  return router;
};
