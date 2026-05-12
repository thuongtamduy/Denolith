import type { PrismaClient } from "@db";

export async function seedPermissions(prisma: PrismaClient) {
  console.log("Seeding permissions...");
  const permissions = [
    ["users.read", "View user list and user details"],
    ["users.write", "Create and update users"],
    ["users.delete", "Soft-delete a user"],
    ["users.restore", "Restore a soft-deleted user"],
    ["users.hard_delete", "Permanently delete a user from the system"],
    ["reports.view", "View reports"],
    ["reports.export", "Export reports to file"],
    [
      "permissions.manage",
      "Manage permission profiles and user access control",
    ],
  ];

  for (const [code, description] of permissions) {
    await prisma.permission.upsert({
      where: { code },
      update: {},
      create: { code, description },
    });
  }
  console.log(`✅ Seeded ${permissions.length} permissions.`);
}
