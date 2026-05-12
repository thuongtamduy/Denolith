import type { PrismaClient } from "@db";

export async function seedPermissions(prisma: PrismaClient) {
  console.log("Seeding permissions...");
  const permissions = [
    ["users.read", "users", "View user list and user details"],
    ["users.write", "users", "Create and update users"],
    ["users.delete", "users", "Soft-delete a user"],
    ["users.restore", "users", "Restore a soft-deleted user"],
    ["users.hard_delete", "users", "Permanently delete a user from the system"],
    ["reports.view", "reports", "View reports"],
    ["reports.export", "reports", "Export reports to file"],
    [
      "permissions.manage",
      "permissions",
      "Manage permission profiles and user access control",
    ],
  ];

  for (const [code, module, description] of permissions) {
    await prisma.permission.upsert({
      where: { code },
      update: {},
      create: { code, module, description },
    });
  }
  console.log(`✅ Seeded ${permissions.length} permissions.`);
}
