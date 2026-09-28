import knex, { Knex } from 'knex';
import { Pool, QueryResult, QueryResultRow } from 'pg';
import { config } from '../config/index.js';

export const pool = new Pool({
  host: config.DATABASE_HOST,
  port: config.DATABASE_PORT,
  database: config.DATABASE_NAME,
  user: config.DATABASE_USER,
  password: config.DATABASE_PASSWORD,
  ssl: config.DATABASE_SSL ? { rejectUnauthorized: false } : false,
  min: config.DATABASE_POOL_MIN,
  max: config.DATABASE_POOL_MAX,
});

export const db: Knex = knex({
  client: 'pg',
  connection: {
    host: config.DATABASE_HOST,
    port: config.DATABASE_PORT,
    database: config.DATABASE_NAME,
    user: config.DATABASE_USER,
    password: config.DATABASE_PASSWORD,
    ssl: config.DATABASE_SSL ? { rejectUnauthorized: false } : false,
  },
  pool: {
    min: config.DATABASE_POOL_MIN,
    max: config.DATABASE_POOL_MAX,
  },
});

export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const start = Date.now();
  const res = await pool.query<T>(text, params);
  const duration = Date.now() - start;
  if (config.NODE_ENV === 'development' && duration > 200) {
    console.warn(`[SLOW QUERY] (${duration}ms): ${text}`);
  }
  return res;
}

export async function testConnection(): Promise<boolean> {
  try {
    const res = await pool.query('SELECT 1 as connected');
    return res.rows[0]?.connected === 1;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}
