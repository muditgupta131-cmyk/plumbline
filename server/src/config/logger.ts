import { isProduction } from './env.js';

type Level = 'info' | 'warn' | 'error' | 'debug';

function emit(level: Level, message: string, meta?: Record<string, unknown>): void {
  const entry = {
    level,
    time: new Date().toISOString(),
    message,
    ...meta,
  };

  const line = isProduction ? JSON.stringify(entry) : `${level.toUpperCase()} ${message}${meta ? ` ${JSON.stringify(meta)}` : ''}`;

  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => emit('info', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => emit('warn', message, meta),
  error: (message: string, meta?: Record<string, unknown>) => emit('error', message, meta),
  debug: (message: string, meta?: Record<string, unknown>) => {
    if (!isProduction) emit('debug', message, meta);
  },
};
