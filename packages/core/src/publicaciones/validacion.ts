import type { Asset } from '../archivos/asset';
import { formatearDuracion } from '../archivos/formato';
import { describirProporcion } from '../archivos/fotogramas';
import { problemasDeJerarquia } from './jerarquia';
import {
  contarBytesUtf8,
  LIMITE_MENCIONES_INSTAGRAM,
  LIMITES_API,
  LIMITES_YOUTUBE,
  largoEtiquetasYoutube,
  proporcionCompatible,
  REGLAS,
} from './reglas';
import { contarCaracteres, contenidoFinal, textoReferencia, urlVideoYoutube } from './texto';
import {
  ETIQUETAS_FORMATO,
  ETIQUETAS_RED,
  type Destino,
  type ModoPublicacion,
  type Platform,
  type Publicacion,
  type TipoPublicacion,
} from './tipos';

export interface Problema {
  nivel: 'error' | 'advertencia';
  red?: Platform;
  mensaje: string;
}

export interface ContextoValidacion {
  publicacion: Pick<Publicacion, 'title' | 'assetId' | 'base' | 'scheduledAt' | 'parentId'>;
  destinos: readonly Pick<Destino, 'platform' | 'format' | 'overrides' | 'youtube' | 'tiktok'>[];
  asset:
    | (Pick<Asset, 'kind' | 'status' | 'width' | 'height' | 'aspect' | 'durationSec'> &
        Partial<Pick<Asset, 'mimeType' | 'sizeBytes'>>)
    | null;
  principal: Pick<Publicacion, 'id' | 'kind' | 'title'> | null;
  tipoActual?: TipoPublicacion;
  numeroDeHijas: number;
  ahora: Date;
  hora: 'programada' | 'inmediata' | 'sin_comprobar';
  modos?: Partial<Record<Platform, ModoPublicacion>>;
}

const RESOLUCION_MINIMA = 720;
const NOMBRES_MIME: Record<string, string> = {
  'image/jpeg': 'JPEG',
  'image/png': 'PNG',
  'image/gif': 'GIF',
  'image/bmp': 'BMP',
  'image/tiff': 'TIFF',
  'image/webp': 'WEBP',
};
const MENCION = /(^|\s)@[\w.]+/g;

function listaConO(elementos: readonly string[]): string {
  if (elementos.length <= 1) return elementos.join('');
  return `${elementos.slice(0, -1).join(', ')} o ${elementos.at(-1)}`;
}

// Los límites de las redes están en unidades decimales (300 MB = 300.000.000 bytes).
function formatearTamanoDecimal(bytes: number): string {
  return bytes >= 1_000_000_000 ? `${bytes / 1_000_000_000} GB` : `${bytes / 1_000_000} MB`;
}
// Peor caso de la URL de referencia: los ids de YouTube tienen 11 caracteres.
const URL_PRINCIPAL_DE_MUESTRA = urlVideoYoutube('XXXXXXXXXXX');

export function validarPublicacion(contexto: ContextoValidacion): Problema[] {
  const { publicacion, asset } = contexto;
  const problemas: Problema[] = [];
  const agregar = (nivel: Problema['nivel'], mensaje: string, red?: Platform) =>
    problemas.push(red ? { nivel, red, mensaje } : { nivel, mensaje });

  if (contexto.destinos.length === 0) agregar('error', 'Elige al menos una red.');

  let archivo: ContextoValidacion['asset'] = null;
  if (!publicacion.assetId) agregar('error', 'Elige un archivo.');
  else if (!asset || asset.status === 'fallido' || asset.status === 'purgado')
    agregar('error', 'El archivo ya no está disponible.');
  else if (asset.status !== 'listo') agregar('error', 'El archivo aún no está listo.');
  else archivo = asset;

  for (const destino of contexto.destinos) {
    const red = destino.platform;
    const regla = REGLAS[red][destino.format];
    if (!regla) {
      agregar('error', `${ETIQUETAS_RED[red]} no admite el formato ${ETIQUETAS_FORMATO[destino.format]}.`, red);
      continue;
    }

    if (archivo) {
      if (archivo.kind !== regla.tipoArchivo) {
        agregar(
          'error',
          `${regla.etiqueta}: necesita ${regla.tipoArchivo === 'video' ? 'un video' : 'una imagen'}.`,
          red,
        );
      } else {
        const duracion = archivo.durationSec;
        if (regla.tipoArchivo === 'video' && duracion !== undefined) {
          if (regla.duracionMinSec !== undefined && duracion < regla.duracionMinSec) {
            agregar(
              'error',
              `${regla.etiqueta}: el video debe durar al menos ${formatearDuracion(regla.duracionMinSec)}.`,
              red,
            );
          }
          if (regla.duracionMaxSec !== undefined && duracion > regla.duracionMaxSec) {
            if (regla.duracionMaxEsAdvertencia) {
              agregar(
                'advertencia',
                `${regla.etiqueta}: el video dura más de ${regla.duracionMaxSec / 60} minutos y ${ETIQUETAS_RED[red]} no lo clasificará como ${ETIQUETAS_FORMATO[destino.format]}.`,
                red,
              );
            } else {
              agregar(
                'error',
                `${regla.etiqueta}: el video dura ${formatearDuracion(duracion)} y el máximo es ${formatearDuracion(regla.duracionMaxSec)}.`,
                red,
              );
            }
          }
        }
        if (archivo.aspect && !proporcionCompatible(regla, archivo.aspect)) {
          agregar(
            'advertencia',
            `${regla.etiqueta}: la proporción ${describirProporcion(archivo.aspect)} no es la recomendada (${regla.proporciones.join(', ')}).`,
            red,
          );
        }
      }
    }

    const porApi = contexto.modos?.[red] === 'api';
    const limite = LIMITES_API[red][destino.format];
    if (porApi && archivo && limite) {
      if (limite.tamanoMaxBytes !== undefined && (archivo.sizeBytes ?? 0) > limite.tamanoMaxBytes) {
        agregar(
          'error',
          `${ETIQUETAS_RED[red]} por API admite archivos de hasta ${formatearTamanoDecimal(limite.tamanoMaxBytes)}.`,
          red,
        );
      }
      if (limite.tiposMime && archivo.mimeType && !limite.tiposMime.includes(archivo.mimeType)) {
        const tipos = listaConO(limite.tiposMime.map((t) => NOMBRES_MIME[t] ?? t));
        agregar('error', `${ETIQUETAS_RED[red]} por API solo admite imágenes ${tipos}.`, red);
      }
      if (
        limite.duracionMaxSec !== undefined &&
        archivo.durationSec !== undefined &&
        archivo.durationSec > limite.duracionMaxSec
      ) {
        agregar(
          'error',
          `${ETIQUETAS_RED[red]} por API admite videos de hasta ${formatearDuracion(limite.duracionMaxSec)}.`,
          red,
        );
      }
    }
    if (porApi && red === 'tiktok') {
      const tiktok = destino.tiktok;
      if (!tiktok?.privacy) agregar('error', 'Elige quién puede ver la publicación en TikTok.', red);
      const comercial = tiktok?.commercial;
      if (comercial?.enabled && !comercial.yourBrand && !comercial.brandedContent) {
        agregar('error', 'Indica si el contenido comercial promociona tu marca, a un tercero o a ambos.', red);
      }
      if (comercial?.enabled && comercial.brandedContent && tiktok?.privacy === 'SELF_ONLY') {
        agregar('error', 'El contenido de marca no puede ser privado en TikTok.', red);
      }
    }

    const referencia =
      red === 'tiktok' && publicacion.parentId
        ? textoReferencia(contexto.principal?.title ?? '', URL_PRINCIPAL_DE_MUESTRA)
        : undefined;
    const contenido = contenidoFinal(publicacion, destino, referencia);
    if (regla.limiteTexto !== undefined) {
      const largo = contarCaracteres(contenido.texto);
      if (largo > regla.limiteTexto) {
        agregar(
          'error',
          `${regla.etiqueta}: el texto tiene ${largo} caracteres y el máximo es ${regla.limiteTexto}.`,
          red,
        );
      }
    }
    if (red === 'instagram' && (contenido.texto.match(MENCION) ?? []).length > LIMITE_MENCIONES_INSTAGRAM) {
      agregar('error', `Instagram admite hasta ${LIMITE_MENCIONES_INSTAGRAM} menciones (@) por publicación.`, red);
    }
    if (regla.limiteHashtags !== undefined) {
      const cantidad = (destino.overrides.hashtags ?? publicacion.base.hashtags).length;
      if (cantidad > regla.limiteHashtags) {
        agregar('error', `${regla.etiqueta}: hay ${cantidad} hashtags y el máximo es ${regla.limiteHashtags}.`, red);
      }
    }

    if (red === 'youtube') {
      const titulo = (contenido.titulo ?? '').trim();
      const largoTitulo = contarCaracteres(titulo);
      if (!titulo) agregar('error', 'YouTube: el título no puede estar vacío.', red);
      else if (largoTitulo > LIMITES_YOUTUBE.titulo) {
        agregar(
          'error',
          `YouTube: el título tiene ${largoTitulo} caracteres y el máximo es ${LIMITES_YOUTUBE.titulo}.`,
          red,
        );
      }
      if (/[<>]/.test(titulo) || /[<>]/.test(contenido.texto)) {
        agregar('error', 'YouTube: el título y la descripción no pueden contener los signos < ni >.', red);
      }
      if (contarBytesUtf8(contenido.texto) > LIMITES_YOUTUBE.descripcion) {
        agregar(
          'error',
          'YouTube: la descripción pasa de 5.000 bytes (los acentos y emojis ocupan más de uno).',
          red,
        );
      }
      const largoEtiquetas = largoEtiquetasYoutube(contenido.etiquetas ?? []);
      if (largoEtiquetas > LIMITES_YOUTUBE.etiquetas) {
        agregar(
          'error',
          `YouTube: las etiquetas suman ${largoEtiquetas} caracteres y el máximo es ${LIMITES_YOUTUBE.etiquetas}.`,
          red,
        );
      }
    }
  }

  if (archivo?.width && archivo.height && Math.min(archivo.width, archivo.height) < RESOLUCION_MINIMA) {
    agregar('advertencia', 'La resolución es menor a 720p.');
  }

  if (contexto.hora === 'programada') {
    if (!publicacion.scheduledAt) agregar('error', 'Elige la fecha y la hora.');
    else if (publicacion.scheduledAt.getTime() <= contexto.ahora.getTime())
      agregar('error', 'La hora programada ya pasó.');
  }

  const jerarquia = problemasDeJerarquia({
    destinos: contexto.destinos,
    parentId: publicacion.parentId,
    principal: contexto.principal,
    tipoActual: contexto.tipoActual,
    numeroDeHijas: contexto.numeroDeHijas,
  });
  for (const mensaje of jerarquia) agregar('error', mensaje);

  return problemas;
}

export function mensajeProblemas(problemas: readonly Problema[]): string {
  const errores = problemas.filter((p) => p.nivel === 'error');
  const [primero] = errores;
  if (!primero) return '';
  return errores.length > 1 ? `${primero.mensaje} (y ${errores.length - 1} más)` : primero.mensaje;
}
