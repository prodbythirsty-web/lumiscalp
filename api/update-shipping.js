import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { clientSecret, shipping } = req.body;

    if (!clientSecret || !shipping) {
      return res.status(400).json({ error: 'Missing clientSecret or shipping' });
    }

    // Extract PaymentIntent ID from clientSecret (format: pi_xxx_secret_xxx)
    const paymentIntentId = clientSecret.split('_secret_')[0];

    await stripe.paymentIntents.update(paymentIntentId, {
      shipping: {
        name:    shipping.name    || '',
        phone:   shipping.phone   || '',
        address: {
          line1:       shipping.address.line1       || '',
          line2:       shipping.address.line2       || '',
          city:        shipping.address.city        || '',
          state:       shipping.address.state       || '',
          postal_code: shipping.address.postal_code || '',
          country:     shipping.address.country     || 'US',
        },
      },
    });

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('Update shipping error:', err);
    return res.status(500).json({ error: err.message });
  }
}
