import type { PrismaClient } from "@db";

export async function seedProfiles(prisma: PrismaClient) {
  console.log("Seeding permission profiles & assignments...");

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
    await prisma.permissionProfile.upsert({
      where: { id: p.id },
      update: {},
      create: { ...p, active: true },
    });
  }

  // Grant permissions to profiles
  const profilePerms = [
    { profileId: saleProfileId, permissionCode: "users.read", granted: true },
    { profileId: saleProfileId, permissionCode: "reports.view", granted: true },
    {
      profileId: managerProfileId,
      permissionCode: "users.read",
      granted: true,
    },
    {
      profileId: managerProfileId,
      permissionCode: "users.write",
      granted: true,
    },
    {
      profileId: managerProfileId,
      permissionCode: "reports.view",
      granted: true,
    },
    {
      profileId: managerProfileId,
      permissionCode: "reports.export",
      granted: true,
    },
  ];

  for (const pp of profilePerms) {
    await prisma.profilePermission.upsert({
      where: {
        profileId_permissionCode: {
          profileId: pp.profileId,
          permissionCode: pp.permissionCode,
        },
      },
      update: {},
      create: { ...pp },
    });
  }
  console.log(
    `✅ Seeded ${profiles.length} permission profiles and their permissions.`,
  );

  // Assign to users
  const user1 = await prisma.user.findUnique({
    where: { email: "user1@denolith.dev" },
  });
  const adminUser = await prisma.user.findUnique({
    where: { email: "admin@denolith.dev" },
  });

  if (user1 && adminUser) {
    // Assign profiles
    await prisma.userProfile.upsert({
      where: {
        userId_profileId: { userId: user1.id, profileId: saleProfileId },
      },
      update: {},
      create: { userId: user1.id, profileId: saleProfileId },
    });

    await prisma.userProfile.upsert({
      where: {
        userId_profileId: { userId: adminUser.id, profileId: managerProfileId },
      },
      update: {},
      create: { userId: adminUser.id, profileId: managerProfileId },
    });
    console.log(`✅ Assigned profiles to user1 and admin.`);

    // Set personal override
    await prisma.userPermission.upsert({
      where: {
        userId_permissionCode: {
          userId: user1.id,
          permissionCode: "reports.export",
        },
      },
      update: {},
      create: {
        userId: user1.id,
        permissionCode: "reports.export",
        granted: false,
      },
    });
    console.log(`✅ Seeded personal overrides for user1.`);
  }
}
