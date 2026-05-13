import { connectMigrationDb } from "../src/core/database.ts";
import { Migrator } from "../src/core/migrator.ts";
import { allMigrations } from "../src/migrations/index.ts";
import { logger } from "../src/core/logger.ts";
import type { Client } from "@db/postgres";

const command = Deno.args[0] || "up";
let db: Client | undefined;

try {
  db = await connectMigrationDb();
  const migrator = new Migrator(db);

  switch (command) {
    case "up": {
      logger.info("🔄 Running pending migrations...");
      const result = await migrator.migrate(allMigrations);

      if (result.applied.length === 0) {
        logger.info("✨ Database is already up to date.");
      } else {
        logger.info(`✅ Applied ${result.applied.length} migration(s).`);
      }
      break;
    }

    case "down": {
      const steps = Number(Deno.args[1]) || 1;
      logger.info(`🔄 Rolling back ${steps} migration(s)...`);
      const result = await migrator.rollback(allMigrations, steps);

      if (result.rolledBack.length === 0) {
        logger.info("✨ No migrations to rollback.");
      } else {
        logger.info(`✅ Rolled back ${result.rolledBack.length} migration(s).`);
      }
      break;
    }

    case "status": {
      await migrator.status(allMigrations);
      break;
    }

    case "reset": {
      logger.warn("⚠ Resetting database — rolling back ALL migrations...");
      const result = await migrator.reset(allMigrations);
      logger.info(
        `✅ Reset complete. Rolled back ${result.rolledBack.length} migration(s).`,
      );
      break;
    }

    default:
      logger.error(`Unknown command: "${command}"`);
      logger.info("Available commands: up, down [N], status, reset");
      Deno.exit(1);
  }
} catch (error) {
  logger.error(`Migration failed: ${(error as Error).message}`);
  Deno.exit(1);
} finally {
  if (db) {
    await db.end();
  }
}
