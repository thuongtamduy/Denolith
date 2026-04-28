// deno run -A --env scratch/test_db.ts
import { closeDb, connectDb } from "../src/core/database.ts";
import { logger } from "../src/core/logger.ts";

async function main() {
  try {
    const db = await connectDb();
    const res = await db.queryObject("SELECT version();");
    logger.info("✅ Connection successful!");
    logger.info("🐘 PostgreSQL Version: " + JSON.stringify(res.rows[0]));
  } catch (e) {
    logger.error("❌ Connection failed: " + e);
  } finally {
    await closeDb();
  }
}

main();
