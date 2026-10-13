export type MotivoRechazo = 'correo_no_permitido' | 'correo_no_verificado' | 'sin_correo';

export type ResultadoAcceso = { permitido: true } | { permitido: false; motivo: MotivoRechazo };

export const MENSAJES_ACCESO: Record<MotivoRechazo, string> = {
  correo_no_permitido: 'Esta cuenta no tiene acceso a OmniStream.',
  correo_no_verificado: 'Verifica tu correo antes de entrar.',
  sin_correo: 'La cuenta no tiene un correo asociado.',
};

const normalizar = (correo: string) => correo.trim().toLowerCase();

export function evaluarAcceso(
  usuario: { email?: string | null; emailVerified: boolean },
  correoPermitido: string,
): ResultadoAcceso {
  if (!usuario.email || !usuario.email.trim()) return { permitido: false, motivo: 'sin_correo' };
  const permitido = normalizar(correoPermitido);
  if (!permitido || normalizar(usuario.email) !== permitido) return { permitido: false, motivo: 'correo_no_permitido' };
  if (!usuario.emailVerified) return { permitido: false, motivo: 'correo_no_verificado' };
  return { permitido: true };
}
