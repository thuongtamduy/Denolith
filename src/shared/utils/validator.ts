import { validator as openapiValidator } from "hono-openapi";
import { AppError } from "../errors/AppError.ts";
import type {
  GenericSchema,
  GenericSchemaAsync,
  InferInput,
  InferOutput,
} from "valibot";
import type { Env, MiddlewareHandler } from "@hono/core";

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
      const firstIssue = result.issues[0];
      const message = firstIssue?.message || "Invalid input data";
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
      const firstIssue = result.issues[0];
      const message = firstIssue?.message || "Invalid query parameters";
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
