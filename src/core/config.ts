import * as v from "valibot";
import { logger } from "./logger.ts";

const EnvSchema = v.object({
  PORT: v.optional(v.string(), "3000"),
  DATABASE_URL: v.pipe(v.string(), v.minLength(1, "DATABASE_URL is required")),
  REDIS_URL: v.optional(v.string()),
  JWT_SECRET: v.pipe(
    v.string(),
    v.minLength(32, "JWT_SECRET phải có ít nhất 32 ký tự ngẫu nhiên để đảm bảo an toàn"),
  ),
  FRONTEND_URL: v.optional(v.string(), "http://localhost:5173"), // Cấu hình bắt buộc cho CORS
  TRUST_PROXY: v.optional(
    v.union([v.literal("true"), v.literal("false")]),
    "false"
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
    FRONTEND_URL: Deno.env.get("FRONTEND_URL"),
    TRUST_PROXY: Deno.env.get("TRUST_PROXY"),
    DENO_ENV: Deno.env.get("DENO_ENV"),
  };

  try {
    const parsed = v.parse(EnvSchema, envVars);
    return {
      port: Number(parsed.PORT),
      databaseUrl: parsed.DATABASE_URL,
      redisUrl: parsed.REDIS_URL,
      jwtSecret: parsed.JWT_SECRET,
      frontendUrl: parsed.FRONTEND_URL,
      trustProxy: parsed.TRUST_PROXY === "true",
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
