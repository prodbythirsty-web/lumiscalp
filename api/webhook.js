/**
 * /api/webhook.js — Stripe webhook endpoint for LumiScalp
 *
 * Set up in Stripe Dashboard → Developers → Webhooks:
 *   Endpoint URL:  https://your-domain.com/api/webhook
 *   Events:        payment_intent.succeeded
 *
 * Add STRIPE_WEBHOOK_SECRET to your Vercel environment variables.
 *
 * ─── BUNDLING RULE ────────────────────────────────────────────────────────
 * Every order always ships with BOTH the red light therapy cap AND the serum.
 * The serum quantity always matches the cap quantity (1 serum per cap).
 * ──────────────────────────────────────────────────────────────────────────
 */

import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ─── CJ Product Variant IDs ───────────────────────────────────────────────
const CJ_HAT_VID   = '1739574005910216704';    // Red Light Therapy Hair Cap
const CJ_SERUM_VID = '2509151231521622100';    // Hair Serum — always bundled with cap

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

  // Fall back to qty=1 if items array is empty (e.g. Express Checkout orders)
  const totalCaps = items.reduce((sum, item) => sum + (Number(item.bundle) || 1), 0) || 1;

  // Cap — always fulfil
  products.push({ vid: CJ_HAT_VID, quantity: totalCaps, price: 0 });

  // Serum — always bundled (1 serum per cap, no exceptions)
  products.push({ vid: CJ_SERUM_VID, quantity: totalCaps, price: 0 });

  /* Legacy addon loop kept for any future add-ons — cap & serum handled above
  items.forEach(item => {
    const qty = Number(item.bundle) || 1; // bundle = number of caps ordered

    // Always add the red light cap
    if (CJ_HAT_VID && CJ_HAT_VID !== 'YOUR_HAT_VARIANT_ID_HERE') {
      products.push({ vid: CJ_HAT_VID, quantity: qty, price: 0 });
    }

    // Mystery Scalp Serum — now always bundled above, kept here for reference
    // if (item.addons?.myst) products.push({ vid: CJ_SERUM_VID, quantity: 1, price: 0 });

  }) */

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
      logisticName:         'USPS',
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

