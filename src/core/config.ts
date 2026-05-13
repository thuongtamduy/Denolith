import * as v from "valibot";
import { logger } from "./logger.ts";

const EnvSchema = v.object({
  PORT: v.optional(v.string(), "3000"),
  DATABASE_URL: v.pipe(v.string(), v.minLength(1, "DATABASE_URL is required")),
  DIRECT_URL: v.optional(v.string()), // Dành cho kết nối trực tiếp (Migration)
  REDIS_URL: v.optional(v.string()),
  JWT_SECRET: v.pipe(
    v.string(),
    v.minLength(
      32,
      "JWT_SECRET phải có ít nhất 32 ký tự ngẫu nhiên để đảm bảo an toàn",
    ),
  ),
  FRONTEND_URL: v.optional(v.string(), "http://localhost:5173"), // Cấu hình bắt buộc cho CORS
  TRUST_PROXY: v.optional(
    v.union([v.literal("true"), v.literal("false")]),
    "false",
  ),
  DENO_ENV: v.optional(
    v.union([
      v.literal("development"),
      v.literal("production"),
      v.literal("test"),
    ]),
    "development",
  ),
  // SMTP — tất cả optional, hệ thống vẫn chạy nếu không có
  SMTP_HOST: v.optional(v.string()),
  SMTP_PORT: v.optional(v.string(), "587"),
  SMTP_USER: v.optional(v.string()),
  SMTP_PASS: v.optional(v.string()),
  SMTP_FROM: v.optional(v.string(), "noreply@denolith.dev"),
  SUPABASE_URL: v.optional(v.string()),
  SUPABASE_SERVICE_ROLE_KEY: v.optional(v.string()),
  STORAGE_TYPE: v.optional(
    v.union([v.literal("local"), v.literal("s3"), v.literal("supabase")]),
    "supabase",
  ),
  S3_ENDPOINT: v.optional(v.string()),
  S3_REGION: v.optional(v.string(), "us-east-1"),
  S3_ACCESS_KEY: v.optional(v.string()),
  S3_SECRET_KEY: v.optional(v.string()),
});

function loadConfig() {
  const envVars = {
    PORT: Deno.env.get("PORT"),
    DATABASE_URL: Deno.env.get("DATABASE_URL"),
    DIRECT_URL: Deno.env.get("DIRECT_URL"),
    REDIS_URL: Deno.env.get("REDIS_URL"),
    JWT_SECRET: Deno.env.get("JWT_SECRET"),
    FRONTEND_URL: Deno.env.get("FRONTEND_URL"),
    TRUST_PROXY: Deno.env.get("TRUST_PROXY"),
    DENO_ENV: Deno.env.get("DENO_ENV"),
    SMTP_HOST: Deno.env.get("SMTP_HOST"),
    SMTP_PORT: Deno.env.get("SMTP_PORT"),
    SMTP_USER: Deno.env.get("SMTP_USER"),
    SMTP_PASS: Deno.env.get("SMTP_PASS"),
    SMTP_FROM: Deno.env.get("SMTP_FROM"),
    SUPABASE_URL: Deno.env.get("SUPABASE_URL"),
    SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    STORAGE_TYPE: Deno.env.get("STORAGE_TYPE"),
    S3_ENDPOINT: Deno.env.get("S3_ENDPOINT"),
    S3_REGION: Deno.env.get("S3_REGION"),
    S3_ACCESS_KEY: Deno.env.get("S3_ACCESS_KEY"),
    S3_SECRET_KEY: Deno.env.get("S3_SECRET_KEY"),
  };

  try {
    const parsed = v.parse(EnvSchema, envVars);
    return {
      port: Number(parsed.PORT),
      databaseUrl: parsed.DATABASE_URL,
      directUrl: parsed.DIRECT_URL || parsed.DATABASE_URL,
      redisUrl: parsed.REDIS_URL,
      jwtSecret: parsed.JWT_SECRET,
      frontendUrl: parsed.FRONTEND_URL,
      trustProxy: parsed.TRUST_PROXY === "true",
      env: parsed.DENO_ENV,
      supabaseUrl: parsed.SUPABASE_URL,
      supabaseServiceRoleKey: parsed.SUPABASE_SERVICE_ROLE_KEY,
      storageType: parsed.STORAGE_TYPE,
      s3: {
        endpoint: parsed.S3_ENDPOINT || "",
        region: parsed.S3_REGION,
        accessKey: parsed.S3_ACCESS_KEY || "",
        secretKey: parsed.S3_SECRET_KEY || "",
      },
      smtp: parsed.SMTP_HOST
        ? {
          host: parsed.SMTP_HOST,
          port: Number(parsed.SMTP_PORT),
          user: parsed.SMTP_USER,
          pass: parsed.SMTP_PASS,
          from: parsed.SMTP_FROM!,
        }
        : null,
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
