import type { Asset } from '../archivos/asset';
import { reglaDe } from './reglas';
import type { Destino, FormatoDestino, Platform } from './tipos';

type DestinoSugerido = Pick<Destino, 'platform' | 'format'>;

const CORTOS: [Platform, FormatoDestino][] = [
  ['facebook', 'reel'],
  ['instagram', 'reel'],
  ['youtube', 'short'],
  ['tiktok', 'tiktok'],
];

// Spec 8.2: horizontal → YouTube video largo (Principal); vertical o cuadrado → formatos cortos que admitan la duración.
export function sugerirDestinos(asset: Pick<Asset, 'kind' | 'aspect' | 'durationSec'>): DestinoSugerido[] {
  if (asset.kind === 'image') {
    return [
      { platform: 'facebook', format: 'imagen' },
      { platform: 'instagram', format: 'imagen' },
    ];
  }
  if (asset.kind !== 'video') return [];
  if ((asset.aspect ?? 1) > 1) return [{ platform: 'youtube', format: 'video_largo' }];
  const duracion = asset.durationSec ?? 0;
  return CORTOS.filter(([platform, format]) => {
    const regla = reglaDe(platform, format);
    return (regla.duracionMinSec ?? 0) <= duracion && (regla.duracionMaxSec ?? Infinity) >= duracion;
  }).map(([platform, format]) => ({ platform, format }));
}
