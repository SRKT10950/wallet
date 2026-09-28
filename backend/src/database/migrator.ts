import { db } from './index.js';
import path from 'path';
import fs from 'fs';

export async function runMigrations() {
  console.log('[MIGRATION] Checking database migrations...');
  const distPath = path.resolve(process.cwd(), 'dist/database/migrations');
  const srcPath = path.resolve(process.cwd(), 'src/database/migrations');
  const isDist = fs.existsSync(distPath);
  const migrationsDirectory = isDist ? distPath : srcPath;

  try {
    const [batchNo, log] = await db.migrate.latest({
      directory: migrationsDirectory,
      loadExtensions: isDist ? ['.js'] : ['.ts'],
    });
    if (log.length === 0) {
      console.log('[MIGRATION] Database is up to date.');
    } else {
      console.log(`[MIGRATION] Batch ${batchNo} applied: ${log.length} migrations`);
      log.forEach((file: string) => console.log(`  - ${file}`));
    }
  } catch (error) {
    console.error('[MIGRATION] Migration error:', error);
    throw error;
  }
}

export async function rollbackMigrations() {
  console.log('[MIGRATION] Rolling back last migration batch...');
  const distPath = path.resolve(process.cwd(), 'dist/database/migrations');
  const srcPath = path.resolve(process.cwd(), 'src/database/migrations');
  const isDist = fs.existsSync(distPath);
  const migrationsDirectory = isDist ? distPath : srcPath;

  try {
    const [batchNo, log] = await db.migrate.rollback({
      directory: migrationsDirectory,
      loadExtensions: isDist ? ['.js'] : ['.ts'],
    });
    console.log(`[MIGRATION] Batch ${batchNo} rolled back: ${log.length} migrations`);
    log.forEach((file: string) => console.log(`  - ${file}`));
  } catch (error) {
    console.error('[MIGRATION] Rollback error:', error);
    throw error;
  }
}
