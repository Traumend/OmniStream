'use client';

import type { EntradaPublicacion } from '@omnistream/core';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { Intencion } from '@/components/publicaciones/EditorPublicacion';
import { ejecutarAccion, mensajeDeError } from './acciones';

// Guarda y, según la intención, programa o publica ahora; los errores se muestran como aviso y no se relanzan.
export function useEnviarPublicacion(mensajeGuardado: string) {
  const router = useRouter();
  return async (publicacion: EntradaPublicacion, intencion: Intencion): Promise<void> => {
    try {
      const { postId } = await ejecutarAccion({ accion: 'guardar', publicacion });
      if (intencion === 'guardar') {
        toast.success(mensajeGuardado);
        router.push(`/publicaciones/${postId}`);
        return;
      }
      await ejecutarAccion({ accion: 'programar', postId, inmediata: intencion === 'publicar_ahora' });
      toast.success(intencion === 'publicar_ahora' ? 'Publicando ahora' : 'Publicación programada');
      router.push(`/calendario?resaltar=${postId}`);
    } catch (error) {
      toast.error(mensajeDeError(error));
    }
  };
}
