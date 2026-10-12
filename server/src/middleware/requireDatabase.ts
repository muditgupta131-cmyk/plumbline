import type { NextFunction, Request, Response } from 'express';
import { isDatabaseConnected } from '../config/database.js';
import { ApiError } from '../utils/ApiError.js';

export function requireDatabase(_req: Request, _res: Response, next: NextFunction): void {
  if (!isDatabaseConnected()) {
    return next(
      ApiError.serviceUnavailable(
        'Auth is unavailable because MongoDB is not connected. Set MONGODB_URI in server/.env and start MongoDB, then restart the server.',
      ),
    );
  }

  next();
}
