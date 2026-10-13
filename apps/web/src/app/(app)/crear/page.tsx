'use client';

import { modoDePublicacion } from '@omnistream/core';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { toast } from 'sonner';
import { MiniaturaArchivo } from '@/components/biblioteca/MiniaturaArchivo';
import { Cargando } from '@/components/comunes/Cargando';
import { EditorExistente } from '@/components/crear/EditorExistente';
import { PasosCreacion } from '@/components/crear/PasosCreacion';
import { ImportarYoutube } from '@/components/publicaciones/ImportarYoutube';
import { useEstadoAjustes } from '@/lib/ajustes/useAjustes';
import { useConexiones } from '@/lib/conexiones/repositorio';
import { useInfoCreadorTiktok } from '@/lib/conexiones/useInfoCreadorTiktok';
import { useArchivos } from '@/lib/archivos/repositorio';
import { useSubidas } from '@/lib/archivos/useSubidas';
import { pasoDe } from '@/lib/crear/pasos';
import { ejecutarAccion, mensajeDeError } from '@/lib/publicaciones/acciones';
import { useEnviarPublicacion } from '@/lib/publicaciones/enviar';
import { usePrincipales } from '@/lib/publicaciones/repositorio';

// Spec 8.1: el paso Archivo muestra también los archivos que aún se suben o se procesan.
const ESTADOS_ELEGIBLES: ReadonlySet<string> = new Set(['listo', 'subiendo', 'procesando']);

function Crear() {
  const parametros = useSearchParams();
  const { ajustes, cargando: cargandoAjustes } = useEstadoAjustes();
  const { archivos, cargando } = useArchivos();
  const principales = usePrincipales();
  const { conexiones } = useConexiones();
  // Con TikTok por API se consulta la cuenta al abrir el editor, como piden sus pautas.
  const infoTiktok = useInfoCreadorTiktok(modoDePublicacion(conexiones.tiktok) === 'api');
  const enviar = useEnviarPublicacion('Borrador guardado');
  const { gestor, estado: subidas } = useSubidas();
  const router = useRouter();

  async function importar(url: string) {
    try {
      const { postId } = await ejecutarAccion({ accion: 'importarYoutube', url });
      toast.success('Video importado');
      router.push(`/publicaciones/${postId}`);
    } catch (error) {
      toast.error(mensajeDeError(error));
    }
  }

  if (cargando || cargandoAjustes) return <Cargando />;
  return (
    <>
      <ImportarYoutube conectado={conexiones.youtube.authStatus === 'conectada'} alImportar={importar} />
      <PasosCreacion
        zona={ajustes.timezone}
        archivos={archivos.filter((a) => ESTADOS_ELEGIBLES.has(a.status))}
        principales={principales}
        archivoInicial={parametros.get('archivo') ?? undefined}
        pasoInicial={pasoDe(parametros.get('paso'))}
        renderMiniatura={(asset) => <MiniaturaArchivo asset={asset} />}
        conexiones={conexiones}
        infoTiktok={infoTiktok}
        subidas={subidas}
        alSubir={(archivo) => gestor.iniciar(archivo, ajustes.maxUploadGb)}
        alGuardarBorrador={(publicacion) => ejecutarAccion({ accion: 'guardar', publicacion })}
        alEnviar={enviar}
      />
    </>
  );
}

// Tras el primer autoguardado la URL lleva ?id=. Se lee solo al montar: mientras se edita, el editor sigue montado;
// al recargar o volver atrás, se abre el borrador guardado.
function CrearOContinuar() {
  const parametros = useSearchParams();
  const [idInicial] = useState(() => parametros.get('id'));
  return idInicial ? <EditorExistente id={idInicial} /> : <Crear />;
}

export default function Pagina() {
  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="text-4xl text-texto">Crear publicación</h1>
        <p className="text-texto-secundario">Archivo, destinos, canvas, contenido, vista previa y publicación.</p>
      </header>
      <Suspense fallback={<Cargando />}>
        <CrearOContinuar />
      </Suspense>
    </section>
  );
}
