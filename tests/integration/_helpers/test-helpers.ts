export const hasIntegrationEnv = Boolean(
  Deno.env.get("DATABASE_URL") && Deno.env.get("JWT_SECRET"),
);

export type JsonResponse = {
  success: boolean;
  data?: Record<string, unknown>;
  error?: { code: string; message: string };
};

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function assertEquals<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(message ?? `Expected ${expected}, received ${actual}`);
  }
}

export async function readJson(response: Response): Promise<JsonResponse> {
  return await response.json() as JsonResponse;
}

export function bearer(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` };
}

export async function createTestContext(suffix: string) {
  const [{ createApp }, { prisma, closeDb }, { hashPassword }] = await Promise
    .all([
      import("../../../src/app.ts"),
      import("../../../src/core/database.ts"),
      import("../../../src/shared/utils/hash.ts"),
    ]);

  const app = createApp();
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

  const upsertPermission = (
    code: string,
    module: string,
    description: string,
  ) =>
    prisma.permission.upsert({
      where: { code },
      update: { active: true },
      create: { code, module, description, active: true },
    });

  await Promise.all([
    ensureRole("owner", "owner", "System Owner"),
    ensureRole("admin", "admin", "Administrator"),
    ensureRole("user", "user", "Standard User"),
  ]);

  const cleanupUsers = async () => {
    await prisma.user.deleteMany({
      where: { email: { in: [registeredEmail, adminEmail, ownerEmail] } },
    });
  };

  return {
    app,
    prisma,
    closeDb,
    hashPassword,
    password,
    registeredEmail,
    registeredUsername,
    adminEmail,
    ownerEmail,
    cleanupUsers,
    upsertPermission,
  };
}

