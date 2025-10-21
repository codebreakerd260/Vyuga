import { FastifyRequest } from 'fastify';
import { verifyToken } from '@clerk/backend';

export async function authenticateUser(request: FastifyRequest) {
  const token = request.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    throw new Error('Unauthorized');
  }

  const { userId } = await verifyToken(token, {
    secretKey: process.env.CLERK_SECRET_KEY
  });

  return userId;
}
