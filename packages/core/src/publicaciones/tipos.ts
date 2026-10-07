import type { Fotograma } from '../archivos/fotogramas';

export const PLATAFORMAS = ['facebook', 'instagram', 'youtube', 'tiktok'] as const;
export type Platform = (typeof PLATAFORMAS)[number];

export const ETIQUETAS_RED: Record<Platform, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  youtube: 'YouTube',
  tiktok: 'TikTok',
};

export const ABREVIATURAS_RED: Record<Platform, string> = { facebook: 'FB', instagram: 'IG', youtube: 'YT', tiktok: 'TT' };

export const FORMATOS = ['video_largo', 'short', 'reel', 'tiktok', 'imagen'] as const;
export type FormatoDestino = (typeof FORMATOS)[number];

export const ETIQUETAS_FORMATO: Record<FormatoDestino, string> = {
  video_largo: 'Video largo',
  short: 'Short',
  reel: 'Reel',
  tiktok: 'Video de TikTok',
  imagen: 'Imagen',
};

export const FORMATOS_POR_RED: Record<Platform, readonly FormatoDestino[]> = {
  facebook: ['reel', 'video_largo', 'imagen'],
  instagram: ['reel', 'imagen'],
  youtube: ['video_largo', 'short'],
  tiktok: ['tiktok', 'imagen'],
};

export type EstadoDestino =
  | 'borrador'
  | 'programada'
  | 'publicando'
  | 'publicada'
  | 'fallida'
  | 'pendiente_manual'
  | 'cancelada';
export type EstadoPublicacion = 'idea' | 'borrador' | 'programada' | 'publicando' | 'publicada' | 'parcial' | 'fallida';
export type TipoPublicacion = 'principal' | 'hija' | 'independiente';
export type EstadoReferencia = 'no_aplica' | 'en_espera' | 'pendiente' | 'publicada' | 'fallida';
export type ModoPublicacion = 'api' | 'manual';
export type TipoError = 'temporal' | 'definitivo' | 'ambiguo' | 'auth';

export interface CamposYoutube {
  description: string;
  tags: string[];
  categoryId: string;
  privacy: 'public' | 'unlisted' | 'private';
  madeForKids: boolean;
  thumbnail?: { frame: Fotograma };
}

export const CAMPOS_YOUTUBE_POR_DEFECTO: CamposYoutube = {
  description: '',
  tags: [],
  categoryId: '22',
  privacy: 'public',
  madeForKids: false,
};

export const CATEGORIAS_YOUTUBE: { id: string; nombre: string }[] = [
  { id: '1', nombre: 'Cine y animación' },
  { id: '2', nombre: 'Autos y vehículos' },
  { id: '10', nombre: 'Música' },
  { id: '15', nombre: 'Mascotas y animales' },
  { id: '17', nombre: 'Deportes' },
  { id: '19', nombre: 'Viajes y eventos' },
  { id: '20', nombre: 'Videojuegos' },
  { id: '22', nombre: 'Personas y blogs' },
  { id: '23', nombre: 'Comedia' },
  { id: '24', nombre: 'Entretenimiento' },
  { id: '25', nombre: 'Noticias y política' },
  { id: '26', nombre: 'Consejos y estilo' },
  { id: '27', nombre: 'Educación' },
  { id: '28', nombre: 'Ciencia y tecnología' },
  { id: '29', nombre: 'ONG y activismo' },
];

export interface RemoteRef {
  id: string;
  url: string;
}

export interface Publicacion {
  id: string;
  kind: TipoPublicacion;
  parentId?: string;
  status: EstadoPublicacion;
  title: string;
  assetId?: string;
  base: { text: string; hashtags: string[] };
  scheduledAt: Date | null;
  targetStatus: Partial<Record<Platform, EstadoDestino>>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Destino {
  platform: Platform;
  format: FormatoDestino;
  overrides: { text?: string; hashtags?: string[]; title?: string; scheduledAt?: Date };
  youtube?: CamposYoutube;
  scheduledAt?: Date;
  scheduleVersion: number;
  enqueuedVersion?: number;
  publishMode: ModoPublicacion;
  status: EstadoDestino;
  statusChangedAt: Date;
  lease?: { attemptId: string; until: Date };
  checkpoint?: { stage: string; data: Record<string, unknown> };
  remote?: RemoteRef & { publishedAt: Date };
  parentRef: { status: EstadoReferencia; remoteCommentId?: string };
  attempts: number;
  lastError?: { code: string; message: string; kind: TipoError; at: Date };
}

export interface Intento {
  id: string;
  at: Date;
  stage: string;
  result: 'ok' | 'error' | 'omitido';
  error?: string;
}

export const ETIQUETAS_ESTADO_DESTINO: Record<EstadoDestino, string> = {
  borrador: 'Borrador',
  programada: 'Programada',
  publicando: 'Publicando',
  publicada: 'Publicada',
  fallida: 'Fallida',
  pendiente_manual: 'Pendiente manual',
  cancelada: 'Cancelada',
};

export const ETIQUETAS_ESTADO_PUBLICACION: Record<EstadoPublicacion, string> = {
  idea: 'Idea',
  borrador: 'Borrador',
  programada: 'Programada',
  publicando: 'Publicando',
  publicada: 'Publicada',
  parcial: 'Parcial',
  fallida: 'Fallida',
};

export const ETIQUETAS_TIPO: Record<TipoPublicacion, string> = {
  principal: 'Principal',
  hija: 'Hija',
  independiente: 'Independiente',
};
