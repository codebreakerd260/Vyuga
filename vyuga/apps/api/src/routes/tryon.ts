import { FastifyPluginAsync } from 'fastify';
import { prisma } from '@vyuga/database';
import { uploadToBlob } from '../services/storage.ts';
import { generateTryOn } from '../services/huggingface.ts';
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
    const fields: any = {};
    for await (const field of data.fields) {
      fields[field.fieldname] = field.value;
    }

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
