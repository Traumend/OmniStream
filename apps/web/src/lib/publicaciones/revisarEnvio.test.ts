import { CAMPOS_TIKTOK_POR_DEFECTO, type Asset, type ContextoValidacion } from '@omnistream/core';
import { expect, it } from 'vitest';
import { revisarEnvio } from './revisarEnvio';

const asset = {
  id: 'a1',
  kind: 'video',
  mimeType: 'video/mp4',
  sizeBytes: 1000,
  width: 1080,
  height: 1920,
  aspect: 0.5625,
  durationSec: 120,
  status: 'listo',
} as Asset;

const contexto = (cambios: Partial<Omit<ContextoValidacion, 'hora'>> = {}) => ({
  publicacion: { title: 'Hola', assetId: 'a1', base: { text: 'Hola', hashtags: [] }, scheduledAt: null },
  destinos: [
    {
      platform: 'tiktok' as const,
      format: 'tiktok' as const,
      overrides: {},
      tiktok: { ...CAMPOS_TIKTOK_POR_DEFECTO, privacy: 'SELF_ONLY' as const },
    },
  ],
  asset,
  principal: null,
  numeroDeHijas: 0,
  ahora: new Date('2026-10-07T12:00:00Z'),
  ...cambios,
});

it('un video más largo que el máximo de la cuenta de TikTok es un error por API', () => {
  const { errores } = revisarEnvio(
    { ...contexto({ modos: { tiktok: 'api' } }), duracionMaximaTiktokSeg: 60 },
    'publicar_ahora',
    false,
  );
  expect(errores).toContain('Tu cuenta de TikTok admite videos de hasta 1:00.');
});

it('en modo manual la duración de la cuenta no aplica', () => {
  const { errores } = revisarEnvio({ ...contexto(), duracionMaximaTiktokSeg: 60 }, 'publicar_ahora', false);
  expect(errores).not.toContain('Tu cuenta de TikTok admite videos de hasta 1:00.');
});

it('los modos llegan a la validación', () => {
  const sinPrivacidad = contexto({ modos: { tiktok: 'api' } });
  sinPrivacidad.destinos[0]!.tiktok = CAMPOS_TIKTOK_POR_DEFECTO as never;
  expect(revisarEnvio(sinPrivacidad, 'publicar_ahora', false).errores).toContain(
    'Elige quién puede ver la publicación en TikTok.',
  );
});
