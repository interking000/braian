import { z } from 'zod';
import prisma from '../../../config/prisma-client';
import SafeCallback from '../../../utils/safe-callback';
import Authentication from '../../../middlewares/authentication';
import { FastifyReply, FastifyRequest, RouteOptions } from 'fastify';

const paramsSchema = z.object({
  id: z.string(),
});

export default {
  url: '/cdn/:id',
  method: 'DELETE',
  onRequest: [Authentication.user],
  handler: async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = paramsSchema.parse(req.params);

    const category = await SafeCallback(() =>
      prisma.cdn.deleteMany({
        where: {
          id,
          user_id: req.user.id,
        },
      })
    );

    if (!category) {
      reply.status(400);
      throw new Error('No fue posible eliminar CDN');
    }

    reply.status(204).send();
  },
} as RouteOptions;

