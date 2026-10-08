import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const getToken = vi.fn().mockResolvedValue('token-1');
vi.mock('firebase/messaging', () => ({
  getMessaging: vi.fn(() => ({})),
  getToken,
  isSupported: vi.fn(async () => true),
}));
vi.mock('firebase/firestore', () => ({
  arrayUnion: vi.fn((v) => v),
  doc: vi.fn(() => ({})),
  setDoc: vi.fn(async () => undefined),
}));
vi.mock('@/lib/firebase/cliente', () => ({ obtenerFirebase: () => ({ app: {}, db: {} }) }));

const { activarNotificaciones } = await import('./activar');

const instalando = { installing: {}, active: null } as unknown as ServiceWorkerRegistration;
const activo = { active: {} } as unknown as ServiceWorkerRegistration;

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_FIREBASE_VAPID_KEY', 'llave');
  vi.stubGlobal('Notification', { permission: 'default', requestPermission: vi.fn(async () => 'granted') });
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { register: vi.fn(async () => instalando), ready: Promise.resolve(activo) },
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it('pide el token con el service worker ya activo', async () => {
  await expect(activarNotificaciones()).resolves.toBe('activadas');
  expect(navigator.serviceWorker.register).toHaveBeenCalledWith('/sw-notificaciones.js');
  expect(getToken).toHaveBeenCalledWith(expect.anything(), {
    vapidKey: 'llave',
    serviceWorkerRegistration: activo,
  });
});

it('sin permiso no registra nada', async () => {
  vi.stubGlobal('Notification', { permission: 'default', requestPermission: vi.fn(async () => 'denied') });
  getToken.mockClear();
  await expect(activarNotificaciones()).resolves.toBe('bloqueadas');
  expect(getToken).not.toHaveBeenCalled();
});
