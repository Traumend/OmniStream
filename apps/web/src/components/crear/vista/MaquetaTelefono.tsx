'use client';

import { ETIQUETAS_RED, VALOR_PROPORCION, type Crop, type FormatoDestino, type Platform } from '@omnistream/core';
import { useState } from 'react';
import { estiloRecorte } from '@/lib/crear/recorteVisual';
import { cn } from '@/lib/utils';

// Decisión 8: a partir de cuántos caracteres cada red corta el texto con "... más".
export const CORTE_TEXTO: Record<Platform, number> = { instagram: 125, facebook: 125, tiktok: 80, youtube: 100 };

export function textoCortado(texto: string, limite: number): { visible: string; cortado: boolean } {
  const caracteres = Array.from(texto);
  return caracteres.length > limite
    ? { visible: caracteres.slice(0, limite).join(''), cortado: true }
    : { visible: texto, cortado: false };
}

export interface PropsMaqueta {
  red: Platform;
  formato: FormatoDestino;
  cuenta: { nombre: string; avatarUrl?: string };
  medio?: { tipo: 'video' | 'imagen'; url: string };
  proporcionArchivo?: number;
  crop?: Crop;
  titulo?: string;
  texto: string;
}

// Aproximación propia de cómo se ve la publicación en el teléfono (spec 8.5), no una copia de cada app.
export function MaquetaTelefono({ red, formato, cuenta, medio, proporcionArchivo, crop, titulo, texto }: PropsMaqueta) {
  const [completo, setCompleto] = useState(false);
  const { visible, cortado } = textoCortado(texto, CORTE_TEXTO[red]);
  const proporcion = crop ? VALOR_PROPORCION[crop.aspect] : (proporcionArchivo ?? 9 / 16);
  const vertical = formato !== 'video_largo' && formato !== 'imagen';
  const estiloMedio = crop ? estiloRecorte(crop) : undefined;
  const claseMedio = cn('absolute max-w-none', !crop && 'inset-0 size-full object-contain');

  return (
    <section aria-label={`Vista previa en ${ETIQUETAS_RED[red]}`} className="flex flex-col items-center gap-2">
      <div className="neu-elevado flex w-[270px] flex-col overflow-hidden rounded-[32px] border-[6px] border-texto/80 bg-black text-white">
        <div className="flex items-center gap-2 px-3 py-2">
          {cuenta.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cuenta.avatarUrl} alt="" className="size-7 rounded-full object-cover" />
          ) : (
            <span
              aria-hidden="true"
              className="grid size-7 place-items-center rounded-full bg-oro text-xs font-semibold"
            >
              {cuenta.nombre.charAt(0).toUpperCase()}
            </span>
          )}
          <span className="truncate text-sm font-semibold">{cuenta.nombre}</span>
        </div>
        <div
          className={cn('relative w-full overflow-hidden bg-neutral-900', vertical && 'max-h-[480px]')}
          style={{ aspectRatio: proporcion }}
        >
          {medio?.tipo === 'video' && (
            <video
              src={medio.url}
              aria-label="Video de la publicación"
              muted
              loop
              autoPlay
              playsInline
              className={claseMedio}
              style={estiloMedio}
            />
          )}
          {medio?.tipo === 'imagen' && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={medio.url} alt="Imagen de la publicación" className={claseMedio} style={estiloMedio} />
          )}
        </div>
        <div className="flex flex-col gap-1 px-3 py-3 text-sm">
          {titulo && <p className="font-semibold">{titulo}</p>}
          {texto && (
            <p className="whitespace-pre-wrap break-words text-white/90">
              {completo ? texto : visible}
              {cortado && !completo && (
                <button type="button" onClick={() => setCompleto(true)} className="ml-1 text-white/60">
                  ... más
                </button>
              )}
            </p>
          )}
        </div>
      </div>
      <span className="text-sm text-texto-secundario">{ETIQUETAS_RED[red]}</span>
    </section>
  );
}
