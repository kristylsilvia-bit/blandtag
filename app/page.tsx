import { Suspense } from 'react';
import VideoApp from '@/components/VideoApp';

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-950" />}>
      <VideoApp />
    </Suspense>
  );
}
