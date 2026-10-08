import type { NextConfig } from 'next';
import { reescrituras } from './src/lib/reescrituras';

const nextConfig: NextConfig = {
  transpilePackages: ['@omnistream/core'],
  env: {
    // En Vercel se define NEXT_PUBLIC_FIREBASE_WEBAPP_CONFIG; en local se usa .env.development.
    // FIREBASE_WEBAPP_CONFIG se acepta por compatibilidad con Firebase App Hosting.
    NEXT_PUBLIC_FIREBASE_WEBAPP_CONFIG:
      process.env.FIREBASE_WEBAPP_CONFIG ?? process.env.NEXT_PUBLIC_FIREBASE_WEBAPP_CONFIG ?? '',
  },
  async rewrites() {
    return reescrituras(process.env.FUNCIONES_URL, process.env.NODE_ENV !== 'production');
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
