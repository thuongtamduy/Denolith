import type { Migration } from "../core/migrator.ts";
import { migration as m001 } from "./001_users.ts";
import { migration as m002 } from "./002_refresh_tokens.ts";

export const allMigrations: Migration[] = [
  m001,
  m002,
];
