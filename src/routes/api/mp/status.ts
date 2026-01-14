import prisma from '../../../config/prisma-client';
import Authentication from '../../../middlewares/authentication';
import { FastifyReply, FastifyRequest, RouteOptions } from 'fastify';

export default {
  url: '/api/mp/status/:ref',
  method: 'GET',
  onRequest: [Authentication.user],
  handler: async (req: FastifyRequest, reply: FastifyReply) => {
    const ref = String((req.params as any)?.ref ?? '');
    if (!ref) return reply.status(400).send({ ok: false, error: 'MISSING_ref' });

    const payment = await prisma.payment.findFirst({
      where: { external_ref: ref },
      include: { user: true, plan: true },
    });

    if (!payment) return reply.status(404).send({ ok: false });

    return reply.send({
      ok: true,
      ref,
      status: payment.status,
      plan: payment.plan ? { code: payment.plan.code, months: payment.plan.months, price_ars: payment.plan.price_ars } : null,
      access_ends_at: payment.user?.access_ends_at ?? null,
      mp_payment_id: payment.mp_payment_id ?? null,
    });
  },
} as RouteOptions;
