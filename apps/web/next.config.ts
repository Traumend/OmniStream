import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  transpilePackages: ['@omnistream/core'],
  env: {
    // App Hosting inyecta FIREBASE_WEBAPP_CONFIG al compilar; en local se usa .env.development.
    NEXT_PUBLIC_FIREBASE_WEBAPP_CONFIG:
      process.env.FIREBASE_WEBAPP_CONFIG ?? process.env.NEXT_PUBLIC_FIREBASE_WEBAPP_CONFIG ?? '',
  },
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
