import {
  destinoNuevo,
  esEditable,
  fechaBasePromocion,
  leerPublicacion,
  mensajeProblemas,
  normalizarHashtags,
  problemasDeJerarquia,
  recalcularFechas,
  tipoDePublicacion,
  validarPublicacion,
  type Destino,
  type EntradaPublicacion,
  type EstadoReferencia,
  type RespuestaPublicaciones,
} from '@omnistream/core';
import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { leerContexto, leerPublicacionCompleta, refDestino, refPublicacion } from '../firestore';
import type { DependenciasAccion } from './dependencias';
import { programarPublicacion } from './programar';
import { promocionInicial } from './promocion';

const noEditable = () => new HttpsError('failed-precondition', 'Esta publicación ya no se puede editar.');

function referenciaAlGuardar(actual: EstadoReferencia, esHija: boolean): EstadoReferencia {
  if (esHija) return actual === 'no_aplica' ? 'en_espera' : actual;
  return actual === 'en_espera' || actual === 'pendiente' ? 'no_aplica' : actual;
}

export async function guardarPublicacion(
  entrada: EntradaPublicacion,
  deps: DependenciasAccion,
): Promise<RespuestaPublicaciones> {
  const { db, ahora } = deps;
  const existente = entrada.postId ? await leerPublicacionCompleta(db, entrada.postId) : null;
  if (entrada.postId && !existente) throw new HttpsError('not-found', 'La publicación no existe.');
  if (existente && !esEditable(existente.destinos.map((d) => d.status))) throw noEditable();

  const ref = entrada.postId ? refPublicacion(db, entrada.postId) : db.collection('posts').doc();
  const [documentoPrincipal, hijas] = await Promise.all([
    entrada.parentId ? refPublicacion(db, entrada.parentId).get() : null,
    existente ? db.collection('posts').where('parentId', '==', ref.id).count().get() : null,
  ]);
  const principal = documentoPrincipal?.exists
    ? leerPublicacion(documentoPrincipal.id, documentoPrincipal.data())
    : null;
  const numeroDeHijas = hijas?.data().count ?? 0;
  const problemas = problemasDeJerarquia({
    destinos: entrada.destinos,
    parentId: entrada.parentId,
    principal,
    tipoActual: existente?.publicacion.kind,
    numeroDeHijas,
  });
  if (problemas.length > 0) throw new HttpsError('failed-precondition', problemas.join(' '));

  const kind = tipoDePublicacion(entrada.destinos, entrada.parentId);
  const esHija = kind === 'hija';
  const datos = {
    kind,
    title: entrada.title,
    base: { text: entrada.base.text, hashtags: normalizarHashtags(entrada.base.hashtags) },
    scheduledAt: entrada.scheduledAt ? new Date(entrada.scheduledAt) : null,
    updatedAt: ahora,
  };

  // Una publicación programada debe seguir siendo válida: se valida antes de escribir y luego se vuelve a programar.
  const reprogramar = existente?.destinos.some((d) => d.status === 'programada') ?? false;
  if (reprogramar) {
    const contexto = await leerContexto(db, {
      id: ref.id,
      assetId: entrada.assetId ?? undefined,
      parentId: entrada.parentId ?? undefined,
    });
    const errores = validarPublicacion({
      publicacion: { ...datos, assetId: entrada.assetId ?? undefined, parentId: entrada.parentId ?? undefined },
      destinos: entrada.destinos.map((d) => ({ ...d, overrides: {} })),
      asset: contexto.asset,
      principal,
      tipoActual: existente?.publicacion.kind,
      numeroDeHijas,
      ahora,
      hora: 'programada',
    }).filter((p) => p.nivel === 'error');
    if (errores.length > 0) throw new HttpsError('failed-precondition', mensajeProblemas(errores));
  }

  // Un Principal recibe su lista de promoción al crearse; si ya la tiene, sus fechas siguen a la nueva fecha.
  const promocionNueva = kind === 'principal' ? await promocionInicial(db, datos.scheduledAt) : undefined;

  const quitados = await db.runTransaction(async (tx) => {
    const fresca = existente ? await leerPublicacionCompleta(db, ref.id, tx) : null;
    if (existente && (!fresca || !esEditable(fresca.destinos.map((d) => d.status)))) throw noEditable();
    const actuales = new Map<string, Destino>((fresca?.destinos ?? []).map((d) => [d.platform, d]));
    const anterior = fresca?.publicacion.promotion?.items;
    const items = anterior
      ? recalcularFechas(anterior, fechaBasePromocion(datos, actuales.get('youtube')))
      : promocionNueva;
    const promocion = kind === 'principal' && items ? { promotion: { items } } : {};

    if (fresca) {
      tx.update(ref, {
        ...datos,
        ...promocion,
        assetId: entrada.assetId ?? FieldValue.delete(),
        parentId: esHija ? entrada.parentId : FieldValue.delete(),
      });
    } else {
      tx.set(ref, {
        ...datos,
        ...promocion,
        assetId: entrada.assetId ?? undefined,
        parentId: esHija ? entrada.parentId : undefined,
        status: 'borrador',
        targetStatus: {},
        createdAt: ahora,
      });
    }

    for (const destino of entrada.destinos) {
      const actual = actuales.get(destino.platform);
      const destinoRef = refDestino(db, ref.id, destino.platform);
      if (!actual) {
        tx.set(
          destinoRef,
          destinoNuevo(destino.platform, destino.format, {
            esHija,
            ahora,
            youtube: destino.youtube,
            tiktok: destino.tiktok,
          }),
        );
      } else {
        tx.update(destinoRef, {
          format: destino.format,
          youtube: destino.youtube ?? FieldValue.delete(),
          tiktok: destino.tiktok ?? FieldValue.delete(),
          'parentRef.status': referenciaAlGuardar(actual.parentRef.status, esHija),
        });
      }
    }
    const nuevas = new Set<string>(entrada.destinos.map((d) => d.platform));
    const sobrantes = [...actuales.values()].filter((d) => !nuevas.has(d.platform));
    for (const destino of sobrantes) tx.delete(refDestino(db, ref.id, destino.platform));
    return sobrantes;
  });

  // Borra también los intentos de los destinos quitados.
  for (const destino of quitados) await db.recursiveDelete(refDestino(db, ref.id, destino.platform));
  if (reprogramar) await programarPublicacion(ref.id, false, deps);
  return { postId: ref.id };
}
