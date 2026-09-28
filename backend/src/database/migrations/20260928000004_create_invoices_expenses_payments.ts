import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 1. Invoices
  await knex.schema.createTable('invoices', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('business_id').notNullable().references('id').inTable('businesses').onDelete('CASCADE');
    table.uuid('location_id').notNullable().references('id').inTable('locations').onDelete('CASCADE');
    table.uuid('customer_id').nullable().references('id').inTable('customers').onDelete('SET NULL');
    table.uuid('created_by_user_id').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    table.string('invoice_number', 100).notNullable();
    table.date('invoice_date').notNullable();
    table.date('due_date').nullable();
    table.string('payment_status', 30).notNullable().defaultTo('UNPAID'); // UNPAID, PARTIALLY_PAID, PAID, CANCELLED
    table.decimal('subtotal', 18, 2).notNullable().defaultTo(0.00);
    table.decimal('discount_amount', 18, 2).notNullable().defaultTo(0.00);
    table.decimal('tax_amount', 18, 2).notNullable().defaultTo(0.00);
    table.decimal('grand_total', 18, 2).notNullable().defaultTo(0.00);
    table.decimal('amount_paid', 18, 2).notNullable().defaultTo(0.00);
    table.decimal('balance_due', 18, 2).notNullable().defaultTo(0.00);
    table.string('currency', 10).notNullable().defaultTo('USD');
    table.text('notes').nullable();
    table.text('terms').nullable();
    table.boolean('is_cancelled').notNullable().defaultTo(false);
    table.timestamp('cancelled_at').nullable();
    table.uuid('cancelled_by_user_id').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.timestamps(true, true);

    table.unique(['business_id', 'invoice_number']);
    table.index(['business_id', 'invoice_date']);
    table.index(['customer_id']);
    table.index(['payment_status']);
    table.index(['location_id']);
  });

  // 2. Invoice Items
  await knex.schema.createTable('invoice_items', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('invoice_id').notNullable().references('id').inTable('invoices').onDelete('CASCADE');
    table.uuid('product_id').nullable().references('id').inTable('products').onDelete('SET NULL');
    table.string('item_name', 255).notNullable();
    table.decimal('quantity', 18, 2).notNullable();
    table.decimal('unit_price', 18, 2).notNullable();
    table.decimal('discount_rate', 5, 2).notNullable().defaultTo(0.00); // percentage
    table.decimal('tax_rate', 5, 2).notNullable().defaultTo(0.00); // percentage
    table.decimal('line_subtotal', 18, 2).notNullable();
    table.decimal('line_total', 18, 2).notNullable();

    table.index(['invoice_id']);
  });

  // 3. Payments
  await knex.schema.createTable('payments', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('business_id').notNullable().references('id').inTable('businesses').onDelete('CASCADE');
    table.uuid('location_id').notNullable().references('id').inTable('locations').onDelete('CASCADE');
    table.uuid('invoice_id').nullable().references('id').inTable('invoices').onDelete('CASCADE');
    table.uuid('customer_id').nullable().references('id').inTable('customers').onDelete('SET NULL');
    table.uuid('created_by_user_id').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    table.string('payment_number', 100).notNullable();
    table.decimal('amount', 18, 2).notNullable();
    table.string('payment_method', 50).notNullable(); // CASH, CARD, BANK_TRANSFER, UPI, CHEQUE, OTHER
    table.string('reference_number', 100).nullable();
    table.date('payment_date').notNullable();
    table.text('notes').nullable();
    table.timestamps(true, true);

    table.unique(['business_id', 'payment_number']);
    table.index(['business_id', 'payment_date']);
    table.index(['invoice_id']);
  });

  // 4. Expense Categories
  await knex.schema.createTable('expense_categories', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('business_id').notNullable().references('id').inTable('businesses').onDelete('CASCADE');
    table.string('name', 100).notNullable();
    table.string('description', 255).nullable();
    table.boolean('is_default').notNullable().defaultTo(false);
    table.timestamps(true, true);

    table.unique(['business_id', 'name']);
  });

  // 5. Expenses
  await knex.schema.createTable('expenses', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('business_id').notNullable().references('id').inTable('businesses').onDelete('CASCADE');
    table.uuid('location_id').notNullable().references('id').inTable('locations').onDelete('CASCADE');
    table.uuid('category_id').notNullable().references('id').inTable('expense_categories').onDelete('RESTRICT');
    table.uuid('created_by_user_id').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    table.date('expense_date').notNullable();
    table.decimal('amount', 18, 2).notNullable();
    table.string('currency', 10).notNullable().defaultTo('USD');
    table.string('payment_method', 50).notNullable().defaultTo('CASH');
    table.string('reference', 100).nullable();
    table.text('description').notNullable();
    table.text('notes').nullable();
    table.timestamps(true, true);

    table.index(['business_id', 'expense_date']);
    table.index(['category_id']);
    table.index(['location_id']);
  });

  // 6. Settings
  await knex.schema.createTable('settings', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('business_id').notNullable().references('id').inTable('businesses').onDelete('CASCADE');
    table.string('key', 100).notNullable();
    table.jsonb('value').notNullable();
    table.timestamps(true, true);

    table.unique(['business_id', 'key']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('settings');
  await knex.schema.dropTableIfExists('expenses');
  await knex.schema.dropTableIfExists('expense_categories');
  await knex.schema.dropTableIfExists('payments');
  await knex.schema.dropTableIfExists('invoice_items');
  await knex.schema.dropTableIfExists('invoices');
}
