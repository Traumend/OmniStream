import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  hashRecorte,
  leerDestino,
  leerPublicacion,
  pixelesDeRecorte,
  RESOLUCION_SALIDA,
  type Derivado,
  type Platform,
} from '@omnistream/core';
import { getFirestore, type Firestore, type Transaction } from 'firebase-admin/firestore';
import { getFunctions } from 'firebase-admin/functions';
import { getStorage } from 'firebase-admin/storage';
import { logger } from 'firebase-functions/v2';
import { onTaskDispatched } from 'firebase-functions/v2/tasks';
import { recortarImagen, recortarVideo } from '../archivos/recortar';
import { redactarUrls } from '../archivos/redaccion';
import { urlDeLectura } from '../archivos/urlLectura';
import { REGION } from '../config';
import { leerAsset, refDestino, refPublicacion } from './firestore';

type Bucket = ReturnType<ReturnType<typeof getStorage>['bucket']>;

export interface TareaRecorte {
  postId: string;
  platform: Platform;
  cropHash: string;
}

export type EncoladorRecortes = (tarea: TareaRecorte) => Promise<void>;

// Retraso de la cola: mientras se arrastra el recorte con autoguardado, la mayoría de los pedidos llegan con la
// huella ya vieja y terminan sin hacer nada.
const RETRASO_RECORTE_MS = 60_000;
const MAX_INTENTOS_RECORTE = 3;
// El plazo de cada intento cubre el tiempo máximo de la función; sin él, Cloud Tasks reintenta a los 10 minutos
// mientras el primer intento sigue codificando.
const PLAZO_RECORTE_SEG = 1800;

// Sin id fijo: Cloud Tasks no reutiliza un id durante cerca de una hora, y un recorte que vuelve a un valor
// anterior tiene la misma huella. Los pedidos repetidos son inofensivos porque ejecutarRecorte omite los viejos y
// no regenera un derivado que ya está listo.
export function opcionesEncolarRecorte(ahora: Date): { scheduleTime: Date; dispatchDeadlineSeconds: number } {
  return { scheduleTime: new Date(ahora.getTime() + RETRASO_RECORTE_MS), dispatchDeadlineSeconds: PLAZO_RECORTE_SEG };
}

export function encoladorRecortes(): EncoladorRecortes {
  const cola = getFunctions().taskQueue<TareaRecorte>(`locations/${REGION}/functions/generarRecorte`);
  return async (tarea) => {
    await cola.enqueue(tarea, opcionesEncolarRecorte(new Date()));
  };
}

export const rutaDerivado = (tarea: TareaRecorte, extension: 'mp4' | 'jpg') =>
  `derivados/${tarea.postId}/${tarea.platform}/${tarea.cropHash}.${extension}`;

export interface DependenciasRecorte {
  ultimoIntento: boolean; // un error en el último intento de la cola deja el derivado fallido
}

// Huella vigente del destino según el recorte guardado y el archivo de la publicación.
async function huellaVigente(db: Firestore, tarea: TareaRecorte, tx?: Transaction): Promise<string | undefined> {
  const leer = <T>(ref: FirebaseFirestore.DocumentReference<T>) => (tx ? tx.get(ref) : ref.get());
  const [destino, publicacion] = await Promise.all([
    leer(refDestino(db, tarea.postId, tarea.platform)),
    leer(refPublicacion(db, tarea.postId)),
  ]);
  if (!destino.exists || !publicacion.exists) return undefined;
  const crop = leerDestino(destino.data()).overrides.crop;
  const assetId = leerPublicacion(publicacion.id, publicacion.data()).assetId;
  return crop && assetId ? hashRecorte(assetId, crop) : undefined;
}

// Escribe el derivado solo si la huella de la tarea sigue siendo la vigente.
async function escribirSiVigente(db: Firestore, tarea: TareaRecorte, derivado: Derivado): Promise<boolean> {
  return db.runTransaction(async (tx) => {
    if ((await huellaVigente(db, tarea, tx)) !== tarea.cropHash) return false;
    tx.update(refDestino(db, tarea.postId, tarea.platform), { derivative: derivado });
    return true;
  });
}

export async function ejecutarRecorte(
  db: Firestore,
  bucket: Bucket,
  tarea: TareaRecorte,
  deps: DependenciasRecorte = { ultimoIntento: true },
): Promise<'listo' | 'omitido' | 'fallido'> {
  if ((await huellaVigente(db, tarea)) !== tarea.cropHash) return 'omitido';
  const publicacion = await refPublicacion(db, tarea.postId).get();
  const assetId = leerPublicacion(publicacion.id, publicacion.data()).assetId as string;
  const destino = leerDestino((await refDestino(db, tarea.postId, tarea.platform).get()).data());
  const crop = destino.overrides.crop;
  if (!crop) return 'omitido';
  // Un pedido repetido de un recorte que ya está listo no lo vuelve a generar.
  const actual = destino.derivative;
  if (actual?.status === 'listo' && actual.cropHash === tarea.cropHash && actual.storagePath) {
    const [existe] = await bucket.file(actual.storagePath).exists();
    if (existe) return 'listo';
  }

  const documento = await db.collection('assets').doc(assetId).get();
  const asset = documento.exists ? leerAsset(documento.id, documento.data()) : null;
  if (!asset || asset.status === 'purgado' || !asset.width || !asset.height) {
    const fallido: Derivado = {
      cropHash: tarea.cropHash,
      status: 'fallido',
      error: 'El archivo original ya no está disponible.',
    };
    return (await escribirSiVigente(db, tarea, fallido)) ? 'fallido' : 'omitido';
  }
  if (!(await escribirSiVigente(db, tarea, { cropHash: tarea.cropHash, status: 'generando' }))) return 'omitido';

  const esVideo = asset.kind === 'video';
  const ruta = rutaDerivado(tarea, esVideo ? 'mp4' : 'jpg');
  const salida = RESOLUCION_SALIDA[crop.aspect];
  const opciones = {
    contentType: esVideo ? 'video/mp4' : 'image/jpeg',
    // El token permite que el cliente obtenga la URL de descarga del derivado para el paquete manual.
    metadata: { metadata: { firebaseStorageDownloadTokens: randomUUID() } },
  };
  try {
    if (esVideo) {
      const directorio = await mkdtemp(join(tmpdir(), 'recorte-'));
      try {
        const archivo = join(directorio, 'salida.mp4');
        const { url, cabeceras } = await urlDeLectura(bucket.name, asset.storagePath);
        await recortarVideo({
          url,
          cabeceras,
          px: pixelesDeRecorte(crop, asset.width, asset.height),
          salida,
          destino: archivo,
        });
        await bucket.upload(archivo, { destination: ruta, ...opciones });
      } finally {
        await rm(directorio, { recursive: true, force: true });
      }
    } else {
      const [original] = await bucket.file(asset.storagePath).download();
      await bucket.file(ruta).save(await recortarImagen(original, crop, salida), opciones);
    }
  } catch (error) {
    logger.error('No se pudo generar el recorte', { tarea, error: redactarUrls(String(error)) });
    if (!deps.ultimoIntento) throw error;
    const fallido: Derivado = { cropHash: tarea.cropHash, status: 'fallido', error: 'No se pudo generar el recorte.' };
    return (await escribirSiVigente(db, tarea, fallido)) ? 'fallido' : 'omitido';
  }

  if (!(await escribirSiVigente(db, tarea, { cropHash: tarea.cropHash, storagePath: ruta, status: 'listo' }))) {
    await bucket.file(ruta).delete({ ignoreNotFound: true });
    return 'omitido';
  }
  const [anteriores] = await bucket.getFiles({ prefix: `derivados/${tarea.postId}/${tarea.platform}/` });
  await Promise.all(anteriores.filter((f) => f.name !== ruta).map((f) => f.delete({ ignoreNotFound: true })));
  return 'listo';
}

export const generarRecorte = onTaskDispatched<TareaRecorte>(
  {
    region: REGION,
    memory: '4GiB',
    timeoutSeconds: 1800,
    retryConfig: { maxAttempts: MAX_INTENTOS_RECORTE, minBackoffSeconds: 60 },
    rateLimits: { maxConcurrentDispatches: 2 },
  },
  async (solicitud) => {
    await ejecutarRecorte(getFirestore(), getStorage().bucket(), solicitud.data, {
      ultimoIntento: solicitud.retryCount >= MAX_INTENTOS_RECORTE - 1,
    });
  },
);
