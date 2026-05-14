import { createClient, type RedisClientType } from "@db/redis";
import { config } from "./config.ts";
import { logger } from "./logger.ts";

export let redisClient: RedisClientType | null = null;
export let redisQueueClient: RedisClientType | null = null; // Connection riêng biệt cho Queue BRPOP

export async function initRedis() {
  if (!config.redisUrl) {
    logger.info("ℹ️ REDIS_URL is not set. Using Memory fallback.");
    return;
  }

  try {
    const url = new URL(config.redisUrl);
    // Workaround for Deno 2 / Alpine Linux IPv6 DNS timeout bug with @db/redis:
    // Explicitly resolve the hostname to its IPv4 address to avoid 5-second IPv6 connection timeout.
    const isIpV4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(url.hostname);
    if (!isIpV4) {
      try {
        const ips = await Deno.resolveDns(url.hostname, "A");
        if (ips.length > 0) {
          url.hostname = ips[0];
        }
      } catch (dnsErr) {
        logger.warn(`DNS resolution failed for ${url.hostname}: ${dnsErr}`);
      }
    }

    redisClient = createClient({ url: url.toString() });
    redisQueueClient = createClient({ url: url.toString() });

    await redisClient.connect();
    await redisQueueClient.connect();

    logger.info("✅ Redis connected.");
  } catch (err) {
    logger.warn(`⚠️ Redis connection failed. Falling back to Memory. ${err}`);
    redisClient = null;
    redisQueueClient = null;
  }
}

export async function closeRedis() {
  if (redisClient) {
    await redisClient.quit();
  }
  if (redisQueueClient) {
    await redisQueueClient.quit();
  }
  logger.info("🛑 Redis connections closed.");
}
