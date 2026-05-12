import * as v from "valibot";

export interface PaginationParams {
  page: number;
  limit: number;
  search?: string;
}

export const paginationQuerySchema = v.object({
  page: v.optional(v.string(), "1"),
  limit: v.optional(v.string(), "20"),
  search: v.optional(v.string(), ""),
});

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface CollectionResult<T> {
  data: T[];
  meta: {
    total: number;
  };
}

/**
 * Trích xuất và validate tham số phân trang từ query string.
 * - Guard NaN: ?page=abc hoặc ?limit=xyz sẽ fallback về giá trị mặc định thay vì lỗi.
 * - Limit tối đa 100 dòng mỗi page để tránh DDOS.
 */
export function extractPagination(
  query: Record<string, string>,
): PaginationParams {
  const rawPage = parseInt(query.page || "1", 10);
  const rawLimit = parseInt(query.limit || "20", 10);

  const page = Math.max(1, isNaN(rawPage) ? 1 : rawPage);
  const limit = Math.min(100, Math.max(1, isNaN(rawLimit) ? 20 : rawLimit));

  return { page, limit, search: query.search };
}
