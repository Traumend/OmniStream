// YouTube exige partes múltiplos de 256 KiB (salvo la última).
export const TAMANO_PARTE_YOUTUBE = 64 * 1024 * 1024;

// TikTok: partes de 5 MB a 64 MB, la última hasta 128 MB, como máximo 1000; hasta 64 MB va en una sola.
const UNA_SOLA_PARTE_HASTA = 64_000_000;
const PARTE_TIKTOK = 32 * 1024 * 1024;

export function particionTiktok(size: number): { chunkSize: number; total: number } {
  if (size <= UNA_SOLA_PARTE_HASTA) return { chunkSize: size, total: 1 };
  return { chunkSize: PARTE_TIKTOK, total: Math.floor(size / PARTE_TIKTOK) };
}

export function rangoDeParte(
  indice: number,
  size: number,
  p: { chunkSize: number; total: number },
): { inicio: number; fin: number } {
  const inicio = indice * p.chunkSize;
  const fin = indice === p.total - 1 ? size - 1 : inicio + p.chunkSize - 1;
  return { inicio, fin };
}
