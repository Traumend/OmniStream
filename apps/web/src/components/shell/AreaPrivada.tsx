'use client';

import type { ReactNode } from 'react';
import { useSesion, type UsuarioSesion } from '@/lib/firebase/sesion';
import { usePendientes } from '@/lib/publicaciones/repositorio';
import { GuardiaSesion } from './GuardiaSesion';
import { Shell } from './Shell';

// Solo se monta con sesión: las lecturas de pendientes exigen el claim owner.
function ShellConPendientes({
  usuario,
  alSalir,
  children,
}: {
  usuario: UsuarioSesion;
  alSalir(): void;
  children: ReactNode;
}) {
  const { total } = usePendientes();
  return (
    <Shell usuario={usuario} alSalir={alSalir} contadores={{ '/pendientes': total }}>
      {children}
    </Shell>
  );
}

export function AreaPrivada({ children }: { children: ReactNode }) {
  const sesion = useSesion();
  return (
    <GuardiaSesion sesion={sesion}>
      {sesion.estado === 'autenticado' && (
        <ShellConPendientes usuario={sesion.usuario} alSalir={sesion.salir}>
          {children}
        </ShellConPendientes>
      )}
    </GuardiaSesion>
  );
}
