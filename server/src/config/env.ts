import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('5000').transform((val) => parseInt(val, 10)),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CLIENT_ORIGIN: z.string().default('https://youtube-watch-party-omega-mocha.vercel.app'),
  DATABASE_URL: z.string().optional(),
  DIRECT_URL: z.string().optional(),
  PERSIST_CHAT: z.string().default('true').transform((val) => val.toLowerCase() !== 'false'),
  LOG_LEVEL: z.string().default('info'),
});

export const env = envSchema.parse(process.env);

export function isOriginAllowed(origin?: string): boolean {
  if (!origin) return true;
  if (env.NODE_ENV === 'development' || env.NODE_ENV === 'test') return true;

  const cleanOrigin = origin.trim().replace(/\/$/, '');
  const cleanClientOrigin = (env.CLIENT_ORIGIN || '').trim().replace(/\/$/, '');

  if (cleanOrigin === cleanClientOrigin) return true;
  if (cleanOrigin === 'https://youtube-watch-party-omega-mocha.vercel.app') return true;
  if (cleanOrigin.endsWith('.vercel.app')) return true;
  if (cleanOrigin.includes('localhost') || cleanOrigin.includes('127.0.0.1')) return true;

  return false;
}
