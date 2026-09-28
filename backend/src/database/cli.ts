import { runMigrations, rollbackMigrations } from './migrator.js';
import { seed } from './seeds/initial_bootstrap.js';
import { db } from './index.js';
import path from 'path';
import fs from 'fs';

async function main() {
  const command = process.argv[2];

  try {
    switch (command) {
      case 'up':
      case 'run':
        await runMigrations();
        break;

      case 'rollback':
      case 'down':
        await rollbackMigrations();
        break;

      case 'seed':
        await seed(db);
        break;

      case 'create': {
        const name = process.argv[3];
        if (!name) {
          console.error('Error: Please provide a migration name. e.g. npm run migration:create add_status_column');
          process.exit(1);
        }
        const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
        const fileName = `${timestamp}_${name}.ts`;
        const filePath = path.resolve(process.cwd(), 'src/database/migrations', fileName);
        const template = `import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // TODO: Add schema changes
}

export async function down(knex: Knex): Promise<void> {
  // TODO: Add rollback changes
}
`;
        fs.writeFileSync(filePath, template, 'utf8');
        console.log(`Created migration: ${fileName}`);
        break;
      }

      default:
        console.log('Usage: tsx src/database/cli.ts [up|down|seed|create <name>]');
        break;
    }
  } catch (error) {
    console.error('CLI Command failed:', error);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

main();
