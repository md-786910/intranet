require('express-async-errors');
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');

// Config
const corsOptions = require('./config/cors');
const helmetConfig = require('./config/helmet');
const logger = require('./config/logger');

// Middleware
const requestId = require('./middleware/requestId');
const { globalLimiter } = require('./middleware/rateLimiter');
const sanitize = require('./middleware/sanitize');
const errorHandler = require('./middleware/errorHandler');
const ApiError = require('./utils/ApiError');

// Route imports
const authRoutes = require('./modules/auth/auth.routes');
const orgRoutes = require('./modules/org/org.routes');
const rolesRoutes = require('./modules/roles/roles.routes');
const usersRoutes = require('./modules/users/users.routes');
const employeesRoutes = require('./modules/employees/employees.routes');
const roleCategoriesRoutes = require('./modules/role-categories/role-categories.routes');
const newsRoutes = require('./modules/news/news.routes');
const newsPublicRoutes = require('./modules/news/news-public.routes');
const documentsRoutes = require('./modules/documents/documents.routes');
const pushRoutes = require('./modules/push/push.routes');
const mediaRoutes = require('./modules/media/media.routes');
const categoriesRoutes = require('./modules/categories/categories.routes');
const analyticsRoutes = require('./modules/analytics/analytics.routes');
const chatRoutes = require('./modules/chat/chat.routes');

const app = express();

// ── Security middleware (order matters) ──

// 1. Request ID for tracing
app.use(requestId);

// 2. Security headers (helmet)
app.use(helmetConfig);

// 3. CORS
app.use(cors(corsOptions));

// 4. Compression
app.use(compression());

// 5. Body parsing with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 6. Input sanitization (XSS prevention)
app.use(sanitize);

// 7. Global rate limiting (Redis-backed)
app.use(globalLimiter);

// 8. HTTP request logging
app.use(morgan('combined', { stream: logger.stream }));

// ── Health check (no auth needed) ──
app.get('/api/v1/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ── API routes ──
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/org', orgRoutes);
app.use('/api/v1/roles', rolesRoutes);
app.use('/api/v1/users', usersRoutes);
app.use('/api/v1/employees', employeesRoutes);
app.use('/api/v1/role-categories', roleCategoriesRoutes);
app.use('/api/v1/news', newsRoutes);
app.use('/api/v1/public/news', newsPublicRoutes);
app.use('/api/v1/documents', documentsRoutes);
app.use('/api/v1/push', pushRoutes);
app.use('/api/v1/media', mediaRoutes);
app.use('/api/v1/categories', categoriesRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/chat', chatRoutes);

// Serve uploaded files. Strip frame-blocking headers so the client (running on a
// different dev origin) can preview PDFs / CSVs / text in an iframe. Helmet's
// default X-Frame-Options=SAMEORIGIN otherwise rejects cross-origin iframes,
// which is what blocks PDF preview in the Media drawer.
app.use(
  '/uploads',
  (req, res, next) => {
    res.removeHeader('X-Frame-Options');
    res.removeHeader('Content-Security-Policy');
    next();
  },
  require('express').static(require('path').join(__dirname, '..', 'uploads')),
);

// ── 404 handler ──
app.all('*', (req, res, next) => {
  next(ApiError.notFound(`Cannot ${req.method} ${req.originalUrl}`));
});

// ── Global error handler (MUST be last) ──
app.use(errorHandler);

module.exports = app;
