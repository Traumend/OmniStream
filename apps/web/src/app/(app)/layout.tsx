'use client';

import type { ReactNode } from 'react';
import { GuardiaSesion } from '@/components/shell/GuardiaSesion';
import { Shell } from '@/components/shell/Shell';
import { useSesion } from '@/lib/firebase/sesion';

export default function LayoutApp({ children }: { children: ReactNode }) {
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
