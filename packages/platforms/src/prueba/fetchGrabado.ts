import type { Http } from '../http';

export interface Intercambio {
  metodo: string;
  url: string | RegExp;
  revisar?(peticion: { cuerpo: string | Uint8Array<ArrayBuffer> | undefined; headers: Headers; url: string }): void;
  respuesta: { status: number; json?: unknown; texto?: string; headers?: Record<string, string> } | 'sin_respuesta';
}

// Fetch simulado para las pruebas de contrato: responde en orden y falla ante una petición inesperada.
export function fetchGrabado(intercambios: Intercambio[]): Http & { pendientes(): number } {
  const cola = [...intercambios];
  const http = async (entrada: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
    const metodo = (init?.method ?? 'GET').toUpperCase();
    const esperado = cola.shift();
    const coincide =
      esperado &&
      esperado.metodo.toUpperCase() === metodo &&
      (typeof esperado.url === 'string' ? url === esperado.url : esperado.url.test(url));
    if (!esperado || !coincide) {
      throw new Error(
        `Petición inesperada: ${metodo} ${url}${esperado ? ` (se esperaba ${esperado.metodo} ${String(esperado.url)})` : ''}`,
      );
    }
    const cuerpo = init?.body as string | Uint8Array<ArrayBuffer> | undefined;
    esperado.revisar?.({ cuerpo, headers: new Headers(init?.headers), url });
    if (esperado.respuesta === 'sin_respuesta') throw new TypeError('fetch failed');
    const { status, json, texto, headers } = esperado.respuesta;
    const contenido = json !== undefined ? JSON.stringify(json) : (texto ?? '');
    return new Response(status === 204 || status === 304 ? null : contenido, { status, headers });
  };
  return Object.assign(http as Http, { pendientes: () => cola.length });
}
