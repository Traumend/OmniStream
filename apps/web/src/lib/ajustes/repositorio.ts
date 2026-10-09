import { leerAjustes, type AjustesApp } from '@omnistream/core';
import { doc, onSnapshot, setDoc, type Unsubscribe } from 'firebase/firestore';
import { obtenerFirebase } from '@/lib/firebase/cliente';

const referencia = () => doc(obtenerFirebase().db, 'settings', 'app');

export function escucharAjustes(cb: (ajustes: AjustesApp, existe: boolean) => void): Unsubscribe {
  return onSnapshot(referencia(), (instantanea) => cb(leerAjustes(instantanea.data()), instantanea.exists()));
}

export async function guardarAjustes(ajustes: AjustesApp): Promise<void> {
  await setDoc(referencia(), ajustes, { merge: true });
}
