import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import dotenv from 'dotenv';

import authRoutes from './routes/auth.routes.js';
import locationRoutes from './routes/location.routes.js';
import postRoutes from './routes/post.routes.js';
import eventRoutes from './routes/event.routes.js';
import roleRoutes from './routes/role.routes.js';
import adminRoutes from './routes/admin.routes.js';

import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';
import {
  generalLimiter,
  authLimiter,
  speedLimiter
} from './middleware/security.middleware.js';
import {
  mongoSanitizer,
  xssProtection,
  sanitizeInput
} from './middleware/sanitization.middleware.js';
import { corsOptions } from './config/cors.js';
import { SchedulerService } from './services/scheduler.service.js';
import { logger } from './utils/logger.js';

dotenv.config();

const app = express();

app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'", "https:"],
      frameSrc: ["'none'"],
    },
  },
}));

app.use(cors(corsOptions));

// Body parsing middleware MUST come before sanitization
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting and speed control
app.use(generalLimiter);
app.use(speedLimiter);

// MongoDB injection protection (stores sanitized data in custom properties)
app.use(mongoSanitizer);
// XSS protection (cleans body and headers safely)
app.use(xssProtection);
// General sanitization (combines all sanitized data for route handlers)
app.use(sanitizeInput);

// General middleware
app.use(compression());
app.use(morgan('combined'));

// Initialize scheduler
const scheduler = SchedulerService.getInstance();

const API_VERSION = process.env.API_VERSION || 'v1';

// Health check endpoint with scheduler status
app.get(`/api/${API_VERSION}/health`, (req, res) => {
  const schedulerStatus = scheduler.getStatus();

  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0',
    scheduler: {
      enabled: schedulerStatus.isRunning,
      healthy: scheduler.isHealthy(),
      lastStartCheck: schedulerStatus.lastStartCheck,
      lastEndCheck: schedulerStatus.lastEndCheck,
      stats: {
        eventsStarted: schedulerStatus.startedEventCount,
        eventsEnded: schedulerStatus.endedEventCount
      }
    }
  });
});

// Scheduler control endpoints (for admin use)
app.post('/admin/scheduler/start', (req, res) => {
  try {
    scheduler.start();
    logger.info('Scheduler started via admin endpoint');
    res.json({ message: 'Scheduler started successfully', status: scheduler.getStatus() });
  } catch (error) {
    logger.error('Failed to start scheduler via admin endpoint:', error);
    res.status(500).json({ error: 'Failed to start scheduler' });
  }
});

app.post('/admin/scheduler/stop', (req, res) => {
  try {
    scheduler.stop();
    logger.info('Scheduler stopped via admin endpoint');
    res.json({ message: 'Scheduler stopped successfully', status: scheduler.getStatus() });
  } catch (error) {
    logger.error('Failed to stop scheduler via admin endpoint:', error);
    res.status(500).json({ error: 'Failed to stop scheduler' });
  }
});

app.get('/admin/scheduler/status', (req, res) => {
  const status = scheduler.getStatus();
  res.json({
    ...status,
    healthy: scheduler.isHealthy()
  });
});

app.post('/admin/scheduler/trigger-start-check', async (req, res) => {
  try {
    await scheduler.triggerStartCheck();
    res.json({ message: 'Start check triggered successfully' });
  } catch (error) {
    logger.error('Failed to trigger start check:', error);
    res.status(500).json({ error: 'Failed to trigger start check' });
  }
});

app.post('/admin/scheduler/trigger-end-check', async (req, res) => {
  try {
    await scheduler.triggerEndCheck();
    res.json({ message: 'End check triggered successfully' });
  } catch (error) {
    logger.error('Failed to trigger end check:', error);
    res.status(500).json({ error: 'Failed to trigger end check' });
  }
});

// API routes with specific rate limiting
app.use(`/api/${API_VERSION}/auth`, authLimiter, authRoutes);
app.use(`/api/${API_VERSION}/locations`, locationRoutes);
app.use(`/api/${API_VERSION}/posts`, postRoutes);
app.use(`/api/${API_VERSION}/events`, eventRoutes);
app.use(`/api/${API_VERSION}/roles`, roleRoutes);
app.use(`/api/${API_VERSION}/admin`, adminRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Graceful shutdown handling
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  scheduler.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  scheduler.stop();
  process.exit(0);
});

// Start scheduler after app setup
if (process.env.NODE_ENV !== 'test') {
  // Small delay to ensure all services are ready
  setTimeout(() => {
    scheduler.start();
  }, 2000);
}

export default app;