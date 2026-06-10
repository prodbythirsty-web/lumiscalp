import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ─── Price table (server-side, tamper-proof) ──────────────────────────────
// Must match client-side LED_PRICES and GUARANTEE_PRICE in script.js exactly.

const LED_PRICES = {
  56:  69.00,
  100: 79.00,
};

const GUARANTEE_PRICE = 9.99;

function calcTotal(items, fallbackCents) {
  if (items && items.length) {
    let total = 0;
    items.forEach(item => {
      const ledPrice = LED_PRICES[item.led] ?? LED_PRICES[56];
      const qty      = item.bundle === 2 ? 2 : 1;
      total += ledPrice * qty;
      if (item.guarantee) total += GUARANTEE_PRICE;
    });
    return Math.round(total * 100);
  }
  return Math.round(fallbackCents || 0);
}

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

    const piParams = {
      amount: amountInCents,
      currency,
      automatic_payment_methods: { enabled: true },
      metadata: {
        source: 'lumiscalp',
        items:  JSON.stringify(items || []),
      },
    };

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
