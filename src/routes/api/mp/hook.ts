// DTunnel/src/routes/api/mp/hook.ts
// Webhook MercadoPago (BLINDADO)
// ✅ No responde OK antes de procesar (si falla, MP reintenta)
// ✅ Acepta POST y GET (algunas notificaciones llegan con query)
// ✅ Verifica firma (opcional) con MP_WEBHOOK_SECRET
// ✅ Valida APPROVED + external_reference + monto/moneda + (opcional) collector/preference
// ✅ Idempotente y atómico (transaction)
// ✅ Deja logs cortos y útiles

import prisma from '../../../config/prisma-client';
import { FastifyReply, FastifyRequest, RouteOptions } from 'fastify';
import crypto from 'crypto';

function extendByMonths(currentEnds: Date | null, months: number) {
  const base = currentEnds && currentEnds.getTime() > Date.now() ? new Date(currentEnds) : new Date();
  const d = new Date(base);
  d.setMonth(d.getMonth() + months);
  return d;
}

/** Extrae ID de pago MP desde query/body (variantes reales) */
function extractPaymentId(req: FastifyRequest) {
  const q: any = req.query ?? {};
  const b: any = req.body ?? {};
  return q['data.id'] || q['id'] || b?.data?.id || b?.id || null;
}

/** (Opcional) validar firma de webhook si configurás MP_WEBHOOK_SECRET */
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

/** Comparación estricta de montos con tolerancia opcional mínima */
function amountMatches(dbAmount: number | null, mpAmount: any) {
  if (dbAmount == null) return true; // si no guardaste amount en DB, no bloquees
  const v = Number(mpAmount);
  if (!Number.isFinite(v)) return false;
  // ARS suele venir exacto; si querés tolerancia por decimales, podés usar <= 0.01
  return v === Number(dbAmount);
}

export default {
  url: '/api/mp/hook',
  method: ['POST', 'GET'],
  handler: async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
      if (
        !MP_ACCESS_TOKEN ||
        MP_ACCESS_TOKEN.includes('<<APP_USR-292459445257292-010909-ad9da859bf8eb657422b278edbbef85f-517943228>>')
      ) {
        // si falta token, devolvé 500 para reintento
        return reply.status(500).send('MP_ACCESS_TOKEN_MISSING');
      }

      const paymentId = extractPaymentId(req);
      if (!paymentId) {
        // nada que procesar
        return reply.status(200).send('OK_NO_ID');
      }

      // Firma opcional
      if (!verifyMpSignature(req, String(paymentId))) {
        console.error('❌ MP webhook firma inválida', { paymentId: String(paymentId) });
        // mejor 401 para que MP reintente si secret está activo
        return reply.status(401).send('INVALID_SIGNATURE');
      }

      // Consultar pago REAL en MP
      const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
      });

      const mpText = await mpRes.text();
      if (!mpRes.ok) {
        console.error('❌ MP get payment failed', mpRes.status, mpText.slice(0, 500));
        return reply.status(502).send('MP_FETCH_FAILED');
      }

      const mp = JSON.parse(mpText);
      const status = String(mp.status ?? '');
      const external_ref = String(mp.external_reference ?? '');
      const mpCurrency = String(mp.currency_id ?? '');

      // Solo aprobados activan
      if (status !== 'approved') return reply.status(200).send('OK_NOT_APPROVED');
      if (!external_ref) return reply.status(200).send('OK_NO_REF');

      // Buscar payment en DB
      const payment = await prisma.payment.findFirst({
        where: { external_ref },
        include: { user: true, plan: true },
      });

      if (!payment) {
        // si no existe, no hay forma de resolver automáticamente
        console.error('❌ Payment DB no encontrado para ref', { external_ref, paymentId: String(paymentId) });
        return reply.status(200).send('OK_PAYMENT_NOT_FOUND');
      }

      // Idempotencia: si ya aprobado, responder OK
      if (payment.status === 'APPROVED') return reply.status(200).send('OK_ALREADY');

      // Validaciones anti-estafa (duras)
      // 1) external_reference debe coincidir con tu DB
      if (payment.external_ref && payment.external_ref !== external_ref) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: 'FRAUD_SUSPECT' as any },
        });
        console.error('❌ REF mismatch', { paymentId: payment.id, external_ref, db: payment.external_ref });
        return reply.status(409).send('REF_MISMATCH');
      }

      // 2) Monto debe coincidir (si lo tenés en DB)
      if (!amountMatches(payment.amount ?? null, mp.transaction_amount)) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: 'FRAUD_SUSPECT' as any },
        });
        console.error('❌ AMOUNT mismatch', {
          paymentId: payment.id,
          dbAmount: payment.amount,
          mpAmount: mp.transaction_amount,
        });
        return reply.status(409).send('AMOUNT_MISMATCH');
      }

      // 3) Moneda debe coincidir (si la tenés guardada)
      if (payment.currency && mpCurrency && payment.currency !== mpCurrency) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: 'FRAUD_SUSPECT' as any },
        });
        console.error('❌ CURRENCY mismatch', {
          paymentId: payment.id,
          dbCur: payment.currency,
          mpCur: mpCurrency,
        });
        return reply.status(409).send('CURRENCY_MISMATCH');
      }

      // 4) (Opcional) validar que el pago fue a TU cuenta (si seteás MP_COLLECTOR_ID)
      //   - esto mata pagos "aprobados" pero cobrados a otra cuenta
      const expectedCollectorId = process.env.MP_COLLECTOR_ID; // ejemplo: "123456789"
      const mpCollectorId = mp.collector_id != null ? String(mp.collector_id) : '';
      if (expectedCollectorId && mpCollectorId && expectedCollectorId !== mpCollectorId) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: 'FRAUD_SUSPECT' as any },
        });
        console.error('❌ COLLECTOR mismatch', { expectedCollectorId, mpCollectorId, ref: external_ref });
        return reply.status(409).send('COLLECTOR_MISMATCH');
      }

      // 5) (Opcional) validar preferencia (si MP devuelve preference_id)
      //    En algunos casos viene en mp.order?.id o mp.preference_id según objeto.
      const mpPreferenceId =
        String(mp.preference_id ?? '') ||
        String(mp?.order?.id ?? '') ||
        '';

      if (payment.mp_pref_id && mpPreferenceId && payment.mp_pref_id !== mpPreferenceId) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: 'FRAUD_SUSPECT' as any },
        });
        console.error('❌ PREF mismatch', {
          ref: external_ref,
          dbPref: payment.mp_pref_id,
          mpPref: mpPreferenceId,
        });
        return reply.status(409).send('PREF_MISMATCH');
      }

      // Requiere plan asociado
      const months = payment.plan?.months ?? 0;
      if (months <= 0) {
        console.error('⚠️ approved sin plan asociado o months=0', { id: payment.id, ref: external_ref });
        // no activar, pero no rompas retries
        return reply.status(200).send('OK_NO_PLAN');
      }

      // Todo OK: actualizar payment + activar user en transacción
      await prisma.$transaction(async (tx) => {
        // Payment -> APPROVED
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: 'APPROVED',
            mp_payment_id: String(paymentId),
            amount: payment.amount ?? (mp.transaction_amount != null ? Number(mp.transaction_amount) : null),
            currency: payment.currency ?? (mp.currency_id ? String(mp.currency_id) : null),
          },
        });

        // User -> ACTIVE
        const freshUser = await tx.user.findUnique({
          where: { id: payment.user_id },
          select: { access_ends_at: true },
        });

        const newEnds = extendByMonths(freshUser?.access_ends_at ?? null, months);

        await tx.user.update({
          where: { id: payment.user_id },
          data: {
            access_status: 'ACTIVE',
            access_ends_at: newEnds,
            last_payment_at: new Date(),
            grace_delete_at: null,
            trial_ends_at: null,
          },
        });

        // Auditoría
        await tx.accessEvent.create({
          data: {
            user_id: payment.user_id,
            payment_id: payment.id,
            type: 'PAYMENT_APPROVED',
            message: `MP approved #${String(paymentId)} (+${months} months)`,
          },
        });
      });

      console.log('✅ MP APPROVED -> ACTIVE', { paymentId: String(paymentId), ref: external_ref });
      return reply.status(200).send('OK');
    } catch (e: any) {
      console.error('mp hook error', e?.message || e);
      // 500 => MP reintenta
      return reply.status(500).send('HOOK_ERROR');
    }
  },
} as RouteOptions;
