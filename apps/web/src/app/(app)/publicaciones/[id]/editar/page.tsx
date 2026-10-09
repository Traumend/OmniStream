'use client';

import { esEditable, modoDePublicacion } from '@omnistream/core';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { MiniaturaArchivo } from '@/components/biblioteca/MiniaturaArchivo';
import { Cargando } from '@/components/comunes/Cargando';
import { EditorPublicacion } from '@/components/publicaciones/EditorPublicacion';
import { useEstadoAjustes } from '@/lib/ajustes/useAjustes';
import { useConexiones } from '@/lib/conexiones/repositorio';
import { useInfoCreadorTiktok } from '@/lib/conexiones/useInfoCreadorTiktok';
import { useArchivos } from '@/lib/archivos/repositorio';
import { useEnviarPublicacion } from '@/lib/publicaciones/enviar';
import { useHijas, usePrincipales, usePublicacion } from '@/lib/publicaciones/repositorio';

export default function EditarPublicacion() {
  const { id } = useParams<{ id: string }>();
  const { publicacion, destinos, cargando } = usePublicacion(id);
  const hijas = useHijas(id);
  const { ajustes, cargando: cargandoAjustes } = useEstadoAjustes();
  const { archivos, cargando: cargandoArchivos } = useArchivos();
  const principales = usePrincipales();
  const { conexiones } = useConexiones();
  // Con TikTok por API se consulta la cuenta al abrir el editor, como piden sus pautas.
  const infoTiktok = useInfoCreadorTiktok(modoDePublicacion(conexiones.tiktok) === 'api');
  const programada = destinos.some((d) => d.status === 'programada');
  const enviar = useEnviarPublicacion(programada ? 'Cambios guardados' : 'Borrador guardado');

  let contenido;
  if (cargando || cargandoAjustes || cargandoArchivos) contenido = <Cargando />;
  else if (!publicacion) contenido = <p className="text-texto-secundario">La publicación no existe.</p>;
  else if (!esEditable(destinos.map((d) => d.status))) {
    contenido = (
      <p className="text-texto-secundario">
        Esta publicación ya no se puede editar.{' '}
        <Link href={`/publicaciones/${id}`} className="text-oro-profundo underline underline-offset-2">
          Ver detalle
        </Link>
      </p>
    );
  } else {
    contenido = (
      <EditorPublicacion
        key={id}
        zona={ajustes.timezone}
        archivos={archivos.filter((a) => a.status === 'listo' || a.id === publicacion.assetId)}
        principales={principales}
        inicial={{ publicacion, destinos, hijas: hijas.length }}
        renderMiniatura={(asset) => <MiniaturaArchivo asset={asset} />}
        conexiones={conexiones}
        infoTiktok={infoTiktok}
        alEnviar={enviar}
      />
    );
  }

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="text-4xl text-texto">Editar publicación</h1>
        {publicacion && <p className="text-texto-secundario">{publicacion.title}</p>}
      </header>
      {contenido}
    </section>
  );
}
