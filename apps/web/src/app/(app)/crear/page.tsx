'use client';

import { modoDePublicacion } from '@omnistream/core';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { MiniaturaArchivo } from '@/components/biblioteca/MiniaturaArchivo';
import { Cargando } from '@/components/comunes/Cargando';
import { EditorPublicacion } from '@/components/publicaciones/EditorPublicacion';
import { useEstadoAjustes } from '@/lib/ajustes/useAjustes';
import { useConexiones } from '@/lib/conexiones/repositorio';
import { useInfoCreadorTiktok } from '@/lib/conexiones/useInfoCreadorTiktok';
import { useArchivos } from '@/lib/archivos/repositorio';
import { useEnviarPublicacion } from '@/lib/publicaciones/enviar';
import { usePrincipales } from '@/lib/publicaciones/repositorio';

function Crear() {
  const parametros = useSearchParams();
  const { ajustes, cargando: cargandoAjustes } = useEstadoAjustes();
  const { archivos, cargando } = useArchivos();
  const principales = usePrincipales();
  const { conexiones } = useConexiones();
  // Con TikTok por API se consulta la cuenta al abrir el editor, como piden sus pautas.
  const infoTiktok = useInfoCreadorTiktok(modoDePublicacion(conexiones.tiktok) === 'api');
  const enviar = useEnviarPublicacion('Borrador guardado');
  if (cargando || cargandoAjustes) return <Cargando />;
  return (
    <EditorPublicacion
      zona={ajustes.timezone}
      archivos={archivos.filter((a) => a.status === 'listo')}
      principales={principales}
      archivoInicial={parametros.get('archivo') ?? undefined}
      renderMiniatura={(asset) => <MiniaturaArchivo asset={asset} />}
      conexiones={conexiones}
      infoTiktok={infoTiktok}
      alEnviar={enviar}
    />
  );
}

export default function Pagina() {
  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="text-4xl text-texto">Crear publicación</h1>
        <p className="text-texto-secundario">Elige el archivo, las redes, el texto y la hora.</p>
      </header>
      <Suspense fallback={<Cargando />}>
        <Crear />
      </Suspense>
    </section>
  );
}
