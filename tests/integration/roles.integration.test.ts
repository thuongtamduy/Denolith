import {
  assertEquals,
  bearer,
  createTestContext,
  hasIntegrationEnv,
  readJson,
} from "./_helpers/test-helpers.ts";

Deno.test({
  name: "integration: roles module",
  ignore: !hasIntegrationEnv,
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const suffix = `${Date.now()}${crypto.randomUUID().slice(0, 8)}`;
    const ctx = await createTestContext(suffix);
    const roleCode = `it_role_${suffix}`.toLowerCase();

    try {
      await ctx.cleanupUsers();
      await ctx.prisma.role.deleteMany({ where: { code: roleCode } });
      await ctx.upsertPermission(
        "permissions.manage",
        "permissions",
        "Manage permissions",
      );

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

      await ctx.prisma.userPermission.create({
        data: {
          userId: admin.id,
          permissionCode: "permissions.manage",
          granted: true,
          assignedBy: userId,
        },
      });

      const loginResponse = await ctx.app.request("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: ctx.adminEmail, password: ctx.password }),
      });
      const loginBody = await readJson(loginResponse);
      const adminAccessToken = String(loginBody.data?.accessToken);

      const dummyStore = await ctx.prisma.store.create({
        data: {
          code: `STORE_DUMMY_${suffix}`,
          name: "Dummy Store",
          status: "active",
        },
      });

      await ctx.prisma.userStore.create({
        data: {
          userId: admin.id,
          storeId: dummyStore.id,
        },
      });

      const createResponse = await ctx.app.request("/v1/roles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...bearer(adminAccessToken),
          "x-api-key": dummyStore.id,
        },
        body: JSON.stringify({
          code: roleCode,
          tier: "user",
          name: "Integration Role",
          description: "Created by integration test",
        }),
      });
      assertEquals(createResponse.status, 201);

      const updateResponse = await ctx.app.request(`/v1/roles/${roleCode}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...bearer(adminAccessToken),
          "x-api-key": dummyStore.id,
        },
        body: JSON.stringify({
          name: "Integration Role Updated",
          active: true,
        }),
      });
      assertEquals(updateResponse.status, 200);

      const deleteResponse = await ctx.app.request(`/v1/roles/${roleCode}`, {
        method: "DELETE",
        headers: {
          ...bearer(adminAccessToken),
          "x-api-key": dummyStore.id,
        },
      });
      assertEquals(deleteResponse.status, 200);
    } finally {
      await ctx.prisma.userStore.deleteMany({});
      await ctx.prisma.store.deleteMany({});
      await ctx.prisma.role.deleteMany({ where: { code: roleCode } });
      await ctx.cleanupUsers();
      await ctx.closeDb();
    }
  },
});
