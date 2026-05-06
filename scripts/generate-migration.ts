import { closeDb, connectDb } from "../src/core/database.ts";
import { diffSchemas, generateMigrationSQL } from "../src/core/schema-diff.ts";
import { logger } from "../src/core/logger.ts";

import { userSchema } from "../src/modules/user/user.schema.ts";
import type { TableSchema } from "../src/core/schema.ts";

const allSchemas: TableSchema[] = [
  userSchema,
];

const migrationName = Deno.args[0];
if (!migrationName) {
  logger.error("Usage: deno task migrate:generate <migration_name>");
  Deno.exit(1);
}

if (!/^[a-z][a-z0-9_]*$/.test(migrationName)) {
  logger.error("Migration name must be lowercase with underscores");
  Deno.exit(1);
}

try {
  const db = await connectDb();
  logger.info("🔍 Comparing schemas against database...");
  const changes = await diffSchemas(db, allSchemas);

  if (changes.length === 0) {
    logger.info("✨ No schema changes detected. Nothing to generate.");
    Deno.exit(0);
  }

  logger.info(`Found ${changes.length} change(s):`);
  for (const change of changes) {
    switch (change.kind) {
      case "create_table":
        logger.info(`  + CREATE TABLE ${change.schema.table}`);
        break;
      case "drop_table":
        logger.info(`  - DROP TABLE ${change.table}`);
        break;
      case "add_column":
        logger.info(`  + ADD COLUMN ${change.table}.${change.column}`);
        break;
      case "drop_column":
        logger.info(`  - DROP COLUMN ${change.table}.${change.column}`);
        break;
      case "modify_column":
        logger.info(`  ~ MODIFY COLUMN ${change.table}.${change.column}`);
        break;
      case "add_index":
        logger.info(`  + ADD INDEX ${change.index.name}`);
        break;
      case "drop_index":
        logger.info(`  - DROP INDEX ${change.index.name}`);
        break;
    }
  }

  const { up, down } = generateMigrationSQL(changes);

  const migrationsDir = new URL("../src/migrations/", import.meta.url);
  let maxVersion = 0;
  for await (const entry of Deno.readDir(migrationsDir)) {
    if (entry.isFile && entry.name.match(/^(\d+)_/)) {
      const v = parseInt(entry.name.match(/^(\d+)_/)![1], 10);
      if (v > maxVersion) maxVersion = v;
    }
  }
  const nextVersion = String(maxVersion + 1).padStart(3, "0");
  const fileName = `${nextVersion}_${migrationName}.ts`;

  const fileContent =
    `import type { Migration } from "../core/migrator.ts";\n\nexport const migration: Migration = {\n  version: "${nextVersion}",\n  name: "${migrationName}",\n  up: \`\n    ${up}\n  \`,\n  down: \`\n    ${down}\n  \`,\n};\n`;

  const filePath = new URL(fileName, migrationsDir);
  await Deno.writeTextFile(filePath, fileContent);
  logger.info(`📝 Generated: src/migrations/${fileName}`);

  const indexPath = new URL("index.ts", migrationsDir);
  let indexContent = await Deno.readTextFile(indexPath);
  const importAlias = `m${nextVersion}`;
  const importLine =
    `import { migration as ${importAlias} } from "./${fileName}";\n`;
  const lastImportIdx = indexContent.lastIndexOf("import ");

  if (lastImportIdx === -1) {
    indexContent = importLine + "\n" + indexContent;
  } else {
    const lineEnd = indexContent.indexOf("\n", lastImportIdx);
    indexContent = indexContent.slice(0, lineEnd + 1) + importLine +
      indexContent.slice(lineEnd + 1);
  }

  if (indexContent.includes("export const allMigrations")) {
    indexContent = indexContent.replace(
      /(\s*)\];/,
      `$1  ${importAlias},\n$1];`,
    );
  }

  await Deno.writeTextFile(indexPath, indexContent);
  logger.info(`📝 Updated: src/migrations/index.ts`);
} catch (error) {
  logger.error(`Generation failed: ${(error as Error).message}`);
  Deno.exit(1);
} finally {
  await closeDb();
}
