import prisma from '../config/prisma-client';
import { FastifyReply, FastifyRequest } from 'fastify';

function isFuture(d?: Date | null) {
  return !!d && d.getTime() > Date.now();
}
function addDays(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function pathOnly(req: FastifyRequest) {
  return String(req.url || '').split('?')[0];
}

export async function lock(req: FastifyRequest, reply: FastifyReply) {
  const p = pathOnly(req);

  // ✅ Rutas libres
  if (
    p === '/' ||                 // ✅ Home siempre accesible (ahí mostramos compra)
    p === '/login' ||
    p === '/register' ||
    p.startsWith('/static/') ||
    p.startsWith('/public/') ||
    p.startsWith('/assets/') ||
    p === '/api/mp/hook' ||       // webhook
    p.startsWith('/api/mp/')      // permitir crear pagos
  ) return;

  const userId = (req as any).user?.id;
  if (!userId) return reply.redirect('/login');

  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      access_status: true,
      trial_ends_at: true,
      access_ends_at: true,
      grace_delete_at: true,
    },
  });

  if (!u) return reply.redirect('/login');

  // ✅ TRIAL vigente
  if (u.access_status === 'TRIAL' && isFuture(u.trial_ends_at)) return;

  // ✅ TRIAL vencido -> NONE + Home
  if (u.access_status === 'TRIAL' && u.trial_ends_at && !isFuture(u.trial_ends_at)) {
    await prisma.user.update({ where: { id: u.id }, data: { access_status: 'NONE' } });
    return reply.redirect('/?pay=1');
  }

  // ✅ ACTIVE vigente
  if (u.access_status === 'ACTIVE' && isFuture(u.access_ends_at)) return;

  // ✅ ACTIVE vencido -> GRACE 2 días + Home
  if (u.access_status === 'ACTIVE' && u.access_ends_at && !isFuture(u.access_ends_at)) {
    await prisma.user.update({
      where: { id: u.id },
      data: { access_status: 'GRACE', grace_delete_at: addDays(2) },
    });
    return reply.redirect('/?pay=1');
  }

  // ✅ GRACE vencido -> borrar + register
  if (u.access_status === 'GRACE' && u.grace_delete_at && !isFuture(u.grace_delete_at)) {
    await prisma.user.delete({ where: { id: u.id } });
    return reply.redirect('/register');
  }

  // ✅ GRACE vigente -> Home
  if (u.access_status === 'GRACE') {
    return reply.redirect('/?pay=1');
  }

  // ✅ cualquier otro estado -> Home
  return reply.redirect('/?pay=1');
}

