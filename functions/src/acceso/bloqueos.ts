import { evaluarAcceso, MENSAJES_ACCESO } from '@omnistream/core';
import { beforeUserCreated, beforeUserSignedIn, HttpsError } from 'firebase-functions/v2/identity';
import { correoPermitido, REGION } from '../config';

export function verificarUsuario(
  usuario: { email?: string | null; emailVerified?: boolean },
  correo: string,
): { customClaims: { owner: true } } {
  const resultado = evaluarAcceso({ email: usuario.email, emailVerified: usuario.emailVerified ?? false }, correo);
  if (!resultado.permitido) throw new HttpsError('permission-denied', MENSAJES_ACCESO[resultado.motivo]);
  return { customClaims: { owner: true } };
}

export const antesDeCrearUsuario = beforeUserCreated({ region: REGION }, (event) =>
  verificarUsuario(event.data ?? {}, correoPermitido.value()),
);

export const antesDeIniciarSesion = beforeUserSignedIn({ region: REGION }, (event) =>
  verificarUsuario(event.data ?? {}, correoPermitido.value()),
);
