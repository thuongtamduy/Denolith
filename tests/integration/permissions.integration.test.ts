import {
  assert,
  assertEquals,
  bearer,
  createTestContext,
  hasIntegrationEnv,
  readJson,
} from "./_helpers/test-helpers.ts";

Deno.test({
  name: "integration: permissions module",
  ignore: !hasIntegrationEnv,
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const suffix = `${Date.now()}${crypto.randomUUID().slice(0, 8)}`;
    const ctx = await createTestContext(suffix);
    const profileName = `Integration Profile ${suffix}`;
    let userId = "";
    let adminId = "";
    let adminAccessToken = "";

    try {
      await ctx.cleanupUsers();
      await ctx.prisma.permissionProfile.deleteMany({
        where: { name: { in: [profileName, `${profileName} Updated`] } },
      });

      await Promise.all([
        ctx.upsertPermission(
          "permissions.manage",
          "permissions",
          "Manage permission profiles and user access control",
        ),
        ctx.upsertPermission("users.read", "users", "Read users"),
      ]);

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
      userId = String((registerBody.data?.user as Record<string, unknown>).id);

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
      adminId = admin.id;

      const loginResponse = await ctx.app.request("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: ctx.adminEmail, password: ctx.password }),
      });
      const loginBody = await readJson(loginResponse);
      adminAccessToken = String(loginBody.data?.accessToken);

      const deniedResponse = await ctx.app.request("/v1/permissions", {
        headers: bearer(adminAccessToken),
      });
      assertEquals(deniedResponse.status, 403);

      await ctx.prisma.userPermission.create({
        data: {
          userId: adminId,
          permissionCode: "permissions.manage",
          granted: true,
          assignedBy: userId,
        },
      });

      const createResponse = await ctx.app.request("/v1/permissions/profiles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...bearer(adminAccessToken),
        },
        body: JSON.stringify({
          name: profileName,
          tier: "admin",
          description: "Created by integration test",
        }),
      });
      const createBody = await readJson(createResponse);
      assertEquals(createResponse.status, 201);
      const profileId = String(createBody.data?.id);
      assert(profileId, "created profile should return id");

      const setCodeResponse = await ctx.app.request(
        `/v1/permissions/profiles/${profileId}/codes/users.read`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...bearer(adminAccessToken),
          },
          body: JSON.stringify({ granted: true }),
        },
      );
      assertEquals(setCodeResponse.status, 200);
    } finally {
      await ctx.prisma.permissionProfile.deleteMany({
        where: { name: { in: [profileName, `${profileName} Updated`] } },
      });
      await ctx.cleanupUsers();
      await ctx.closeDb();
    }
  },
});
