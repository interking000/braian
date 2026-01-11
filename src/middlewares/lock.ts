// src/middlewares/lock.ts
import prisma from '../config/prisma-client';
import { FastifyReply, FastifyRequest } from 'fastify';

function esFuturo(d?: Date | null) {
  return !!d && d.getTime() > Date.now();
}
function sumaDias(dias: number) {
  return new Date(Date.now() + dias * 24 * 60 * 60 * 1000);
}

function esApi(req: FastifyRequest) {
  return String(req.url ?? '').startsWith('/api/');
}
function quiereHTML(req: FastifyRequest) {
  const accept = String(req.headers['accept'] ?? '');
  return accept.includes('text/html');
}

// ✅ Rutas libres (NO bloquear)
function esRutaLibre(req: FastifyRequest) {
  const url = String(req.url ?? '').split('?')[0];

  return (
    url === '/login' ||
    url === '/register' ||
    url === '/acceso' ||
    url === '/logout' ||
    url.startsWith('/public/') ||
    url.startsWith('/assets/') ||
    url.startsWith('/static/') ||
    url === '/api/mercadopago-webhook'
  );
}

// ✅ Si es HTML redirige (no pantalla blanca). Si es API devuelve JSON.
function responderBloqueo(req: FastifyRequest, reply: FastifyReply, status: number, payload: any) {
  if (quiereHTML(req) && !esApi(req)) {
    reply.redirect('/acceso');
    return;
  }
  reply.status(status).send(payload);
}

export async function lock(req: FastifyRequest, reply: FastifyReply) {
  // 0) nunca bloquear rutas libres
  if (esRutaLibre(req)) return;

  const userId = (req as any).user?.id;

  // 1) si no está logueado -> login (html) / 401 (api)
  if (!userId) {
    if (quiereHTML(req) && !esApi(req)) {
      reply.redirect('/login');
      return;
    }
    reply.status(401).send({ ok: false, code: 'NO_AUTH' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    if (quiereHTML(req) && !esApi(req)) {
      reply.redirect('/login');
      return;
    }
    reply.status(401).send({ ok: false, code: 'NO_AUTH' });
    return;
  }

  // 2) Si está en GRACE y ya venció el plazo -> BORRAR TODO (cascade)
  if (user.access_status === 'GRACE' && user.grace_delete_at && !esFuturo(user.grace_delete_at)) {
    await prisma.user.delete({ where: { id: userId } });

    // si es html: mandalo a register/login
    if (quiereHTML(req) && !esApi(req)) {
      reply.redirect('/register');
      return;
    }

    reply.status(410).send({
      ok: false,
      code: 'CUENTA_BORRADA',
      mensaje: 'Pasaron los 2 días sin renovar. Se borró la cuenta y todos sus datos.',
    });
    return;
  }

  // 3) ACTIVE vigente -> deja pasar
  if (user.access_status === 'ACTIVE' && esFuturo(user.access_ends_at)) return;

  // 4) ACTIVE vencido -> pasar a GRACE (2 días) y BLOQUEAR
  if (user.access_status === 'ACTIVE' && user.access_ends_at && !esFuturo(user.access_ends_at)) {
    const borrarEn = sumaDias(2);

    await prisma.user.update({
      where: { id: userId },
      data: {
        access_status: 'GRACE',
        grace_delete_at: borrarEn,
      },
    });

    return responderBloqueo(req, reply, 403, {
      ok: false,
      code: 'PLAN_VENCIDO',
      mostrar_modal_compra: true,
      mensaje: 'Tu plan venció. Tenés 2 días para renovar o se borrarán todos tus datos.',
      grace_delete_at: borrarEn,
    });
  }

  // 5) GRACE vigente -> BLOQUEAR (sin borrar todavía)
  if (user.access_status === 'GRACE' && user.grace_delete_at && esFuturo(user.grace_delete_at)) {
    return responderBloqueo(req, reply, 403, {
      ok: false,
      code: 'EN_GRACIA',
      mostrar_modal_compra: true,
      mensaje: 'Tenés 2 días para renovar o se borrarán todos tus datos.',
      grace_delete_at: user.grace_delete_at,
    });
  }

  // 6) Otros estados (NONE/BLOCKED/etc) -> BLOQUEAR
  return responderBloqueo(req, reply, 403, {
    ok: false,
    code: 'ACCESO_REQUERIDO',
    mostrar_modal_compra: true,
    mensaje: 'Comprá acceso para continuar.',
  });
}
