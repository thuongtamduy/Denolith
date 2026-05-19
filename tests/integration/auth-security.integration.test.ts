import {
  assert,
  assertEquals,
  bearer,
  createTestContext,
  hasIntegrationEnv,
  readJson,
} from "./_helpers/test-helpers.ts";

Deno.test({
  name: "integration: auth/session security contracts",
  ignore: !hasIntegrationEnv,
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const suffix = `${Date.now()}${crypto.randomUUID().slice(0, 8)}`;
    const ctx = await createTestContext(suffix);
    let userId = "";
    let accessToken = "";
    let refreshToken = "";

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
      userId = String((registerBody.data?.user as Record<string, unknown>).id);

      const loginResponse = await ctx.app.request("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: ctx.registeredEmail, password: ctx.password }),
      });
      const loginBody = await readJson(loginResponse);
      assertEquals(loginResponse.status, 200);
      accessToken = String(loginBody.data?.accessToken ?? "");
      refreshToken = String(loginBody.data?.refreshToken ?? "");
      assert(accessToken, "login should return access token");
      assert(refreshToken, "login should return refresh token");

      // Contract 1: replaying consumed refresh token must trigger security revocation
      const firstRefresh = await ctx.app.request("/v1/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      const firstRefreshBody = await readJson(firstRefresh);
      assertEquals(firstRefresh.status, 200);
      const consumedToken = refreshToken;
      refreshToken = String(firstRefreshBody.data?.refreshToken ?? "");
      assert(refreshToken, "refresh should rotate token");

      const replayResponse = await ctx.app.request("/v1/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: consumedToken }),
      });
      const replayBody = await readJson(replayResponse);
      assertEquals(replayResponse.status, 401);
      assertEquals(replayBody.error?.code, "UNAUTHORIZED");

      const remainingSessions = await ctx.prisma.refreshToken.count({
        where: { userId },
      });
      assertEquals(remainingSessions, 0);

      // Re-login for next security contracts
      const reloginResponse = await ctx.app.request("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: ctx.registeredEmail, password: ctx.password }),
      });
      const reloginBody = await readJson(reloginResponse);
      assertEquals(reloginResponse.status, 200);
      accessToken = String(reloginBody.data?.accessToken ?? "");
      refreshToken = String(reloginBody.data?.refreshToken ?? "");

      // Contract 2: logout must invalidate refresh session
      const logoutResponse = await ctx.app.request("/v1/auth/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...bearer(accessToken),
        },
        body: JSON.stringify({ refreshToken }),
      });
      const logoutBody = await readJson(logoutResponse);
      assertEquals(logoutResponse.status, 200);
      assertEquals(logoutBody.success, true);

      const postLogoutRefresh = await ctx.app.request("/v1/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      const postLogoutRefreshBody = await readJson(postLogoutRefresh);
      assertEquals(postLogoutRefresh.status, 401);
      assertEquals(postLogoutRefreshBody.error?.code, "UNAUTHORIZED");

      // Contract 3: disabled user cannot use an existing access token
      await ctx.prisma.user.update({
        where: { id: userId },
        data: { active: false },
      });

      const disabledUserMe = await ctx.app.request("/v1/users/me", {
        headers: bearer(accessToken),
      });
      const disabledUserMeBody = await readJson(disabledUserMe);
      assertEquals(disabledUserMe.status, 401);
      assertEquals(disabledUserMeBody.error?.code, "UNAUTHORIZED");
    } finally {
      await ctx.cleanupUsers();
      await ctx.closeDb();
    }
  },
});

