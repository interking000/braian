import { z } from 'zod';
import GetAppText from './get-app-text';
import AESCrypt from '../../utils/crypto';
import GetAppConfig from './get-app-config';
import GetAppLayout from './get-app-layout';
import prisma from '../../config/prisma-client';
import SafeCallback from '../../utils/safe-callback';
import { FastifyReply, FastifyRequest, RouteOptions } from 'fastify';

const headerSchema = z.object({
  password: z.string().optional(),
  'dtunnel-token': z.string(),

  // ✅ agregamos "app_notifications" sin tocar los existentes
  'dtunnel-update': z.enum(['app_config', 'app_layout', 'app_text', 'app_notifications']),

  'user-agent': z.literal('DTunnelMod (@DTunnelMod, @DTunnelModGroup, @LightXVD)'),

  // ✅ opcional (clientes viejos lo ignoran)
  'dtunnel-last-notification-id': z.string().optional(),
});

type UpdateKey = z.infer<typeof headerSchema>['dtunnel-update'];

// ✅ Los handlers originales (funciones reales)
const handler = {
  app_text: GetAppText,
  app_config: GetAppConfig,
  app_layout: GetAppLayout,
} as const;

function toLastId(lastIdRaw?: string) {
  const n = Number(lastIdRaw ?? 0);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

// ✅ NUEVO: esto SÍ es una función (no un endpoint RouteOptions)
async function fetchNotifications(user_id: string, lastIdRaw?: string) {
  const last_id = toLastId(lastIdRaw);
  const now = new Date();

  // Si prisma aún no regeneró tipos, evitamos error TS con any
  const p: any = prisma;

  const rows = await SafeCallback(() =>
    p.appNotification.findMany({
      where: {
        user_id,
        status: 'ACTIVE',
        id: { gt: last_id },
        OR: [{ scheduled_at: null }, { scheduled_at: { lte: now } }],
      },
      orderBy: { id: 'asc' },
      take: 10,
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

  const notifications: any[] = (rows as any[]) ?? [];
  const newLastId = notifications.length
    ? notifications[notifications.length - 1].id
    : last_id;

  return {
    last_id: newLastId,
    count: notifications.length,
    notifications,
    server_time: now.toISOString(),
  };
}

export default {
  url: '/api/dtunnelmod',
  method: 'GET',
  handler: async (req: FastifyRequest, reply: FastifyReply) => {
    const password =
      'DTunnelModSecret-API-9c69a0b72b442ccac3e6aaaa7630d12f2b351fe395e9fe667efa0907cde90da5';

    const headers = headerSchema.safeParse(req.headers);
    if (!headers.success) return reply.send();

    const user_id = headers.data['dtunnel-token'];
    const update: UpdateKey = headers.data['dtunnel-update'];

    // ✅ respuesta según update
    const response =
      update === 'app_notifications'
        ? await fetchNotifications(user_id, headers.data['dtunnel-last-notification-id'])
        : await handler[update](user_id);

    // ✅ modo admin: devuelve limpio (sin cifrar)
    if (headers.data.password === password) {
      // app_config y app_layout suelen venir como strings JSON
      if (update === 'app_config' || update === 'app_layout') {
        return reply.send((response as any[]).map((data: any) => JSON.parse(data)));
      }
      return reply.send(response);
    }

    // ✅ cliente normal: cifrado igual que el original
    return reply.send(AESCrypt.encrypt(password, JSON.stringify(response)));
  },
} as RouteOptions;
