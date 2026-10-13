'use client';

import {
  ETIQUETAS_RED,
  VALOR_PROPORCION,
  zonasSeguras,
  type Asset,
  type Crop,
  type FormatoDestino,
  type Fotograma,
  type Platform,
  type Problema,
} from '@omnistream/core';
import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { CapaZonasSeguras } from './canvas/CapaZonasSeguras';
import { ListaRedes } from './canvas/ListaRedes';
import { TiraFotogramas } from './canvas/TiraFotogramas';
import { Seccion } from './comunes';

export interface DestinoCanvas {
  platform: Platform;
  format: FormatoDestino;
  personalizado: boolean;
  crop?: Crop;
}

export interface PropsPasoCanvas {
  asset: Asset | null;
  destinos: DestinoCanvas[];
  problemas: Problema[];
  urls: Partial<Record<Fotograma, string>>;
  // Controles de la red activa (recorte y ajustes), a la derecha del marco.
  controles?(red: Platform, imagen: string | undefined): ReactNode;
}

// Spec 8.3: redes a la izquierda, el fotograma en el marco de la red al centro, controles a la derecha y la
// tira de fotogramas abajo.
export function PasoCanvas({ asset, destinos, problemas, urls, controles }: PropsPasoCanvas) {
  const [elegida, setElegida] = useState<Platform | undefined>(destinos[0]?.platform);
  const [fotograma, setFotograma] = useState<Fotograma>('start');
  const [conZonas, setConZonas] = useState(false);

  const activo = destinos.find((d) => d.platform === elegida) ?? destinos[0];
  if (!activo) {
    return (
      <Seccion titulo="Canvas">
        <p className="text-texto-secundario">Elige al menos una red en Destinos.</p>
      </Seccion>
    );
  }
  const red = activo.platform;
  const imagen = urls[fotograma] ?? urls.start;
  const proporcion = activo.crop ? VALOR_PROPORCION[activo.crop.aspect] : (asset?.aspect ?? 1);
  const avisos = problemas.filter((p) => p.red === undefined || p.red === red);

  return (
    <Seccion titulo="Canvas">
      <div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)_260px]">
        <ListaRedes destinos={destinos} problemas={problemas} activa={red} alElegir={setElegida} />

        <div className="flex min-w-0 flex-col items-center gap-4">
          <figure
            aria-label={`Marco de ${ETIQUETAS_RED[red]}`}
            className="neu-hundido relative w-full max-w-[420px] overflow-hidden rounded-[16px] bg-black"
            style={{ aspectRatio: proporcion, maxHeight: '60vh' }}
          >
            {imagen ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imagen} alt="Fotograma en el marco" className="absolute inset-0 size-full object-cover" />
            ) : (
              <p className="absolute inset-0 grid place-items-center p-4 text-center text-sm text-white/80">
                Los fotogramas aparecen cuando el archivo termina de procesarse.
              </p>
            )}
            {conZonas && <CapaZonasSeguras zonas={zonasSeguras(red, activo.format)} />}
          </figure>
          {avisos.length > 0 && (
            <ul aria-label={`Avisos de ${ETIQUETAS_RED[red]}`} className="flex w-full flex-col gap-1 text-sm">
              {avisos.map((aviso) => (
                <li key={aviso.mensaje} className={cn(aviso.nivel === 'error' ? 'text-peligro' : 'text-alerta')}>
                  {aviso.mensaje}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <button
            type="button"
            role="switch"
            aria-checked={conZonas}
            onClick={() => setConZonas((v) => !v)}
            className="flex items-center justify-between gap-3 rounded-[12px] border border-borde px-3 py-2 text-texto"
          >
            Zonas seguras
            <span
              aria-hidden="true"
              className={cn('relative h-5 w-9 rounded-full transition-colors', conZonas ? 'bg-oro' : 'bg-borde')}
            >
              <span
                className={cn(
                  'absolute top-0.5 size-4 rounded-full bg-superficie-elevada transition-[left]',
                  conZonas ? 'left-[18px]' : 'left-0.5',
                )}
              />
            </span>
          </button>
          {controles?.(red, imagen)}
        </div>
      </div>

      <TiraFotogramas urls={urls} activo={fotograma} crop={activo.crop} alElegir={setFotograma} />
    </Seccion>
  );
}
