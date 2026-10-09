import type { Destino, Publicacion } from './tipos';

export function normalizarHashtags(entrada: string | readonly string[]): string[] {
  const partes = typeof entrada === 'string' ? entrada.split(/[\s,]+/) : entrada;
  const vistos = new Set<string>();
  const resultado: string[] = [];
  for (const parte of partes) {
    const limpio = parte.replace(/#/g, '').replace(/\s+/g, '');
    const clave = limpio.toLocaleLowerCase('es');
    if (!limpio || vistos.has(clave)) continue;
    vistos.add(clave);
    resultado.push(limpio);
  }
  return resultado;
}

export function componerTexto(texto: string, hashtags: readonly string[]): string {
  return [texto.trim(), hashtags.map((h) => `#${h}`).join(' ')].filter(Boolean).join('\n\n');
}

// Las redes cuentan caracteres, no unidades UTF-16: un emoji cuenta como uno.
export const contarCaracteres = (texto: string): number => Array.from(texto).length;

export const urlVideoYoutube = (id: string): string => `https://youtu.be/${id}`;

export function textoReferencia(tituloPrincipal: string, url?: string): string {
  const base = `Video completo en YouTube: «${tituloPrincipal}»`;
  return url ? `${base} ${url}` : base;
}

export interface ContenidoFinal {
  titulo?: string;
  texto: string;
  etiquetas?: string[];
}

export function contenidoFinal(
  publicacion: Pick<Publicacion, 'title' | 'base'>,
  destino: Pick<Destino, 'platform' | 'overrides' | 'youtube'>,
  referencia?: string,
): ContenidoFinal {
  const texto = destino.overrides.text ?? publicacion.base.text;
  const hashtags = destino.overrides.hashtags ?? publicacion.base.hashtags;
  if (destino.platform === 'youtube') {
    const descripcion = destino.youtube?.description.trim() ? destino.youtube.description : texto;
    return {
      titulo: destino.overrides.title ?? publicacion.title,
      texto: componerTexto(descripcion, hashtags),
      etiquetas: destino.youtube?.tags ?? [],
    };
  }
  const compuesto = componerTexto(texto, hashtags);
  if (destino.platform === 'tiktok' && referencia)
    return { texto: [compuesto, referencia].filter(Boolean).join('\n\n') };
  return { texto: compuesto };
}
