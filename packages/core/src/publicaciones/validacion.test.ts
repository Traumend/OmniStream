import { describe, expect, it } from 'vitest';
import { CAMPOS_YOUTUBE_POR_DEFECTO } from './tipos';
import { mensajeProblemas, validarPublicacion, type ContextoValidacion } from './validacion';

const ahora = new Date('2026-10-07T12:00:00Z');
const manana = new Date('2026-10-08T12:00:00Z');
const vertical = { kind: 'video', status: 'listo', width: 1080, height: 1920, aspect: 0.5625, durationSec: 30 } as const;
const basePublicacion = { title: 'Mi corto', assetId: 'a1', base: { text: 'Hola', hashtags: [] as string[] }, scheduledAt: manana };
type Extra = Omit<Partial<ContextoValidacion>, 'publicacion'> & { publicacion?: Partial<ContextoValidacion['publicacion']> };
const d = (platform: string, format: string, extra = {}) => ({ platform, format, overrides: {}, ...extra }) as ContextoValidacion['destinos'][number];
const validar = (destinos: ContextoValidacion['destinos'], { publicacion, ...extra }: Extra = {}) =>
  validarPublicacion({ publicacion: { ...basePublicacion, ...publicacion }, destinos, asset: vertical, principal: null,
    numeroDeHijas: 0, ahora, hora: 'programada', ...extra });
const conAsset = (cambios: object): Extra => ({ asset: { ...vertical, ...cambios } });
const conTexto = (text: string, hashtags: string[] = []): Extra => ({ publicacion: { base: { text, hashtags } } });
const youtube = (campos = CAMPOS_YOUTUBE_POR_DEFECTO) => d('youtube', 'short', { youtube: campos });
const cuatro = [d('facebook', 'reel'), d('instagram', 'reel'), youtube(), d('tiktok', 'tiktok')];

it('una publicación válida a 4 redes no tiene problemas', () => {
  expect(validar(cuatro)).toEqual([]);
});

describe('archivo y redes', () => {
  it.each([
    [[], {}, 'Elige al menos una red.'],
    [cuatro, { publicacion: { assetId: undefined } }, 'Elige un archivo.'],
    [cuatro, { asset: null }, 'El archivo ya no está disponible.'],
    [cuatro, conAsset({ status: 'procesando' }), 'El archivo aún no está listo.'],
    [cuatro, conAsset({ status: 'purgado' }), 'El archivo ya no está disponible.'],
    [[d('facebook', 'reel')], conAsset({ kind: 'image' }), 'Facebook · Reel: necesita un video.'],
  ] as const)('%#', (destinos, extra, mensaje) => {
    expect(validar(destinos, extra as Extra)).toContainEqual(expect.objectContaining({ nivel: 'error', mensaje }));
  });
});

describe('duración y proporción', () => {
  it('Reel de Facebook de más de 90 s es error', () => {
    expect(validar([d('facebook', 'reel')], conAsset({ durationSec: 120 }))).toContainEqual({
      nivel: 'error', red: 'facebook', mensaje: 'Facebook · Reel: el video dura 2:00 y el máximo es 1:30.' });
  });
  it('Reel de Instagram de menos de 3 s es error', () => {
    expect(validar([d('instagram', 'reel')], conAsset({ durationSec: 2 }))).toContainEqual({
      nivel: 'error', red: 'instagram', mensaje: 'Instagram · Reel: el video debe durar al menos 0:03.' });
  });
  it('Short de más de 3 minutos es advertencia', () => {
    expect(validar([youtube()], conAsset({ durationSec: 200 }))).toContainEqual({
      nivel: 'advertencia', red: 'youtube', mensaje: 'YouTube · Short: el video dura más de 3 minutos y YouTube no lo clasificará como Short.' });
  });
  it('proporción no recomendada es advertencia', () => {
    expect(validar([d('tiktok', 'tiktok')], conAsset({ width: 1920, height: 1080, aspect: 1.7778 }))).toContainEqual({
      nivel: 'advertencia', red: 'tiktok', mensaje: 'TikTok · Video: la proporción 16:9 no es la recomendada (9:16).' });
  });
  it('imagen de Instagram fuera del rango 4:5 a 1.91:1', () => {
    expect(validar([d('instagram', 'imagen')], conAsset({ kind: 'image', durationSec: undefined }))).toContainEqual({
      nivel: 'advertencia', red: 'instagram', mensaje: 'Instagram · Imagen: la proporción 9:16 no es la recomendada (4:5, 1:1, 1.91:1).' });
  });
  it('resolución menor a 720p es advertencia general', () => {
    expect(validar(cuatro, conAsset({ width: 480, height: 854 }))).toContainEqual({ nivel: 'advertencia', mensaje: 'La resolución es menor a 720p.' });
  });
});

describe('textos', () => {
  it('texto de Instagram de más de 2200 caracteres', () => {
    expect(validar([d('instagram', 'reel')], conTexto('a'.repeat(2201)))).toContainEqual({
      nivel: 'error', red: 'instagram', mensaje: 'Instagram · Reel: el texto tiene 2201 caracteres y el máximo es 2200.' });
  });
  it('más de 30 hashtags en Instagram', () => {
    const hashtags = Array.from({ length: 31 }, (_, i) => `h${i}`);
    expect(validar([d('instagram', 'reel')], conTexto('Hola', hashtags))).toContainEqual({
      nivel: 'error', red: 'instagram', mensaje: 'Instagram · Reel: hay 31 hashtags y el máximo es 30.' });
  });
  it('TikTok cuenta la referencia al Principal', () => {
    const r = validar([d('tiktok', 'tiktok')], {
      publicacion: { parentId: 'p1', base: { text: 'a'.repeat(2150), hashtags: [] } },
      principal: { id: 'p1', kind: 'principal', title: 'Largo' },
    });
    expect(r).toContainEqual({ nivel: 'error', red: 'tiktok', mensaje: 'TikTok · Video: el texto tiene 2215 caracteres y el máximo es 2200.' });
  });
  it.each([
    [{ title: 'a'.repeat(101) }, 'YouTube: el título tiene 101 caracteres y el máximo es 100.'],
    [{ title: 'a < b' }, 'YouTube: el título y la descripción no pueden contener los signos < ni >.'],
  ])('YouTube %#', (publicacion, mensaje) => {
    expect(validar([youtube()], { publicacion })).toContainEqual({ nivel: 'error', red: 'youtube', mensaje });
  });
  it('descripción y etiquetas de YouTube', () => {
    const r = validar([youtube({ ...CAMPOS_YOUTUBE_POR_DEFECTO, description: 'a'.repeat(5001), tags: ['a'.repeat(501)] })]);
    expect(r).toContainEqual({ nivel: 'error', red: 'youtube', mensaje: 'YouTube: la descripción tiene 5001 caracteres y el máximo es 5000.' });
    expect(r).toContainEqual({ nivel: 'error', red: 'youtube', mensaje: 'YouTube: las etiquetas suman 501 caracteres y el máximo es 500.' });
  });
});

describe('hora y jerarquía', () => {
  const sinFecha: Extra = { publicacion: { scheduledAt: null } };
  const pasada: Extra = { publicacion: { scheduledAt: new Date('2026-10-07T11:00:00Z') } };
  it('programar exige fecha futura', () => {
    expect(validar(cuatro, sinFecha)).toContainEqual({ nivel: 'error', mensaje: 'Elige la fecha y la hora.' });
    expect(validar(cuatro, pasada)).toContainEqual({ nivel: 'error', mensaje: 'La hora programada ya pasó.' });
  });
  it('publicar ahora y la tarea no comprueban la hora', () => {
    expect(validar(cuatro, { ...sinFecha, hora: 'inmediata' })).toEqual([]);
    expect(validar(cuatro, { ...pasada, hora: 'sin_comprobar' })).toEqual([]);
  });
  it('incluye los problemas de jerarquía como errores', () => {
    expect(validar(cuatro, { publicacion: { parentId: 'p1' } })).toContainEqual({ nivel: 'error', mensaje: 'El video principal elegido ya no existe.' });
  });
});

it('mensajeProblemas resume los errores', () => {
  const e = (mensaje: string) => ({ nivel: 'error' as const, mensaje });
  expect(mensajeProblemas([e('Elige un archivo.')])).toBe('Elige un archivo.');
  expect(mensajeProblemas([e('A.'), { nivel: 'advertencia', mensaje: 'W.' }, e('B.'), e('C.')])).toBe('A. (y 2 más)');
});
