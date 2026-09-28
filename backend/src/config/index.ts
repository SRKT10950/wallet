import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load .env file from root or local
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  APP_NAME: z.string().default('My Wallet'),
  APP_VERSION: z.string().default('1.0.0'),

  DATABASE_HOST: z.string().default('localhost'),
  DATABASE_PORT: z.coerce.number().default(5432),
  DATABASE_NAME: z.string().default('wallet'),
  DATABASE_USER: z.string().default('postgres'),
  DATABASE_PASSWORD: z.string().default('postgres'),
  DATABASE_SSL: z.coerce.boolean().default(false),
  DATABASE_POOL_MIN: z.coerce.number().default(2),
  DATABASE_POOL_MAX: z.coerce.number().default(20),

  REDIS_URL: z.string().optional().default('redis://localhost:6379'),
  REDIS_PASSWORD: z.string().optional(),

  JWT_SECRET: z.string().min(16).default('development_super_secret_jwt_key_at_least_32_characters_long'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(16).default('development_super_secret_refresh_jwt_key_at_least_32_characters_long'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  TRUSTED_PROXY_IPS: z.string().default('127.0.0.1,::1'),
  CORS_ALLOWED_ORIGINS: z.string().default('http://localhost:5173,http://localhost:3000'),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(300),

  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  BOOTSTRAP_ADMIN_EMAIL: z.string().email().default('admin@mywallet.local'),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().default('AdminWallet@2026!'),
  BOOTSTRAP_ADMIN_NAME: z.string().default('Master Administrator'),
  BOOTSTRAP_BUSINESS_NAME: z.string().default('My Wallet Store'),
  BOOTSTRAP_LOCATION_NAME: z.string().default('Main Branch'),
});

export const config = configSchema.parse(process.env);
export type Config = z.infer<typeof configSchema>;
