import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { EstadoAsset } from '@omnistream/core';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { onObjectFinalized } from 'firebase-functions/v2/storage';
import { REGION } from '../config';
import { convertirHeicAJpeg, extraerFotograma, probar, procesarImagen } from './medios';
import { procesarObjeto, type DependenciasProcesamiento } from './procesarObjeto';
import { urlDeLectura } from './urlLectura';

function crearDependencias(nombreBucket: string): DependenciasProcesamiento {
  const bucket = getStorage().bucket(nombreBucket);
  const assets = getFirestore().collection('assets');
  return {
    async leerAsset(id) {
      const instantanea = await assets.doc(id).get();
      return instantanea.exists ? (instantanea.data() as { status: EstadoAsset }) : null;
    },
    async actualizarAsset(id, datos) {
      await assets.doc(id).update(datos);
    },
    async descargar(ruta) {
      const [contenido] = await bucket.file(ruta).download();
      return contenido;
    },
    async subir(ruta, datos, contentType, metadata = {}) {
      // El token permite que el cliente obtenga la URL de descarga de los fotogramas.
      const token = ruta.startsWith('fotogramas/') ? { firebaseStorageDownloadTokens: randomUUID() } : {};
      await bucket.file(ruta).save(datos, { contentType, metadata: { metadata: { ...metadata, ...token } } });
    },
    urlDeLectura: (ruta) => urlDeLectura(nombreBucket, ruta),
    leerArchivo: (ruta) => readFile(ruta),
    probar,
    extraerFotograma,
    procesarImagen,
    convertirHeicAJpeg,
    async directorioTemporal() {
      const ruta = await mkdtemp(join(tmpdir(), 'procesar-'));
      return { ruta, limpiar: () => rm(ruta, { recursive: true, force: true }) };
    },
  };
}

export const procesarArchivo = onObjectFinalized({ region: REGION, memory: '2GiB', timeoutSeconds: 540 }, (event) =>
  procesarObjeto(event.data, crearDependencias(event.data.bucket)),
);
