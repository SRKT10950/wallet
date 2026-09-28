import { Knex } from 'knex';
import { hashPassword, hashKey } from '../../utils/crypto.js';
import { config } from '../../config/index.js';

export async function seed(knex: Knex): Promise<void> {
  console.log('[SEED] Starting initial bootstrap seeding...');

  // 1. Permissions List
  const permissionsList = [
    { name: 'invoice:create', category: 'invoices', description: 'Create sales invoices' },
    { name: 'invoice:read', category: 'invoices', description: 'View sales invoices' },
    { name: 'invoice:update', category: 'invoices', description: 'Modify draft/unpaid invoices' },
    { name: 'invoice:delete', category: 'invoices', description: 'Cancel or delete invoices' },
    { name: 'invoice:pdf', category: 'invoices', description: 'Download invoice PDF' },

    { name: 'payment:create', category: 'payments', description: 'Record invoice payments' },
    { name: 'payment:read', category: 'payments', description: 'View payments' },

    { name: 'expense:create', category: 'expenses', description: 'Record new business expenses' },
    { name: 'expense:read', category: 'expenses', description: 'View expenses and summaries' },
    { name: 'expense:update', category: 'expenses', description: 'Edit recorded expenses' },
    { name: 'expense:delete', category: 'expenses', description: 'Remove expenses' },

    { name: 'customer:create', category: 'customers', description: 'Register customers' },
    { name: 'customer:read', category: 'customers', description: 'View customer directory' },
    { name: 'customer:update', category: 'customers', description: 'Update customer details' },
    { name: 'customer:delete', category: 'customers', description: 'Deactivate customer' },

    { name: 'supplier:manage', category: 'suppliers', description: 'Manage vendors and suppliers' },
    { name: 'product:manage', category: 'products', description: 'Manage inventory and products' },
    { name: 'reports:read', category: 'reports', description: 'View business summaries and financial reports' },
    { name: 'devices:manage', category: 'devices', description: 'Enroll, activate, suspend, or revoke devices' },
    { name: 'users:manage', category: 'users', description: 'Manage system users and access roles' },
    { name: 'settings:manage', category: 'settings', description: 'Configure business and application settings' },
    { name: 'audit:read', category: 'audit', description: 'Inspect immutable security and audit logs' },
  ];

  for (const perm of permissionsList) {
    const existing = await knex('permissions').where({ name: perm.name }).first();
    if (!existing) {
      await knex('permissions').insert(perm);
    }
  }

  // 2. Roles
  const roles = [
    { name: 'OWNER', description: 'Business Owner with complete system privileges', is_system: true },
    { name: 'ADMIN', description: 'System Administrator with device and staff management', is_system: true },
    { name: 'MANAGER', description: 'Shop Manager with sales, expenses, and report access', is_system: true },
    { name: 'STAFF', description: 'Sales Staff for billing, invoicing, and recording expenses', is_system: true },
    { name: 'VIEWER', description: 'Read-only observer for auditing and reporting', is_system: true },
  ];

  for (const role of roles) {
    const existing = await knex('roles').where({ name: role.name }).first();
    if (!existing) {
      await knex('roles').insert(role);
    }
  }

  // Assign all permissions to OWNER and ADMIN
  const allPermissions = await knex('permissions').select('id', 'name');
  const ownerRole = await knex('roles').where({ name: 'OWNER' }).first();
  const adminRole = await knex('roles').where({ name: 'ADMIN' }).first();
  const managerRole = await knex('roles').where({ name: 'MANAGER' }).first();
  const staffRole = await knex('roles').where({ name: 'STAFF' }).first();
  const viewerRole = await knex('roles').where({ name: 'VIEWER' }).first();

  for (const p of allPermissions) {
    if (ownerRole) {
      await knex('role_permissions').insert({ role_id: ownerRole.id, permission_id: p.id }).onConflict(['role_id', 'permission_id']).ignore();
    }
    if (adminRole) {
      await knex('role_permissions').insert({ role_id: adminRole.id, permission_id: p.id }).onConflict(['role_id', 'permission_id']).ignore();
    }
    if (managerRole && !['devices:manage', 'settings:manage', 'audit:read'].includes(p.name)) {
      await knex('role_permissions').insert({ role_id: managerRole.id, permission_id: p.id }).onConflict(['role_id', 'permission_id']).ignore();
    }
    if (staffRole && ['invoice:create', 'invoice:read', 'invoice:pdf', 'payment:create', 'payment:read', 'expense:create', 'expense:read', 'customer:create', 'customer:read', 'product:manage'].includes(p.name)) {
      await knex('role_permissions').insert({ role_id: staffRole.id, permission_id: p.id }).onConflict(['role_id', 'permission_id']).ignore();
    }
    if (viewerRole && p.name.endsWith(':read')) {
      await knex('role_permissions').insert({ role_id: viewerRole.id, permission_id: p.id }).onConflict(['role_id', 'permission_id']).ignore();
    }
  }

  // 3. Default Business
  let business = await knex('businesses').first();
  if (!business) {
    const [created] = await knex('businesses').insert({
      name: config.BOOTSTRAP_BUSINESS_NAME,
      legal_name: `${config.BOOTSTRAP_BUSINESS_NAME} Ltd.`,
      tax_id: 'GSTIN29ABCDE1234F1Z5',
      currency: 'USD',
      phone: '+1-555-019-9000',
      email: config.BOOTSTRAP_ADMIN_EMAIL,
      address: JSON.stringify({
        street: '100 Market Street',
        city: 'New York',
        state: 'NY',
        zip: '10001',
        country: 'USA'
      }),
      settings: JSON.stringify({
        invoicePrefix: 'INV',
        taxRate: 5.0,
        enableSmsReceipts: false,
      }),
    }).returning('*');
    business = created;
    console.log(`[SEED] Created default business: ${business.name} (${business.id})`);
  }

  // 4. Default Location
  let location = await knex('locations').where({ business_id: business.id }).first();
  if (!location) {
    const [createdLoc] = await knex('locations').insert({
      business_id: business.id,
      code: 'MAIN',
      name: config.BOOTSTRAP_LOCATION_NAME,
      address: '100 Market Street, Suite 1A',
      phone: '+1-555-019-9001',
      is_active: true,
    }).returning('*');
    location = createdLoc;
    console.log(`[SEED] Created primary location: ${location.name} (${location.id})`);
  }

  // 5. Default Administrator User
  const adminPasswordHash = await hashPassword(config.BOOTSTRAP_ADMIN_PASSWORD);
  let adminUser = await knex('users').where({ email: config.BOOTSTRAP_ADMIN_EMAIL }).first();
  if (!adminUser) {
    const [createdUser] = await knex('users').insert({
      business_id: business.id,
      default_location_id: location.id,
      email: config.BOOTSTRAP_ADMIN_EMAIL,
      phone: '+15550199000',
      password_hash: adminPasswordHash,
      full_name: config.BOOTSTRAP_ADMIN_NAME,
      is_active: true,
    }).returning('*');
    adminUser = createdUser;
    console.log(`[SEED] Created admin user: ${adminUser.email}`);

    // Assign OWNER role
    if (ownerRole) {
      await knex('user_roles').insert({ user_id: adminUser.id, role_id: ownerRole.id });
    }
  }

  // 6. Registered Applications (Android & PWA)
  const apps = [
    { name: 'My Wallet Android', app_identifier: 'com.mywallet.android', platform: 'Android', description: 'Official Android Mobile Application' },
    { name: 'My Wallet PWA', app_identifier: 'com.mywallet.pwa', platform: 'PWA', description: 'Official Progressive Web App for desktop & mobile' },
  ];

  for (const app of apps) {
    let existingApp = await knex('applications').where({ app_identifier: app.app_identifier }).first();
    if (!existingApp) {
      const [newApp] = await knex('applications').insert(app).returning('*');
      existingApp = newApp;
    }

    // Seed default standard API Key for each application
    const rawApiKey = app.platform === 'Android' ? 'mw_live_android_app_key_secure_2026' : 'mw_live_pwa_web_app_key_secure_2026';
    const keyHash = hashKey(rawApiKey);
    const existingKey = await knex('api_keys').where({ key_hash: keyHash }).first();
    if (!existingKey) {
      await knex('api_keys').insert({
        application_id: existingApp.id,
        business_id: business.id,
        name: `Default ${app.platform} API Key`,
        key_prefix: rawApiKey.substring(0, 8),
        key_hash: keyHash,
        is_active: true,
      });
      console.log(`[SEED] Issued API Key for ${app.name}: ${rawApiKey}`);
    }
  }

  // 7. Seed Default Expense Categories
  const categories = [
    'Rent', 'Electricity', 'Transport', 'Salary', 'Inventory',
    'Maintenance', 'Packaging', 'Internet', 'Miscellaneous'
  ];
  for (const catName of categories) {
    const existing = await knex('expense_categories').where({ business_id: business.id, name: catName }).first();
    if (!existing) {
      await knex('expense_categories').insert({
        business_id: business.id,
        name: catName,
        is_default: true,
      });
    }
  }

  // 8. Seed Default Product Category & Sample Products
  let prodCat = await knex('product_categories').where({ business_id: business.id, name: 'General Retail' }).first();
  if (!prodCat) {
    const [newCat] = await knex('product_categories').insert({
      business_id: business.id,
      name: 'General Retail',
      description: 'Default retail items',
    }).returning('*');
    prodCat = newCat;

    await knex('products').insert([
      {
        business_id: business.id,
        category_id: prodCat.id,
        sku: 'SKU-COFFEE-01',
        barcode: '8901234567890',
        name: 'Premium Roast Coffee 500g',
        cost_price: 8.50,
        selling_price: 15.00,
        tax_rate: 5.00,
        unit: 'pack',
        stock_quantity: 45.00,
      },
      {
        business_id: business.id,
        category_id: prodCat.id,
        sku: 'SKU-SUGAR-01',
        barcode: '8901234567891',
        name: 'Organic Brown Sugar 1kg',
        cost_price: 2.20,
        selling_price: 4.50,
        tax_rate: 0.00,
        unit: 'kg',
        stock_quantity: 120.00,
      },
      {
        business_id: business.id,
        category_id: prodCat.id,
        sku: 'SKU-BISCUIT-01',
        barcode: '8901234567892',
        name: 'Butter Cookies Tin 400g',
        cost_price: 4.00,
        selling_price: 7.99,
        tax_rate: 5.00,
        unit: 'tin',
        stock_quantity: 60.00,
      }
    ]);
  }

  // 9. Sample Customer
  const existingCust = await knex('customers').where({ business_id: business.id, name: 'Walk-in Customer' }).first();
  if (!existingCust) {
    await knex('customers').insert({
      business_id: business.id,
      name: 'Walk-in Customer',
      phone: '+1-555-010-0000',
      email: 'walkin@customer.local',
      address: 'Cash Counter',
      outstanding_balance: 0.00,
    });
  }

  console.log('[SEED] Seeding completed successfully.');
}
