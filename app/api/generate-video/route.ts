import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { getAdminAuth } from '@/lib/firebaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: 'Missing GEMINI_API_KEY' }, { status: 500 });
  }

  const token = (req.headers.get('authorization') || '').replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    await getAdminAuth().verifyIdToken(token);

    const { prompt, aspectRatio = '16:9', durationSeconds = 5 } = await req.json();
    if (!prompt?.trim()) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    // Cap at 8s max — Veo 2 is ~4x cheaper than Veo 3.1; use VEO_MODEL env var to override
    const duration = Math.min(Math.max(Number(durationSeconds), 5), 8);
    const model = process.env.VEO_MODEL || 'veo-2.0-generate-001';
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const operation = await ai.models.generateVideos({
      model,
      prompt: prompt.trim(),
      config: { aspectRatio, durationSeconds: duration },
    });

    return NextResponse.json({ operationName: operation.name });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to start video generation' },
      { status: 500 },
    );
  }
}
