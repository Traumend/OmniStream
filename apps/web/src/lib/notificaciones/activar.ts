'use client';

import { arrayUnion, doc, setDoc } from 'firebase/firestore';
import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import { obtenerFirebase } from '@/lib/firebase/cliente';
import type { EntornoNotificaciones } from './estado';

const CLAVE_TOKEN = 'omnistream.fcmToken';
const SERVICE_WORKER = '/sw-notificaciones.js';

const llaveVapid = () => process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || undefined;

function tokenGuardado(): string | null {
  try {
    return localStorage.getItem(CLAVE_TOKEN);
  } catch {
    return null;
  }
}

function guardarToken(token: string) {
  try {
    localStorage.setItem(CLAVE_TOKEN, token);
  } catch {
    // Sin almacenamiento local la tarjeta mostrará "desactivadas", pero los avisos siguen llegando.
  }
}

async function soportaPush(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) return false;
  try {
    return await isSupported();
  } catch {
    return false;
  }
}

export async function leerEntorno(): Promise<EntornoNotificaciones> {
  const soportado = await soportaPush();
  return {
    soportado,
    vapid: llaveVapid(),
    permiso: soportado ? Notification.permission : 'default',
    tokenRegistrado: tokenGuardado() !== null,
  };
}

// Registra el service worker, obtiene el token de este dispositivo y lo agrega a settings/app.fcmTokens.
async function registrarToken(vapidKey: string) {
  const registro = await navigator.serviceWorker.register(SERVICE_WORKER);
  const { app, db } = obtenerFirebase();
  const token = await getToken(getMessaging(app), { vapidKey, serviceWorkerRegistration: registro });
  await setDoc(doc(db, 'settings', 'app'), { fcmTokens: arrayUnion(token) }, { merge: true });
  guardarToken(token);
}

export async function activarNotificaciones(): Promise<'activadas' | 'bloqueadas'> {
  const vapidKey = llaveVapid();
  if (!vapidKey) throw new Error('Falta configurar la llave VAPID (NEXT_PUBLIC_FIREBASE_VAPID_KEY).');
  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') return 'bloqueadas';
  await registrarToken(vapidKey);
  return 'activadas';
}

// El token de FCM puede rotar y el servidor descarta los inválidos: al abrir Ajustes se vuelve a registrar.
export async function sincronizarNotificaciones(): Promise<void> {
  const vapidKey = llaveVapid();
  if (!vapidKey || Notification.permission !== 'granted' || tokenGuardado() === null) return;
  await registrarToken(vapidKey);
}
