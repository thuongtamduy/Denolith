/** Standard API success response */
export interface ApiResponse<T> {
  success: true;
  data: T;
  meta?: {
    requestId?: string;
    [key: string]: unknown;
  };
}

/** Standard API error response */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
  meta?: {
    requestId?: string;
    [key: string]: unknown;
  };
}
