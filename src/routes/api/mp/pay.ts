// DTunnel/src/routes/api/mp/pay.ts
import prisma from '../../../config/prisma-client';
import Authentication from '../../../middlewares/authentication';
import { FastifyReply, FastifyRequest, RouteOptions } from 'fastify';

export default {
  url: '/api/mp/pay',
  method: 'POST',
  onRequest: [Authentication.user],
  handler: async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (req as any).user;
      if (!user?.id) return reply.status(401).send({ ok: false, error: 'UNAUTHORIZED' });

      const { plan_code } = (req.body ?? {}) as any;
      if (!plan_code) return reply.status(400).send({ ok: false, error: 'PLAN_REQUIRED' });

      const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
      const APP_BASE_URL = process.env.APP_BASE_URL;
      const FRONTEND_RETURN_URL = process.env.FRONTEND_RETURN_URL;

      if (!MP_ACCESS_TOKEN || MP_ACCESS_TOKEN.includes('<<APP_USR')) {
        return reply.status(500).send({ ok: false, error: 'MP_ACCESS_TOKEN_MISSING_OR_PLACEHOLDER' });
      }
      if (!APP_BASE_URL) return reply.status(500).send({ ok: false, error: 'APP_BASE_URL_MISSING' });
      if (!FRONTEND_RETURN_URL) return reply.status(500).send({ ok: false, error: 'FRONTEND_RETURN_URL_MISSING' });

      const plan = await prisma.plan.findUnique({ where: { code: String(plan_code) } });
      if (!plan || !plan.is_active) return reply.status(404).send({ ok: false, error: 'PLAN_INVALID' });

      const amount = Number(plan.price_ars);
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
          currency: 'ARS',
          external_ref: null,
          metadata: JSON.stringify({
            plan_code: plan.code,
            months: plan.months,
            price_ars: plan.price_ars,
          }),
        },
      });

      const external_ref = `MP-${String(payment.id)}`;

      await prisma.payment.update({
        where: { id: payment.id },
        data: { external_ref },
      });

      // ✅ IMPORTANTE: MP debe volver al HOME (tu HTML principal) porque /pay/success no existe
      const successUrl = `${FRONTEND_RETURN_URL}/?pay=success&ref=${encodeURIComponent(external_ref)}`;
      const failureUrl = `${FRONTEND_RETURN_URL}/?pay=failure&ref=${encodeURIComponent(external_ref)}`;
      const pendingUrl = `${FRONTEND_RETURN_URL}/?pay=pending&ref=${encodeURIComponent(external_ref)}`;

      // 2) Crear preferencia en MP
      const preferenceBody = {
        items: [
          {
            title: plan.name,
            quantity: 1,
            currency_id: 'ARS',
            unit_price: amount,
          },
        ],
        external_reference: external_ref,
        notification_url: `${APP_BASE_URL}/api/mp/hook`,
        auto_return: 'approved',
        back_urls: {
          success: successUrl,
          failure: failureUrl,
          pending: pendingUrl,
        },
        metadata: {
          user_id: user.id,
          plan_id: plan.id,
          plan_code: plan.code,
        },
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
        console.error('MP_PREF_FAILED', { status: mpRes.status, detail: text?.slice?.(0, 500) });
        return reply.status(500).send({ ok: false, error: 'MP_PREF_FAILED' });
      }

      const pref = JSON.parse(text);

      await prisma.payment.update({
        where: { id: payment.id },
        data: { mp_pref_id: String(pref.id) },
      });

      return reply.send({
        ok: true,
        ref: external_ref,
        pref_id: pref.id,
        init_point: pref.init_point,
        sandbox_init_point: pref.sandbox_init_point,
      });
    } catch (e: any) {
      console.error('mp pay error', e?.message || e);
      return reply.status(500).send({ ok: false, error: 'PAY_ERROR' });
    }
  },
} as RouteOptions;

