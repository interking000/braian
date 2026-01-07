import { z } from 'zod';
import prisma from '../../../config/prisma-client';
import SafeCallback from '../../../utils/safe-callback';
import Authentication from '../../../middlewares/authentication';
import { FastifyReply, FastifyRequest, RouteOptions } from 'fastify';

const querySchema = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export default {
  url: '/app_notifications/list',
  method: 'GET',
  onRequest: [Authentication.user],
  handler: async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = querySchema.safeParse((req as any).query ?? {});
    if (!parsed.success) {
      reply.status(400);
      return reply.send({ message: 'Query inválida', issues: parsed.error.issues });
    }

    const { offset, limit } = parsed.data;
    const user_id = (req as any).user.id;

    const rows = (await SafeCallback(() =>
      (prisma as any).appNotification.findMany({
        where: { user_id },
        orderBy: { created_at: 'desc' },
        skip: offset,
        take: limit,
        select: {
          id: true,
          title: true,
          subtitle: true,
          message: true,
          link: true,
          image: true,
          scheduled_at: true,
          status: true,
          created_at: true,
          updated_at: true,
        },
      })
    )) as any[] | null;

    const result = (rows ?? []).map((n: any) => ({
      id: n.id,
      title: n.title,
      subtitle: n.subtitle,
      message: n.message,
      link: n.link,
      image: n.image,
      scheduled_at: n.scheduled_at,
      status: n.status,
      created_at: n.created_at,
      updated_at: n.updated_at,
    }));

    return reply.send({
      offset,
      limit,
      total: result.length,
      result,
    });
  },
} as RouteOptions;