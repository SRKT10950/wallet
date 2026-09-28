import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Ensure UUID extension
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

  // 1. Businesses
  await knex.schema.createTable('businesses', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.string('name', 255).notNullable();
    table.string('legal_name', 255).nullable();
    table.string('tax_id', 100).nullable();
    table.string('currency', 10).notNullable().defaultTo('USD');
    table.string('phone', 50).nullable();
    table.string('email', 255).nullable();
    table.jsonb('address').nullable();
    table.jsonb('settings').defaultTo('{}');
    table.timestamps(true, true);
  });

  // 2. Locations / Branches
  await knex.schema.createTable('locations', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('business_id').notNullable().references('id').inTable('businesses').onDelete('CASCADE');
    table.string('code', 50).notNullable();
    table.string('name', 255).notNullable();
    table.string('address', 500).nullable();
    table.string('phone', 50).nullable();
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamps(true, true);

    table.unique(['business_id', 'code']);
  });

  // 3. Roles
  await knex.schema.createTable('roles', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.string('name', 50).notNullable().unique();
    table.string('description', 255).nullable();
    table.boolean('is_system').notNullable().defaultTo(false);
    table.timestamps(true, true);
  });

  // 4. Permissions
  await knex.schema.createTable('permissions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.string('name', 100).notNullable().unique();
    table.string('category', 50).notNullable();
    table.string('description', 255).nullable();
    table.timestamps(true, true);
  });

  // 5. Role Permissions
  await knex.schema.createTable('role_permissions', (table) => {
    table.uuid('role_id').notNullable().references('id').inTable('roles').onDelete('CASCADE');
    table.uuid('permission_id').notNullable().references('id').inTable('permissions').onDelete('CASCADE');
    table.primary(['role_id', 'permission_id']);
  });

  // 6. Users
  await knex.schema.createTable('users', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('business_id').notNullable().references('id').inTable('businesses').onDelete('CASCADE');
    table.uuid('default_location_id').nullable().references('id').inTable('locations').onDelete('SET NULL');
    table.string('email', 255).notNullable().unique();
    table.string('phone', 50).nullable();
    table.string('password_hash', 255).notNullable();
    table.string('full_name', 255).notNullable();
    table.boolean('is_active').notNullable().defaultTo(true);
    table.boolean('is_locked').notNullable().defaultTo(false);
    table.integer('failed_login_attempts').notNullable().defaultTo(0);
    table.timestamp('locked_until').nullable();
    table.timestamp('last_login_at').nullable();
    table.timestamps(true, true);
  });

  // 7. User Roles
  await knex.schema.createTable('user_roles', (table) => {
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.uuid('role_id').notNullable().references('id').inTable('roles').onDelete('CASCADE');
    table.primary(['user_id', 'role_id']);
  });

  // 8. Sessions & Refresh Tokens
  await knex.schema.createTable('sessions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('device_id', 100).nullable();
    table.string('ip_address', 64).nullable();
    table.string('user_agent', 500).nullable();
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamp('expires_at').notNullable();
    table.timestamps(true, true);
  });

  await knex.schema.createTable('refresh_tokens', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.uuid('session_id').nullable().references('id').inTable('sessions').onDelete('CASCADE');
    table.string('token_hash', 128).notNullable().unique();
    table.boolean('is_revoked').notNullable().defaultTo(false);
    table.timestamp('expires_at').notNullable();
    table.timestamps(true, true);

    table.index(['token_hash', 'is_revoked']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('refresh_tokens');
  await knex.schema.dropTableIfExists('sessions');
  await knex.schema.dropTableIfExists('user_roles');
  await knex.schema.dropTableIfExists('users');
  await knex.schema.dropTableIfExists('role_permissions');
  await knex.schema.dropTableIfExists('permissions');
  await knex.schema.dropTableIfExists('roles');
  await knex.schema.dropTableIfExists('locations');
  await knex.schema.dropTableIfExists('businesses');
}
