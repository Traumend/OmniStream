import { randomBytes } from 'node:crypto';
import {
  accionConexionSchema,
  ETIQUETAS_PROVEEDOR,
  ETIQUETAS_RED,
  leerConexion,
  mensajePermisoFaltante,
  PROVEEDORES,
  puedePublicarPorApi,
  REDES_DE_PROVEEDOR,
  type AccionConexion,
  type Proveedor,
  type RespuestaConexiones,
} from '@omnistream/core';
import { consultarCreador, esPlatformError, type Http } from '@omnistream/platforms';
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { HttpsError, onCall, onRequest } from 'firebase-functions/v2/https';
import { claveCifrado, REGION, SECRETOS_CONECTORES, urlPublica } from '../config';
import { exigirPropietario } from '../publicacion/autorizacion';
import { crearNotificador, enviarPushFcm } from '../publicacion/notificaciones';
import { crearCifrador } from './cifrado';
import { proveedoresReales } from './proveedores';
import { borrarSesion, guardarSesion } from './secretos';
import { marcarExpirada, sesionVigente, vencimientoDeConexion, type DependenciasSesion } from './sesiones';

export interface DependenciasConexiones extends DependenciasSesion {
  urlPublica: string;
  http: Http;
}

export const redireccionOAuth = (urlPublica: string) => `${urlPublica}/api/conexiones/retorno`;

const VIGENCIA_STATE_MS = 10 * 60_000;
const MENSAJE_STATE = 'La conexión venció o no es válida. Vuelve a intentarlo.';

async function iniciar(proveedor: Proveedor, deps: DependenciasConexiones): Promise<RespuestaConexiones> {
  const state = randomBytes(32).toString('base64url');
  const ahora = deps.ahora();
  await deps.db
    .collection('oauthStates')
    .doc(state)
    .set({ proveedor, createdAt: ahora, expiresAt: new Date(ahora.getTime() + VIGENCIA_STATE_MS) });
  return { url: deps.proveedores[proveedor].buildAuthUrl({ state, redirectUri: redireccionOAuth(deps.urlPublica) }) };
}

async function desconectar(proveedor: Proveedor, deps: DependenciasConexiones): Promise<RespuestaConexiones> {
  await borrarSesion(deps.db, proveedor);
  for (const platform of REDES_DE_PROVEEDOR[proveedor]) {
    await deps.db
      .collection('connections')
      .doc(platform)
      .set({ platform, authStatus: 'sin_conectar', publishMode: 'manual', readEnabled: false, scopes: [] });
  }
  return {};
}

async function configurar(
  accion: Extract<AccionConexion, { accion: 'configurar' }>,
  deps: DependenciasConexiones,
): Promise<RespuestaConexiones> {
  const { platform, publishMode, readEnabled, mediaVerified } = accion;
  if (mediaVerified !== undefined && platform !== 'tiktok')
    throw new HttpsError('invalid-argument', 'Esta opción solo aplica a TikTok.');
  const ref = deps.db.collection('connections').doc(platform);
  if (publishMode === 'api') {
    const actual = leerConexion(platform, (await ref.get()).data());
    if (actual.authStatus !== 'conectada')
      throw new HttpsError('failed-precondition', `${ETIQUETAS_RED[platform]} no está conectada.`);
    if (!puedePublicarPorApi(actual)) throw new HttpsError('failed-precondition', mensajePermisoFaltante(platform));
  }
  await ref.set({ platform, publishMode, readEnabled, mediaVerified }, { merge: true });
  return {};
}

async function infoCreadorTiktok(deps: DependenciasConexiones): Promise<RespuestaConexiones> {
  try {
    const sesion = await sesionVigente('tiktok', deps);
    return { info: await consultarCreador({ http: deps.http, sesion }) };
  } catch (error) {
    if (esPlatformError(error) && error.kind === 'auth') {
      await marcarExpirada('tiktok', error, deps);
      throw new HttpsError('failed-precondition', 'Vuelve a conectar TikTok.');
    }
    throw new HttpsError('failed-precondition', 'No se pudo consultar tu cuenta de TikTok.');
  }
}

export async function despacharConexion(
  auth: { token?: Record<string, unknown> } | undefined,
  datos: unknown,
  deps: DependenciasConexiones,
): Promise<RespuestaConexiones> {
  exigirPropietario(auth);
  const resultado = accionConexionSchema.safeParse(datos);
  if (!resultado.success)
    throw new HttpsError('invalid-argument', resultado.error.issues[0]?.message ?? 'Datos inválidos.');
  const accion = resultado.data;
  switch (accion.accion) {
    case 'iniciar':
      return iniciar(accion.proveedor, deps);
    case 'desconectar':
      return desconectar(accion.proveedor, deps);
    case 'configurar':
      return configurar(accion, deps);
    case 'infoCreadorTiktok':
      return infoCreadorTiktok(deps);
  }
}

// Consume el state en una transacción: un mismo retorno nunca se procesa dos veces.
async function consumirState(state: string, deps: DependenciasConexiones): Promise<Proveedor | null> {
  const ref = deps.db.collection('oauthStates').doc(state);
  const datos = await deps.db.runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    if (!doc.exists) return null;
    tx.delete(ref);
    return doc.data() ?? null;
  });
  if (!datos) return null;
  const vence = datos.expiresAt instanceof Timestamp ? datos.expiresAt.toMillis() : 0;
  if (vence <= deps.ahora().getTime()) return null;
  return PROVEEDORES.includes(datos.proveedor) ? (datos.proveedor as Proveedor) : null;
}

export async function completarConexion(query: Record<string, unknown>, deps: DependenciasConexiones): Promise<string> {
  const conexiones = `${deps.urlPublica}/ajustes/conexiones`;
  const conError = (mensaje: string) => `${conexiones}?error=${encodeURIComponent(mensaje)}`;
  const state = typeof query.state === 'string' && query.state !== '' ? query.state : null;
  const proveedor = state ? await consumirState(state, deps) : null;
  if (!proveedor) return conError(MENSAJE_STATE);
  const nombre = ETIQUETAS_PROVEEDOR[proveedor];
  if (query.error !== undefined) return conError(`Se canceló la conexión con ${nombre}.`);

  try {
    if (typeof query.code !== 'string' || query.code === '') throw new Error('Sin código de autorización');
    const resultado = await deps.proveedores[proveedor].exchangeCode({
      code: query.code,
      redirectUri: redireccionOAuth(deps.urlPublica),
    });
    const ahora = deps.ahora();
    await guardarSesion(deps.db, deps.cifrador, proveedor, resultado.sesion, ahora);
    const vence = vencimientoDeConexion(proveedor, resultado.sesion);
    for (const platform of REDES_DE_PROVEEDOR[proveedor]) {
      const ref = deps.db.collection('connections').doc(platform);
      const account = resultado.cuentas[platform];
      if (!account) {
        if (proveedor === 'meta')
          await ref.set(
            {
              platform,
              authStatus: 'error',
              lastError: {
                code: 'sin_instagram',
                message: 'La página no tiene una cuenta profesional de Instagram vinculada.',
                at: ahora,
              },
            },
            { merge: true },
          );
        continue;
      }
      const actual = (await ref.get()).data() ?? {};
      await ref.set(
        {
          platform,
          authStatus: 'conectada',
          account,
          scopes: resultado.scopes,
          tokenExpiresAt: vence ?? FieldValue.delete(),
          lastError: FieldValue.delete(),
          publishMode: actual.publishMode === 'api' ? 'api' : 'manual',
          readEnabled: typeof actual.readEnabled === 'boolean' ? actual.readEnabled : true,
        },
        { merge: true },
      );
    }
    return `${conexiones}?conectada=${proveedor}`;
  } catch (error) {
    if (esPlatformError(error)) {
      logger.warn('No se completó la conexión', {
        proveedor,
        kind: error.kind,
        code: error.code,
        message: error.message,
      });
      return conError(error.message);
    }
    logger.error('Falló la conexión', { proveedor, error: error instanceof Error ? error.name : 'desconocido' });
    return conError(`No se pudo completar la conexión con ${nombre}.`);
  }
}

function dependenciasReales(): DependenciasConexiones {
  const db = getFirestore();
  return {
    db,
    cifrador: crearCifrador(claveCifrado.value()),
    proveedores: proveedoresReales(),
    ahora: () => new Date(),
    notificar: crearNotificador(db, enviarPushFcm()),
    urlPublica: urlPublica.value(),
    http: fetch,
  };
}

export const conexiones = onCall({ region: REGION, secrets: SECRETOS_CONECTORES, timeoutSeconds: 60 }, (solicitud) =>
  despacharConexion(solicitud.auth, solicitud.data, dependenciasReales()),
);

export const retornoConexion = onRequest({ region: REGION, secrets: SECRETOS_CONECTORES }, async (req, res) => {
  res.redirect(302, await completarConexion(req.query as Record<string, unknown>, dependenciasReales()));
});
