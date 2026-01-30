// DTunnel/src/routes/api/mp/status.ts
import prisma from '../../../config/prisma-client';
import Authentication from '../../../middlewares/authentication';
import { FastifyReply, FastifyRequest, RouteOptions } from 'fastify';

export default {
  url: '/api/mp/status/:ref',
  method: 'GET',
  onRequest: [Authentication.user],
  handler: async (req: FastifyRequest, reply: FastifyReply) => {
    const user = (req as any).user;
    if (!user?.id) return reply.status(401).send({ ok: false, error: 'UNAUTHORIZED' });

    const ref = String((req.params as any)?.ref ?? '').trim();
    if (!ref) return reply.status(400).send({ ok: false, error: 'MISSING_ref' });

    // ✅ solo el dueño del pago puede ver su ref
    const payment = await prisma.payment.findFirst({
      where: { external_ref: ref, user_id: user.id },
      include: { user: true, plan: true },
    });

    if (!payment) return reply.status(404).send({ ok: false, error: 'NOT_FOUND' });

    const accessEnds = payment.user?.access_ends_at ?? null;
    const accessStatus = payment.user?.access_status ?? null;

    const unlocked =
      accessStatus === 'ACTIVE' &&
      !!accessEnds &&
      new Date(accessEnds).getTime() > Date.now();

    return reply.send({
      ok: true,
      ref,
      status: payment.status,
      plan: payment.plan
        ? { code: payment.plan.code, months: payment.plan.months, price_ars: payment.plan.price_ars }
        : null,
      access_status: accessStatus,
      access_ends_at: accessEnds,
      mp_payment_id: payment.mp_payment_id ?? null,
      unlocked,
    });
  },
} as RouteOptions;
