'use client';

import {
  esEditable,
  ESTADOS_CANCELABLES,
  ETIQUETAS_ESTADO_DESTINO,
  ETIQUETAS_ESTADO_PUBLICACION,
  ETIQUETAS_RED,
  ETIQUETAS_TIPO,
  formatearFechaHora,
  REGLAS,
  sePuedeEliminar,
  type AccionPublicacion,
  type Asset,
  type Destino,
  type Intento,
  type Platform,
  type Publicacion,
} from '@omnistream/core';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { revisarEnvio } from '@/lib/publicaciones/revisarEnvio';
import { ConfirmarEnvio } from './ConfirmarEnvio';
import { InsigniaRed } from './InsigniaRed';
import { ListaErrores } from './ListaErrores';

export interface PropsDetalle {
  publicacion: Publicacion;
  destinos: Destino[];
  principal: Publicacion | null;
  hijas: Publicacion[];
  intentos: Partial<Record<Platform, Intento[]>>;
  zona: string;
  asset?: Asset | null;
  ahora?: () => Date;
  alAccion(accion: AccionPublicacion): Promise<void>;
}

const RESULTADOS: Record<Intento['result'], string> = { ok: 'correcto', error: 'error', omitido: 'omitido' };
const ENLACE = 'text-oro-profundo underline underline-offset-2';

function Tarjeta({ titulo, children, etiqueta }: { titulo?: string; etiqueta?: string; children: ReactNode }) {
  return (
    <section aria-label={etiqueta} className="neu-elevado flex flex-col gap-3 p-6">
      {titulo && <h2 className="font-heading text-2xl text-texto">{titulo}</h2>}
      {children}
    </section>
  );
}

function DestinoDetalle({
  postId,
  destino,
  intentos,
  zona,
  ocupado,
  alAccion,
}: {
  postId: string;
  destino: Destino;
  intentos: Intento[];
  zona: string;
  ocupado: boolean;
  alAccion(accion: AccionPublicacion): void;
}) {
  const red = destino.platform;
  return (
    <section aria-label={ETIQUETAS_RED[red]} className="neu-elevado flex flex-col gap-3 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <InsigniaRed platform={red} estado={destino.status} />
        <h3 className="font-heading text-xl text-texto">
          {REGLAS[red][destino.format]?.etiqueta ?? ETIQUETAS_RED[red]}
        </h3>
        <span className="text-sm text-texto-secundario">{ETIQUETAS_ESTADO_DESTINO[destino.status]}</span>
      </div>
      {destino.scheduledAt && (
        <p className="cifras text-sm text-texto-secundario">Hora: {formatearFechaHora(destino.scheduledAt, zona)}</p>
      )}
      <p className="text-sm text-texto-secundario">{destino.publishMode === 'api' ? 'Por API' : 'Manual'}</p>
      {destino.status === 'fallida' && destino.lastError && (
        <p className="text-sm text-peligro">
          {destino.lastError.message}
          {destino.lastError.kind === 'auth' && (
            <>
              {' '}
              <Link href="/ajustes/conexiones" className={ENLACE}>
                Reconectar en Ajustes
              </Link>
            </>
          )}
        </p>
      )}
      {red === 'tiktok' &&
        destino.publishMode === 'api' &&
        (destino.status === 'publicando' || destino.status === 'publicada') && (
          <p className="text-sm text-texto-secundario">
            TikTok puede tardar unos minutos en procesarla y mostrarla en tu perfil.
          </p>
        )}
      {destino.parentRef.status === 'en_espera' && (
        <p className="text-sm text-texto-secundario">
          La referencia se habilitará cuando se publique el video principal.
        </p>
      )}
      {destino.parentRef.status === 'pendiente' && (
        <p className="text-sm text-alerta">
          Referencia al video principal pendiente.{' '}
          <Link href="/pendientes" className={ENLACE}>
            Ver pendientes
          </Link>
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {destino.status === 'fallida' && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={ocupado}
            onClick={() => alAccion({ accion: 'reintentar', postId, platform: red })}
          >
            Reintentar
          </Button>
        )}
        {destino.status === 'pendiente_manual' && (
          <Button asChild size="sm" className="boton-oro">
            <Link href={`/pendientes/${postId}/${red}`}>Abrir paquete</Link>
          </Button>
        )}
        {destino.remote && (
          <Button asChild size="sm" variant="outline">
            <a href={destino.remote.url} target="_blank" rel="noopener noreferrer">
              Ver publicación
            </a>
          </Button>
        )}
      </div>
      {intentos.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-texto-secundario">Intentos ({intentos.length})</summary>
          <ul aria-label="Intentos" className="cifras mt-2 flex flex-col gap-1 text-texto-secundario">
            {intentos.map((intento) => (
              <li key={intento.id}>
                {`${formatearFechaHora(intento.at, zona)} · ${intento.stage} · ${RESULTADOS[intento.result]}${
                  intento.error ? `: ${intento.error}` : ''
                }`}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

export function DetallePublicacion({
  publicacion,
  destinos,
  principal,
  hijas,
  intentos,
  zona,
  asset = null,
  ahora = () => new Date(),
  alAccion,
}: PropsDetalle) {
  const [errores, setErrores] = useState<string[]>([]);
  const [confirmacion, setConfirmacion] = useState<{ inmediata: boolean; advertencias: string[] } | null>(null);
  const [eliminando, setEliminando] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  const postId = publicacion.id;
  const estados = destinos.map((d) => d.status);
  const editable = esEditable(estados);
  const programable =
    destinos.length > 0 &&
    destinos.every((d) => d.status === 'borrador' || d.status === 'cancelada') &&
    publicacion.scheduledAt !== null;
  const cancelable = destinos.some((d) => ESTADOS_CANCELABLES.has(d.status));

  async function ejecutar(accion: AccionPublicacion) {
    setOcupado(true);
    try {
      await alAccion(accion);
    } finally {
      setOcupado(false);
      setConfirmacion(null);
      setEliminando(false);
    }
  }

  function pedirEnvio(inmediata: boolean) {
    const resultado = revisarEnvio(
      {
        publicacion,
        destinos,
        asset,
        principal,
        tipoActual: publicacion.kind,
        numeroDeHijas: hijas.length,
        ahora: ahora(),
      },
      inmediata ? 'publicar_ahora' : 'programar',
      false,
    );
    setErrores(resultado.errores);
    if (resultado.errores.length === 0) setConfirmacion({ inmediata, advertencias: resultado.advertencias });
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-4xl text-texto">{publicacion.title}</h1>
        <p className="flex flex-wrap gap-x-3 gap-y-1 text-texto-secundario">
          <span>{ETIQUETAS_ESTADO_PUBLICACION[publicacion.status]}</span>
          <span aria-hidden="true">·</span>
          <span>{ETIQUETAS_TIPO[publicacion.kind]}</span>
          <span aria-hidden="true">·</span>
          <span className="cifras">
            {publicacion.scheduledAt ? formatearFechaHora(publicacion.scheduledAt, zona) : 'Sin fecha'}
          </span>
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {editable && (
          <Button asChild variant="outline">
            <Link href={`/publicaciones/${postId}/editar`}>Editar</Link>
          </Button>
        )}
        {programable && (
          <Button type="button" variant="outline" disabled={ocupado} onClick={() => pedirEnvio(false)}>
            Programar
          </Button>
        )}
        {editable && destinos.length > 0 && (
          <Button type="button" className="boton-oro" disabled={ocupado} onClick={() => pedirEnvio(true)}>
            Publicar ahora
          </Button>
        )}
        {cancelable && (
          <Button
            type="button"
            variant="outline"
            disabled={ocupado}
            onClick={() => void ejecutar({ accion: 'cancelar', postId })}
          >
            Cancelar publicación
          </Button>
        )}
        {sePuedeEliminar(estados) && (
          <Button type="button" variant="outline" disabled={ocupado} onClick={() => setEliminando(true)}>
            Eliminar
          </Button>
        )}
      </div>

      <ListaErrores errores={errores} />

      {publicacion.kind === 'hija' && (
        <Tarjeta>
          <p className="text-texto-secundario">
            Pertenece al video principal{' '}
            {principal ? (
              <Link href={`/publicaciones/${principal.id}`} className={ENLACE}>
                {principal.title}
              </Link>
            ) : (
              'que ya no existe'
            )}
            .
          </p>
          <div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={ocupado}
              onClick={() => void ejecutar({ accion: 'desvincular', postId })}
            >
              Desvincular del principal
            </Button>
          </div>
        </Tarjeta>
      )}

      {publicacion.kind === 'principal' && (
        <Tarjeta titulo="Hijas" etiqueta="Hijas">
          {hijas.length === 0 ? (
            <p className="text-texto-secundario">Aún no tiene Hijas.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {hijas.map((hija) => (
                <li key={hija.id} className="flex flex-wrap items-center gap-2">
                  <Link href={`/publicaciones/${hija.id}`} className={ENLACE}>
                    {hija.title}
                  </Link>
                  <span className="text-sm text-texto-secundario">{ETIQUETAS_ESTADO_PUBLICACION[hija.status]}</span>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {destinos.map((destino) => (
          <DestinoDetalle
            key={destino.platform}
            postId={postId}
            destino={destino}
            intentos={intentos[destino.platform] ?? []}
            zona={zona}
            ocupado={ocupado}
            alAccion={(accion) => void ejecutar(accion)}
          />
        ))}
        {destinos.length === 0 && <p className="text-texto-secundario">Esta publicación aún no tiene redes.</p>}
      </div>

      <ConfirmarEnvio
        abierto={confirmacion !== null}
        inmediata={confirmacion?.inmediata ?? false}
        redes={destinos.map((d) => d.platform)}
        advertencias={confirmacion?.advertencias ?? []}
        enviando={ocupado}
        alCerrar={() => setConfirmacion(null)}
        alConfirmar={() =>
          confirmacion && void ejecutar({ accion: 'programar', postId, inmediata: confirmacion.inmediata })
        }
      />

      <Dialog open={eliminando} onOpenChange={(abrir) => !abrir && setEliminando(false)}>
        <DialogContent className="bg-superficie">
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl">¿Eliminar esta publicación?</DialogTitle>
            <DialogDescription>
              Se borrarán sus redes y sus intentos. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEliminando(false)}>
              Volver
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={ocupado}
              onClick={() => void ejecutar({ accion: 'eliminar', postId })}
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
