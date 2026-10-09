import { afterEach, expect, it, vi } from 'vitest';
import { firebaseConfigurado } from './config';

afterEach(() => {
  vi.unstubAllEnvs();
});

it('detecta si falta la configuración o no es válida', () => {
  vi.stubEnv('NEXT_PUBLIC_FIREBASE_WEBAPP_CONFIG', '');
  expect(firebaseConfigurado()).toBe(false);
  vi.stubEnv('NEXT_PUBLIC_FIREBASE_WEBAPP_CONFIG', '{no es json');
  expect(firebaseConfigurado()).toBe(false);
  vi.stubEnv('NEXT_PUBLIC_FIREBASE_WEBAPP_CONFIG', '{"apiKey":"k","projectId":"p","appId":"a"}');
  expect(firebaseConfigurado()).toBe(true);
});
