import type { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { ApiError, type ErrorDetail } from '../utils/ApiError.js';
import { isProduction } from '../config/env.js';
import { logger } from '../config/logger.js';

function normalise(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (error instanceof ZodError) {
    const details: ErrorDetail[] = error.issues.map((issue) => ({
      field: issue.path.join('.') || 'body',
      message: issue.message,
    }));
    return ApiError.validation('Some fields need attention.', details);
  }

  if (error instanceof mongoose.Error.ValidationError) {
    const details: ErrorDetail[] = Object.values(error.errors).map((item) => ({
      field: item.path,
      message: item.message,
    }));
    return ApiError.validation('Some fields need attention.', details);
  }

  if (error instanceof mongoose.Error.CastError) {
    return ApiError.badRequest(`${error.path} is not a valid identifier.`);
  }

  if (typeof error === 'object' && error !== null && 'code' in error && (error as { code: number }).code === 11000) {
    const key = Object.keys((error as { keyValue?: Record<string, unknown> }).keyValue ?? {})[0] ?? 'value';
    return ApiError.conflict(`That ${key} is already in use.`);
  }

  return ApiError.internal();
}

export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction): void {
  const apiError = normalise(error);

  if (apiError.statusCode >= 500) {
    logger.error(apiError.message, {
      path: req.originalUrl,
      method: req.method,
      stack: isProduction ? undefined : (error as Error)?.stack,
    });
  }

  res.status(apiError.statusCode).json({
    success: false,
    message: apiError.message,
    code: apiError.code,
    ...(apiError.details ? { details: apiError.details } : {}),
  });
}
