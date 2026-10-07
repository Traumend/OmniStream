'use client';

import { ETIQUETAS_ESTADO, formatearBytes, formatearDuracion, type Asset, type EstadoVisible } from '@omnistream/core';
import { Film, ImageIcon, Pause, Play, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import type { ProgresoSubida } from '@/lib/archivos/gestorSubidas';
import { cn } from '@/lib/utils';

const TONO_ESTADO: Record<EstadoVisible, string> = {
  subiendo: 'text-oro-profundo border-oro-claro',
  procesando: 'text-oro-profundo border-oro-claro',
  listo: 'text-exito border-exito/40',
  fallido: 'text-peligro border-peligro/40',
  interrumpido: 'text-peligro border-peligro/40',
  purgado: 'text-texto-secundario border-borde',
};

function etiquetaEstado(estado: EstadoVisible, progreso?: ProgresoSubida): string {
  if (progreso?.estado === 'error') return 'Error en la subida';
  if (estado !== 'subiendo' || !progreso) return ETIQUETAS_ESTADO[estado];
  if (progreso.estado === 'completada') return ETIQUETAS_ESTADO.procesando;
  const porcentaje = progreso.bytesTotales > 0 ? Math.floor((progreso.bytesTransferidos * 100) / progreso.bytesTotales) : 0;
  return `${progreso.estado === 'pausada' ? 'En pausa' : 'Subiendo'} ${porcentaje}%`;
}

const ELIMINABLES: ReadonlySet<EstadoVisible> = new Set(['interrumpido', 'listo', 'fallido', 'procesando']);

export function TarjetaArchivo({
  asset,
  estado,
  progreso,
  miniatura,
  alAbrir,
  alPausar,
  alReanudar,
  alCancelar,
  alEliminar,
}: {
  asset: Asset;
  estado: EstadoVisible;
  progreso?: ProgresoSubida;
  miniatura?: string;
  alAbrir(): void;
  alPausar?(): void;
  alReanudar?(): void;
  alCancelar?(): void;
  alEliminar(): void;
}) {
  const Icono = asset.kind === 'image' ? ImageIcon : Film;
  const subiendo =
    estado === 'subiendo' && progreso && (progreso.estado === 'subiendo' || progreso.estado === 'pausada') ? progreso : null;
  const errorSubida = progreso?.estado === 'error' ? progreso.error : undefined;
  const detalles = [
    formatearBytes(asset.sizeBytes),
    asset.durationSec ? formatearDuracion(asset.durationSec) : null,
    asset.width && asset.height ? `${asset.width} × ${asset.height}` : null,
  ].filter((d): d is string => d !== null);

  return (
    <article aria-label={asset.originalName} className="neu-elevado flex flex-col overflow-hidden">
      <button
        type="button"
        onClick={alAbrir}
        className="relative flex aspect-video items-center justify-center overflow-hidden bg-fondo text-oro"
        aria-label={`Ver detalle de ${asset.originalName}`}
      >
        {miniatura ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={miniatura} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <Icono className="size-10" strokeWidth={1.3} aria-hidden="true" />
        )}
        <span
          className={cn(
            'etiqueta-ornamental absolute top-3 left-3 rounded-full border bg-superficie-elevada/95 px-2.5 py-1 text-[0.6rem]',
            errorSubida ? TONO_ESTADO.fallido : TONO_ESTADO[estado],
          )}
        >
          {etiquetaEstado(estado, progreso)}
        </span>
      </button>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="truncate font-heading text-lg font-semibold text-texto" title={asset.originalName}>
          {asset.originalName}
        </p>
        <ul className="cifras flex flex-wrap gap-x-3 gap-y-1 text-sm text-texto-secundario">
          <li className="flex items-center gap-1">
            <Icono className="size-3.5 text-oro" aria-hidden="true" />
            {asset.kind === 'image' ? 'Imagen' : 'Video'}
          </li>
          {detalles.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>

        {subiendo && (
          <Progress value={(subiendo.bytesTransferidos * 100) / Math.max(subiendo.bytesTotales, 1)} className="mt-1 h-1.5" />
        )}
        {errorSubida && <p className="text-sm text-peligro">{errorSubida}</p>}

        <div className="mt-auto flex gap-2 pt-2">
          {subiendo && subiendo.estado !== 'pausada' && alPausar && (
            <Button variant="outline" size="sm" onClick={alPausar}>
              <Pause /> Pausar
            </Button>
          )}
          {subiendo && subiendo.estado === 'pausada' && alReanudar && (
            <Button variant="outline" size="sm" onClick={alReanudar}>
              <Play /> Reanudar
            </Button>
          )}
          {subiendo && alCancelar && (
            <Button variant="ghost" size="sm" onClick={alCancelar}>
              <X /> Cancelar
            </Button>
          )}
          {ELIMINABLES.has(estado) && (
            <Button variant="ghost" size="sm" className="text-peligro" onClick={alEliminar}>
              <Trash2 /> Eliminar
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
