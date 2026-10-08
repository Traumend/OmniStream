import {
  PRIVACIDADES_TIKTOK,
  type CamposTiktok,
  type CamposYoutube,
  type Destino,
  type EstadoDestino,
  type EstadoPublicacion,
  type EstadoReferencia,
  type FormatoDestino,
  type Intento,
  type Platform,
  type Publicacion,
  type TipoError,
  type TipoPublicacion,
} from './tipos';

type Registro = Record<string, unknown>;

const registro = (valor: unknown): Registro =>
  typeof valor === 'object' && valor !== null && !Array.isArray(valor) ? (valor as Registro) : {};
const texto = (valor: unknown): string | undefined => (typeof valor === 'string' ? valor : undefined);
const numero = (valor: unknown): number | undefined => (typeof valor === 'number' ? valor : undefined);
const textos = (valor: unknown): string[] | undefined =>
  Array.isArray(valor) ? valor.filter((v): v is string => typeof v === 'string') : undefined;

// Acepta Timestamp del SDK cliente o del de administración (ambos tienen toDate) y Date.
function aFecha(valor: unknown): Date | undefined {
  if (valor instanceof Date) return valor;
  const conversor = (valor as { toDate?: unknown } | null | undefined)?.toDate;
  return typeof conversor === 'function' ? (conversor.call(valor) as Date) : undefined;
}

// Quita las claves con valor undefined para que los objetos leídos sean iguales a los escritos.
function definidos<T extends object>(objeto: T): T {
  return Object.fromEntries(Object.entries(objeto).filter(([, v]) => v !== undefined)) as T;
}

export function leerPublicacion(id: string, datos: unknown): Publicacion {
  const d = registro(datos);
  const base = registro(d.base);
  const creada = aFecha(d.createdAt) ?? new Date(0);
  return definidos({
    id,
    kind: (texto(d.kind) as TipoPublicacion | undefined) ?? 'independiente',
    parentId: texto(d.parentId),
    status: (texto(d.status) as EstadoPublicacion | undefined) ?? 'borrador',
    title: texto(d.title) ?? '',
    assetId: texto(d.assetId),
    base: { text: texto(base.text) ?? '', hashtags: textos(base.hashtags) ?? [] },
    scheduledAt: aFecha(d.scheduledAt) ?? null,
    targetStatus: registro(d.targetStatus) as Publicacion['targetStatus'],
    createdAt: creada,
    updatedAt: aFecha(d.updatedAt) ?? creada,
  });
}

function leerYoutube(valor: unknown): CamposYoutube | undefined {
  if (typeof valor !== 'object' || valor === null) return undefined;
  const y = registro(valor);
  const miniatura = registro(y.thumbnail);
  return definidos({
    description: texto(y.description) ?? '',
    tags: textos(y.tags) ?? [],
    categoryId: texto(y.categoryId) ?? '22',
    privacy: (texto(y.privacy) as CamposYoutube['privacy'] | undefined) ?? 'public',
    madeForKids: y.madeForKids === true,
    thumbnail: texto(miniatura.frame) ? { frame: miniatura.frame as 'start' | 'middle' | 'end' } : undefined,
  });
}

function leerTiktok(valor: unknown): CamposTiktok | undefined {
  if (typeof valor !== 'object' || valor === null) return undefined;
  const t = registro(valor);
  const comercial = registro(t.commercial);
  const privacidad = texto(t.privacy);
  return {
    privacy: (PRIVACIDADES_TIKTOK as readonly string[]).includes(privacidad ?? '')
      ? (privacidad as CamposTiktok['privacy'])
      : null,
    allowComments: t.allowComments === true,
    allowDuet: t.allowDuet === true,
    allowStitch: t.allowStitch === true,
    commercial: {
      enabled: comercial.enabled === true,
      yourBrand: comercial.yourBrand === true,
      brandedContent: comercial.brandedContent === true,
    },
  };
}

export function leerDestino(datos: unknown): Destino {
  const d = registro(datos);
  const overrides = registro(d.overrides);
  const lease = registro(d.lease);
  const checkpoint = registro(d.checkpoint);
  const remote = registro(d.remote);
  const parentRef = registro(d.parentRef);
  const error = registro(d.lastError);
  const hasta = aFecha(lease.until);
  const publicada = aFecha(remote.publishedAt);
  return definidos({
    platform: d.platform as Platform,
    format: d.format as FormatoDestino,
    overrides: definidos({
      text: texto(overrides.text),
      hashtags: textos(overrides.hashtags),
      title: texto(overrides.title),
      scheduledAt: aFecha(overrides.scheduledAt),
    }),
    youtube: leerYoutube(d.youtube),
    tiktok: leerTiktok(d.tiktok),
    scheduledAt: aFecha(d.scheduledAt),
    scheduleVersion: numero(d.scheduleVersion) ?? 0,
    enqueuedVersion: numero(d.enqueuedVersion),
    publishMode: d.publishMode === 'api' ? 'api' : 'manual',
    status: (texto(d.status) as EstadoDestino | undefined) ?? 'borrador',
    statusChangedAt: aFecha(d.statusChangedAt) ?? new Date(0),
    lease: texto(lease.attemptId) && hasta ? { attemptId: lease.attemptId as string, until: hasta } : undefined,
    checkpoint: texto(checkpoint.stage)
      ? { stage: checkpoint.stage as string, data: registro(checkpoint.data), seq: numero(checkpoint.seq) ?? 0 }
      : undefined,
    remote:
      texto(remote.id) && texto(remote.url) && publicada
        ? { id: remote.id as string, url: remote.url as string, publishedAt: publicada }
        : undefined,
    parentRef: definidos({
      status: (texto(parentRef.status) as EstadoReferencia | undefined) ?? 'no_aplica',
      remoteCommentId: texto(parentRef.remoteCommentId),
      error: texto(parentRef.error),
    }),
    attempts: numero(d.attempts) ?? 0,
    lastError: texto(error.message)
      ? {
          code: texto(error.code) ?? 'desconocido',
          message: error.message as string,
          kind: (texto(error.kind) as TipoError | undefined) ?? 'definitivo',
          at: aFecha(error.at) ?? new Date(0),
        }
      : undefined,
  });
}

export function leerIntento(id: string, datos: unknown): Intento {
  const d = registro(datos);
  return definidos({
    id,
    at: aFecha(d.at) ?? new Date(0),
    stage: texto(d.stage) ?? '',
    result: (texto(d.result) as Intento['result'] | undefined) ?? 'error',
    error: texto(d.error),
  });
}

export function destinoNuevo(
  platform: Platform,
  format: FormatoDestino,
  opciones: { esHija: boolean; ahora: Date; youtube?: CamposYoutube; tiktok?: CamposTiktok },
): Destino {
  return definidos({
    platform,
    format,
    overrides: {},
    youtube: opciones.youtube,
    tiktok: opciones.tiktok,
    scheduleVersion: 0,
    publishMode: 'manual',
    status: 'borrador',
    statusChangedAt: opciones.ahora,
    parentRef: { status: opciones.esHija ? 'en_espera' : 'no_aplica' },
    attempts: 0,
  });
}
