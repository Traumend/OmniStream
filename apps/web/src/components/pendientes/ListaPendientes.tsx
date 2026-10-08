'use client';

import {
  ETIQUETAS_RED,
  formatearFechaHora,
  REGLAS,
  textoReferencia,
  type Destino,
  type Platform,
  type Publicacion,
} from '@omnistream/core';
import Link from 'next/link';
import { InsigniaRed } from '@/components/publicaciones/InsigniaRed';
import { Button } from '@/components/ui/button';
import { copiar } from './copiar';

interface ItemManual {
  publicacion: Publicacion;
  destino: Destino;
}

interface ItemReferencia extends ItemManual {
  principal: Publicacion | null;
  urlPrincipal?: string;
}

const porHora = (a: ItemManual, b: ItemManual) =>
  (a.destino.scheduledAt?.getTime() ?? 0) - (b.destino.scheduledAt?.getTime() ?? 0);

function Encabezado({ publicacion, destino, zona }: ItemManual & { zona: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <InsigniaRed platform={destino.platform} estado={destino.status} />
      <h3 className="font-heading text-xl text-texto">{publicacion.title}</h3>
      <span className="text-sm text-texto-secundario">
        {REGLAS[destino.platform][destino.format]?.etiqueta ?? ETIQUETAS_RED[destino.platform]}
      </span>
      {destino.scheduledAt && (
        <span className="cifras text-sm text-texto-secundario">{formatearFechaHora(destino.scheduledAt, zona)}</span>
      )}
    </div>
  );
}

export function ListaPendientes({
  manuales,
  referencias,
  zona,
  alMarcarReferencia,
}: {
  manuales: ItemManual[];
  referencias: ItemReferencia[];
  zona: string;
  alMarcarReferencia(postId: string, red: Platform): Promise<void>;
}) {
  if (manuales.length === 0 && referencias.length === 0) {
    return <p className="py-10 text-center text-texto-secundario">No hay pendientes.</p>;
  }
  return (
    <div className="flex flex-col gap-8">
      {manuales.length > 0 && (
        <section aria-labelledby="titulo-manuales" className="flex flex-col gap-3">
          <h2 id="titulo-manuales" className="font-heading text-2xl text-texto">
            Publicaciones
          </h2>
          {[...manuales].sort(porHora).map((item) => (
            <article
              key={`${item.publicacion.id}-${item.destino.platform}`}
              aria-label={`${item.publicacion.title} · ${ETIQUETAS_RED[item.destino.platform]}`}
              className="neu-elevado flex flex-wrap items-center justify-between gap-3 p-4"
            >
              <Encabezado {...item} zona={zona} />
              <Button asChild size="sm" className="boton-oro">
                <Link href={`/pendientes/${item.publicacion.id}/${item.destino.platform}`}>Abrir paquete</Link>
              </Button>
            </article>
          ))}
        </section>
      )}
      {referencias.length > 0 && (
        <section aria-labelledby="titulo-referencias" className="flex flex-col gap-3">
          <h2 id="titulo-referencias" className="font-heading text-2xl text-texto">
            Referencias al video principal
          </h2>
          {[...referencias].sort(porHora).map((item) => {
            const texto = textoReferencia(item.principal?.title ?? '', item.urlPrincipal);
            return (
              <article
                key={`${item.publicacion.id}-${item.destino.platform}`}
                aria-label={`${item.publicacion.title} · ${ETIQUETAS_RED[item.destino.platform]}`}
                className="neu-elevado flex flex-col gap-3 p-4"
              >
                <Encabezado {...item} zona={zona} />
                <p className="text-sm text-texto-secundario">Publica este texto como primer comentario:</p>
                <p className="rounded-[12px] border border-borde bg-superficie-elevada px-3 py-2 text-texto">{texto}</p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => void copiar(texto)}>
                    Copiar
                  </Button>
                  {item.destino.remote && (
                    <Button asChild size="sm" variant="outline">
                      <a href={item.destino.remote.url} target="_blank" rel="noopener noreferrer">
                        Ver publicación
                      </a>
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    className="boton-oro"
                    onClick={() => void alMarcarReferencia(item.publicacion.id, item.destino.platform)}
                  >
                    Marcar referencia como publicada
                  </Button>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
