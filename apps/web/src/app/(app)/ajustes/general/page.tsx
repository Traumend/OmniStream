'use client';

import { esZonaHorariaValida, type AjustesApp } from '@omnistream/core';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { FormularioAjustes } from '@/components/ajustes/FormularioAjustes';
import { TarjetaNotificaciones } from '@/components/ajustes/TarjetaNotificaciones';
import { escucharAjustes, guardarAjustes } from '@/lib/ajustes/repositorio';
import { activarNotificaciones, leerEntorno, sincronizarNotificaciones } from '@/lib/notificaciones/activar';
import { estadoNotificaciones, type EstadoNotificaciones } from '@/lib/notificaciones/estado';

function zonaDelNavegador(): string {
  const zona = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return zona && esZonaHorariaValida(zona) ? zona : 'UTC';
}

export default function AjustesGenerales() {
  const [ajustes, setAjustes] = useState<AjustesApp | null>(null);
  const [notificaciones, setNotificaciones] = useState<EstadoNotificaciones | null>(null);
  const zonas = useMemo(() => Intl.supportedValuesOf('timeZone'), []);

  // El estado depende del navegador: se calcula solo en el cliente, al montar.
  useEffect(() => {
    let vigente = true;
    void leerEntorno().then((entorno) => {
      if (!vigente) return;
      const estado = estadoNotificaciones(entorno);
      setNotificaciones(estado);
      if (estado === 'activadas') sincronizarNotificaciones().catch(() => undefined);
    });
    return () => {
      vigente = false;
    };
  }, []);

  useEffect(
    () =>
      escucharAjustes((leidos, existe) => {
        setAjustes(existe ? leidos : { ...leidos, timezone: zonaDelNavegador() });
      }),
    [],
  );

  const guardar = async (valores: AjustesApp) => {
    try {
      await guardarAjustes(valores);
      toast.success('Ajustes guardados');
    } catch {
      toast.error('No se pudieron guardar los ajustes.');
    }
  };

  const activar = async () => {
    try {
      const resultado = await activarNotificaciones();
      if (resultado === 'activadas') toast.success('Notificaciones activadas');
      else toast.error('El navegador no concedió el permiso para mostrar notificaciones.');
    } catch {
      toast.error('No se pudieron activar las notificaciones en este dispositivo.');
    } finally {
      setNotificaciones(estadoNotificaciones(await leerEntorno()));
    }
  };

  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-6">
      <header>
        <h1 className="text-4xl text-texto">Ajustes generales</h1>
        <p className="text-texto-secundario">Preferencias que se aplican en toda la aplicación.</p>
      </header>
      <div className="neu-elevado p-8">
        {ajustes ? (
          <FormularioAjustes valores={ajustes} zonas={zonas} alGuardar={guardar} />
        ) : (
          <p className="text-texto-secundario" role="status">
            Cargando ajustes…
          </p>
        )}
      </div>
      <TarjetaNotificaciones estado={notificaciones} alActivar={activar} />
    </section>
  );
}
