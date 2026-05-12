import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';

export const dynamic = 'force-dynamic';

const COST_PER_VIDEO = 10;

export async function POST(req: NextRequest) {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    const db = getAdminDb();
    const userRef = db.collection('users').doc(decoded.uid);

    const remaining = await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      const current = Number(snap.data()?.credits || 0);

      if (current < COST_PER_VIDEO) {
        throw new Error('You need at least 10 credits to generate a video.');
      }

      const next = current - COST_PER_VIDEO;
      tx.set(
        userRef,
        { credits: next, updatedAt: FieldValue.serverTimestamp() },
        { merge: true },
      );
      return next;
    });

    return NextResponse.json({ credits: remaining });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Credit deduction failed' },
      { status: 400 },
    );
  }
}
