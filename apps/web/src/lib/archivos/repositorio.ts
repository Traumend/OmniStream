'use client';

import { posponerHasta, type Asset, type Fotograma } from '@omnistream/core';
import {
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  type DocumentData,
  type FirestoreDataConverter,
} from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref } from 'firebase/storage';
import { useEffect, useState } from 'react';
import { obtenerFirebase } from '@/lib/firebase/cliente';

const convertidor: FirestoreDataConverter<Asset> = {
  toFirestore: (asset) => asset as unknown as DocumentData,
  fromFirestore: (instantanea, opciones) => {
    const datos = instantanea.data({ ...opciones, serverTimestamps: 'estimate' });
    return {
      ...datos,
      id: instantanea.id,
      createdAt: datos.createdAt?.toDate?.() ?? new Date(),
      purgeAt: datos.purgeAt?.toDate?.(),
      retainUntil: datos.retainUntil?.toDate?.(),
    } as Asset;
  },
};

export function useArchivos(): { archivos: Asset[]; cargando: boolean } {
  const [archivos, setArchivos] = useState<Asset[]>([]);
  const [cargando, setCargando] = useState(true);
  useEffect(() => {
    const consulta = query(
      collection(obtenerFirebase().db, 'assets').withConverter(convertidor),
      orderBy('createdAt', 'desc'),
    );
    return onSnapshot(consulta, (resultado) => {
      setArchivos(resultado.docs.map((d) => d.data()));
      setCargando(false);
    });
  }, []);
  return { archivos, cargando };
}

async function eliminarObjeto(ruta: string) {
  try {
    await deleteObject(ref(obtenerFirebase().storage, ruta));
  } catch (error) {
    if ((error as { code?: string }).code !== 'storage/object-not-found') throw error;
  }
}

export class ArchivoEnUso extends Error {
  constructor(readonly usos: number) {
    super(`Este archivo se usa en ${usos === 1 ? '1 publicación' : `${usos} publicaciones`}. Elimínalas primero.`);
  }
}

export async function eliminarArchivo(asset: Asset): Promise<void> {
  const { db } = obtenerFirebase();
  const usos = (await getCountFromServer(query(collection(db, 'posts'), where('assetId', '==', asset.id)))).data()
    .count;
  if (usos > 0) throw new ArchivoEnUso(usos);
  await eliminarObjeto(asset.storagePath);
  for (const ruta of Object.values(asset.frames ?? {})) if (ruta) await eliminarObjeto(ruta);
  await deleteDoc(doc(db, 'assets', asset.id));
}

export async function posponerPurga(asset: Asset, ahora: Date = new Date()): Promise<void> {
  await updateDoc(doc(obtenerFirebase().db, 'assets', asset.id), { retainUntil: posponerHasta(asset, ahora) });
}

export function useUrlsFotogramas(asset: Asset): Partial<Record<Fotograma, string>> {
  const [urls, setUrls] = useState<Partial<Record<Fotograma, string>>>({});
  const clave = JSON.stringify(asset.frames ?? {});
  useEffect(() => {
    const frames = JSON.parse(clave) as Partial<Record<Fotograma, string>>;
    let vigente = true;
    Promise.all(
      Object.entries(frames).map(
        async ([f, ruta]) => [f, await getDownloadURL(ref(obtenerFirebase().storage, ruta))] as const,
      ),
    )
      .then((pares) => vigente && setUrls(Object.fromEntries(pares)))
      .catch(() => vigente && setUrls({}));
    return () => {
      vigente = false;
    };
  }, [clave]);
  return urls;
}
