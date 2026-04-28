/**
 * Schema Definition Types — Declarative SQL schema for Denolith PostgreSQL entities.
 */

export type PgType =
  | "UUID"
  | "VARCHAR"
  | "TEXT"
  | "INTEGER"
  | "BOOLEAN"
  | "TIMESTAMP"
  | "TIMESTAMPTZ";

export interface ColumnDef {
  type: PgType;
  primaryKey?: boolean;
  notNull?: boolean;
  unique?: boolean;
  /** Raw SQL expression for DEFAULT, e.g. "gen_random_uuid()" or "NOW()" */
  default?: string;
}

export interface IndexDef {
  name: string;
  columns: string[];
  unique?: boolean;
}

export interface ForeignKeyDef {
  column: string;
  referencesTable: string;
  referencesColumn: string;
  onDelete?: "CASCADE" | "SET NULL" | "RESTRICT" | "NO ACTION";
  onUpdate?: "CASCADE" | "SET NULL" | "RESTRICT" | "NO ACTION";
}

export interface TableSchema {
  table: string;
  columns: Record<string, ColumnDef>;
  indexes?: IndexDef[];
  foreignKeys?: ForeignKeyDef[];
}

// ─── SQL Generation Helpers ────────────────────────────────────────

/** Generate full CREATE TABLE SQL from a TableSchema. */
export function schemaToCreateSQL(schema: TableSchema): string {
  const lines: string[] = [];

  // 1. Column definitions
  const colDefs = Object.entries(schema.columns).map(([name, col]) => {
    const parts = [name, col.type];
    if (col.primaryKey) parts.push("PRIMARY KEY");
    if (col.notNull && !col.primaryKey) parts.push("NOT NULL");
    if (col.unique) parts.push("UNIQUE");
    if (col.default !== undefined) parts.push(`DEFAULT ${col.default}`);
    return `    ${parts.join(" ")}`;
  });
  lines.push(...colDefs);

  // 2. Foreign Key constraints
  if (schema.foreignKeys) {
    for (const fk of schema.foreignKeys) {
      let fkStr =
        `    FOREIGN KEY (${fk.column}) REFERENCES ${fk.referencesTable}(${fk.referencesColumn})`;
      if (fk.onDelete) fkStr += ` ON DELETE ${fk.onDelete}`;
      if (fk.onUpdate) fkStr += ` ON UPDATE ${fk.onUpdate}`;
      lines.push(fkStr);
    }
  }

  return `CREATE TABLE IF NOT EXISTS ${schema.table} (\n${
    lines.join(",\n")
  }\n  )`;
}

/** Generate ALTER TABLE ADD COLUMN SQL. */
export function columnToAddSQL(
  table: string,
  name: string,
  col: ColumnDef,
): string {
  const parts = [name, col.type];

  if (col.notNull) {
    parts.push("NOT NULL");
  }
  if (col.default !== undefined) {
    parts.push(`DEFAULT ${col.default}`);
  }
  if (col.unique) parts.push("UNIQUE");

  return `ALTER TABLE ${table} ADD COLUMN ${parts.join(" ")}`;
}

/** Generate CREATE INDEX SQL. */
export function indexToCreateSQL(table: string, idx: IndexDef): string {
  const unique = idx.unique ? "UNIQUE " : "";
  return `CREATE ${unique}INDEX IF NOT EXISTS ${idx.name} ON ${table}(${
    idx.columns.join(", ")
  })`;
}
