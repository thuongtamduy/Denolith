import {
  assert,
  assertEquals,
  bearer,
  createTestContext,
  hasIntegrationEnv,
  readJson,
} from "./_helpers/test-helpers.ts";

Deno.test({
  name: "integration: app menus module",
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
          ["app_menu.read", "Read app menus"],
          ["app_menu.create", "Create app menus"],
          ["app_menu.update", "Update app menus"],
          ["app_menu.delete", "Delete app menus"],
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

      const deniedResponse = await ctx.app.request("/v1/app-menus", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...bearer(adminAccessToken),
          "x-api-key": dummyStore.id,
        },
        body: JSON.stringify({
          code: appMenuCode,
          name: "Integration Menu",
          data: JSON.stringify({ items: [{ label: "Home", path: "/" }] }),
          lang: "vi",
        }),
      });
      assertEquals(deniedResponse.status, 403);

      for (
        const permissionCode of [
          "app_menu.read",
          "app_menu.create",
          "app_menu.update",
          "app_menu.delete",
        ]
      ) {
        await ctx.prisma.userPermission.upsert({
          where: {
            userId_permissionCode: { userId: admin.id, permissionCode },
          },
          update: { granted: true },
          create: {
            userId: admin.id,
            permissionCode,
            granted: true,
            assignedBy: userId,
          },
        });
      }

      const createResponse = await ctx.app.request("/v1/app-menus", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...bearer(adminAccessToken),
          "x-api-key": dummyStore.id,
        },
        body: JSON.stringify({
          code: appMenuCode,
          name: "Integration Menu",
          data: JSON.stringify({ items: [{ label: "Home", path: "/" }] }),
          lang: "vi",
        }),
      });
      const createBody = await readJson(createResponse);
      assertEquals(createResponse.status, 201);
      const menuId = String(createBody.data?.id);
      assert(menuId, "app menu create should return id");

      const updateResponse = await ctx.app.request(`/v1/app-menus/${menuId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...bearer(adminAccessToken),
          "x-api-key": dummyStore.id,
        },
        body: JSON.stringify({ name: "Integration Menu Updated" }),
      });
      assertEquals(updateResponse.status, 200);
    } finally {
      await ctx.prisma.userStore.deleteMany({});
      await ctx.prisma.store.deleteMany({});
      await ctx.prisma.appMenu.deleteMany({ where: { code: appMenuCode } });
      await ctx.cleanupUsers();
      await ctx.closeDb();
    }
  },
});
