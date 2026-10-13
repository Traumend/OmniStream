'use client';

import {
  ETIQUETAS_RED,
  FORMATOS_POR_RED,
  PLATAFORMAS,
  REGLAS,
  type FormatoDestino,
  type ModoPublicacion,
  type Platform,
  type Publicacion,
} from '@omnistream/core';
import type { FormularioPublicacion } from '@/lib/publicaciones/formulario';
import { cn } from '@/lib/utils';
import { Campo, SELECTOR, Seccion } from './comunes';

const etiquetaFormato = (red: Platform, formato: FormatoDestino) =>
  REGLAS[red][formato]?.etiqueta.split(' · ')[1] ?? formato;

export interface PropsPasoDestinos {
  redes: FormularioPublicacion['redes'];
  parentId: string;
  modos: Partial<Record<Platform, ModoPublicacion>>;
  opcionesPrincipal: { publicacion: Publicacion; hijas: number }[];
  alAlternarRed(red: Platform, marcada: boolean): void;
  alCambiarFormato(red: Platform, formato: FormatoDestino): void;
  alElegirPrincipal(parentId: string): void;
}

// Spec 8.2: redes con su formato y modo, y la jerarquía con un video Principal.
export function PasoDestinos({
  redes,
  parentId,
  modos,
  opcionesPrincipal,
  alAlternarRed,
  alCambiarFormato,
  alElegirPrincipal,
}: PropsPasoDestinos) {
  const esPrincipal = redes.youtube === 'video_largo';
  return (
    <>
      <Seccion titulo="Redes">
        <div className="grid gap-3 sm:grid-cols-2">
          {PLATAFORMAS.map((red) => {
            const formato = redes[red];
            return (
              <div
                key={red}
                role="group"
                aria-label={`Red ${ETIQUETAS_RED[red]}`}
                className="flex flex-wrap items-center gap-3 rounded-[14px] border border-borde p-3"
              >
                <label className="flex flex-1 items-center gap-2 text-texto">
                  <input
                    type="checkbox"
                    checked={formato !== undefined}
                    onChange={(e) => alAlternarRed(red, e.target.checked)}
                    className="size-4 accent-[var(--oro)]"
                  />
                  {ETIQUETAS_RED[red]}
                </label>
                {formato && (
                  <select
                    aria-label={`Formato en ${ETIQUETAS_RED[red]}`}
                    value={formato}
                    onChange={(e) => alCambiarFormato(red, e.target.value as FormatoDestino)}
                    className="h-9 rounded-[10px] border border-borde bg-superficie-elevada px-2 text-sm"
                  >
                    {FORMATOS_POR_RED[red].map((f) => (
                      <option key={f} value={f}>
                        {etiquetaFormato(red, f)}
                      </option>
                    ))}
                  </select>
                )}
                {formato && (
                  <span
                    className={cn(
                      'rounded-full border px-2 py-0.5 text-xs',
                      modos[red] === 'api' ? 'border-oro text-oro-profundo' : 'border-borde text-texto-secundario',
                    )}
                  >
                    {modos[red] === 'api' ? 'Por API' : 'Manual'}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </Seccion>

      <Seccion titulo="Jerarquía">
        {esPrincipal ? (
          <p className="text-texto-secundario">Esta publicación será un video Principal.</p>
        ) : (
          <Campo id="principal" etiqueta="¿Pertenece a un video principal?">
            <select
              id="principal"
              value={parentId}
              onChange={(e) => alElegirPrincipal(e.target.value)}
              className={SELECTOR}
            >
              <option value="">No pertenece</option>
              {opcionesPrincipal.map(({ publicacion, hijas }) => (
                <option key={publicacion.id} value={publicacion.id}>
                  {`${publicacion.title} (${hijas === 1 ? '1 Hija' : `${hijas} Hijas`})`}
                </option>
              ))}
            </select>
          </Campo>
        )}
      </Seccion>
    </>
  );
}
