import { connect, parseURL } from "@db/redis";
import type { Redis } from "@db/redis";
import { config } from "./config.ts";
import { logger } from "./logger.ts";

export let redisClient: Redis | null = null;

export async function initRedis() {
  if (!config.redisUrl) {
    logger.info("ℹ️ REDIS_URL is not set. Using Memory fallback.");
    return;
  }

  try {
    redisClient = await connect(parseURL(config.redisUrl));
    logger.info("✅ Redis connected.");
  } catch {
    logger.warn("⚠️ Redis connection failed. Falling back to Memory.");
    redisClient = null;
  }
}

export async function closeRedis() {
  if (redisClient) {
    redisClient.close();
    logger.info("🛑 Redis connection closed.");
  }
}
