/**
 * /api/webhook.js — Stripe webhook endpoint for LumiScalp
 *
 * Set up in Stripe Dashboard → Developers → Webhooks:
 *   Endpoint URL:  https://your-domain.com/api/webhook
 *   Events:        payment_intent.succeeded
 *
 * Add STRIPE_WEBHOOK_SECRET to your Vercel environment variables.
 *
 * ─── FULFILLMENT RULES ────────────────────────────────────────────────────
 * - Cap VID is chosen by LED count: 56-bead or 100-bead variant.
 * - Hair spray is fulfilled only when item.bundle === 2 AND item.spray !== false
 *   (customers can remove the spray from their cart before checkout).
 * - Scalp massager is fulfilled per item unless item.massager === false.
 * ──────────────────────────────────────────────────────────────────────────
 */

import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ─── CJ Product Variant IDs ───────────────────────────────────────────────
const CJ_HAT_VID = {
  56:  '2604200751271604900',   // 56-bead Red Light Therapy Hair Cap
  100: '1739574005910216704',   // 100-bead Red Light Therapy Hair Cap
};
const CJ_SPRAY_VID    = 'DEA29FD5-85DF-4AD0-88D6-840339C2642B';  // Hair Spray 30ml
const CJ_MASSAGER_VID = '85F80CA0-B51F-42DC-9DEB-A8641100FACF';  // Silicone Scalp Massager

// ─── CJ Auth ──────────────────────────────────────────────────────────────

async function getCJAccessToken() {
  const res = await fetch('https://developers.cjdropshipping.com/api2.0/v1/authentication/getAccessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey: process.env.CJ_API_KEY }),
  });
  const data = await res.json();
  if (!data.data?.accessToken) throw new Error('CJ auth failed: ' + JSON.stringify(data));
  return data.data.accessToken;
}

// ─── Build CJ Order ───────────────────────────────────────────────────────

async function placeCJOrder({ accessToken, paymentIntent }) {
  const meta     = paymentIntent.metadata || {};
  const items    = JSON.parse(meta.items || '[]');
  const shipping = paymentIntent.shipping || {};
  const addr     = shipping.address || {};

  const products = [];

  if (items.length) {
    // ── Per-item fulfillment: correct hat VID by LED count, spray only if bundle 2 & not removed ──
    const hatTotals  = {};  // vid → quantity
    let   sprayTotal = 0;
    let   massagerTotal = 0;

    items.forEach(item => {
      const led    = item.led === 100 ? 100 : 56;
      const hatVid = CJ_HAT_VID[led];
      const capQty      = item.capQty      ?? 1;
      const sprayQty    = item.sprayQty    ?? (item.bundle === 2 && item.spray !== false ? 1 : 0);
      const massagerQty = item.massagerQty ?? (item.massager !== false ? 1 : 0);

      hatTotals[hatVid] = (hatTotals[hatVid] || 0) + capQty;
      sprayTotal    += sprayQty;
      massagerTotal += massagerQty;
    });

    Object.entries(hatTotals).forEach(([vid, quantity]) => {
      products.push({ vid, quantity, price: 0 });
    });

    if (sprayTotal > 0) {
      products.push({ vid: CJ_SPRAY_VID, quantity: sprayTotal, price: 0 });
    }

    if (massagerTotal > 0) {
      products.push({ vid: CJ_MASSAGER_VID, quantity: massagerTotal, price: 0 });
    }

  } else {
    // Fallback for Express Checkout / orders with no items metadata — default 56-bead, no spray
    console.warn('No items metadata for PaymentIntent:', paymentIntent.id, '— fulfilling 1x 56-bead cap');
    products.push({ vid: CJ_HAT_VID[56], quantity: 1, price: 0 });
  }

  if (!products.length) {
    console.warn('No CJ products to fulfil for PaymentIntent:', paymentIntent.id);
    return null;
  }

  const res = await fetch('https://developers.cjdropshipping.com/api2.0/v1/shopping/order/createOrderV2', {
    method: 'POST',
    headers: {
      'Content-Type':    'application/json',
      'CJ-Access-Token': accessToken,
      'platformToken':   '',
    },
    body: JSON.stringify({
      orderNumber:          `LS-${paymentIntent.id}`,
      shippingZip:          addr.postal_code || '',
      shippingCountryCode:  addr.country     || 'US',
      shippingPhone:        shipping.phone   || '',
      shippingCustomerName: shipping.name    || '',
      shippingAddress:      addr.line1       || '',
      shippingAddress2:     addr.line2       || '',
      shippingCity:         addr.city        || '',
      shippingProvince:     addr.state       || '',
      logisticName:         'USPS',  // always USPS
      remark:               'LumiScalp order — ' + paymentIntent.id,
      products,
    }),
  });

  const data = await res.json();
  console.log('CJ order response:', JSON.stringify(data));

  if (!data.result) {
    throw new Error('CJ order failed: ' + JSON.stringify(data));
  }

  return data.data?.orderId || null;
}

// ─── Webhook Handler ──────────────────────────────────────────────────────

// Read raw body as buffer — required for Stripe signature verification on Vercel
async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end',  () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object;
    console.log(`[LumiScalp] Payment succeeded: ${pi.id} — placing CJ order...`);

    try {
      const token   = await getCJAccessToken();
      const cjOrder = await placeCJOrder({ accessToken: token, paymentIntent: pi });
      console.log(`[LumiScalp] CJ order placed: ${cjOrder}`);
    } catch (err) {
      // Log the error
      console.error(`[LumiScalp] CJ fulfillment error for ${pi.id}:`, err.message);

      // ── Alert email — requires RESEND_API_KEY and ALERT_EMAIL in Vercel env vars ──
      try {
        const shipping = pi.shipping || {};
        const amount   = ((pi.amount || 0) / 100).toFixed(2);
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type':  'application/json',
          },
          body: JSON.stringify({
            from:    'onboarding@resend.dev',
            to:      process.env.ALERT_EMAIL,
            subject: `⚠️ LumiScalp fulfillment FAILED — ${pi.id}`,
            text: [
              `A CJ fulfillment error occurred and requires manual action.`,
              ``,
              `Payment Intent: ${pi.id}`,
              `Amount:         $${amount}`,
              `Customer:       ${shipping.name || 'unknown'}`,
              `Error:          ${err.message}`,
              ``,
              `Check Vercel logs for full details and fulfil this order manually in the CJ dashboard.`,
            ].join('
'),
          }),
        });
      } catch (emailErr) {
        console.error('[LumiScalp] Failed to send alert email:', emailErr.message);
      }
    }
  }

  return res.status(200).json({ received: true });
}

