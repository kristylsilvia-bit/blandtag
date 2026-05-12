import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebaseAdmin';

export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return new NextResponse('Missing Stripe configuration', { status: 500 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  try {
    const rawBody = Buffer.from(await req.arrayBuffer());
    const sig = req.headers.get('stripe-signature') || '';
    const event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET,
    );

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const uid = session.metadata?.uid;
      const credits = Number(session.metadata?.credits || 0);

      if (uid && credits > 0) {
        await adminDb
          .collection('users')
          .doc(uid)
          .set(
            {
              credits: FieldValue.increment(credits),
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    return new NextResponse(
      err instanceof Error ? err.message : 'Webhook error',
      { status: 400 },
    );
  }
}
