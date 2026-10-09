import type { Asset } from '@omnistream/core';

export type EstadoDescarga = 'preparando' | 'lista' | 'no_disponible';

// Distingue "aún se carga" de "el archivo falta", para no mostrar un error mientras llega el enlace.
export function estadoDescarga({
  cargandoArchivos,
  asset,
  url,
  error,
}: {
  cargandoArchivos: boolean;
  asset: Pick<Asset, 'status'> | undefined;
  url?: string;
  error: boolean;
}): EstadoDescarga {
  if (url) return 'lista';
  if (cargandoArchivos) return 'preparando';
  if (!asset || asset.status === 'purgado' || error) return 'no_disponible';
  return 'preparando';
}
