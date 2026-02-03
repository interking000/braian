import { z } from 'zod';
import { cdnSchema } from './zod-schema';
import prisma from '../../../config/prisma-client';
import SafeCallback from '../../../utils/safe-callback';
import Authentication from '../../../middlewares/authentication';
import { FastifyReply, FastifyRequest, RouteOptions } from 'fastify';

const paramsSchema = z.object({
  id: z.string(),
});

export default {
  url: '/cdn/:id',
  method: 'PUT',
  onRequest: [Authentication.user],
  handler: async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = paramsSchema.parse(req.params);
    const { name, url, status } = cdnSchema.parse(req.body);

    const cdn = await SafeCallback(() =>
      prisma.cdn.update({
        where: {
          id,
          user_id: req.user.id,
        },
        data: {
          name,
          url,
          status,
        },
      })
    );

    if (!cdn) {
      reply.status(400);
      throw new Error('No fue posible editar esa CDN');
    }

    reply.send({ status: 200 });
  },
} as RouteOptions;
