import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebaseAdmin';

export const dynamic = 'force-dynamic';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Try every known Veo LRO response shape to locate the video object.
 * Includes a diagnostic snippet in the error if nothing matches.
 */
function extractVideo(operation: any): { uri?: string; videoBytes?: string; mimeType?: string } | null {
  const response = operation?.response;
  if (!response) return null;

  // Shape 1 – generatedVideos[0].video (standard Veo 3 format)
  const gv = response?.generatedVideos?.[0];
  if (gv?.video?.uri || gv?.video?.videoBytes) return gv.video;
  // Shape 2 – generatedVideos[0] flattened (video props directly on item)
  if (gv?.uri || gv?.videoBytes) return gv;

  // Shape 3 – generatedSamples[0].video
  const gs = response?.generatedSamples?.[0];
  if (gs?.video?.uri || gs?.video?.videoBytes) return gs.video;
  // Shape 4 – generatedSamples[0] flattened
  if (gs?.uri || gs?.videoBytes) return gs;

  // Shape 5 – top-level video field on response
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
      // Include a diagnostic snippet so we can see the actual LRO response shape
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
