import type { TableSchema } from "../../core/schema.ts";

export const userSchema: TableSchema = {
  table: "users",
  columns: {
    id: { type: "UUID", primaryKey: true, default: "gen_random_uuid()" },
    username: { type: "VARCHAR", notNull: true, unique: true },
    email: { type: "VARCHAR", notNull: true, unique: true },
    password: { type: "VARCHAR", notNull: true },
    phone: { type: "VARCHAR" },
    active: { type: "BOOLEAN", notNull: true, default: "true" },
    created_at: { type: "TIMESTAMPTZ", notNull: true, default: "NOW()" },
    updated_at: { type: "TIMESTAMPTZ", notNull: true, default: "NOW()" },
  },
  indexes: [
    { name: "idx_users_email", columns: ["email"] },
    { name: "idx_users_username", columns: ["username"] },
    { name: "idx_users_active", columns: ["active"] },
  ],
};
