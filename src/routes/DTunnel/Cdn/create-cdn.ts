import { cdnSchema } from './zod-schema';
import prisma from '../../../config/prisma-client';
import SafeCallback from '../../../utils/safe-callback';
import Authentication from '../../../middlewares/authentication';
import { FastifyReply, FastifyRequest, RouteOptions } from 'fastify';

export default {
  url: '/cdn',
  method: 'POST',
  onRequest: [Authentication.user],
  handler: async (req: FastifyRequest, reply: FastifyReply) => {
    const { name, url, status } = cdnSchema.parse(req.body);

    const cdn = await SafeCallback(() =>
      prisma.cdn.create({
        data: {
          url,
          name,
          status,
          user_id: req.user.id,
        },
      })
    );

    if (!cdn) {
      throw new Error('No fue posible crear CDN');
    }

    reply.status(201).send({ cdn_id: cdn.id });
  },
} as RouteOptions;

