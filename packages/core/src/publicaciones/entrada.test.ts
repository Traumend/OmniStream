import { expect, it } from 'vitest';
import { accionPublicacionSchema, entradaPublicacionSchema } from './entrada';
import { CAMPOS_TIKTOK_POR_DEFECTO } from './tipos';

const minima = {
  title: 'Hola',
  assetId: null,
  base: { text: '', hashtags: [] },
  scheduledAt: null,
  parentId: null,
  destinos: [],
};
const mensaje = (r: { success: boolean; error?: { issues: { message: string }[] } }) => r.error?.issues[0]?.message;

it('acepta una entrada mínima', () => {
  expect(entradaPublicacionSchema.safeParse(minima).success).toBe(true);
});
it('rechaza título vacío', () => {
  expect(mensaje(entradaPublicacionSchema.safeParse({ ...minima, title: '  ' }))).toBe('Escribe un título');
});
it('rechaza redes repetidas', () => {
  const destinos = [
    { platform: 'tiktok', format: 'tiktok' },
    { platform: 'tiktok', format: 'imagen' },
  ];
  expect(mensaje(entradaPublicacionSchema.safeParse({ ...minima, destinos }))).toBe(
    'Cada red puede aparecer una sola vez.',
  );
});
it('rechaza un formato que la red no admite', () => {
  const destinos = [{ platform: 'youtube', format: 'imagen' }];
  expect(mensaje(entradaPublicacionSchema.safeParse({ ...minima, destinos }))).toBe(
    'YouTube no admite el formato Imagen.',
  );
});
it('exige fechas ISO en UTC', () => {
  expect(entradaPublicacionSchema.safeParse({ ...minima, scheduledAt: '2026-10-08 10:00' }).success).toBe(false);
  expect(entradaPublicacionSchema.safeParse({ ...minima, scheduledAt: '2026-10-08T16:30:00.000Z' }).success).toBe(true);
});
it('valida cada acción', () => {
  expect(accionPublicacionSchema.safeParse({ accion: 'mover', postId: 'p', scheduledAt: 'mañana' }).success).toBe(
    false,
  );
  expect(
    mensaje(
      accionPublicacionSchema.safeParse({ accion: 'marcarPublicada', postId: 'p', platform: 'tiktok', url: ' ' }),
    ),
  ).toBe('Pega la URL de la publicación.');
  expect(accionPublicacionSchema.safeParse({ accion: 'borrarTodo' }).success).toBe(false);
  expect(accionPublicacionSchema.safeParse({ accion: 'programar', postId: 'p', inmediata: true }).success).toBe(true);
});

it('acepta los campos de TikTok y rechaza una privacidad inválida', () => {
  const tiktok = (privacy: string) => ({
    ...minima,
    destinos: [
      {
        platform: 'tiktok',
        format: 'tiktok',
        tiktok: { ...CAMPOS_TIKTOK_POR_DEFECTO, privacy },
      },
    ],
  });
  expect(entradaPublicacionSchema.safeParse(tiktok('SELF_ONLY')).success).toBe(true);
  expect(entradaPublicacionSchema.safeParse(tiktok('PRIVADO')).success).toBe(false);
});

it('acepta importarYoutube y actualizarPromocion, y rechaza un tipo desconocido', () => {
  expect(
    accionPublicacionSchema.safeParse({ accion: 'importarYoutube', url: 'https://youtu.be/dQw4w9WgXcQ' }).success,
  ).toBe(true);
  expect(accionPublicacionSchema.safeParse({ accion: 'importarYoutube', url: ' ' }).success).toBe(false);
  const item = {
    id: 'i1',
    type: 'short',
    title: 'Short 1',
    offsetDays: 1,
    dueAt: '2026-10-11T15:00:00.000Z',
    dueAtEdited: true,
    status: 'pendiente',
    note: 'Con el clip del minuto 3',
  };
  expect(
    accionPublicacionSchema.safeParse({ accion: 'actualizarPromocion', postId: 'p1', items: [item] }).success,
  ).toBe(true);
  expect(
    accionPublicacionSchema.safeParse({
      accion: 'actualizarPromocion',
      postId: 'p1',
      items: [{ ...item, dueAt: null }],
    }).success,
  ).toBe(true);
  expect(
    accionPublicacionSchema.safeParse({
      accion: 'actualizarPromocion',
      postId: 'p1',
      items: [{ ...item, type: 'anuncio' }],
    }).success,
  ).toBe(false);
});
it('acepta overrides con recorte', () => {
  const destinos = [
    {
      platform: 'tiktok',
      format: 'tiktok',
      overrides: {
        text: 'Propio',
        hashtags: [],
        title: 'T',
        crop: { aspect: '9:16', x: 0.34, y: 0, w: 0.3164, h: 1 },
        scheduledAt: '2026-11-01T10:00:00.000Z',
      },
    },
  ];
  expect(entradaPublicacionSchema.safeParse({ ...minima, destinos }).success).toBe(true);
});
it('rechaza un recorte fuera del cuadro', () => {
  const destinos = [
    { platform: 'tiktok', format: 'tiktok', overrides: { crop: { aspect: '9:16', x: 0.8, y: 0, w: 0.3, h: 1 } } },
  ];
  expect(entradaPublicacionSchema.safeParse({ ...minima, destinos }).success).toBe(false);
});
it('acepta la miniatura propia de YouTube como imagen de la Biblioteca', () => {
  const youtube = {
    description: '',
    tags: [],
    categoryId: '22',
    privacy: 'public',
    madeForKids: false,
    thumbnail: { assetId: 'img1' },
  };
  const destinos = [{ platform: 'youtube', format: 'video_largo', youtube }];
  expect(entradaPublicacionSchema.safeParse({ ...minima, destinos }).success).toBe(true);
});
