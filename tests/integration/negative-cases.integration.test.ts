import {
  assertEquals,
  bearer,
  createTestContext,
  hasIntegrationEnv,
  readJson,
} from "./_helpers/test-helpers.ts";

Deno.test({
  name: "integration: negative cases across modules",
  ignore: !hasIntegrationEnv,
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const suffix = `${Date.now()}${crypto.randomUUID().slice(0, 8)}`;
    const ctx = await createTestContext(suffix);
    const roleCode = `it_role_${suffix}`.toLowerCase();
    const storeCode = `IT_STORE_${suffix}`;
    const appMenuCode = `IT_MENU_${suffix.toUpperCase()}`;

    try {
      await ctx.cleanupUsers();
      await Promise.all([
        ctx.prisma.role.deleteMany({ where: { code: roleCode } }),
        ctx.prisma.store.deleteMany({ where: { code: storeCode } }),
        ctx.prisma.appMenu.deleteMany({ where: { code: appMenuCode } }),
      ]);

      for (
        const [code, module, description] of [
          ["permissions.manage", "permissions", "Manage permissions"],
          ["stores.manage", "stores", "Manage stores"],
          ["app_menu.create", "app_menu", "Create app menus"],
        ] as const
      ) {
        await ctx.upsertPermission(code, module, description);
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

      // 403: missing permissions.manage
      const deniedRoleCreate = await ctx.app.request("/v1/roles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...bearer(adminAccessToken),
          "x-api-key": dummyStore.id,
        },
        body: JSON.stringify({
          code: roleCode,
          tier: "user",
          name: "Denied Role",
        }),
      });
      assertEquals(deniedRoleCreate.status, 403);

      await ctx.prisma.userPermission.create({
        data: {
          userId: admin.id,
          permissionCode: "permissions.manage",
          granted: true,
          assignedBy: userId,
        },
      });

      // 404: role not found
      const missingRolePatch = await ctx.app.request(
        "/v1/roles/not_exists_role",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...bearer(adminAccessToken),
            "x-api-key": dummyStore.id,
          },
          body: JSON.stringify({ name: "Role Missing" }),
        },
      );
      assertEquals(missingRolePatch.status, 404);

      // 409: duplicate role code
      const roleCreate1 = await ctx.app.request("/v1/roles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...bearer(adminAccessToken),
          "x-api-key": dummyStore.id,
        },
        body: JSON.stringify({
          code: roleCode,
          tier: "user",
          name: "Role A",
        }),
      });
      assertEquals(roleCreate1.status, 201);
      const roleCreate2 = await ctx.app.request("/v1/roles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...bearer(adminAccessToken),
          "x-api-key": dummyStore.id,
        },
        body: JSON.stringify({
          code: roleCode,
          tier: "user",
          name: "Role B",
        }),
      });
      assertEquals(roleCreate2.status, 409);

      await ctx.prisma.userPermission.create({
        data: {
          userId: admin.id,
          permissionCode: "stores.manage",
          granted: true,
          assignedBy: userId,
        },
      });

      // 400: invalid UUID
      const invalidStoreId = await ctx.app.request("/v1/stores/not-a-uuid", {
        headers: {
          ...bearer(adminAccessToken),
          "x-api-key": dummyStore.id,
        },
      });
      assertEquals(invalidStoreId.status, 400);

      // 409: duplicate store code
      const storeCreate1 = await ctx.app.request("/v1/stores", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...bearer(adminAccessToken),
          "x-api-key": dummyStore.id,
        },
        body: JSON.stringify({
          code: storeCode,
          name: "Store A",
          status: "active",
        }),
      });
      assertEquals(storeCreate1.status, 201);
      const storeCreate2 = await ctx.app.request("/v1/stores", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...bearer(adminAccessToken),
          "x-api-key": dummyStore.id,
        },
        body: JSON.stringify({
          code: storeCode,
          name: "Store B",
          status: "active",
        }),
      });
      assertEquals(storeCreate2.status, 409);

      await ctx.prisma.userPermission.create({
        data: {
          userId: admin.id,
          permissionCode: "app_menu.create",
          granted: true,
          assignedBy: userId,
        },
      });

      // 400: invalid app-menu code (lowercase not allowed)
      const invalidMenuCreate = await ctx.app.request("/v1/app-menus", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...bearer(adminAccessToken),
          "x-api-key": dummyStore.id,
        },
        body: JSON.stringify({
          code: "invalid_lowercase_code",
          name: "Menu X",
          data: JSON.stringify({ items: [] }),
          lang: "vi",
        }),
      });
      const invalidMenuBody = await readJson(invalidMenuCreate);
      assertEquals(invalidMenuCreate.status, 400);
      assertEquals(invalidMenuBody.error?.code, "BAD_REQUEST");
    } finally {
      await ctx.prisma.userStore.deleteMany({});
      await ctx.prisma.store.deleteMany({});
      await Promise.all([
        ctx.prisma.role.deleteMany({ where: { code: roleCode } }),
        ctx.prisma.store.deleteMany({ where: { code: storeCode } }),
        ctx.prisma.appMenu.deleteMany({ where: { code: appMenuCode } }),
      ]);
      await ctx.cleanupUsers();
      await ctx.closeDb();
    }
  },
});
