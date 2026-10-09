'use client';

import type { Platform } from '@omnistream/core';
import { toast } from 'sonner';
import { ListaPendientes } from '@/components/pendientes/ListaPendientes';
import { useAjustes } from '@/lib/ajustes/useAjustes';
import { ejecutarAccion, mensajeDeError } from '@/lib/publicaciones/acciones';
import { usePromocionesPendientes } from '@/lib/publicaciones/promocion';
import { usePendientes, usePublicacionesPorId, useUrlsDePrincipales } from '@/lib/publicaciones/repositorio';

export default function Pendientes() {
  const { timezone } = useAjustes();
  const { manuales, referencias } = usePendientes();
  const publicaciones = usePublicacionesPorId([...manuales, ...referencias].map((i) => i.postId));
  const idsPrincipales = referencias.flatMap((i) => publicaciones.get(i.postId)?.parentId ?? []);
  const principales = usePublicacionesPorId(idsPrincipales);
  const urls = useUrlsDePrincipales(idsPrincipales);
  const promociones = usePromocionesPendientes();

  const unir = <T extends { postId: string }>(items: T[]) =>
    items.flatMap((item) => {
      const publicacion = publicaciones.get(item.postId);
      return publicacion ? [{ ...item, publicacion }] : [];
    });

  async function alMarcarReferencia(postId: string, platform: Platform) {
    try {
      await ejecutarAccion({ accion: 'marcarReferencia', postId, platform });
      toast.success('Referencia marcada como publicada');
    } catch (error) {
      toast.error(mensajeDeError(error));
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="text-4xl text-texto">Pendientes</h1>
        <p className="text-texto-secundario">Lo que toca publicar a mano y la promoción de tus videos principales.</p>
      </header>
      <ListaPendientes
        manuales={unir(manuales)}
        referencias={unir(referencias).map((item) => ({
          ...item,
          principal: item.publicacion.parentId ? (principales.get(item.publicacion.parentId) ?? null) : null,
          urlPrincipal: item.publicacion.parentId ? urls.get(item.publicacion.parentId) : undefined,
        }))}
        promociones={promociones}
        zona={timezone}
        alMarcarReferencia={alMarcarReferencia}
      />
    </section>
  );
}
