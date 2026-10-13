import { rutaDePublicacion, rutaFotograma, rutaOriginal, type Asset, type Destino } from '@omnistream/core';
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

// El archivo de la red (el original o su derivado recortado) y, en YouTube, la miniatura elegida: un fotograma o
// una imagen de la Biblioteca. Los tamaños de los archivos generados se leen de Storage.
export async function fuentesDePublicacion(
  bucket: Bucket,
  asset: Asset,
  destino: Pick<Destino, 'youtube' | 'overrides' | 'derivative'>,
  urlMedia?: (ruta: string) => string,
): Promise<FuentesPublicacion> {
  const ruta = rutaDePublicacion(asset, destino);
  if (!ruta) throw new Error('El recorte de esta red aún no está listo.');
  const archivo = bucket.file(ruta);
  const meta =
    ruta === asset.storagePath
      ? { size: asset.sizeBytes, mimeType: asset.mimeType }
      : { size: await tamanoDe(archivo), mimeType: asset.kind === 'video' ? 'video/mp4' : 'image/jpeg' };
  const fuentes: FuentesPublicacion = { archivo: fuenteDeStorage(archivo, meta) };

  const miniatura = destino.youtube?.thumbnail;
  // Un fotograma o una imagen ya purgados no impiden publicar: YouTube queda con su miniatura automática.
  const rutaMiniatura = !miniatura
    ? undefined
    : 'frame' in miniatura
      ? rutaFotograma(asset.id, miniatura.frame)
      : rutaOriginal(miniatura.assetId);
  if (rutaMiniatura) {
    const imagen = bucket.file(rutaMiniatura);
    const [existe] = await imagen.exists();
    if (existe) {
      const [datos] = await imagen.getMetadata();
      fuentes.miniatura = fuenteDeStorage(imagen, {
        size: Number(datos.size),
        mimeType: datos.contentType ?? 'image/jpeg',
      });
    }
  }
  if (urlMedia) fuentes.urlMedia = async () => urlMedia(ruta);
  return fuentes;
}

async function tamanoDe(archivo: Archivo): Promise<number> {
  const [datos] = await archivo.getMetadata();
  return Number(datos.size);
}
