import type { Asset } from '../archivos/asset';
import { formatearDuracion } from '../archivos/formato';
import { describirProporcion } from '../archivos/fotogramas';
import { problemasDeJerarquia } from './jerarquia';
import { LIMITES_YOUTUBE, largoEtiquetasYoutube, proporcionCompatible, REGLAS } from './reglas';
import { contarCaracteres, contenidoFinal, textoReferencia, urlVideoYoutube } from './texto';
import { ETIQUETAS_FORMATO, ETIQUETAS_RED, type Destino, type Platform, type Publicacion, type TipoPublicacion } from './tipos';

export interface Problema {
  nivel: 'error' | 'advertencia';
  red?: Platform;
  mensaje: string;
}

export interface ContextoValidacion {
  publicacion: Pick<Publicacion, 'title' | 'assetId' | 'base' | 'scheduledAt' | 'parentId'>;
  destinos: readonly Pick<Destino, 'platform' | 'format' | 'overrides' | 'youtube'>[];
  asset: Pick<Asset, 'kind' | 'status' | 'width' | 'height' | 'aspect' | 'durationSec'> | null;
  principal: Pick<Publicacion, 'id' | 'kind' | 'title'> | null;
  tipoActual?: TipoPublicacion;
  numeroDeHijas: number;
  ahora: Date;
  hora: 'programada' | 'inmediata' | 'sin_comprobar';
}

const RESOLUCION_MINIMA = 720;
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
  else if (!asset || asset.status === 'fallido' || asset.status === 'purgado') agregar('error', 'El archivo ya no está disponible.');
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
        agregar('error', `${regla.etiqueta}: necesita ${regla.tipoArchivo === 'video' ? 'un video' : 'una imagen'}.`, red);
      } else {
        const duracion = archivo.durationSec;
        if (regla.tipoArchivo === 'video' && duracion !== undefined) {
          if (regla.duracionMinSec !== undefined && duracion < regla.duracionMinSec) {
            agregar('error', `${regla.etiqueta}: el video debe durar al menos ${formatearDuracion(regla.duracionMinSec)}.`, red);
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

    const referencia =
      red === 'tiktok' && publicacion.parentId
        ? textoReferencia(contexto.principal?.title ?? '', URL_PRINCIPAL_DE_MUESTRA)
        : undefined;
    const contenido = contenidoFinal(publicacion, destino, referencia);
    if (regla.limiteTexto !== undefined) {
      const largo = contarCaracteres(contenido.texto);
      if (largo > regla.limiteTexto) {
        agregar('error', `${regla.etiqueta}: el texto tiene ${largo} caracteres y el máximo es ${regla.limiteTexto}.`, red);
      }
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
        agregar('error', `YouTube: el título tiene ${largoTitulo} caracteres y el máximo es ${LIMITES_YOUTUBE.titulo}.`, red);
      }
      if (/[<>]/.test(titulo) || /[<>]/.test(contenido.texto)) {
        agregar('error', 'YouTube: el título y la descripción no pueden contener los signos < ni >.', red);
      }
      const largoDescripcion = contarCaracteres(contenido.texto);
      if (largoDescripcion > LIMITES_YOUTUBE.descripcion) {
        agregar('error', `YouTube: la descripción tiene ${largoDescripcion} caracteres y el máximo es ${LIMITES_YOUTUBE.descripcion}.`, red);
      }
      const largoEtiquetas = largoEtiquetasYoutube(contenido.etiquetas ?? []);
      if (largoEtiquetas > LIMITES_YOUTUBE.etiquetas) {
        agregar('error', `YouTube: las etiquetas suman ${largoEtiquetas} caracteres y el máximo es ${LIMITES_YOUTUBE.etiquetas}.`, red);
      }
    }
  }

  if (archivo?.width && archivo.height && Math.min(archivo.width, archivo.height) < RESOLUCION_MINIMA) {
    agregar('advertencia', 'La resolución es menor a 720p.');
  }

  if (contexto.hora === 'programada') {
    if (!publicacion.scheduledAt) agregar('error', 'Elige la fecha y la hora.');
    else if (publicacion.scheduledAt.getTime() <= contexto.ahora.getTime()) agregar('error', 'La hora programada ya pasó.');
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
