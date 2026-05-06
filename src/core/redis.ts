import { connect, parseURL } from "@db/redis";
import type { Redis } from "@db/redis";
import { config } from "./config.ts";
import { logger } from "./logger.ts";

export let redisClient: Redis | null = null;
export let redisQueueClient: Redis | null = null; // Connection riêng biệt cho Queue BRPOP

export async function initRedis() {
  if (!config.redisUrl) {
    logger.info("ℹ️ REDIS_URL is not set. Using Memory fallback.");
    return;
  }

  try {
    const url = new URL(config.redisUrl);
    // Workaround for Deno 2 / Alpine Linux IPv6 DNS timeout bug with @db/redis:
    // Explicitly resolve the hostname to its IPv4 address to avoid 5-second IPv6 connection timeout.
    const ips = await Deno.resolveDns(url.hostname, "A");
    if (ips.length > 0) {
      url.hostname = ips[0];
    }

    redisClient = await connect(parseURL(url.toString()));
    redisQueueClient = await connect(parseURL(url.toString()));
    logger.info("✅ Redis connected.");
  } catch (err) {
    logger.warn(`⚠️ Redis connection failed. Falling back to Memory. ${err}`);
    redisClient = null;
    redisQueueClient = null;
  }
}

export async function closeRedis() {
  if (redisClient) {
    redisClient.close();
  }
  if (redisQueueClient) {
    redisQueueClient.close();
  }
  logger.info("🛑 Redis connections closed.");
}
