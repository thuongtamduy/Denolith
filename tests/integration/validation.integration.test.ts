import {
  assertEquals,
  bearer,
  createTestContext,
  hasIntegrationEnv,
  readJson,
} from "./_helpers/test-helpers.ts";

Deno.test({
  name: "integration: validation should return 400, not 500",
  ignore: !hasIntegrationEnv,
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const suffix = `${Date.now()}${crypto.randomUUID().slice(0, 8)}`;
    const ctx = await createTestContext(suffix);
    const appMenuCode = `IT_MENU_${suffix.toUpperCase()}`;

    try {
      await ctx.cleanupUsers();
      await ctx.prisma.appMenu.deleteMany({ where: { code: appMenuCode } });

      for (
        const [code, description] of [
          ["app_menu.create", "Create app menus"],
        ] as const
      ) {
        await ctx.upsertPermission(code, "app_menu", description);
      }

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
          permissionCode: "app_menu.create",
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

      // Invalid code: schema only accepts uppercase letters, numbers, _ and -
      const invalidResponse = await ctx.app.request("/v1/app-menus", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...bearer(adminAccessToken),
          "x-api-key": dummyStore.id,
        },
        body: JSON.stringify({
          code: "invalid_lowercase_code",
          name: "Integration Menu",
          data: JSON.stringify({ items: [] }),
          lang: "vi",
        }),
      });
      const invalidBody = await readJson(invalidResponse);
      assertEquals(invalidResponse.status, 400);
      assertEquals(invalidBody.error?.code, "BAD_REQUEST");
    } finally {
      await ctx.prisma.userStore.deleteMany({});
      await ctx.prisma.store.deleteMany({});
      await ctx.prisma.appMenu.deleteMany({ where: { code: appMenuCode } });
      await ctx.cleanupUsers();
      await ctx.closeDb();
    }
  },
});
