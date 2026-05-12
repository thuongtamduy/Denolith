import type { PrismaClient } from "@db";
import { hashPassword } from "../../src/shared/utils/hash.ts";

export async function seedUsers(prisma: PrismaClient) {
  console.log("Seeding users...");
  const users = [
    {
      username: "owner",
      email: "owner@denolith.dev",
      password: "Owner@123456",
      roleCode: "owner",
      firstName: "System",
      lastName: "Owner",
      displayName: "Owner",
      gender: "male",
      bio: "System owner account",
      emailVerified: true,
    },
    {
      username: "admin",
      email: "admin@denolith.dev",
      password: "Admin@123456",
      roleCode: "admin",
      firstName: "Admin",
      lastName: "User",
      displayName: "Admin",
      gender: "male",
      bio: "System administrator",
      emailVerified: true,
    },
    {
      username: "user1",
      email: "user1@denolith.dev",
      password: "User1@123456",
      roleCode: "user",
      firstName: "Nguyễn",
      lastName: "Văn A",
      displayName: "User One",
      gender: "male",
      emailVerified: true,
    },
    {
      username: "user2",
      email: "user2@denolith.dev",
      password: "User2@123456",
      roleCode: "user",
      firstName: "Trần",
      lastName: "Thị B",
      displayName: "User Two",
      gender: "female",
      emailVerified: false,
    },
  ];

  for (const user of users) {
    const hashedPassword = await hashPassword(user.password);
    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: { ...user, password: hashedPassword, active: true },
    });
  }
  console.log(`✅ Seeded ${users.length} users.`);
}
