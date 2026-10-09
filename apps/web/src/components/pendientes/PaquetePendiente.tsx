'use client';

import {
  analizarUrlPublica,
  contenidoFinal,
  ETIQUETAS_RED,
  formatearFechaHora,
  REGLAS,
  textoReferencia,
  type Destino,
  type Publicacion,
} from '@omnistream/core';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { copiar } from './copiar';

const PRIVACIDAD: Record<string, string> = { public: 'Pública', unlisted: 'No listada', private: 'Privada' };
const CAMPO = 'rounded-[12px] bg-superficie-elevada text-base';

function CampoCopiable({
  id,
  etiqueta,
  valor,
  boton,
  multilinea = false,
}: {
  id: string;
  etiqueta: string;
  valor: string;
  boton: string;
  multilinea?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="font-heading text-lg">
        {etiqueta}
      </Label>
      {multilinea ? (
        <Textarea id={id} readOnly value={valor} rows={Math.min(12, valor.split('\n').length + 2)} className={CAMPO} />
      ) : (
        <Input id={id} readOnly value={valor} className={`h-11 ${CAMPO}`} />
      )}
      <div>
        <Button type="button" size="sm" variant="outline" onClick={() => void copiar(valor)}>
          {boton}
        </Button>
      </div>
    </div>
  );
}

function Dato({ termino, children }: { termino: string; children: ReactNode }) {
  return (
    <div className="contents">
      <dt className="text-texto-secundario">{termino}</dt>
      <dd className="text-texto">{children}</dd>
    </div>
  );
}

// Estructura simple y estable (encabezados, <dl> y etiquetas visibles) para que también pueda seguirla Claude en el navegador.
export function PaquetePendiente({
  publicacion,
  destino,
  principal,
  urlPrincipal,
  urlDescarga,
  preparandoDescarga = false,
  urlMiniatura,
  zona,
  alMarcarPublicada,
}: {
  publicacion: Publicacion;
  destino: Destino;
  principal: Publicacion | null;
  urlPrincipal?: string;
  urlDescarga?: string;
  preparandoDescarga?: boolean;
  urlMiniatura?: string;
  zona: string;
  alMarcarPublicada(url: string): Promise<void>;
}) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const red = destino.platform;
  const referencia =
    red === 'tiktok' && publicacion.parentId ? textoReferencia(principal?.title ?? '', urlPrincipal) : undefined;
  const contenido = contenidoFinal(publicacion, destino, referencia);

  async function marcar(evento: FormEvent) {
    evento.preventDefault();
    if (!analizarUrlPublica(red, url)) {
      setError(`La URL no corresponde a una publicación de ${ETIQUETAS_RED[red]}.`);
      return;
    }
    setError(null);
    setEnviando(true);
    try {
      await alMarcarPublicada(url.trim());
    } finally {
      setEnviando(false);
    }
  }

  return (
    <article aria-labelledby="titulo-paquete" className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <h1 id="titulo-paquete" className="text-4xl text-texto">
          {`${publicacion.title} · ${ETIQUETAS_RED[red]}`}
        </h1>
        <dl className="cifras grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <Dato termino="Formato">{REGLAS[red][destino.format]?.etiqueta ?? destino.format}</Dato>
          <Dato termino="Hora objetivo">
            {destino.scheduledAt ? formatearFechaHora(destino.scheduledAt, zona) : 'Sin hora'}
          </Dato>
        </dl>
      </header>

      <section aria-labelledby="titulo-archivo" className="neu-elevado flex flex-col gap-3 p-6">
        <h2 id="titulo-archivo" className="font-heading text-2xl text-texto">
          1. Archivo
        </h2>
        {urlDescarga ? (
          <div>
            <Button asChild className="boton-oro">
              <a href={urlDescarga} download target="_blank" rel="noopener noreferrer">
                Descargar archivo
              </a>
            </Button>
          </div>
        ) : preparandoDescarga ? (
          <p role="status" className="text-texto-secundario">
            Preparando la descarga…
          </p>
        ) : (
          <p className="text-peligro">El archivo ya no está disponible.</p>
        )}
      </section>

      <section aria-labelledby="titulo-texto" className="neu-elevado flex flex-col gap-4 p-6">
        <h2 id="titulo-texto" className="font-heading text-2xl text-texto">
          2. Texto
        </h2>
        {red === 'youtube' ? (
          <>
            <CampoCopiable id="yt-titulo" etiqueta="Título" valor={contenido.titulo ?? ''} boton="Copiar título" />
            <CampoCopiable
              id="yt-descripcion"
              etiqueta="Descripción"
              valor={contenido.texto}
              boton="Copiar descripción"
              multilinea
            />
            <CampoCopiable
              id="yt-etiquetas"
              etiqueta="Etiquetas"
              valor={(contenido.etiquetas ?? []).join(', ')}
              boton="Copiar etiquetas"
            />
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              <Dato termino="Privacidad">{PRIVACIDAD[destino.youtube?.privacy ?? 'public']}</Dato>
              <Dato termino="Hecho para niños">{destino.youtube?.madeForKids ? 'Sí' : 'No'}</Dato>
            </dl>
            {urlMiniatura && (
              <figure className="flex flex-col gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={urlMiniatura} alt="Miniatura" className="max-w-xs rounded-[12px] border border-borde" />
                <a href={urlMiniatura} download className="text-sm text-oro-profundo underline underline-offset-2">
                  Descargar miniatura
                </a>
              </figure>
            )}
          </>
        ) : (
          <CampoCopiable
            id="texto-final"
            etiqueta="Texto final"
            valor={contenido.texto}
            boton="Copiar texto"
            multilinea
          />
        )}
      </section>

      <section aria-labelledby="titulo-confirmar" className="neu-elevado flex flex-col gap-3 p-6">
        <h2 id="titulo-confirmar" className="font-heading text-2xl text-texto">
          3. Confirmar
        </h2>
        <form onSubmit={(e) => void marcar(e)} className="flex flex-col gap-3" noValidate>
          <Label htmlFor="url-publicada" className="font-heading text-lg">
            URL publicada
          </Label>
          <Input
            id="url-publicada"
            type="url"
            inputMode="url"
            placeholder="https://"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            aria-invalid={error !== null}
            className={`h-11 ${CAMPO}`}
          />
          {error && (
            <p role="alert" className="text-sm text-peligro">
              {error}
            </p>
          )}
          <div>
            <Button type="submit" className="boton-oro" disabled={enviando}>
              Marcar como publicada
            </Button>
          </div>
        </form>
      </section>
    </article>
  );
}
