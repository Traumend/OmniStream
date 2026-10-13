import type { AccionConexion, RespuestaConexiones } from '@omnistream/core';
import { httpsCallable } from 'firebase/functions';
import { obtenerFirebase } from '@/lib/firebase/cliente';
import { mensajeDeError } from '@/lib/publicaciones/acciones';

// Los errores se convierten al mensaje para el usuario, como en las publicaciones.
export async function ejecutarAccionConexion(accion: AccionConexion): Promise<RespuestaConexiones> {
  const llamar = httpsCallable<AccionConexion, RespuestaConexiones>(obtenerFirebase().functions, 'conexiones');
  try {
    return (await llamar(accion)).data;
  } catch (error) {
    throw new Error(mensajeDeError(error));
  }
}
