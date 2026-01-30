import prisma from '../../../config/prisma-client';
import Authentication from '../../../middlewares/authentication';
import { FastifyReply, FastifyRequest, RouteOptions } from 'fastify';
import crypto from 'crypto';

const TICKET_SECRET = process.env.PAY_TICKET_SECRET || '';

function assertTicketSecret() {
  if (!TICKET_SECRET || TICKET_SECRET.length < 16) throw new Error('PAY_TICKET_SECRET_MISSING_OR_WEAK');
}

function unb64url(s: string) {
  return Buffer.from(s, 'base64url').toString('utf8');
}

function verifyTicket(ticket: string) {
  assertTicketSecret();

  const [dataB64, sig] = String(ticket || '').split('.');
  if (!dataB64 || !sig) return null;

  const data = unb64url(dataB64);
  const calc = crypto.createHmac('sha256', TICKET_SECRET).update(data).digest('hex');

  try {
    if (!crypto.timingSafeEqual(Buffer.from(calc, 'hex'), Buffer.from(sig, 'hex'))) return null;
  } catch {
    return null;
  }

  const [paymentId, userId, planId, amountStr, currency] = data.split('|');
  const amount = Number(amountStr);
  if (!paymentId || !userId || !planId || !Number.isFinite(amount) || !currency) return null;

  return { paymentId, userId, planId, amount, currency };
}

function safeJsonParse(s: any) {
  try {
    if (!s) return {};
    if (typeof s === 'object') return s;
    return JSON.parse(String(s));
  } catch {
    return {};
  }
}

export default {
  url: '/api/mp/status/:ref',
  method: 'GET',
  onRequest: [Authentication.user],
  handler: async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (req as any).user;
      if (!user?.id) return reply.status(401).send({ ok: false, error: 'UNAUTHORIZED' });

      const ref = String((req.params as any)?.ref ?? '').trim();
      if (!ref) return reply.status(400).send({ ok: false, error: 'MISSING_ref' });

      const ticket =
        String((req.query as any)?.ticket ?? '').trim() ||
        String(req.headers['x-pay-ticket'] ?? '').trim();

      if (!ticket) return reply.status(401).send({ ok: false, error: 'TICKET_REQUIRED' });

      const parsed = verifyTicket(ticket);
      if (!parsed) return reply.status(401).send({ ok: false, error: 'TICKET_INVALID' });

      if (String(parsed.userId) !== String(user.id)) {
        return reply.status(403).send({ ok: false, error: 'TICKET_USER_MISMATCH' });
      }

      const payment = await prisma.payment.findFirst({
        where: { external_ref: ref, user_id: user.id },
        include: { user: true, plan: true },
      });

      if (!payment) return reply.status(404).send({ ok: false, error: 'NOT_FOUND' });

      // ✅ comparación por string
      if (String(parsed.paymentId) !== String(payment.id)) {
        return reply.status(403).send({ ok: false, error: 'TICKET_PAYMENT_MISMATCH' });
      }

      const meta = safeJsonParse(payment.metadata);
      if (meta?.pay_ticket && String(meta.pay_ticket) !== String(ticket)) {
        return reply.status(403).send({ ok: false, error: 'TICKET_METADATA_MISMATCH' });
      }

      const accessEnds = payment.user?.access_ends_at ?? null;
      const unlocked =
        payment.user?.access_status === 'ACTIVE' &&
        !!accessEnds &&
        new Date(accessEnds).getTime() > Date.now();

      return reply.send({
        ok: true,
        ref,
        status: payment.status,
        plan: payment.plan
          ? { code: payment.plan.code, months: payment.plan.months, price_ars: payment.plan.price_ars }
          : null,
        access_status: payment.user?.access_status ?? null,
        access_ends_at: accessEnds,
        mp_payment_id: payment.mp_payment_id ?? null,
        unlocked,
      });
    } catch (e: any) {
      console.error('mp status error', e?.message || e);
      return reply.status(500).send({ ok: false, error: 'STATUS_ERROR' });
    }
  },
} as RouteOptions;
