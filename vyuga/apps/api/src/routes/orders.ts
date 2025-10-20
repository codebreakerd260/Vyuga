import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../lib/prisma.ts';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { z } from 'zod';

let razorpay: Razorpay;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
}

export const orderRoutes: FastifyPluginAsync = async (fastify) => {

  // POST /api/orders/checkout - Create order
  fastify.post('/checkout', async (request, reply) => {
    const bodySchema = z.object({
      items: z.array(z.object({
        garmentId: z.string(),
        size: z.string(),
        quantity: z.number()
      })),
      shippingAddress: z.object({
        name: z.string(),
        phone: z.string(),
        address: z.string(),
        city: z.string(),
        state: z.string(),
        pincode: z.string()
      })
    });

    const body = bodySchema.parse(request.body);
    const userId = request.headers['x-user-id'] as string;

    if (!userId) {
      return reply.code(401).send({ error: 'Authentication required' });
    }

    // Calculate total
    const garmentIds = body.items.map(i => i.garmentId);
    const garments = await prisma.garment.findMany({
      where: { id: { in: garmentIds } }
    });

    const subtotal = body.items.reduce((sum, item) => {
      const garment = garments.find(g => g.id === item.garmentId);
      return sum + (garment?.price || 0) * item.quantity;
    }, 0);

    const shippingCost = 100; // Fixed ₹100 for Quick Path
    const total = subtotal + shippingCost;

    // Create order in DB
    const order = await prisma.order.create({
      data: {
        orderNumber: `ORD-${Date.now()}`,
        userId,
        shippingAddress: body.shippingAddress,
        subtotal,
        shippingCost,
        total,
        status: 'PENDING',
        items: {
          create: body.items.map(item => {
            const garment = garments.find(g => g.id === item.garmentId)!;
            return {
              garmentId: item.garmentId,
              size: item.size,
              quantity: item.quantity,
              price: garment.price
            };
          })
        }
      },
      include: { items: { include: { garment: true } } }
    });

    if (!razorpay) {
      return reply.code(500).send({ error: 'Razorpay not configured' });
    }

    // Create Razorpay order
    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(total * 100), // Convert to paise
      currency: 'INR',
      receipt: order.orderNumber,
    });

    // Update order with payment ID
    await prisma.order.update({
      where: { id: order.id },
      data: { paymentId: razorpayOrder.id },
    });

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      razorpayOrderId: razorpayOrder.id,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
      amount: total,
      currency: 'INR',
    };
  });

  // POST /api/orders/verify - Verify Razorpay payment
  fastify.post('/verify', async (request, reply) => {
    const bodySchema = z.object({
      razorpay_order_id: z.string(),
      razorpay_payment_id: z.string(),
      razorpay_signature: z.string()
    });

    const body = bodySchema.parse(request.body);

    // Verify signature
    const text = `${body.razorpay_order_id}|${body.razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(text)
      .digest('hex');

    if (expectedSignature !== body.razorpay_signature) {
      return reply.code(400).send({ error: 'Invalid signature' });
    }

    // Update order status
    const order = await prisma.order.findFirst({
      where: { paymentId: body.razorpay_order_id }
    });

    if (!order) {
      return reply.code(404).send({ error: 'Order not found' });
    }

    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'CONFIRMED',
        paymentStatus: 'PAID'
      }
    });

    // Clear user's cart
    await prisma.cartItem.deleteMany({
      where: { userId: order.userId }
    });

    return {
      success: true,
      orderId: order.id,
      orderNumber: order.orderNumber
    };
  });

  // GET /api/orders - Get user's orders
  fastify.get('/', async (request, reply) => {
    const userId = request.headers['x-user-id'] as string;

    const orders = await prisma.order.findMany({
      where: { userId },
      include: {
        items: {
          include: { garment: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return orders;
  });

  // GET /api/orders/:id - Get single order
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.headers['x-user-id'] as string;

    const order = await prisma.order.findFirst({
      where: { id, userId },
      include: {
        items: {
          include: { garment: true }
        }
      }
    });

    if (!order) {
      return reply.code(404).send({ error: 'Order not found' });
    }

    return order;
  });
};
