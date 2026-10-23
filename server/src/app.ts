import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { env, isOriginAllowed } from './config/env.js';
import { db } from './db/client.js';
import { logger } from './utils/logger.js';
import { RoomManager } from './domain/room-manager.js';
import { createRoomsRouter } from './routes/rooms.js';

export function createApp(customRoomManager?: RoomManager) {
  const manager = customRoomManager ?? new RoomManager();
  const app = express();

  // Security headers with Helmet
  app.use(helmet());

  // Strict CORS allowlist
  app.use(
    cors({
      origin: (origin, callback) => {
        if (isOriginAllowed(origin)) {
          callback(null, true);
        } else {
          callback(null, false);
        }
      },
      credentials: true,
    })
  );

  // Payload size limit (10KB per spec)
  app.use(express.json({ limit: '10kb' }));

  // Global REST rate limiter
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
  });
  app.use(limiter);

  // GET /health -> {status: "ok"} (includes SELECT 1 DB check)
  app.get('/health', async (_req: Request, res: Response) => {
    let dbStatus = 'healthy';
    try {
      if (env.DATABASE_URL) {
        await db.$queryRawUnsafe('SELECT 1');
      } else {
        dbStatus = 'unconfigured';
      }
    } catch (err) {
      dbStatus = 'degraded';
      logger.warn({ error: (err as Error).message }, 'Health check database probe failed');
    }

    const isHealthy = dbStatus === 'healthy' || dbStatus === 'unconfigured';
    return res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'ok' : 'degraded',
      database: dbStatus,
      timestamp: new Date().toISOString(),
    });
  });

  // REST API routes
  app.use('/api', createRoomsRouter(manager));

  // Central Error Handler hiding stack traces in production
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error({ message: err.message }, 'Unhandled HTTP error occurred');
    res.status(500).json({
      error: 'Internal Server Error',
      ...(env.NODE_ENV !== 'production' && { message: err.message }),
    });
  });

  return { app, roomManager: manager };
}

export const { app, roomManager } = createApp();
