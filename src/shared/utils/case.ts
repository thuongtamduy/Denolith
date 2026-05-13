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
