import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ['firebase-admin'],
  webpack: (config) => {
    config.resolve.dedupe = [
      ...(config.resolve.dedupe ?? []),
      'firebase',
      '@firebase/app',
      '@firebase/auth',
      '@firebase/firestore',
    ];
    return config;
  },
};

export default nextConfig;
