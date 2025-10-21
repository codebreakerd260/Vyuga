import { FastifyPluginAsync } from 'fastify';
import { prisma } from '@vyuga/database';
import { z } from 'zod';

export const cartRoutes: FastifyPluginAsync = async (fastify) => {

  // GET /api/cart - Get user's cart
  fastify.get('/', async (request, reply) => {
    const userId = request.headers['x-user-id'] as string; // From Clerk middleware
    const sessionId = request.headers['x-session-id'] as string; // Guest cart

    if (!userId && !sessionId) {
      return reply.code(400).send({ error: 'User ID or Session ID required' });
    }

    const cartItems = await prisma.cartItem.findMany({
      where: userId ? { userId } : { sessionId },
      include: { garment: true }
    });

    const total = cartItems.reduce(
      (sum, item) => sum + item.garment.price * item.quantity,
      0
    );

    return {
      items: cartItems,
      total,
      count: cartItems.length
    };
  });

  // POST /api/cart/items - Add to cart
  fastify.post('/items', async (request, reply) => {
    const bodySchema = z.object({
      garmentId: z.string(),
      size: z.string(),
      quantity: z.number().min(1).default(1)
    });

    const body = bodySchema.parse(request.body);
    const userId = request.headers['x-user-id'] as string;
    const sessionId = request.headers['x-session-id'] as string;

    // Check if already in cart
    const existing = await prisma.cartItem.findFirst({
      where: {
        garmentId: body.garmentId,
        size: body.size,
        ...(userId ? { userId } : { sessionId })
      }
    });

    if (existing) {
      // Update quantity
      const updated = await prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + body.quantity },
        include: { garment: true }
      });
      return updated;
    }

    // Add new item
    const cartItem = await prisma.cartItem.create({
      data: {
        garmentId: body.garmentId,
        size: body.size,
        quantity: body.quantity,
        ...(userId ? { userId } : { sessionId })
      },
      include: { garment: true }
    });

    return cartItem;
  });

  // DELETE /api/cart/items/:id - Remove from cart
  fastify.delete('/items/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    await prisma.cartItem.delete({
      where: { id }
    });

    return { success: true };
  });
};
