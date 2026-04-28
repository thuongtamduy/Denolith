import { Client } from "jsr:@db/postgres";

async function createDb() {
  const dbUrl = Deno.env.get("DATABASE_URL");
  if (!dbUrl) {
    console.error("❌ DATABASE_URL is not set in environment.");
    Deno.exit(1);
  }

  // Kết nối vào database mặc định 'postgres' để tạo db mới
  const adminUrl = dbUrl.replace("/denolith", "/postgres");
  const db = new Client(adminUrl);

  try {
    await db.connect();
    await db.queryObject("CREATE DATABASE denolith;");
    console.log("✅ Database 'denolith' created successfully!");
  } catch (e: any) {
    if (e.message && e.message.includes("already exists")) {
      console.log("✅ Database 'denolith' already exists!");
    } else {
      console.error("❌ Failed to create database:", e);
    }
  } finally {
    await db.end();
  }
}

createDb();
