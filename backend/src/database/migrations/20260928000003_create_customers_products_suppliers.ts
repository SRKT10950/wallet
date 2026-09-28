import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 1. Customers
  await knex.schema.createTable('customers', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('business_id').notNullable().references('id').inTable('businesses').onDelete('CASCADE');
    table.string('name', 255).notNullable();
    table.string('phone', 50).nullable();
    table.string('email', 255).nullable();
    table.string('tax_number', 100).nullable(); // GST / VAT / Tax ID
    table.string('address', 500).nullable();
    table.string('city', 100).nullable();
    table.string('postal_code', 20).nullable();
    table.decimal('outstanding_balance', 18, 2).notNullable().defaultTo(0.00);
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamps(true, true);

    table.index(['business_id', 'name']);
    table.index(['phone']);
  });

  // 2. Suppliers
  await knex.schema.createTable('suppliers', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('business_id').notNullable().references('id').inTable('businesses').onDelete('CASCADE');
    table.string('name', 255).notNullable();
    table.string('contact_person', 255).nullable();
    table.string('phone', 50).nullable();
    table.string('email', 255).nullable();
    table.string('tax_number', 100).nullable();
    table.string('address', 500).nullable();
    table.decimal('outstanding_balance', 18, 2).notNullable().defaultTo(0.00);
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamps(true, true);

    table.index(['business_id', 'name']);
  });

  // 3. Product Categories
  await knex.schema.createTable('product_categories', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('business_id').notNullable().references('id').inTable('businesses').onDelete('CASCADE');
    table.string('name', 100).notNullable();
    table.string('description', 255).nullable();
    table.timestamps(true, true);

    table.unique(['business_id', 'name']);
  });

  // 4. Products
  await knex.schema.createTable('products', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('business_id').notNullable().references('id').inTable('businesses').onDelete('CASCADE');
    table.uuid('category_id').nullable().references('id').inTable('product_categories').onDelete('SET NULL');
    table.string('sku', 100).nullable();
    table.string('barcode', 100).nullable();
    table.string('name', 255).notNullable();
    table.text('description').nullable();
    table.decimal('cost_price', 18, 2).notNullable().defaultTo(0.00);
    table.decimal('selling_price', 18, 2).notNullable().defaultTo(0.00);
    table.decimal('tax_rate', 5, 2).notNullable().defaultTo(0.00); // e.g. 18.00%
    table.string('unit', 50).notNullable().defaultTo('unit'); // unit, kg, pcs, box
    table.decimal('stock_quantity', 18, 2).notNullable().defaultTo(0.00);
    table.decimal('low_stock_threshold', 18, 2).notNullable().defaultTo(5.00);
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamps(true, true);

    table.index(['business_id', 'name']);
    table.index(['sku']);
    table.index(['barcode']);
  });

  // 5. Purchase Records (Vendor Purchases)
  await knex.schema.createTable('purchase_records', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('business_id').notNullable().references('id').inTable('businesses').onDelete('CASCADE');
    table.uuid('location_id').notNullable().references('id').inTable('locations').onDelete('CASCADE');
    table.uuid('supplier_id').notNullable().references('id').inTable('suppliers').onDelete('RESTRICT');
    table.uuid('created_by_user_id').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    table.string('purchase_number', 100).notNullable();
    table.date('purchase_date').notNullable();
    table.decimal('total_amount', 18, 2).notNullable();
    table.decimal('paid_amount', 18, 2).notNullable().defaultTo(0.00);
    table.string('payment_status', 30).notNullable().defaultTo('UNPAID'); // UNPAID, PARTIALLY_PAID, PAID
    table.string('reference_invoice_no', 100).nullable();
    table.text('notes').nullable();
    table.timestamps(true, true);

    table.unique(['business_id', 'purchase_number']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('purchase_records');
  await knex.schema.dropTableIfExists('products');
  await knex.schema.dropTableIfExists('product_categories');
  await knex.schema.dropTableIfExists('suppliers');
  await knex.schema.dropTableIfExists('customers');
}
