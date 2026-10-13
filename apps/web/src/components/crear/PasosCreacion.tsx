'use client';

import {
  contarCaracteres,
  contenidoFinal,
  FORMATOS_POR_RED,
  modoDePublicacion,
  PLATAFORMAS,
  problemasDeJerarquia,
  REGLAS,
  sugerirDestinos,
  textoReferencia,
  urlVideoYoutube,
  type Asset,
  type Conexion,
  type Destino,
  type EntradaPublicacion,
  type FormatoDestino,
  type ModoPublicacion,
  type Platform,
  type Publicacion,
} from '@omnistream/core';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ConfirmarEnvio } from '@/components/publicaciones/ConfirmarEnvio';
import type { EstadoInfoTiktok } from '@/lib/conexiones/useInfoCreadorTiktok';
import type { GestorSubidas, ProgresoSubida } from '@/lib/archivos/gestorSubidas';
import { crearAutoguardado, type Autoguardado, type EstadoGuardado } from '@/lib/crear/autoguardado';
import { ETIQUETAS_PASO, PASOS, type Paso } from '@/lib/crear/pasos';
import { aEntrada, aFormulario, FORMULARIO_VACIO, type FormularioPublicacion } from '@/lib/publicaciones/formulario';
import { revisarEnvio, type Intencion } from '@/lib/publicaciones/revisarEnvio';
import { cn } from '@/lib/utils';
import { Seccion } from './comunes';
import { PasoArchivo } from './PasoArchivo';
import { PasoContenido } from './PasoContenido';
import { PasoDestinos } from './PasoDestinos';
import { PasoPublicar } from './PasoPublicar';

export { ETIQUETAS_PASO, PASOS, type Paso };
export type { Intencion };

export interface PropsPasos {
  zona: string;
  archivos: Asset[];
  principales: { publicacion: Publicacion; hijas: number }[];
  inicial?: { publicacion: Publicacion; destinos: Destino[]; hijas: number };
  archivoInicial?: string;
  pasoInicial?: Paso;
  ahora?: () => Date;
  renderMiniatura?(asset: Asset): ReactNode;
  // Conexiones de las redes: deciden si cada destino se publica por API o en modo manual.
  conexiones?: Partial<Record<Platform, Conexion>>;
  infoTiktok?: EstadoInfoTiktok;
  subidas?: ReadonlyMap<string, ProgresoSubida>;
  alSubir?(archivo: File): ReturnType<GestorSubidas['iniciar']>;
  alGuardarBorrador(entrada: EntradaPublicacion): Promise<{ postId: string }>;
  alEnviar(entrada: EntradaPublicacion, intencion: Intencion): Promise<void>;
  retardoAutoguardadoMs?: number;
}

const SIN_INFO_TIKTOK: EstadoInfoTiktok = { info: null, cargando: false, error: null };
const SIN_SUBIDAS: ReadonlyMap<string, ProgresoSubida> = new Map();
// Peor caso del largo de la referencia en TikTok: los ids de YouTube tienen 11 caracteres.
const URL_DE_MUESTRA = urlVideoYoutube('XXXXXXXXXXX');

const TEXTO_GUARDADO: Partial<Record<EstadoGuardado, string>> = {
  pendiente: 'Guardando…',
  guardando: 'Guardando…',
  guardado: 'Guardado',
  error: 'No se pudo guardar el borrador.',
};

function formatoInicial(red: Platform, asset: Asset | null): FormatoDestino {
  const tipo = asset?.kind === 'image' ? 'image' : 'video';
  const opciones = FORMATOS_POR_RED[red];
  return opciones.find((f) => REGLAS[red][f]?.tipoArchivo === tipo) ?? (opciones[0] as FormatoDestino);
}

function sugerencias(asset: Asset | undefined): FormularioPublicacion['redes'] {
  return asset ? Object.fromEntries(sugerirDestinos(asset).map((d) => [d.platform, d.format])) : {};
}

// El paso va en la URL (?paso=) para que una recarga lo conserve.
function urlConPaso(paso: Paso, ruta = window.location.pathname): string {
  const parametros = new URLSearchParams(window.location.search);
  parametros.set('paso', paso);
  return `${ruta}?${parametros.toString()}`;
}

export function PasosCreacion({
  zona,
  archivos,
  principales,
  inicial,
  archivoInicial,
  pasoInicial,
  ahora = () => new Date(),
  renderMiniatura,
  conexiones = {},
  infoTiktok = SIN_INFO_TIKTOK,
  subidas = SIN_SUBIDAS,
  alSubir,
  alGuardarBorrador,
  alEnviar,
  retardoAutoguardadoMs,
}: PropsPasos) {
  const [form, setForm] = useState<FormularioPublicacion>(() =>
    inicial
      ? aFormulario(inicial.publicacion, inicial.destinos, zona)
      : {
          ...FORMULARIO_VACIO,
          assetId: archivoInicial ?? '',
          redes: sugerencias(archivos.find((a) => a.id === archivoInicial)),
        },
  );
  const [paso, setPaso] = useState<Paso>(pasoInicial ?? (inicial ? 'canvas' : 'archivo'));
  const [postId, setPostId] = useState(inicial?.publicacion.id);
  const [estadoGuardado, setEstadoGuardado] = useState<EstadoGuardado>('sin_cambios');
  const [errores, setErrores] = useState<string[]>([]);
  const [confirmacion, setConfirmacion] = useState<{ intencion: Intencion; advertencias: string[] } | null>(null);
  const [enviando, setEnviando] = useState(false);

  // El autoguardado vive todo el tiempo que el editor esté montado; lee las props más recientes por refs.
  const guardarRef = useRef(alGuardarBorrador);
  const postIdRef = useRef(postId);
  const pasoRef = useRef(paso);
  useEffect(() => {
    guardarRef.current = alGuardarBorrador;
    pasoRef.current = paso;
  });
  const autoguardadoRef = useRef<Autoguardado | null>(null);
  // Se crea al primer uso, desde un evento, y no durante el render.
  const autoguardado = () =>
    (autoguardadoRef.current ??= crearAutoguardado({
      retardoMs: retardoAutoguardadoMs,
      alEstado: setEstadoGuardado,
      guardar: async (entrada) => {
        const resultado = await guardarRef.current(entrada);
        if (!postIdRef.current) {
          postIdRef.current = resultado.postId;
          setPostId(resultado.postId);
          // En Crear, el primer guardado pasa a la URL de edición sin volver a montar el editor.
          if (!inicial) {
            window.history.replaceState(
              null,
              '',
              urlConPaso(pasoRef.current, `/publicaciones/${resultado.postId}/editar`),
            );
          }
        }
        return resultado;
      },
    }));
  // Lo pendiente se guarda también al salir del editor.
  useEffect(() => () => void autoguardadoRef.current?.vaciar().catch(() => undefined), []);

  const esProgramada = inicial?.destinos.some((d) => d.status === 'programada') ?? false;
  const asset = archivos.find((a) => a.id === form.assetId) ?? null;
  const opcionesPrincipal = principales.filter((p) => p.publicacion.id !== postId);
  const principal = opcionesPrincipal.find((p) => p.publicacion.id === form.parentId)?.publicacion ?? null;
  const entrada = useMemo(() => aEntrada(form, zona, postId), [form, zona, postId]);
  const modos = useMemo(
    () =>
      Object.fromEntries(
        PLATAFORMAS.flatMap((red) => {
          const formato = form.redes[red];
          return formato ? [[red, modoDePublicacion(conexiones[red], formato)]] : [];
        }),
      ) as Partial<Record<Platform, ModoPublicacion>>,
    [form.redes, conexiones],
  );

  // Decisión 4: solo un borrador con título y jerarquía válida se guarda solo.
  function autoguardar(siguiente: FormularioPublicacion) {
    if (esProgramada) return;
    const datos = aEntrada(siguiente, zona, postIdRef.current);
    if (!datos.title.trim()) return;
    const elegido = opcionesPrincipal.find((p) => p.publicacion.id === siguiente.parentId)?.publicacion ?? null;
    const jerarquia = problemasDeJerarquia({
      destinos: datos.destinos,
      parentId: datos.parentId ?? undefined,
      principal: elegido,
      tipoActual: inicial?.publicacion.kind,
      numeroDeHijas: inicial?.hijas ?? 0,
    });
    if (jerarquia.length === 0) autoguardado().programar(datos);
  }

  const cambiar = (siguiente: FormularioPublicacion) => {
    setForm(siguiente);
    autoguardar(siguiente);
  };
  const actualizar = (cambios: Partial<FormularioPublicacion>) => cambiar({ ...form, ...cambios });

  const elegirArchivo = (id: string) =>
    cambiar({
      ...form,
      assetId: id,
      redes: Object.keys(form.redes).length === 0 ? sugerencias(archivos.find((a) => a.id === id)) : form.redes,
    });

  const alternarRed = (red: Platform, marcada: boolean) => {
    const redes = { ...form.redes };
    if (marcada) redes[red] = formatoInicial(red, asset);
    else delete redes[red];
    actualizar({ redes });
  };

  const irA = (siguiente: Paso) => {
    setPaso(siguiente);
    window.history.replaceState(null, '', urlConPaso(siguiente));
  };

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

  function validar(intencion: Intencion) {
    return revisarEnvio(
      {
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
        modos,
        duracionMaximaTiktokSeg: infoTiktok.info?.duracionMaximaSeg,
      },
      intencion,
      esProgramada,
    );
  }

  // Antes de enviar se guarda lo pendiente del autoguardado, así se programa la versión más reciente.
  async function ejecutar(intencion: Intencion) {
    setEnviando(true);
    try {
      let id = postIdRef.current;
      try {
        id = (await autoguardado().vaciar()) ?? id;
      } catch {
        setErrores(['No se pudo guardar el borrador.']);
        return;
      }
      await alEnviar(id ? { ...entrada, postId: id } : entrada, intencion);
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

  const formatoTiktok = form.redes.tiktok;
  const textoGuardado = TEXTO_GUARDADO[estadoGuardado];

  return (
    <form className="flex flex-col gap-6" noValidate onSubmit={(e) => e.preventDefault()}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Pasos" className="overflow-x-auto">
          <ol className="flex gap-2">
            {PASOS.map((p, indice) => (
              <li key={p}>
                <button
                  type="button"
                  aria-current={p === paso ? 'step' : undefined}
                  disabled={p !== 'archivo' && !form.assetId}
                  onClick={() => irA(p)}
                  className={cn(
                    'flex items-center gap-2 whitespace-nowrap rounded-full border border-borde px-3 py-1.5 text-sm text-texto-secundario transition-colors disabled:opacity-40',
                    p === paso && 'border-oro neu-hundido text-texto',
                  )}
                >
                  <span className="cifras text-xs" aria-hidden="true">
                    {indice + 1}
                  </span>
                  {ETIQUETAS_PASO[p]}
                </button>
              </li>
            ))}
          </ol>
        </nav>
        <p
          role="status"
          className={cn('text-sm', estadoGuardado === 'error' ? 'text-peligro' : 'text-texto-secundario')}
        >
          {textoGuardado ?? ''}
        </p>
      </div>

      {paso === 'archivo' && (
        <PasoArchivo
          archivos={archivos}
          subidas={subidas}
          elegido={form.assetId}
          alElegir={elegirArchivo}
          alSubir={alSubir}
          renderMiniatura={renderMiniatura}
        />
      )}
      {paso === 'destinos' && (
        <PasoDestinos
          redes={form.redes}
          parentId={form.parentId}
          modos={modos}
          opcionesPrincipal={opcionesPrincipal}
          alAlternarRed={alternarRed}
          alCambiarFormato={(red, formato) => actualizar({ redes: { ...form.redes, [red]: formato } })}
          alElegirPrincipal={(parentId) => actualizar({ parentId })}
        />
      )}
      {paso === 'canvas' && (
        <Seccion titulo="Canvas">
          <p className="text-texto-secundario">El canvas estará disponible pronto.</p>
        </Seccion>
      )}
      {paso === 'contenido' && (
        <PasoContenido
          form={form}
          contadores={contadores}
          tiktokPorApi={
            formatoTiktok && modos.tiktok === 'api'
              ? { formato: formatoTiktok, info: infoTiktok, duracionSeg: asset?.durationSec }
              : undefined
          }
          alCambiar={actualizar}
          alCambiarYoutube={(cambios) => actualizar({ youtube: { ...form.youtube, ...cambios } })}
          alCambiarTiktok={(tiktok) => actualizar({ tiktok })}
        />
      )}
      {paso === 'vista' && (
        <Seccion titulo="Vista previa">
          <p className="text-texto-secundario">La vista previa estará disponible pronto.</p>
        </Seccion>
      )}
      {paso === 'publicar' && (
        <PasoPublicar
          fecha={form.fecha}
          hora={form.hora}
          zona={zona}
          errores={errores}
          esProgramada={esProgramada}
          enviando={enviando}
          alCambiarFecha={actualizar}
          alEnviar={enviar}
        />
      )}

      <ConfirmarEnvio
        abierto={confirmacion !== null}
        inmediata={confirmacion?.intencion === 'publicar_ahora'}
        redes={entrada.destinos.map((d) => d.platform)}
        advertencias={confirmacion?.advertencias ?? []}
        enviando={enviando}
        alCerrar={() => setConfirmacion(null)}
        alConfirmar={() => confirmacion && void ejecutar(confirmacion.intencion)}
      />
    </form>
  );
}
