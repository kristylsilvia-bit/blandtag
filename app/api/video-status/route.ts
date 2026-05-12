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

    const { operationName } = await req.json();
    if (!operationName) {
      return NextResponse.json({ error: 'operationName required' }, { status: 400 });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const operation = await ai.operations.getVideos({ name: operationName });

    if (!operation.done) {
      return NextResponse.json({ done: false });
    }

    const sample = (operation.response as any)?.generatedSamples?.[0];
    const video = sample?.video;

    if (!video) {
      return NextResponse.json({ done: true, error: 'No video in response' });
    }

    if (video.uri) {
      return NextResponse.json({ done: true, videoUrl: video.uri });
    }

    if (video.videoBytes) {
      const base64 = Buffer.from(video.videoBytes as Uint8Array).toString('base64');
      return NextResponse.json({ done: true, videoData: base64, mimeType: 'video/mp4' });
    }

    return NextResponse.json({ done: true, error: 'No video data in response' });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Status check failed' },
      { status: 500 },
    );
  }
}
