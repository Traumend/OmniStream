'use client';

import {
  ETIQUETAS_TIPO_PROMOCION,
  TIPOS_PROMOCION,
  type ItemPromocion,
  type Publicacion,
  type TipoPromocion,
} from '@omnistream/core';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { aFechaUtc, aPartesLocales } from '@/lib/fechas';
import { cn } from '@/lib/utils';

const ENLACE = 'text-oro-profundo underline underline-offset-2';
const CAMPO = 'h-10 rounded-[12px] bg-superficie-elevada text-base';
const SELECTOR = 'h-10 rounded-[12px] border border-borde bg-superficie-elevada px-2 text-base text-texto';
const DIA_MS = 24 * 60 * 60 * 1000;
const AYUDA_COMUNIDAD = 'YouTube no permite publicar en Comunidad por API: hazlo en YouTube Studio y márcalo aquí.';

const nuevoId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `i${Date.now().toString(36)}`;

const fechaRelativa = (base: Date | null, dias: number) => (base ? new Date(base.getTime() + dias * DIA_MS) : null);

function aCampo(fecha: Date | null, zona: string): string {
  if (!fecha) return '';
  const { fecha: dia, hora } = aPartesLocales(fecha, zona);
  return `${dia}T${hora}`;
}

// Lista de promoción de un Principal (spec 6.10): lo que falta publicar para darle exposición al video.
export function PanelPromocion({
  publicacion,
  hijas,
  zona,
  fechaBase = publicacion.scheduledAt,
  urlYoutube,
  ahora = () => new Date(),
  alGuardar,
}: {
  publicacion: Publicacion;
  hijas: Publicacion[];
  zona: string;
  fechaBase?: Date | null;
  urlYoutube?: string;
  ahora?: () => Date;
  alGuardar(items: ItemPromocion[]): Promise<void>;
}) {
  const [items, setItems] = useState<ItemPromocion[]>(() => publicacion.promotion?.items ?? []);
  const [guardando, setGuardando] = useState(false);
  const momento = ahora().getTime();
  const hechos = items.filter((i) => i.status === 'hecho').length;
  const titulosHijas = new Map(hijas.map((h) => [h.id, h.title]));

  const cambiar = (indice: number, cambios: Partial<ItemPromocion>) =>
    setItems((actuales) => actuales.map((item, i) => (i === indice ? { ...item, ...cambios } : item)));

  async function guardar() {
    setGuardando(true);
    try {
      await alGuardar(items);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section aria-label="Promoción" className="neu-elevado flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-heading text-2xl text-texto">Promoción</h2>
        <span className="cifras text-texto-secundario">{`${hechos} de ${items.length}`}</span>
      </div>
      {publicacion.origin === 'youtube_importado' && (
        <p className="flex flex-wrap gap-1 text-sm text-texto-secundario">
          <span>Importado de YouTube</span>
          {urlYoutube && (
            <>
              {' · '}
              <a href={urlYoutube} target="_blank" rel="noopener noreferrer" className={ENLACE}>
                Ver en YouTube
              </a>
            </>
          )}
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {items.map((item, i) => {
          const n = i + 1;
          const vencido = item.status === 'pendiente' && item.dueAt !== null && item.dueAt.getTime() <= momento;
          const tituloHija = item.hijaId ? titulosHijas.get(item.hijaId) : undefined;
          return (
            <li
              key={item.id}
              aria-label={`Pendiente ${n}`}
              className="flex flex-col gap-2 rounded-[14px] border border-borde p-3"
            >
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-texto">
                  <input
                    type="checkbox"
                    checked={item.status === 'hecho'}
                    onChange={(e) => cambiar(i, { status: e.target.checked ? 'hecho' : 'pendiente' })}
                    className="size-4 accent-[var(--oro)]"
                  />
                  {item.title}
                </label>
                <span className="rounded-full border border-borde px-2 py-0.5 text-xs text-texto-secundario">
                  {ETIQUETAS_TIPO_PROMOCION[item.type]}
                </span>
                {vencido && <span className="text-sm font-medium text-alerta">Vencido</span>}
                {tituloHija && (
                  <Link href={`/publicaciones/${item.hijaId}`} className={cn(ENLACE, 'text-sm')}>
                    {tituloHija}
                  </Link>
                )}
              </div>
              <div className="grid gap-2 sm:grid-cols-[1fr_9rem]">
                <Input
                  aria-label={`Título del pendiente ${n}`}
                  value={item.title}
                  onChange={(e) => cambiar(i, { title: e.target.value })}
                  className={CAMPO}
                />
                <select
                  aria-label={`Tipo del pendiente ${n}`}
                  value={item.type}
                  onChange={(e) => cambiar(i, { type: e.target.value as TipoPromocion })}
                  className={SELECTOR}
                >
                  {TIPOS_PROMOCION.map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {ETIQUETAS_TIPO_PROMOCION[tipo]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  aria-label={`Fecha del pendiente ${n}`}
                  type="datetime-local"
                  value={aCampo(item.dueAt, zona)}
                  onChange={(e) => {
                    const [dia, hora] = e.target.value.split('T');
                    if (dia && hora) cambiar(i, { dueAt: aFechaUtc(dia, hora, zona), dueAtEdited: true });
                  }}
                  className={cn('cifras w-auto', CAMPO)}
                />
                {item.dueAtEdited && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => cambiar(i, { dueAtEdited: false, dueAt: fechaRelativa(fechaBase, item.offsetDays) })}
                  >
                    Restablecer fecha
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setItems((actuales) => actuales.filter((_, j) => j !== i))}
                >
                  Quitar
                </Button>
              </div>
              <Input
                aria-label={`Nota del pendiente ${n}`}
                placeholder="Nota (opcional)"
                value={item.note ?? ''}
                onChange={(e) => cambiar(i, { note: e.target.value || undefined })}
                className={CAMPO}
              />
              {item.type === 'comunidad' && <p className="text-sm text-texto-secundario">{AYUDA_COMUNIDAD}</p>}
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            setItems((actuales) => [
              ...actuales,
              {
                id: nuevoId(),
                type: 'short',
                title: 'Nuevo pendiente',
                offsetDays: 0,
                dueAt: fechaRelativa(fechaBase, 0),
                dueAtEdited: false,
                status: 'pendiente',
              },
            ])
          }
        >
          Agregar pendiente
        </Button>
        <Button type="button" className="boton-oro" disabled={guardando} onClick={() => void guardar()}>
          {guardando ? 'Guardando…' : 'Guardar promoción'}
        </Button>
      </div>
    </section>
  );
}
