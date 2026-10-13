import type { MetadatosLocales } from './gestorSubidas';

const ESPERA_MAXIMA_MS = 10_000;

function leerVideo(url: string): Promise<MetadatosLocales> {
  return new Promise((resolver, rechazar) => {
    const video = document.createElement('video');
    const limite = setTimeout(() => rechazar(new Error('Tiempo agotado al leer el video')), ESPERA_MAXIMA_MS);
    video.preload = 'metadata';
    video.muted = true;
    video.onloadedmetadata = () => {
      clearTimeout(limite);
      resolver({
        width: video.videoWidth || undefined,
        height: video.videoHeight || undefined,
        durationSec: Number.isFinite(video.duration) ? video.duration : undefined,
      });
    };
    video.onerror = () => {
      clearTimeout(limite);
      rechazar(new Error('El navegador no puede leer este video'));
    };
    video.src = url;
  });
}

// Lectura preliminar en el navegador; el servidor confirma los datos al procesar el archivo.
export async function leerMetadatosLocales(archivo: File, tipo: 'video' | 'image'): Promise<MetadatosLocales> {
  if (tipo === 'image') {
    const mapa = await createImageBitmap(archivo);
    const resultado = { width: mapa.width, height: mapa.height };
    mapa.close();
    return resultado;
  }
  const url = URL.createObjectURL(archivo);
  try {
    return await leerVideo(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}
