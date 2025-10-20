# VYUGA - Complete Quick Path (Prototype-Ready in 7 Days)

This is the **hackathon-speed implementation** that gets you a working demo WITHOUT production complexity.

---

## Day 1-2: Project Setup & Database

### Step 1: Initialize Project (30 minutes)

```bash
#!/bin/bash
# Run this script to set up everything

# Create project
pnpm create turbo@latest vyuga --example basic
cd vyuga

# Install all dependencies
pnpm add -w typescript @types/node prettier eslint turbo

# Frontend dependencies
cd apps/web
pnpm create next-app@latest . --typescript --tailwind --app --src-dir
pnpm add zustand @tanstack/react-query axios lucide-react
pnpm add @clerk/nextjs  # Authentication
pnpm add react-hook-form zod @hookform/resolvers
pnpm add @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-select
pnpm add framer-motion
pnpm add sonner  # Toast notifications

# Backend dependencies
cd ../api
pnpm init
pnpm add fastify @fastify/cors @fastify/multipart @fastify/rate-limit
pnpm add @prisma/client zod dotenv
pnpm add -D tsx prisma @types/node

# Database setup
cd ../../packages/database
pnpm init
pnpm add @prisma/client
pnpm add -D prisma
```

### Step 2: Database Schema (Quick Version)

```prisma
// packages/database/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================
// QUICK PATH: Minimal schema for MVP
// ============================================

model User {
  id            String   @id @default(cuid())
  clerkId       String   @unique
  email         String   @unique
  name          String?
  avatarUrl     String?
  
  // Simple JSON for now (no separate models)
  measurements  Json?    // { height: 165, bust: 34, waist: 28, hip: 38 }
  
  sessions      TryOnSession[]
  cartItems     CartItem[]
  orders        Order[]
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  @@index([email])
  @@index([clerkId])
}

model Garment {
  id            String   @id @default(cuid())
  name          String
  description   String?
  
  category      String   // "SAREE", "LEHENGA", "KURTA"
  region        String?  // "SOUTH_INDIAN", "PUNJABI"
  
  imageUrl      String
  thumbnailUrl  String
  
  // Simple fields (no complex variants for MVP)
  price         Float
  colors        String[] // ["red", "gold"]
  sizes         String[] // ["S", "M", "L", "Free Size"]
  
  inStock       Boolean  @default(true)
  stockCount    Int      @default(10)
  
  sessions      TryOnSession[]
  cartItems     CartItem[]
  orderItems    OrderItem[]
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  @@index([category])
  @@index([inStock])
}

model TryOnSession {
  id                String   @id @default(cuid())
  
  userId            String?
  user              User?    @relation(fields: [userId], references: [id])
  
  garmentId         String
  garment           Garment  @relation(fields: [garmentId], references: [id])
  
  inputImageUrl     String   // User photo (Vercel Blob)
  resultImageUrl    String?  // Generated image
  
  status            String   @default("QUEUED") // QUEUED, PROCESSING, COMPLETED, FAILED
  errorMessage      String?
  
  shareToken        String?  @unique
  
  createdAt         DateTime @default(now())
  expiresAt         DateTime // Delete after 24h
  
  @@index([userId, createdAt])
  @@index([status])
}

model CartItem {
  id          String   @id @default(cuid())
  
  userId      String?
  user        User?    @relation(fields: [userId], references: [id])
  
  sessionId   String?  // For guest carts
  
  garmentId   String
  garment     Garment  @relation(fields: [garmentId], references: [id])
  
  size        String   // "M", "Free Size"
  quantity    Int      @default(1)
  
  createdAt   DateTime @default(now())
  
  @@unique([userId, garmentId, size])
  @@index([userId])
  @@index([sessionId])
}

model Order {
  id              String   @id @default(cuid())
  orderNumber     String   @unique // ORD-20250101-001
  
  userId          String
  user            User     @relation(fields: [userId], references: [id])
  
  items           OrderItem[]
  
  // Simple JSON for addresses (no separate model)
  shippingAddress Json     // { name, phone, address, city, state, pincode }
  
  subtotal        Float
  shippingCost    Float
  total           Float
  
  status          String   @default("PENDING") // PENDING, CONFIRMED, SHIPPED, DELIVERED
  
  // Payment (Razorpay)
  paymentId       String?
  paymentStatus   String   @default("PENDING") // PENDING, PAID, FAILED
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@index([userId, createdAt])
  @@index([orderNumber])
  @@index([status])
}

model OrderItem {
  id            String  @id @default(cuid())
  
  orderId       String
  order         Order   @relation(fields: [orderId], references: [id])
  
  garmentId     String
  garment       Garment @relation(fields: [garmentId], references: [id])
  
  size          String
  quantity      Int
  price         Float   // Price at time of purchase
  
  @@index([orderId])
}
```

### Step 3: Setup Database (Supabase Free Tier)

```bash
# Go to https://supabase.com/dashboard
# Create new project: vyuga-dev
# Copy connection string

# .env (root directory)
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"

# Push schema
cd packages/database
pnpm prisma db push
pnpm prisma generate
```

---

## Day 2-3: Backend API (Fastify)

### File Structure
```
apps/api/
├── src/
│   ├── index.ts          # Main server
│   ├── routes/
│   │   ├── garments.ts   # GET /garments
│   │   ├── tryon.ts      # POST /try-on/upload
│   │   ├── cart.ts       # Cart operations
│   │   └── orders.ts     # Checkout & orders
│   ├── services/
│   │   ├── huggingface.ts # ML API calls
│   │   └── storage.ts     # Vercel Blob
│   └── lib/
│       └── prisma.ts      # Database client
├── package.json
└── tsconfig.json
```

### Core Server Setup

```typescript
// apps/api/src/index.ts
import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import { garmentRoutes } from './routes/garments';
import { tryonRoutes } from './routes/tryon';
import { cartRoutes } from './routes/cart';
import { orderRoutes } from './routes/orders';

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
```

```typescript
// apps/api/src/lib/prisma.ts
import { PrismaClient } from '@prisma/client';

const prismaClientSingleton = () => {
  return new PrismaClient();
};

declare global {
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

export const prisma = globalThis.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma;
```

### Garment Catalog API

```typescript
// apps/api/src/routes/garments.ts
import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../lib/prisma';
import { z } from 'zod';

export const garmentRoutes: FastifyPluginAsync = async (fastify) => {
  
  // GET /api/garments - List garments
  fastify.get('/', async (request, reply) => {
    const querySchema = z.object({
      category: z.string().optional(),
      search: z.string().optional(),
      page: z.string().default('1'),
      limit: z.string().default('20')
    });

    const query = querySchema.parse(request.query);
    const page = parseInt(query.page);
    const limit = parseInt(query.limit);
    const skip = (page - 1) * limit;

    const where = {
      inStock: true,
      ...(query.category && { category: query.category }),
      ...(query.search && {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { description: { contains: query.search, mode: 'insensitive' } }
        ]
      })
    };

    const [garments, total] = await Promise.all([
      prisma.garment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.garment.count({ where })
    ]);

    return {
      data: garments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  });

  // GET /api/garments/:id - Single garment
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const garment = await prisma.garment.findUnique({
      where: { id }
    });

    if (!garment) {
      return reply.code(404).send({ error: 'Garment not found' });
    }

    return garment;
  });
};
```

### Try-On API (Quick Version)

```typescript
// apps/api/src/routes/tryon.ts
import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../lib/prisma';
import { uploadToBlob, generateTryOn } from '../services/storage';
import { z } from 'zod';

export const tryonRoutes: FastifyPluginAsync = async (fastify) => {
  
  // POST /api/try-on/upload
  fastify.post('/upload', async (request, reply) => {
    // Get uploaded file
    const data = await request.file();
    if (!data) {
      return reply.code(400).send({ error: 'No file uploaded' });
    }

    // Validate file type
    if (!data.mimetype.startsWith('image/')) {
      return reply.code(400).send({ error: 'File must be an image' });
    }

    // Get garment ID from fields
    const fields = Object.fromEntries(
      await Promise.all(
        (data.fields as any[]).map(async (field) => [
          field.fieldname,
          (await field.value).value
        ])
      )
    );

    const garmentId = fields.garmentId;
    if (!garmentId) {
      return reply.code(400).send({ error: 'garmentId is required' });
    }

    // Verify garment exists
    const garment = await prisma.garment.findUnique({
      where: { id: garmentId }
    });
    if (!garment) {
      return reply.code(404).send({ error: 'Garment not found' });
    }

    // Upload user photo to Vercel Blob
    const buffer = await data.toBuffer();
    const inputImageUrl = await uploadToBlob(buffer, `tryon/${Date.now()}.jpg`);

    // Create session
    const session = await prisma.tryOnSession.create({
      data: {
        garmentId,
        inputImageUrl,
        status: 'QUEUED',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
        shareToken: Math.random().toString(36).substring(7)
      }
    });

    // Start ML processing (async)
    processAsync(session.id, inputImageUrl, garment.imageUrl);

    return {
      sessionId: session.id,
      status: 'QUEUED',
      message: 'Your try-on is being processed',
      estimatedTime: 30
    };
  });

  // GET /api/try-on/status/:id
  fastify.get('/status/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const session = await prisma.tryOnSession.findUnique({
      where: { id },
      include: { garment: true }
    });

    if (!session) {
      return reply.code(404).send({ error: 'Session not found' });
    }

    if (session.status === 'COMPLETED') {
      return {
        sessionId: session.id,
        status: 'COMPLETED',
        resultImageUrl: session.resultImageUrl,
        garment: session.garment,
        shareUrl: `${process.env.APP_URL}/share/${session.shareToken}`
      };
    }

    if (session.status === 'FAILED') {
      return {
        sessionId: session.id,
        status: 'FAILED',
        errorMessage: session.errorMessage
      };
    }

    return {
      sessionId: session.id,
      status: session.status,
      message: 'Processing...'
    };
  });
};

// Background processing (Quick Path: synchronous for demo)
async function processAsync(sessionId: string, personImage: string, garmentImage: string) {
  try {
    // Update status
    await prisma.tryOnSession.update({
      where: { id: sessionId },
      data: { status: 'PROCESSING' }
    });

    // Call Hugging Face API
    const resultUrl = await generateTryOn(personImage, garmentImage);

    // Update session
    await prisma.tryOnSession.update({
      where: { id: sessionId },
      data: {
        status: 'COMPLETED',
        resultImageUrl: resultUrl
      }
    });
  } catch (error) {
    console.error('Try-on failed:', error);
    await prisma.tryOnSession.update({
      where: { id: sessionId },
      data: {
        status: 'FAILED',
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
}
```

### ML Service (Hugging Face API)

```typescript
// apps/api/src/services/huggingface.ts
import { put } from '@vercel/blob';
import fetch from 'node-fetch';

// Quick Path: Use Hugging Face Inference API
export async function generateTryOn(
  personImageUrl: string, 
  garmentImageUrl: string
): Promise<string> {
  
  const HF_TOKEN = process.env.HUGGINGFACE_API_KEY;
  const MODEL = 'Kolors/Kolors-Virtual-Try-On';

  // Download images as buffers
  const [personBuffer, garmentBuffer] = await Promise.all([
    fetch(personImageUrl).then(r => r.buffer()),
    fetch(garmentImageUrl).then(r => r.buffer())
  ]);

  // Call Hugging Face API
  const response = await fetch(
    `https://api-inference.huggingface.co/models/${MODEL}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HF_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: {
          person_image: personBuffer.toString('base64'),
          garment_image: garmentBuffer.toString('base64')
        },
        parameters: {
          num_inference_steps: 30, // Lower for speed (Quick Path)
          guidance_scale: 2.0
        }
      })
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`HF API error: ${error}`);
  }

  // Get result image
  const resultBuffer = await response.buffer();

  // Upload to Vercel Blob
  const { url } = await put(
    `results/${Date.now()}.jpg`,
    resultBuffer,
    {
      access: 'public',
      addRandomSuffix: true
    }
  );

  return url;
}
```

```typescript
// apps/api/src/services/storage.ts
import { put } from '@vercel/blob';

export async function uploadToBlob(
  buffer: Buffer, 
  filename: string
): Promise<string> {
  const { url } = await put(filename, buffer, {
    access: 'public',
    addRandomSuffix: true
  });
  return url;
}
```

### Cart API

```typescript
// apps/api/src/routes/cart.ts
import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../lib/prisma';
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
```

### Orders API (Razorpay Integration)

```typescript
// apps/api/src/routes/orders.ts
import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../lib/prisma';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { z } from 'zod';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!
});

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

    // Create Razorpay order
    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(total * 100), // Convert to paise
      currency: 'INR',
      receipt: order.orderNumber
    });

    // Update order with payment ID
    await prisma.order.update({
      where: { id: order.id },
      data: { paymentId: razorpayOrder.id }
    });

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      razorpayOrderId: razorpayOrder.id,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
      amount: total,
      currency: 'INR'
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
```

---

## Day 3-5: Frontend (Next.js)

### File Structure
```
apps/web/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx           # Homepage
│   │   ├── shop/
│   │   │   └── page.tsx       # Product catalog
│   │   ├── product/
│   │   │   └── [id]/page.tsx  # Product detail
│   │   ├── try-on/
│   │   │   ├── page.tsx       # Upload photo
│   │   │   └── [id]/page.tsx  # Result
│   │   ├── cart/
│   │   │   └── page.tsx       # Shopping cart
│   │   └── orders/
│   │       └── page.tsx       # Order history
│   ├── components/
│   │   ├── ProductCard.tsx
│   │   ├── TryOnUpload.tsx
│   │   ├── CartItem.tsx
│   │   └── Checkout.tsx
│   ├── lib/
│   │   └── api.ts             # API client
│   └── store/
│       └── cart.ts            # Zustand store
└── package.json
```

### API Client

```typescript
// apps/web/src/lib/api.ts
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add user ID from Clerk
api.interceptors.request.use((config) => {
  const userId = localStorage.getItem('clerk-user-id');
  if (userId) {
    config.headers['x-user-id'] = userId;
  }
  
  // Guest cart session
  let sessionId = localStorage.getItem('cart-session-id');
  if (!sessionId) {
    sessionId = Math.random().toString(36).substring(7);
    localStorage.setItem('cart-session-id', sessionId);
  }
  config.headers['x-session-id'] = sessionId;
  
  return config;
});

export default api;

// API methods
export const garmentAPI = {
  list: (params?: { category?: string; search?: string; page?: number }) =>
    api.get('/garments', { params }),
  
  get: (id: string) =>
    api.get(`/garments/${id}`)
};

export const tryonAPI = {
  upload: (formData: FormData) =>
    api.post('/try-on/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
  
  getStatus: (sessionId: string) =>
    api.get(`/try-on/status/${sessionId}`)
};

export const cartAPI = {
  get: () => api.get('/cart'),
  
  addItem: (data: { garmentId: string; size: string; quantity: number }) =>
    api.post('/cart/items', data),
  
  removeItem: (id: string) =>
    api.delete(`/cart/items/${id}`)
};

export const orderAPI = {
  checkout: (data: any) =>
    api.post('/orders/checkout', data),
  
  verify: (data: { 
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) =>
    api.post('/orders/verify', data),
  
  list: () =>
    api.get('/orders'),
  
  get: (id: string) =>
    api.get(`/orders/${id}`)
};
```

### Cart Store (Zustand)

```typescript
// apps/web/src/store/cart.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CartItem {
  id: string;
  garment: {
    id: string;
    name: string;
    price: number;
    imageUrl: string;
  };
  size: string;
  quantity: number;
}

interface CartStore {
  items: CartItem[];
  total: number;
  count: number;
  
  addItem: (item: Omit<CartItem, 'id'>) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  
  // Sync with server
  syncWithServer: (serverItems: CartItem[]) => void;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      total: 0,
      count: 0,
      
      addItem: (item) => {
        const items = get().items;
        const existing = items.find(
          i => i.garment.id === item.garment.id && i.size === item.size
        );
        
        if (existing) {
          set({
            items: items.map(i =>
              i.id === existing.id
                ? { ...i, quantity: i.quantity + item.quantity }
                : i
            )
          });
        } else {
          set({
            items: [...items, { ...item, id: Math.random().toString() }]
          });
        }
        
        // Recalculate total
        const newItems = get().items;
        const total = newItems.reduce(
          (sum, i) => sum + i.garment.price * i.quantity,
          0
        );
        set({ total, count: newItems.length });
      },
      
      removeItem: (id) => {
        const items = get().items.filter(i => i.id !== id);
        const total = items.reduce(
          (sum, i) => sum + i.garment.price * i.quantity,
          0
        );
        set({ items, total, count: items.length });
      },
      
      updateQuantity: (id, quantity) => {
        if (quantity <= 0) {
          get().removeItem(id);
          return;
        }
        
        const items = get().items.map(i =>
          i.id === id ? { ...i, quantity } : i
        );
        const total = items.reduce(
          (sum, i) => sum + i.garment.price * i.quantity,
          0
        );
        set({ items, total, count: items.length });
      },
      
      clearCart: () => {
        set({ items: [], total: 0, count: 0 });
      },
      
      syncWithServer: (serverItems) => {
        const total = serverItems.reduce(
          (sum, i) => sum + i.garment.price * i.quantity,
          0
        );
        set({ items: serverItems, total, count: serverItems.length });
      }
    }),
    {
      name: 'vyuga-cart'
    }
  )
);
```

### Homepage

```tsx
// apps/web/src/app/page.tsx
import Link from 'next/link';
import Image from 'next/image';
import { garmentAPI } from '@/lib/api';

export default async function HomePage() {
  const { data } = await garmentAPI.list({ page: 1 });
  
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-purple-600 to-pink-500 text-white py-20">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-5xl font-bold mb-6">
            Try Before You Buy
          </h1>
          <p className="text-xl mb-8 max-w-2xl mx-auto">
            See how ethnic wear looks on you with AI-powered virtual try-on
          </p>
          <Link
            href="/shop"
            className="bg-white text-purple-600 px-8 py-4 rounded-full text-lg font-semibold hover:bg-gray-100 transition inline-block"
          >
            Start Shopping
          </Link>
        </div>
      </section>

      {/* Featured Products */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-8">Trending Now</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {data.data.slice(0, 8).map((garment: any) => (
              <ProductCard key={garment.id} garment={garment} />
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-gray-50 py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-12 text-center">How It Works</h2>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">1️⃣</span>
              </div>
              <h3 className="font-semibold mb-2">Choose Garment</h3>
              <p className="text-gray-600">Browse our collection of ethnic wear</p>
            </div>
            
            <div className="text-center">
              <div className="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">📸</span>
              </div>
              <h3 className="font-semibold mb-2">Upload Photo</h3>
              <p className="text-gray-600">Take or upload a clear photo</p>
            </div>
            
            <div className="text-center">
              <div className="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">✨</span>
              </div>
              <h3 className="font-semibold mb-2">See Result</h3>
              <p className="text-gray-600">AI generates your try-on in seconds</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
```

### Product Card Component

```tsx
// apps/web/src/components/ProductCard.tsx
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShoppingCart, Sparkles } from 'lucide-react';
import { useCartStore } from '@/store/cart';
import { toast } from 'sonner';

interface ProductCardProps {
  garment: {
    id: string;
    name: string;
    price: number;
    imageUrl: string;
    category: string;
    sizes: string[];
  };
}

export function ProductCard({ garment }: ProductCardProps) {
  const router = useRouter();
  const addItem = useCartStore(state => state.addItem);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    addItem({
      garment: {
        id: garment.id,
        name: garment.name,
        price: garment.price,
        imageUrl: garment.imageUrl
      },
      size: garment.sizes[0], // Default to first size
      quantity: 1
    });
    
    toast.success('Added to cart!');
  };

  const handleTryOn = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/try-on?garmentId=${garment.id}`);
  };

  return (
    <Link href={`/product/${garment.id}`}>
      <div className="group relative bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-lg transition">
        {/* Image */}
        <div className="relative aspect-[3/4] overflow-hidden bg-gray-100">
          <Image
            src={garment.imageUrl}
            alt={garment.name}
            fill
            className="object-cover group-hover:scale-105 transition duration-300"
          />
          
          {/* Hover Overlay */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-3">
            <button
              onClick={handleTryOn}
              className="bg-purple-600 text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-purple-700 flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Try On
            </button>
            <button
              onClick={handleAddToCart}
              className="bg-white text-gray-900 px-4 py-2 rounded-full text-sm font-medium hover:bg-gray-100 flex items-center gap-2"
            >
              <ShoppingCart className="w-4 h-4" />
              Add
            </button>
          </div>
        </div>

        {/* Details */}
        <div className="p-4">
          <p className="text-xs text-gray-500 uppercase mb-1">
            {garment.category}
          </p>
          <h3 className="font-medium mb-2 line-clamp-1">
            {garment.name}
          </h3>
          <p className="text-lg font-bold text-purple-600">
            ₹{garment.price.toLocaleString()}
          </p>
        </div>
      </div>
    </Link>
  );
}
```

### Shop Page

```tsx
// apps/web/src/app/shop/page.tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { garmentAPI } from '@/lib/api';
import { ProductCard } from '@/components/ProductCard';
import { Search, Filter } from 'lucide-react';

export default function ShopPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['garments', { search, category, page }],
    queryFn: () => garmentAPI.list({ search, category, page })
  });

  const categories = ['SAREE', 'LEHENGA', 'KURTA', 'SALWAR_KAMEEZ', 'ANARKALI'];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4">Shop Ethnic Wear</h1>
          
          {/* Search & Filter */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search garments..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="px-4 py-3 border rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat.replace('_', ' ')}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Products Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg animate-pulse">
                <div className="aspect-[3/4] bg-gray-200" />
                <div className="p-4">
                  <div className="h-4 bg-gray-200 rounded mb-2" />
                  <div className="h-6 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {data?.data.data.map((garment: any) => (
                <ProductCard key={garment.id} garment={garment} />
              ))}
            </div>

            {/* Pagination */}
            {data?.data.pagination.totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-8">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 border rounded-lg disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="px-4 py-2">
                  Page {page} of {data?.data.pagination.totalPages}
                </span>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page === data?.data.pagination.totalPages}
                  className="px-4 py-2 border rounded-lg disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
```

### Try-On Upload Page

```tsx
// apps/web/src/app/try-on/page.tsx
'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Upload, Camera, Loader2 } from 'lucide-react';
import { tryonAPI } from '@/lib/api';
import { toast } from 'sonner';

export default function TryOnUploadPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const garmentId = searchParams.get('garmentId');
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  if (!garmentId) {
    return <div className="p-8 text-center">No garment selected</div>;
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    setSelectedFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('photo', selectedFile);
      formData.append('garmentId', garmentId);

      const { data } = await tryonAPI.upload(formData);
      
      toast.success('Processing your try-on...');
      router.push(`/try-on/${data.sessionId}`);
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error('Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4 max-w-2xl">
        <h1 className="text-3xl font-bold mb-8 text-center">
          Upload Your Photo
        </h1>

        <div className="bg-white rounded-lg shadow-lg p-8">
          {/* Photo Guidelines */}
          <div className="mb-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-semibold mb-2">📸 Photo Tips:</h3>
            <ul className="text-sm space-y-1 text-gray-700">
              <li>• Stand straight facing the camera</li>
              <li>• Good lighting (avoid shadows)</li>
              <li>• Plain background preferred</li>
              <li>• Full upper body visible</li>
            </ul>
          </div>

          {/* Upload Area */}
          {!preview ? (
            <label className="border-2 border-dashed border-gray-300 rounded-lg p-12 flex flex-col items-center cursor-pointer hover:border-purple-500 transition">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Upload className="w-16 h-16 text-gray-400 mb-4" />
              <p className="text-lg font-medium mb-2">
                Click to upload or drag and drop
              </p>
              <p className="text-sm text-gray-500">
                JPEG, PNG (max 10MB)
              </p>
            </label>
          ) : (
            <div>
              <img
                src={preview}
                alt="Preview"
                className="w-full max-h-96 object-contain rounded-lg mb-4"
              />
              
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setPreview(null);
                    setSelectedFile(null);
                  }}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Change Photo
                </button>
                
                <button
                  onClick={handleUpload}
                  disabled={isUploading}
                  className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    'Try On'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

### Try-On Result Page

```tsx
// apps/web/src/app/try-on/[id]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { tryonAPI, cartAPI } from '@/lib/api';
import { Loader2, Download, Share2, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';

export default function TryOnResultPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [selectedSize, setSelectedSize] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['tryon', params.id],
    queryFn: () => tryonAPI.getStatus(params.id),
    refetchInterval: (data) => {
      // Poll every 3 seconds until completed
      if (!data?.data || ['QUEUED', 'PROCESSING'].includes(data.data.status)) {
        return 3000;
      }
      return false;
    }
  });

  const session = data?.data;

  useEffect(() => {
    if (session?.garment?.sizes?.[0]) {
      setSelectedSize(session.garment.sizes[0]);
    }
  }, [session]);

  const handleAddToCart = async () => {
    if (!selectedSize) {
      toast.error('Please select a size');
      return;
    }

    try {
      await cartAPI.addItem({
        garmentId: session.garment.id,
        size: selectedSize,
        quantity: 1
      });
      toast.success('Added to cart!');
      router.push('/cart');
    } catch (error) {
      toast.error('Failed to add to cart');
    }
  };

  const handleShare = async () => {
    if (navigator.share && session?.shareUrl) {
      try {
        await navigator.share({
          title: 'My Virtual Try-On',
          text: `Check out how I look in ${session.garment.name}!`,
          url: session.shareUrl
        });
      } catch (err) {
        // User cancelled share
      }
    } else {
      navigator.clipboard.writeText(session.shareUrl);
      toast.success('Link copied to clipboard!');
    }
  };

  // Loading state
  if (isLoading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-purple-600" />
      </div>
    );
  }

  // Processing state
  if (session.status === 'QUEUED' || session.status === 'PROCESSING') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-16 h-16 animate-spin text-purple-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Creating Your Try-On</h2>
          <p className="text-gray-600">This usually takes 20-30 seconds...</p>
          <div className="mt-6">
            <div className="w-64 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-purple-600 animate-pulse" style={{ width: '60%' }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Failed state
  if (session.status === 'FAILED') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">😞</div>
          <h2 className="text-2xl font-bold mb-2">Try-On Failed</h2>
          <p className="text-gray-600 mb-6">{session.errorMessage}</p>
          <button
            onClick={() => router.push('/shop')}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Try Another Garment
          </button>
        </div>
      </div>
    );
  }

  // Success state
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {/* Left: Result Image */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="relative aspect-[3/4] mb-4">
              <Image
                src={session.resultImageUrl!}
                alt="Your try-on result"
                fill
                className="object-contain rounded-lg"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleShare}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <Share2 className="w-5 h-5" />
                Share
              </button>
              
              
                href={session.resultImageUrl}
                download
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <Download className="w-5 h-5" />
                Download
              </a>
            </div>
          </div>

          {/* Right: Product Details */}
          <div>
            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
              <p className="text-sm text-gray-500 uppercase mb-2">
                {session.garment.category}
              </p>
              <h1 className="text-3xl font-bold mb-4">
                {session.garment.name}
              </h1>
              
              <div className="flex items-center gap-4 mb-6">
                <span className="text-3xl font-bold text-purple-600">
                  ₹{session.garment.price.toLocaleString()}
                </span>
              </div>

              {/* Size Selector */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">
                  Select Size
                </label>
                <div className="flex gap-2">
                  {session.garment.sizes.map((size: string) => (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(size)}
                      className={`px-4 py-2 border-2 rounded-lg transition ${
                        selectedSize === size
                          ? 'border-purple-600 bg-purple-50'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              {/* Add to Cart Button */}
              <button
                onClick={handleAddToCart}
                className="w-full bg-purple-600 text-white py-4 rounded-lg text-lg font-semibold hover:bg-purple-700 transition flex items-center justify-center gap-2"
              >
                <ShoppingCart className="w-5 h-5" />
                Add to Cart - ₹{session.garment.price.toLocaleString()}
              </button>

              {/* Try Another */}
              <button
                onClick={() => router.push('/shop')}
                className="w-full mt-3 border-2 border-purple-600 text-purple-600 py-3 rounded-lg font-semibold hover:bg-purple-50 transition"
              >
                Try Another Style
              </button>
            </div>

            {/* Info Card */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-800">
                ✨ <strong>Love the look?</strong> This is an AI-generated preview. 
                Actual garment may vary slightly in draping and fit.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### Cart Page

```tsx
// apps/web/src/app/cart/page.tsx
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { cartAPI } from '@/lib/api';
import { Trash2, Plus, Minus, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';

export default function CartPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: cart, isLoading } = useQuery({
    queryKey: ['cart'],
    queryFn: () => cartAPI.get()
  });

  const removeItemMutation = useMutation({
    mutationFn: (id: string) => cartAPI.removeItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      toast.success('Item removed from cart');
    }
  });

  if (isLoading) {
    return <div className="p-8 text-center">Loading cart...</div>;
  }

  const items = cart?.data.items || [];
  const total = cart?.data.total || 0;

  if (items.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <ShoppingBag className="w-24 h-24 text-gray-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Your cart is empty</h2>
          <p className="text-gray-600 mb-6">
            Start shopping to add items to your cart
          </p>
          <button
            onClick={() => router.push('/shop')}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Browse Products
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4 max-w-6xl">
        <h1 className="text-3xl font-bold mb-8">Shopping Cart ({items.length})</h1>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow">
              {items.map((item: any) => (
                <div
                  key={item.id}
                  className="flex gap-4 p-6 border-b last:border-b-0"
                >
                  {/* Image */}
                  <div className="relative w-24 h-32 flex-shrink-0">
                    <Image
                      src={item.garment.thumbnailUrl || item.garment.imageUrl}
                      alt={item.garment.name}
                      fill
                      className="object-cover rounded"
                    />
                  </div>

                  {/* Details */}
                  <div className="flex-1">
                    <h3 className="font-semibold mb-1">
                      {item.garment.name}
                    </h3>
                    <p className="text-sm text-gray-600 mb-2">
                      Size: {item.size}
                    </p>
                    <p className="text-lg font-bold text-purple-600">
                      ₹{item.garment.price.toLocaleString()}
                    </p>
                  </div>

                  {/* Quantity & Remove */}
                  <div className="flex flex-col justify-between items-end">
                    <button
                      onClick={() => removeItemMutation.mutate(item.id)}
                      className="text-gray-400 hover:text-red-500 transition"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>

                    <div className="flex items-center gap-2 border rounded-lg">
                      <button
                        className="p-2 hover:bg-gray-100"
                        disabled
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="px-3 font-medium">{item.quantity}</span>
                      <button
                        className="p-2 hover:bg-gray-100"
                        disabled
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-6 sticky top-4">
              <h2 className="text-xl font-bold mb-4">Order Summary</h2>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">₹{total.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Shipping</span>
                  <span className="font-medium">₹100</span>
                </div>
                <div className="border-t pt-3 flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span className="text-purple-600">
                    ₹{(total + 100).toLocaleString()}
                  </span>
                </div>
              </div>

              <button
                onClick={() => router.push('/checkout')}
                className="w-full bg-purple-600 text-white py-4 rounded-lg font-semibold hover:bg-purple-700 transition"
              >
                Proceed to Checkout
              </button>

              <button
                onClick={() => router.push('/shop')}
                className="w-full mt-3 border border-gray-300 py-3 rounded-lg font-medium hover:bg-gray-50 transition"
              >
                Continue Shopping
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### Checkout Page (with Razorpay)

```tsx
// apps/web/src/app/checkout/page.tsx
'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { cartAPI, orderAPI } from '@/lib/api';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

const addressSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Invalid phone number'),
  address: z.string().min(10, 'Address is required'),
  city: z.string().min(2, 'City is required'),
  state: z.string().min(2, 'State is required'),
  pincode: z.string().regex(/^\d{6}$/, 'Invalid pincode')
});

type AddressForm = z.infer<typeof addressSchema>;

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function CheckoutPage() {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);

  const { data: cart } = useQuery({
    queryKey: ['cart'],
    queryFn: () => cartAPI.get()
  });

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<AddressForm>({
    resolver: zodResolver(addressSchema)
  });

  const createOrderMutation = useMutation({
    mutationFn: (data: any) => orderAPI.checkout(data)
  });

  const verifyPaymentMutation = useMutation({
    mutationFn: (data: any) => orderAPI.verify(data)
  });

  const onSubmit = async (formData: AddressForm) => {
    if (!cart?.data.items.length) {
      toast.error('Cart is empty');
      return;
    }

    setIsProcessing(true);

    try {
      // Create order
      const { data: orderData } = await createOrderMutation.mutateAsync({
        items: cart.data.items.map((item: any) => ({
          garmentId: item.garment.id,
          size: item.size,
          quantity: item.quantity
        })),
        shippingAddress: formData
      });

      // Load Razorpay script
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      document.body.appendChild(script);

      script.onload = () => {
        const options = {
          key: orderData.razorpayKeyId,
          amount: orderData.amount * 100,
          currency: orderData.currency,
          name: 'VYUGA',
          description: `Order ${orderData.orderNumber}`,
          order_id: orderData.razorpayOrderId,
          handler: async (response: any) => {
            try {
              // Verify payment
              await verifyPaymentMutation.mutateAsync({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              });

              toast.success('Order placed successfully!');
              router.push(`/orders/${orderData.orderId}`);
            } catch (error) {
              toast.error('Payment verification failed');
            }
          },
          prefill: {
            name: formData.name,
            contact: formData.phone
          },
          theme: {
            color: '#9333ea' // Purple-600
          },
          modal: {
            ondismiss: () => {
              setIsProcessing(false);
              toast.error('Payment cancelled');
            }
          }
        };

        const razorpay = new window.Razorpay(options);
        razorpay.open();
      };

      script.onerror = () => {
        toast.error('Failed to load payment gateway');
        setIsProcessing(false);
      };
    } catch (error) {
      console.error('Checkout failed:', error);
      toast.error('Failed to create order');
      setIsProcessing(false);
    }
  };

  const items = cart?.data.items || [];
  const subtotal = cart?.data.total || 0;
  const shipping = 100;
  const total = subtotal + shipping;

  if (items.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Your cart is empty</h2>
          <button
            onClick={() => router.push('/shop')}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg"
          >
            Continue Shopping
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4 max-w-6xl">
        <h1 className="text-3xl font-bold mb-8">Checkout</h1>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Shipping Address */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h2 className="text-xl font-bold mb-4">Shipping Address</h2>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1">
                      Full Name *
                    </label>
                    <input
                      {...register('name')}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                    {errors.name && (
                      <p className="text-red-500 text-sm mt-1">
                        {errors.name.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Phone Number *
                    </label>
                    <input
                      {...register('phone')}
                      placeholder="9876543210"
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                    {errors.phone && (
                      <p className="text-red-500 text-sm mt-1">
                        {errors.phone.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Pincode *
                    </label>
                    <input
                      {...register('pincode')}
                      placeholder="500001"
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                    {errors.pincode && (
                      <p className="text-red-500 text-sm mt-1">
                        {errors.pincode.message}
                      </p>
                    )}
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1">
                      Address (House No, Building, Street) *
                    </label>
                    <textarea
                      {...register('address')}
                      rows={2}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                    {errors.address && (
                      <p className="text-red-500 text-sm mt-1">
                        {errors.address.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      City *
                    </label>
                    <input
                      {...register('city')}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                    {errors.city && (
                      <p className="text-red-500 text-sm mt-1">
                        {errors.city.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      State *
                    </label>
                    <input
                      {...register('state')}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                    {errors.state && (
                      <p className="text-red-500 text-sm mt-1">
                        {errors.state.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Order Items */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold mb-4">Order Items</h2>
                <div className="space-y-4">
                  {items.map((item: any) => (
                    <div key={item.id} className="flex gap-4">
                      <img
                        src={item.garment.thumbnailUrl || item.garment.imageUrl}
                        alt={item.garment.name}
                        className="w-16 h-20 object-cover rounded"
                      />
                      <div className="flex-1">
                        <h3 className="font-medium">{item.garment.name}</h3>
                        <p className="text-sm text-gray-600">
                          Size: {item.size} | Qty: {item.quantity}
                        </p>
                      </div>
                      <p className="font-semibold">
                        ₹{(item.garment.price * item.quantity).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow p-6 sticky top-4">
                <h2 className="text-xl font-bold mb-4">Order Summary</h2>

                <div className="space-y-3 mb-6">
                  <div className="flex justify-between">
                    <span className="text-gray-600">
                      Subtotal ({items.length} items)
                    </span>
                    <span className="font-medium">
                      ₹{subtotal.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Shipping</span>
                    <span className="font-medium">₹{shipping}</span>
                  </div>
                  <div className="border-t pt-3 flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span className="text-purple-600">
                      ₹{total.toLocaleString()}
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isProcessing}
                  className="w-full bg-purple-600 text-white py-4 rounded-lg font-semibold hover:bg-purple-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    'Place Order'
                  )}
                </button>

                <div className="mt-4 text-xs text-gray-500 text-center">
                  By placing this order, you agree to our Terms & Conditions
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
```

### Orders Page

```tsx
// apps/web/src/app/orders/page.tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import { orderAPI } from '@/lib/api';
import { Package, Clock, CheckCircle, XCircle } from 'lucide-react';
import Link from 'next/link';

export default function OrdersPage() {
  const { data: orders, isLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: () => orderAPI.list()
  });

  if (isLoading) {
    return <div className="p-8 text-center">Loading orders...</div>;
  }

  const orderList = orders?.data || [];

  if (orderList.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Package className="w-24 h-24 text-gray-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">No orders yet</h2>
          <p className="text-gray-600 mb-6">
            Start shopping to place your first order
          </p>
          <Link
            href="/shop"
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 inline-block"
          >
            Browse Products
          </Link>
        </div>
      </div>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'CONFIRMED':
      case 'SHIPPED':
        return <Package className="w-5 h-5 text-blue-500" />;
      case 'DELIVERED':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      default:
        return <XCircle className="w-5 h-5 text-red-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        <h1 className="text-3xl font-bold mb-8">My Orders</h1>

        <div className="space-y-4">
          {orderList.map((order: any) => (
            <Link
              key={order.id}
              href={`/orders/${order.id}`}
              className="block bg-white rounded-lg shadow hover:shadow-lg transition p-6"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {getStatusIcon(order.status)}
                    <span className="font-semibold">{order.orderNumber}</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    Placed on {new Date(order.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-purple-600">
                    ₹{order.total.toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-600">
                    {order.items.length} item{order.items.length > 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              {/* Order Items Preview */}
              <div className="flex gap-2 overflow-x-auto">
                {order.items.slice(0, 4).map((item: any) => (
                  <img
                    key={item.id}
                    src={item.garment.thumbnailUrl || item.garment.imageUrl}
                    alt={item.garment.name}
                    className="w-16 h-20 object-cover rounded"
                  />
                ))}
                {order.items.length > 4 && (
                  <div className="w-16 h-20 bg-gray-100 rounded flex items-center justify-center text-gray-500 text-sm">
                    +{order.items.length - 4}
                  </div>
                )}
              </div>

              {/* Status Badge */}
              <div className="mt-4">
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                  order.status === 'DELIVERED'
                    ? 'bg-green-100 text-green-800'
                    : order.status === 'SHIPPED'
                    ? 'bg-blue-100 text-blue-800'
                    : order.status === 'CONFIRMED'
                    ? 'bg-purple-100 text-purple-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {order.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
```

---

## Day 6: Seed Data & Testing

### Seed Database Script

```typescript
// scripts/seed.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const sampleGarments = [
  {
    name: 'Kanjivaram Silk Saree - Red & Gold',
    description: 'Traditional Kanjivaram silk saree with intricate zari work',
    category: 'SAREE',
    region: 'SOUTH_INDIAN',
    imageUrl: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=600',
    thumbnailUrl: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=300',
    price: 15999,
    colors: ['red', 'gold'],
    sizes: ['Free Size'],
    inStock: true,
    stockCount: 10
  },
  {
    name: 'Banarasi Silk Lehenga',
    description: 'Elegant Banarasi lehenga perfect for weddings',
    category: 'LEHENGA',
    region: 'NORTH_INDIAN',
    imageUrl: 'https://images.unsplash.com/photo-1583391733956-6c78276477e2?w=600',
    thumbnailUrl: 'https://images.unsplash.com/photo-1583391733956-6c78276477e2?w=300',
    price: 28999,
    colors: ['maroon', 'gold'],
    sizes: ['S', 'M', 'L', 'XL'],
    inStock: true,
    stockCount: 15
  },
  {
    name: 'Anarkali Kurta Set',
    description: 'Flowing anarkali with embroidered dupatta',
    category: 'ANARKALI',
    region: 'PAN_INDIAN',
    imageUrl: 'https://images.unsplash.com/photo-1583391733981-5aca39a06e83?w=600',
    thumbnailUrl: 'https://images.unsplash.com/photo-1583391733981-5aca39a06e83?w=300',
    price: 4999,
    colors: ['pink', 'white'],
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
    inStock: true,
    stockCount: 25
  }
  // Add 20-30 more...
];

async function main() {
  console.log('Seeding database...');

  for (const garment of sampleGarments) {
    await prisma.garment.create({ data: garment });
  }

  console.log(`✅ Created ${sampleGarments.length} garments`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

Run: `tsx scripts/seed.ts`

---

## Day 7: Deployment

### Environment Variables

```bash
# .env.production

# Database (Supabase)
DATABASE_URL="postgresql://..."

# Hugging Face
HUGGINGFACE_API_KEY="hf_xxx"

# Vercel Blob Storage
BLOB_READ_WRITE_TOKEN="vercel_blob_xxx"

# Razorpay
RAZORPAY_KEY_ID="rzp_live_xxx"
RAZORPAY_KEY_SECRET="xxx"

# App URL
APP_URL="https://vyuga.vercel.app"
NEXT_PUBLIC_API_URL="https://vyuga-api.railway.app/api"

# Clerk (if using)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_live_xxx"
CLERK_SECRET_KEY="sk_live_xxx"
```

### Deploy Frontend (Vercel)

```bash
# Install Vercel CLI
pnpm add -g vercel

# Deploy
cd apps/web
vercel --prod

# Set environment variables in Vercel dashboard
```

### Deploy Backend (Railway)

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Create project
railway init

# Deploy
cd apps/api
railway up

# Add environment variables
railway variables set DATABASE_URL="..."
railway variables set HUGGINGFACE_API_KEY="..."
```

### Quick Deploy Script

```bash
#!/bin/bash
# deploy.sh

echo "🚀 Deploying VYUGA..."

# Build all apps
pnpm build

# Deploy frontend
cd apps/web
vercel --prod

# Deploy backend
cd ../api
railway up

echo "✅ Deployment complete!"
echo "Frontend: https://vyuga.vercel.app"
echo "API: https://vyuga-api.railway.app"
```

---

## Testing Checklist

### Manual Testing (30 minutes)

- [ ] **Homepage loads** with product grid
- [ ] **Search works** on shop page
- [ ] **Product detail page** shows garment info
- [ ] **Try-on upload** accepts image
- [ ] **Try-on processes** and shows result (wait 30s)
- [ ] **Add to cart** works from result page
- [ ] **Cart page** shows items correctly
- [ ] **Checkout form** validates inputs
- [ ] **Razorpay modal** opens on "Place Order"
- [ ] **Test payment** succeeds (use test card: 4111 1111 1111 1111)
- [ ] **Order confirmation** page shows
- [ ] **Orders page** lists completed order

### Test Card Details (Razorpay Test Mode)
```
Card Number: 4111 1111 1111 1111
Expiry: Any future date (e.g., 12/25)
CVV: Any 3 digits (e.g., 123)
```

---

## Complete File Checklist

### Backend (`apps/api/`)
- [x] `src/index.ts` - Main server
- [x] `src/lib/prisma.ts` - Database client
- [x] `src/routes/garments.ts` - Catalog API
- [x] `src/routes/tryon.ts` - Try-on API
- [x] `src/routes/cart.ts` - Cart API
- [x] `src/routes/orders.ts` - Orders API
- [x] `src/services/huggingface.ts` - ML integration
- [x] `src/services/storage.ts` - Blob storage
- [x] `package.json`
- [x] `tsconfig.json`
- [x] `.env`

### Frontend (`apps/web/`)
- [x] `src/app/layout.tsx` - Root layout
- [x] `src/app/page.tsx` - Homepage
- [x] `src/app/shop/page.tsx` - Product catalog
- [x] `src/app/product/[id]/page.tsx` - Product detail
- [x] `src/app/try-on/page.tsx` - Upload photo
- [x] `src/app/try-on/[id]/page.tsx` - Result
- [x] `src/app/cart/page.tsx` - Shopping cart
- [x] `src/app/checkout/page.tsx` - Checkout
- [x] `src/app/orders/page.tsx` - Order history
- [x] `src/components/ProductCard.tsx`
- [x] `src/lib/api.ts` - API client
- [x] `src/store/cart.ts` - Zustand store
- [x] `package.json`
- [x] `tailwind.config.ts`
- [x] `.env.local`

### Database (`packages/database/`)
- [x] `prisma/schema.prisma`
- [x] `package.json`

### Scripts
- [x] `scripts/seed.ts` - Seed database
- [x] `deploy.sh` - Deployment script

---

## Quick Start Commands

```bash
# 1. Install dependencies
pnpm install

# 2. Setup database
cd packages/database
pnpm prisma db push
pnpm prisma generate

# 3. Seed data
tsx scripts/seed.ts

# 4. Start all servers
# Terminal 1: Backend
cd apps/api
pnpm dev

# Terminal 2: Frontend
cd apps/web
pnpm dev

# 5. Open browser
# Frontend: http://localhost:3000
# API: http://localhost:3001
```

---

## Quick Path Summary

### What You Get (7 Days)
✅ Full e-commerce platform  
✅ AI virtual try-on (Hugging Face API)  
✅ Shopping cart & checkout  
✅ Razorpay payment integration  
✅ Order management  
✅ Responsive design  
✅ Deployed to production  

### What's Missing (Production Path)
❌ Admin dashboard  
❌ Email notifications  
❌ Order tracking integration  
❌ Reviews & ratings  
❌ Advanced fraud detection  
❌ Self-hosted ML model  
❌ Performance optimization  
❌ Comprehensive testing  

### Cost (Quick Path)
- **Supabase Free**: $0
- **Vercel Hobby**: $0
- **Railway Starter**: $5/month
- **Hugging Face Inference**: ~$50/month (500 try-ons)
- **Razorpay**: 2% per transaction
- **Total**: ~$55/month + transaction fees

---

**This Quick Path gets you a WORKING DEMO in 7 days. Perfect for hackathons, investor demos, or MVP validation!** 🚀
    
