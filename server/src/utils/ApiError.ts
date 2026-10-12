export type ErrorCode =
  | 'BAD_REQUEST'
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'SERVICE_UNAVAILABLE'
  | 'UPSTREAM_ERROR'
  | 'INTERNAL_ERROR';

export interface ErrorDetail {
  field: string;
  message: string;
}

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;
  readonly details?: ErrorDetail[];
  readonly isOperational = true;

  constructor(statusCode: number, code: ErrorCode, message: string, details?: ErrorDetail[]) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string, details?: ErrorDetail[]) {
    return new ApiError(400, 'BAD_REQUEST', message, details);
  }

  static validation(message: string, details: ErrorDetail[]) {
    return new ApiError(422, 'VALIDATION_ERROR', message, details);
  }

  static unauthorized(message = 'Sign in to continue.') {
    return new ApiError(401, 'UNAUTHORIZED', message);
  }

  static forbidden(message = 'You do not have access to this resource.') {
    return new ApiError(403, 'FORBIDDEN', message);
  }

  static notFound(message = 'That resource does not exist.') {
    return new ApiError(404, 'NOT_FOUND', message);
  }

  static conflict(message: string) {
    return new ApiError(409, 'CONFLICT', message);
  }

  static upstream(message = 'A market data provider did not respond in time.') {
    return new ApiError(502, 'UPSTREAM_ERROR', message);
  }

  static serviceUnavailable(message = 'This service is temporarily unavailable.') {
    return new ApiError(503, 'SERVICE_UNAVAILABLE', message);
  }

  static internal(message = 'Something went wrong on our side.') {
    return new ApiError(500, 'INTERNAL_ERROR', message);
  }
}
