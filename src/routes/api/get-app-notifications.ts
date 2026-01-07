import { z } from 'zod';
import prisma from '../../config/prisma-client';
import SafeCallback from '../../utils/safe-callback';
import AESCrypt from '../../utils/crypto';
import { FastifyReply, FastifyRequest, RouteOptions } from 'fastify';

/**
 * GET /api/notifications
 * Headers:
 *  - dtunnel-token: string (user_id)
 *  - password?: string (master password => respuesta sin cifrar)
 *
 * Query:
 *  - last_id?: number (último id recibido por la APK)
 *  - limit?: number (1..50)
 */

// ✅ Headers similares a tu API actual (sin romper nada)
const headerSchema = z.object({
  password: z.string().optional(),
  'dtunnel-token': z.string().min(1),
  // opcional: por si querés exigir luego un user-agent fijo
  'user-agent': z.string().optional(),
});

// ✅ Query: la app puede mandar el último id recibido
const querySchema = z.object({
  last_id: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export default {
  url: '/api/notifications',
  method: 'GET',
  handler: async (req: FastifyRequest, reply: FastifyReply) => {
    // ⚠️ mantenemos tu lógica de password maestra
    const masterPassword =
      'DTunnelModSecret-API-9c69a0b72b442ccac3e6aaaa7630d12f2b351fe395e9fe667efa0907cde90da5';

    // ✅ validar headers como hacés en dtunnel-mod
    const headersParsed = headerSchema.safeParse(req.headers);
    if (!headersParsed.success) {
      // igual que tu endpoint original: si headers inválidos => send vacío
      return reply.send();
    }

    // ✅ validar query
    const queryParsed = querySchema.safeParse((req as any).query ?? {});
    if (!queryParsed.success) {
      reply.status(400);
      return reply.send({ message: 'Query inválida', issues: queryParsed.error.issues });
    }

    const user_id = headersParsed.data['dtunnel-token'];
    const last_id = queryParsed.data.last_id ?? 0;
    const limit = queryParsed.data.limit;

    const now = new Date();

    // ✅ Traer notificaciones nuevas (id > last_id) + ACTIVE + scheduled_at ok
    const rows = await SafeCallback(() =>
      prisma.appNotification.findMany({
        where: {
          user_id,
          status: 'ACTIVE',
          id: { gt: last_id },
          OR: [{ scheduled_at: null }, { scheduled_at: { lte: now } }],
        },
        orderBy: { id: 'asc' },
        take: limit,
        select: {
          id: true,
          title: true,
          subtitle: true,
          message: true,
          link: true,
          image: true,
          scheduled_at: true,
          created_at: true,
          updated_at: true,
        },
      })
    );

    // ✅ SafeCallback puede devolver null si falla
    const notifications = rows ?? [];

    // ✅ last_id nuevo (para polling incremental)
    const newLastId = notifications.length
      ? notifications[notifications.length - 1].id
      : last_id;

    // ✅ payload estándar para la APK
    const payload = {
      last_id: newLastId,
      count: notifications.length,
      notifications,
      server_time: now.toISOString(),
    };

    // ✅ Si mandan password maestra, devolvemos plano
    if (headersParsed.data.password === masterPassword) {
      return reply.send(payload);
    }

    // ✅ Si no, devolvemos cifrado igual que tu API principal
    return reply.send(AESCrypt.encrypt(masterPassword, JSON.stringify(payload)));
  },
} as RouteOptions;
