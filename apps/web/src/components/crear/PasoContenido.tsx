'use client';

import {
  CATEGORIAS_YOUTUBE,
  ETIQUETAS_RED,
  type CamposTiktok,
  type FormatoDestino,
  type Fotograma,
  type Platform,
} from '@omnistream/core';
import { SeccionTiktok } from '@/components/publicaciones/SeccionTiktok';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { EstadoInfoTiktok } from '@/lib/conexiones/useInfoCreadorTiktok';
import type { FormularioPublicacion } from '@/lib/publicaciones/formulario';
import { cn } from '@/lib/utils';
import { CAMPO, Campo, SELECTOR, Seccion } from './comunes';

const MINIATURAS: { valor: Fotograma; etiqueta: string }[] = [
  { valor: 'start', etiqueta: 'Inicio' },
  { valor: 'middle', etiqueta: 'Mitad' },
  { valor: 'end', etiqueta: 'Final' },
];
const PRIVACIDADES = [
  { valor: 'public', etiqueta: 'Pública' },
  { valor: 'unlisted', etiqueta: 'No listada' },
  { valor: 'private', etiqueta: 'Privada' },
] as const;

export interface PropsPasoContenido {
  form: FormularioPublicacion;
  contadores: { red: Platform; largo: number; limite: number }[];
  tiktokPorApi?: { formato: FormatoDestino; info: EstadoInfoTiktok; duracionSeg?: number };
  alCambiar(cambios: Partial<Pick<FormularioPublicacion, 'title' | 'text' | 'hashtags'>>): void;
  alCambiarYoutube(cambios: Partial<FormularioPublicacion['youtube']>): void;
  alCambiarTiktok(tiktok: CamposTiktok): void;
}

// Spec 8.4: título, texto base con contadores por red, hashtags y los campos propios de YouTube y TikTok.
export function PasoContenido({
  form,
  contadores,
  tiktokPorApi,
  alCambiar,
  alCambiarYoutube,
  alCambiarTiktok,
}: PropsPasoContenido) {
  return (
    <>
      <Seccion titulo="Contenido">
        <Campo id="titulo" etiqueta="Título">
          <Input
            id="titulo"
            value={form.title}
            onChange={(e) => alCambiar({ title: e.target.value })}
            className={CAMPO}
          />
        </Campo>
        <Campo id="texto" etiqueta="Texto">
          <Textarea
            id="texto"
            rows={6}
            value={form.text}
            onChange={(e) => alCambiar({ text: e.target.value })}
            className="rounded-[12px] bg-superficie-elevada text-base"
          />
        </Campo>
        <Campo id="hashtags" etiqueta="Hashtags" ayuda="Separados por espacios o comas">
          <Input
            id="hashtags"
            value={form.hashtags}
            onChange={(e) => alCambiar({ hashtags: e.target.value })}
            className={CAMPO}
          />
        </Campo>
        {contadores.length > 0 && (
          <ul className="cifras flex flex-wrap gap-3 text-sm" aria-label="Caracteres por red">
            {contadores.map(({ red, largo, limite }) => (
              <li
                key={red}
                data-excedido={largo > limite}
                className={cn(
                  'rounded-full border px-3 py-1',
                  largo > limite ? 'border-peligro/40 text-peligro' : 'border-borde text-texto-secundario',
                )}
              >
                {`${ETIQUETAS_RED[red]}: ${largo} / ${limite}`}
              </li>
            ))}
          </ul>
        )}
      </Seccion>

      {form.redes.youtube && (
        <Seccion titulo="YouTube">
          <Campo id="yt-descripcion" etiqueta="Descripción de YouTube" ayuda="Si la dejas vacía se usa el texto.">
            <Textarea
              id="yt-descripcion"
              rows={4}
              value={form.youtube.description}
              onChange={(e) => alCambiarYoutube({ description: e.target.value })}
              className="rounded-[12px] bg-superficie-elevada text-base"
            />
          </Campo>
          <Campo id="yt-etiquetas" etiqueta="Etiquetas de YouTube" ayuda="Separadas por comas">
            <Input
              id="yt-etiquetas"
              value={form.youtube.tags}
              onChange={(e) => alCambiarYoutube({ tags: e.target.value })}
              className={CAMPO}
            />
          </Campo>
          <div className="grid gap-4 sm:grid-cols-3">
            <Campo id="yt-categoria" etiqueta="Categoría">
              <select
                id="yt-categoria"
                value={form.youtube.categoryId}
                onChange={(e) => alCambiarYoutube({ categoryId: e.target.value })}
                className={SELECTOR}
              >
                {CATEGORIAS_YOUTUBE.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo id="yt-privacidad" etiqueta="Privacidad">
              <select
                id="yt-privacidad"
                value={form.youtube.privacy}
                onChange={(e) =>
                  alCambiarYoutube({ privacy: e.target.value as FormularioPublicacion['youtube']['privacy'] })
                }
                className={SELECTOR}
              >
                {PRIVACIDADES.map((p) => (
                  <option key={p.valor} value={p.valor}>
                    {p.etiqueta}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo id="yt-miniatura" etiqueta="Miniatura">
              <select
                id="yt-miniatura"
                value={form.youtube.frame}
                onChange={(e) => alCambiarYoutube({ frame: e.target.value as Fotograma })}
                className={SELECTOR}
              >
                {MINIATURAS.map((m) => (
                  <option key={m.valor} value={m.valor}>
                    {m.etiqueta}
                  </option>
                ))}
              </select>
            </Campo>
          </div>
          <label className="flex items-center gap-2 text-texto">
            <input
              type="checkbox"
              checked={form.youtube.madeForKids}
              onChange={(e) => alCambiarYoutube({ madeForKids: e.target.checked })}
              className="size-4 accent-[var(--oro)]"
            />
            Hecho para niños
          </label>
        </Seccion>
      )}

      {tiktokPorApi && (
        <SeccionTiktok
          {...tiktokPorApi.info}
          valores={form.tiktok}
          formato={tiktokPorApi.formato === 'imagen' ? 'imagen' : 'tiktok'}
          duracionSeg={tiktokPorApi.duracionSeg}
          alCambiar={alCambiarTiktok}
        />
      )}
    </>
  );
}
