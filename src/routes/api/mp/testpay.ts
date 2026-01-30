// DTunnel/src/routes/api/mp/testpay.ts
import prisma from '../../../config/prisma-client';
import Authentication from '../../../middlewares/authentication';
import { FastifyReply, FastifyRequest, RouteOptions } from 'fastify';
import crypto from 'crypto';

// ✅ Token ejemplo SOLO si falta el env (o placeholder)
const MP_ACCESS_TOKEN_EXAMPLE =
  'APP_USR-292459445257292-010909-ad9da859bf8eb657422b278edbbef85f-517943228';

function getMpToken() {
  const envTok = String(process.env.MP_ACCESS_TOKEN || '').trim();
  if (envTok && !envTok.includes('<<APP_USR')) return envTok;
  return MP_ACCESS_TOKEN_EXAMPLE;
}

function getTicketSecret() {
  return String(process.env.PAY_TICKET_SECRET || '').trim();
}

function assertTicketSecret() {
  const s = getTicketSecret();
  if (!s || s.length < 16) throw new Error('PAY_TICKET_SECRET_MISSING_OR_WEAK');
  return s;
}

function makeTicket(payload: {
  paymentId: string;
  userId: string;
  planId: string;
  amount: number;
  currency: string;
}) {
  const secret = assertTicketSecret();
  const data = [
    payload.paymentId,
    payload.userId,
    payload.planId,
    String(payload.amount),
    payload.currency,
  ].join('|');

  const sig = crypto.createHmac('sha256', secret).update(data).digest('hex');
  return `${Buffer.from(data).toString('base64url')}.${sig}`;
}

function hashTicket(ticket: string) {
  return crypto.createHash('sha256').update(String(ticket)).digest('hex');
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

function safeJsonStringify(obj: any) {
  try {
    return JSON.stringify(obj ?? {});
  } catch {
    return '{}';
  }
}

export default {
  url: '/api/mp/testpay',
  method: 'POST',
  onRequest: [Authentication.user],
  handler: async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      // ✅ llave para proteger este endpoint
      const requiredKey = String(process.env.MP_TESTPAY_KEY || '').trim();
      if (!requiredKey) {
        return reply.status(500).send({ ok: false, error: 'MP_TESTPAY_KEY_MISSING' });
      }

      const gotKey = String(req.headers['x-testpay-key'] ?? '').trim();
      if (!gotKey || gotKey !== requiredKey) {
        return reply.status(403).send({ ok: false, error: 'FORBIDDEN' });
      }

      const user = (req as any).user;
      if (!user?.id) return reply.status(401).send({ ok: false, error: 'UNAUTHORIZED' });

      const { plan_code } = (req.body ?? {}) as any;
      if (!plan_code) return reply.status(400).send({ ok: false, error: 'PLAN_REQUIRED' });

      const MP_ACCESS_TOKEN = getMpToken();
      const APP_BASE_URL = String(process.env.APP_BASE_URL || '').trim();
      const FRONTEND_RETURN_URL = String(process.env.FRONTEND_RETURN_URL || '').trim();

      if (!MP_ACCESS_TOKEN) return reply.status(500).send({ ok: false, error: 'MP_ACCESS_TOKEN_MISSING' });
      if (!APP_BASE_URL) return reply.status(500).send({ ok: false, error: 'APP_BASE_URL_MISSING' });
      if (!FRONTEND_RETURN_URL) return reply.status(500).send({ ok: false, error: 'FRONTEND_RETURN_URL_MISSING' });

      // ✅ validar ticket secret
      try {
        assertTicketSecret();
      } catch (e: any) {
        return reply.status(500).send({ ok: false, error: e?.message || 'PAY_TICKET_SECRET_ERROR' });
      }

      const plan = await prisma.plan.findUnique({ where: { code: String(plan_code) } });
      if (!plan || !plan.is_active) return reply.status(404).send({ ok: false, error: 'PLAN_INVALID' });

      const amount = Number(plan.price_ars);
      const currency = 'ARS';
      if (!Number.isFinite(amount) || amount <= 0) {
        return reply.status(400).send({ ok: false, error: 'PLAN_AMOUNT_INVALID' });
      }

      // 1) Crear payment en DB
      const payment = await prisma.payment.create({
        data: {
          user_id: user.id,
          plan_id: plan.id,
          provider: 'MERCADOPAGO',
          status: 'PENDING',
          amount,
          currency,
          external_ref: null,
          metadata: safeJsonStringify({ plan_code: plan.code, months: plan.months, is_testpay: true }),
        },
      });

      const paymentIdStr = String(payment.id);
      const planIdStr = String(plan.id);
      const userIdStr = String(user.id);

      const external_ref = `MP-${paymentIdStr}`;

      const ticket = makeTicket({
        paymentId: paymentIdStr,
        userId: userIdStr,
        planId: planIdStr,
        amount,
        currency,
      });

      const prevMeta = safeJsonParse(payment.metadata);
      const nextMeta = { ...prevMeta, pay_ticket: ticket };

      // ⚠️ Si tu tabla payments NO tiene ticket_hash, borrá esa línea.
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          external_ref,
          metadata: safeJsonStringify(nextMeta),
          ticket_hash: hashTicket(ticket) as any,
        } as any,
      });

      // 2) Crear preferencia en MP
      const preferenceBody: any = {
        items: [
          {
            title: String(plan.name),
            quantity: 1,
            currency_id: currency,
            unit_price: amount,
          },
        ],
        external_reference: external_ref,
        notification_url: `${APP_BASE_URL}/api/mp/hook`,
        auto_return: 'approved',
        back_urls: {
          // ✅ Si vos no tenés /pay/success, cambiá a /?pay=success...
          success: `${FRONTEND_RETURN_URL}/pay/success?ref=${encodeURIComponent(external_ref)}`,
          failure: `${FRONTEND_RETURN_URL}/pay/failure?ref=${encodeURIComponent(external_ref)}`,
          pending: `${FRONTEND_RETURN_URL}/pay/pending?ref=${encodeURIComponent(external_ref)}`,
        },
        metadata: { user_id: userIdStr, plan_id: planIdStr, plan_code: plan.code, is_testpay: true },
      };

      const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(preferenceBody),
      });

      const text = await mpRes.text();
      if (!mpRes.ok) {
        console.error('MP_PREF_FAILED_TESTPAY', { status: mpRes.status, detail: text?.slice?.(0, 700) });
        return reply.status(500).send({ ok: false, error: 'MP_PREF_FAILED', detail: text });
      }

      const pref = JSON.parse(text);

      await prisma.payment.update({
        where: { id: payment.id },
        data: { mp_pref_id: String(pref.id) },
      });

      return reply.send({
        ok: true,
        ref: external_ref,
        ticket,
        init_point: pref.init_point,
        sandbox_init_point: pref.sandbox_init_point,
        token_source: String(process.env.MP_ACCESS_TOKEN || '').trim() ? 'env' : 'fallback',
      });
    } catch (e: any) {
      console.error('testpay error', e?.message || e);
      return reply.status(500).send({ ok: false, error: 'TESTPAY_ERROR' });
    }
  },
} as RouteOptions;
