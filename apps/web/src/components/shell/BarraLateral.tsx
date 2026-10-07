'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Meandro } from '@/components/marca/Meandro';
import { cn } from '@/lib/utils';
import { estaDisponible, NAV_LATERAL } from './navegacion';

export function BarraLateral({ alNavegar }: { alNavegar?: () => void }) {
  const ruta = usePathname();
  return (
    <nav aria-label="Secciones" className="flex h-full flex-col gap-1.5">
      <ul className="flex flex-col gap-1.5">
        {NAV_LATERAL.map((item) => {
          const activo = ruta === item.ruta || ruta.startsWith(`${item.ruta}/`);
          const Icono = item.icono;
          return (
            <li key={item.ruta}>
              <Link
                href={item.ruta}
                onClick={alNavegar}
                aria-current={activo ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-[14px] border-l-[3px] border-transparent px-4 py-2.5 font-heading text-lg text-texto transition-colors hover:bg-accent',
                  activo && 'neu-elevado border-l-[3px] border-l-oro font-semibold',
                )}
              >
                <Icono className="size-5 shrink-0 text-oro" strokeWidth={1.6} aria-hidden="true" />
                <span className="flex-1">{item.etiqueta}</span>
                {!estaDisponible(item) && (
                  <span className="etiqueta-ornamental rounded-full border border-borde px-2 py-0.5 text-[0.55rem] text-texto-secundario">
                    Fase {item.fase}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="mt-auto flex flex-col gap-3 px-4 pt-8 pb-2">
        <Meandro className="text-oro-claro" />
        <p className="etiqueta-ornamental text-[0.6rem] leading-relaxed text-texto-secundario">
          CREAR · AUTOMATIZAR · AMPLIFICAR
        </p>
      </div>
    </nav>
  );
}
