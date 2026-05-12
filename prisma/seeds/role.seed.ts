import type { PrismaClient } from "@db";

export async function seedRoles(prisma: PrismaClient) {
  console.log("Seeding system roles...");
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
    await prisma.role.upsert({
      where: { code: role.code },
      update: {},
      create: { ...role, system: true, active: true },
    });
  }
  console.log(`✅ Seeded ${roles.length} system roles.`);
}
