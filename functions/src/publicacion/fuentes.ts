import { rutaFotograma, type Asset, type Destino } from '@omnistream/core';
import type { ArchivoFuente } from '@omnistream/platforms';
import type { getStorage } from 'firebase-admin/storage';

type Bucket = ReturnType<ReturnType<typeof getStorage>['bucket']>;
type Archivo = ReturnType<Bucket['file']>;

export interface FuentesPublicacion {
  archivo: ArchivoFuente;
  miniatura?: ArchivoFuente;
  urlMedia?(): Promise<string>;
}

const HORA_MS = 60 * 60 * 1000;

// Un archivo de Storage leído por rangos (subidas por partes) o por un enlace firmado (Meta lo descarga).
export function fuenteDeStorage(archivo: Archivo, meta: { size: number; mimeType: string }): ArchivoFuente {
  return {
    size: meta.size,
    mimeType: meta.mimeType,
    async urlFirmada() {
      const [url] = await archivo.getSignedUrl({ version: 'v4', action: 'read', expires: Date.now() + HORA_MS });
      return url;
    },
    async leerRango(inicio, finInclusivo) {
      const [contenido] = await archivo.download({ start: inicio, end: finInclusivo });
      return new Uint8Array(contenido);
    },
  };
}

// El original del archivo y, en YouTube, el fotograma elegido como miniatura (su tamaño se lee de Storage).
export async function fuentesDePublicacion(
  bucket: Bucket,
  asset: Asset,
  destino: Pick<Destino, 'youtube'>,
  urlMedia?: (ruta: string) => string,
): Promise<FuentesPublicacion> {
  const fuentes: FuentesPublicacion = {
    archivo: fuenteDeStorage(bucket.file(asset.storagePath), { size: asset.sizeBytes, mimeType: asset.mimeType }),
  };
  const fotograma = destino.youtube?.thumbnail?.frame;
  if (fotograma) {
    const archivo = bucket.file(rutaFotograma(asset.id, fotograma));
    const [existe] = await archivo.exists();
    if (existe) {
      const [meta] = await archivo.getMetadata();
      fuentes.miniatura = fuenteDeStorage(archivo, { size: Number(meta.size), mimeType: 'image/jpeg' });
    }
  }
  if (urlMedia) fuentes.urlMedia = async () => urlMedia(asset.storagePath);
  return fuentes;
}
