import type { Proveedor } from '@omnistream/core';
import type { SesionProveedor } from '@omnistream/platforms';
import { Timestamp, type DocumentReference, type Firestore } from 'firebase-admin/firestore';
import type { Cifrador, SecretoCifrado } from './cifrado';

// Las sesiones de cada proveedor viven cifradas en secrets/{proveedor}; las reglas niegan todo acceso del cliente.
const refSecreto = (db: Firestore, proveedor: Proveedor): DocumentReference => db.collection('secrets').doc(proveedor);

export async function guardarSesion(
  db: Firestore,
  cifrador: Cifrador,
  proveedor: Proveedor,
  sesion: SesionProveedor,
  ahora: Date,
): Promise<void> {
  const secreto = cifrador.cifrar(JSON.stringify(sesion));
  await refSecreto(db, proveedor).set({ ...secreto, updatedAt: Timestamp.fromDate(ahora) });
}

export async function leerSesion(
  db: Firestore,
  cifrador: Cifrador,
  proveedor: Proveedor,
): Promise<SesionProveedor | null> {
  const doc = await refSecreto(db, proveedor).get();
  if (!doc.exists) return null;
  const { ciphertext, iv, authTag, keyVersion } = doc.data() as SecretoCifrado;
  return JSON.parse(cifrador.descifrar({ ciphertext, iv, authTag, keyVersion })) as SesionProveedor;
}

export async function borrarSesion(db: Firestore, proveedor: Proveedor): Promise<void> {
  await refSecreto(db, proveedor).delete();
}
