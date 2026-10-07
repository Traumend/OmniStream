import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@omnistream/core'],
  env: {
    // En Vercel se define NEXT_PUBLIC_FIREBASE_WEBAPP_CONFIG; en local se usa .env.development.
    // FIREBASE_WEBAPP_CONFIG se acepta por compatibilidad con Firebase App Hosting.
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
