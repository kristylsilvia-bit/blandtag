import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { adminAuth } from '@/lib/firebaseAdmin';

export async function POST(req: NextRequest) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: 'Missing GEMINI_API_KEY' }, { status: 500 });
  }

  const token = (req.headers.get('authorization') || '').replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    await adminAuth.verifyIdToken(token);

    const { prompt, aspectRatio = '16:9', durationSeconds = 8 } = await req.json();
    if (!prompt?.trim()) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const duration = Math.min(Math.max(Number(durationSeconds), 5), 10);
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const operation = await ai.models.generateVideos({
      model: 'veo-3.0-generate-preview',
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
