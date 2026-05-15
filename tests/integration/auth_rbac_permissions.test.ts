const hasIntegrationEnv = Boolean(
  Deno.env.get("DATABASE_URL") && Deno.env.get("JWT_SECRET"),
);

type JsonResponse = {
  success: boolean;
  data?: Record<string, unknown>;
  error?: { code: string; message: string };
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(message ?? `Expected ${expected}, received ${actual}`);
  }
}

async function readJson(response: Response): Promise<JsonResponse> {
  return await response.json() as JsonResponse;
}

function bearer(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` };
}

function cookieHeader(response: Response) {
  const cookie = response.headers.get("set-cookie");
  return cookie ? { Cookie: cookie.split(";")[0] } : {};
}

Deno.test({
  name: "integration: auth, RBAC and permissions",
  ignore: !hasIntegrationEnv,
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async (t) => {
    const [{ createApp }, { prisma, closeDb }, { hashPassword }] = await Promise
      .all([
        import("../../src/app.ts"),
        import("../../src/core/database.ts"),
        import("../../src/shared/utils/hash.ts"),
      ]);

    const app = createApp();
    const suffix = `${Date.now()}${crypto.randomUUID().slice(0, 8)}`;
    const password = "TestPass123";
    const registeredEmail = `it-user-${suffix}@denolith.test`;
    const registeredUsername = `it_user_${suffix}`;
    const adminEmail = `it-admin-${suffix}@denolith.test`;
    const ownerEmail = `it-owner-${suffix}@denolith.test`;

    const ensureRole = (code: string, tier: string, name: string) =>
      prisma.role.upsert({
        where: { code },
        update: { tier, name, active: true },
        create: { code, tier, name, system: true, active: true },
      });

    const cleanup = async () => {
      await prisma.user.deleteMany({
        where: {
          email: { in: [registeredEmail, adminEmail, ownerEmail] },
        },
      });
    };

    await cleanup();
    await Promise.all([
      ensureRole("owner", "owner", "System Owner"),
      ensureRole("admin", "admin", "Administrator"),
      ensureRole("user", "user", "Standard User"),
      prisma.permission.upsert({
        where: { code: "permissions.manage" },
        update: { active: true },
        create: {
          code: "permissions.manage",
          module: "permissions",
          description: "Manage permission profiles and user access control",
          active: true,
        },
      }),
    ]);

    let userAccessToken = "";
    let userRefreshToken = "";
    let userId = "";
    let adminAccessToken = "";
    let adminId = "";
    let ownerAccessToken = "";

    try {
      await t.step(
        "register returns tokens and sets refresh cookie",
        async () => {
          const response = await app.request("/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              username: registeredUsername,
              email: registeredEmail,
              password,
            }),
          });
          const body = await readJson(response);

          assertEquals(response.status, 201);
          assertEquals(body.success, true);
          assert(body.data?.accessToken, "register should return accessToken");
          assert(
            body.data?.refreshToken,
            "register should return refreshToken",
          );
          assert(
            response.headers.get("set-cookie")?.includes("refresh_token="),
            "register should set refresh_token cookie",
          );

          const user = body.data.user as Record<string, unknown>;
          userId = String(user.id);
          userAccessToken = String(body.data.accessToken);
          userRefreshToken = String(body.data.refreshToken);
        },
      );

      await t.step("login and refresh issue usable access tokens", async () => {
        const loginResponse = await app.request("/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: registeredEmail, password }),
        });
        const loginBody = await readJson(loginResponse);
        assertEquals(loginResponse.status, 200);
        assert(loginBody.data?.accessToken, "login should return accessToken");

        const refreshResponse = await app.request("/v1/auth/refresh", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...cookieHeader(loginResponse),
          },
          body: JSON.stringify({ refreshToken: userRefreshToken }),
        });
        const refreshBody = await readJson(refreshResponse);
        assertEquals(refreshResponse.status, 200);
        assert(
          refreshBody.data?.accessToken,
          "refresh should return accessToken",
        );
        userAccessToken = String(refreshBody.data.accessToken);
      });

      await t.step("RBAC blocks user tier from admin user list", async () => {
        const response = await app.request("/v1/users", {
          headers: bearer(userAccessToken),
        });
        const body = await readJson(response);

        assertEquals(response.status, 403);
        assertEquals(body.error?.code, "FORBIDDEN");
      });

      await t.step(
        "admin tier can access RBAC-protected user list",
        async () => {
          const hashed = await hashPassword(password);
          const admin = await prisma.user.create({
            data: {
              username: `it_admin_${suffix}`,
              email: adminEmail,
              password: hashed,
              roleCode: "admin",
              active: true,
            },
          });
          adminId = admin.id;

          const loginResponse = await app.request("/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: adminEmail, password }),
          });
          const loginBody = await readJson(loginResponse);
          assertEquals(loginResponse.status, 200);
          adminAccessToken = String(loginBody.data?.accessToken);

          const listResponse = await app.request("/v1/users", {
            headers: bearer(adminAccessToken),
          });
          const listBody = await readJson(listResponse);
          assertEquals(listResponse.status, 200);
          assertEquals(listBody.success, true);
        },
      );

      await t.step(
        "permissions.manage is required for permission routes",
        async () => {
          const deniedResponse = await app.request("/v1/permissions", {
            headers: bearer(adminAccessToken),
          });
          const deniedBody = await readJson(deniedResponse);
          assertEquals(deniedResponse.status, 403);
          assertEquals(deniedBody.error?.code, "FORBIDDEN");

          await prisma.userPermission.create({
            data: {
              userId: adminId,
              permissionCode: "permissions.manage",
              granted: true,
              assignedBy: userId,
            },
          });

          const allowedResponse = await app.request("/v1/permissions", {
            headers: bearer(adminAccessToken),
          });
          const allowedBody = await readJson(allowedResponse);
          assertEquals(allowedResponse.status, 200);
          assertEquals(allowedBody.success, true);
        },
      );

      await t.step("owner tier bypasses permission checks", async () => {
        const hashed = await hashPassword(password);
        await prisma.user.create({
          data: {
            username: `it_owner_${suffix}`,
            email: ownerEmail,
            password: hashed,
            roleCode: "owner",
            active: true,
          },
        });

        const loginResponse = await app.request("/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: ownerEmail, password }),
        });
        const loginBody = await readJson(loginResponse);
        assertEquals(loginResponse.status, 200);
        ownerAccessToken = String(loginBody.data?.accessToken);

        const response = await app.request("/v1/permissions", {
          headers: bearer(ownerAccessToken),
        });
        const body = await readJson(response);
        assertEquals(response.status, 200);
        assertEquals(body.success, true);
      });
    } finally {
      await cleanup();
      await closeDb();
    }
  },
});
