'use client';

import dynamic from 'next/dynamic';

const VideoApp = dynamic(() => import('@/components/VideoApp'), { ssr: false });

export default function HomeClient() {
  return <VideoApp />;
}
