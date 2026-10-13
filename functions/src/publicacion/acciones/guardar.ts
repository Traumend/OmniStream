import {
  destinoNuevo,
  esEditable,
  fechaBasePromocion,
  hashRecorte,
  leerPublicacion,
  mensajeProblemas,
  normalizarHashtags,
  problemasDeJerarquia,
  recalcularFechas,
  recortePermitido,
  tipoDePublicacion,
  validarPublicacion,
  type Destino,
  type EntradaPublicacion,
  type EstadoReferencia,
  type Platform,
  type RespuestaPublicaciones,
} from '@omnistream/core';
import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import type { TareaRecorte } from '../generarRecorte';
import { leerAsset, leerContexto, leerPublicacionCompleta, refDestino, refPublicacion } from '../firestore';
import type { DependenciasAccion } from './dependencias';
import { programarPublicacion } from './programar';
import { promocionInicial } from './promocion';

const noEditable = () => new HttpsError('failed-precondition', 'Esta publicación ya no se puede editar.');

type DestinoEntrada = EntradaPublicacion['destinos'][number];

// Los overrides se guardan tal como llegan, sin claves vacías (Firestore no admite undefined).
function overridesDe(destino: DestinoEntrada): Destino['overrides'] {
  const o = destino.overrides ?? {};
  const overrides: Destino['overrides'] = {};
  if (o.text !== undefined) overrides.text = o.text;
  if (o.hashtags !== undefined) overrides.hashtags = normalizarHashtags(o.hashtags);
  if (o.title !== undefined) overrides.title = o.title;
  if (o.crop) overrides.crop = o.crop;
  if (o.scheduledAt !== undefined) overrides.scheduledAt = new Date(o.scheduledAt);
  return overrides;
}

const MENSAJE_RECORTE_NO_PERMITIDO = 'El recorte de video se permite para videos de hasta 15 minutos y 2 GB.';

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

  // El recorte que no se puede generar se rechaza también en un borrador.
  if (entrada.assetId && entrada.destinos.some((d) => d.overrides?.crop)) {
    const documento = await db.collection('assets').doc(entrada.assetId).get();
    if (documento.exists && !recortePermitido(leerAsset(documento.id, documento.data()))) {
      throw new HttpsError('failed-precondition', MENSAJE_RECORTE_NO_PERMITIDO);
    }
  }

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
      destinos: entrada.destinos.map((d) => ({ ...d, overrides: overridesDe(d) })),
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

  const recortesPedidos: TareaRecorte[] = [];
  const sinRecorte: Platform[] = [];
  const quitados = await db.runTransaction(async (tx) => {
    recortesPedidos.length = 0;
    sinRecorte.length = 0;
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
      const overrides = overridesDe(destino);
      // La huella cambia con el recorte y con el archivo; si no cambió, el derivado actual sigue sirviendo.
      const cropHash = overrides.crop && entrada.assetId ? hashRecorte(entrada.assetId, overrides.crop) : undefined;
      const pedirDerivado = cropHash !== undefined && actual?.derivative?.cropHash !== cropHash;
      if (pedirDerivado) recortesPedidos.push({ postId: ref.id, platform: destino.platform, cropHash });
      const derivadoNuevo = pedirDerivado ? { derivative: { cropHash, status: 'pendiente' } } : {};
      if (!cropHash && (actual?.overrides.crop || actual?.derivative)) sinRecorte.push(destino.platform);
      if (!actual) {
        tx.set(destinoRef, {
          ...destinoNuevo(destino.platform, destino.format, {
            esHija,
            ahora,
            youtube: destino.youtube,
            tiktok: destino.tiktok,
          }),
          overrides,
          ...derivadoNuevo,
        });
      } else {
        tx.update(destinoRef, {
          format: destino.format,
          overrides,
          ...(cropHash ? derivadoNuevo : { derivative: FieldValue.delete() }),
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

  if (deps.encolarRecorte) for (const tarea of recortesPedidos) await deps.encolarRecorte(tarea);
  // Los derivados de un recorte quitado o de una red quitada ya no se usan.
  for (const red of [...sinRecorte, ...quitados.map((d) => d.platform)]) await deps.borrarDerivados?.(ref.id, red);

  // Borra también los intentos de los destinos quitados.
  for (const destino of quitados) await db.recursiveDelete(refDestino(db, ref.id, destino.platform));
  if (reprogramar) await programarPublicacion(ref.id, false, deps);
  return { postId: ref.id };
}
