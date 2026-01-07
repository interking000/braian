import { z } from 'zod';
import prisma from '../../../config/prisma-client';
import Authentication from '../../../middlewares/authentication';
import { FastifyReply, FastifyRequest, RouteOptions } from 'fastify';

const paramsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export default {
  url: '/app_notifications/delete/:id',
  method: 'DELETE',
  onRequest: [Authentication.user],
  handler: async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = paramsSchema.safeParse((req as any).params);
    if (!parsed.success) {
      reply.status(400);
      return reply.send({ message: 'ID inválido' });
    }

    const id = parsed.data.id;
    const user_id = (req as any).user.id;

    try {
      // ✅ Prisma devuelve: { count: number }
      const deleted = await (prisma as any).appNotification.deleteMany({
        where: { id, user_id },
      });

      if (!deleted || typeof deleted.count !== 'number') {
        reply.status(500);
        return reply.send({ message: 'Error eliminando notificación' });
      }

      if (deleted.count <= 0) {
        reply.status(404);
        return reply.send({ message: 'Notificación no encontrada' });
      }

      return reply.send({ ok: true, deleted: deleted.count });
    } catch (err) {
      reply.status(500);
      return reply.send({ message: 'Error eliminando notificación' });
    }
  },
} as RouteOptions;