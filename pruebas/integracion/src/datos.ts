import {
  CAMPOS_YOUTUBE_POR_DEFECTO,
  PERMISO_PUBLICAR,
  destinoNuevo,
  leerDestino,
  type Asset,
  type Destino,
  type EntradaPublicacion,
  type FormatoDestino,
  type Platform,
  type Proveedor,
  type Publicacion,
} from '@omnistream/core';
import { crearCifrador } from '@omnistream/functions/src/conexiones/cifrado';
import { guardarSesion } from '@omnistream/functions/src/conexiones/secretos';
import type { SesionProveedor } from '@omnistream/platforms';
import type { Firestore } from 'firebase-admin/firestore';

export async function crearAssetListo(db: Firestore, cambios: Partial<Asset> = {}): Promise<string> {
  const ref = db.collection('assets').doc();
  await ref.set({
    kind: 'video',
    source: 'subida',
    originalName: 'corto.mp4',
    storagePath: `originales/${ref.id}`,
    mimeType: 'video/mp4',
    sizeBytes: 1_000_000,
    width: 1080,
    height: 1920,
    aspect: 0.5625,
    durationSec: 30,
    status: 'listo',
    createdAt: new Date(),
    ...cambios,
  });
  return ref.id;
}

export async function sembrarPublicacion(
  db: Firestore,
  { publicacion = {}, destinos }: { publicacion?: Partial<Publicacion>; destinos: Partial<Destino>[] },
): Promise<string> {
  const ref = db.collection('posts').doc();
  const ahora = new Date();
  const datos: Partial<Publicacion> = { ...publicacion };
  delete datos.id;
  await ref.set({
    kind: 'independiente',
    status: 'borrador',
    title: 'Prueba',
    base: { text: 'Hola', hashtags: [] },
    scheduledAt: null,
    targetStatus: {},
    createdAt: ahora,
    updatedAt: ahora,
    ...datos,
  });
  for (const destino of destinos) {
    const platform = destino.platform ?? 'tiktok';
    const base = destinoNuevo(platform, destino.format ?? 'tiktok', {
      esHija: false,
      ahora,
      youtube: platform === 'youtube' ? CAMPOS_YOUTUBE_POR_DEFECTO : undefined,
    });
    await ref
      .collection('targets')
      .doc(platform)
      .set({ ...base, ...destino });
  }
  return ref.id;
}

export async function leerDestinoDe(db: Firestore, postId: string, red: Platform): Promise<Destino> {
  return leerDestino((await db.doc(`posts/${postId}/targets/${red}`).get()).data());
}

export function entradaDePrueba(assetId: string, redes: [Platform, FormatoDestino][]): EntradaPublicacion {
  return {
    title: 'Prueba',
    assetId,
    base: { text: 'Hola', hashtags: [] },
    scheduledAt: null,
    parentId: null,
    destinos: redes.map(([platform, format]) =>
      platform === 'youtube' ? { platform, format, youtube: CAMPOS_YOUTUBE_POR_DEFECTO } : { platform, format },
    ),
  };
}

// Conexión por API con el permiso de publicar; los cambios la ajustan.
export async function sembrarConexion(
  db: Firestore,
  red: Platform,
  cambios: Record<string, unknown> = {},
): Promise<void> {
  await db.doc(`connections/${red}`).set({
    platform: red,
    authStatus: 'conectada',
    publishMode: 'api',
    readEnabled: true,
    scopes: [PERMISO_PUBLICAR[red]],
    ...cambios,
  });
}

// La misma llave de demostración que scripts/secretos-demo.cjs entrega al emulador de funciones.
export const CLAVE_DEMO = 'MDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA=';

export async function sembrarSesion(
  db: Firestore,
  proveedor: Proveedor,
  sesion: SesionProveedor = { accessToken: 'token-de-prueba', datos: {} },
): Promise<void> {
  await guardarSesion(db, crearCifrador(CLAVE_DEMO), proveedor, sesion, new Date());
}
