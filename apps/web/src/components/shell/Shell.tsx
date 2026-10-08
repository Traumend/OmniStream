'use client';

import { X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import type { UsuarioSesion } from '@/lib/firebase/sesion';
import { BarraLateral } from './BarraLateral';
import { BarraSuperior } from './BarraSuperior';

export function Shell({
  usuario,
  alSalir,
  contadores,
  children,
}: {
  usuario: UsuarioSesion;
  alSalir(): void;
  contadores?: Partial<Record<string, number>>;
  children: ReactNode;
}) {
  const [menuAbierto, setMenuAbierto] = useState(false);
  return (
    <div className="flex min-h-screen flex-col">
      <BarraSuperior usuario={usuario} alAbrirMenu={() => setMenuAbierto(true)} alSalir={alSalir} />
      <div className="flex flex-1 gap-6 px-4 pb-6 lg:px-6">
        <aside className="hidden w-64 shrink-0 lg:block">
          <BarraLateral contadores={contadores} />
        </aside>
        {menuAbierto && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              className="absolute inset-0 bg-texto/30"
              aria-label="Cerrar menú"
              onClick={() => setMenuAbierto(false)}
            />
            <aside className="neu-elevado absolute inset-y-3 left-3 flex w-72 flex-col rounded-[18px] p-4">
              <div className="mb-2 flex justify-end">
                <Button variant="ghost" size="icon" onClick={() => setMenuAbierto(false)} aria-label="Cerrar menú">
                  <X className="size-5" />
                </Button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <BarraLateral alNavegar={() => setMenuAbierto(false)} contadores={contadores} />
              </div>
            </aside>
          </div>
        )}
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
