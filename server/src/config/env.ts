import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('5000').transform((val) => parseInt(val, 10)),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.string().optional(),
  DIRECT_URL: z.string().optional(),
  PERSIST_CHAT: z.string().default('false').transform((val) => val.toLowerCase() === 'true'),
  LOG_LEVEL: z.string().default('info'),
});

export const env = envSchema.parse(process.env);
