import type { FirebaseOptions } from 'firebase/app';

export const MENSAJE_SIN_CONFIGURACION =
  'OmniStream aún no está conectado a Firebase. Configura NEXT_PUBLIC_FIREBASE_WEBAPP_CONFIG en el despliegue.';

function leerConfiguracion(): FirebaseOptions | null {
  const crudo = process.env.NEXT_PUBLIC_FIREBASE_WEBAPP_CONFIG;
  if (!crudo) return null;
  try {
    return JSON.parse(crudo) as FirebaseOptions;
  } catch {
    return null;
  }
}

export const firebaseConfigurado = () => leerConfiguracion() !== null;

export function configuracionFirebase(): FirebaseOptions {
  const configuracion = leerConfiguracion();
  if (!configuracion) throw new Error(MENSAJE_SIN_CONFIGURACION);
  return configuracion;
}

export const usarEmuladores = () => process.env.NEXT_PUBLIC_USAR_EMULADORES === 'true';
