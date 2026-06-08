import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ─── Price table (server-side, tamper-proof) ──────────────────────────────
// These MUST match the client-side BUNDLES and ADDON_LIST in script.js exactly.

const BUNDLE_PRICES = {
  1: 69.99,  // 1 LumiScalp cap
  2: 124.99, // 2 LumiScalp caps (bundle deal)
};

const ADDON_PRICES = {
  serum: 0,  // LumiScalp Hair Serum (included)
};

function calcTotal(items, fallbackCents) {
  if (items && items.length) {
    let total = 0;
    items.forEach(item => {
      // Default to 1-cap price if bundle key is unrecognised
      let t = BUNDLE_PRICES[item.bundle] ?? BUNDLE_PRICES[1];
      if (item.addons) {
        Object.keys(item.addons).forEach(k => {
          if (item.addons[k] && ADDON_PRICES[k]) t += ADDON_PRICES[k];
        });
      }
      total += t;
    });
    return Math.round(total * 100); // convert to cents
  }
  return Math.round(fallbackCents || 0);
}

// ─── Handler ──────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { amount, currency = 'usd', items, shipping } = req.body;

    const amountInCents = calcTotal(items, amount);

    if (!amountInCents || amountInCents < 50) {
      return res.status(400).json({ success: false, message: 'Invalid order amount.' });
    }

    // Build PaymentIntent params
    const piParams = {
      amount: amountInCents,
      currency,
      automatic_payment_methods: { enabled: true },
      metadata: {
        source: 'lumiscalp',
        items:  JSON.stringify(items || []),
      },
    };

    // Attach shipping to PaymentIntent if provided so webhook can read it
    if (shipping && shipping.name && shipping.address) {
      piParams.shipping = {
        name:  shipping.name,
        phone: shipping.phone || '',
        address: {
          line1:       shipping.address.line1       || '',
          line2:       shipping.address.line2       || '',
          city:        shipping.address.city        || '',
          state:       shipping.address.state       || '',
          postal_code: shipping.address.postal_code || '',
          country:     shipping.address.country     || 'US',
        },
      };
    }

    const paymentIntent = await stripe.paymentIntents.create(piParams);

    return res.status(200).json({ clientSecret: paymentIntent.client_secret });

  } catch (err) {
    console.error('LumiScalp order handler error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Something went wrong.',
    });
  }
}
