import { expect, it } from 'vitest';
import type { Platform } from '../publicaciones/tipos';
import { modoDePublicacion, mensajePermisoFaltante, puedeComentarPorApi, puedePublicarPorApi } from './modos';
import { leerConexion, PERMISO_PUBLICAR, type Conexion } from './tipos';

const conectada = (red: Platform, extra: Partial<Conexion> = {}): Conexion => ({
  ...leerConexion(red, undefined),
  authStatus: 'conectada',
  publishMode: 'api',
  scopes: [PERMISO_PUBLICAR[red]],
  ...extra,
});

it('api solo con conexión conectada, modo api y permiso de publicar', () => {
  expect(modoDePublicacion(conectada('youtube'))).toBe('api');
  expect(modoDePublicacion(conectada('youtube', { authStatus: 'expirada' }))).toBe('manual');
  expect(modoDePublicacion(conectada('youtube', { publishMode: 'manual' }))).toBe('manual');
  expect(modoDePublicacion(conectada('youtube', { scopes: [] }))).toBe('manual');
  expect(modoDePublicacion(null)).toBe('manual');
});

it('TikTok imagen por API exige el dominio verificado', () => {
  expect(modoDePublicacion(conectada('tiktok'), 'imagen')).toBe('manual');
  expect(modoDePublicacion(conectada('tiktok', { mediaVerified: true }), 'imagen')).toBe('api');
  expect(modoDePublicacion(conectada('tiktok'), 'tiktok')).toBe('api');
});

it('comentar por API exige modo api y el permiso de comentar; TikTok nunca', () => {
  expect(
    puedeComentarPorApi(conectada('instagram', { scopes: ['instagram_content_publish', 'instagram_manage_comments'] })),
  ).toBe(true);
  expect(puedeComentarPorApi(conectada('instagram'))).toBe(false);
  expect(puedeComentarPorApi(conectada('tiktok', { scopes: ['video.publish'] }))).toBe(false);
  expect(puedeComentarPorApi(null)).toBe(false);
});

it('publicar por API exige estar conectada y el permiso', () => {
  expect(puedePublicarPorApi(conectada('facebook'))).toBe(true);
  expect(puedePublicarPorApi(conectada('facebook', { authStatus: 'sin_conectar' }))).toBe(false);
});

it('mensaje de permiso faltante', () => {
  expect(mensajePermisoFaltante('instagram')).toBe(
    'Falta el permiso para publicar en Instagram. Vuelve a conectar Meta y concédelo.',
  );
});
