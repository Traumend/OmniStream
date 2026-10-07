export type Fotograma = 'start' | 'middle' | 'end';

const redondear = (valor: number, decimales: number) => {
  const factor = 10 ** decimales;
  return Math.round(valor * factor) / factor;
};

export function tiemposDeFotogramas(durationSec: number): Record<Fotograma, number> {
  if (!Number.isFinite(durationSec) || durationSec <= 0) throw new RangeError('Duración inválida');
  const d = durationSec;
  const tiempos = d >= 2 ? { start: 1, middle: d / 2, end: d - 1 } : { start: 0, middle: d / 2, end: Math.max(0, d - 0.1) };
  return {
    start: redondear(tiempos.start, 3),
    middle: redondear(tiempos.middle, 3),
    end: redondear(tiempos.end, 3),
  };
}

export function dimensionesEfectivas(
  ancho: number,
  alto: number,
  rotacion: number,
): { width: number; height: number; aspect: number } {
  const giro = ((rotacion % 360) + 360) % 360;
  const [width, height] = giro === 90 || giro === 270 ? [alto, ancho] : [ancho, alto];
  return { width, height, aspect: redondear(width / height, 4) };
}

const PROPORCIONES: { etiqueta: string; valor: number }[] = [
  { etiqueta: '9:16', valor: 9 / 16 },
  { etiqueta: '16:9', valor: 16 / 9 },
  { etiqueta: '1:1', valor: 1 },
  { etiqueta: '4:5', valor: 4 / 5 },
  { etiqueta: '1.91:1', valor: 1.91 },
];

export function describirProporcion(aspect: number): string {
  const comun = PROPORCIONES.find((p) => Math.abs(aspect - p.valor) / p.valor <= 0.02);
  return comun ? comun.etiqueta : `${redondear(aspect, 2)}:1`;
}
