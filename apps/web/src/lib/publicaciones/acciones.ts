import type { AccionPublicacion, RespuestaPublicaciones } from '@omnistream/core';
import { FirebaseError } from 'firebase/app';
import { httpsCallable } from 'firebase/functions';
import { obtenerFirebase } from '@/lib/firebase/cliente';

export const MENSAJE_ERROR_GENERICO = 'No se pudo completar la acción. Intenta de nuevo.';

// Errores que la función responde con un mensaje pensado para el usuario.
const ESPERADOS = new Set([
  'functions/invalid-argument',
  'functions/failed-precondition',
  'functions/not-found',
  'functions/permission-denied',
  'functions/unauthenticated',
]);

export async function ejecutarAccion(accion: AccionPublicacion): Promise<RespuestaPublicaciones> {
  const llamar = httpsCallable<AccionPublicacion, RespuestaPublicaciones>(obtenerFirebase().functions, 'publicaciones');
  return (await llamar(accion)).data;
}

export function mensajeDeError(error: unknown): string {
  if (error instanceof FirebaseError && ESPERADOS.has(error.code)) {
    // El SDK agrega el estado HTTP al final del mensaje (" [400]").
    return error.message.replace(/ \[\d{3}\]$/, '');
  }
  return MENSAJE_ERROR_GENERICO;
}
