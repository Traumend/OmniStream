import { rutaDePublicacion, type Asset, type Destino } from '@omnistream/core';

export type EstadoDescarga = 'preparando' | 'generando' | 'lista' | 'no_disponible';

// Distingue "aún se carga" de "el archivo falta", para no mostrar un error mientras llega el enlace.
// Con recorte, el paquete descarga el derivado de su red; mientras no esté listo, se está generando.
export function estadoDescarga({
  cargandoArchivos,
  asset,
  destino,
  url,
  error,
}: {
  cargandoArchivos: boolean;
  asset: (Pick<Asset, 'status'> & Partial<Pick<Asset, 'id' | 'storagePath'>>) | undefined;
  destino?: Pick<Destino, 'overrides' | 'derivative'>;
  url?: string;
  error: boolean;
}): EstadoDescarga {
  if (url) return 'lista';
  if (cargandoArchivos) return 'preparando';
  if (!asset || asset.status === 'purgado' || error) return 'no_disponible';
  if (
    destino &&
    asset.id &&
    asset.storagePath &&
    !rutaDePublicacion({ id: asset.id, storagePath: asset.storagePath }, destino)
  )
    return 'generando';
  return 'preparando';
}
