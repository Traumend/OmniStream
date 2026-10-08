export type TipoArchivo = 'video' | 'image';

export const LIMITE_IMAGEN_BYTES = 50 * 1024 ** 2;

const BYTES_POR_GB = 1024 ** 3;

const FORMATOS: Record<string, { tipo: TipoArchivo; mime: string }> = {
  mp4: { tipo: 'video', mime: 'video/mp4' },
  mov: { tipo: 'video', mime: 'video/quicktime' },
  webm: { tipo: 'video', mime: 'video/webm' },
  jpg: { tipo: 'image', mime: 'image/jpeg' },
  jpeg: { tipo: 'image', mime: 'image/jpeg' },
  png: { tipo: 'image', mime: 'image/png' },
  webp: { tipo: 'image', mime: 'image/webp' },
  heic: { tipo: 'image', mime: 'image/heic' },
};

export function detectarTipo(nombre: string, mime: string): { tipo: TipoArchivo; mime: string } | null {
  const punto = nombre.lastIndexOf('.');
  if (punto > 0) {
    const porExtension = FORMATOS[nombre.slice(punto + 1).toLowerCase()];
    return porExtension ? { ...porExtension } : null;
  }
  const porMime = Object.values(FORMATOS).find((f) => f.mime === mime.toLowerCase());
  return porMime ? { ...porMime } : null;
}

export type ErrorArchivo = 'formato_no_soportado' | 'archivo_vacio' | 'excede_limite' | 'imagen_excede_limite';

type ResultadoValidacion =
  { ok: true; tipo: TipoArchivo; mime: string } | { ok: false; error: ErrorArchivo; mensaje: string };

export function validarArchivo(
  archivo: { nombre: string; mime: string; bytes: number },
  maxUploadGb: number,
): ResultadoValidacion {
  const formato = detectarTipo(archivo.nombre, archivo.mime);
  if (!formato) {
    return {
      ok: false,
      error: 'formato_no_soportado',
      mensaje: 'Formato no soportado. Usa mp4, mov, webm, jpg, png, webp o heic.',
    };
  }
  if (archivo.bytes <= 0) return { ok: false, error: 'archivo_vacio', mensaje: 'El archivo está vacío.' };
  if (formato.tipo === 'image' && archivo.bytes > LIMITE_IMAGEN_BYTES) {
    return { ok: false, error: 'imagen_excede_limite', mensaje: 'Las imágenes no pueden superar 50 MB.' };
  }
  if (archivo.bytes > maxUploadGb * BYTES_POR_GB) {
    return { ok: false, error: 'excede_limite', mensaje: `El archivo supera el límite de ${maxUploadGb} GB.` };
  }
  return { ok: true, ...formato };
}
