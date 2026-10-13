import type { FormatoDestino, Platform } from './tipos';

// Rectángulo en porcentajes (0 a 100) del cuadro de la publicación.
export interface ZonaSegura {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Spec 8.3. Aproximaciones propias de la interfaz de cada red, sin cifras oficiales: se muestran como guía.
const REEL_INSTAGRAM: ZonaSegura[] = [
  { x: 0, y: 0, w: 100, h: 10 },
  { x: 0, y: 78, w: 100, h: 22 },
  { x: 85, y: 45, w: 15, h: 35 },
];

export const ZONAS_SEGURAS: Partial<Record<Platform, Partial<Record<FormatoDestino, ZonaSegura[]>>>> = {
  tiktok: {
    tiktok: [
      { x: 0, y: 0, w: 100, h: 8 },
      { x: 0, y: 80, w: 100, h: 20 },
      { x: 86, y: 40, w: 14, h: 40 },
    ],
  },
  instagram: { reel: REEL_INSTAGRAM },
  facebook: { reel: REEL_INSTAGRAM },
  youtube: {
    short: [
      { x: 0, y: 0, w: 100, h: 9 },
      { x: 0, y: 80, w: 100, h: 20 },
      { x: 84, y: 42, w: 16, h: 38 },
    ],
  },
};

export const zonasSeguras = (red: Platform, formato: FormatoDestino): ZonaSegura[] =>
  ZONAS_SEGURAS[red]?.[formato] ?? [];
