import {
  ABREVIATURAS_RED,
  ETIQUETAS_ESTADO_DESTINO,
  ETIQUETAS_RED,
  type EstadoDestino,
  type Platform,
} from '@omnistream/core';
import { cn } from '@/lib/utils';

const TONOS: Record<EstadoDestino, string> = {
  borrador: 'text-texto-secundario border-borde',
  programada: 'text-oro-profundo border-oro-claro',
  publicando: 'text-oro-profundo border-oro',
  publicada: 'text-exito border-exito/40',
  fallida: 'text-peligro border-peligro/40',
  pendiente_manual: 'text-alerta border-alerta/40',
  cancelada: 'text-texto-secundario border-borde line-through',
};

export function InsigniaRed({ platform, estado }: { platform: Platform; estado?: EstadoDestino }) {
  const etiqueta = estado ? `${ETIQUETAS_RED[platform]}: ${ETIQUETAS_ESTADO_DESTINO[estado]}` : ETIQUETAS_RED[platform];
  return (
    <span
      aria-label={etiqueta}
      title={etiqueta}
      className={cn(
        'etiqueta-ornamental inline-flex h-6 min-w-8 items-center justify-center rounded-full border bg-superficie-elevada px-1.5 text-[0.6rem] font-semibold',
        estado ? TONOS[estado] : 'text-texto-secundario border-borde',
      )}
    >
      {ABREVIATURAS_RED[platform]}
    </span>
  );
}
