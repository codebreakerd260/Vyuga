import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import { garmentRoutes } from './routes/garments.ts';
import { tryonRoutes } from './routes/tryon.ts';
import { cartRoutes } from './routes/cart.ts';
import { orderRoutes } from './routes/orders.ts';

const fastify = Fastify({
  logger: true
});

// CORS
await fastify.register(cors, {
  origin: process.env.NODE_ENV === 'production'
    ? 'https://vyuga.vercel.app'
    : 'http://localhost:3000'
});

// File uploads
await fastify.register(multipart, {
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

// Rate limiting
await fastify.register(rateLimit, {
  max: 100,
  timeWindow: '15 minutes'
});

// Health check
fastify.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Routes
await fastify.register(garmentRoutes, { prefix: '/api/garments' });
await fastify.register(tryonRoutes, { prefix: '/api/try-on' });
await fastify.register(cartRoutes, { prefix: '/api/cart' });
await fastify.register(orderRoutes, { prefix: '/api/orders' });

// Start server
const PORT = parseInt(process.env.PORT || '3001');
fastify.listen({ port: PORT, host: '0.0.0.0' }, (err) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  console.log(`🚀 API running on http://localhost:${PORT}`);
});
