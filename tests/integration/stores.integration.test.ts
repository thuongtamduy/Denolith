import {
  assert,
  assertEquals,
  bearer,
  createTestContext,
  hasIntegrationEnv,
  readJson,
} from "./_helpers/test-helpers.ts";

Deno.test({
  name: "integration: stores module",
  ignore: !hasIntegrationEnv,
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const suffix = `${Date.now()}${crypto.randomUUID().slice(0, 8)}`;
    const ctx = await createTestContext(suffix);
    const storeCode = `IT_STORE_${suffix}`;

    try {
      await ctx.cleanupUsers();
      await ctx.prisma.store.deleteMany({ where: { code: storeCode } });
      await ctx.upsertPermission("stores.manage", "stores", "Manage stores");

      const registerResponse = await ctx.app.request("/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: ctx.registeredUsername,
          email: ctx.registeredEmail,
          password: ctx.password,
        }),
      });
      const registerBody = await readJson(registerResponse);
      const userId = String(
        (registerBody.data?.user as Record<string, unknown>).id,
      );

      const hashed = await ctx.hashPassword(ctx.password);
      const admin = await ctx.prisma.user.create({
        data: {
          username: `it_admin_${suffix}`,
          email: ctx.adminEmail,
          password: hashed,
          roleCode: "admin",
          active: true,
        },
      });

      const loginResponse = await ctx.app.request("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: ctx.adminEmail, password: ctx.password }),
      });
      const loginBody = await readJson(loginResponse);
      const adminAccessToken = String(loginBody.data?.accessToken);

      const deniedResponse = await ctx.app.request("/v1/stores", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...bearer(adminAccessToken),
        },
        body: JSON.stringify({
          code: storeCode,
          name: "Integration Store",
          status: "active",
        }),
      });
      assertEquals(deniedResponse.status, 403);

      await ctx.prisma.userPermission.create({
        data: {
          userId: admin.id,
          permissionCode: "stores.manage",
          granted: true,
          assignedBy: userId,
        },
      });

      const createResponse = await ctx.app.request("/v1/stores", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...bearer(adminAccessToken),
        },
        body: JSON.stringify({
          code: storeCode,
          name: "Integration Store",
          status: "active",
        }),
      });
      const createBody = await readJson(createResponse);
      assertEquals(createResponse.status, 201);
      const storeId = String(createBody.data?.id);
      assert(storeId, "store create should return id");
    } finally {
      await ctx.prisma.store.deleteMany({ where: { code: storeCode } });
      await ctx.cleanupUsers();
      await ctx.closeDb();
    }
  },
});
