import type { Destino, Publicacion } from '@omnistream/core';
import { CAMPOS_TIKTOK_POR_DEFECTO, CAMPOS_YOUTUBE_POR_DEFECTO } from '@omnistream/core';
import { expect, it } from 'vitest';
import { aEntrada, aFormulario, FORMULARIO_VACIO, type FormularioPublicacion } from './formulario';

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
    { platform: 'tiktok', format: 'tiktok', tiktok: CAMPOS_TIKTOK_POR_DEFECTO },
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
    { ...comun, platform: 'tiktok', format: 'tiktok', tiktok: { ...CAMPOS_TIKTOK_POR_DEFECTO, privacy: 'SELF_ONLY' } },
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
    { platform: 'tiktok', format: 'tiktok', tiktok: { ...CAMPOS_TIKTOK_POR_DEFECTO, privacy: 'SELF_ONLY' } },
  ]);
});

it('los campos de TikTok van y vuelven', () => {
  const tiktok = {
    ...CAMPOS_TIKTOK_POR_DEFECTO,
    privacy: 'FOLLOWER_OF_CREATOR' as const,
    allowComments: true,
    commercial: { enabled: true, yourBrand: true, brandedContent: false },
  };
  const entrada = aEntrada({ ...FORMULARIO_VACIO, title: 'x', redes: { tiktok: 'tiktok' }, tiktok }, 'UTC');
  expect(entrada.destinos).toEqual([{ platform: 'tiktok', format: 'tiktok', tiktok }]);
  const publicacion = {
    id: 'p1',
    kind: 'independiente',
    status: 'borrador',
    title: 'x',
    base: { text: '', hashtags: [] },
    scheduledAt: null,
    targetStatus: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Publicacion;
  const destino = { platform: 'tiktok', format: 'tiktok', tiktok } as Destino;
  expect(aFormulario(publicacion, [destino], 'UTC').tiktok).toEqual(tiktok);
  expect(aFormulario(publicacion, [], 'UTC').tiktok).toEqual(CAMPOS_TIKTOK_POR_DEFECTO);
});

it('los overrides van y vuelven, con la hora por red en la zona', () => {
  const crop = { aspect: '9:16', x: 0.34, y: 0, w: 0.3164, h: 1 } as const;
  const form = {
    ...FORMULARIO_VACIO,
    title: 'Base',
    assetId: 'a1',
    redes: { tiktok: 'tiktok', facebook: 'reel' },
    overrides: {
      tiktok: { text: 'Propio', hashtags: '#uno dos', crop, fecha: '2026-10-08', hora: '10:30' },
      facebook: { title: 'Otro título' },
    },
  } satisfies FormularioPublicacion;
  const entrada = aEntrada(form, 'America/Mexico_City');
  expect(entrada.destinos).toEqual([
    { platform: 'facebook', format: 'reel', overrides: { title: 'Otro título' } },
    {
      platform: 'tiktok',
      format: 'tiktok',
      tiktok: CAMPOS_TIKTOK_POR_DEFECTO,
      overrides: {
        text: 'Propio',
        hashtags: ['uno', 'dos'],
        crop,
        scheduledAt: '2026-10-08T16:30:00.000Z',
      },
    },
  ]);

  const publicacion: Publicacion = {
    id: 'p1',
    kind: 'independiente',
    status: 'borrador',
    title: 'Base',
    assetId: 'a1',
    base: { text: '', hashtags: [] },
    scheduledAt: null,
    targetStatus: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const comun = {
    scheduleVersion: 0,
    publishMode: 'manual',
    status: 'borrador',
    statusChangedAt: new Date(),
    parentRef: { status: 'no_aplica' },
    attempts: 0,
  } as const;
  const destinos: Destino[] = [
    { ...comun, platform: 'facebook', format: 'reel', overrides: { title: 'Otro título' } },
    {
      ...comun,
      platform: 'tiktok',
      format: 'tiktok',
      tiktok: CAMPOS_TIKTOK_POR_DEFECTO,
      overrides: {
        text: 'Propio',
        hashtags: ['uno', 'dos'],
        crop,
        scheduledAt: new Date('2026-10-08T16:30:00.000Z'),
      },
    },
  ];
  expect(aFormulario(publicacion, destinos, 'America/Mexico_City').overrides).toEqual({
    facebook: { title: 'Otro título' },
    tiktok: { text: 'Propio', hashtags: '#uno #dos', crop, fecha: '2026-10-08', hora: '10:30' },
  });
});
