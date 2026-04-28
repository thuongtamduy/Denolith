import type { Client } from "@db/postgres";
import { logger } from "./logger.ts";

export interface Migration {
  version: string;
  name: string;
  up: string;
  down: string;
}

interface MigrationRecord {
  version: string;
  name: string;
  applied_at: string;
}

export class Migrator {
  constructor(private db: Client) {}

  async ensureTable(): Promise<void> {
    await this.db.queryObject(`
      CREATE TABLE IF NOT EXISTS _migrations (
        version     VARCHAR(255) PRIMARY KEY,
        name        VARCHAR(255) NOT NULL,
        applied_at  TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
  }

  async getApplied(): Promise<MigrationRecord[]> {
    await this.ensureTable();
    const result = await this.db.queryObject<MigrationRecord>(
      "SELECT version, name, applied_at FROM _migrations ORDER BY version ASC",
    );
    return result.rows;
  }

  async isApplied(version: string): Promise<boolean> {
    await this.ensureTable();
    const result = await this.db.queryObject(
      "SELECT version FROM _migrations WHERE version = $1",
      [version],
    );
    return result.rows.length > 0;
  }

  async migrate(
    migrations: Migration[],
  ): Promise<{ applied: string[]; skipped: string[] }> {
    await this.ensureTable();
    const sorted = [...migrations].sort((a, b) =>
      a.version.localeCompare(b.version)
    );
    const applied: string[] = [];
    const skipped: string[] = [];

    for (const migration of sorted) {
      if (await this.isApplied(migration.version)) {
        skipped.push(`${migration.version}_${migration.name}`);
        continue;
      }

      logger.info(
        `⬆ Applying migration: ${migration.version}_${migration.name}`,
      );

      const transaction = this.db.createTransaction(`mig_${migration.version}`);
      await transaction.begin();
      try {
        await transaction.queryObject(migration.up);
        await transaction.queryObject(
          "INSERT INTO _migrations (version, name) VALUES ($1, $2)",
          [migration.version, migration.name],
        );
        await transaction.commit();
        applied.push(`${migration.version}_${migration.name}`);
        logger.info(`  ✅ Applied: ${migration.version}_${migration.name}`);
      } catch (error) {
        logger.error(`  ❌ Failed: ${migration.version}_${migration.name}`);
        await transaction.rollback();
        throw error;
      }
    }

    return { applied, skipped };
  }

  async rollback(
    migrations: Migration[],
    steps = 1,
  ): Promise<{ rolledBack: string[] }> {
    await this.ensureTable();
    const appliedRecords = await this.getApplied();
    const toRollback = appliedRecords.slice(-steps).reverse();
    const migrationMap = new Map(migrations.map((m) => [m.version, m]));
    const rolledBack: string[] = [];

    for (const record of toRollback) {
      const migration = migrationMap.get(record.version);
      if (!migration) {
        logger.warn(
          `⚠ Migration definition not found for version: ${record.version}`,
        );
        continue;
      }

      logger.info(`⬇ Rolling back: ${migration.version}_${migration.name}`);

      const transaction = this.db.createTransaction(`rb_${migration.version}`);
      await transaction.begin();
      try {
        await transaction.queryObject(migration.down);
        await transaction.queryObject(
          "DELETE FROM _migrations WHERE version = $1",
          [migration.version],
        );
        await transaction.commit();
        rolledBack.push(`${migration.version}_${migration.name}`);
        logger.info(`  ✅ Rolled back: ${migration.version}_${migration.name}`);
      } catch (error) {
        logger.error(
          `  ❌ Rollback failed: ${migration.version}_${migration.name}`,
        );
        await transaction.rollback();
        throw error;
      }
    }

    return { rolledBack };
  }

  async reset(migrations: Migration[]): Promise<{ rolledBack: string[] }> {
    const applied = await this.getApplied();
    return this.rollback(migrations, applied.length);
  }

  async status(migrations: Migration[]): Promise<void> {
    const appliedRecords = await this.getApplied();
    const applied = new Set(appliedRecords.map((r) => r.version));
    const sorted = [...migrations].sort((a, b) =>
      a.version.localeCompare(b.version)
    );

    logger.info("─── Migration Status ───");
    for (const m of sorted) {
      const status = applied.has(m.version) ? "✅ Applied" : "⏳ Pending";
      logger.info(`  ${status}  ${m.version}_${m.name}`);
    }
    logger.info("────────────────────────");

    const pending = sorted.filter((m) => !applied.has(m.version));
    logger.info(
      `Total: ${sorted.length} | Applied: ${applied.size} | Pending: ${pending.length}`,
    );
  }
}
