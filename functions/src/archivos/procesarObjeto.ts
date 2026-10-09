import { join } from 'node:path';
import { rutaFotograma, tiemposDeFotogramas, type EstadoAsset, type Fotograma } from '@omnistream/core';
import { logger } from 'firebase-functions';
import { analizarSalidaFfprobe } from './analizar';
import type { convertirHeicAJpeg, extraerFotograma, probar, procesarImagen } from './medios';

export const MENSAJE_ERROR_LECTURA = 'No se pudo leer el archivo. Puede estar dañado o en un formato no soportado.';

const PREFIJO = 'originales/';

// Quita los parámetros de consulta de las URL (firmas de acceso temporal) antes de escribir en los logs.
const redactarUrls = (texto: string) => texto.replace(/(https?:\/\/[^\s?'"]+)\?[^\s'"]*/g, '$1?[redactado]');
const FOTOGRAMAS: Fotograma[] = ['start', 'middle', 'end'];

export interface DependenciasProcesamiento {
  leerAsset(id: string): Promise<{ status: EstadoAsset } | null>;
  actualizarAsset(id: string, datos: Record<string, unknown>): Promise<void>;
  descargar(ruta: string): Promise<Buffer>;
  subir(ruta: string, datos: Buffer, contentType: string, metadata?: Record<string, string>): Promise<void>;
  urlDeLectura(ruta: string): Promise<{ url: string; cabeceras?: string }>;
  leerArchivo(ruta: string): Promise<Buffer>;
  probar: typeof probar;
  extraerFotograma: typeof extraerFotograma;
  procesarImagen: typeof procesarImagen;
  convertirHeicAJpeg: typeof convertirHeicAJpeg;
  directorioTemporal(): Promise<{ ruta: string; limpiar(): Promise<void> }>;
}

export async function procesarObjeto(
  objeto: { name: string; contentType?: string },
  deps: DependenciasProcesamiento,
): Promise<void> {
  if (!objeto.name.startsWith(PREFIJO)) return;
  const assetId = objeto.name.slice(PREFIJO.length);
  if (!assetId || assetId.includes('/')) return;
  if (!(await deps.leerAsset(assetId))) return;

  await deps.actualizarAsset(assetId, { status: 'procesando' });
  const tipo = (objeto.contentType ?? '').toLowerCase();
  let temporal: { ruta: string; limpiar(): Promise<void> } | undefined;

  try {
    if (tipo === 'image/heic') {
      const jpeg = await deps.convertirHeicAJpeg(await deps.descargar(objeto.name));
      await deps.subir(objeto.name, jpeg, 'image/jpeg', { heicConvertido: '1' });
      await deps.actualizarAsset(assetId, { mimeType: 'image/jpeg' });
      return;
    }

    if (tipo.startsWith('image/')) {
      const { miniatura, ...dimensiones } = await deps.procesarImagen(await deps.descargar(objeto.name));
      const inicio = rutaFotograma(assetId, 'start');
      await deps.subir(inicio, miniatura, 'image/jpeg');
      await deps.actualizarAsset(assetId, { ...dimensiones, frames: { start: inicio }, status: 'listo' });
      return;
    }

    if (!tipo.startsWith('video/')) throw new Error(`Tipo de contenido no soportado: ${tipo}`);

    temporal = await deps.directorioTemporal();
    const directorio = temporal.ruta;
    const { url, cabeceras } = await deps.urlDeLectura(objeto.name);
    const analisis = analizarSalidaFfprobe(await deps.probar(url, cabeceras));
    const tiempos = tiemposDeFotogramas(analisis.durationSec);
    const destinos = FOTOGRAMAS.map((f) => join(directorio, `${f}.jpg`));
    for (const [i, f] of FOTOGRAMAS.entries()) await deps.extraerFotograma(url, tiempos[f], destinos[i]!, cabeceras);

    const frames: Record<Fotograma, string> = { start: '', middle: '', end: '' };
    for (const [i, f] of FOTOGRAMAS.entries()) {
      frames[f] = rutaFotograma(assetId, f);
      await deps.subir(frames[f], await deps.leerArchivo(destinos[i]!), 'image/jpeg');
    }
    await deps.actualizarAsset(assetId, { ...analisis, frames, status: 'listo' });
  } catch (error) {
    logger.error('No se pudo procesar el archivo', { assetId, error: redactarUrls(String(error)) });
    await deps.actualizarAsset(assetId, { status: 'fallido', error: MENSAJE_ERROR_LECTURA });
  } finally {
    await temporal?.limpiar();
  }
}
