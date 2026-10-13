'use client';

import {
  ETIQUETAS_PRIVACIDAD_TIKTOK,
  formatearDuracion,
  type CamposTiktok,
  type InfoCreadorTiktok,
  type PrivacidadTiktok,
} from '@omnistream/core';
import { useEffect, type ReactNode } from 'react';
import { Switch } from '@/components/ui/switch';

const SELECTOR = 'h-11 w-full rounded-[12px] border border-borde bg-superficie-elevada px-3 text-base text-texto';
const ENLACE = 'text-oro-profundo underline underline-offset-2';
const MUSICA = 'https://www.tiktok.com/legal/page/global/music-usage-confirmation/en';
const CONTENIDO_DE_MARCA = 'https://www.tiktok.com/legal/page/global/bc-policy/en';

type Interaccion = 'allowComments' | 'allowDuet' | 'allowStitch';

function Casilla({
  id,
  etiqueta,
  marcada,
  deshabilitada = false,
  ayuda,
  alCambiar,
}: {
  id: string;
  etiqueta: string;
  marcada: boolean;
  deshabilitada?: boolean;
  ayuda?: ReactNode;
  alCambiar(marcada: boolean): void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="flex items-center gap-2 text-texto">
        <input
          id={id}
          type="checkbox"
          checked={marcada}
          disabled={deshabilitada}
          onChange={(e) => alCambiar(e.target.checked)}
          className="size-4 accent-[var(--oro)]"
        />
        {etiqueta}
      </label>
      {ayuda && <p className="pl-6 text-sm text-texto-secundario">{ayuda}</p>}
    </div>
  );
}

// Pantalla de publicación de TikTok según sus pautas (spec 7.4.1): cuenta, privacidad sin valor por defecto,
// interacciones sin marcar, divulgación comercial y consentimiento.
export function SeccionTiktok({
  info,
  cargando,
  error,
  valores,
  formato,
  duracionSeg,
  alCambiar,
}: {
  info: InfoCreadorTiktok | null;
  cargando: boolean;
  error: string | null;
  valores: CamposTiktok;
  formato: 'tiktok' | 'imagen';
  duracionSeg?: number;
  alCambiar(valores: CamposTiktok): void;
}) {
  const desactivadas: Record<Interaccion, boolean> = {
    allowComments: info?.comentariosDesactivados ?? false,
    allowDuet: info?.duetDesactivado ?? false,
    allowStitch: info?.stitchDesactivado ?? false,
  };
  const interacciones: { campo: Interaccion; etiqueta: string }[] = [
    { campo: 'allowComments', etiqueta: 'Permitir comentarios' },
    ...(formato === 'imagen'
      ? []
      : [
          { campo: 'allowDuet' as const, etiqueta: 'Permitir Duet' },
          { campo: 'allowStitch' as const, etiqueta: 'Permitir Stitch' },
        ]),
  ];
  const { commercial } = valores;
  const deMarca = commercial.enabled && commercial.brandedContent;

  // Lo que la cuenta tiene desactivado no puede quedar marcado.
  const marcadasDesactivadas = interacciones.filter(({ campo }) => desactivadas[campo] && valores[campo]);
  useEffect(() => {
    if (marcadasDesactivadas.length === 0) return;
    alCambiar({ ...valores, ...Object.fromEntries(marcadasDesactivadas.map(({ campo }) => [campo, false])) });
  });

  const cambiar = (cambios: Partial<CamposTiktok>) => alCambiar({ ...valores, ...cambios });
  const cambiarComercial = (cambios: Partial<CamposTiktok['commercial']>) =>
    cambiar({ commercial: { ...commercial, ...cambios } });

  return (
    <section aria-label="TikTok" className="neu-elevado flex flex-col gap-4 p-6">
      <h2 className="font-heading text-2xl text-texto">TikTok</h2>
      {cargando && <p className="text-texto-secundario">Consultando tu cuenta de TikTok…</p>}
      {error && <p className="text-peligro">{error}</p>}
      {info && <p className="text-texto">{`Publicará como ${info.nickname} (@${info.username})`}</p>}

      <div className="flex flex-col gap-2">
        <label htmlFor="tt-privacidad" className="font-heading text-lg">
          ¿Quién puede verlo?
        </label>
        <select
          id="tt-privacidad"
          value={valores.privacy ?? ''}
          onChange={(e) => cambiar({ privacy: (e.target.value || null) as PrivacidadTiktok | null })}
          className={SELECTOR}
        >
          <option value="">Elige una opción</option>
          {(info?.privacidades ?? []).map((p) => (
            <option key={p} value={p} disabled={p === 'SELF_ONLY' && deMarca}>
              {ETIQUETAS_PRIVACIDAD_TIKTOK[p]}
            </option>
          ))}
        </select>
        {deMarca && <p className="text-sm text-texto-secundario">El contenido de marca no puede ser privado.</p>}
      </div>

      <div className="flex flex-col gap-2">
        {interacciones.map(({ campo, etiqueta }) => (
          <Casilla
            key={campo}
            id={`tt-${campo}`}
            etiqueta={etiqueta}
            marcada={valores[campo] && !desactivadas[campo]}
            deshabilitada={desactivadas[campo]}
            ayuda={desactivadas[campo] ? 'Desactivado en tu cuenta de TikTok.' : undefined}
            alCambiar={(marcada) => cambiar({ [campo]: marcada })}
          />
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <label htmlFor="tt-comercial" className="flex items-center gap-3 text-texto">
          <Switch
            id="tt-comercial"
            checked={commercial.enabled}
            onCheckedChange={(activo) =>
              cambiarComercial(activo ? { enabled: true } : { enabled: false, yourBrand: false, brandedContent: false })
            }
          />
          Divulgar contenido comercial
        </label>
        {commercial.enabled && (
          <div className="flex flex-col gap-2 pl-2">
            <Casilla
              id="tt-tu-marca"
              etiqueta="Tu marca"
              marcada={commercial.yourBrand}
              ayuda="Se etiquetará como «Contenido promocional»."
              alCambiar={(marcada) => cambiarComercial({ yourBrand: marcada })}
            />
            <Casilla
              id="tt-de-marca"
              etiqueta="Contenido de marca"
              marcada={commercial.brandedContent}
              ayuda="Se etiquetará como «Colaboración pagada»."
              alCambiar={(marcada) => cambiarComercial({ brandedContent: marcada })}
            />
            {!commercial.yourBrand && !commercial.brandedContent && (
              <p className="text-sm text-alerta">Indica si tu contenido te promociona a ti, a un tercero o a ambos.</p>
            )}
          </div>
        )}
      </div>

      {info && duracionSeg !== undefined && duracionSeg > info.duracionMaximaSeg && (
        <p className="text-peligro">{`Tu cuenta de TikTok admite videos de hasta ${formatearDuracion(info.duracionMaximaSeg)}.`}</p>
      )}

      <p className="text-sm text-texto-secundario">
        {deMarca ? (
          <>
            Al publicar, aceptas la{' '}
            <a href={CONTENIDO_DE_MARCA} target="_blank" rel="noopener noreferrer" className={ENLACE}>
              Política de contenido de marca
            </a>{' '}
            y la{' '}
            <a href={MUSICA} target="_blank" rel="noopener noreferrer" className={ENLACE}>
              Confirmación de uso de música
            </a>{' '}
            de TikTok.
          </>
        ) : (
          <>
            Al publicar, aceptas la{' '}
            <a href={MUSICA} target="_blank" rel="noopener noreferrer" className={ENLACE}>
              Confirmación de uso de música
            </a>{' '}
            de TikTok.
          </>
        )}
      </p>
    </section>
  );
}
