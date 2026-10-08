'use client';

import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useState } from 'react';
import { toast } from 'sonner';
import { BorradoresSinFecha } from '@/components/calendario/BorradoresSinFecha';
import { Cargando } from '@/components/comunes/Cargando';
import { useEstadoAjustes } from '@/lib/ajustes/useAjustes';
import { ejecutarAccion, mensajeDeError } from '@/lib/publicaciones/acciones';
import { useBorradoresSinFecha, usePublicacion, usePublicacionesEnRango } from '@/lib/publicaciones/repositorio';

// FullCalendar solo funciona en el navegador.
const CalendarioPublicaciones = dynamic(
  () => import('@/components/calendario/CalendarioPublicaciones').then((m) => m.CalendarioPublicaciones),
  { ssr: false, loading: () => <Cargando /> },
);

function Contenido() {
  const resaltar = useSearchParams().get('resaltar') ?? undefined;
  const router = useRouter();
  const { ajustes, cargando } = useEstadoAjustes();
  const { publicacion: resaltada, cargando: cargandoResaltada } = usePublicacion(resaltar ?? null);
  const [rango, setRango] = useState<{ desde: Date; hasta: Date } | null>(null);
  const publicaciones = usePublicacionesEnRango(rango?.desde ?? null, rango?.hasta ?? null);
  const borradores = useBorradoresSinFecha();

  const alCambiarRango = useCallback((desde: Date, hasta: Date) => {
    setRango((actual) =>
      actual && actual.desde.getTime() === desde.getTime() && actual.hasta.getTime() === hasta.getTime()
        ? actual
        : { desde, hasta },
    );
  }, []);

  async function alMover(postId: string, fecha: Date) {
    try {
      await ejecutarAccion({ accion: 'mover', postId, scheduledAt: fecha.toISOString() });
      toast.success('Publicación movida');
    } catch (error) {
      toast.error(mensajeDeError(error));
      throw error;
    }
  }

  if (cargando || (resaltar && cargandoResaltada)) return <Cargando />;
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_18rem]">
      <div className="neu-elevado calendario-omnistream min-w-0 p-4">
        <CalendarioPublicaciones
          key={ajustes.timezone}
          publicaciones={publicaciones}
          zona={ajustes.timezone}
          resaltar={resaltar}
          fechaInicial={resaltada?.scheduledAt ?? undefined}
          alMover={alMover}
          alAbrir={(postId) => router.push(`/publicaciones/${postId}`)}
          alCambiarRango={alCambiarRango}
        />
      </div>
      <BorradoresSinFecha publicaciones={borradores} />
    </div>
  );
}

export default function Calendario() {
  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="text-4xl text-texto">Calendario</h1>
        <p className="text-texto-secundario">Arrastra una publicación para cambiar su fecha.</p>
      </header>
      <Suspense fallback={<Cargando />}>
        <Contenido />
      </Suspense>
    </section>
  );
}
