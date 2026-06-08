/**
 * /api/webhook.js — Stripe webhook endpoint for LumiScalp
 *
 * Set up in Stripe Dashboard → Developers → Webhooks:
 *   Endpoint URL:  https://your-domain.com/api/webhook
 *   Events:        payment_intent.succeeded
 *
 * Add STRIPE_WEBHOOK_SECRET to your Vercel environment variables.
 *
 * ─── IMPORTANT: CJ PRODUCT IDs ────────────────────────────────────────────
 * CJ_HAT_VID     = The variant ID for your red light therapy hair cap.
 * CJ_MYSTERY_VID = The variant ID for your mystery serum gift (if applicable).
 * CJ_SUPP_VID    = The variant ID for the LumiScalp Hair Supplement add-on.
 *
 * To find your variant IDs:
 *   1. Log into CJ Dropshipping → My Products
 *   2. Click the product → copy the VID from the URL or product details page
 *   3. Paste them into the constants below before going live.
 * ──────────────────────────────────────────────────────────────────────────
 */

import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ─── CJ Product Variant IDs — UPDATE THESE BEFORE GOING LIVE ─────────────
const CJ_HAT_VID     = 'YOUR_HAT_VARIANT_ID_HERE';      // Red Light Therapy Hair Cap
const CJ_MYSTERY_VID = 'YOUR_MYSTERY_SERUM_VID_HERE';   // Mystery Scalp Serum Gift (myst addon)
const CJ_SUPP_VID    = 'YOUR_SUPPLEMENT_VID_HERE';      // Hair Supplement (supp addon)

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

  items.forEach(item => {
    const qty = Number(item.bundle) || 1; // bundle = number of caps ordered

    // Always add the red light cap
    if (CJ_HAT_VID && CJ_HAT_VID !== 'YOUR_HAT_VARIANT_ID_HERE') {
      products.push({ vid: CJ_HAT_VID, quantity: qty, price: 0 });
    }

    // Mystery Scalp Serum gift (myst addon)
    if (item.addons?.myst && CJ_MYSTERY_VID && CJ_MYSTERY_VID !== 'YOUR_MYSTERY_SERUM_VID_HERE') {
      products.push({ vid: CJ_MYSTERY_VID, quantity: 1, price: 0 });
    }

    // Hair Supplement addon (supp)
    if (item.addons?.supp && CJ_SUPP_VID && CJ_SUPP_VID !== 'YOUR_SUPPLEMENT_VID_HERE') {
      products.push({ vid: CJ_SUPP_VID, quantity: 1, price: 0 });
    }
  });

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

