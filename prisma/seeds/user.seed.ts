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
    },
    {
      username: "admin",
      email: "admin@denolith.dev",
      password: "Admin@123456",
      roleCode: "admin",
    },
    {
      username: "user1",
      email: "user1@denolith.dev",
      password: "User1@123456",
      roleCode: "user",
    },
    {
      username: "user2",
      email: "user2@denolith.dev",
      password: "User2@123456",
      roleCode: "user",
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
