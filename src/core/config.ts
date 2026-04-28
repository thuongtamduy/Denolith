import * as v from "valibot";
import { logger } from "./logger.ts";

const EnvSchema = v.object({
  PORT: v.optional(v.string(), "3000"),
  DATABASE_URL: v.pipe(v.string(), v.minLength(1, "DATABASE_URL is required")),
  REDIS_URL: v.optional(v.string()),
  JWT_SECRET: v.pipe(
    v.string(),
    v.minLength(10, "JWT_SECRET must be at least 10 characters long"),
  ),
  DENO_ENV: v.optional(
    v.union([
      v.literal("development"),
      v.literal("production"),
      v.literal("test"),
    ]),
    "development",
  ),
});

function loadConfig() {
  const envVars = {
    PORT: Deno.env.get("PORT"),
    DATABASE_URL: Deno.env.get("DATABASE_URL"),
    REDIS_URL: Deno.env.get("REDIS_URL"),
    JWT_SECRET: Deno.env.get("JWT_SECRET"),
    DENO_ENV: Deno.env.get("DENO_ENV"),
  };

  try {
    const parsed = v.parse(EnvSchema, envVars);
    return {
      port: Number(parsed.PORT),
      databaseUrl: parsed.DATABASE_URL,
      redisUrl: parsed.REDIS_URL,
      jwtSecret: parsed.JWT_SECRET,
      env: parsed.DENO_ENV,
    };
  } catch (error) {
    logger.error("❌ Environment variable validation failed:");
    if (error instanceof v.ValiError) {
      for (const issue of error.issues) {
        // Safe access to the object path
        const key = issue.path?.[0]?.key || "unknown_key";
        logger.error(`  - ${key}: ${issue.message}`);
      }
    } else {
      logger.error(String(error));
    }
    Deno.exit(1);
  }
}

export const config = loadConfig();
