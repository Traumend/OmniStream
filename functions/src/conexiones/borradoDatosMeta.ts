import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { onRequest } from 'firebase-functions/v2/https';
import { metaAppSecret, REGION, urlPublica } from '../config';
import { desconectarProveedor } from './conexiones';

// Formato de Meta: `{firma}.{payload}` en base64url; la firma es HMAC-SHA256 del payload codificado.
export function verificarSignedRequest(signedRequest: string, appSecret: string): { user_id: string } | null {
  const punto = signedRequest.indexOf('.');
  if (punto < 0) return null;
  const firma = Buffer.from(signedRequest.slice(0, punto), 'base64url');
  const codificado = signedRequest.slice(punto + 1);
  const esperada = createHmac('sha256', appSecret).update(codificado).digest();
  if (firma.length !== esperada.length || !timingSafeEqual(firma, esperada)) return null;
  try {
    const payload = JSON.parse(Buffer.from(codificado, 'base64url').toString('utf8')) as Record<string, unknown>;
    if (payload.algorithm !== 'HMAC-SHA256' || typeof payload.user_id !== 'string') return null;
    return { ...payload, user_id: payload.user_id };
  } catch {
    return null;
  }
}

// Callback de borrado de datos de Meta: quita la sesión, desconecta Facebook e Instagram y entrega un código.
export async function borrarDatosMeta(
  signedRequest: string,
  deps: { db: Firestore; appSecret: string; urlPublica: string; ahora: () => Date },
): Promise<
  { status: 200; cuerpo: { url: string; confirmation_code: string } } | { status: 400; cuerpo: { error: string } }
> {
  const solicitud = verificarSignedRequest(signedRequest, deps.appSecret);
  if (!solicitud) return { status: 400, cuerpo: { error: 'La solicitud no es válida.' } };
  await desconectarProveedor(deps.db, 'meta');
  const codigo = randomBytes(8).toString('hex');
  await deps.db.collection('dataDeletions').doc(codigo).set({ userId: solicitud.user_id, at: deps.ahora() });
  return {
    status: 200,
    cuerpo: {
      url: `${deps.urlPublica}/privacidad?borrado=${codigo}#borrado-de-datos`,
      confirmation_code: codigo,
    },
  };
}

export const borradoDatosMeta = onRequest({ region: REGION, secrets: [metaAppSecret] }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido.' });
    return;
  }
  const signedRequest = (req.body as { signed_request?: unknown } | undefined)?.signed_request;
  const respuesta = await borrarDatosMeta(typeof signedRequest === 'string' ? signedRequest : '', {
    db: getFirestore(),
    appSecret: metaAppSecret.value(),
    urlPublica: urlPublica.value(),
    ahora: () => new Date(),
  });
  if (respuesta.status === 200) logger.info('Borrado de datos de Meta', { codigo: respuesta.cuerpo.confirmation_code });
  res.status(respuesta.status).json(respuesta.cuerpo);
});
