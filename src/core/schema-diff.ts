import type { Client } from "@db/postgres";
import type { ColumnDef, IndexDef, PgType, TableSchema } from "./schema.ts";
import {
  columnToAddSQL,
  indexToCreateSQL,
  schemaToCreateSQL,
} from "./schema.ts";

export type SchemaChange =
  | { kind: "create_table"; schema: TableSchema }
  | { kind: "drop_table"; table: string }
  | { kind: "add_column"; table: string; column: string; def: ColumnDef }
  | { kind: "drop_column"; table: string; column: string; oldDef: ColumnDef }
  | {
    kind: "modify_column";
    table: string;
    column: string;
    from: ColumnDef;
    to: ColumnDef;
  }
  | { kind: "add_index"; table: string; index: IndexDef }
  | { kind: "drop_index"; table: string; index: IndexDef };

async function getExistingTables(db: Client): Promise<string[]> {
  const result = await db.queryObject<{ table_name: string }>(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
  `);
  return result.rows.map((r) => r.table_name);
}

async function introspectColumns(
  db: Client,
  table: string,
): Promise<Map<string, ColumnDef>> {
  const result = await db.queryObject<{
    column_name: string;
    data_type: string;
    is_nullable: string;
    column_default: string | null;
  }>(
    `SELECT column_name, data_type, is_nullable, column_default 
     FROM information_schema.columns 
     WHERE table_schema = 'public' AND table_name = $1`,
    [table],
  );

  const pkResult = await db.queryObject<{ column_name: string }>(
    `SELECT a.attname as column_name
     FROM   pg_index i
     JOIN   pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
     WHERE  i.indrelid = $1::regclass AND i.indisprimary;`,
    [table],
  );
  const pks = new Set(pkResult.rows.map((r) => r.column_name));

  const map = new Map<string, ColumnDef>();

  for (const row of result.rows) {
    let type: PgType = "TEXT";
    if (row.data_type.toUpperCase().includes("UUID")) type = "UUID";
    else if (row.data_type.toUpperCase().includes("CHAR")) type = "VARCHAR";
    else if (row.data_type.toUpperCase().includes("INT")) type = "INTEGER";
    else if (row.data_type.toUpperCase().includes("BOOL")) type = "BOOLEAN";
    else if (row.data_type.toUpperCase().includes("TIME WITH TIME ZONE")) {
      type = "TIMESTAMPTZ";
    } else if (row.data_type.toUpperCase().includes("TIME")) type = "TIMESTAMP";

    const def: ColumnDef = {
      type,
      primaryKey: pks.has(row.column_name),
      notNull: row.is_nullable === "NO" || pks.has(row.column_name),
    };
    if (row.column_default !== null) {
      def.default = row.column_default;
    }
    map.set(row.column_name, def);
  }
  return map;
}

export async function diffSchemas(
  db: Client,
  schemas: TableSchema[],
): Promise<SchemaChange[]> {
  const changes: SchemaChange[] = [];
  const existingTables = new Set(await getExistingTables(db));

  for (const schema of schemas) {
    if (!existingTables.has(schema.table)) {
      changes.push({ kind: "create_table", schema });
      continue;
    }

    const currentCols = await introspectColumns(db, schema.table);
    const desiredCols = new Map(Object.entries(schema.columns));

    for (const [name, def] of desiredCols) {
      if (!currentCols.has(name)) {
        changes.push({
          kind: "add_column",
          table: schema.table,
          column: name,
          def,
        });
      }
    }

    for (const [name] of currentCols) {
      if (!desiredCols.has(name)) {
        const oldDef = currentCols.get(name)!;
        changes.push({
          kind: "drop_column",
          table: schema.table,
          column: name,
          oldDef,
        });
      }
    }

    for (const [name, desiredDef] of desiredCols) {
      const currentDef = currentCols.get(name);
      if (!currentDef) continue;
      if (isColumnChanged(currentDef, desiredDef)) {
        changes.push({
          kind: "modify_column",
          table: schema.table,
          column: name,
          from: currentDef,
          to: desiredDef,
        });
      }
    }
    // Note: Indexes introspect is omitted for brevity in Postgres migration script right now
  }

  const desiredTables = new Set(schemas.map((s) => s.table));
  for (const table of existingTables) {
    if (!desiredTables.has(table) && table !== "_migrations") {
      changes.push({ kind: "drop_table", table });
    }
  }

  return changes;
}

function isColumnChanged(current: ColumnDef, desired: ColumnDef): boolean {
  if (desired.primaryKey || current.primaryKey) return false;
  if (current.type !== desired.type) return true;
  if (Boolean(current.notNull) !== Boolean(desired.notNull)) return true;
  return false;
}

export function generateMigrationSQL(
  changes: SchemaChange[],
): { up: string; down: string } {
  const upParts: string[] = [];
  const downParts: string[] = [];

  for (const change of changes) {
    switch (change.kind) {
      case "create_table":
        upParts.push(schemaToCreateSQL(change.schema) + ";");
        for (const idx of change.schema.indexes || []) {
          upParts.push(indexToCreateSQL(change.schema.table, idx) + ";");
        }
        downParts.push(`DROP TABLE IF EXISTS ${change.schema.table} CASCADE;`);
        break;
      case "drop_table":
        upParts.push(`DROP TABLE IF EXISTS ${change.table} CASCADE;`);
        downParts.push(
          `-- TODO: Revert DROP TABLE ${change.table} (Need full schema).`,
        );
        break;
      case "add_column":
        upParts.push(
          columnToAddSQL(change.table, change.column, change.def) + ";",
        );
        downParts.push(
          `ALTER TABLE ${change.table} DROP COLUMN ${change.column};`,
        );
        break;
      case "drop_column":
        upParts.push(
          `ALTER TABLE ${change.table} DROP COLUMN ${change.column};`,
        );
        downParts.push(
          columnToAddSQL(change.table, change.column, change.oldDef) + ";",
        );
        break;
      case "modify_column":
        upParts.push(
          `-- TODO: Column "${change.column}" in "${change.table}" changed type/constraints.`,
          `-- Postgres ALTER TABLE ALTER COLUMN statements needed.`,
        );
        downParts.push(
          `-- TODO: Revert column "${change.column}" modification.`,
        );
        break;
      case "add_index":
        upParts.push(indexToCreateSQL(change.table, change.index) + ";");
        downParts.push(`DROP INDEX IF EXISTS ${change.index.name};`);
        break;
      case "drop_index":
        upParts.push(`DROP INDEX IF EXISTS ${change.index.name};`);
        downParts.push(indexToCreateSQL(change.table, change.index) + ";");
        break;
    }
  }

  return {
    up: upParts.join("\n    ") || "-- No changes",
    down: downParts.join("\n    ") || "-- No changes",
  };
}
