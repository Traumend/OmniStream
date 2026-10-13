import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { getStorage } from 'firebase-admin/storage';
import { onRequest } from 'firebase-functions/v2/https';
import { claveCifrado, REGION } from '../config';

type Bucket = ReturnType<ReturnType<typeof getStorage>['bucket']>;

// Enlaces de lectura de 1 hora para que una red descargue un archivo desde el dominio de la app (TikTok exige un
// dominio verificado). La llave se deriva de CLAVE_CIFRADO para no reutilizarla tal cual.
const llave = (clave: string) => createHash('sha256').update(`media:${clave}`).digest();
const firmar = (clave: string, datos: string) => createHmac('sha256', llave(clave)).update(datos).digest();

export function firmarTokenMedia(clave: string, ruta: string, expiraMs: number): string {
  const datos = `${Buffer.from(ruta).toString('base64url')}.${expiraMs}`;
  return `${datos}.${firmar(clave, datos).toString('base64url')}`;
}

export function verificarTokenMedia(clave: string, token: string, ahoraMs: number): string | null {
  const partes = token.split('.');
  if (partes.length !== 3) return null;
  const [ruta, expira, firma] = partes as [string, string, string];
  const esperada = firmar(clave, `${ruta}.${expira}`);
  const recibida = Buffer.from(firma, 'base64url');
  if (recibida.length !== esperada.length || !timingSafeEqual(recibida, esperada)) return null;
  if (!/^\d+$/.test(expira) || Number(expira) < ahoraMs) return null;
  return Buffer.from(ruta, 'base64url').toString('utf8');
}

export async function servirMedia(
  token: string,
  deps: { bucket: Bucket; clave: string; ahora: () => Date },
): Promise<{ status: 404 } | { status: 200; contentType: string; size: number; stream: NodeJS.ReadableStream }> {
  const ruta = verificarTokenMedia(deps.clave, token, deps.ahora().getTime());
  if (!ruta) return { status: 404 };
  const archivo = deps.bucket.file(ruta);
  const [existe] = await archivo.exists();
  if (!existe) return { status: 404 };
  const [meta] = await archivo.getMetadata();
  return {
    status: 200,
    contentType: meta.contentType ?? 'application/octet-stream',
    size: Number(meta.size),
    stream: archivo.createReadStream(),
  };
}

export const media = onRequest({ region: REGION, secrets: [claveCifrado] }, async (req, res) => {
  const token = req.path.replace(/^\/+/, '');
  const respuesta =
    req.method === 'GET' && token
      ? await servirMedia(token, {
          bucket: getStorage().bucket(),
          clave: claveCifrado.value(),
          ahora: () => new Date(),
        })
      : ({ status: 404 } as const);
  res.set('Cache-Control', 'private, max-age=0');
  if (respuesta.status === 404) {
    res.status(404).send('No encontrado.');
    return;
  }
  res.status(200).set('Content-Type', respuesta.contentType).set('Content-Length', String(respuesta.size));
  respuesta.stream.on('error', () => res.destroy()).pipe(res);
});
