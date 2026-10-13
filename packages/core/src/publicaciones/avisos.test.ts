import { expect, it } from 'vitest';
import { avisoConexion, avisoDe, avisoPromocion } from './avisos';

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

it('aviso de conexión vencida', () => {
  expect(avisoConexion('youtube')).toEqual({
    tipo: 'conexion',
    titulo: 'Reconecta YouTube',
    cuerpo: 'El acceso venció. Vuelve a conectarla para publicar por API.',
    enlace: '/ajustes/conexiones',
  });
});

it('aviso de promoción pendiente', () => {
  expect(avisoPromocion({ postId: 'p1', tituloPrincipal: 'Mi video', item: { title: 'Short 1' } })).toEqual({
    tipo: 'promocion',
    titulo: 'Promoción pendiente',
    cuerpo: 'Short 1 · Mi video',
    enlace: '/publicaciones/p1',
  });
});
