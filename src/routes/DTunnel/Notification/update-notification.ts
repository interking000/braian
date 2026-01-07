import { z } from 'zod';
import prisma from '../../../config/prisma-client';
import SafeCallback from '../../../utils/safe-callback';
import Authentication from '../../../middlewares/authentication';
import { FastifyReply, FastifyRequest, RouteOptions } from 'fastify';

const schema = z.object({
  title: z.string().min(1),
  subtitle: z.string().nullable().optional(),
  message: z.string().min(1),
  link: z.string().nullable().optional(),
  image: z.string().nullable().optional(),
  scheduled_at: z.string().datetime().nullable().optional(),
  status: z.enum(['ACTIVE','DISABLED']).optional(),
});

export default {
  url: '/app_notifications/update/:id',
  method: 'PUT',
  onRequest: [Authentication.user],
  handler: async (req: FastifyRequest, reply: FastifyReply) => {
    const id = Number((req as any).params.id);
    if (!id) return reply.status(400).send({ message:'ID inválido' });

    const parsed = schema.safeParse((req as any).body);
    if (!parsed.success) return reply.status(400).send({ message:'Payload inválido' });

    const p: any = prisma;

    const updated = await SafeCallback(() =>
      p.appNotification.updateMany({
        where: { id, user_id: (req as any).user.id },
        data: {
          ...parsed.data,
          scheduled_at: parsed.data.scheduled_at
            ? new Date(parsed.data.scheduled_at)
            : null,
        },
      })
    );

    reply.send({ ok: true });
  },
} as RouteOptions;