import {
  assert,
  assertEquals,
  bearer,
  createTestContext,
  hasIntegrationEnv,
  readJson,
} from "./_helpers/test-helpers.ts";

Deno.test({
  name: "integration: multi-stores and context security",
  ignore: !hasIntegrationEnv,
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const suffix = `${Date.now()}${crypto.randomUUID().slice(0, 8)}`;
    const ctx = await createTestContext(suffix);

    const storeCodeA = `STORE_A_${suffix}`;
    const storeCodeB = `STORE_B_${suffix}`;

    try {
      await ctx.cleanupUsers();
      await ctx.prisma.store.deleteMany({
        where: { code: { in: [storeCodeA, storeCodeB] } },
      });

      // 1. Setup roles and permissions
      await ctx.upsertPermission("users.manage", "users", "Manage users");
      await ctx.upsertPermission("app_menu.read", "app_menu", "Read menus");

      const hashed = await ctx.hashPassword(ctx.password);

      // Create owner user
      const owner = await ctx.prisma.user.create({
        data: {
          username: `owner_${suffix}`,
          email: ctx.ownerEmail,
          password: hashed,
          roleCode: "owner",
          active: true,
        },
      });

      // Create admin user
      const admin = await ctx.prisma.user.create({
        data: {
          username: `admin_${suffix}`,
          email: ctx.adminEmail,
          password: hashed,
          roleCode: "admin",
          active: true,
        },
      });

      // Assign permissions to admin so they can read app menus
      await ctx.prisma.userPermission.create({
        data: {
          userId: admin.id,
          permissionCode: "app_menu.read",
          granted: true,
          assignedBy: owner.id,
        },
      });

      // Create Store A and Store B
      const storeA = await ctx.prisma.store.create({
        data: { code: storeCodeA, name: "Store A", status: "active" },
      });
      const storeB = await ctx.prisma.store.create({
        data: { code: storeCodeB, name: "Store B", status: "active" },
      });

      // Get owner token
      const loginOwner = await ctx.app.request("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: ctx.ownerEmail, password: ctx.password }),
      });
      const ownerToken = String((await readJson(loginOwner)).data?.accessToken);

      // 2. Owner assigns Store A to Admin User via API
      const assignRes = await ctx.app.request(`/v1/users/${admin.id}/stores`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...bearer(ownerToken),
        },
        body: JSON.stringify({ storeIds: [storeA.id] }),
      });
      assertEquals(assignRes.status, 200);

      // Get admin token
      const loginAdmin = await ctx.app.request("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: ctx.adminEmail, password: ctx.password }),
      });
      const adminToken = String((await readJson(loginAdmin)).data?.accessToken);

      // 3. Admin calls GET /me
      const meRes = await ctx.app.request("/v1/users/me", {
        method: "GET",
        headers: { ...bearer(adminToken) },
      });
      assertEquals(meRes.status, 200);
      const meData = await readJson(meRes);
      const userObj = meData.data?.user as Record<string, unknown> | undefined;
      const userStores = userObj?.userStores as Array<Record<string, unknown>>;
      assert(Array.isArray(userStores), "userStores should be an array");
      assertEquals(userStores.length, 1);
      assertEquals(userStores[0].storeId, storeA.id);

      // 4. Admin tries to read app menus WITHOUT x-api-key
      const noApiKeyRes = await ctx.app.request("/v1/app-menus", {
        method: "GET",
        headers: { ...bearer(adminToken) },
      });
      assertEquals(noApiKeyRes.status, 403);
      const noApiKeyBody = await readJson(noApiKeyRes);
      assertEquals(
        noApiKeyBody.error?.message,
        "Header 'x-api-key' (Store ID) is required to perform this action.",
      );

      // 5. Admin tries to read app menus WITH x-api-key = Store B (Unauthorized)
      const wrongApiKeyRes = await ctx.app.request("/v1/app-menus", {
        method: "GET",
        headers: { ...bearer(adminToken), "x-api-key": storeB.id },
      });
      assertEquals(wrongApiKeyRes.status, 403);
      const wrongApiKeyBody = await readJson(wrongApiKeyRes);
      assertEquals(
        wrongApiKeyBody.error?.message,
        "You don't have permission to access this store context.",
      );

      // 6. Admin tries to read app menus WITH x-api-key = Store A (Authorized)
      const correctApiKeyRes = await ctx.app.request("/v1/app-menus", {
        method: "GET",
        headers: { ...bearer(adminToken), "x-api-key": storeA.id },
      });
      // Should be 200 since permission is granted and context is valid
      assertEquals(correctApiKeyRes.status, 200);

      // 7. Owner tries to read app menus WITHOUT x-api-key (Authorized because owner)
      const ownerNoApiKeyRes = await ctx.app.request("/v1/app-menus", {
        method: "GET",
        headers: { ...bearer(ownerToken) },
      });
      assertEquals(ownerNoApiKeyRes.status, 200);

      // 8. Owner unassigns Store A from Admin via API
      const unassignRes = await ctx.app.request(
        `/v1/users/${admin.id}/stores`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            ...bearer(ownerToken),
          },
          body: JSON.stringify({ storeIds: [storeA.id] }),
        },
      );
      assertEquals(unassignRes.status, 200);

      // Verify db that it was deleted
      const adminStoreCount = await ctx.prisma.userStore.count({
        where: { userId: admin.id },
      });
      assertEquals(adminStoreCount, 0);
    } finally {
      await ctx.prisma.store.deleteMany({
        where: { code: { in: [storeCodeA, storeCodeB] } },
      });
      await ctx.cleanupUsers();
      await ctx.closeDb();
    }
  },
});
