import pino from 'pino';
import { sanitizeLogs } from '../utils/sanitizer.js';

const isDevelopment = process.env.NODE_ENV !== 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  timestamp: pino.stdTimeFunctions.isoTime,
  serializers: {
    req: (req) =>
      sanitizeLogs({
        method: req.method,
        url: req.url,
        headers: req.headers,
      }),
    err: pino.stdSerializers.err,
  },
  ...(isDevelopment && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true },
    },
  }),
});
