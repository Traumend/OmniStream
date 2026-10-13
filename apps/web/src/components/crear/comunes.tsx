import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';

export const CAMPO = 'h-11 rounded-[12px] bg-superficie-elevada text-base';
export const SELECTOR =
  'h-11 w-full rounded-[12px] border border-borde bg-superficie-elevada px-3 text-base text-texto';

export function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="neu-elevado flex flex-col gap-4 p-6">
      <h2 className="font-heading text-2xl text-texto">{titulo}</h2>
      {children}
    </section>
  );
}

export function Campo({
  id,
  etiqueta,
  ayuda,
  children,
}: {
  id: string;
  etiqueta: string;
  ayuda?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="font-heading text-lg">
        {etiqueta}
      </Label>
      {children}
      {ayuda && <p className="text-sm text-texto-secundario">{ayuda}</p>}
    </div>
  );
}
