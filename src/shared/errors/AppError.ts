/**
 * Custom application error with HTTP status code and error code.
 */
export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code: string, statusCode: number = 500) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
  }

  static badRequest(message: string): AppError {
    return new AppError(message, "BAD_REQUEST", 400);
  }

  static unauthorized(message: string): AppError {
    return new AppError(message, "UNAUTHORIZED", 401);
  }

  static forbidden(message: string): AppError {
    return new AppError(message, "FORBIDDEN", 403);
  }

  static notFound(message: string): AppError {
    return new AppError(message, "NOT_FOUND", 404);
  }

  static conflict(message: string): AppError {
    return new AppError(message, "CONFLICT", 409);
  }

  static internal(message: string): AppError {
    return new AppError(message, "INTERNAL_ERROR", 500);
  }
}
