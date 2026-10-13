import { HttpsError } from 'firebase-functions/v2/https';

export function exigirPropietario(auth: { token?: Record<string, unknown> } | undefined): void {
  if (!auth) throw new HttpsError('unauthenticated', 'Inicia sesión para continuar.');
  if (auth.token?.owner !== true)
    throw new HttpsError('permission-denied', 'Esta cuenta no tiene acceso a OmniStream.');
}
