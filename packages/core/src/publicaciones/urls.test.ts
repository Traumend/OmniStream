import { expect, it } from 'vitest';
import { analizarUrlPublica } from './urls';

it.each([
  ['youtube', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
  ['youtube', ' https://YouTu.be/dQw4w9WgXcQ?si=x ', 'dQw4w9WgXcQ'],
  ['youtube', 'https://youtube.com/shorts/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
  ['youtube', 'https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=3', 'dQw4w9WgXcQ'],
  ['instagram', 'https://www.instagram.com/reel/C1a2B3c4D5e/', 'C1a2B3c4D5e'],
  ['instagram', 'https://www.instagram.com/p/C1a2B3c4D5e/?igsh=x', 'C1a2B3c4D5e'],
  ['instagram', 'https://www.instagram.com/cuenta/reel/C1a2B3c4D5e/', 'C1a2B3c4D5e'],
  ['facebook', 'https://www.facebook.com/mipagina/posts/pfbid0abc', 'pfbid0abc'],
  ['facebook', 'https://www.facebook.com/reel/123456789', '123456789'],
  ['facebook', 'https://www.facebook.com/watch/?v=123', '123'],
  ['facebook', 'https://www.facebook.com/photo/?fbid=456', '456'],
  ['facebook', 'https://www.facebook.com/mipagina/videos/789/', '789'],
  ['facebook', 'https://fb.watch/abcDEF/', 'abcDEF'],
  ['facebook', 'https://www.facebook.com/share/r/1AbC/', '1AbC'],
  ['tiktok', 'https://www.tiktok.com/@cuenta/video/7300000000000000001', '7300000000000000001'],
  ['tiktok', 'https://www.tiktok.com/@cuenta/photo/7300000000000000002', '7300000000000000002'],
  ['tiktok', 'https://vm.tiktok.com/ZMabc123/', 'ZMabc123'],
  ['tiktok', 'https://www.tiktok.com/t/ZTabc/', 'ZTabc'],
] as const)('%s %s', (red, url, id) => {
  expect(analizarUrlPublica(red, url)).toEqual({ id, url: url.trim() });
});

it.each([
  ['youtube', 'https://www.youtube.com/channel/UC123'],
  ['instagram', 'https://www.instagram.com/cuenta/'],
  ['facebook', 'https://www.facebook.com/mipagina'],
  ['tiktok', 'https://www.tiktok.com/@cuenta'],
  ['instagram', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
  ['tiktok', 'no es una url'],
] as const)('rechaza %s %s', (red, url) => {
  expect(analizarUrlPublica(red, url)).toBeNull();
});
