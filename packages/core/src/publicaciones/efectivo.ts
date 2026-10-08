import { contenidoFinal, textoReferencia } from './texto';
import type { CamposTiktok, CamposYoutube, Destino, FormatoDestino, Platform, Publicacion } from './tipos';

// Lo que un conector necesita para publicar un destino: textos finales y campos propios de la red.
export interface DestinoEfectivo {
  platform: Platform;
  format: FormatoDestino;
  titulo: string;
  texto: string;
  etiquetas: string[];
  youtube?: CamposYoutube;
  tiktok?: CamposTiktok;
  duracionSeg?: number;
}

export function destinoEfectivo(
  publicacion: Pick<Publicacion, 'title' | 'base'>,
  destino: Pick<Destino, 'platform' | 'format' | 'overrides' | 'youtube' | 'tiktok'>,
  opciones: { principal?: { title: string; url?: string }; duracionSeg?: number } = {},
): DestinoEfectivo {
  const referencia =
    destino.platform === 'tiktok' && opciones.principal
      ? textoReferencia(opciones.principal.title, opciones.principal.url)
      : undefined;
  const contenido = contenidoFinal(publicacion, destino, referencia);
  const efectivo: DestinoEfectivo = {
    platform: destino.platform,
    format: destino.format,
    titulo: contenido.titulo ?? destino.overrides.title ?? publicacion.title,
    texto: contenido.texto,
    etiquetas: contenido.etiquetas ?? [],
  };
  if (destino.youtube) efectivo.youtube = destino.youtube;
  if (destino.tiktok) efectivo.tiktok = destino.tiktok;
  if (opciones.duracionSeg !== undefined) efectivo.duracionSeg = opciones.duracionSeg;
  return efectivo;
}
