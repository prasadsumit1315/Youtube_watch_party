import pino from 'pino';
import { env } from '../config/env.js';

const isDev = env.NODE_ENV === 'development';

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      'ip',
      'remoteAddress',
      'req.ip',
      'req.remoteAddress',
      'req.headers["x-forwarded-for"]',
      'token',
      'reconnectToken',
      'authorization',
      'req.headers.authorization',
      'chat',
      'message.text',
      'text',
      'socketId',
    ],
    remove: true,
  },
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          ignore: 'pid,hostname',
          translateTime: 'SYS:standard',
        },
      }
    : undefined,
});
