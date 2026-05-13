import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebaseAdmin';

export const dynamic = 'force-dynamic';

/* eslint-disable @typescript-eslint/no-explicit-any */

function extractVideo(operation: any): { uri?: string; videoBytes?: string; mimeType?: string } | null {
  const response = operation?.response;
  if (!response) return null;

  // Actual Veo 3 shape: response.generateVideoResponse.generatedSamples[0].video
  const gvr = response?.generateVideoResponse;
  if (gvr) {
    const gs = gvr?.generatedSamples?.[0];
    if (gs?.video?.uri || gs?.video?.videoBytes) return gs.video;
    if (gs?.uri || gs?.videoBytes) return gs;
    const gv2 = gvr?.generatedVideos?.[0];
    if (gv2?.video?.uri || gv2?.video?.videoBytes) return gv2.video;
    if (gv2?.uri || gv2?.videoBytes) return gv2;
  }

  // Fallback: generatedVideos / generatedSamples directly on response
  const gv = response?.generatedVideos?.[0];
  if (gv?.video?.uri || gv?.video?.videoBytes) return gv.video;
  if (gv?.uri || gv?.videoBytes) return gv;

  const gs2 = response?.generatedSamples?.[0];
  if (gs2?.video?.uri || gs2?.video?.videoBytes) return gs2.video;
  if (gs2?.uri || gs2?.videoBytes) return gs2;

  if (response?.video?.uri || response?.video?.videoBytes) return response.video;

  return null;
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
      const snippet = JSON.stringify(operation?.response ?? operation).slice(0, 400);
      return NextResponse.json({
        done: true,
        error: `Video generation completed but no video data was found. Response: ${snippet}`,
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
