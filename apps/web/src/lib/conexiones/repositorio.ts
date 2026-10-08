'use client';

import { leerConexion, PLATAFORMAS, type Conexion, type Platform } from '@omnistream/core';
import { collection, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { obtenerFirebase } from '@/lib/firebase/cliente';

const sinConectar = (): Record<Platform, Conexion> =>
  Object.fromEntries(PLATAFORMAS.map((red) => [red, leerConexion(red, undefined)])) as Record<Platform, Conexion>;

// Las redes sin documento se muestran sin conectar.
export function useConexiones(): { conexiones: Record<Platform, Conexion>; cargando: boolean } {
  const [estado, setEstado] = useState({ conexiones: sinConectar(), cargando: true });
  useEffect(
    () =>
      onSnapshot(
        collection(obtenerFirebase().db, 'connections'),
        (resultado) => {
          const conexiones = sinConectar();
          for (const documento of resultado.docs) {
            const red = documento.id as Platform;
            if (PLATAFORMAS.includes(red)) conexiones[red] = leerConexion(red, documento.data());
          }
          setEstado({ conexiones, cargando: false });
        },
        () => setEstado((actual) => ({ ...actual, cargando: false })),
      ),
    [],
  );
  return estado;
}
