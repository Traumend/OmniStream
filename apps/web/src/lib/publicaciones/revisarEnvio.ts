import { formatearDuracion, MENSAJES_JERARQUIA, validarPublicacion, type ContextoValidacion } from '@omnistream/core';

export type Intencion = 'guardar' | 'programar' | 'publicar_ahora';

const MENSAJES_DE_JERARQUIA = new Set<string>(Object.values(MENSAJES_JERARQUIA));

// Validación previa al envío, con las mismas reglas que aplica la función publicaciones.
// duracionMaximaTiktokSeg viene de la cuenta conectada (creator_info) y solo aplica al publicar por API.
export function revisarEnvio(
  contexto: Omit<ContextoValidacion, 'hora'> & { duracionMaximaTiktokSeg?: number },
  intencion: Intencion,
  esProgramada: boolean,
): { errores: string[]; advertencias: string[] } {
  const hora =
    intencion === 'publicar_ahora'
      ? 'inmediata'
      : intencion === 'programar' || esProgramada
        ? 'programada'
        : 'sin_comprobar';
  const problemas = validarPublicacion({ ...contexto, hora });
  let errores = problemas.filter((p) => p.nivel === 'error').map((p) => p.mensaje);
  const maximo = contexto.duracionMaximaTiktokSeg;
  const duracion = contexto.asset?.durationSec;
  const tiktokPorApi =
    contexto.modos?.tiktok === 'api' && contexto.destinos.some((d) => d.platform === 'tiktok' && d.format === 'tiktok');
  if (tiktokPorApi && maximo !== undefined && duracion !== undefined && duracion > maximo) {
    errores.push(`Tu cuenta de TikTok admite videos de hasta ${formatearDuracion(maximo)}.`);
  }
  // Un borrador puede guardarse incompleto; solo la jerarquía debe ser válida.
  if (intencion === 'guardar' && !esProgramada) errores = errores.filter((m) => MENSAJES_DE_JERARQUIA.has(m));
  if (!contexto.publicacion.title.trim()) errores.unshift('Escribe un título');
  return { errores, advertencias: problemas.filter((p) => p.nivel === 'advertencia').map((p) => p.mensaje) };
}
