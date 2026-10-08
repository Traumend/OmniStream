'use client';

import type { InfoCreadorTiktok } from '@omnistream/core';
import { useEffect, useState } from 'react';
import { ejecutarAccionConexion } from './acciones';

export interface EstadoInfoTiktok {
  info: InfoCreadorTiktok | null;
  cargando: boolean;
  error: string | null;
}

// Las pautas de TikTok piden consultar la cuenta (creator_info) al mostrar la pantalla de publicación.
export function useInfoCreadorTiktok(activo: boolean): EstadoInfoTiktok {
  const [estado, setEstado] = useState<EstadoInfoTiktok>({ info: null, cargando: false, error: null });
  useEffect(() => {
    if (!activo) return;
    let vigente = true;
    void Promise.resolve()
      .then(() => {
        if (vigente) setEstado({ info: null, cargando: true, error: null });
        return ejecutarAccionConexion({ accion: 'infoCreadorTiktok' });
      })
      .then(
        ({ info }) => vigente && setEstado({ info: info ?? null, cargando: false, error: null }),
        (error: unknown) =>
          vigente &&
          setEstado({
            info: null,
            cargando: false,
            error: error instanceof Error ? error.message : 'No se pudo consultar tu cuenta de TikTok.',
          }),
      );
    return () => {
      vigente = false;
    };
  }, [activo]);
  return estado;
}
