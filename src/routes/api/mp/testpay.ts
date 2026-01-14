import prisma from '../../../config/prisma-client';
import { FastifyReply, FastifyRequest, RouteOptions } from 'fastify';

export default {
  url: '/api/mp/testpay',
  method: 'POST',
  handler: async (req: FastifyRequest, reply: FastifyReply) => {
    const { plan_code, user_id } = (req.body ?? {}) as any;

    // 🔁 CAMBIAR_A_ORIGINAL: usá tu user_id real si querés
    const USER_ID = String(user_id || '517943228');

    if (!plan_code) return reply.status(400).send({ ok: false, error: 'PLAN_REQUIRED' });

    const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
    const APP_BASE_URL = process.env.APP_BASE_URL;
    const FRONTEND_RETURN_URL = process.env.FRONTEND_RETURN_URL;

    if (!MP_ACCESS_TOKEN) return reply.status(500).send({ ok: false, error: 'MP_ACCESS_TOKEN_MISSING' });
    if (!APP_BASE_URL) return reply.status(500).send({ ok: false, error: 'APP_BASE_URL_MISSING' });
    if (!FRONTEND_RETURN_URL) return reply.status(500).send({ ok: false, error: 'FRONTEND_RETURN_URL_MISSING' });

    const plan = await prisma.plan.findUnique({ where: { code: String(plan_code) } });
    if (!plan || !plan.is_active) return reply.status(404).send({ ok: false, error: 'PLAN_INVALID' });

    const payment = await prisma.payment.create({
      data: {
        user_id: USER_ID,
        plan_id: plan.id,
        provider: 'MERCADOPAGO',
        status: 'PENDING',
        amount: plan.price_ars,
        currency: 'ARS',
        external_ref: null,
        metadata: JSON.stringify({ plan_code: plan.code, months: plan.months }),
      },
    });

    const external_ref = `MP-${payment.id}`;
    await prisma.payment.update({ where: { id: payment.id }, data: { external_ref } });

    const preferenceBody = {
      items: [{
        title: plan.name,
        quantity: 1,
        currency_id: 'ARS',
        unit_price: plan.price_ars,
      }],
      external_reference: external_ref,
      notification_url: `${APP_BASE_URL}/api/mp/hook`,
      auto_return: 'approved',
      back_urls: {
        success: `${FRONTEND_RETURN_URL}/pay/success?ref=${encodeURIComponent(external_ref)}`,
        failure: `${FRONTEND_RETURN_URL}/pay/failure?ref=${encodeURIComponent(external_ref)}`,
        pending: `${FRONTEND_RETURN_URL}/pay/pending?ref=${encodeURIComponent(external_ref)}`,
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
    if (!mpRes.ok) return reply.status(500).send({ ok: false, error: 'MP_PREF_FAILED', detail: text });

    const pref = JSON.parse(text);

    await prisma.payment.update({ where: { id: payment.id }, data: { mp_pref_id: pref.id } });

    return reply.send({ ok: true, ref: external_ref, init_point: pref.init_point });
  },
} as RouteOptions;
