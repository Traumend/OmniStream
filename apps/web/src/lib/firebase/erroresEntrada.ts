export const MENSAJE_SIN_ACCESO = 'Esta cuenta no tiene acceso a OmniStream.';
const MENSAJE_GENERICO = 'No se pudo iniciar sesión. Inténtalo de nuevo.';
const CANCELACIONES = new Set(['auth/popup-closed-by-user', 'auth/cancelled-popup-request']);

export function interpretarErrorEntrada(error: unknown): string | null {
  const { code = '', message = '' } = (typeof error === 'object' && error !== null ? error : {}) as {
    code?: string;
    message?: string;
  };
  if (CANCELACIONES.has(code)) return null;
  if (/BLOCKING_FUNCTION_ERROR_RESPONSE|PERMISSION_DENIED|permission-denied/.test(message)) return MENSAJE_SIN_ACCESO;
  return MENSAJE_GENERICO;
}
