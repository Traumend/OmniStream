import type { Destino, Publicacion } from '@omnistream/core';
import { CAMPOS_YOUTUBE_POR_DEFECTO } from '@omnistream/core';
import { expect, it } from 'vitest';
import { aEntrada, aFormulario, FORMULARIO_VACIO } from './formulario';

it('aEntrada arma destinos, hashtags, etiquetas de YouTube y la fecha en UTC', () => {
  const entrada = aEntrada(
    {
      ...FORMULARIO_VACIO,
      title: 'Hola',
      assetId: 'a1',
      hashtags: '#uno dos',
      fecha: '2026-10-08',
      hora: '10:30',
      redes: { youtube: 'short', tiktok: 'tiktok' },
      youtube: { ...FORMULARIO_VACIO.youtube, tags: 'viaje, mar ,' },
    },
    'America/Mexico_City',
  );
  expect(entrada).toMatchObject({
    title: 'Hola',
    assetId: 'a1',
    parentId: null,
    scheduledAt: '2026-10-08T16:30:00.000Z',
    base: { text: '', hashtags: ['uno', 'dos'] },
  });
  expect(entrada.destinos).toEqual([
    {
      platform: 'youtube',
      format: 'short',
      youtube: {
        description: '',
        tags: ['viaje', 'mar'],
        categoryId: '22',
        privacy: 'public',
        madeForKids: false,
        thumbnail: { frame: 'start' },
      },
    },
    { platform: 'tiktok', format: 'tiktok' },
  ]);
});

it('sin fecha u hora, scheduledAt es null', () => {
  expect(aEntrada({ ...FORMULARIO_VACIO, title: 'x', fecha: '2026-10-08' }, 'UTC').scheduledAt).toBeNull();
});

it('con video largo de YouTube no conserva el principal elegido', () => {
  const entrada = aEntrada(
    { ...FORMULARIO_VACIO, title: 'x', parentId: 'p1', redes: { youtube: 'video_largo' } },
    'UTC',
  );
  expect(entrada.parentId).toBeNull();
});

it('aFormulario es la inversa de aEntrada', () => {
  const publicacion: Publicacion = {
    id: 'p9',
    kind: 'hija',
    parentId: 'p1',
    status: 'borrador',
    title: 'Mi corto',
    assetId: 'a1',
    base: { text: 'Hola', hashtags: ['uno', 'dos'] },
    scheduledAt: new Date('2026-10-08T16:30:00Z'),
    targetStatus: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const comun = {
    overrides: {},
    scheduleVersion: 0,
    publishMode: 'manual',
    status: 'borrador',
    statusChangedAt: new Date(),
    parentRef: { status: 'en_espera' },
    attempts: 0,
  } as const;
  const destinos: Destino[] = [
    {
      ...comun,
      platform: 'youtube',
      format: 'short',
      youtube: { ...CAMPOS_YOUTUBE_POR_DEFECTO, tags: ['a', 'b'], thumbnail: { frame: 'middle' } },
    },
    { ...comun, platform: 'tiktok', format: 'tiktok' },
  ];
  const entrada = aEntrada(aFormulario(publicacion, destinos, 'America/Mexico_City'), 'America/Mexico_City', 'p9');
  expect(entrada).toMatchObject({
    postId: 'p9',
    title: 'Mi corto',
    assetId: 'a1',
    parentId: 'p1',
    scheduledAt: '2026-10-08T16:30:00.000Z',
    base: { text: 'Hola', hashtags: ['uno', 'dos'] },
  });
  expect(entrada.destinos).toEqual([
    {
      platform: 'youtube',
      format: 'short',
      youtube: { ...CAMPOS_YOUTUBE_POR_DEFECTO, tags: ['a', 'b'], thumbnail: { frame: 'middle' } },
    },
    { platform: 'tiktok', format: 'tiktok' },
  ]);
});
