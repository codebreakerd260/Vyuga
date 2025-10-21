import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import dotenv from 'dotenv';

// ✅ Import from workspace package
import { prisma } from '@vyuga/database';

import { garmentRoutes } from './routes/garments';
import { tryonRoutes } from './routes/tryon';
import { cartRoutes } from './routes/cart';
import { orderRoutes } from './routes/orders';

// Load environment variables
dotenv.config();

const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info'
  }
});

// Register plugins
async function registerPlugins() {
  await fastify.register(cors, {
    origin: process.env.NODE_ENV === 'production'
      ? process.env.FRONTEND_URL
      : 'http://localhost:3000',
    credentials: true
  });

  await fastify.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
      files: 1
    }
  });

  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: '15 minutes'
  });
}

// Register routes
async function registerRoutes() {
  fastify.get('/health', async () => {
    // Test database connection
    try {
      await prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: 'connected'
      };
    } catch (error) {
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        database: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  await fastify.register(garmentRoutes, { prefix: '/api/garments' });
  await fastify.register(tryonRoutes, { prefix: '/api/try-on' });
  await fastify.register(cartRoutes, { prefix: '/api/cart' });
  await fastify.register(orderRoutes, { prefix: '/api/orders' });
}

// Graceful shutdown
async function closeGracefully(signal: string) {
  console.log(`Received signal ${signal}, closing gracefully...`);
  await prisma.$disconnect();
  await fastify.close();
  process.exit(0);
}

// Start server
async function start() {
  try {
    await registerPlugins();
    await registerRoutes();

    const PORT = parseInt(process.env.PORT || '3001', 10);
    const HOST = process.env.HOST || '0.0.0.0';

    await fastify.listen({ port: PORT, host: HOST });

    console.log(`🚀 API server running on http://${HOST}:${PORT}`);
    console.log(`📊 Health check: http://${HOST}:${PORT}/health`);

    // Setup graceful shutdown
    process.on('SIGTERM', () => closeGracefully('SIGTERM'));
    process.on('SIGINT', () => closeGracefully('SIGINT'));

  } catch (err) {
    fastify.log.error(err);
    await prisma.$disconnect();
    process.exit(1);
  }
}

start();
