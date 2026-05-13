import { Client } from "@db/postgres";
import { logger } from "./logger.ts";
import { config } from "./config.ts";

const db = new Client(config.databaseUrl);

/**
 * Connect to PostgreSQL
 */
export async function connectDb(): Promise<Client> {
  try {
    await db.connect();
    logger.info("PostgreSQL Database connected.");

    // Tự động chuyển schema (search_path) nếu có chỉ định trong URL
    const url = new URL(config.databaseUrl);
    const schema = url.searchParams.get("schema") ||
      url.searchParams.get("search_path");
    if (schema) {
      await db.queryObject(`SET search_path TO "${schema}"`);
    }

    return db;
  } catch (error) {
    logger.error(`Database connection failed: ${(error as Error).message}`);
    throw error;
  }
}

/**
 * Connect to PostgreSQL via Direct connection (for Migrations/DDL)
 */
export async function connectMigrationDb(): Promise<Client> {
  const directClient = new Client(config.directUrl);
  try {
    await directClient.connect();
    logger.info("PostgreSQL Direct Connection opened for Migrations.");
    return directClient;
  } catch (error) {
    logger.error(
      `Direct Database connection failed: ${(error as Error).message}`,
    );
    throw error;
  }
}

/**
 * Get the database client instance
 */
export function getDb(): Client {
  return db;
}

/**
 * Close the database connection gracefully.
 */
export async function closeDb(): Promise<void> {
  try {
    await db.end();
    logger.info("PostgreSQL Database connection closed.");
  } catch (_e) {
    // Ignore already closed errors
  }
}
