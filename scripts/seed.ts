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
    { code: "owner", tier: "owner", name: "Chủ Hệ Thống", description: "Toàn quyền truy cập, bypass mọi permissions" },
    { code: "admin", tier: "admin", name: "Quản Trị Viên", description: "Có quyền quản lý hệ thống dựa theo profile" },
    { code: "user", tier: "user", name: "Người Dùng", description: "Người dùng cơ bản" },
  ];

  for (const role of roles) {
    await db.queryObject(roleSql, [role.code, role.tier, role.name, role.description]);
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
    { username: "owner", email: "owner@denolith.dev",  password: "Owner@123456", role: "owner" },
    { username: "admin", email: "admin@denolith.dev",  password: "Admin@123456", role: "admin" },
    { username: "user1", email: "user1@denolith.dev",  password: "User1@123456", role: "user"  },
    { username: "user2", email: "user2@denolith.dev",  password: "User2@123456", role: "user"  },
  ];

  for (const user of users) {
    const hashedPw = await hashPassword(user.password);
    await db.queryObject(userSql, [user.username, user.email, hashedPw, user.role]);
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
    ["users.read",        "Xem danh sách và thông tin user"],
    ["users.write",       "Tạo mới và cập nhật user"],
    ["users.delete",      "Xóa user (soft delete)"],
    ["users.restore",     "Phục hồi user đã bị xóa"],
    ["users.hard_delete", "Xóa vĩnh viễn user khỏi hệ thống"],
    // Reports
    ["reports.view",      "Xem báo cáo"],
    ["reports.export",    "Xuất báo cáo ra file"],
    // Permission management — chỉ OWNER cấp cho admin
    ["permissions.manage", "Quản lý permission profiles và phân quyền user"],
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
    { id: saleProfileId, name: "Nhân viên Sale", tier: "user", description: "Quyền cơ bản cho sale" },
    { id: managerProfileId, name: "Quản lý Vùng", tier: "admin", description: "Quyền nâng cao cho admin" },
  ];

  for (const p of profiles) {
    await db.queryObject(profileSql, [p.id, p.name, p.tier, p.description]);
  }

  // Cấp quyền cho Profile "Nhân viên Sale"
  await db.queryObject(profilePermSql, [saleProfileId, "users.read", true]);
  await db.queryObject(profilePermSql, [saleProfileId, "reports.view", true]);
  
  // Cấp quyền cho Profile "Quản lý Vùng"
  await db.queryObject(profilePermSql, [managerProfileId, "users.read", true]);
  await db.queryObject(profilePermSql, [managerProfileId, "users.write", true]);
  await db.queryObject(profilePermSql, [managerProfileId, "reports.view", true]);
  await db.queryObject(profilePermSql, [managerProfileId, "reports.export", true]);

  logger.info(`✅ Seeded ${profiles.length} permission profiles and their permissions.`);

  // ─────────────────────────────────────────────
  // SEED: user_profiles & user_permissions
  // ─────────────────────────────────────────────
  
  // Tìm ID của user1 và admin để gán profile
  const user1 = await db.queryObject<{ id: string }>(`SELECT id FROM users WHERE email = 'user1@denolith.dev'`);
  const adminUser = await db.queryObject<{ id: string }>(`SELECT id FROM users WHERE email = 'admin@denolith.dev'`);

  if (user1.rows.length > 0 && adminUser.rows.length > 0) {
    const user1Id = user1.rows[0].id;
    const adminId = adminUser.rows[0].id;

    // 1. Gán Profile cho User
    const assignSql = `
      INSERT INTO user_profiles (user_id, profile_id)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
    `;
    await db.queryObject(assignSql, [user1Id, saleProfileId]);
    await db.queryObject(assignSql, [adminId, managerProfileId]);
    logger.info(`✅ Assigned profiles to user1 and admin.`);

    // 2. Gán Override cá nhân cho User1 (Cấm xuất báo cáo)
    const overrideSql = `
      INSERT INTO user_permissions (user_id, permission_code, granted)
      VALUES ($1, $2, $3)
      ON CONFLICT DO NOTHING
    `;
    await db.queryObject(overrideSql, [user1Id, "reports.export", false]); // Bị cấm explicit
    logger.info(`✅ Seeded personal overrides for user1.`);
  }

} catch (error) {
  logger.error(`Seeding failed: ${(error as Error).message}`);
  Deno.exit(1);
} finally {
  await closeDb();
}

