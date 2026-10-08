import { PlatformError } from './errores';

export type Http = typeof fetch;

export interface RespuestaHttp {
  status: number;
  headers: Headers;
  json: unknown;
  texto: string;
}

export interface OpcionesSolicitud {
  red: string; // nombre para los mensajes: "YouTube", "Meta", ...
  clasificar(r: RespuestaHttp): PlatformError | null;
  final?: boolean; // paso que crea la publicación: sin respuesta es ambiguo
  timeoutMs?: number;
}

function clasificacionGenerica(red: string, r: RespuestaHttp): PlatformError | null {
  if (r.status < 400) return null;
  if (r.status === 429 || r.status >= 500)
    return new PlatformError('temporal', `http_${r.status}`, `${red} respondió con un error (${r.status}).`);
  if (r.status === 401) return new PlatformError('auth', 'http_401', `El acceso a ${red} venció. Vuelve a conectarla.`);
  return new PlatformError('definitivo', `http_${r.status}`, `${red} respondió con un error (${r.status}).`);
}

export async function solicitar(
  http: Http,
  url: string,
  init: RequestInit,
  opciones: OpcionesSolicitud,
): Promise<RespuestaHttp> {
  let respuesta: Response;
  try {
    respuesta = await http(url, { ...init, signal: AbortSignal.timeout(opciones.timeoutMs ?? 60_000) });
  } catch {
    throw new PlatformError(opciones.final ? 'ambiguo' : 'temporal', 'red', `No se pudo conectar con ${opciones.red}.`);
  }
  const texto = await respuesta.text();
  let json: unknown = null;
  try {
    json = texto ? JSON.parse(texto) : null;
  } catch {
    json = null;
  }
  const r: RespuestaHttp = { status: respuesta.status, headers: respuesta.headers, json, texto };
  const error = opciones.clasificar(r) ?? clasificacionGenerica(opciones.red, r);
  if (error) throw error;
  return r;
}
