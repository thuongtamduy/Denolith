import pkg from "@db";
const { PrismaClient } = pkg;
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { seedRoles } from "./role.seed.ts";
import { seedUsers } from "./user.seed.ts";
import { seedPermissions } from "./permission.seed.ts";
import { seedProfiles } from "./profile.seed.ts";
import { seedLanguages } from "./language.seed.ts";
import { seedAppMenus } from "./app-menu.seed.ts";
import { seedStores } from "./store.seed.ts";
import { seedUserStores } from "./user-store.seed.ts";

const connectionString = Deno.env.get("DATABASE_URL") || "";
const pool = new pg.Pool({ connectionString });

// Extract schema from connection string dynamically (defaults to 'public')
let schema = "public";
try {
  const parsedUrl = new URL(connectionString);
  schema = parsedUrl.searchParams.get("schema") || "public";
} catch {
  // Ignore invalid URL
}

// Ensure Prisma adapter uses the correct schema dynamically
const adapter = new PrismaPg(pool, { schema });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Starting database seeding...");

  // Order matters due to foreign key dependencies
  await seedRoles(prisma);
  await seedUsers(prisma);
  await seedPermissions(prisma);
  await seedProfiles(prisma);
  await seedLanguages(prisma);
  await seedAppMenus(prisma);
  await seedStores(prisma);
  await seedUserStores(prisma);

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
