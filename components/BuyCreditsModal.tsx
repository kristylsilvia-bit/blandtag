'use client';

import { useState } from 'react';
import { User } from 'firebase/auth';
import { X, Zap } from 'lucide-react';

const PACKS = [
  { id: 'starter', name: 'Starter', credits: 100, price: '$3.00', videos: '10 videos' },
  { id: 'plus', name: 'Plus', credits: 250, price: '$7.00', videos: '25 videos', popular: true },
  { id: 'pro', name: 'Pro', credits: 500, price: '$13.00', videos: '50 videos' },
] as const;

interface Props {
  user: User;
  onClose: () => void;
}

export default function BuyCreditsModal({ user, onClose }: Props) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function handleBuy(packId: string) {
    setError('');
    setLoading(packId);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ packId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create checkout');
      window.location.href = json.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(null);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 w-full max-w-md relative shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-1">
          <Zap className="w-5 h-5 text-violet-400" />
          <h2 className="text-xl font-semibold">Buy Credits</h2>
        </div>
        <p className="text-sm text-gray-400 mb-6">Each video generation costs 10 credits.</p>

        <div className="flex flex-col gap-3">
          {PACKS.map((pack) => (
            <button
              key={pack.id}
              onClick={() => handleBuy(pack.id)}
              disabled={!!loading}
              className={`flex items-center justify-between p-4 rounded-xl border transition-all text-left disabled:opacity-50 ${
                pack.popular
                  ? 'border-violet-500 bg-violet-950/40 hover:bg-violet-950/60'
                  : 'border-gray-700 hover:border-gray-600 hover:bg-gray-800/40'
              }`}
            >
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-medium">{pack.name}</span>
                  {pack.popular && (
                    <span className="text-xs bg-violet-600 text-white px-2 py-0.5 rounded-full">Popular</span>
                  )}
                </div>
                <div className="text-sm text-gray-400">
                  {pack.credits} credits &middot; {pack.videos}
                </div>
              </div>
              <div className="text-right shrink-0 ml-4">
                <div className="font-semibold text-lg">{pack.price}</div>
                {loading === pack.id && (
                  <div className="text-xs text-gray-400">Redirecting…</div>
                )}
              </div>
            </button>
          ))}
        </div>

        {error && <p className="text-red-400 text-xs mt-4">{error}</p>}

        <p className="text-xs text-gray-600 mt-5 text-center">
          Payments processed securely by Stripe.
        </p>
      </div>
    </div>
  );
}
