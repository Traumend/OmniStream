'use client';

import type { ReactNode } from 'react';
import { useSesion } from '@/lib/firebase/sesion';
import { GuardiaSesion } from './GuardiaSesion';
import { Shell } from './Shell';

export function AreaPrivada({ children }: { children: ReactNode }) {
  const sesion = useSesion();
  return (
    <GuardiaSesion sesion={sesion}>
      {sesion.estado === 'autenticado' && (
        <Shell usuario={sesion.usuario} alSalir={sesion.salir}>
          {children}
        </Shell>
      )}
    </GuardiaSesion>
  );
}
