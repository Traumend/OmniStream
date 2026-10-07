import { describe, expect, it } from 'vitest';
import { problemasDeJerarquia, tipoDePublicacion } from './jerarquia';

const largo = { platform: 'youtube', format: 'video_largo' } as const;
const corto = { platform: 'instagram', format: 'reel' } as const;
const principal = { id: 'p1', kind: 'principal' } as const;

it('tipoDePublicacion', () => {
  expect(tipoDePublicacion([largo, corto])).toBe('principal');
  expect(tipoDePublicacion([corto], 'p1')).toBe('hija');
  expect(tipoDePublicacion([corto])).toBe('independiente');
  expect(tipoDePublicacion([largo], 'p1')).toBe('principal');
});

describe('problemasDeJerarquia', () => {
  it('sin problemas para una Hija válida', () => {
    expect(problemasDeJerarquia({ destinos: [corto], parentId: 'p1', principal, numeroDeHijas: 0 })).toEqual([]);
  });
  it.each([
    [{ destinos: [largo], parentId: 'p1', principal, numeroDeHijas: 0 }, 'Un video principal no puede pertenecer a otro.'],
    [{ destinos: [corto], parentId: 'p1', principal: null, numeroDeHijas: 0 }, 'El video principal elegido ya no existe.'],
    [{ destinos: [corto], parentId: 'p1', principal: { id: 'p1', kind: 'independiente' }, numeroDeHijas: 0 }, 'La publicación elegida no es un video principal.'],
    [{ destinos: [{ platform: 'facebook', format: 'video_largo' }], parentId: 'p1', principal, numeroDeHijas: 0 }, 'Una Hija solo puede tener videos cortos o imágenes.'],
    [{ destinos: [corto], tipoActual: 'principal', principal: null, numeroDeHijas: 2 }, 'Esta publicación tiene Hijas. Desvincúlalas antes de quitarle el video largo de YouTube.'],
  ] as const)('%#', (contexto, mensaje) => {
    expect(problemasDeJerarquia(contexto)).toContain(mensaje);
  });
});
