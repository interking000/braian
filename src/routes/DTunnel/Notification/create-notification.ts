import { z } from 'zod';
import prisma from '../../../config/prisma-client';
import SafeCallback from '../../../utils/safe-callback';
import Authentication from '../../../middlewares/authentication';
import { FastifyReply, FastifyRequest, RouteOptions } from 'fastify';

const schema = z.object({
  title: z.string().min(1).max(80),
  subtitle: z.string().max(140).nullable().optional(),
  message: z.string().min(1).max(5000),
  link: z.string().nullable().optional(),
  image: z.string().nullable().optional(),
  scheduled_at: z.string().datetime().nullable().optional(),
});

export default {
  url: '/app_notifications/create',
  method: 'POST',
  onRequest: [Authentication.user],
  handler: async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = schema.safeParse((req as any).body);
    if (!parsed.success) {
      reply.status(400);
      return reply.send({ message: 'Payload inválido' });
    }

    const p: any = prisma;

    const created = await SafeCallback(() =>
      p.appNotification.create({
        data: {
          user_id: (req as any).user.id,
          title: parsed.data.title,
          subtitle: parsed.data.subtitle ?? null,
          message: parsed.data.message,
          link: parsed.data.link ?? null,
          image: parsed.data.image ?? null,
          scheduled_at: parsed.data.scheduled_at
            ? new Date(parsed.data.scheduled_at)
            : null,
          status: 'ACTIVE',
        },
      })
    );

    if (!created) {
      reply.status(500);
      return reply.send({ message: 'Error al guardar' });
    }

    reply.send({ ok: true });
  },
} as RouteOptions;