import pino from 'pino';
import { env } from '../config/env.js';

export const logger = pino({
  level: env.isProduction ? 'info' : 'debug',
  base: undefined,
  timestamp: pino.stdTimeFunctions.isoTime
});

export function getRequestLogger(req) {
  return logger.child({
    requestId: req.requestId,
    method: req.method,
    path: req.path
  });
}
