'use client';

import { esEditable, modoDePublicacion } from '@omnistream/core';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { MiniaturaArchivo } from '@/components/biblioteca/MiniaturaArchivo';
import { Cargando } from '@/components/comunes/Cargando';
import { PasosCreacion } from './PasosCreacion';
import { useEstadoAjustes } from '@/lib/ajustes/useAjustes';
import { useConexiones } from '@/lib/conexiones/repositorio';
import { useInfoCreadorTiktok } from '@/lib/conexiones/useInfoCreadorTiktok';
import { useArchivos } from '@/lib/archivos/repositorio';
import { useSubidas } from '@/lib/archivos/useSubidas';
import { pasoDe } from '@/lib/crear/pasos';
import { ejecutarAccion } from '@/lib/publicaciones/acciones';
import { useEnviarPublicacion } from '@/lib/publicaciones/enviar';
import { useHijas, usePrincipales, usePublicacion } from '@/lib/publicaciones/repositorio';

// Editor de una publicación ya guardada: Editar y Crear con ?id= (tras el primer autoguardado).
export function EditorExistente({ id, titulo }: { id: string; titulo?: string }) {
  const parametros = useSearchParams();
  const { gestor, estado: subidas } = useSubidas();
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
      <PasosCreacion
        key={id}
        zona={ajustes.timezone}
        archivos={archivos.filter((a) => ESTADOS_ELEGIBLES.has(a.status) || a.id === publicacion.assetId)}
        principales={principales}
        inicial={{ publicacion, destinos, hijas: hijas.length }}
        pasoInicial={pasoDe(parametros.get('paso'))}
        renderMiniatura={(asset) => <MiniaturaArchivo asset={asset} />}
        conexiones={conexiones}
        infoTiktok={infoTiktok}
        subidas={subidas}
        alSubir={(archivo) => gestor.iniciar(archivo, ajustes.maxUploadGb)}
        alGuardarBorrador={(entrada) => ejecutarAccion({ accion: 'guardar', publicacion: entrada })}
        alEnviar={enviar}
      />
    );
  }

  return (
    <>
      {titulo && (
        <header>
          <h1 className="text-4xl text-texto">{titulo}</h1>
          {publicacion && <p className="text-texto-secundario">{publicacion.title}</p>}
        </header>
      )}
      {contenido}
    </>
  );
}

const ESTADOS_ELEGIBLES: ReadonlySet<string> = new Set(['listo', 'subiendo', 'procesando']);
