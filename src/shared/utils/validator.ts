import { validator as openapiValidator } from "hono-openapi";
import { AppError } from "../errors/AppError.ts";
import type {
  GenericSchema,
  GenericSchemaAsync,
  InferInput,
  InferOutput,
} from "valibot";
import type { Env, MiddlewareHandler } from "@hono/core";

function extractValidationMessage(
  result: unknown,
  fallback: string,
): string {
  if (typeof result !== "object" || result === null) return fallback;

  const issues = (result as { issues?: unknown }).issues;
  if (!Array.isArray(issues) || issues.length === 0) return fallback;

  const first = issues[0];
  if (typeof first !== "object" || first === null) return fallback;

  const message = (first as { message?: unknown }).message;
  return typeof message === "string" && message.length > 0 ? message : fallback;
}

/**
 * Wrapper cho vValidator của Hono để đồng nhất lỗi trả về theo chuẩn AppError.
 * Đồng thời tự động nhúng schema vào OpenAPI (Swagger).
 */
export const validateJson = <T extends GenericSchema | GenericSchemaAsync>(
  schema: T,
): MiddlewareHandler<
  Env,
  string,
  {
    in: { json: InferInput<T> };
    out: { json: InferOutput<T> };
  }
> => {
  // deno-lint-ignore no-explicit-any
  return openapiValidator("json", schema as any, (result: any, _c: any) => {
    if (!result.success) {
      const message = extractValidationMessage(result, "Invalid input data");
      throw AppError.badRequest(message);
    }
  }) as unknown as MiddlewareHandler<
    Env,
    string,
    {
      in: { json: InferInput<T> };
      out: { json: InferOutput<T> };
    }
  >;
};

export const validateQuery = <T extends GenericSchema | GenericSchemaAsync>(
  schema: T,
): MiddlewareHandler<
  Env,
  string,
  {
    in: { query: InferInput<T> };
    out: { query: InferOutput<T> };
  }
> => {
  // deno-lint-ignore no-explicit-any
  return openapiValidator("query", schema as any, (result: any, _c: any) => {
    if (!result.success) {
      const message = extractValidationMessage(
        result,
        "Invalid query parameters",
      );
      throw AppError.badRequest(message);
    }
  }) as unknown as MiddlewareHandler<
    Env,
    string,
    {
      in: { query: InferInput<T> };
      out: { query: InferOutput<T> };
    }
  >;
};
