'use client';

import {
  ajustarRecorte,
  ASPECTOS_RECORTE,
  recorteCentrado,
  type Crop,
  type Derivado,
  type ReglaFormato,
} from '@omnistream/core';
import { Minus, Plus } from 'lucide-react';
import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const PASO_TECLADO = 0.01;
const FACTOR_ZOOM = 1.1;
const DESPLAZAMIENTOS: Record<string, { dx?: number; dy?: number }> = {
  ArrowLeft: { dx: -PASO_TECLADO },
  ArrowRight: { dx: PASO_TECLADO },
  ArrowUp: { dy: -PASO_TECLADO },
  ArrowDown: { dy: PASO_TECLADO },
};
const TEXTO_DERIVADO: Record<Derivado['status'], string> = {
  pendiente: 'Generando recorte…',
  generando: 'Generando recorte…',
  listo: 'Recorte listo',
  fallido: 'No se pudo generar el recorte.',
};

export interface PropsMarcoRecorte {
  imagen?: string;
  ancho: number; // dimensiones del original ya rotado
  alto: number;
  crop?: Crop;
  regla: ReglaFormato;
  compatible: boolean; // la proporción del archivo ya sirve para la red
  permitido: boolean; // recortePermitido del archivo
  estadoDerivado?: Derivado['status'];
  alCambiar(crop: Crop | undefined): void;
}

// Spec 8.3: proporciones con las recomendadas marcadas, "Aplicar guía", recuadro que se arrastra, se mueve con las
// flechas y se amplía con la rueda o los botones. Todo pasa por ajustarRecorte, que lo mantiene dentro del cuadro.
export function MarcoRecorte({
  imagen,
  ancho,
  alto,
  crop,
  regla,
  compatible,
  permitido,
  estadoDerivado,
  alCambiar,
}: PropsMarcoRecorte) {
  const lienzo = useRef<HTMLDivElement>(null);
  const recuadro = useRef<HTMLDivElement>(null);
  const arrastre = useRef<{ x: number; y: number; crop: Crop } | null>(null);
  const actual = useRef({ crop, alCambiar });
  useEffect(() => {
    actual.current = { crop, alCambiar };
  });

  // La rueda amplía el recorte sin desplazar la página: el listener nativo no es pasivo.
  useEffect(() => {
    const elemento = recuadro.current;
    if (!elemento) return;
    const alGirar = (evento: WheelEvent) => {
      const { crop: vigente, alCambiar: cambiar } = actual.current;
      if (!vigente) return;
      evento.preventDefault();
      cambiar(ajustarRecorte(vigente, { escala: evento.deltaY < 0 ? FACTOR_ZOOM : 1 / FACTOR_ZOOM }));
    };
    elemento.addEventListener('wheel', alGirar, { passive: false });
    return () => elemento.removeEventListener('wheel', alGirar);
  }, [crop !== undefined]); // eslint-disable-line react-hooks/exhaustive-deps

  const recomendada = regla.proporciones[0];

  function alTeclear(evento: KeyboardEvent<HTMLDivElement>) {
    const cambio = DESPLAZAMIENTOS[evento.key];
    if (!crop || !cambio) return;
    evento.preventDefault();
    alCambiar(ajustarRecorte(crop, cambio));
  }

  function alPresionar(evento: PointerEvent<HTMLDivElement>) {
    if (!crop) return;
    evento.currentTarget.setPointerCapture(evento.pointerId);
    arrastre.current = { x: evento.clientX, y: evento.clientY, crop };
  }

  function alMover(evento: PointerEvent<HTMLDivElement>) {
    const inicio = arrastre.current;
    const caja = lienzo.current?.getBoundingClientRect();
    if (!inicio || !caja || caja.width === 0 || caja.height === 0) return;
    alCambiar(
      ajustarRecorte(inicio.crop, {
        dx: (evento.clientX - inicio.x) / caja.width,
        dy: (evento.clientY - inicio.y) / caja.height,
      }),
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-heading text-lg text-texto">Recorte</h3>
      {!permitido && (
        <p className="text-sm text-peligro">El recorte de video se permite para videos de hasta 15 minutos y 2 GB.</p>
      )}

      <div role="group" aria-label="Proporción" className="flex flex-wrap gap-2">
        {ASPECTOS_RECORTE.map((aspecto) => {
          const esRecomendada = regla.proporciones.includes(aspecto);
          return (
            <button
              key={aspecto}
              type="button"
              disabled={!permitido}
              aria-pressed={crop?.aspect === aspecto}
              onClick={() => alCambiar(recorteCentrado(aspecto, ancho, alto))}
              className={cn(
                'cifras flex flex-col items-center rounded-[10px] border border-borde px-2.5 py-1 text-sm text-texto disabled:opacity-40',
                crop?.aspect === aspecto && 'border-oro neu-hundido',
              )}
            >
              {aspecto}
              {esRecomendada && <span className="text-[10px] text-oro-profundo">Recomendada</span>}
            </button>
          );
        })}
      </div>

      {permitido && !crop && !compatible && recomendada && (
        <Button
          type="button"
          className="boton-oro"
          onClick={() => alCambiar(recorteCentrado(recomendada, ancho, alto))}
        >
          Aplicar guía {recomendada}
        </Button>
      )}

      <div
        ref={lienzo}
        className="relative w-full overflow-hidden rounded-[12px] bg-black"
        style={{ aspectRatio: ancho / alto }}
      >
        {imagen && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imagen} alt="" draggable={false} className="absolute inset-0 size-full select-none" />
        )}
        {crop && (
          <div
            ref={recuadro}
            role="group"
            aria-label="Recorte"
            aria-roledescription="recuadro movible"
            tabIndex={0}
            onKeyDown={alTeclear}
            onPointerDown={alPresionar}
            onPointerMove={alMover}
            onPointerUp={() => (arrastre.current = null)}
            onPointerCancel={() => (arrastre.current = null)}
            className="absolute cursor-move touch-none border-2 border-oro shadow-[0_0_0_999px_rgb(0_0_0/0.5)] outline-none focus-visible:ring-2 focus-visible:ring-oro-claro"
            style={{
              left: `${crop.x * 100}%`,
              top: `${crop.y * 100}%`,
              width: `${crop.w * 100}%`,
              height: `${crop.h * 100}%`,
            }}
          />
        )}
      </div>

      {crop && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            aria-label="Ampliar"
            onClick={() => alCambiar(ajustarRecorte(crop, { escala: FACTOR_ZOOM }))}
          >
            <Plus className="size-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="outline"
            aria-label="Reducir"
            onClick={() => alCambiar(ajustarRecorte(crop, { escala: 1 / FACTOR_ZOOM }))}
          >
            <Minus className="size-4" aria-hidden="true" />
          </Button>
          <Button type="button" variant="outline" onClick={() => alCambiar(undefined)}>
            Quitar recorte
          </Button>
        </div>
      )}
      {crop && estadoDerivado && (
        <p
          role="status"
          className={cn('text-sm', estadoDerivado === 'fallido' ? 'text-peligro' : 'text-texto-secundario')}
        >
          {TEXTO_DERIVADO[estadoDerivado]}
        </p>
      )}
    </div>
  );
}
