import type { ZonaSegura } from '@omnistream/core';

// Rectángulos semitransparentes sobre el marco: partes que la interfaz de la red suele tapar.
export function CapaZonasSeguras({ zonas }: { zonas: ZonaSegura[] }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {zonas.map((zona, indice) => (
        <div
          key={indice}
          data-zona
          className="absolute border border-dashed border-peligro/70 bg-peligro/25"
          style={{ left: `${zona.x}%`, top: `${zona.y}%`, width: `${zona.w}%`, height: `${zona.h}%` }}
        />
      ))}
    </div>
  );
}
