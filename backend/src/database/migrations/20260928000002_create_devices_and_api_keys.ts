import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 1. Applications (e.g. "My Wallet Android", "My Wallet PWA")
  await knex.schema.createTable('applications', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.string('name', 100).notNullable().unique();
    table.string('app_identifier', 100).notNullable().unique(); // e.g. com.mywallet.app or mywallet-pwa
    table.string('platform', 50).notNullable(); // Android, PWA, Web, Desktop, Server
    table.text('description').nullable();
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamps(true, true);
  });

  // 2. API Keys
  await knex.schema.createTable('api_keys', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('application_id').notNullable().references('id').inTable('applications').onDelete('CASCADE');
    table.uuid('business_id').notNullable().references('id').inTable('businesses').onDelete('CASCADE');
    table.string('name', 100).notNullable();
    table.string('key_prefix', 16).notNullable();
    table.string('key_hash', 128).notNullable().unique();
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamp('expires_at').nullable();
    table.timestamp('revoked_at').nullable();
    table.timestamps(true, true);

    table.index(['key_hash', 'is_active']);
  });

  // 3. Devices
  await knex.schema.createTable('devices', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('business_id').notNullable().references('id').inTable('businesses').onDelete('CASCADE');
    table.uuid('location_id').notNullable().references('id').inTable('locations').onDelete('CASCADE');
    table.uuid('application_id').notNullable().references('id').inTable('applications').onDelete('CASCADE');
    table.string('device_id', 128).notNullable().unique(); // Generated registration installation ID
    table.string('device_name', 100).notNullable();
    table.string('device_type', 50).notNullable(); // Mobile, Desktop, Server, IoT
    table.string('os_version', 100).nullable();
    table.string('app_version', 50).nullable();
    table.string('security_key_hash', 128).notNullable();
    table.string('status', 30).notNullable().defaultTo('ACTIVE'); // PENDING, ACTIVE, SUSPENDED, REVOKED
    table.string('allowed_ip_range', 255).nullable(); // Optional CIDR or comma-separated IPs
    table.string('last_seen_ip', 64).nullable();
    table.timestamp('last_seen_at').nullable();
    table.timestamp('enrolled_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('revoked_at').nullable();
    table.timestamps(true, true);

    table.index(['device_id', 'status']);
    table.index(['location_id']);
  });

  // 4. Immutable Audit Logs
  await knex.schema.createTable('audit_logs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.timestamp('event_timestamp').notNullable().defaultTo(knex.fn.now());
    table.uuid('business_id').nullable().references('id').inTable('businesses').onDelete('SET NULL');
    table.uuid('user_id').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.uuid('device_id').nullable().references('id').inTable('devices').onDelete('SET NULL');
    table.uuid('application_id').nullable().references('id').inTable('applications').onDelete('SET NULL');
    table.uuid('location_id').nullable().references('id').inTable('locations').onDelete('SET NULL');
    table.string('action', 100).notNullable();
    table.string('resource_type', 100).notNullable();
    table.string('resource_id', 128).nullable();
    table.string('ip_address', 64).nullable();
    table.string('user_agent', 500).nullable();
    table.string('request_id', 128).nullable();
    table.boolean('success').notNullable().defaultTo(true);
    table.jsonb('metadata').nullable().defaultTo('{}');

    table.index(['event_timestamp']);
    table.index(['action']);
    table.index(['user_id']);
    table.index(['device_id']);
    table.index(['business_id']);
  });

  // Create Postgres trigger/rule to prevent UPDATE or DELETE on audit_logs (Immutability guarantee)
  await knex.raw(`
    CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
    RETURNS TRIGGER AS $$
    BEGIN
      RAISE EXCEPTION 'Audit logs are strictly immutable and cannot be updated or deleted.';
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER trigger_immutable_audit_logs
    BEFORE UPDATE OR DELETE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification();
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP TRIGGER IF EXISTS trigger_immutable_audit_logs ON audit_logs;');
  await knex.raw('DROP FUNCTION IF EXISTS prevent_audit_log_modification();');
  await knex.schema.dropTableIfExists('audit_logs');
  await knex.schema.dropTableIfExists('devices');
  await knex.schema.dropTableIfExists('api_keys');
  await knex.schema.dropTableIfExists('applications');
}
