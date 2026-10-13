'use client';

import type { Crop, Fotograma } from '@omnistream/core';
import { cn } from '@/lib/utils';

export const ETIQUETAS_FOTOGRAMA: Record<Fotograma, string> = { start: 'Inicio', middle: 'Mitad', end: 'Final' };
const FOTOGRAMAS: Fotograma[] = ['start', 'middle', 'end'];

export interface PropsTiraFotogramas {
  urls: Partial<Record<Fotograma, string>>;
  activo: Fotograma;
  crop?: Crop;
  alElegir(fotograma: Fotograma): void;
}

// Los 3 fotogramas que extrae procesarArchivo (spec 8.1), con el recuadro del recorte encima de cada uno.
export function TiraFotogramas({ urls, activo, crop, alElegir }: PropsTiraFotogramas) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {FOTOGRAMAS.filter((f) => urls[f]).map((fotograma) => (
        <button
          key={fotograma}
          type="button"
          aria-label={`Fotograma ${ETIQUETAS_FOTOGRAMA[fotograma]}`}
          aria-pressed={fotograma === activo}
          onClick={() => alElegir(fotograma)}
          className={cn(
            'flex flex-col gap-1 rounded-[12px] border border-borde p-2',
            fotograma === activo && 'border-oro neu-hundido',
          )}
        >
          <span className="relative block overflow-hidden rounded-[8px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={urls[fotograma]} alt="" className="block w-full" />
            {crop && (
              <span
                data-recorte-tira
                className="absolute border-2 border-oro shadow-[0_0_0_999px_rgb(0_0_0/0.45)]"
                style={{
                  left: `${crop.x * 100}%`,
                  top: `${crop.y * 100}%`,
                  width: `${crop.w * 100}%`,
                  height: `${crop.h * 100}%`,
                }}
              />
            )}
          </span>
          <span className="text-xs text-texto-secundario">{ETIQUETAS_FOTOGRAMA[fotograma]}</span>
        </button>
      ))}
    </div>
  );
}
