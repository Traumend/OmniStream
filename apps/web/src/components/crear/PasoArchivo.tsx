'use client';

import { ETIQUETAS_ESTADO, formatearDuracion, type Asset } from '@omnistream/core';
import { Upload } from 'lucide-react';
import { useState, type ChangeEvent, type ReactNode } from 'react';
import type { GestorSubidas, ProgresoSubida } from '@/lib/archivos/gestorSubidas';
import { cn } from '@/lib/utils';
import { Seccion } from './comunes';

const EXTENSIONES = '.mp4,.mov,.webm,.jpg,.jpeg,.png,.webp,.heic';

export interface PropsPasoArchivo {
  archivos: Asset[];
  subidas: ReadonlyMap<string, ProgresoSubida>;
  elegido: string;
  alElegir(assetId: string): void;
  alSubir?(archivo: File): ReturnType<GestorSubidas['iniciar']>;
  renderMiniatura?(asset: Asset): ReactNode;
}

function Progreso({ progreso }: { progreso: ProgresoSubida }) {
  const porcentaje =
    progreso.bytesTotales > 0 ? Math.round((progreso.bytesTransferidos / progreso.bytesTotales) * 100) : 0;
  return (
    <span className="flex items-center gap-2">
      <span
        role="progressbar"
        aria-label={`Subida de ${progreso.nombre}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={porcentaje}
        className="neu-hundido h-2 w-28 overflow-hidden rounded-full"
      >
        <span className="block h-full bg-oro" style={{ width: `${porcentaje}%` }} />
      </span>
      <span className="cifras text-xs text-texto-secundario">{porcentaje} %</span>
    </span>
  );
}

// Spec 8.1: archivos listos y en proceso, y una subida que se elige en cuanto se crea su documento.
export function PasoArchivo({ archivos, subidas, elegido, alElegir, alSubir, renderMiniatura }: PropsPasoArchivo) {
  const [error, setError] = useState<string | null>(null);

  async function alSeleccionar(evento: ChangeEvent<HTMLInputElement>) {
    const archivo = evento.target.files?.[0];
    evento.target.value = '';
    if (!archivo || !alSubir) return;
    setError(null);
    const resultado = await alSubir(archivo);
    if (resultado.ok) alElegir(resultado.assetId);
    else setError(`${archivo.name}: ${resultado.mensaje}`);
  }

  return (
    <Seccion titulo="Archivo">
      {alSubir && (
        <div>
          <label className="boton-oro inline-flex cursor-pointer items-center gap-2 rounded-[14px] px-5 py-2 font-heading text-lg font-semibold focus-within:ring-2 focus-within:ring-oro">
            <Upload className="size-5" aria-hidden="true" />
            Subir archivo
            <input type="file" accept={EXTENSIONES} className="sr-only" onChange={(e) => void alSeleccionar(e)} />
          </label>
        </div>
      )}
      {error && (
        <p role="alert" className="text-peligro">
          {error}
        </p>
      )}
      {archivos.length === 0 ? (
        <p className="text-texto-secundario">Aún no hay archivos. Sube uno para empezar.</p>
      ) : (
        <div role="radiogroup" aria-label="Archivo" className="grid gap-3 sm:grid-cols-2">
          {archivos.map((archivo) => {
            const progreso = subidas.get(archivo.id);
            const detalles = [
              archivo.durationSec ? formatearDuracion(archivo.durationSec) : null,
              archivo.width && archivo.height ? `${archivo.width} × ${archivo.height}` : null,
            ].filter(Boolean);
            return (
              <label
                key={archivo.id}
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-[14px] border border-borde p-3',
                  elegido === archivo.id && 'border-oro neu-hundido',
                )}
              >
                <input
                  type="radio"
                  name="archivo"
                  value={archivo.id}
                  checked={elegido === archivo.id}
                  onChange={() => alElegir(archivo.id)}
                  className="size-4 accent-[var(--oro)]"
                />
                {renderMiniatura?.(archivo)}
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="truncate text-texto">{archivo.originalName}</span>
                  {archivo.status === 'listo' ? (
                    <span className="cifras text-sm text-texto-secundario">{detalles.join(' · ')}</span>
                  ) : progreso && progreso.estado !== 'completada' ? (
                    <Progreso progreso={progreso} />
                  ) : (
                    <span className="text-sm text-texto-secundario">{ETIQUETAS_ESTADO[archivo.status]}</span>
                  )}
                </span>
              </label>
            );
          })}
        </div>
      )}
    </Seccion>
  );
}
