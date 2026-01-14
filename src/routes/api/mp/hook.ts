import prisma from '../../../config/prisma-client';
import { FastifyReply, FastifyRequest, RouteOptions } from 'fastify';
import crypto from 'crypto';

function extendByMonths(currentEnds: Date | null, months: number) {
  const base = currentEnds && currentEnds.getTime() > Date.now() ? new Date(currentEnds) : new Date();
  const d = new Date(base);
  d.setMonth(d.getMonth() + months);
  return d;
}

function verifyMpSignature(req: FastifyRequest, dataId: string) {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) return true;

  const xSignature = String(req.headers['x-signature'] ?? '');
  const xRequestId = String(req.headers['x-request-id'] ?? '');
  if (!xSignature || !xRequestId || !dataId) return false;

  let ts = '';
  let v1 = '';
  for (const part of xSignature.split(',')) {
    const [k, val] = part.split('=');
    if (!k || !val) continue;
    if (k.trim() === 'ts') ts = val.trim();
    if (k.trim() === 'v1') v1 = val.trim();
  }
  if (!ts || !v1) return false;

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const calc = crypto.createHmac('sha256', secret).update(manifest).digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(calc, 'hex'), Buffer.from(v1, 'hex'));
  } catch {
    return false;
  }
}

function getPaymentId(req: FastifyRequest): string {
  const q: any = req.query || {};
  const b: any = req.body || {};
  return String(
    q['data.id'] ??
      q['id'] ??
      b?.data?.id ??
      b?.id ??
      ''
  ).trim();
}

export default {
  url: '/api/mp/hook',
  method: 'POST',
  handler: async (req: FastifyRequest, reply: FastifyReply) => {
    reply.status(200).send('OK');

    try {
      const MP_ACCESS_TOKEN =
        process.env.MP_ACCESS_TOKEN ||
        'APP_USR-292459445257292-010909-ad9da859bf8eb657422b278edbbef85f-517943228';

      if (!MP_ACCESS_TOKEN) return;

      const paymentId = getPaymentId(req);
      if (!paymentId) return;

      // MP Payment ID siempre es numérico. Si no lo es, es ping/ruido y no consultamos a MP.
      if (!/^[0-9]+$/.test(paymentId)) return;

      if (!verifyMpSignature(req, paymentId)) {
        console.error('❌ MP webhook firma inválida', { paymentId });
        return;
      }

      const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
      });

      if (!mpRes.ok) {
        const mpText = await mpRes.text().catch(() => '');
        console.error('❌ MP get payment failed', mpRes.status, mpText);
        return;
      }

      const mp: any = await mpRes.json().catch(() => null);
      if (!mp) return;

      const status = String(mp.status ?? '');
      const external_ref = String(mp.external_reference ?? '');

      if (status !== 'approved') return;
      if (!external_ref) return;

      const payment = await prisma.payment.findFirst({
        where: { external_ref },
        include: { user: true, plan: true },
      });

      if (!payment) return;
      if (payment.status === 'APPROVED') return;

      const updated = await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'APPROVED',
          mp_payment_id: String(paymentId),
          amount: payment.amount ?? (mp.transaction_amount ? Number(mp.transaction_amount) : null),
          currency: payment.currency ?? (mp.currency_id ? String(mp.currency_id) : null),
        },
        include: { user: true, plan: true },
      });

      if (!updated.plan) {
        console.warn('⚠️ approved sin plan asociado', { id: updated.id });
        return;
      }

      const newEnds = extendByMonths(updated.user.access_ends_at, updated.plan.months);

      await prisma.user.update({
        where: { id: updated.user_id },
        data: {
          access_status: 'ACTIVE',
          access_ends_at: newEnds,
          last_payment_at: new Date(),
          grace_delete_at: null,
        },
      });

      await prisma.accessEvent.create({
        data: {
          user_id: updated.user_id,
          payment_id: updated.id,
          type: 'PAYMENT_APPROVED',
          message: `MP approved #${String(paymentId)} (+${updated.plan.months} months)`,
        },
      });

      console.log('✅ MP APPROVED', { paymentId: String(paymentId), ref: external_ref });
    } catch (e) {
      console.error('mp hook error', e);
    }
  },
} as RouteOptions;
