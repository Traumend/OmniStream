import { expect, it } from 'vitest';
import { estiloRecorte } from './recorteVisual';

it('el estilo escala y desplaza para mostrar solo el recorte', () => {
  expect(estiloRecorte({ aspect: '9:16', x: 0.25, y: 0, w: 0.5, h: 1 })).toEqual({
    width: '200%',
    height: '100%',
    left: '-50%',
    top: '0%',
  });
  expect(estiloRecorte({ aspect: '16:9', x: 0, y: 0.2, w: 1, h: 0.4 })).toEqual({
    width: '100%',
    height: '250%',
    left: '0%',
    top: '-50%',
  });
});
