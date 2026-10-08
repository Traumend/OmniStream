'use client';

import {
  leerDestino,
  leerIntento,
  leerPublicacion,
  PLATAFORMAS,
  type Destino,
  type Intento,
  type Platform,
  type Publicacion,
} from '@omnistream/core';
import {
  collection,
  collectionGroup,
  doc,
  onSnapshot,
  orderBy,
  query,
  where,
  type QueryDocumentSnapshot,
  type QuerySnapshot,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { obtenerFirebase } from '@/lib/firebase/cliente';

const db = () => obtenerFirebase().db;
const aPublicaciones = (resultado: QuerySnapshot) => resultado.docs.map((d) => leerPublicacion(d.id, d.data()));
const ordenRed = (d: Destino) => PLATAFORMAS.indexOf(d.platform);
const ESTADOS_PRINCIPAL_ELEGIBLE = new Set(['programada', 'publicando', 'publicada', 'parcial']);

export interface EstadoPublicacion {
  publicacion: Publicacion | null;
  destinos: Destino[];
  cargando: boolean;
}

export function usePublicacion(id: string | null): EstadoPublicacion {
  const [estado, setEstado] = useState<EstadoPublicacion>({ publicacion: null, destinos: [], cargando: true });
  useEffect(() => {
    if (!id) return;
    let publicacion: Publicacion | null = null;
    let destinos: Destino[] = [];
    let postLeido = false;
    let destinosLeidos = false;
    const actualizar = () => setEstado({ publicacion, destinos, cargando: !(postLeido && destinosLeidos) });
    const cancelarPost = onSnapshot(
      doc(db(), 'posts', id),
      (documento) => {
        publicacion = documento.exists() ? leerPublicacion(documento.id, documento.data()) : null;
        postLeido = true;
        actualizar();
      },
      () => {
        postLeido = true;
        actualizar();
      },
    );
    const cancelarDestinos = onSnapshot(
      collection(db(), 'posts', id, 'targets'),
      (resultado) => {
        destinos = resultado.docs.map((d) => leerDestino(d.data())).sort((a, b) => ordenRed(a) - ordenRed(b));
        destinosLeidos = true;
        actualizar();
      },
      () => {
        destinosLeidos = true;
        actualizar();
      },
    );
    return () => {
      cancelarPost();
      cancelarDestinos();
    };
  }, [id]);
  return estado;
}

export function usePublicacionesEnRango(desde: Date | null, hasta: Date | null): Publicacion[] {
  const [publicaciones, setPublicaciones] = useState<Publicacion[]>([]);
  const desdeMs = desde?.getTime() ?? null;
  const hastaMs = hasta?.getTime() ?? null;
  useEffect(() => {
    if (desdeMs === null || hastaMs === null) return;
    const consulta = query(
      collection(db(), 'posts'),
      where('scheduledAt', '>=', new Date(desdeMs)),
      where('scheduledAt', '<', new Date(hastaMs)),
      orderBy('scheduledAt'),
    );
    return onSnapshot(consulta, (resultado) => setPublicaciones(aPublicaciones(resultado)));
  }, [desdeMs, hastaMs]);
  return publicaciones;
}

export function useBorradoresSinFecha(): Publicacion[] {
  const [publicaciones, setPublicaciones] = useState<Publicacion[]>([]);
  useEffect(
    () =>
      onSnapshot(query(collection(db(), 'posts'), where('scheduledAt', '==', null)), (resultado) =>
        setPublicaciones(aPublicaciones(resultado).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())),
      ),
    [],
  );
  return publicaciones;
}

export function usePrincipales(): { publicacion: Publicacion; hijas: number }[] {
  const [principales, setPrincipales] = useState<Publicacion[]>([]);
  const [hijasPorPrincipal, setHijasPorPrincipal] = useState<Map<string, number>>(new Map());
  useEffect(() => {
    const posts = collection(db(), 'posts');
    const cancelarPrincipales = onSnapshot(query(posts, where('kind', '==', 'principal')), (resultado) =>
      setPrincipales(aPublicaciones(resultado).filter((p) => ESTADOS_PRINCIPAL_ELEGIBLE.has(p.status))),
    );
    const cancelarHijas = onSnapshot(query(posts, where('kind', '==', 'hija')), (resultado) => {
      const conteo = new Map<string, number>();
      for (const hija of aPublicaciones(resultado)) {
        if (hija.parentId) conteo.set(hija.parentId, (conteo.get(hija.parentId) ?? 0) + 1);
      }
      setHijasPorPrincipal(conteo);
    });
    return () => {
      cancelarPrincipales();
      cancelarHijas();
    };
  }, []);
  return principales.map((publicacion) => ({ publicacion, hijas: hijasPorPrincipal.get(publicacion.id) ?? 0 }));
}

export function useHijas(postId: string | null): Publicacion[] {
  const [hijas, setHijas] = useState<Publicacion[]>([]);
  useEffect(() => {
    if (!postId) return;
    return onSnapshot(query(collection(db(), 'posts'), where('parentId', '==', postId)), (resultado) =>
      setHijas(aPublicaciones(resultado)),
    );
  }, [postId]);
  return hijas;
}

export function useIntentos(postId: string, red: Platform): Intento[] {
  const [intentos, setIntentos] = useState<Intento[]>([]);
  useEffect(
    () =>
      onSnapshot(
        query(collection(db(), 'posts', postId, 'targets', red, 'attempts'), orderBy('at', 'desc')),
        (resultado) => setIntentos(resultado.docs.map((d) => leerIntento(d.id, d.data()))),
      ),
    [postId, red],
  );
  return intentos;
}

export interface ItemPendiente {
  postId: string;
  destino: Destino;
}

const aPendientes = (documentos: QueryDocumentSnapshot[]): ItemPendiente[] =>
  documentos.flatMap((d) => {
    const postId = d.ref.parent.parent?.id;
    return postId ? [{ postId, destino: leerDestino(d.data()) }] : [];
  });

export function usePendientes(): { manuales: ItemPendiente[]; referencias: ItemPendiente[]; total: number } {
  const [manuales, setManuales] = useState<ItemPendiente[]>([]);
  const [referencias, setReferencias] = useState<ItemPendiente[]>([]);
  useEffect(() => {
    const destinos = collectionGroup(db(), 'targets');
    const cancelarManuales = onSnapshot(
      query(destinos, where('status', '==', 'pendiente_manual'), orderBy('scheduledAt')),
      (resultado) => setManuales(aPendientes(resultado.docs)),
    );
    const cancelarReferencias = onSnapshot(
      query(destinos, where('parentRef.status', '==', 'pendiente'), orderBy('scheduledAt')),
      (resultado) => setReferencias(aPendientes(resultado.docs)),
    );
    return () => {
      cancelarManuales();
      cancelarReferencias();
    };
  }, []);
  return { manuales, referencias, total: manuales.length + referencias.length };
}
