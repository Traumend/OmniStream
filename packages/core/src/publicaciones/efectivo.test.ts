import { expect, it } from 'vitest';
import { destinoEfectivo } from './efectivo';
import { CAMPOS_YOUTUBE_POR_DEFECTO } from './tipos';

const publicacion = { title: 'Mi video', base: { text: 'Hola', hashtags: ['uno'] } };

it('YouTube usa el título propio, la descripción compuesta y sus etiquetas', () => {
  const e = destinoEfectivo(publicacion, {
    platform: 'youtube',
    format: 'video_largo',
    overrides: { title: 'Título propio' },
    youtube: { ...CAMPOS_YOUTUBE_POR_DEFECTO, description: 'Descripción', tags: ['a', 'b'] },
  });
  expect(e).toMatchObject({
    platform: 'youtube',
    format: 'video_largo',
    titulo: 'Título propio',
    texto: 'Descripción\n\n#uno',
    etiquetas: ['a', 'b'],
  });
});

it('una Hija en TikTok lleva la referencia al Principal al final', () => {
  const e = destinoEfectivo(
    publicacion,
    { platform: 'tiktok', format: 'tiktok', overrides: {} },
    { principal: { title: 'Video largo', url: 'https://youtu.be/abcdefghijk' } },
  );
  expect(e.texto.endsWith('Video completo en YouTube: «Video largo» https://youtu.be/abcdefghijk')).toBe(true);
});

it('Instagram usa el título de la publicación, sin etiquetas, y conserva la duración', () => {
  const e = destinoEfectivo(publicacion, { platform: 'instagram', format: 'reel', overrides: {} }, { duracionSeg: 42 });
  expect(e).toMatchObject({ titulo: 'Mi video', etiquetas: [], duracionSeg: 42 });
});
