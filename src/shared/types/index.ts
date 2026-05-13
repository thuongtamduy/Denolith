export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Standard API success response */
export interface ApiResponse<T = unknown> {
  success: true;
  message?: string;
  data?: T;
  meta?: {
    requestId?: string;
    pagination?: PaginationMeta;
    [key: string]: unknown;
  };
}

/** Standard API error response */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>[]; // Chi tiết lỗi validation (VD: mảng các field bị lỗi)
  };
  meta?: {
    requestId?: string;
    [key: string]: unknown;
  };
}
