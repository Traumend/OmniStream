'use client';

import type { AccionPublicacion } from '@omnistream/core';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Cargando } from '@/components/comunes/Cargando';
import { DetallePublicacion } from '@/components/publicaciones/DetallePublicacion';
import { useEstadoAjustes } from '@/lib/ajustes/useAjustes';
import { useArchivos } from '@/lib/archivos/repositorio';
import { ejecutarAccion, mensajeDeError } from '@/lib/publicaciones/acciones';
import { useHijas, useIntentos, usePublicacion } from '@/lib/publicaciones/repositorio';

const MENSAJES: Partial<Record<AccionPublicacion['accion'], string>> = {
  cancelar: 'Publicación cancelada',
  reintentar: 'Reintento programado',
  eliminar: 'Publicación eliminada',
  desvincular: 'Publicación desvinculada',
};

export default function Publicacion() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { publicacion, destinos, cargando } = usePublicacion(id);
  const { publicacion: principal } = usePublicacion(publicacion?.parentId ?? null);
  const hijas = useHijas(publicacion?.kind === 'principal' ? id : null);
  const { archivos } = useArchivos();
  const { ajustes, cargando: cargandoAjustes } = useEstadoAjustes();
  // Una suscripción por red, en orden fijo, para respetar las reglas de los hooks.
  const intentos = {
    facebook: useIntentos(id, 'facebook'),
    instagram: useIntentos(id, 'instagram'),
    youtube: useIntentos(id, 'youtube'),
    tiktok: useIntentos(id, 'tiktok'),
  };

  async function alAccion(accion: AccionPublicacion) {
    try {
      await ejecutarAccion(accion);
      const mensaje =
        accion.accion === 'programar'
          ? accion.inmediata
            ? 'Publicando ahora'
            : 'Publicación programada'
          : MENSAJES[accion.accion];
      if (mensaje) toast.success(mensaje);
      if (accion.accion === 'eliminar') router.push('/calendario');
    } catch (error) {
      toast.error(mensajeDeError(error));
    }
  }

  if (cargando || cargandoAjustes) return <Cargando />;
  if (!publicacion) return <p className="py-10 text-center text-texto-secundario">La publicación no existe.</p>;
  return (
    <DetallePublicacion
      publicacion={publicacion}
      destinos={destinos}
      principal={principal}
      hijas={hijas}
      intentos={intentos}
      zona={ajustes.timezone}
      asset={archivos.find((a) => a.id === publicacion.assetId) ?? null}
      alAccion={alAccion}
    />
  );
}
