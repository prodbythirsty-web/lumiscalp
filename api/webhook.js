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
 * - Serum is fulfilled only when item.bundle === 2 AND item.serum !== false
 *   (customers can remove the serum from their cart before checkout).
 * ──────────────────────────────────────────────────────────────────────────
 */

import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ─── CJ Product Variant IDs ───────────────────────────────────────────────
const CJ_HAT_VID = {
  56:  '2604200751271604900',   // 56-bead Red Light Therapy Hair Cap
  100: '1739574005910216704',   // 100-bead Red Light Therapy Hair Cap
};
const CJ_SERUM_VID    = '2509151231521622100';   // Copper Hair Growth Serum
const CJ_MASSAGER_VID = 'REPLACE_WITH_MASSAGER_VID'; // TODO: add CJ VID for scalp massager

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
    // ── Per-item fulfillment: correct hat VID by LED count, serum only if bundle 2 & not removed ──
    const hatTotals  = {};  // vid → quantity
    let   serumTotal = 0;
    let   massagerTotal = 0;

    items.forEach(item => {
      const led    = item.led === 100 ? 100 : 56;
      const hatVid = CJ_HAT_VID[led];
      hatTotals[hatVid] = (hatTotals[hatVid] || 0) + 1;

      // Serum: only when bundle 2 AND customer hasn't removed it (serum !== false)
      if (item.bundle === 2 && item.serum !== false) {
        serumTotal += 1;
      }

      // Scalp massager: included by default unless customer removed it (massager === false)
      if (item.massager !== false) {
        massagerTotal += 1;
      }
    });

    Object.entries(hatTotals).forEach(([vid, quantity]) => {
      products.push({ vid, quantity, price: 0 });
    });

    if (serumTotal > 0) {
      products.push({ vid: CJ_SERUM_VID, quantity: serumTotal, price: 0 });
    }

    if (massagerTotal > 0 && CJ_MASSAGER_VID !== 'REPLACE_WITH_MASSAGER_VID') {
      products.push({ vid: CJ_MASSAGER_VID, quantity: massagerTotal, price: 0 });
    }

  } else {
    // Fallback for Express Checkout / orders with no items metadata — default 56-bead, no serum
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
      // Log but return 200 so Stripe doesn't retry — alert yourself separately (email/Slack)
      console.error(`[LumiScalp] CJ fulfillment error for ${pi.id}:`, err.message);
    }
  }

  return res.status(200).json({ received: true });
}

