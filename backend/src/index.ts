import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { config } from './config/index.js';
import { clientIpMiddleware } from './middlewares/clientIp.js';
import { requestTraceMiddleware } from './middlewares/requestTrace.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { testConnection } from './database/index.js';

// Route imports
import authRoutes from './modules/auth/auth.routes.js';
import deviceRoutes from './modules/devices/devices.routes.js';
import applicationRoutes from './modules/applications/applications.routes.js';
import customerRoutes from './modules/customers/customers.routes.js';
import supplierRoutes from './modules/suppliers/suppliers.routes.js';
import productRoutes from './modules/products/products.routes.js';
import invoiceRoutes from './modules/invoices/invoices.routes.js';
import paymentRoutes from './modules/payments/payments.routes.js';
import expenseRoutes from './modules/expenses/expenses.routes.js';
import dashboardRoutes from './modules/dashboard/dashboard.routes.js';
import reportRoutes from './modules/reports/reports.routes.js';
import userRoutes from './modules/users/users.routes.js';
import auditRoutes from './modules/audit/audit.routes.js';

export const app = express();

// 1. Security & Core Middleware
app.use(helmet({
  contentSecurityPolicy: config.NODE_ENV === 'production',
  crossOriginEmbedderPolicy: false,
}));

const allowedOrigins = config.CORS_ALLOWED_ORIGINS.split(',').map((o) => o.trim());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || config.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Blocked by CORS policy'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-API-Key',
    'X-Device-Security-Key',
    'X-Device-Name',
    'X-Device-Type',
    'X-App-Name',
    'X-Location',
    'X-Request-Id',
  ],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 2. Request Tracing & IP Resolution
app.use(clientIpMiddleware as any);
app.use(requestTraceMiddleware as any);

// 3. Health & Liveness Probe
app.get('/health', async (req, res) => {
  const dbConnected = await testConnection();
  const status = dbConnected ? 'healthy' : 'unhealthy';
  res.status(dbConnected ? 200 : 503).json({
    status,
    timestamp: new Date().toISOString(),
    service: config.APP_NAME,
    version: config.APP_VERSION,
    database: dbConnected ? 'connected' : 'disconnected',
  });
});

// 4. Mount REST API Routes (/api/v1)
const apiRouter = express.Router();

apiRouter.use('/auth', authRoutes);
apiRouter.use('/devices', deviceRoutes);
apiRouter.use('/applications', applicationRoutes);
apiRouter.use('/customers', customerRoutes);
apiRouter.use('/suppliers', supplierRoutes);
apiRouter.use('/products', productRoutes);
apiRouter.use('/invoices', invoiceRoutes);
apiRouter.use('/payments', paymentRoutes);
apiRouter.use('/expenses', expenseRoutes);
apiRouter.use('/dashboard', dashboardRoutes);
apiRouter.use('/reports', reportRoutes);
apiRouter.use('/users', userRoutes);
apiRouter.use('/audit-logs', auditRoutes);

app.use('/api/v1', apiRouter);

// 5. 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    data: null,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `The requested endpoint ${req.method} ${req.originalUrl} does not exist.`,
    },
    requestId: (req as any).id,
  });
});

// 6. Global Error Handler
app.use(errorHandler as any);

// Start server if not imported by test suite
if (process.env.NODE_ENV !== 'test') {
  const startServer = async () => {
    let retries = 15;
    while (retries > 0) {
      const isConnected = await testConnection();
      if (isConnected) break;
      console.log(`[BOOT] Waiting for PostgreSQL database... (${retries} attempts remaining)`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      retries--;
    }

    try {
      const { runMigrations } = await import('./database/migrator.js');
      const { seed } = await import('./database/seeds/initial_bootstrap.js');
      const { db } = await import('./database/index.js');
      await runMigrations();
      await seed(db);
    } catch (err) {
      console.error('[BOOT] Migration/seed during startup error:', err);
    }

    app.listen(config.PORT, () => {
      console.log(`[MY WALLET API] Server started on port ${config.PORT} (${config.NODE_ENV})`);
      console.log(`[MY WALLET API] API Root: http://localhost:${config.PORT}/api/v1`);
    });
  };

  startServer();
}

