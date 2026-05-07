import { closeDb, connectDb } from "../src/core/database.ts";
import { logger } from "../src/core/logger.ts";
import { hashPassword } from "../src/shared/utils/hash.ts";

try {
  const db = await connectDb();
  logger.info("Seeding database...");

  // ─────────────────────────────────────────────
  // SEED: roles (System Roles - Bắt buộc phải có trước users)
  // ─────────────────────────────────────────────
  const roleSql = `
    INSERT INTO roles (code, tier, name, description, system, active)
    VALUES ($1, $2, $3, $4, true, true)
    ON CONFLICT (code) DO NOTHING
  `;

  const roles = [
    {
      code: "owner",
      tier: "owner",
      name: "System Owner",
      description: "Full access, bypasses all permission checks",
    },
    {
      code: "admin",
      tier: "admin",
      name: "Administrator",
      description: "Manages the system based on assigned permission profiles",
    },
    {
      code: "user",
      tier: "user",
      name: "Standard User",
      description: "Basic end-user with limited access",
    },
  ];

  for (const role of roles) {
    await db.queryObject(roleSql, [
      role.code,
      role.tier,
      role.name,
      role.description,
    ]);
  }
  logger.info(`✅ Seeded ${roles.length} system roles.`);

  // ─────────────────────────────────────────────
  // SEED: users
  // ─────────────────────────────────────────────
  const userSql = `
    INSERT INTO users (username, email, password, role, active)
    VALUES ($1, $2, $3, $4, true)
    ON CONFLICT (email) DO NOTHING
  `;

  const users = [
    {
      username: "owner",
      email: "owner@denolith.dev",
      password: "Owner@123456",
      role: "owner",
    },
    {
      username: "admin",
      email: "admin@denolith.dev",
      password: "Admin@123456",
      role: "admin",
    },
    {
      username: "user1",
      email: "user1@denolith.dev",
      password: "User1@123456",
      role: "user",
    },
    {
      username: "user2",
      email: "user2@denolith.dev",
      password: "User2@123456",
      role: "user",
    },
  ];

  for (const user of users) {
    const hashedPw = await hashPassword(user.password);
    await db.queryObject(userSql, [
      user.username,
      user.email,
      hashedPw,
      user.role,
    ]);
  }
  logger.info(`✅ Seeded ${users.length} users.`);

  // ─────────────────────────────────────────────
  // SEED: permissions (atomic codes — developer-defined)
  // ─────────────────────────────────────────────
  const permSql = `
    INSERT INTO permissions (code, description)
    VALUES ($1, $2)
    ON CONFLICT (code) DO NOTHING
  `;

  const permissions = [
    // User management
    ["users.read", "View user list and user details"],
    ["users.write", "Create and update users"],
    ["users.delete", "Soft-delete a user"],
    ["users.restore", "Restore a soft-deleted user"],
    ["users.hard_delete", "Permanently delete a user from the system"],
    // Reports
    ["reports.view", "View reports"],
    ["reports.export", "Export reports to file"],
    // Permission management — OWNER only grants this to admins
    [
      "permissions.manage",
      "Manage permission profiles and user access control",
    ],
  ];

  for (const [code, description] of permissions) {
    await db.queryObject(permSql, [code, description]);
  }
  logger.info(`✅ Seeded ${permissions.length} permissions.`);

  // ─────────────────────────────────────────────
  // SEED: permission_profiles & profile_permissions
  // ─────────────────────────────────────────────
  const profileSql = `
    INSERT INTO permission_profiles (id, name, tier, description)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT DO NOTHING
  `;
  const profilePermSql = `
    INSERT INTO profile_permissions (profile_id, permission_code, granted)
    VALUES ($1, $2, $3)
    ON CONFLICT DO NOTHING
  `;

  // ID cố định để dễ seed
  const saleProfileId = "b71e16f8-4e8d-4f0e-8d8a-7e1273932cb5";
  const managerProfileId = "c82f2709-5f9e-501f-9e9b-8f2384043dc6";

  const profiles = [
    {
      id: saleProfileId,
      name: "Sales Representative",
      tier: "user",
      description: "Basic permissions for sales staff",
    },
    {
      id: managerProfileId,
      name: "Regional Manager",
      tier: "admin",
      description: "Advanced permissions for admin-tier managers",
    },
  ];

  for (const p of profiles) {
    await db.queryObject(profileSql, [p.id, p.name, p.tier, p.description]);
  }

  // Grant permissions to "Sales Representative" profile
  await db.queryObject(profilePermSql, [saleProfileId, "users.read", true]);
  await db.queryObject(profilePermSql, [saleProfileId, "reports.view", true]);

  // Grant permissions to "Regional Manager" profile
  await db.queryObject(profilePermSql, [managerProfileId, "users.read", true]);
  await db.queryObject(profilePermSql, [managerProfileId, "users.write", true]);
  await db.queryObject(profilePermSql, [
    managerProfileId,
    "reports.view",
    true,
  ]);
  await db.queryObject(profilePermSql, [
    managerProfileId,
    "reports.export",
    true,
  ]);

  logger.info(
    `✅ Seeded ${profiles.length} permission profiles and their permissions.`,
  );

  // ─────────────────────────────────────────────
  // SEED: user_profiles & user_permissions
  // ─────────────────────────────────────────────

  // Tìm ID của user1 và admin để gán profile
  const user1 = await db.queryObject<{ id: string }>(
    `SELECT id FROM users WHERE email = 'user1@denolith.dev'`,
  );
  const adminUser = await db.queryObject<{ id: string }>(
    `SELECT id FROM users WHERE email = 'admin@denolith.dev'`,
  );

  if (user1.rows.length > 0 && adminUser.rows.length > 0) {
    const user1Id = user1.rows[0].id;
    const adminId = adminUser.rows[0].id;

    // 1. Assign profiles to users
    const assignSql = `
      INSERT INTO user_profiles (user_id, profile_id)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
    `;
    await db.queryObject(assignSql, [user1Id, saleProfileId]);
    await db.queryObject(assignSql, [adminId, managerProfileId]);
    logger.info(`✅ Assigned profiles to user1 and admin.`);

    // 2. Set personal override for user1 (deny reports.export)
    const overrideSql = `
      INSERT INTO user_permissions (user_id, permission_code, granted)
      VALUES ($1, $2, $3)
      ON CONFLICT DO NOTHING
    `;
    await db.queryObject(overrideSql, [user1Id, "reports.export", false]); // Explicitly denied
    logger.info(`✅ Seeded personal overrides for user1.`);
  }
} catch (error) {
  logger.error(`Seeding failed: ${(error as Error).message}`);
  Deno.exit(1);
} finally {
  await closeDb();
}
