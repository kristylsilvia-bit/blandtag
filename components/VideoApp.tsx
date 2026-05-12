'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import AuthModal from './AuthModal';
import BuyCreditsModal from './BuyCreditsModal';
import { Video, LogOut, CreditCard, Loader2, Download, Zap } from 'lucide-react';

type AspectRatio = '16:9' | '9:16' | '1:1';
type GenState = 'idle' | 'consuming' | 'starting' | 'polling' | 'done' | 'error';

const ASPECT_CLASSES: Record<AspectRatio, string> = {
  '16:9': 'aspect-video w-full',
  '9:16': 'aspect-[9/16] max-w-xs mx-auto',
  '1:1': 'aspect-square max-w-lg mx-auto w-full',
};

export default function VideoApp() {
  const [user, setUser] = useState<User | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [showBuy, setShowBuy] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [duration, setDuration] = useState(8);
  const [genState, setGenState] = useState<GenState>('idle');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoBase64, setVideoBase64] = useState<{ data: string; mimeType: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const unsubCreditsRef = useRef<(() => void) | null>(null);

  const searchParams = useSearchParams();
  const router = useRouter();

  // Handle Stripe redirect params
  useEffect(() => {
    const checkout = searchParams.get('checkout');
    if (checkout === 'success') {
      setToast('Payment successful — credits added!');
      router.replace('/');
    } else if (checkout === 'cancelled') {
      setToast('Checkout cancelled.');
      router.replace('/');
    }
  }, [searchParams, router]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // Firebase auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        setCredits(null);
        unsubCreditsRef.current?.();
        unsubCreditsRef.current = null;
      }
    });
    return unsub;
  }, []);

  // Firestore credits listener
  useEffect(() => {
    if (!user) return;

    const userRef = doc(db, 'users', user.uid);
    // Create/update user doc on sign-in (matches visionary-ai schema)
    setDoc(
      userRef,
      {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        lastLogin: serverTimestamp(),
      },
      { merge: true },
    );

    const unsub = onSnapshot(userRef, (snap) => {
      setCredits(Number(snap.data()?.credits ?? 0));
    });
    unsubCreditsRef.current = unsub;
    return unsub;
  }, [user]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function getToken() {
    if (!user) throw new Error('Not signed in');
    return user.getIdToken();
  }

  async function handleGenerate() {
    if (!user) {
      setShowAuth(true);
      return;
    }
    if (!prompt.trim()) return;
    if (['consuming', 'starting', 'polling'].includes(genState)) return;

    setError(null);
    setVideoUrl(null);
    setVideoBase64(null);
    if (pollRef.current) clearInterval(pollRef.current);

    try {
      // Step 1: deduct credits
      setGenState('consuming');
      const token = await getToken();
      const creditRes = await fetch('/api/consume-credits', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
      });
      const creditJson = await creditRes.json();
      if (!creditRes.ok) throw new Error(creditJson.error || 'Credit deduction failed');

      // Step 2: start video generation
      setGenState('starting');
      const genRes = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ prompt: prompt.trim(), aspectRatio, durationSeconds: duration }),
      });
      const genJson = await genRes.json();
      if (!genRes.ok) throw new Error(genJson.error || 'Failed to start generation');

      const { operationName } = genJson;

      // Step 3: poll for completion
      setGenState('polling');
      pollRef.current = setInterval(async () => {
        try {
          const freshToken = await getToken();
          const statusRes = await fetch('/api/video-status', {
            method: 'POST',
            headers: { 'content-type': 'application/json', authorization: `Bearer ${freshToken}` },
            body: JSON.stringify({ operationName }),
          });
          const statusJson = await statusRes.json();

          if (!statusRes.ok) {
            clearInterval(pollRef.current!);
            setGenState('error');
            setError(statusJson.error || 'Status check failed');
            return;
          }

          if (statusJson.done) {
            clearInterval(pollRef.current!);
            if (statusJson.error) {
              setGenState('error');
              setError(statusJson.error);
            } else if (statusJson.videoUrl) {
              setVideoUrl(statusJson.videoUrl);
              setGenState('done');
            } else if (statusJson.videoData) {
              setVideoBase64({ data: statusJson.videoData, mimeType: statusJson.mimeType || 'video/mp4' });
              setGenState('done');
            }
          }
        } catch {
          clearInterval(pollRef.current!);
          setGenState('error');
          setError('Polling error — please try again.');
        }
      }, 8000);
    } catch (err) {
      setGenState('error');
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  const isGenerating = ['consuming', 'starting', 'polling'].includes(genState);
  const videoSrc = videoUrl ?? (videoBase64 ? `data:${videoBase64.mimeType};base64,${videoBase64.data}` : null);

  const genButtonLabel = (() => {
    if (genState === 'consuming') return 'Deducting credits…';
    if (genState === 'starting') return 'Starting generation…';
    if (genState === 'polling') return 'Generating…';
    return 'Generate Video';
  })();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Video className="w-5 h-5 text-violet-400" />
          <span className="font-semibold">Visionary AI Video</span>
        </div>
        <div className="flex items-center gap-4">
          {user ? (
            <>
              <button
                onClick={() => setShowBuy(true)}
                className="flex items-center gap-1.5 text-sm text-gray-300 hover:text-white transition-colors"
              >
                <Zap className="w-4 h-4 text-violet-400" />
                <span>{credits ?? '–'} credits</span>
              </button>
              <button
                onClick={() => setShowBuy(true)}
                className="text-sm px-3 py-1.5 rounded-lg border border-gray-700 hover:border-gray-500 text-gray-300 hover:text-white transition-colors flex items-center gap-1.5"
              >
                <CreditCard className="w-3.5 h-3.5" />
                Buy credits
              </button>
              <button
                onClick={() => signOut(auth)}
                className="text-gray-500 hover:text-white transition-colors"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          ) : (
            <button
              onClick={() => setShowAuth(true)}
              className="px-4 py-2 text-sm bg-violet-600 hover:bg-violet-500 rounded-lg transition-colors font-medium"
            >
              Sign in
            </button>
          )}
        </div>
      </header>

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-800 border border-gray-700 rounded-xl px-5 py-2.5 text-sm shadow-2xl">
          {toast}
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-10 flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">Generate a Video</h1>
          <p className="text-gray-400 text-sm">Powered by Veo 3.1 &middot; 10 credits per video</p>
        </div>

        {/* Prompt */}
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe your video… e.g. A golden retriever running through a sunflower field at golden hour"
          rows={4}
          disabled={isGenerating}
          className="w-full bg-gray-900 border border-gray-700 rounded-xl p-4 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500 placeholder-gray-600 disabled:opacity-60"
        />

        {/* Options row */}
        <div className="flex flex-wrap gap-6 items-start">
          {/* Aspect ratio */}
          <div className="flex flex-col gap-2">
            <label className="text-xs text-gray-500 font-medium uppercase tracking-wider">Aspect Ratio</label>
            <div className="flex gap-2">
              {(['16:9', '9:16', '1:1'] as AspectRatio[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setAspectRatio(r)}
                  disabled={isGenerating}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors disabled:opacity-50 ${
                    aspectRatio === r
                      ? 'bg-violet-600 border-violet-600 text-white'
                      : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Duration */}
          <div className="flex flex-col gap-2 flex-1 min-w-[180px]">
            <label className="text-xs text-gray-500 font-medium uppercase tracking-wider">
              Duration: {duration}s
            </label>
            <input
              type="range"
              min={5}
              max={10}
              step={1}
              value={duration}
              disabled={isGenerating}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="accent-violet-500 disabled:opacity-50"
            />
            <div className="flex justify-between text-xs text-gray-600">
              <span>5s</span>
              <span>10s</span>
            </div>
          </div>
        </div>

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={isGenerating || !prompt.trim()}
          className="w-full py-3 rounded-xl font-semibold text-sm transition-all bg-violet-600 hover:bg-violet-500 active:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isGenerating && <Loader2 className="w-4 h-4 animate-spin" />}
          {genButtonLabel}
        </button>

        {/* Low-credit warning */}
        {user && credits !== null && credits < 10 && !isGenerating && (
          <div className="flex items-center justify-between bg-yellow-900/20 border border-yellow-700/50 rounded-xl px-4 py-3 text-sm">
            <span className="text-yellow-300">Not enough credits to generate a video.</span>
            <button
              onClick={() => setShowBuy(true)}
              className="text-yellow-400 hover:text-yellow-200 font-medium"
            >
              Buy credits
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-950/50 border border-red-700/60 rounded-xl p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Polling indicator */}
        {genState === 'polling' && !videoSrc && (
          <div className="flex flex-col items-center gap-3 py-14">
            <div className="relative">
              <Loader2 className="w-10 h-10 animate-spin text-violet-400" />
            </div>
            <p className="text-sm text-gray-400">Your video is being generated — this can take 1–3 minutes.</p>
            <p className="text-xs text-gray-600">Checking every 8 seconds…</p>
          </div>
        )}

        {/* Video output */}
        {videoSrc && (
          <div className="flex flex-col gap-3">
            <video
              key={videoSrc}
              src={videoSrc}
              controls
              autoPlay
              loop
              playsInline
              className={`rounded-xl bg-gray-900 ${ASPECT_CLASSES[aspectRatio]}`}
            />
            <a
              href={videoSrc}
              download="visionary-ai-video.mp4"
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors w-fit"
            >
              <Download className="w-4 h-4" />
              Download video
            </a>
          </div>
        )}
      </main>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      {showBuy && user && <BuyCreditsModal user={user} onClose={() => setShowBuy(false)} />}
    </div>
  );
}
