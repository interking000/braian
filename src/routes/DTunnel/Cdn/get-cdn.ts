import { z } from 'zod';
import prisma from '../../../config/prisma-client';
import Authentication from '../../../middlewares/authentication';
import { FastifyReply, FastifyRequest, RouteOptions } from 'fastify';

const querySchema = z.object({
  offset: z
    .string()
    .optional()
    .default('1')
    .transform((v) => {
      const n = Number.parseInt(v, 10);
      return Number.isFinite(n) && n > 0 ? n : 1;
    }),
  limit: z
    .string()
    .optional()
    .default('20')
    .transform((v) => {
      const n = Number.parseInt(v, 10);
      // limit sano (evita que pidan 999999 y te tumben)
      if (!Number.isFinite(n) || n <= 0) return 20;
      return Math.min(n, 100);
    }),
});

export default {
  url: '/cdn_list',
  method: 'GET',
  onRequest: [Authentication.user],
  handler: async (req: FastifyRequest, reply: FastifyReply) => {
    const query = querySchema.parse(req.query);
    const limit = query.limit;
    const offset = query.offset;

    const where = {
      user_id: req.user.id,
      // ✅ si querés SOLO activos, dejalo:
      // status: 'ACTIVE',
    } as const;

    const total = await prisma.cdn.count({ where });

    const result = await prisma.cdn.findMany({
      where,
      select: {
        id: true,
        name: true,
        url: true,
        status: true, // si no lo querés, ponelo en false (o sacalo)
      },
      skip: (offset - 1) * limit,
      take: limit,
      orderBy: { name: 'asc' },
    });

    reply.send({
      status: 200,
      data: {
        total,
        count: result.length,
        limit,
        offset,
        result,
      },
    });
  },
} as RouteOptions;
