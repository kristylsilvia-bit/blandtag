import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getAdminAuth } from '@/lib/firebaseAdmin';

export const dynamic = 'force-dynamic';

const CREDIT_PACKS: Record<string, { name: string; credits: number; amount: number; description: string }> = {
  starter: { name: 'Starter Pack', credits: 100, amount: 300, description: '100 credits for $3.00' },
  plus: { name: 'Plus Pack', credits: 250, amount: 700, description: '250 credits for $7.00' },
  pro: { name: 'Pro Pack', credits: 500, amount: 1300, description: '500 credits for $13.00' },
};

export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Missing STRIPE_SECRET_KEY' }, { status: 500 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  const token = (req.headers.get('authorization') || '').replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    const { packId } = await req.json();
    const pack = CREDIT_PACKS[packId];
    if (!pack) return NextResponse.json({ error: 'Invalid pack' }, { status: 400 });

    const origin = req.headers.get('origin') || req.nextUrl.origin;
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: `${origin}?checkout=success`,
      cancel_url: `${origin}?checkout=cancelled`,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: pack.name, description: pack.description },
            unit_amount: pack.amount,
          },
          quantity: 1,
        },
      ],
      metadata: { uid: decoded.uid, packId, credits: String(pack.credits) },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Checkout creation failed' },
      { status: 500 },
    );
  }
}
