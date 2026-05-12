import type { PrismaClient } from "@db";

export async function seedRoles(prisma: PrismaClient) {
  console.log("Seeding system roles...");
  const roles = [
    {
      code: "owner",
      tier: "owner",
      name: "System Owner",
      description: "Full access, bypasses all permission checks",
      color: "#8B5CF6",
      icon: "crown",
      sortOrder: 0,
    },
    {
      code: "admin",
      tier: "admin",
      name: "Administrator",
      description: "Manages the system based on assigned permission profiles",
      color: "#EF4444",
      icon: "shield",
      sortOrder: 1,
    },
    {
      code: "user",
      tier: "user",
      name: "Standard User",
      description: "Basic end-user with limited access",
      color: "#3B82F6",
      icon: "user",
      sortOrder: 2,
    },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { code: role.code },
      update: {},
      create: { ...role, system: true, active: true },
    });
  }
  console.log(`✅ Seeded ${roles.length} system roles.`);
}
