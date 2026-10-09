'use client';

import {
  ETIQUETAS_TIPO_PROMOCION,
  TIPOS_PROMOCION,
  type PlantillaPromocion as Plantilla,
  type TipoPromocion,
} from '@omnistream/core';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const SELECTOR = 'h-10 rounded-[12px] border border-borde bg-superficie-elevada px-2 text-base text-texto';
const CAMPO = 'h-10 rounded-[12px] bg-superficie-elevada text-base';

// Pendientes que recibe cada Principal nuevo, con los días que pasan desde su publicación.
export function PlantillaPromocion({
  valores,
  alCambiar,
}: {
  valores: Plantilla[];
  alCambiar(valores: Plantilla[]): void;
}) {
  const cambiar = (indice: number, cambios: Partial<Plantilla>) =>
    alCambiar(valores.map((p, i) => (i === indice ? { ...p, ...cambios } : p)));

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {valores.map((pendiente, i) => {
          const n = i + 1;
          return (
            <li key={i} className="grid grid-cols-[8rem_1fr_5rem_auto] items-center gap-2">
              <select
                aria-label={`Tipo del pendiente ${n}`}
                value={pendiente.type}
                onChange={(e) => cambiar(i, { type: e.target.value as TipoPromocion })}
                className={SELECTOR}
              >
                {TIPOS_PROMOCION.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {ETIQUETAS_TIPO_PROMOCION[tipo]}
                  </option>
                ))}
              </select>
              <Input
                aria-label={`Título del pendiente ${n}`}
                value={pendiente.title}
                onChange={(e) => cambiar(i, { title: e.target.value })}
                className={CAMPO}
              />
              <Input
                aria-label={`Días del pendiente ${n}`}
                type="number"
                min={-30}
                max={365}
                value={Number.isNaN(pendiente.offsetDays) ? '' : pendiente.offsetDays}
                onChange={(e) => cambiar(i, { offsetDays: e.target.valueAsNumber })}
                className={`cifras ${CAMPO}`}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label={`Quitar pendiente ${n}`}
                onClick={() => alCambiar(valores.filter((_, j) => j !== i))}
              >
                Quitar
              </Button>
            </li>
          );
        })}
      </ul>
      <p className="text-sm text-texto-secundario">Días desde la publicación del video principal (0 = el mismo día).</p>
      <Button
        type="button"
        variant="outline"
        className="self-start"
        onClick={() => alCambiar([...valores, { type: 'short', title: 'Nuevo pendiente', offsetDays: 1 }])}
      >
        Agregar a la plantilla
      </Button>
    </div>
  );
}
