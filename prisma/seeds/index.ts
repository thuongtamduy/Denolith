import pkg from "@db";
const { PrismaClient } = pkg;
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { seedRoles } from "./role.seed.ts";
import { seedUsers } from "./user.seed.ts";
import { seedPermissions } from "./permission.seed.ts";
import { seedProfiles } from "./profile.seed.ts";

const connectionString = Deno.env.get("DATABASE_URL") || "";
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Starting database seeding...");

  // Order matters due to foreign key dependencies
  await seedRoles(prisma);
  await seedUsers(prisma);
  await seedPermissions(prisma);
  await seedProfiles(prisma);

  console.log("🌳 Database seeding completed successfully.");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:");
    console.error(e);
    Deno.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
