import type { Migration } from "../core/migrator.ts";

export const migration: Migration = {
  version: "001",
  name: "users",
  up: `
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username VARCHAR NOT NULL UNIQUE,
      email VARCHAR NOT NULL UNIQUE,
      password VARCHAR NOT NULL,
      phone VARCHAR,
      role VARCHAR NOT NULL DEFAULT 'ADMIN',
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_users_active ON users(active);
  `,
  down: `
    DROP TABLE IF EXISTS users CASCADE;
  `,
};
