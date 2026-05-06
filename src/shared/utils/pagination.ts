export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CollectionResult<T> {
  data: T[];
  total: number;
}

export function extractPagination(
  query: Record<string, string>,
): PaginationParams {
  const page = Math.max(1, parseInt(query.page || "1", 10));
  // Limit tối đa 100 dòng mỗi page để tránh DDOS
  const limit = Math.min(100, Math.max(1, parseInt(query.limit || "20", 10)));

  return { page, limit };
}
