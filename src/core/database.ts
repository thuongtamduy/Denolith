import pkg from "@db";
import type { PrismaClient as PrismaClientType } from "@db";
const { PrismaClient } = pkg;
import { logger } from "./logger.ts";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const isProduction = Deno.env.get("DENO_ENV") === "production";

const connectionString = Deno.env.get("DATABASE_URL") || "";
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);

// Khởi tạo một singleton instance của PrismaClient
export const prisma = new PrismaClient({
  adapter,
  log: isProduction ? ["warn", "error"] : ["query", "info", "warn", "error"],
});

/**
 * Connect to PostgreSQL via Prisma
 */
export async function connectDb(): Promise<PrismaClientType> {
  try {
    await prisma.$connect();
    logger.info("PostgreSQL Database connected via Prisma.");
    return prisma;
  } catch (error) {
    logger.error(`Database connection failed: ${(error as Error).message}`);
    throw error;
  }
}

/**
 * Get the Prisma database client instance
 */
export function getDb(): PrismaClientType {
  return prisma;
}

/**
 * Close the database connection gracefully.
 */
export async function closeDb(): Promise<void> {
  try {
    await prisma.$disconnect();
    logger.info("Prisma connection closed.");
  } catch (_e) {
    // Ignore already closed errors
  }
}

export default prisma;
