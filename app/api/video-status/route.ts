import { NextRequest, NextResponse } from 'next/server';
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

    // Poll via REST — SDK getVideosOperation is not available in all versions
    const pollUrl = `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${process.env.GEMINI_API_KEY}`;
    const pollRes = await fetch(pollUrl);

    if (!pollRes.ok) {
      const errText = await pollRes.text();
      throw new Error(`Poll failed (${pollRes.status}): ${errText}`);
    }

    const operation = await pollRes.json();

    if (!operation.done) {
      return NextResponse.json({ done: false });
    }

    if (operation.error) {
      return NextResponse.json({
        done: true,
        error: operation.error.message || 'Video generation failed',
      });
    }

    const video = extractVideo(operation);
    if (!video || (!video.uri && !video.videoBytes)) {
      return NextResponse.json({
        done: true,
        error: 'Video generation completed but no video data was returned.',
      });
    }

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
