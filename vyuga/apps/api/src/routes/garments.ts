import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../lib/prisma.ts';
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
