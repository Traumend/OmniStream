'use client';

import {
  ETIQUETAS_PROVEEDOR,
  PLATAFORMAS,
  PROVEEDORES,
  proveedorDe,
  type Platform,
  type Proveedor,
} from '@omnistream/core';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { TarjetaConexion, type CambiosConexion } from '@/components/conexiones/TarjetaConexion';
import { useAjustes } from '@/lib/ajustes/useAjustes';
import { ejecutarAccionConexion } from '@/lib/conexiones/acciones';
import { useConexiones } from '@/lib/conexiones/repositorio';

const AVISO_RETORNO = 'retorno-conexion';
const mensaje = (error: unknown) => (error instanceof Error ? error.message : 'No se pudo completar la acción.');

function Contenido() {
  const busqueda = useSearchParams();
  const router = useRouter();
  const { conexiones } = useConexiones();
  const { timezone } = useAjustes();
  const [ocupada, setOcupada] = useState<Platform | null>(null);

  // El retorno de OAuth llega con ?conectada= o ?error=; se avisa y se limpia la URL. El id fijo evita el aviso
  // doble cuando el efecto corre dos veces (modo estricto de React en desarrollo).
  useEffect(() => {
    const conectada = busqueda.get('conectada');
    const error = busqueda.get('error');
    if (!conectada && !error) return;
    if (conectada && PROVEEDORES.includes(conectada as Proveedor)) {
      toast.success(`${ETIQUETAS_PROVEEDOR[conectada as Proveedor]} quedó conectada`, { id: AVISO_RETORNO });
    }
    if (error) toast.error(error, { id: AVISO_RETORNO });
    router.replace('/ajustes/conexiones');
  }, [busqueda, router]);

  async function conRed(red: Platform, tarea: () => Promise<void>) {
    setOcupada(red);
    try {
      await tarea();
    } catch (error) {
      toast.error(mensaje(error));
    } finally {
      setOcupada(null);
    }
  }

  const conectar = (red: Platform) =>
    conRed(red, async () => {
      const { url } = await ejecutarAccionConexion({ accion: 'iniciar', proveedor: proveedorDe(red) });
      if (url) window.location.assign(url);
    });

  const desconectar = (red: Platform) =>
    conRed(red, async () => {
      await ejecutarAccionConexion({ accion: 'desconectar', proveedor: proveedorDe(red) });
      toast.success(`${ETIQUETAS_PROVEEDOR[proveedorDe(red)]} quedó desconectada`);
    });

  const configurar = (red: Platform, cambios: CambiosConexion) =>
    conRed(red, async () => {
      await ejecutarAccionConexion({ accion: 'configurar', platform: red, ...cambios });
    });

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header>
        <h1 className="text-4xl text-texto">Conexiones</h1>
        <p className="text-texto-secundario">Conecta cada red y elige si se publica por API o en modo manual.</p>
      </header>
      <div className="grid gap-6 md:grid-cols-2">
        {PLATAFORMAS.map((red) => (
          <TarjetaConexion
            key={red}
            conexion={conexiones[red]}
            zona={timezone}
            ocupado={ocupada === red}
            alConectar={() => void conectar(red)}
            alDesconectar={() => void desconectar(red)}
            alConfigurar={(cambios) => void configurar(red, cambios)}
          />
        ))}
      </div>
    </section>
  );
}

export default function Conexiones() {
  return (
    <Suspense>
      <Contenido />
    </Suspense>
  );
}
