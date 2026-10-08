'use client';

import {
  CATEGORIAS_YOUTUBE,
  contarCaracteres,
  contenidoFinal,
  ETIQUETAS_RED,
  FORMATOS_POR_RED,
  formatearDuracion,
  MENSAJES_JERARQUIA,
  PLATAFORMAS,
  REGLAS,
  sugerirDestinos,
  textoReferencia,
  urlVideoYoutube,
  validarPublicacion,
  type Asset,
  type Destino,
  type EntradaPublicacion,
  type FormatoDestino,
  type Fotograma,
  type Platform,
  type Publicacion,
} from '@omnistream/core';
import Link from 'next/link';
import { useMemo, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { aEntrada, aFormulario, FORMULARIO_VACIO, type FormularioPublicacion } from '@/lib/publicaciones/formulario';
import { cn } from '@/lib/utils';

export type Intencion = 'guardar' | 'programar' | 'publicar_ahora';

export interface PropsEditor {
  zona: string;
  archivos: Asset[];
  principales: { publicacion: Publicacion; hijas: number }[];
  inicial?: { publicacion: Publicacion; destinos: Destino[]; hijas: number };
  archivoInicial?: string;
  ahora?: () => Date;
  renderMiniatura?(asset: Asset): ReactNode;
  alEnviar(entrada: EntradaPublicacion, intencion: Intencion): Promise<void>;
}

const MENSAJES_DE_JERARQUIA = new Set<string>(Object.values(MENSAJES_JERARQUIA));
// Peor caso del largo de la referencia en TikTok: los ids de YouTube tienen 11 caracteres.
const URL_DE_MUESTRA = urlVideoYoutube('XXXXXXXXXXX');
const CAMPO = 'h-11 rounded-[12px] bg-superficie-elevada text-base';
const SELECTOR = 'h-11 w-full rounded-[12px] border border-borde bg-superficie-elevada px-3 text-base text-texto';
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

const etiquetaFormato = (red: Platform, formato: FormatoDestino) =>
  REGLAS[red][formato]?.etiqueta.split(' · ')[1] ?? formato;

function formatoInicial(red: Platform, asset: Asset | null): FormatoDestino {
  const tipo = asset?.kind === 'image' ? 'image' : 'video';
  const opciones = FORMATOS_POR_RED[red];
  return opciones.find((f) => REGLAS[red][f]?.tipoArchivo === tipo) ?? (opciones[0] as FormatoDestino);
}

function sugerencias(asset: Asset | undefined): FormularioPublicacion['redes'] {
  return asset ? Object.fromEntries(sugerirDestinos(asset).map((d) => [d.platform, d.format])) : {};
}

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="neu-elevado flex flex-col gap-4 p-6">
      <h2 className="font-heading text-2xl text-texto">{titulo}</h2>
      {children}
    </section>
  );
}

function Campo({
  id,
  etiqueta,
  ayuda,
  children,
}: {
  id: string;
  etiqueta: string;
  ayuda?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="font-heading text-lg">
        {etiqueta}
      </Label>
      {children}
      {ayuda && <p className="text-sm text-texto-secundario">{ayuda}</p>}
    </div>
  );
}

export function EditorPublicacion({
  zona,
  archivos,
  principales,
  inicial,
  archivoInicial,
  ahora = () => new Date(),
  renderMiniatura,
  alEnviar,
}: PropsEditor) {
  const [form, setForm] = useState<FormularioPublicacion>(() =>
    inicial
      ? aFormulario(inicial.publicacion, inicial.destinos, zona)
      : {
          ...FORMULARIO_VACIO,
          assetId: archivoInicial ?? '',
          redes: sugerencias(archivos.find((a) => a.id === archivoInicial)),
        },
  );
  const [errores, setErrores] = useState<string[]>([]);
  const [confirmacion, setConfirmacion] = useState<{ intencion: Intencion; advertencias: string[] } | null>(null);
  const [enviando, setEnviando] = useState(false);

  const postId = inicial?.publicacion.id;
  const esProgramada = inicial?.destinos.some((d) => d.status === 'programada') ?? false;
  const asset = archivos.find((a) => a.id === form.assetId) ?? null;
  const opcionesPrincipal = principales.filter((p) => p.publicacion.id !== postId);
  const principal = opcionesPrincipal.find((p) => p.publicacion.id === form.parentId)?.publicacion ?? null;
  const esPrincipal = form.redes.youtube === 'video_largo';
  const entrada = useMemo(() => aEntrada(form, zona, postId), [form, zona, postId]);

  const actualizar = (cambios: Partial<FormularioPublicacion>) => setForm((f) => ({ ...f, ...cambios }));
  const actualizarYoutube = (cambios: Partial<FormularioPublicacion['youtube']>) =>
    setForm((f) => ({ ...f, youtube: { ...f.youtube, ...cambios } }));

  const elegirArchivo = (id: string) =>
    setForm((f) => ({
      ...f,
      assetId: id,
      redes: Object.keys(f.redes).length === 0 ? sugerencias(archivos.find((a) => a.id === id)) : f.redes,
    }));

  const alternarRed = (red: Platform, marcada: boolean) =>
    setForm((f) => {
      const redes = { ...f.redes };
      if (marcada) redes[red] = formatoInicial(red, asset);
      else delete redes[red];
      return { ...f, redes };
    });

  const contadores = entrada.destinos.flatMap((destino) => {
    const limite = REGLAS[destino.platform][destino.format]?.limiteTexto;
    if (!limite) return [];
    const referencia =
      destino.platform === 'tiktok' && entrada.parentId
        ? textoReferencia(principal?.title ?? '', URL_DE_MUESTRA)
        : undefined;
    const largo = contarCaracteres(contenidoFinal(entrada, { ...destino, overrides: {} }, referencia).texto);
    return [{ red: destino.platform, largo, limite }];
  });

  function validar(intencion: Intencion): { errores: string[]; advertencias: string[] } {
    const hora =
      intencion === 'publicar_ahora'
        ? 'inmediata'
        : intencion === 'programar' || esProgramada
          ? 'programada'
          : 'sin_comprobar';
    const problemas = validarPublicacion({
      publicacion: {
        title: entrada.title,
        assetId: entrada.assetId ?? undefined,
        base: entrada.base,
        scheduledAt: entrada.scheduledAt ? new Date(entrada.scheduledAt) : null,
        parentId: entrada.parentId ?? undefined,
      },
      destinos: entrada.destinos.map((d) => ({ ...d, overrides: {} })),
      asset,
      principal,
      tipoActual: inicial?.publicacion.kind,
      numeroDeHijas: inicial?.hijas ?? 0,
      ahora: ahora(),
      hora,
    });
    let encontrados = problemas.filter((p) => p.nivel === 'error').map((p) => p.mensaje);
    // Un borrador puede guardarse incompleto; solo la jerarquía debe ser válida.
    if (intencion === 'guardar' && !esProgramada) encontrados = encontrados.filter((m) => MENSAJES_DE_JERARQUIA.has(m));
    if (!entrada.title.trim()) encontrados.unshift('Escribe un título');
    return {
      errores: encontrados,
      advertencias: problemas.filter((p) => p.nivel === 'advertencia').map((p) => p.mensaje),
    };
  }

  async function ejecutar(intencion: Intencion) {
    setEnviando(true);
    try {
      await alEnviar(entrada, intencion);
    } finally {
      setEnviando(false);
      setConfirmacion(null);
    }
  }

  function enviar(intencion: Intencion) {
    const resultado = validar(intencion);
    setErrores(resultado.errores);
    if (resultado.errores.length > 0) return;
    if (intencion === 'guardar') void ejecutar(intencion);
    else setConfirmacion({ intencion, advertencias: resultado.advertencias });
  }

  return (
    <form className="flex flex-col gap-6" noValidate onSubmit={(e) => e.preventDefault()}>
      <Seccion titulo="Archivo">
        {archivos.length === 0 ? (
          <p className="text-texto-secundario">
            No hay archivos listos.{' '}
            <Link href="/biblioteca" className="text-oro-profundo underline underline-offset-2">
              Sube uno en la Biblioteca.
            </Link>
          </p>
        ) : (
          <div role="radiogroup" aria-label="Archivo" className="grid gap-3 sm:grid-cols-2">
            {archivos.map((archivo) => {
              const detalles = [
                archivo.durationSec ? formatearDuracion(archivo.durationSec) : null,
                archivo.width && archivo.height ? `${archivo.width} × ${archivo.height}` : null,
              ].filter(Boolean);
              return (
                <label
                  key={archivo.id}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-[14px] border border-borde p-3',
                    form.assetId === archivo.id && 'border-oro neu-hundido',
                  )}
                >
                  <input
                    type="radio"
                    name="archivo"
                    value={archivo.id}
                    checked={form.assetId === archivo.id}
                    onChange={() => elegirArchivo(archivo.id)}
                    className="size-4 accent-[var(--oro)]"
                  />
                  {renderMiniatura?.(archivo)}
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-texto">{archivo.originalName}</span>
                    <span className="cifras text-sm text-texto-secundario">{detalles.join(' · ')}</span>
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </Seccion>

      <Seccion titulo="Redes">
        <div className="grid gap-3 sm:grid-cols-2">
          {PLATAFORMAS.map((red) => {
            const formato = form.redes[red];
            return (
              <div key={red} className="flex items-center gap-3 rounded-[14px] border border-borde p-3">
                <label className="flex flex-1 items-center gap-2 text-texto">
                  <input
                    type="checkbox"
                    checked={formato !== undefined}
                    onChange={(e) => alternarRed(red, e.target.checked)}
                    className="size-4 accent-[var(--oro)]"
                  />
                  {ETIQUETAS_RED[red]}
                </label>
                {formato && (
                  <select
                    aria-label={`Formato en ${ETIQUETAS_RED[red]}`}
                    value={formato}
                    onChange={(e) => actualizar({ redes: { ...form.redes, [red]: e.target.value as FormatoDestino } })}
                    className="h-9 rounded-[10px] border border-borde bg-superficie-elevada px-2 text-sm"
                  >
                    {FORMATOS_POR_RED[red].map((f) => (
                      <option key={f} value={f}>
                        {etiquetaFormato(red, f)}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            );
          })}
        </div>
      </Seccion>

      <Seccion titulo="Jerarquía">
        {esPrincipal ? (
          <p className="text-texto-secundario">Esta publicación será un video Principal.</p>
        ) : (
          <Campo id="principal" etiqueta="¿Pertenece a un video principal?">
            <select
              id="principal"
              value={form.parentId}
              onChange={(e) => actualizar({ parentId: e.target.value })}
              className={SELECTOR}
            >
              <option value="">No pertenece</option>
              {opcionesPrincipal.map(({ publicacion, hijas }) => (
                <option key={publicacion.id} value={publicacion.id}>
                  {`${publicacion.title} (${hijas === 1 ? '1 Hija' : `${hijas} Hijas`})`}
                </option>
              ))}
            </select>
          </Campo>
        )}
      </Seccion>

      <Seccion titulo="Contenido">
        <Campo id="titulo" etiqueta="Título">
          <Input
            id="titulo"
            value={form.title}
            onChange={(e) => actualizar({ title: e.target.value })}
            className={CAMPO}
          />
        </Campo>
        <Campo id="texto" etiqueta="Texto">
          <Textarea
            id="texto"
            rows={6}
            value={form.text}
            onChange={(e) => actualizar({ text: e.target.value })}
            className="rounded-[12px] bg-superficie-elevada text-base"
          />
        </Campo>
        <Campo id="hashtags" etiqueta="Hashtags" ayuda="Separados por espacios o comas">
          <Input
            id="hashtags"
            value={form.hashtags}
            onChange={(e) => actualizar({ hashtags: e.target.value })}
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
              onChange={(e) => actualizarYoutube({ description: e.target.value })}
              className="rounded-[12px] bg-superficie-elevada text-base"
            />
          </Campo>
          <Campo id="yt-etiquetas" etiqueta="Etiquetas de YouTube" ayuda="Separadas por comas">
            <Input
              id="yt-etiquetas"
              value={form.youtube.tags}
              onChange={(e) => actualizarYoutube({ tags: e.target.value })}
              className={CAMPO}
            />
          </Campo>
          <div className="grid gap-4 sm:grid-cols-3">
            <Campo id="yt-categoria" etiqueta="Categoría">
              <select
                id="yt-categoria"
                value={form.youtube.categoryId}
                onChange={(e) => actualizarYoutube({ categoryId: e.target.value })}
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
                  actualizarYoutube({ privacy: e.target.value as FormularioPublicacion['youtube']['privacy'] })
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
                onChange={(e) => actualizarYoutube({ frame: e.target.value as Fotograma })}
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
              onChange={(e) => actualizarYoutube({ madeForKids: e.target.checked })}
              className="size-4 accent-[var(--oro)]"
            />
            Hecho para niños
          </label>
        </Seccion>
      )}

      <Seccion titulo="Fecha y hora">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo id="fecha" etiqueta="Fecha">
            <Input
              id="fecha"
              type="date"
              value={form.fecha}
              onChange={(e) => actualizar({ fecha: e.target.value })}
              className={CAMPO}
            />
          </Campo>
          <Campo id="hora" etiqueta="Hora">
            <Input
              id="hora"
              type="time"
              value={form.hora}
              onChange={(e) => actualizar({ hora: e.target.value })}
              className={CAMPO}
            />
          </Campo>
        </div>
        <p className="text-sm text-texto-secundario">Zona horaria: {zona}</p>
      </Seccion>

      {errores.length > 0 && (
        <div
          role="alert"
          aria-label="Errores"
          className="rounded-[12px] border border-peligro/40 bg-peligro/5 px-4 py-3 text-sm text-peligro"
        >
          <ul className="list-disc space-y-1 pl-5">
            {errores.map((mensaje) => (
              <li key={mensaje}>{mensaje}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-3">
        <Button type="button" variant="outline" disabled={enviando} onClick={() => enviar('guardar')}>
          {esProgramada ? 'Guardar cambios' : 'Guardar borrador'}
        </Button>
        {!esProgramada && (
          <Button type="button" variant="outline" disabled={enviando} onClick={() => enviar('programar')}>
            Programar
          </Button>
        )}
        <Button type="button" className="boton-oro" disabled={enviando} onClick={() => enviar('publicar_ahora')}>
          Publicar ahora
        </Button>
      </div>

      <Dialog open={confirmacion !== null} onOpenChange={(abrir) => !abrir && setConfirmacion(null)}>
        <DialogContent className="bg-superficie">
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl">
              {confirmacion?.intencion === 'publicar_ahora' ? 'Confirmar publicación' : 'Confirmar programación'}
            </DialogTitle>
            <DialogDescription>
              {`${entrada.destinos.length} ${entrada.destinos.length === 1 ? 'red' : 'redes'}: ${entrada.destinos
                .map((d) => ETIQUETAS_RED[d.platform])
                .join(', ')}.`}
            </DialogDescription>
          </DialogHeader>
          {confirmacion && confirmacion.advertencias.length > 0 ? (
            <div className="flex flex-col gap-2">
              <h3 className="font-heading text-lg text-alerta">Advertencias</h3>
              <ul className="list-disc space-y-1 pl-5 text-sm text-texto-secundario">
                {confirmacion.advertencias.map((mensaje) => (
                  <li key={mensaje}>{mensaje}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-texto-secundario">Sin advertencias.</p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmacion(null)}>
              Volver
            </Button>
            <Button
              type="button"
              className="boton-oro"
              disabled={enviando}
              onClick={() => confirmacion && void ejecutar(confirmacion.intencion)}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}
