'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { EstadoNotificaciones } from '@/lib/notificaciones/estado';

const MENSAJES: Record<Exclude<EstadoNotificaciones, 'desactivadas'>, string> = {
  no_soportado:
    'Este navegador no admite notificaciones push. En iPhone, instala OmniStream en la pantalla de inicio desde Safari.',
  sin_configurar: 'Falta configurar la llave VAPID (NEXT_PUBLIC_FIREBASE_VAPID_KEY).',
  bloqueadas: 'Las notificaciones están bloqueadas en este navegador. Permítelas en la configuración del sitio.',
  activadas: 'Activadas en este dispositivo.',
};

export function TarjetaNotificaciones({
  estado,
  alActivar,
}: {
  estado: EstadoNotificaciones | null;
  alActivar(): Promise<void>;
}) {
  const [activando, setActivando] = useState(false);

  async function activar() {
    setActivando(true);
    try {
      await alActivar();
    } finally {
      setActivando(false);
    }
  }

  return (
    <section aria-labelledby="titulo-notificaciones" className="neu-elevado flex flex-col gap-3 p-8">
      <h2 id="titulo-notificaciones" className="font-heading text-2xl text-texto">
        Notificaciones
      </h2>
      <p className="text-texto-secundario">
        Avisos en este dispositivo cuando una publicación queda pendiente o falla.
      </p>
      {estado === null ? (
        <p role="status" className="text-texto-secundario">
          Comprobando este navegador…
        </p>
      ) : estado === 'desactivadas' ? (
        <div>
          <Button type="button" className="boton-oro" disabled={activando} onClick={() => void activar()}>
            Activar en este dispositivo
          </Button>
        </div>
      ) : (
        <p className={estado === 'activadas' ? 'text-texto' : 'text-alerta'}>{MENSAJES[estado]}</p>
      )}
    </section>
  );
}
