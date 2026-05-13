import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/* eslint-disable @typescript-eslint/no-explicit-any */

function extractVideo(operation: any): { uri?: string; videoBytes?: string; mimeType?: string } | null {
  const response = operation?.response;
  if (!response) return null;

  const gv = response?.generatedVideos?.[0];
  if (gv?.video?.uri || gv?.video?.videoBytes) return gv.video;
  if (gv?.uri || gv?.videoBytes) return gv;

  const gs = response?.generatedSamples?.[0];
  if (gs?.video?.uri || gs?.video?.videoBytes) return gs.video;
  if (gs?.uri || gs?.videoBytes) return gs;

  if (response?.video?.uri || response?.video?.videoBytes) return response.video;

  return null;
}

export async function GET(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new NextResponse('Missing GEMINI_API_KEY', { status: 500 });
  }

  const operationName = req.nextUrl.searchParams.get('op');
  if (!operationName) {
    return new NextResponse('Missing operation', { status: 400 });
  }

  try {
    const pollUrl = `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${apiKey}`;
    const pollRes = await fetch(pollUrl);

    if (!pollRes.ok) {
      const errText = await pollRes.text();
      return new NextResponse(`Failed to get operation: ${errText}`, { status: 502 });
    }

    const operation = await pollRes.json();

    if (!operation.done) {
      return new NextResponse('Video not ready', { status: 425 });
    }

    const video = extractVideo(operation);
    if (!video) {
      return new NextResponse('No video in response', { status: 404 });
    }

    // Case 1: inline base64 bytes
    if (video.videoBytes) {
      const base64 =
        typeof video.videoBytes === 'string'
          ? video.videoBytes
          : Buffer.from(video.videoBytes as unknown as Uint8Array).toString('base64');
      const buffer = Buffer.from(base64, 'base64');
      return new NextResponse(buffer as any, {
        status: 200,
        headers: {
          'content-type': video.mimeType || 'video/mp4',
          'content-length': String(buffer.length),
          'cache-control': 'private, max-age=3600',
        },
      });
    }

    // Case 2: URI — resolve relative paths and fetch with API key server-side
    if (video.uri) {
      const fullUri = video.uri.startsWith('http')
        ? video.uri
        : `https://generativelanguage.googleapis.com/v1beta/${video.uri}`;
      const sep = fullUri.includes('?') ? '&' : '?';
      const downloadUrl = `${fullUri}${sep}key=${apiKey}`;
      const upstream = await fetch(downloadUrl);
      if (!upstream.ok || !upstream.body) {
        return new NextResponse(`Upstream fetch failed (${upstream.status})`, { status: 502 });
      }
      return new NextResponse(upstream.body, {
        status: 200,
        headers: {
          'content-type': upstream.headers.get('content-type') || video.mimeType || 'video/mp4',
          'content-length': upstream.headers.get('content-length') || '',
          'cache-control': 'private, max-age=3600',
        },
      });
    }

    return new NextResponse('No video data', { status: 500 });
  } catch (err) {
    return new NextResponse(
      err instanceof Error ? err.message : 'Download failed',
      { status: 500 },
    );
  }
}
