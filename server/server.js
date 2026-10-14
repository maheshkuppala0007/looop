const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
require('dotenv').config();

const http = require('http');
const app = require('./app');
const { connectDB } = require('./config/db');
const { initSockets } = require('./sockets');

const PORT = process.env.PORT || 5000;

// Initialize Database, Socket.IO, and Start HTTP Server
const startServer = async () => {
  try {
    console.log('--- Starting Looop Backend Server ---');
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

    // Connect to PostgreSQL and pre-warm pool
    const { connectPostgres } = require('./config/postgres');
    await connectPostgres();

    // Connect to MongoDB
    await connectDB();

    // Idempotently seed demo accounts and initial products
    const seedDemoData = require('./scripts/seedDemoData');
    seedDemoData().catch((err) => {
      console.warn('[DemoSeeder] Initial demo seed warning:', err.message);
    });

    // Idempotently sync any existing completed transactions with impact events
    const environmentalImpactService = require('./services/environmentalImpactService');
    environmentalImpactService.syncCompletedTransactions().catch((err) => {
      console.warn('[ImpactSync] Initial sync warning:', err.message);
    });

    // Create shared HTTP server
    const httpServer = http.createServer(app);

    // Attach Socket.IO to HTTP server
    initSockets(httpServer);
    console.log('[Looop Socket.IO] Real-time messaging service attached.');

    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`[Looop Server] Listening on port ${PORT} (host: 0.0.0.0)`);
      console.log(`[Looop Server] Health check available at /api/health`);
    });

    // Graceful Shutdown
    const { closeDB } = require('./config/db');
    let isShuttingDown = false;

    const handleShutdown = async (signal) => {
      if (isShuttingDown) return;
      isShuttingDown = true;
      console.log(`\nReceived ${signal}. Shutting down gracefully...`);

      // 1. Stop accepting new HTTP requests
      httpServer.close(async () => {
        console.log('[Looop Server] HTTP and WebSocket connections stopped.');

        // 2. Safely close MongoDB connection pool
        await closeDB();

        console.log('[Looop Server] Clean shutdown complete.');
        process.exit(0);
      });

      // Force exit if cleanup takes longer than 10 seconds
      setTimeout(() => {
        console.error('[Looop Server] Forced shutdown after timeout.');
        process.exit(1);
      }, 10000).unref();
    };

    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
    process.on('SIGINT', () => handleShutdown('SIGINT'));
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();
