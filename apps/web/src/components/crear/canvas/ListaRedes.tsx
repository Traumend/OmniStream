'use client';

import {
  ETIQUETAS_FORMATO,
  ETIQUETAS_RED,
  estadoDeRed,
  type FormatoDestino,
  type Platform,
  type Problema,
} from '@omnistream/core';
import { cn } from '@/lib/utils';

const ESTADOS = {
  correcto: { texto: 'Correcto', clase: 'text-exito border-exito/40' },
  advertencia: { texto: 'Advertencia', clase: 'text-alerta border-alerta/40' },
  error: { texto: 'Error', clase: 'text-peligro border-peligro/40' },
} as const;

export interface PropsListaRedes {
  destinos: { platform: Platform; format: FormatoDestino; personalizado: boolean }[];
  problemas: Problema[];
  activa: Platform;
  alElegir(red: Platform): void;
}

// El estado de cada red sale de validarPublicacion, la misma validación que aplica el servidor.
export function ListaRedes({ destinos, problemas, activa, alElegir }: PropsListaRedes) {
  return (
    <ul aria-label="Redes" className="flex flex-col gap-2">
      {destinos.map((destino) => {
        const estado = ESTADOS[estadoDeRed(problemas, destino.platform)];
        return (
          <li key={destino.platform}>
            <button
              type="button"
              aria-pressed={destino.platform === activa}
              onClick={() => alElegir(destino.platform)}
              className={cn(
                'flex w-full flex-col items-start gap-1 rounded-[14px] border border-borde p-3 text-left',
                destino.platform === activa && 'border-oro neu-hundido',
              )}
            >
              <span className="font-heading text-lg text-texto">{ETIQUETAS_RED[destino.platform]}</span>
              <span className="text-xs text-texto-secundario">{ETIQUETAS_FORMATO[destino.format]}</span>
              <span className="flex flex-wrap gap-1">
                <span className={cn('rounded-full border px-2 py-0.5 text-xs', estado.clase)}>{estado.texto}</span>
                {destino.personalizado && (
                  <span className="rounded-full border border-oro px-2 py-0.5 text-xs text-oro-profundo">
                    Personalizado
                  </span>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
