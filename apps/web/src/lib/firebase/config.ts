import type { FirebaseOptions } from 'firebase/app';

export function configuracionFirebase(): FirebaseOptions {
  const crudo = process.env.NEXT_PUBLIC_FIREBASE_WEBAPP_CONFIG;
  if (!crudo) throw new Error('Falta la configuración de Firebase (NEXT_PUBLIC_FIREBASE_WEBAPP_CONFIG).');
  return JSON.parse(crudo) as FirebaseOptions;
}

export const usarEmuladores = () => process.env.NEXT_PUBLIC_USAR_EMULADORES === 'true';
