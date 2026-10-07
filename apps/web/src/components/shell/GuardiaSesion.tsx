'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { Laurel } from '@/components/marca/Laurel';
import type { EstadoSesion } from '@/lib/firebase/sesion';

export function GuardiaSesion({ sesion, children }: { sesion: EstadoSesion; children: ReactNode }) {
  const router = useRouter();
  const anonimo = sesion.estado === 'anonimo';

  useEffect(() => {
    if (anonimo) router.replace('/entrar');
  }, [anonimo, router]);

  if (sesion.estado === 'cargando') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-texto-secundario" role="status">
        <Laurel className="size-12 animate-pulse text-oro" />
        <p>Cargando…</p>
      </div>
    );
  }
  if (sesion.estado === 'anonimo') return null;
  return <>{children}</>;
}
