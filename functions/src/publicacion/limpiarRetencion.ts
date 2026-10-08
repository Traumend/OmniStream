import { calcularPurga, leerAjustes, leerDestino, type UsoDeArchivo } from '@omnistream/core';
import { FieldValue, getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { logger } from 'firebase-functions';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { REGION } from '../config';

type Bucket = ReturnType<ReturnType<typeof getStorage>['bucket']>;

const aFecha = (valor: unknown): Date | undefined =>
  typeof (valor as { toDate?: unknown } | undefined)?.toDate === 'function'
    ? (valor as { toDate(): Date }).toDate()
    : valor instanceof Date
      ? valor
      : undefined;

// Spec 7.7: el original y sus derivados se purgan; los fotogramas y los metadatos se conservan.
export async function limpiarRetencionAhora(deps: {
  db: Firestore;
  bucket: Bucket;
  ahora: Date;
}): Promise<{ purgados: string[] }> {
  const { db, bucket, ahora } = deps;
  const { retentionDays } = leerAjustes((await db.doc('settings/app').get()).data());
  const archivos = await db.collection('assets').where('status', 'in', ['listo', 'fallido']).get();
  const purgados: string[] = [];

  for (const archivo of archivos.docs) {
    try {
      const datos = archivo.data();
      const publicaciones = await db.collection('posts').where('assetId', '==', archivo.id).get();
      const usos: UsoDeArchivo[] = [];
      for (const publicacion of publicaciones.docs) {
        const destinos = await publicacion.ref.collection('targets').get();
        // Una publicación sin destinos es un borrador que todavía usa el archivo.
        if (destinos.empty) usos.push({ status: 'borrador', statusChangedAt: ahora });
        for (const documento of destinos.docs) {
          const destino = leerDestino(documento.data());
          usos.push({ status: destino.status, statusChangedAt: destino.statusChangedAt });
        }
      }

      const purgeAt = calcularPurga({
        createdAt: aFecha(datos.createdAt) ?? ahora,
        usos,
        retentionDays,
        retainUntil: aFecha(datos.retainUntil),
        ahora,
      });
      const anterior = aFecha(datos.purgeAt);

      if (!purgeAt) {
        if (anterior) await archivo.ref.update({ purgeAt: FieldValue.delete() });
      } else if (purgeAt.getTime() <= ahora.getTime()) {
        await bucket.file(`originales/${archivo.id}`).delete({ ignoreNotFound: true });
        for (const publicacion of publicaciones.docs) {
          await bucket.deleteFiles({ prefix: `derivados/${publicacion.id}/` });
        }
        await archivo.ref.update({ status: 'purgado', purgeAt });
        purgados.push(archivo.id);
      } else if (anterior?.getTime() !== purgeAt.getTime()) {
        await archivo.ref.update({ purgeAt });
      }
    } catch (error) {
      logger.error('No se pudo revisar la retención del archivo', { assetId: archivo.id, error: String(error) });
    }
  }

  if (purgados.length > 0) logger.info('Archivos purgados', { purgados });
  return { purgados };
}

export const limpiarRetencion = onSchedule(
  { schedule: 'every day 04:00', timeZone: 'UTC', region: REGION, memory: '512MiB', timeoutSeconds: 540 },
  async () => {
    await limpiarRetencionAhora({ db: getFirestore(), bucket: getStorage().bucket(), ahora: new Date() });
  },
);
