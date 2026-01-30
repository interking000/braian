import prisma from '../../../config/prisma-client';
import { FastifyReply, FastifyRequest, RouteOptions } from 'fastify';
import crypto from 'crypto';

function extendByMonths(currentEnds: Date | null, months: number) {
  const base = currentEnds && currentEnds.getTime() > Date.now() ? new Date(currentEnds) : new Date();
  const d = new Date(base);
  d.setMonth(d.getMonth() + months);
  return d;
}

function isApproved(mp: any) {
  const st = String(mp?.status ?? '');
  // approved es el que nos interesa para activar
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

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const calc = crypto.createHmac('sha256', secret).update(manifest).digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(calc, 'hex'), Buffer.from(v1, 'hex'));
  } catch {
    return false;
  }
}

function extractPaymentId(req: FastifyRequest) {
  // MP puede mandar en query o body, dependiendo del tipo de notificación
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
  method: ['POST', 'GET'] as any, // ✅ aceptar GET/POST
  handler: async (req: FastifyRequest, reply: FastifyReply) => {
    // ✅ Respondemos 200 al final (si querés “rápido”, que sea rápido pero procesando dentro)
    try {
      const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
      if (!MP_ACCESS_TOKEN) {
        reply.status(200).send('OK');
        return;
      }

      const paymentId = extractPaymentId(req);
      if (!paymentId) {
        reply.status(200).send('OK');
        return;
      }

      // Firma opcional
      if (!verifyMpSignature(req, String(paymentId))) {
        console.error('MP_HOOK_SIGNATURE_INVALID', { paymentId: String(paymentId) });
        reply.status(200).send('OK');
        return;
      }

      // Consultar pago real
      const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
      });

      const mpText = await mpRes.text();
      if (!mpRes.ok) {
        console.error('MP_GET_PAYMENT_FAILED', { status: mpRes.status, paymentId: String(paymentId) });
        reply.status(200).send('OK');
        return;
      }

      const mp = JSON.parse(mpText);
      if (!isApproved(mp)) {
        reply.status(200).send('OK');
        return;
      }

      const external_ref = String(mp.external_reference ?? '').trim();
      if (!external_ref) {
        console.error('MP_APPROVED_NO_EXTERNAL_REF', { paymentId: String(paymentId) });
        reply.status(200).send('OK');
        return;
      }

      // Buscar payment local por external_ref
      const payment = await prisma.payment.findFirst({
        where: { external_ref },
        include: { user: true, plan: true },
      });

      if (!payment) {
        console.error('MP_APPROVED_REF_NOT_FOUND', { ref: external_ref, paymentId: String(paymentId) });
        reply.status(200).send('OK');
        return;
      }

      // ✅ idempotencia por mp_payment_id también (por si MP reintenta)
      if (payment.status === 'APPROVED') {
        reply.status(200).send('OK');
        return;
      }

      // ✅ Anti-estafa suave:
      // - amount y currency deben coincidir “razonablemente” con lo esperado
      const mpAmount = numOrNull(mp.transaction_amount);
      const mpCurrency = String(mp.currency_id ?? '').trim() || null;

      const expectedAmount = payment.amount ?? (payment.plan?.price_ars ? Number(payment.plan.price_ars) : null);
      const expectedCurrency = payment.currency ?? 'ARS';

      if (expectedAmount != null && mpAmount != null) {
        // tolerancia 1 peso por redondeos/cargos raros (podés bajar a 0.01 si querés)
        const diff = Math.abs(Number(expectedAmount) - Number(mpAmount));
        if (diff > 1.0) {
          console.error('MP_AMOUNT_MISMATCH', {
            ref: external_ref,
            paymentId: String(paymentId),
            expected: expectedAmount,
            got: mpAmount,
          });
          reply.status(200).send('OK');
          return;
        }
      }

      if (mpCurrency && String(expectedCurrency) !== String(mpCurrency)) {
        console.error('MP_CURRENCY_MISMATCH', {
          ref: external_ref,
          paymentId: String(paymentId),
          expected: expectedCurrency,
          got: mpCurrency,
        });
        reply.status(200).send('OK');
        return;
      }

      if (!payment.plan) {
        console.error('MP_APPROVED_NO_PLAN', { id: payment.id, ref: external_ref });
        reply.status(200).send('OK');
        return;
      }

      // ✅ Todo en una transacción: payment APPROVED + user ACTIVE
      await prisma.$transaction(async (tx) => {
        // actualizar payment
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

      reply.status(200).send('OK');
    } catch (e: any) {
      console.error('MP_HOOK_ERROR', e?.message || e);
      // ✅ siempre 200 para que MP no te mate el endpoint, pero dejamos log
      reply.status(200).send('OK');
    }
  },
} as RouteOptions;
