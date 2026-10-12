import type { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError.js';

export function notFound(req: Request, _res: Response, next: NextFunction): void {
  next(ApiError.notFound(`No route matches ${req.method} ${req.originalUrl}.`));
}
