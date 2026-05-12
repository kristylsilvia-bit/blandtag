import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { getAdminAuth } from '@/lib/firebaseAdmin';

export const dynamic = 'force-dynamic';

/* eslint-disable @typescript-eslint/no-explicit-any */

function extractVideo(operation: any) {
  const response = operation?.response;
  const generated =
    response?.generatedVideos?.[0] || response?.generatedSamples?.[0];
  return generated?.video || generated;
}

export async function POST(req: NextRequest) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: 'Missing GEMINI_API_KEY' }, { status: 500 });
  }

  const token = (req.headers.get('authorization') || '').replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    await getAdminAuth().verifyIdToken(token);

    const { operationName } = await req.json();
    if (!operationName) {
      return NextResponse.json({ error: 'operationName required' }, { status: 400 });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const operation = await (ai.operations as any).getVideosOperation({
      operation: { name: operationName },
    });

    if (!operation.done) {
      return NextResponse.json({ done: false });
    }

    const video = extractVideo(operation);
    if (!video || (!video.uri && !video.videoBytes)) {
      return NextResponse.json({
        done: true,
        error: 'Video generation completed but no video data was returned.',
      });
    }

    // Client always uses the proxy endpoint — it handles both uri and videoBytes
    // and keeps the API key server-side.
    return NextResponse.json({
      done: true,
      videoUrl: `/api/video-download?op=${encodeURIComponent(operationName)}`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Status check failed' },
      { status: 500 },
    );
  }
}
