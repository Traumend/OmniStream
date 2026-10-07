import { describe, expect, it } from 'vitest';
import { CAMPOS_YOUTUBE_POR_DEFECTO } from './tipos';
import { componerTexto, contarCaracteres, contenidoFinal, normalizarHashtags, textoReferencia } from './texto';

describe('normalizarHashtags', () => {
  it('quita #, espacios internos, vacíos y duplicados sin distinguir mayúsculas', () => {
    expect(normalizarHashtags(['#Viaje', 'viaje', ' #mar ', '', 'dos palabras'])).toEqual(['Viaje', 'mar', 'dospalabras']);
  });
  it('acepta texto separado por espacios o comas', () => {
    expect(normalizarHashtags('#uno, dos  #tres')).toEqual(['uno', 'dos', 'tres']);
  });
});

it('componerTexto une texto y hashtags con una línea en blanco', () => {
  expect(componerTexto('Hola', ['a', 'b'])).toBe('Hola\n\n#a #b');
  expect(componerTexto('  ', ['a'])).toBe('#a');
  expect(componerTexto('Hola', [])).toBe('Hola');
});

it('contarCaracteres cuenta puntos de código, no unidades UTF-16', () => {
  expect(contarCaracteres('ñandú 👍')).toBe(7);
});

it('textoReferencia incluye la URL solo si existe', () => {
  expect(textoReferencia('Mi viaje', 'https://youtu.be/abc')).toBe('Video completo en YouTube: «Mi viaje» https://youtu.be/abc');
  expect(textoReferencia('Mi viaje')).toBe('Video completo en YouTube: «Mi viaje»');
});

describe('contenidoFinal', () => {
  const publicacion = { title: 'Mi viaje', base: { text: 'Hola', hashtags: ['mar'] } };
  it('Instagram usa texto y hashtags', () => {
    expect(contenidoFinal(publicacion, { platform: 'instagram', overrides: {} })).toEqual({ texto: 'Hola\n\n#mar' });
  });
  it('TikTok agrega la referencia al final', () => {
    expect(contenidoFinal(publicacion, { platform: 'tiktok', overrides: {} }, 'Video completo en YouTube: «Largo»').texto).toBe(
      'Hola\n\n#mar\n\nVideo completo en YouTube: «Largo»',
    );
  });
  it('YouTube usa su descripción o, si está vacía, el texto base', () => {
    const youtube = { ...CAMPOS_YOUTUBE_POR_DEFECTO, description: 'Desc', tags: ['a'] };
    expect(contenidoFinal(publicacion, { platform: 'youtube', overrides: {}, youtube })).toEqual({
      titulo: 'Mi viaje', texto: 'Desc\n\n#mar', etiquetas: ['a'],
    });
    expect(contenidoFinal(publicacion, { platform: 'youtube', overrides: {}, youtube: CAMPOS_YOUTUBE_POR_DEFECTO }).texto).toBe('Hola\n\n#mar');
  });
  it('los overrides tienen prioridad', () => {
    const r = contenidoFinal(publicacion, { platform: 'youtube', overrides: { title: 'T', text: 'Otro', hashtags: [] }, youtube: CAMPOS_YOUTUBE_POR_DEFECTO });
    expect(r).toMatchObject({ titulo: 'T', texto: 'Otro' });
  });
});
