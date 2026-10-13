import { expect, it } from 'vitest';
import { zonasSeguras } from './zonasSeguras';

it('TikTok video tiene 3 zonas dentro de 0..100', () => {
  const zonas = zonasSeguras('tiktok', 'tiktok');
  expect(zonas).toHaveLength(3);
  for (const z of zonas) {
    expect(z.x).toBeGreaterThanOrEqual(0);
    expect(z.y).toBeGreaterThanOrEqual(0);
    expect(z.x + z.w).toBeLessThanOrEqual(100);
    expect(z.y + z.h).toBeLessThanOrEqual(100);
  }
});
it('YouTube video largo no tiene zonas', () => {
  expect(zonasSeguras('youtube', 'video_largo')).toEqual([]);
});
it('el Reel de Facebook usa las zonas del Reel de Instagram', () => {
  expect(zonasSeguras('facebook', 'reel')).toEqual(zonasSeguras('instagram', 'reel'));
  expect(zonasSeguras('youtube', 'short')).toHaveLength(3);
});
