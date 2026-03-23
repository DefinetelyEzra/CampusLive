import { createServer } from 'node:http';
import { Server } from 'socket.io';
import app from './app.js';
import { logger } from './utils/logger.js';
import { SocketHandler } from './socket/socket.handler.js';
import { startEventCleanupTask } from './utils/eventCleanup.js';
import { SchedulerService } from './services/scheduler.service.js';
import { RoleManagementService } from './services/roleManagement.service.js';

const PORT = process.env.PORT || 3001;

const server = createServer(app);
const API_VERSION = process.env.API_VERSION || 'v1';

// Socket.io setup with CORS
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
        'http://localhost:3000',
        'http://localhost:5173',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:5173'
      ];

      // Allow requests with no origin (like mobile apps or Postman)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        logger.warn(`Socket.IO connection blocked by CORS from origin: ${origin}`);
        return callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: ["Origin", "X-Requested-With", "Content-Type", "Accept", "Authorization"]
  },
  transports: ['polling', 'websocket'], // Try polling first
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000,
  connectTimeout: 45000
});

// Add comprehensive connection logging
io.on('connection', (socket) => {
  logger.info(`Socket.IO client connected: ${socket.id} from ${socket.handshake.address}`);

  socket.on('disconnect', (reason) => {
    logger.info(`Socket.IO client disconnected: ${socket.id}, reason: ${reason}`);
  });

  socket.on('error', (error) => {
    logger.error(`Socket.IO error for ${socket.id}:`, error);
  });
});

io.engine.on('initial_headers', (headers, req) => {
  logger.info(`Socket.IO initial headers for ${req.url}`, {
    origin: req.headers.origin,
    userAgent: req.headers['user-agent']
  });
});

io.engine.on('headers', (headers, req) => {
  headers['Access-Control-Allow-Credentials'] = 'true';
});

// Handle Socket.IO engine errors
io.engine.on('connection_error', (err) => {
  logger.error('Socket.IO engine connection error:', {
    message: err.message,
    description: err.description,
    context: err.context,
    type: err.type
  });
});

// Initialize socket handler
const socketHandler = new SocketHandler(io);
(io as any).socketHandler = socketHandler; // Store reference for access in services

// Start event cleanup task
startEventCleanupTask();

// Start role cleanup scheduler
const startRoleCleanupScheduler = () => {
  // Run cleanup every hour
  const roleCleanupInterval = setInterval(async () => {
    try {
      logger.info('Running scheduled cleanup of expired roles and tokens...');
      await RoleManagementService.cleanupExpiredRoles();
      logger.info('Role cleanup completed successfully');
    } catch (error) {
      logger.error('Role cleanup failed:', error);
    }
  }, 60 * 60 * 1000); // 1 hour

  // Run once immediately on startup
  RoleManagementService.cleanupExpiredRoles()
    .then(() => logger.info('Initial role cleanup completed'))
    .catch(error => logger.error('Initial role cleanup failed:', error));

  return roleCleanupInterval;
};

const roleCleanupInterval = startRoleCleanupScheduler();
// End role cleanup scheduler

// Start event scheduler
const eventScheduler = SchedulerService.getInstance();
eventScheduler.start();
logger.info('Event scheduler started');
// End event scheduler

const gracefulShutdown = (signal: string) => {
  logger.info(`${signal} received, shutting down gracefully`);

  // Stop schedulers
  if (roleCleanupInterval) {
    clearInterval(roleCleanupInterval);
    logger.info('Role cleanup scheduler stopped');
  }

  eventScheduler.stop();
  logger.info('Event scheduler stopped');
  // End schedulers cleanup

  server.close(() => {
    logger.info('HTTP server closed');

    io.close(() => {
      logger.info('Socket.io server closed');
      process.exit(0);
    });
  });

  // Force close after 10 seconds
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', {
    message: error.message,
    stack: error.stack,
    name: error.name
  });
  console.error('\n=== UNCAUGHT EXCEPTION ===');
  console.error('Error:', error.message);
  console.error('Stack:', error.stack);
  console.error('========================\n');

  // ONLY exit in production
  if (process.env.NODE_ENV === 'production') {
    gracefulShutdown('UNCAUGHT_EXCEPTION');
  }
});

process.on('unhandledRejection', (reason: any, promise) => {
  logger.error('Unhandled Rejection', {
    promise,
    reason: reason?.message || reason,
    stack: reason?.stack
  });
  console.error('\n=== UNHANDLED REJECTION ===');
  console.error('Reason:', reason);
  console.error('Promise:', promise);
  console.error('Stack:', reason?.stack);
  console.error('========================\n');

  // ONLY exit in production
  if (process.env.NODE_ENV === 'production') {
    gracefulShutdown('UNHANDLED_REJECTION');
  }
});

server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
  logger.info(`Health check: http://localhost:${PORT}/api/${API_VERSION}/health`);
  logger.info(`Socket.io ready for connections`);
});

// Export server and socketHandler for use in other modules if needed
export { server, io, socketHandler };