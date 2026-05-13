/**
 * Chuyển chuỗi từ snake_case sang camelCase
 * VD: first_name -> firstName
 */
export function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
}

/**
 * Đệ quy đổi toàn bộ key của một object/array từ snake_case sang camelCase
 */
// deno-lint-ignore no-explicit-any
export function keysToCamelCase(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Date) return obj;

  if (Array.isArray(obj)) {
    return obj.map((v) => keysToCamelCase(v));
  }

  if (typeof obj === "object") {
    // deno-lint-ignore no-explicit-any
    const n: any = {};
    for (const key of Object.keys(obj)) {
      n[toCamelCase(key)] = keysToCamelCase(obj[key]);
    }
    return n;
  }

  return obj;
}

/**
 * Chuyển chuỗi từ camelCase sang snake_case
 * VD: firstName -> first_name
 */
export function toSnakeCase(str: string): string {
  return str.replace(/([A-Z])/g, (g) => `_${g.toLowerCase()}`);
}

/**
 * Đệ quy đổi toàn bộ key của một object/array từ camelCase sang snake_case
 */
// deno-lint-ignore no-explicit-any
export function keysToSnakeCase(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Date) return obj;

  if (Array.isArray(obj)) {
    return obj.map((v) => keysToSnakeCase(v));
  }

  if (typeof obj === "object") {
    // deno-lint-ignore no-explicit-any
    const n: any = {};
    for (const key of Object.keys(obj)) {
      n[toSnakeCase(key)] = keysToSnakeCase(obj[key]);
    }
    return n;
  }

  return obj;
}
