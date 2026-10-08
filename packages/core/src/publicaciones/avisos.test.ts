import { expect, it } from 'vitest';
import { avisoDe } from './avisos';

it.each([
  [
    'pendiente_manual',
    { titulo: 'Publicación pendiente', cuerpo: 'Mi corto · TikTok', enlace: '/pendientes/p1/tiktok' },
  ],
  [
    'fallo',
    { titulo: 'Falló una publicación', cuerpo: 'Mi corto · TikTok: Sin conector.', enlace: '/publicaciones/p1' },
  ],
  [
    'referencia',
    { titulo: 'Referencia al video principal pendiente', cuerpo: 'Mi corto · TikTok', enlace: '/pendientes' },
  ],
] as const)('%s', (tipo, esperado) => {
  expect(avisoDe(tipo, { postId: 'p1', titulo: 'Mi corto', platform: 'tiktok', error: 'Sin conector.' })).toEqual({
    tipo,
    ...esperado,
  });
});
