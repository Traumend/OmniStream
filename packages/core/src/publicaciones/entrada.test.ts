import { expect, it } from 'vitest';
import { accionPublicacionSchema, entradaPublicacionSchema } from './entrada';

const minima = { title: 'Hola', assetId: null, base: { text: '', hashtags: [] }, scheduledAt: null, parentId: null, destinos: [] };
const mensaje = (r: { success: boolean; error?: { issues: { message: string }[] } }) => r.error?.issues[0]?.message;

it('acepta una entrada mínima', () => {
  expect(entradaPublicacionSchema.safeParse(minima).success).toBe(true);
});
it('rechaza título vacío', () => {
  expect(mensaje(entradaPublicacionSchema.safeParse({ ...minima, title: '  ' }))).toBe('Escribe un título');
});
it('rechaza redes repetidas', () => {
  const destinos = [{ platform: 'tiktok', format: 'tiktok' }, { platform: 'tiktok', format: 'imagen' }];
  expect(mensaje(entradaPublicacionSchema.safeParse({ ...minima, destinos }))).toBe('Cada red puede aparecer una sola vez.');
});
it('rechaza un formato que la red no admite', () => {
  const destinos = [{ platform: 'youtube', format: 'imagen' }];
  expect(mensaje(entradaPublicacionSchema.safeParse({ ...minima, destinos }))).toBe('YouTube no admite el formato Imagen.');
});
it('exige fechas ISO en UTC', () => {
  expect(entradaPublicacionSchema.safeParse({ ...minima, scheduledAt: '2026-10-08 10:00' }).success).toBe(false);
  expect(entradaPublicacionSchema.safeParse({ ...minima, scheduledAt: '2026-10-08T16:30:00.000Z' }).success).toBe(true);
});
it('valida cada acción', () => {
  expect(accionPublicacionSchema.safeParse({ accion: 'mover', postId: 'p', scheduledAt: 'mañana' }).success).toBe(false);
  expect(mensaje(accionPublicacionSchema.safeParse({ accion: 'marcarPublicada', postId: 'p', platform: 'tiktok', url: ' ' }))).toBe('Pega la URL de la publicación.');
  expect(accionPublicacionSchema.safeParse({ accion: 'borrarTodo' }).success).toBe(false);
  expect(accionPublicacionSchema.safeParse({ accion: 'programar', postId: 'p', inmediata: true }).success).toBe(true);
});
