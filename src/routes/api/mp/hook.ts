import prisma from '../../../config/prisma-client';
import { FastifyReply, FastifyRequest, RouteOptions } from 'fastify';
import crypto from 'crypto';

// ✅ Ejemplo (como pediste)
const MP_ACCESS_TOKEN_EXAMPLE =
  'APP_USR-292459445257292-010909-ad9da859bf8eb657422b278edbbef85f-517943228';

function getMpToken() {
  // ✅ Primero .env (recomendado). Si no existe, cae al ejemplo.
  return String(process.env.MP_ACCESS_TOKEN || MP_ACCESS_TOKEN_EXAMPLE).trim();
}

function extendByMonths(currentEnds: Date | null, months: number) {
  const base =
    currentEnds && currentEnds.getTime() > Date.now()
      ? new Date(currentEnds)
      : new Date();
  const d = new Date(base);
  d.setMonth(d.getMonth() + months);
  return d;
}

function isApproved(mp: any) {
  const st = String(mp?.status ?? '').toLowerCase();
  return st === 'approved';
}

// (Opcional) validar firma de webhook si configurás MP_WEBHOOK_SECRET
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

  // ✅ FIX: tiene que ser template string con backticks
  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const calc = crypto.createHmac('sha256', secret).update(manifest).digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(calc, 'hex'), Buffer.from(v1, 'hex'));
  } catch {
    return false;
  }
}

function extractPaymentId(req: FastifyRequest) {
  const q: any = req.query ?? {};
  const b: any = req.body ?? {};

  return (
    q['data.id'] ||
    q['id'] ||
    b?.data?.id ||
    b?.id ||
    b?.resource?.id ||
    null
  );
}

function numOrNull(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export default {
  url: '/api/mp/hook',
  method: ['POST', 'GET'] as any,
  handler: async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const MP_ACCESS_TOKEN = getMpToken();
      if (!MP_ACCESS_TOKEN) {
        return reply.status(200).send('OK');
      }

      const paymentId = extractPaymentId(req);
      if (!paymentId) {
        return reply.status(200).send('OK');
      }

      // Firma opcional
      if (!verifyMpSignature(req, String(paymentId))) {
        console.error('MP_HOOK_SIGNATURE_INVALID', { paymentId: String(paymentId) });
        return reply.status(200).send('OK');
      }

      // Consultar pago real
      const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
      });

      const mpText = await mpRes.text();
      if (!mpRes.ok) {
        console.error('MP_GET_PAYMENT_FAILED', {
          status: mpRes.status,
          paymentId: String(paymentId),
          body: mpText.slice(0, 400),
        });
        return reply.status(200).send('OK');
      }

      const mp = JSON.parse(mpText);

      if (!isApproved(mp)) {
        return reply.status(200).send('OK');
      }

      const external_ref = String(mp.external_reference ?? '').trim();
      if (!external_ref) {
        console.error('MP_APPROVED_NO_EXTERNAL_REF', { paymentId: String(paymentId) });
        return reply.status(200).send('OK');
      }

      // Buscar payment local por external_ref
      const payment = await prisma.payment.findFirst({
        where: { external_ref },
        include: { user: true, plan: true },
      });

      if (!payment) {
        console.error('MP_APPROVED_REF_NOT_FOUND', { ref: external_ref, paymentId: String(paymentId) });
        return reply.status(200).send('OK');
      }

      // ✅ idempotencia
      if (payment.status === 'APPROVED') {
        return reply.status(200).send('OK');
      }

      // ✅ Anti-estafa suave (opcional)
      const mpAmount = numOrNull(mp.transaction_amount);
      const mpCurrency = String(mp.currency_id ?? '').trim() || null;

      const expectedAmount =
        payment.amount ?? (payment.plan?.price_ars ? Number(payment.plan.price_ars) : null);

      const expectedCurrency = payment.currency ?? 'ARS';

      if (expectedAmount != null && mpAmount != null) {
        const diff = Math.abs(Number(expectedAmount) - Number(mpAmount));
        if (diff > 1.0) {
          console.error('MP_AMOUNT_MISMATCH', {
            ref: external_ref,
            paymentId: String(paymentId),
            expected: expectedAmount,
            got: mpAmount,
          });
          return reply.status(200).send('OK');
        }
      }

      if (mpCurrency && String(expectedCurrency) !== String(mpCurrency)) {
        console.error('MP_CURRENCY_MISMATCH', {
          ref: external_ref,
          paymentId: String(paymentId),
          expected: expectedCurrency,
          got: mpCurrency,
        });
        return reply.status(200).send('OK');
      }

      if (!payment.plan) {
        console.error('MP_APPROVED_NO_PLAN', { id: payment.id, ref: external_ref });
        return reply.status(200).send('OK');
      }

      // ✅ Transacción: aprobar payment + activar user + log evento
      await prisma.$transaction(async (tx) => {
        const updatedPayment = await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: 'APPROVED',
            mp_payment_id: String(paymentId),
            amount: payment.amount ?? (mpAmount != null ? mpAmount : null),
            currency: payment.currency ?? (mpCurrency ? mpCurrency : null),
          },
          include: { user: true, plan: true },
        });

        const newEnds = extendByMonths(updatedPayment.user.access_ends_at, updatedPayment.plan!.months);

        await tx.user.update({
          where: { id: updatedPayment.user_id },
          data: {
            access_status: 'ACTIVE',
            access_ends_at: newEnds,
            last_payment_at: new Date(),
            grace_delete_at: null,
          },
        });

        await tx.accessEvent.create({
          data: {
            user_id: updatedPayment.user_id,
            payment_id: updatedPayment.id,
            type: 'PAYMENT_APPROVED',
            message: `MP approved #${String(paymentId)} (+${updatedPayment.plan!.months} months)`,
          },
        });
      });

      console.log('MP_APPROVED_OK', { paymentId: String(paymentId), ref: external_ref });
      return reply.status(200).send('OK');
    } catch (e: any) {
      console.error('MP_HOOK_ERROR', e?.message || e);
      return reply.status(200).send('OK');
    }
  },
} as RouteOptions;
