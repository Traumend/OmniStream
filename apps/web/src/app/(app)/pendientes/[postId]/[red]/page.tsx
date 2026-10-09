'use client';

import { ETIQUETAS_ESTADO_DESTINO, PLATAFORMAS, urlVideoYoutube, type Platform } from '@omnistream/core';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Cargando } from '@/components/comunes/Cargando';
import { PaquetePendiente } from '@/components/pendientes/PaquetePendiente';
import { useEstadoAjustes } from '@/lib/ajustes/useAjustes';
import { estadoDescarga } from '@/lib/archivos/descarga';
import { useArchivos, useUrlDescarga, useUrlsFotogramas } from '@/lib/archivos/repositorio';
import { ejecutarAccion, mensajeDeError } from '@/lib/publicaciones/acciones';
import { usePublicacion } from '@/lib/publicaciones/repositorio';

const ENLACE = 'text-oro-profundo underline underline-offset-2';

export default function Paquete() {
  const { postId, red: parametro } = useParams<{ postId: string; red: string }>();
  const red = (PLATAFORMAS as readonly string[]).includes(parametro) ? (parametro as Platform) : null;
  const router = useRouter();
  const { publicacion, destinos, cargando } = usePublicacion(postId);
  const principal = usePublicacion(publicacion?.parentId ?? null);
  const { ajustes, cargando: cargandoAjustes } = useEstadoAjustes();
  const { archivos, cargando: cargandoArchivos } = useArchivos();
  const asset = archivos.find((a) => a.id === publicacion?.assetId);
  const descarga = useUrlDescarga(asset?.status === 'purgado' ? undefined : asset?.storagePath);
  const archivo = estadoDescarga({ cargandoArchivos, asset, ...descarga });
  const miniaturas = useUrlsFotogramas(asset);
  const destino = destinos.find((d) => d.platform === red);
  const remotoPrincipal = principal.destinos.find((d) => d.platform === 'youtube')?.remote;

  async function alMarcarPublicada(url: string) {
    if (!red) return;
    try {
      await ejecutarAccion({ accion: 'marcarPublicada', postId, platform: red, url });
      toast.success('Marcada como publicada');
      router.push('/pendientes');
    } catch (error) {
      toast.error(mensajeDeError(error));
    }
  }

  if (cargando || cargandoAjustes) return <Cargando />;
  if (!publicacion || !destino)
    return <p className="py-10 text-center text-texto-secundario">Este paquete no existe.</p>;
  if (destino.status !== 'pendiente_manual') {
    return (
      <p className="py-10 text-center text-texto-secundario">
        Este destino está {ETIQUETAS_ESTADO_DESTINO[destino.status].toLowerCase()}.{' '}
        <Link href={`/publicaciones/${postId}`} className={ENLACE}>
          Ver la publicación
        </Link>
      </p>
    );
  }
  return (
    <PaquetePendiente
      publicacion={publicacion}
      destino={destino}
      principal={principal.publicacion}
      urlPrincipal={remotoPrincipal ? urlVideoYoutube(remotoPrincipal.id) : undefined}
      urlDescarga={archivo === 'lista' ? descarga.url : undefined}
      preparandoDescarga={archivo === 'preparando'}
      urlMiniatura={miniaturas[destino.youtube?.thumbnail?.frame ?? 'start']}
      zona={ajustes.timezone}
      alMarcarPublicada={alMarcarPublicada}
    />
  );
}
