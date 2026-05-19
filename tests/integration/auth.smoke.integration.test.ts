import {
  assert,
  assertEquals,
  bearer,
  createTestContext,
  hasIntegrationEnv,
  readJson,
} from "./_helpers/test-helpers.ts";

Deno.test({
  name: "integration smoke: auth core flow",
  ignore: !hasIntegrationEnv,
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const suffix = `${Date.now()}${crypto.randomUUID().slice(0, 8)}`;
    const ctx = await createTestContext(suffix);

    try {
      await ctx.cleanupUsers();

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
      assertEquals(registerResponse.status, 201);
      assert(registerBody.data?.accessToken, "register should return token");
      assert(
        registerResponse.headers.get("set-cookie")?.includes("refresh_token="),
        "register should set refresh cookie",
      );

      const loginResponse = await ctx.app.request("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: ctx.registeredEmail,
          password: ctx.password,
        }),
      });
      const loginBody = await readJson(loginResponse);
      assertEquals(loginResponse.status, 200);
      const refreshToken = String(loginBody.data?.refreshToken ?? "");
      assert(refreshToken, "login should return refresh token");

      const refreshResponse = await ctx.app.request("/v1/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      const refreshBody = await readJson(refreshResponse);
      assertEquals(refreshResponse.status, 200);
      const accessToken = String(refreshBody.data?.accessToken ?? "");
      assert(accessToken, "refresh should return access token");

      const store = await ctx.prisma.store.create({
        data: {
          code: `STORE_SMOKE_${suffix}`,
          name: "Smoke Store",
          status: "active",
        },
      });

      const userDb = await ctx.prisma.user.findUnique({
        where: { email: ctx.registeredEmail },
      });

      await ctx.prisma.userStore.create({
        data: {
          userId: userDb!.id,
          storeId: store.id,
        },
      });

      const meResponse = await ctx.app.request("/v1/users/me", {
        headers: bearer(accessToken),
      });
      const meBody = await readJson(meResponse);
      assertEquals(meResponse.status, 200);
      assertEquals(meBody.success, true);
    } finally {
      await ctx.prisma.userStore.deleteMany({});
      await ctx.prisma.store.deleteMany({});
      await ctx.cleanupUsers();
      await ctx.closeDb();
    }
  },
});
