import type { Migration } from "../core/migrator.ts";
import { migration as m001 } from "./001_init.ts";

export const allMigrations: Migration[] = [
  m001,
];
