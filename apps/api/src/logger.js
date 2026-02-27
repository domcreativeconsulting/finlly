import pino from 'pino';
import { config } from './config/env.js';

const logger = pino({
  level: config.NODE_ENV === 'test' ? 'silent' : 'info',
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: null,
});

export default logger;
