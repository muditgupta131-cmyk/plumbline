import type { Request, Response } from 'express';
import { isDatabaseConnected } from '../../config/database.js';
import { env } from '../../config/env.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const VERSION = process.env.npm_package_version ?? '0.1.0';

export const getHealth = asyncHandler(async (_req: Request, res: Response) => {
  const databaseConnected = isDatabaseConnected();

  sendSuccess(res, {
    status: databaseConnected ? 'ok' : 'degraded',
    uptime: process.uptime(),
    environment: env.NODE_ENV,
    version: VERSION,
    services: {
      database: databaseConnected ? 'connected' : 'disconnected',
    },
  });
});
