import { expect, it } from 'vitest';
import { ajustesEfectivos, esPersonalizado, estadoDeRed } from './ajustes';

const publicacion = {
  title: 'Título base',
  base: { text: 'Texto base', hashtags: ['#uno'] },
  scheduledAt: new Date('2026-11-01T10:00:00Z'),
};

it('sin overrides hereda todo de la base', () => {
  expect(ajustesEfectivos(publicacion, { overrides: {} })).toEqual({
    text: 'Texto base',
    hashtags: ['#uno'],
    title: 'Título base',
    scheduledAt: new Date('2026-11-01T10:00:00Z'),
  });
  expect(esPersonalizado({ overrides: {} })).toBe(false);
});

it('cada override reemplaza solo su campo', () => {
  const crop = { aspect: '9:16' as const, x: 0.2, y: 0, w: 0.3, h: 1 };
  const hora = new Date('2026-11-02T08:00:00Z');
  expect(ajustesEfectivos(publicacion, { overrides: { text: 'Propio', crop, scheduledAt: hora } })).toEqual({
    text: 'Propio',
    hashtags: ['#uno'],
    title: 'Título base',
    crop,
    scheduledAt: hora,
  });
  expect(ajustesEfectivos(publicacion, { overrides: { title: 'Otro' } }).title).toBe('Otro');
  expect(esPersonalizado({ overrides: { crop } })).toBe(true);
});

it('un override de hashtags vacío reemplaza los de la base', () => {
  expect(ajustesEfectivos(publicacion, { overrides: { hashtags: [] } }).hashtags).toEqual([]);
  expect(esPersonalizado({ overrides: { hashtags: [] } })).toBe(true);
});

it('estadoDeRed toma el peor problema de esa red o de toda la publicación', () => {
  expect(estadoDeRed([], 'tiktok')).toBe('correcto');
  expect(estadoDeRed([{ nivel: 'advertencia', red: 'tiktok', mensaje: 'a' }], 'tiktok')).toBe('advertencia');
  expect(estadoDeRed([{ nivel: 'error', red: 'facebook', mensaje: 'e' }], 'tiktok')).toBe('correcto');
  expect(
    estadoDeRed(
      [
        { nivel: 'advertencia', red: 'tiktok', mensaje: 'a' },
        { nivel: 'error', mensaje: 'general' },
      ],
      'tiktok',
    ),
  ).toBe('error');
  expect(estadoDeRed([{ nivel: 'advertencia', mensaje: 'general' }], 'youtube')).toBe('advertencia');
});
