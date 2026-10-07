# Fase 2A (Publicación asistida): plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: usar superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para implementar este plan tarea por tarea. Los pasos usan casillas (`- [ ]`) para el seguimiento.

**Objetivo:** publicar de punta a punta en modo asistido: crear publicaciones con su jerarquía Padre/Hijo, programarlas o publicarlas ahora en las 4 redes, recibir el aviso push a la hora, resolverlas desde `/pendientes` con un paquete listo para copiar, moverlas en el calendario sin duplicarlas y purgar archivos según la retención.

**Arquitectura:** `core` concentra las decisiones (estados, reglas por red, validación, jerarquía, cola, retención, textos) como funciones puras. Solo las funciones escriben publicaciones: una invocable `publicaciones` con las acciones del usuario, `publicarDestino` en Cloud Tasks, `alCambiarDestino` sobre `targets` y dos programadas (`encolarPendientes`, `limpiarRetencion`). La web lee Firestore en tiempo real y llama a la invocable; las reglas dejan `posts`, `targets`, `attempts`, `notifications` y `connections` en solo lectura.

**Stack:** lo de la fase 1 más Cloud Tasks (`onTaskDispatched`, `getFunctions().taskQueue`), Cloud Scheduler (`onSchedule`), Firebase Cloud Messaging (web push con service worker propio), FullCalendar 6.1.21 (edición MIT) con `@fullcalendar/luxon3`, y Luxon.

**Spec:** `docs/superpowers/specs/2026-10-07-omnistream-design.md` (secciones 2.1 D15–D16, 5.4, 6.3, 6.4, 6.7, 6.8, 6.9, 7.2, 7.4, 7.5, 7.6, 7.7, 8.2, 8.6, 8.7, 11, 12, 13 y la fila 2A de la sección 14).

## Restricciones globales

- Siguen vigentes las de la fase 1: Node.js ≥ 22, solo pnpm, TypeScript `strict` con `noUncheckedIndexedAccess`, español neutro sin voseo, locale `es-419`, región `us-central1`, proyecto de emuladores `demo-omnistream`, sin código de Postmill ni Easel, sin llamadas reales a redes ni a proveedores de IA, commits en español con prefijo convencional.
- `Platform` en el orden de la spec: `facebook`, `instagram`, `youtube`, `tiktok`; etiquetas `Facebook`, `Instagram`, `YouTube`, `TikTok`.
- Fechas en UTC en Firestore. La interfaz muestra y captura en `settings/app.timezone`.
- El cliente nunca escribe `posts`, `targets`, `attempts`, `notifications` ni `connections`; toda escritura pasa por la invocable `publicaciones`. El cliente sí escribe `assets` (fase 1) y `settings/app`.
- Toda función nueva declara `region: REGION`. El Firestore de las funciones usa `ignoreUndefinedProperties: true`.
- Cola: ventana de 29 días; `lease` de 15 minutos; anticipación máxima tolerada de 60 s; Cloud Tasks con 5 intentos y esperas de 60 a 1.800 s; id de tarea `{postId}-{red}-v{scheduleVersion}`, con sufijo `-r{attempts}` en las recuperaciones.
- Retención: `retentionDays` de `settings/app`; un destino `fallida` cuenta como terminal a los 30 días; un archivo sin publicaciones se purga a los 30 días de creado; fotogramas y metadatos se conservan.
- FullCalendar en la versión exacta `6.1.21` en todos sus paquetes (la 7 cambió de arquitectura).
- La URL de referencia a un Principal es `https://youtu.be/{remote.id}` de su destino de YouTube.
- Los errores de las funciones llevan el mensaje en español en `HttpsError.message`; la web lo muestra tal cual.

## Foco de revisión

1. **Tarea entregada antes de su hora** (el emulador de Cloud Tasks ignora `scheduleTime`; en producción, un desfase de reloj): no debe publicar ni marcar nada; si faltan más de 60 s, termina sin efecto. Pruebas en la Tarea 4 (`decidirToma` y la tarea anticipada) y en la Tarea 5 ("mover no duplica").
2. **El mismo evento de Firestore entregado dos veces** (los disparadores son al-menos-una-vez): no debe duplicar el push. Prueba en la Tarea 7 (`notificar` con el mismo id envía una sola vez).
3. **Hora local inexistente por horario de verano** (`America/New_York`, 2026-03-08 02:30): se guarda la hora válida siguiente (03:30 EDT = 07:30 UTC), sin error. Prueba en la Tarea 10.
4. **Borrar un archivo que una publicación usa**: la Biblioteca lo impide con mensaje claro; si aun así falta al publicar, el destino queda `fallida` con "El archivo ya no está disponible.". Pruebas en las Tareas 2 y 9.
5. **Índice compuesto ausente en producción** (el emulador no exige índices; producción rechaza la consulta de `/pendientes` y de `encolarPendientes`): `firestore.indexes.json` declara los índices de grupo de colecciones. Prueba en la Tarea 3.

---

## Estructura de archivos

```
packages/core/src/
  index.ts                               (+ export de publicaciones)
  archivos/formato.ts                    (+ formatearFechaHora)
  archivos/retencion.ts                  calcularPurga, DIAS_SIN_USO, DIAS_FALLIDA_TERMINAL
  publicaciones/index.ts
  publicaciones/tipos.ts                 Platform, formatos, estados, Publicacion, Destino, Intento, etiquetas
  publicaciones/conversion.ts            leerPublicacion, leerDestino, leerIntento, destinoNuevo
  publicaciones/texto.ts                 normalizarHashtags, componerTexto, contarCaracteres, textoReferencia, contenidoFinal
  publicaciones/estados.ts               estadoPublicacion, esEditable, sePuedeEliminar, sePuedeMover, ESTADOS_CANCELABLES
  publicaciones/jerarquia.ts             tipoDePublicacion, problemasDeJerarquia
  publicaciones/entrada.ts               entradaPublicacionSchema, accionPublicacionSchema
  publicaciones/reglas.ts                REGLAS, reglaDe, LIMITES_YOUTUBE, largoEtiquetasYoutube
  publicaciones/validacion.ts            validarPublicacion, mensajeProblemas
  publicaciones/sugerencias.ts           sugerirDestinos
  publicaciones/urls.ts                  analizarUrlPublica
  publicaciones/cola.ts                  decidirToma, necesitaEncolarse, estaAtascado, idTarea, modoDePublicacion
  publicaciones/avisos.ts                avisoDe
functions/src/
  index.ts                               (+ nuevas funciones, ignoreUndefinedProperties)
  publicacion/firestore.ts               referencias y lectura de publicaciones
  publicacion/autorizacion.ts            exigirPropietario
  publicacion/cola.ts                    Encolador, encoladorCloudTasks, encolarDestino
  publicacion/publicarDestino.ts         ejecutarTarea + onTaskDispatched
  publicacion/publicaciones.ts           despacharAccion + onCall
  publicacion/acciones/guardar.ts        guardarPublicacion
  publicacion/acciones/programar.ts      programarPublicacion, moverPublicacion, reintentarDestino
  publicacion/acciones/cierre.ts         cancelarPublicacion, eliminarPublicacion, desvincularHija, marcarPublicada, marcarReferencia
  publicacion/notificaciones.ts          crearNotificador, enviarPushFcm
  publicacion/alCambiarDestino.ts        reaccionarACambio + onDocumentWritten
  publicacion/encolarPendientes.ts       encolarPendientesAhora + onSchedule
  publicacion/limpiarRetencion.ts        limpiarRetencionAhora + onSchedule
  publicacion/indices.test.ts
firestore.rules, firestore.indexes.json, firebase.json
pruebas/integracion/src/
  admin.ts, sesion.ts, esperar.ts, datos.ts
  reglas.test.ts                         (+ publicaciones)
  funciones/publicarDestino.test.ts, funciones/publicaciones.test.ts, funciones/cierre.test.ts,
  funciones/alCambiarDestino.test.ts, funciones/notificaciones.test.ts,
  funciones/encolarPendientes.test.ts, funciones/limpiarRetencion.test.ts
apps/web/
  public/sw-notificaciones.js, public/icono.svg
  e2e/fase1.spec.ts (inicio en /calendario), e2e/fase2.spec.ts, e2e/ayudantes.ts (+ subirArchivo)
  src/app/page.tsx, src/app/manifest.ts, src/app/globals.css (FullCalendar)
  src/app/(publico)/entrar/page.tsx, src/app/(publico)/privacidad/page.tsx
  src/app/(app)/calendario/page.tsx, src/app/(app)/crear/page.tsx
  src/app/(app)/publicaciones/[id]/page.tsx, src/app/(app)/publicaciones/[id]/editar/page.tsx
  src/app/(app)/pendientes/page.tsx, src/app/(app)/pendientes/[postId]/[red]/page.tsx
  src/app/(app)/ajustes/general/page.tsx
  src/components/publicaciones/{InsigniaRed,EditorPublicacion,DetallePublicacion}.tsx
  src/components/calendario/{eventos.ts,CalendarioPublicaciones.tsx,BorradoresSinFecha.tsx}
  src/components/pendientes/{ListaPendientes,PaquetePendiente}.tsx
  src/components/ajustes/TarjetaNotificaciones.tsx
  src/components/biblioteca/DetalleArchivo.tsx (purga, posponer, crear publicación)
  src/components/shell/{navegacion.ts,BarraLateral.tsx,Shell.tsx,AreaPrivada.tsx}
  src/lib/firebase/cliente.ts (+ functions)
  src/lib/fechas.ts, src/lib/ajustes/useAjustes.ts
  src/lib/publicaciones/{acciones.ts,repositorio.ts,formulario.ts}
  src/lib/archivos/repositorio.ts (posponerPurga, guarda de eliminación)
  src/lib/notificaciones/{estado.ts,activar.ts}
docs/configuracion.md, README.md
```

---

### Tarea 1: Dominio de publicaciones en `core`

**Archivos:**
- Crear: `packages/core/src/publicaciones/{tipos,conversion,texto,estados,jerarquia,entrada,index}.ts`
- Modificar: `packages/core/src/index.ts`, `packages/core/src/archivos/formato.ts`
- Prueba: `packages/core/src/publicaciones/{conversion,texto,estados,jerarquia,entrada}.test.ts`, `packages/core/src/archivos/formato.test.ts`

**Interfaces:**
- Produce (`tipos.ts`):
  ```ts
  const PLATAFORMAS = ['facebook', 'instagram', 'youtube', 'tiktok'] as const;
  type Platform = (typeof PLATAFORMAS)[number];
  const ETIQUETAS_RED: Record<Platform, string>;      // Facebook, Instagram, YouTube, TikTok
  const ABREVIATURAS_RED: Record<Platform, string>;   // FB, IG, YT, TT
  const FORMATOS = ['video_largo', 'short', 'reel', 'tiktok', 'imagen'] as const;
  type FormatoDestino = (typeof FORMATOS)[number];
  const ETIQUETAS_FORMATO: Record<FormatoDestino, string>; // Video largo, Short, Reel, Video de TikTok, Imagen
  const FORMATOS_POR_RED: Record<Platform, readonly FormatoDestino[]>;
  //   facebook: reel, video_largo, imagen · instagram: reel, imagen · youtube: video_largo, short · tiktok: tiktok, imagen
  type EstadoDestino = 'borrador' | 'programada' | 'publicando' | 'publicada' | 'fallida' | 'pendiente_manual' | 'cancelada';
  type EstadoPublicacion = 'idea' | 'borrador' | 'programada' | 'publicando' | 'publicada' | 'parcial' | 'fallida';
  type TipoPublicacion = 'principal' | 'hija' | 'independiente';
  type EstadoReferencia = 'no_aplica' | 'en_espera' | 'pendiente' | 'publicada' | 'fallida';
  type ModoPublicacion = 'api' | 'manual';
  type TipoError = 'temporal' | 'definitivo' | 'ambiguo' | 'auth';
  interface CamposYoutube { description: string; tags: string[]; categoryId: string;
    privacy: 'public' | 'unlisted' | 'private'; madeForKids: boolean; thumbnail?: { frame: Fotograma } }
  const CAMPOS_YOUTUBE_POR_DEFECTO: CamposYoutube; // '', [], '22', 'public', false
  const CATEGORIAS_YOUTUBE: { id: string; nombre: string }[];
  //   1 Cine y animación, 2 Autos y vehículos, 10 Música, 15 Mascotas y animales, 17 Deportes, 19 Viajes y eventos,
  //   20 Videojuegos, 22 Personas y blogs, 23 Comedia, 24 Entretenimiento, 25 Noticias y política,
  //   26 Consejos y estilo, 27 Educación, 28 Ciencia y tecnología, 29 ONG y activismo
  interface RemoteRef { id: string; url: string }
  interface Publicacion { id: string; kind: TipoPublicacion; parentId?: string; status: EstadoPublicacion; title: string;
    assetId?: string; base: { text: string; hashtags: string[] }; scheduledAt: Date | null;
    targetStatus: Partial<Record<Platform, EstadoDestino>>; createdAt: Date; updatedAt: Date }
  interface Destino { platform: Platform; format: FormatoDestino;
    overrides: { text?: string; hashtags?: string[]; title?: string; scheduledAt?: Date };
    youtube?: CamposYoutube; scheduledAt?: Date; scheduleVersion: number; enqueuedVersion?: number;
    publishMode: ModoPublicacion; status: EstadoDestino; statusChangedAt: Date;
    lease?: { attemptId: string; until: Date }; checkpoint?: { stage: string; data: Record<string, unknown> };
    remote?: RemoteRef & { publishedAt: Date }; parentRef: { status: EstadoReferencia; remoteCommentId?: string };
    attempts: number; lastError?: { code: string; message: string; kind: TipoError; at: Date } }
  interface Intento { id: string; at: Date; stage: string; result: 'ok' | 'error' | 'omitido'; error?: string }
  const ETIQUETAS_ESTADO_DESTINO: Record<EstadoDestino, string>;      // Borrador, Programada, Publicando, Publicada, Fallida, Pendiente manual, Cancelada
  const ETIQUETAS_ESTADO_PUBLICACION: Record<EstadoPublicacion, string>; // Idea, Borrador, Programada, Publicando, Publicada, Parcial, Fallida
  const ETIQUETAS_TIPO: Record<TipoPublicacion, string>;              // Principal, Hija, Independiente
  ```
- Produce (`conversion.ts`): `leerPublicacion(id: string, datos: unknown): Publicacion`, `leerDestino(datos: unknown): Destino`, `leerIntento(id: string, datos: unknown): Intento`, `destinoNuevo(platform: Platform, format: FormatoDestino, opciones: { esHija: boolean; ahora: Date; youtube?: CamposYoutube }): Destino`. Las fechas se reconocen por tener `toDate()` (Timestamp del SDK cliente o de administración) o por ser `Date`.
- Produce (`texto.ts`): `normalizarHashtags(entrada: string | readonly string[]): string[]`, `componerTexto(texto: string, hashtags: readonly string[]): string`, `contarCaracteres(texto: string): number`, `urlVideoYoutube(id: string): string`, `textoReferencia(tituloPrincipal: string, url?: string): string`, `contenidoFinal(publicacion: Pick<Publicacion, 'title' | 'base'>, destino: Pick<Destino, 'platform' | 'overrides' | 'youtube'>, referencia?: string): { titulo?: string; texto: string; etiquetas?: string[] }`.
- Produce (`estados.ts`): `estadoPublicacion(estados: readonly EstadoDestino[], actual: EstadoPublicacion): EstadoPublicacion`, `esEditable(estados): boolean`, `sePuedeEliminar(estados): boolean`, `sePuedeMover(estados, nuevaFecha: Date, ahora: Date): boolean`, `ESTADOS_CANCELABLES: ReadonlySet<EstadoDestino>`.
- Produce (`jerarquia.ts`): `tipoDePublicacion(destinos: readonly Pick<Destino, 'platform' | 'format'>[], parentId?: string | null): TipoPublicacion`, `problemasDeJerarquia(contexto: ContextoJerarquia): string[]` con `ContextoJerarquia = { destinos: readonly Pick<Destino, 'platform' | 'format'>[]; parentId?: string | null; principal: Pick<Publicacion, 'id' | 'kind'> | null; tipoActual?: TipoPublicacion; numeroDeHijas: number }`.
- Produce (`entrada.ts`): `camposYoutubeSchema`, `entradaPublicacionSchema`, `type EntradaPublicacion`, `accionPublicacionSchema`, `type AccionPublicacion`, `interface RespuestaPublicaciones { postId: string }`.
- Produce (`archivos/formato.ts`): `formatearFechaHora(fecha: Date, zona: string): string` (`Intl.DateTimeFormat(LOCALE, { dateStyle: 'medium', timeStyle: 'short', timeZone: zona })`).

- [ ] **Paso 1: Escribir las pruebas que fallan**

`texto.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { CAMPOS_YOUTUBE_POR_DEFECTO } from './tipos';
import { componerTexto, contarCaracteres, contenidoFinal, normalizarHashtags, textoReferencia } from './texto';

describe('normalizarHashtags', () => {
  it('quita #, espacios internos, vacíos y duplicados sin distinguir mayúsculas', () => {
    expect(normalizarHashtags(['#Viaje', 'viaje', ' #mar ', '', 'dos palabras'])).toEqual(['Viaje', 'mar', 'dospalabras']);
  });
  it('acepta texto separado por espacios o comas', () => {
    expect(normalizarHashtags('#uno, dos  #tres')).toEqual(['uno', 'dos', 'tres']);
  });
});

it('componerTexto une texto y hashtags con una línea en blanco', () => {
  expect(componerTexto('Hola', ['a', 'b'])).toBe('Hola\n\n#a #b');
  expect(componerTexto('  ', ['a'])).toBe('#a');
  expect(componerTexto('Hola', [])).toBe('Hola');
});

it('contarCaracteres cuenta puntos de código, no unidades UTF-16', () => {
  expect(contarCaracteres('ñandú 👍')).toBe(7);
});

it('textoReferencia incluye la URL solo si existe', () => {
  expect(textoReferencia('Mi viaje', 'https://youtu.be/abc')).toBe('Video completo en YouTube: «Mi viaje» https://youtu.be/abc');
  expect(textoReferencia('Mi viaje')).toBe('Video completo en YouTube: «Mi viaje»');
});

describe('contenidoFinal', () => {
  const publicacion = { title: 'Mi viaje', base: { text: 'Hola', hashtags: ['mar'] } };
  it('Instagram usa texto y hashtags', () => {
    expect(contenidoFinal(publicacion, { platform: 'instagram', overrides: {} })).toEqual({ texto: 'Hola\n\n#mar' });
  });
  it('TikTok agrega la referencia al final', () => {
    expect(contenidoFinal(publicacion, { platform: 'tiktok', overrides: {} }, 'Video completo en YouTube: «Largo»').texto).toBe(
      'Hola\n\n#mar\n\nVideo completo en YouTube: «Largo»',
    );
  });
  it('YouTube usa su descripción o, si está vacía, el texto base', () => {
    const youtube = { ...CAMPOS_YOUTUBE_POR_DEFECTO, description: 'Desc', tags: ['a'] };
    expect(contenidoFinal(publicacion, { platform: 'youtube', overrides: {}, youtube })).toEqual({
      titulo: 'Mi viaje', texto: 'Desc\n\n#mar', etiquetas: ['a'],
    });
    expect(contenidoFinal(publicacion, { platform: 'youtube', overrides: {}, youtube: CAMPOS_YOUTUBE_POR_DEFECTO }).texto).toBe('Hola\n\n#mar');
  });
  it('los overrides tienen prioridad', () => {
    const r = contenidoFinal(publicacion, { platform: 'youtube', overrides: { title: 'T', text: 'Otro', hashtags: [] }, youtube: CAMPOS_YOUTUBE_POR_DEFECTO });
    expect(r).toMatchObject({ titulo: 'T', texto: 'Otro' });
  });
});
```

`estados.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { esEditable, estadoPublicacion, sePuedeEliminar, sePuedeMover } from './estados';

describe('estadoPublicacion', () => {
  it.each([
    [[], 'programada', 'borrador'],
    [['cancelada', 'cancelada'], 'programada', 'borrador'],
    [['borrador'], 'idea', 'idea'],
    [['borrador', 'borrador'], 'borrador', 'borrador'],
    [['publicada', 'publicada'], 'programada', 'publicada'],
    [['publicada', 'publicando'], 'programada', 'publicando'],
    [['publicada', 'pendiente_manual'], 'programada', 'programada'],
    [['programada', 'fallida'], 'programada', 'programada'],
    [['publicada', 'fallida'], 'programada', 'parcial'],
    [['fallida', 'cancelada'], 'programada', 'fallida'],
    [['publicada', 'cancelada'], 'programada', 'publicada'],
  ] as const)('%j desde %s → %s', (estados, actual, esperado) => {
    expect(estadoPublicacion(estados, actual)).toBe(esperado);
  });
});

it('esEditable solo con borrador, programada o cancelada', () => {
  expect(esEditable([])).toBe(true);
  expect(esEditable(['borrador', 'programada', 'cancelada'])).toBe(true);
  expect(esEditable(['programada', 'pendiente_manual'])).toBe(false);
  expect(esEditable(['fallida'])).toBe(false);
});

it('sePuedeEliminar salvo publicada o publicando', () => {
  expect(sePuedeEliminar(['fallida', 'pendiente_manual', 'cancelada'])).toBe(true);
  expect(sePuedeEliminar(['publicada'])).toBe(false);
  expect(sePuedeEliminar(['publicando'])).toBe(false);
});

it('sePuedeMover exige que sea editable y que la nueva fecha sea futura', () => {
  const ahora = new Date('2026-10-07T12:00:00Z');
  expect(sePuedeMover(['programada'], new Date('2026-10-08T12:00:00Z'), ahora)).toBe(true);
  expect(sePuedeMover(['programada'], new Date('2026-10-07T11:59:00Z'), ahora)).toBe(false);
  expect(sePuedeMover(['publicada'], new Date('2026-10-08T12:00:00Z'), ahora)).toBe(false);
});
```
`estadoPublicacion` ignora los `borrador` cuando hay otros estados activos; con solo `borrador` conserva `idea` si era el estado actual.

`jerarquia.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { problemasDeJerarquia, tipoDePublicacion } from './jerarquia';

const largo = { platform: 'youtube', format: 'video_largo' } as const;
const corto = { platform: 'instagram', format: 'reel' } as const;
const principal = { id: 'p1', kind: 'principal' } as const;

it('tipoDePublicacion', () => {
  expect(tipoDePublicacion([largo, corto])).toBe('principal');
  expect(tipoDePublicacion([corto], 'p1')).toBe('hija');
  expect(tipoDePublicacion([corto])).toBe('independiente');
  expect(tipoDePublicacion([largo], 'p1')).toBe('principal');
});

describe('problemasDeJerarquia', () => {
  it('sin problemas para una Hija válida', () => {
    expect(problemasDeJerarquia({ destinos: [corto], parentId: 'p1', principal, numeroDeHijas: 0 })).toEqual([]);
  });
  it.each([
    [{ destinos: [largo], parentId: 'p1', principal, numeroDeHijas: 0 }, 'Un video principal no puede pertenecer a otro.'],
    [{ destinos: [corto], parentId: 'p1', principal: null, numeroDeHijas: 0 }, 'El video principal elegido ya no existe.'],
    [{ destinos: [corto], parentId: 'p1', principal: { id: 'p1', kind: 'independiente' }, numeroDeHijas: 0 }, 'La publicación elegida no es un video principal.'],
    [{ destinos: [{ platform: 'facebook', format: 'video_largo' }], parentId: 'p1', principal, numeroDeHijas: 0 }, 'Una Hija solo puede tener videos cortos o imágenes.'],
    [{ destinos: [corto], tipoActual: 'principal', principal: null, numeroDeHijas: 2 }, 'Esta publicación tiene Hijas. Desvincúlalas antes de quitarle el video largo de YouTube.'],
  ] as const)('%#', (contexto, mensaje) => {
    expect(problemasDeJerarquia(contexto)).toContain(mensaje);
  });
});
```

`entrada.test.ts`:
```ts
import { expect, it } from 'vitest';
import { accionPublicacionSchema, entradaPublicacionSchema } from './entrada';

const minima = { title: 'Hola', assetId: null, base: { text: '', hashtags: [] }, scheduledAt: null, parentId: null, destinos: [] };
const mensaje = (r: { success: boolean; error?: { issues: { message: string }[] } }) => r.error?.issues[0]?.message;

it('acepta una entrada mínima', () => {
  expect(entradaPublicacionSchema.safeParse(minima).success).toBe(true);
});
it('rechaza título vacío', () => {
  expect(mensaje(entradaPublicacionSchema.safeParse({ ...minima, title: '  ' }))).toBe('Escribe un título');
});
it('rechaza redes repetidas', () => {
  const destinos = [{ platform: 'tiktok', format: 'tiktok' }, { platform: 'tiktok', format: 'imagen' }];
  expect(mensaje(entradaPublicacionSchema.safeParse({ ...minima, destinos }))).toBe('Cada red puede aparecer una sola vez.');
});
it('rechaza un formato que la red no admite', () => {
  const destinos = [{ platform: 'youtube', format: 'imagen' }];
  expect(mensaje(entradaPublicacionSchema.safeParse({ ...minima, destinos }))).toBe('YouTube no admite el formato Imagen.');
});
it('exige fechas ISO en UTC', () => {
  expect(entradaPublicacionSchema.safeParse({ ...minima, scheduledAt: '2026-10-08 10:00' }).success).toBe(false);
  expect(entradaPublicacionSchema.safeParse({ ...minima, scheduledAt: '2026-10-08T16:30:00.000Z' }).success).toBe(true);
});
it('valida cada acción', () => {
  expect(accionPublicacionSchema.safeParse({ accion: 'mover', postId: 'p', scheduledAt: 'mañana' }).success).toBe(false);
  expect(mensaje(accionPublicacionSchema.safeParse({ accion: 'marcarPublicada', postId: 'p', platform: 'tiktok', url: ' ' }))).toBe('Pega la URL de la publicación.');
  expect(accionPublicacionSchema.safeParse({ accion: 'borrarTodo' }).success).toBe(false);
  expect(accionPublicacionSchema.safeParse({ accion: 'programar', postId: 'p', inmediata: true }).success).toBe(true);
});
```

`conversion.test.ts`:
```ts
import { expect, it } from 'vitest';
import { destinoNuevo, leerDestino, leerPublicacion } from './conversion';

const ts = (iso: string) => ({ toDate: () => new Date(iso) });

it('leerPublicacion convierte fechas y aplica valores por defecto', () => {
  const p = leerPublicacion('p1', { kind: 'independiente', status: 'borrador', title: 'x', base: { text: '', hashtags: [] },
    createdAt: ts('2026-10-01T00:00:00Z'), updatedAt: ts('2026-10-02T00:00:00Z') });
  expect(p).toMatchObject({ id: 'p1', scheduledAt: null, targetStatus: {}, updatedAt: new Date('2026-10-02T00:00:00Z') });
});
it('leerDestino convierte fechas anidadas y completa valores por defecto', () => {
  const d = leerDestino({ platform: 'facebook', format: 'reel', status: 'publicando', statusChangedAt: ts('2026-10-07T10:00:00Z'),
    lease: { attemptId: 'a', until: ts('2026-10-07T10:15:00Z') } });
  expect(d).toMatchObject({ overrides: {}, attempts: 0, scheduleVersion: 0, publishMode: 'manual', parentRef: { status: 'no_aplica' },
    lease: { attemptId: 'a', until: new Date('2026-10-07T10:15:00Z') } });
});
it('destinoNuevo crea un borrador', () => {
  const ahora = new Date('2026-10-07T12:00:00Z');
  expect(destinoNuevo('instagram', 'reel', { esHija: true, ahora })).toEqual({
    platform: 'instagram', format: 'reel', overrides: {}, scheduleVersion: 0, publishMode: 'manual', status: 'borrador',
    statusChangedAt: ahora, parentRef: { status: 'en_espera' }, attempts: 0,
  });
});
```

En `formato.test.ts`, agregar:
```ts
it('formatearFechaHora usa la zona indicada', () => {
  const fecha = new Date('2026-10-08T15:30:00Z');
  expect(formatearFechaHora(fecha, 'America/Mexico_City')).toContain('9:30');
  expect(formatearFechaHora(fecha, 'UTC')).toContain('15:30');
});
```

- [ ] **Paso 2: Ejecutar y verificar que fallan**

Run: `pnpm vitest run --project core`
Expected: FAIL (módulos `./texto`, `./estados`, etc. inexistentes).

- [ ] **Paso 3: Implementar los módulos con las firmas de Interfaces**

Mensajes fijos de `entrada.ts`: título vacío `Escribe un título`; redes repetidas `Cada red puede aparecer una sola vez.`; formato no admitido `` `${ETIQUETAS_RED[red]} no admite el formato ${ETIQUETAS_FORMATO[formato]}.` ``; URL vacía `Pega la URL de la publicación.`. Esquemas:
- `entradaPublicacionSchema`: `{ postId?: string(min 1); title: string.trim().min(1).max(200); assetId: string | null; base: { text: string.max(20000); hashtags: string[] (máx. 100) }; scheduledAt: z.iso.datetime() | null; parentId: string | null; destinos: { platform, format, youtube?: camposYoutubeSchema }[] }`. Los límites por red no van en el esquema: un borrador puede excederlos; los aplica `validarPublicacion` (Tarea 2).
- `accionPublicacionSchema`: `z.discriminatedUnion('accion', …)` con `guardar { publicacion }`, `eliminar { postId }`, `desvincular { postId }`, `programar { postId, inmediata: boolean }`, `mover { postId, scheduledAt: z.iso.datetime() }`, `cancelar { postId }`, `reintentar { postId, platform }`, `marcarPublicada { postId, platform, url: string.trim().min(1) }`, `marcarReferencia { postId, platform }`.

`problemasDeJerarquia` devuelve todos los mensajes que apliquen, en el orden de la prueba. `contenidoFinal`: texto efectivo `overrides.text ?? base.text`, hashtags `overrides.hashtags ?? base.hashtags`; en YouTube el cuerpo es `youtube.description` si no está vacía. Exportar todo desde `publicaciones/index.ts` y `export * from './publicaciones'` en `src/index.ts`.

- [ ] **Paso 4: Ejecutar y verificar que pasan**

Run: `pnpm vitest run --project core && pnpm --filter @omnistream/core typecheck`
Expected: PASS.

- [ ] **Paso 5: Commit**

```bash
git add packages/core
git commit -m "feat(core): dominio de publicaciones y destinos"
```

---

### Tarea 2: Reglas por red, validación, sugerencias y URLs públicas en `core`

**Archivos:**
- Crear: `packages/core/src/publicaciones/{reglas,validacion,sugerencias,urls}.ts`
- Prueba: `packages/core/src/publicaciones/{reglas,validacion,sugerencias,urls}.test.ts`

**Interfaces:**
- Consume: Tarea 1 (`Platform`, `FormatoDestino`, `Destino`, `Publicacion`, `contenidoFinal`, `contarCaracteres`, `textoReferencia`, `problemasDeJerarquia`); fase 1 (`Asset`, `describirProporcion`, `formatearDuracion`).
- Produce:
  ```ts
  type Proporcion = '16:9' | '9:16' | '1:1' | '4:5' | '1.91:1';
  interface ReglaFormato { etiqueta: string; tipoArchivo: 'video' | 'image'; duracionMinSec?: number; duracionMaxSec?: number;
    duracionMaxEsAdvertencia?: boolean; proporciones: Proporcion[]; rangoProporcion?: [number, number];
    limiteTexto?: number; limiteHashtags?: number }
  const REGLAS: Record<Platform, Partial<Record<FormatoDestino, ReglaFormato>>>;
  function reglaDe(platform: Platform, format: FormatoDestino): ReglaFormato; // lanza si la combinación no existe
  const LIMITES_YOUTUBE = { titulo: 100, descripcion: 5000, etiquetas: 500 };
  function largoEtiquetasYoutube(tags: readonly string[]): number;
  interface Problema { nivel: 'error' | 'advertencia'; red?: Platform; mensaje: string }
  interface ContextoValidacion {
    publicacion: Pick<Publicacion, 'title' | 'assetId' | 'base' | 'scheduledAt' | 'parentId'>;
    destinos: readonly Pick<Destino, 'platform' | 'format' | 'overrides' | 'youtube'>[];
    asset: Pick<Asset, 'kind' | 'status' | 'width' | 'height' | 'aspect' | 'durationSec'> | null;
    principal: Pick<Publicacion, 'id' | 'kind' | 'title'> | null;
    tipoActual?: TipoPublicacion; numeroDeHijas: number;
    ahora: Date; hora: 'programada' | 'inmediata' | 'sin_comprobar';
  }
  function validarPublicacion(contexto: ContextoValidacion): Problema[];
  function mensajeProblemas(problemas: readonly Problema[]): string; // primer error + " (y N más)"
  function sugerirDestinos(asset: Pick<Asset, 'kind' | 'aspect' | 'durationSec'>): Pick<Destino, 'platform' | 'format'>[];
  function analizarUrlPublica(platform: Platform, url: string): RemoteRef | null;
  ```

Tabla `REGLAS` (spec 7.4; etiqueta = "Red · Formato"):

| Red · formato | Etiqueta | Archivo | Duración | Proporciones | Texto / hashtags |
|---|---|---|---|---|---|
| youtube video_largo | YouTube · Video largo | video | — | 16:9 | — |
| youtube short | YouTube · Short | video | máx. 180 s como advertencia | 9:16, 1:1 | — |
| instagram reel | Instagram · Reel | video | 3 a 900 s | 9:16 | 2200 / 30 |
| instagram imagen | Instagram · Imagen | image | — | 4:5, 1:1, 1.91:1 (rango 0,8 a 1,91) | 2200 / 30 |
| facebook reel | Facebook · Reel | video | 3 a 90 s | 9:16 | — |
| facebook video_largo | Facebook · Video | video | — | libre | — |
| facebook imagen | Facebook · Imagen | image | — | libre | — |
| tiktok tiktok | TikTok · Video | video | — (2B usa el máximo de la cuenta) | 9:16 | 2200 |
| tiktok imagen | TikTok · Imagen | image | — | 9:16 | 2200 |

"Libre" es una lista de proporciones vacía: no genera advertencia. Una proporción coincide si la diferencia relativa es ≤ 2 % (la misma tolerancia que `describirProporcion`).

- [ ] **Paso 1: Escribir las pruebas que fallan**

`reglas.test.ts`:
```ts
import { expect, it } from 'vitest';
import { FORMATOS, FORMATOS_POR_RED, PLATAFORMAS } from './tipos';
import { largoEtiquetasYoutube, REGLAS } from './reglas';

it('hay regla exactamente para cada formato permitido', () => {
  for (const p of PLATAFORMAS) for (const f of FORMATOS) expect(REGLAS[p][f] !== undefined).toBe(FORMATOS_POR_RED[p].includes(f));
});
it('largoEtiquetasYoutube cuenta comas y comillas de las etiquetas con espacios', () => {
  expect(largoEtiquetasYoutube(['uno', 'dos palabras'])).toBe(3 + 14 + 1);
});
```

`validacion.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { CAMPOS_YOUTUBE_POR_DEFECTO } from './tipos';
import { mensajeProblemas, validarPublicacion, type ContextoValidacion } from './validacion';

const ahora = new Date('2026-10-07T12:00:00Z');
const manana = new Date('2026-10-08T12:00:00Z');
const vertical = { kind: 'video', status: 'listo', width: 1080, height: 1920, aspect: 0.5625, durationSec: 30 } as const;
const basePublicacion = { title: 'Mi corto', assetId: 'a1', base: { text: 'Hola', hashtags: [] as string[] }, scheduledAt: manana };
type Extra = Omit<Partial<ContextoValidacion>, 'publicacion'> & { publicacion?: Partial<ContextoValidacion['publicacion']> };
const d = (platform: string, format: string, extra = {}) => ({ platform, format, overrides: {}, ...extra }) as ContextoValidacion['destinos'][number];
const validar = (destinos: ContextoValidacion['destinos'], { publicacion, ...extra }: Extra = {}) =>
  validarPublicacion({ publicacion: { ...basePublicacion, ...publicacion }, destinos, asset: vertical, principal: null,
    numeroDeHijas: 0, ahora, hora: 'programada', ...extra });
const conAsset = (cambios: object): Extra => ({ asset: { ...vertical, ...cambios } });
const conTexto = (text: string, hashtags: string[] = []): Extra => ({ publicacion: { base: { text, hashtags } } });
const youtube = (campos = CAMPOS_YOUTUBE_POR_DEFECTO) => d('youtube', 'short', { youtube: campos });
const cuatro = [d('facebook', 'reel'), d('instagram', 'reel'), youtube(), d('tiktok', 'tiktok')];

it('una publicación válida a 4 redes no tiene problemas', () => {
  expect(validar(cuatro)).toEqual([]);
});

describe('archivo y redes', () => {
  it.each([
    [[], {}, 'Elige al menos una red.'],
    [cuatro, { publicacion: { assetId: undefined } }, 'Elige un archivo.'],
    [cuatro, { asset: null }, 'El archivo ya no está disponible.'],
    [cuatro, conAsset({ status: 'procesando' }), 'El archivo aún no está listo.'],
    [cuatro, conAsset({ status: 'purgado' }), 'El archivo ya no está disponible.'],
    [[d('facebook', 'reel')], conAsset({ kind: 'image' }), 'Facebook · Reel: necesita un video.'],
  ] as const)('%#', (destinos, extra, mensaje) => {
    expect(validar(destinos, extra as Extra)).toContainEqual(expect.objectContaining({ nivel: 'error', mensaje }));
  });
});

describe('duración y proporción', () => {
  it('Reel de Facebook de más de 90 s es error', () => {
    expect(validar([d('facebook', 'reel')], conAsset({ durationSec: 120 }))).toContainEqual({
      nivel: 'error', red: 'facebook', mensaje: 'Facebook · Reel: el video dura 2:00 y el máximo es 1:30.' });
  });
  it('Reel de Instagram de menos de 3 s es error', () => {
    expect(validar([d('instagram', 'reel')], conAsset({ durationSec: 2 }))).toContainEqual({
      nivel: 'error', red: 'instagram', mensaje: 'Instagram · Reel: el video debe durar al menos 0:03.' });
  });
  it('Short de más de 3 minutos es advertencia', () => {
    expect(validar([youtube()], conAsset({ durationSec: 200 }))).toContainEqual({
      nivel: 'advertencia', red: 'youtube', mensaje: 'YouTube · Short: el video dura más de 3 minutos y YouTube no lo clasificará como Short.' });
  });
  it('proporción no recomendada es advertencia', () => {
    expect(validar([d('tiktok', 'tiktok')], conAsset({ width: 1920, height: 1080, aspect: 1.7778 }))).toContainEqual({
      nivel: 'advertencia', red: 'tiktok', mensaje: 'TikTok · Video: la proporción 16:9 no es la recomendada (9:16).' });
  });
  it('imagen de Instagram fuera del rango 4:5 a 1.91:1', () => {
    expect(validar([d('instagram', 'imagen')], conAsset({ kind: 'image', durationSec: undefined }))).toContainEqual({
      nivel: 'advertencia', red: 'instagram', mensaje: 'Instagram · Imagen: la proporción 9:16 no es la recomendada (4:5, 1:1, 1.91:1).' });
  });
  it('resolución menor a 720p es advertencia general', () => {
    expect(validar(cuatro, conAsset({ width: 480, height: 854 }))).toContainEqual({ nivel: 'advertencia', mensaje: 'La resolución es menor a 720p.' });
  });
});

describe('textos', () => {
  it('texto de Instagram de más de 2200 caracteres', () => {
    expect(validar([d('instagram', 'reel')], conTexto('a'.repeat(2201)))).toContainEqual({
      nivel: 'error', red: 'instagram', mensaje: 'Instagram · Reel: el texto tiene 2201 caracteres y el máximo es 2200.' });
  });
  it('más de 30 hashtags en Instagram', () => {
    const hashtags = Array.from({ length: 31 }, (_, i) => `h${i}`);
    expect(validar([d('instagram', 'reel')], conTexto('Hola', hashtags))).toContainEqual({
      nivel: 'error', red: 'instagram', mensaje: 'Instagram · Reel: hay 31 hashtags y el máximo es 30.' });
  });
  it('TikTok cuenta la referencia al Principal', () => {
    const r = validar([d('tiktok', 'tiktok')], {
      publicacion: { parentId: 'p1', base: { text: 'a'.repeat(2150), hashtags: [] } },
      principal: { id: 'p1', kind: 'principal', title: 'Largo' },
    });
    expect(r).toContainEqual({ nivel: 'error', red: 'tiktok', mensaje: 'TikTok · Video: el texto tiene 2215 caracteres y el máximo es 2200.' });
  });
  it.each([
    [{ title: 'a'.repeat(101) }, 'YouTube: el título tiene 101 caracteres y el máximo es 100.'],
    [{ title: 'a < b' }, 'YouTube: el título y la descripción no pueden contener los signos < ni >.'],
  ])('YouTube %#', (publicacion, mensaje) => {
    expect(validar([youtube()], { publicacion })).toContainEqual({ nivel: 'error', red: 'youtube', mensaje });
  });
  it('descripción y etiquetas de YouTube', () => {
    const r = validar([youtube({ ...CAMPOS_YOUTUBE_POR_DEFECTO, description: 'a'.repeat(5001), tags: ['a'.repeat(501)] })]);
    expect(r).toContainEqual({ nivel: 'error', red: 'youtube', mensaje: 'YouTube: la descripción tiene 5001 caracteres y el máximo es 5000.' });
    expect(r).toContainEqual({ nivel: 'error', red: 'youtube', mensaje: 'YouTube: las etiquetas suman 501 caracteres y el máximo es 500.' });
  });
});

describe('hora y jerarquía', () => {
  const sinFecha: Extra = { publicacion: { scheduledAt: null } };
  const pasada: Extra = { publicacion: { scheduledAt: new Date('2026-10-07T11:00:00Z') } };
  it('programar exige fecha futura', () => {
    expect(validar(cuatro, sinFecha)).toContainEqual({ nivel: 'error', mensaje: 'Elige la fecha y la hora.' });
    expect(validar(cuatro, pasada)).toContainEqual({ nivel: 'error', mensaje: 'La hora programada ya pasó.' });
  });
  it('publicar ahora y la tarea no comprueban la hora', () => {
    expect(validar(cuatro, { ...sinFecha, hora: 'inmediata' })).toEqual([]);
    expect(validar(cuatro, { ...pasada, hora: 'sin_comprobar' })).toEqual([]);
  });
  it('incluye los problemas de jerarquía como errores', () => {
    expect(validar(cuatro, { publicacion: { parentId: 'p1' } })).toContainEqual({ nivel: 'error', mensaje: 'El video principal elegido ya no existe.' });
  });
});

it('mensajeProblemas resume los errores', () => {
  const e = (mensaje: string) => ({ nivel: 'error' as const, mensaje });
  expect(mensajeProblemas([e('Elige un archivo.')])).toBe('Elige un archivo.');
  expect(mensajeProblemas([e('A.'), { nivel: 'advertencia', mensaje: 'W.' }, e('B.'), e('C.')])).toBe('A. (y 2 más)');
});
```

`sugerencias.test.ts`:
```ts
import { expect, it } from 'vitest';
import { sugerirDestinos } from './sugerencias';

it.each([
  [{ kind: 'video', aspect: 0.5625, durationSec: 30 }, [['facebook', 'reel'], ['instagram', 'reel'], ['youtube', 'short'], ['tiktok', 'tiktok']]],
  [{ kind: 'video', aspect: 0.5625, durationSec: 120 }, [['instagram', 'reel'], ['youtube', 'short'], ['tiktok', 'tiktok']]],
  [{ kind: 'video', aspect: 0.5625, durationSec: 600 }, [['instagram', 'reel'], ['tiktok', 'tiktok']]],
  [{ kind: 'video', aspect: 1.7778, durationSec: 600 }, [['youtube', 'video_largo']]],
  [{ kind: 'image', aspect: 0.8 }, [['facebook', 'imagen'], ['instagram', 'imagen']]],
] as const)('%j', (asset, esperado) => {
  expect(sugerirDestinos(asset).map((x) => [x.platform, x.format])).toEqual(esperado);
});
```
Regla: imagen → Facebook e Instagram; video con `aspect > 1` → YouTube video largo; video con `aspect ≤ 1` → cada formato corto cuya duración máxima no se exceda (Short solo hasta 180 s), en el orden de `PLATAFORMAS`.

`urls.test.ts`:
```ts
import { expect, it } from 'vitest';
import { analizarUrlPublica } from './urls';

it.each([
  ['youtube', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
  ['youtube', ' https://YouTu.be/dQw4w9WgXcQ?si=x ', 'dQw4w9WgXcQ'],
  ['youtube', 'https://youtube.com/shorts/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
  ['youtube', 'https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=3', 'dQw4w9WgXcQ'],
  ['instagram', 'https://www.instagram.com/reel/C1a2B3c4D5e/', 'C1a2B3c4D5e'],
  ['instagram', 'https://www.instagram.com/p/C1a2B3c4D5e/?igsh=x', 'C1a2B3c4D5e'],
  ['instagram', 'https://www.instagram.com/cuenta/reel/C1a2B3c4D5e/', 'C1a2B3c4D5e'],
  ['facebook', 'https://www.facebook.com/mipagina/posts/pfbid0abc', 'pfbid0abc'],
  ['facebook', 'https://www.facebook.com/reel/123456789', '123456789'],
  ['facebook', 'https://www.facebook.com/watch/?v=123', '123'],
  ['facebook', 'https://www.facebook.com/photo/?fbid=456', '456'],
  ['facebook', 'https://www.facebook.com/mipagina/videos/789/', '789'],
  ['facebook', 'https://fb.watch/abcDEF/', 'abcDEF'],
  ['facebook', 'https://www.facebook.com/share/r/1AbC/', '1AbC'],
  ['tiktok', 'https://www.tiktok.com/@cuenta/video/7300000000000000001', '7300000000000000001'],
  ['tiktok', 'https://www.tiktok.com/@cuenta/photo/7300000000000000002', '7300000000000000002'],
  ['tiktok', 'https://vm.tiktok.com/ZMabc123/', 'ZMabc123'],
  ['tiktok', 'https://www.tiktok.com/t/ZTabc/', 'ZTabc'],
] as const)('%s %s', (red, url, id) => {
  expect(analizarUrlPublica(red, url)).toEqual({ id, url: url.trim() });
});

it.each([
  ['youtube', 'https://www.youtube.com/channel/UC123'],
  ['instagram', 'https://www.instagram.com/cuenta/'],
  ['facebook', 'https://www.facebook.com/mipagina'],
  ['tiktok', 'https://www.tiktok.com/@cuenta'],
  ['instagram', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
  ['tiktok', 'no es una url'],
] as const)('rechaza %s %s', (red, url) => {
  expect(analizarUrlPublica(red, url)).toBeNull();
});
```
Acepta `http` y `https`, ignora mayúsculas del dominio y los prefijos `www.` y `m.`.

- [ ] **Paso 2: Ejecutar y verificar que fallan**

Run: `pnpm vitest run --project core`
Expected: FAIL (módulos inexistentes).

- [ ] **Paso 3: Implementar `reglas.ts`, `validacion.ts`, `sugerencias.ts` y `urls.ts`**

`validarPublicacion` produce, en este orden: redes; archivo (`Elige un archivo.` si la publicación no tiene `assetId`; `El archivo ya no está disponible.` si tiene `assetId` pero el archivo no existe o está `fallido`/`purgado`; `El archivo aún no está listo.` para `subiendo`/`procesando`); por destino: tipo de archivo (`` `${etiqueta}: necesita un video.` `` o `una imagen.`), duración (`` `${etiqueta}: el video debe durar al menos ${formatearDuracion(min)}.` `` y `` `${etiqueta}: el video dura ${formatearDuracion(d)} y el máximo es ${formatearDuracion(max)}.` ``; para el Short, el mensaje de advertencia de la prueba), proporción (`` `${etiqueta}: la proporción ${describirProporcion(aspect)} no es la recomendada (${proporciones.join(', ')}).` ``), texto y hashtags sobre `contenidoFinal(...).texto` con `contarCaracteres` (`` `${etiqueta}: el texto tiene ${n} caracteres y el máximo es ${max}.` ``, `` `${etiqueta}: hay ${n} hashtags y el máximo es ${max}.` ``); YouTube: título, `<`/`>` en título o descripción, descripción y etiquetas (`largoEtiquetasYoutube`: suma de largos + 2 por cada etiqueta con espacio + comas entre etiquetas); una sola advertencia general de resolución si `min(width, height) < 720`; hora según `contexto.hora`; jerarquía con `problemasDeJerarquia` (nivel `error`, sin `red`). En TikTok, si hay `parentId`, el texto se mide con `textoReferencia(principal?.title ?? '', urlVideoYoutube('XXXXXXXXXXX'))` agregado, que es el peor caso de largo.

- [ ] **Paso 4: Ejecutar y verificar que pasan**

Run: `pnpm vitest run --project core && pnpm --filter @omnistream/core typecheck`
Expected: PASS.

- [ ] **Paso 5: Commit**

```bash
git add packages/core
git commit -m "feat(core): reglas por red, validación, sugerencias y URLs públicas"
```

---

### Tarea 3: Reglas de seguridad, índices y emulador de Cloud Tasks

**Archivos:**
- Modificar: `firestore.rules`, `firestore.indexes.json`, `firebase.json`, `pruebas/integracion/src/reglas.test.ts`
- Crear: `functions/src/publicacion/indices.test.ts`

**Interfaces:**
- Produce: lectura del propietario en `posts/{id}`, `posts/{id}/targets/{red}`, `.../attempts/{id}`, grupo de colecciones `targets`, `notifications/{id}` y `connections/{red}`; sin escritura desde el cliente. Índices de grupo de colecciones `targets`: (`status` ↑, `scheduledAt` ↑) y (`parentRef.status` ↑, `scheduledAt` ↑). Emulador de Cloud Tasks en el puerto 9499.

- [ ] **Paso 1: Escribir las pruebas que fallan**

En `reglas.test.ts` (bloque Firestore): cambiar la prueba "colecciones no declaradas están denegadas" para que lea `otra/x` en lugar de `posts/p1`, y agregar:
```ts
it('propietario lee publicaciones, destinos, intentos, avisos y conexiones', async () => {
  const db = propietario.firestore();
  for (const ruta of ['posts/p1', 'posts/p1/targets/tiktok', 'posts/p1/targets/tiktok/attempts/a1', 'notifications/n1', 'connections/youtube']) {
    await assertSucceeds(getDoc(doc(db, ruta)));
  }
});
it('propietario consulta el grupo de colecciones targets', async () => {
  await assertSucceeds(getDocs(query(collectionGroup(propietario.firestore(), 'targets'), where('status', '==', 'pendiente_manual'))));
});
it('nadie escribe publicaciones, destinos, avisos ni conexiones desde el cliente', async () => {
  const db = propietario.firestore();
  for (const ruta of ['posts/p1', 'posts/p1/targets/tiktok', 'notifications/n1', 'connections/youtube']) {
    await assertFails(setDoc(doc(db, ruta), { x: 1 }));
  }
});
it('usuario sin claim owner no lee publicaciones', async () => {
  await assertFails(getDoc(doc(extrano.firestore(), 'posts/p1')));
});
```

`functions/src/publicacion/indices.test.ts`:
```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';

const indices = JSON.parse(readFileSync(resolve(import.meta.dirname, '../../../firestore.indexes.json'), 'utf8'));

it.each([['status'], ['parentRef.status']])('declara el índice de targets por %s y scheduledAt', (campo) => {
  expect(indices.indexes).toContainEqual({
    collectionGroup: 'targets', queryScope: 'COLLECTION_GROUP',
    fields: [{ fieldPath: campo, order: 'ASCENDING' }, { fieldPath: 'scheduledAt', order: 'ASCENDING' }],
  });
});
```

- [ ] **Paso 2: Ejecutar y verificar que fallan**

Run: `pnpm vitest run --project functions` y `pnpm test:integracion`
Expected: FAIL en `indices.test.ts` y en las nuevas pruebas de reglas.

- [ ] **Paso 3: Implementar**

- `firestore.rules`: bloques `match /posts/{postId}` con `targets/{platform}` y `attempts/{attemptId}` anidados (`allow read: if esPropietario();`), `match /{ruta=**}/targets/{platform}` (lectura), `notifications/{id}` y `connections/{platform}` (lectura). Ninguna regla `write` nueva.
- `firestore.indexes.json`: los dos índices de la prueba, con `"fieldOverrides": []`.
- `firebase.json`: `"tasks": { "port": 9499 }` en `emulators`.

- [ ] **Paso 4: Ejecutar y verificar que pasan**

Run: `pnpm vitest run --project functions && pnpm test:integracion`
Expected: PASS.

- [ ] **Paso 5: Commit**

```bash
git add firestore.rules firestore.indexes.json firebase.json functions/src/publicacion/indices.test.ts pruebas/integracion/src/reglas.test.ts
git commit -m "feat: reglas e índices de publicaciones y emulador de Cloud Tasks"
```

---

### Tarea 4: Cola de publicación y `publicarDestino` (modo manual)

**Archivos:**
- Crear: `packages/core/src/publicaciones/cola.ts` (+ `cola.test.ts`), `functions/src/publicacion/{firestore,cola,publicarDestino}.ts`
- Crear: `pruebas/integracion/src/{admin,esperar,datos}.ts`, `pruebas/integracion/src/funciones/publicarDestino.test.ts`
- Modificar: `functions/src/index.ts`, `pruebas/integracion/package.json` (dependencias `@omnistream/core` y `@omnistream/functions`, `workspace:*`; export `"./admin": "./src/admin.ts"`)

**Interfaces:**
- Consume: Tarea 1 (`Destino`, `leerDestino`, `leerPublicacion`), Tarea 2 (`validarPublicacion`, `mensajeProblemas`).
- Produce (`core/publicaciones/cola.ts`):
  ```ts
  const VENTANA_COLA_MS = 29 * 24 * 60 * 60 * 1000;
  const LEASE_MS = 15 * 60 * 1000;
  const ANTICIPACION_MAX_MS = 60 * 1000;
  const MAX_INTENTOS_TAREA = 5;
  function idTarea(postId: string, platform: Platform, version: number, recuperacion?: number): string;
  type MotivoOmision = 'inexistente' | 'version' | 'estado' | 'anticipada' | 'ocupada';
  type DecisionToma = { tomar: true; continuar: boolean } | { tomar: false; motivo: MotivoOmision };
  function decidirToma(destino: Pick<Destino, 'status' | 'scheduleVersion' | 'scheduledAt' | 'lease'> | null, scheduleVersion: number, ahora: Date): DecisionToma;
  function necesitaEncolarse(destino: Pick<Destino, 'status' | 'scheduleVersion' | 'enqueuedVersion' | 'scheduledAt'>, ahora: Date): boolean;
  function estaAtascado(destino: Pick<Destino, 'status' | 'lease'>, ahora: Date): boolean;
  function modoDePublicacion(conexion: { authStatus?: string; publishMode?: ModoPublicacion } | null | undefined): ModoPublicacion;
  ```
- Produce (`functions/src/publicacion/firestore.ts`):
  ```ts
  const refPublicacion: (db: Firestore, postId: string) => DocumentReference;
  const refDestino: (db: Firestore, postId: string, red: Platform) => DocumentReference;
  interface PublicacionCompleta { publicacion: Publicacion; destinos: Destino[] }
  function leerPublicacionCompleta(db: Firestore, postId: string, tx?: Transaction): Promise<PublicacionCompleta | null>;
  interface ContextoPublicacion { asset: Asset | null; principal: Publicacion | null; numeroDeHijas: number }
  function leerContexto(db: Firestore, publicacion: Pick<Publicacion, 'id' | 'assetId' | 'parentId'>): Promise<ContextoPublicacion>;
  function leerModos(db: Firestore, redes: readonly Platform[]): Promise<Record<Platform, ModoPublicacion>>;
  ```
- Produce (`functions/src/publicacion/cola.ts`):
  ```ts
  interface TareaPublicacion { postId: string; platform: Platform; scheduleVersion: number }
  type Encolador = (tarea: TareaPublicacion, opciones: { id: string; scheduleTime?: Date }) => Promise<void>;
  function encoladorCloudTasks(): Encolador;
  function encolarDestino(db: Firestore, postId: string, destino: Pick<Destino, 'platform' | 'scheduleVersion' | 'scheduledAt' | 'attempts'>,
    encolar: Encolador, ahora: Date, recuperacion?: boolean): Promise<boolean>;
  ```
- Produce (`functions/src/publicacion/publicarDestino.ts`):
  ```ts
  type ResultadoTarea = 'pendiente_manual' | 'fallida' | MotivoOmision;
  function ejecutarTarea(db: Firestore, tarea: TareaPublicacion, contexto: { ahora: () => Date; ultimoIntento: boolean }): Promise<ResultadoTarea>;
  const publicarDestino: TaskQueueFunction<TareaPublicacion>;
  ```
- Produce (pruebas): `adminDemo(nombre: string): { app: App; db: Firestore; bucket: Bucket }` (Firestore con `ignoreUndefinedProperties`), `esperarHasta<T>(leer: () => Promise<T>, cumple: (v: T) => boolean, opciones?: { timeoutMs?: number }): Promise<T>` (por defecto 30 s, cada 250 ms; al vencer lanza con el último valor), `crearAssetListo(db: Firestore, cambios?: Partial<Asset>): Promise<string>` (video vertical 1080×1920, 30 s, `listo`, `storagePath: originales/{id}`), `sembrarPublicacion(db, { publicacion?: Partial<Publicacion>; destinos: Partial<Destino>[] }): Promise<string>` (completa con `destinoNuevo` y valores válidos), `leerDestinoDe(db: Firestore, postId: string, red: Platform): Promise<Destino>`.

- [ ] **Paso 1: Escribir las pruebas que fallan**

`cola.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { decidirToma, estaAtascado, idTarea, modoDePublicacion, necesitaEncolarse } from './cola';

const ahora = new Date('2026-10-07T12:00:00Z');
const en = (ms: number) => new Date(ahora.getTime() + ms);

describe('decidirToma', () => {
  const programada = { status: 'programada', scheduleVersion: 2, scheduledAt: ahora } as const;
  it.each([
    [null, 2, { tomar: false, motivo: 'inexistente' }],
    [programada, 1, { tomar: false, motivo: 'version' }],
    [{ ...programada, scheduledAt: en(61_000) }, 2, { tomar: false, motivo: 'anticipada' }],
    [{ ...programada, scheduledAt: en(30_000) }, 2, { tomar: true, continuar: false }],
    [programada, 2, { tomar: true, continuar: false }],
    [{ ...programada, status: 'publicando', lease: { attemptId: 'a', until: en(60_000) } }, 2, { tomar: false, motivo: 'ocupada' }],
    [{ ...programada, status: 'publicando', lease: { attemptId: 'a', until: en(-1) } }, 2, { tomar: true, continuar: true }],
    [{ ...programada, status: 'publicando' }, 2, { tomar: true, continuar: true }],
    [{ ...programada, status: 'publicada' }, 2, { tomar: false, motivo: 'estado' }],
  ] as const)('%#', (destino, version, esperado) => {
    expect(decidirToma(destino, version, ahora)).toEqual(esperado);
  });
});

it('idTarea', () => {
  expect(idTarea('abc', 'tiktok', 3)).toBe('abc-tiktok-v3');
  expect(idTarea('abc', 'tiktok', 3, 2)).toBe('abc-tiktok-v3-r2');
});

it('necesitaEncolarse: programada, sin tarea de su versión y dentro de 29 días', () => {
  const base = { status: 'programada', scheduleVersion: 1, scheduledAt: en(1000) } as const;
  expect(necesitaEncolarse(base, ahora)).toBe(true);
  expect(necesitaEncolarse({ ...base, enqueuedVersion: 1 }, ahora)).toBe(false);
  expect(necesitaEncolarse({ ...base, scheduledAt: en(30 * 86_400_000) }, ahora)).toBe(false);
  expect(necesitaEncolarse({ ...base, status: 'borrador' }, ahora)).toBe(false);
});

it('estaAtascado: publicando sin lease vigente', () => {
  expect(estaAtascado({ status: 'publicando', lease: { attemptId: 'a', until: en(-1) } }, ahora)).toBe(true);
  expect(estaAtascado({ status: 'publicando' }, ahora)).toBe(true);
  expect(estaAtascado({ status: 'publicando', lease: { attemptId: 'a', until: en(1000) } }, ahora)).toBe(false);
});

it('modoDePublicacion solo es api con la conexión conectada y en modo api', () => {
  expect(modoDePublicacion(undefined)).toBe('manual');
  expect(modoDePublicacion({ authStatus: 'expirada', publishMode: 'api' })).toBe('manual');
  expect(modoDePublicacion({ authStatus: 'conectada', publishMode: 'api' })).toBe('api');
});
```

`pruebas/integracion/src/funciones/publicarDestino.test.ts` (inicializa la app por defecto de administración con `projectId: 'demo-omnistream'`, `process.env.CLOUD_TASKS_EMULATOR_HOST ??= '127.0.0.1:9499'`, y usa `encoladorCloudTasks()` real desde el proceso de prueba):
```ts
it('una tarea vencida deja el destino manual en pendiente_manual y registra el intento', async () => {
  const assetId = await crearAssetListo(db);
  const postId = await sembrarPublicacion(db, { publicacion: { assetId }, destinos: [{ platform: 'tiktok', format: 'tiktok', status: 'programada', scheduleVersion: 1, scheduledAt: new Date() }] });
  await encolarDestino(db, postId, { platform: 'tiktok', scheduleVersion: 1, scheduledAt: new Date(), attempts: 0 }, encoladorCloudTasks(), new Date());
  const destino = await esperarHasta(() => leer(postId, 'tiktok'), (d) => d.status === 'pendiente_manual');
  expect(destino).toMatchObject({ attempts: 1, enqueuedVersion: 1 });
  expect(destino.lease).toBeUndefined();
  const intentos = await db.collection(`posts/${postId}/targets/tiktok/attempts`).get();
  expect(intentos.docs.map((d) => d.data())).toEqual([expect.objectContaining({ stage: 'manual', result: 'ok' })]);
});

it('una tarea de otra versión no hace nada', async () => {
  // destino programada con scheduleVersion 2; se encola { scheduleVersion: 1 } con id propio
  // espera 5 s: status sigue 'programada' y attempts 0
});

it('una tarea anticipada no hace nada', async () => {
  // destino programada con scheduledAt dentro de 1 hora; el emulador entrega de inmediato
  // espera 5 s: status sigue 'programada' y attempts 0
});

it('un archivo inexistente deja el destino fallida con error definitivo', async () => {
  // publicación con assetId de un documento que no existe; tras la tarea:
  // status 'fallida', lastError: { code: 'validacion', kind: 'definitivo', message: 'El archivo ya no está disponible.' }
});

it('el modo api sin conector deja el destino fallida', async () => {
  // destino con publishMode 'api'; tras la tarea: status 'fallida',
  // lastError.message 'La publicación por API de TikTok aún no está disponible.', lastError.code 'sin_conector'
});
```
En cada archivo de prueba, `leer = (postId, red) => leerDestinoDe(db, postId, red)`.

- [ ] **Paso 2: Ejecutar y verificar que fallan**

Run: `pnpm vitest run --project core` y `pnpm test:integracion`
Expected: FAIL (módulos inexistentes).

- [ ] **Paso 3: Implementar `cola.ts` en `core`**

`decidirToma` revisa en orden: inexistente, versión, estado `programada` (anticipada si `scheduledAt - ahora > ANTICIPACION_MAX_MS`), estado `publicando` (ocupada si el `lease` sigue vigente; si no, continuar), cualquier otro estado.

- [ ] **Paso 4: Implementar `firestore.ts`, `cola.ts` y `publicarDestino.ts` en `functions`**

- `encoladorCloudTasks()`: `getFunctions().taskQueue(\`locations/${REGION}/functions/publicarDestino\`).enqueue(tarea, { id, scheduleTime })`; el error `functions/task-already-exists` cuenta como éxito.
- `encolarDestino`: si `scheduledAt` está a más de `VENTANA_COLA_MS`, devuelve `false`. `scheduleTime` solo si `scheduledAt` es futuro. Id: `idTarea(postId, red, scheduleVersion, recuperacion ? attempts : undefined)`. Después, en una transacción, escribe `enqueuedVersion = scheduleVersion` solo si el destino conserva esa versión.
- `ejecutarTarea`:
  1. `attemptId = randomUUID()`. Transacción: lee el destino, aplica `decidirToma`; si no se toma, devuelve el motivo (registro `info`). Si se toma: `status: 'publicando'`, `lease: { attemptId, until: ahora + LEASE_MS }`, `attempts: increment(1)`, `statusChangedAt`.
  2. Lee la publicación y `leerContexto`; valida con `validarPublicacion({ ..., destinos: [destino], hora: 'sin_comprobar' })` y conserva los errores sin `red` o de esta red. Con errores: `fallida` con `lastError: { code: 'validacion', kind: 'definitivo', message: mensajeProblemas(errores), at }`.
  3. `publishMode === 'manual'`: `pendiente_manual`. `publishMode === 'api'`: `fallida` con `code: 'sin_conector'`, `kind: 'definitivo'`, mensaje `` `La publicación por API de ${ETIQUETAS_RED[red]} aún no está disponible.` `` (2B lo reemplaza por el conector).
  4. Cada cierre se escribe con `finalizar(db, ref, attemptId, datos)`: transacción que aplica `datos`, `statusChangedAt` y borra `lease` solo si `lease.attemptId` sigue siendo el propio. Cada intento agrega un documento en `attempts` (`{ at, stage, result, error? }`; `stage` = `validacion`, `manual`, `api` o `error`).
  5. Ante una excepción: si `ultimoIntento`, cierra `fallida` con `code: 'reintentos_agotados'`, `kind: 'temporal'`, mensaje `No se pudo publicar después de varios intentos.`; si no, borra el `lease` propio, registra el intento con `result: 'error'` y relanza para que Cloud Tasks reintente.
- `publicarDestino = onTaskDispatched({ region: REGION, retryConfig: { maxAttempts: MAX_INTENTOS_TAREA, minBackoffSeconds: 60, maxBackoffSeconds: 1800 }, rateLimits: { maxConcurrentDispatches: 4 }, timeoutSeconds: 3600, memory: '512MiB' }, …)` con `ultimoIntento: request.retryCount >= MAX_INTENTOS_TAREA - 1`.
- `index.ts`: después de `initializeApp()`, `getFirestore().settings({ ignoreUndefinedProperties: true })`; exportar `publicarDestino`.

- [ ] **Paso 5: Implementar los ayudantes de `pruebas/integracion` y ejecutar**

Run: `pnpm vitest run --project core && pnpm --filter @omnistream/functions typecheck && pnpm test:integracion`
Expected: PASS.

- [ ] **Paso 6: Commit**

```bash
git add packages/core functions pruebas/integracion pnpm-lock.yaml
git commit -m "feat(functions): cola de publicación y publicarDestino en modo manual"
```

---

### Tarea 5: Invocable `publicaciones`: guardar, programar, publicar ahora y mover

**Archivos:**
- Crear: `functions/src/publicacion/{autorizacion,publicaciones}.ts`, `functions/src/publicacion/acciones/{guardar,programar}.ts`
- Crear: `functions/src/publicacion/publicaciones.test.ts`, `pruebas/integracion/src/sesion.ts`, `pruebas/integracion/src/funciones/publicaciones.test.ts`
- Modificar: `functions/src/index.ts`

**Interfaces:**
- Consume: Tareas 1, 2 y 4 (`Encolador`, `encolarDestino`, `leerPublicacionCompleta`, `leerContexto`, `leerModos`).
- Produce:
  ```ts
  function exigirPropietario(auth: { token?: Record<string, unknown> } | undefined): void;
  //   sin auth → HttpsError('unauthenticated', 'Inicia sesión para continuar.')
  //   sin owner → HttpsError('permission-denied', 'Esta cuenta no tiene acceso a OmniStream.')
  type ManejadoresAccion = { [K in AccionPublicacion['accion']]?: (accion: Extract<AccionPublicacion, { accion: K }>) => Promise<RespuestaPublicaciones> };
  function despacharAccion(auth: { token?: Record<string, unknown> } | undefined, datos: unknown, manejadores: ManejadoresAccion): Promise<RespuestaPublicaciones>;
  const publicaciones: CallableFunction; // onCall({ region: REGION, memory: '512MiB', timeoutSeconds: 60 })
  interface DependenciasAccion { db: Firestore; ahora: Date; encolar: Encolador }
  function guardarPublicacion(entrada: EntradaPublicacion, deps: DependenciasAccion): Promise<RespuestaPublicaciones>;
  function programarPublicacion(postId: string, inmediata: boolean, deps: DependenciasAccion): Promise<RespuestaPublicaciones>;
  function moverPublicacion(postId: string, nuevaFecha: Date, deps: DependenciasAccion): Promise<RespuestaPublicaciones>;
  ```
- Produce (pruebas): `clientePropietario(): Promise<{ llamar(accion: AccionPublicacion): Promise<RespuestaPublicaciones>; cerrar(): Promise<void> }>` y `clienteAnonimo()` con la misma forma; en `datos.ts`, `entradaDePrueba(assetId: string, redes: [Platform, FormatoDestino][]): EntradaPublicacion` (título "Prueba", texto "Hola", sin fecha ni Principal; YouTube con `CAMPOS_YOUTUBE_POR_DEFECTO`). El propietario se crea con el SDK de administración (`propietario@omnistream.test`, contraseña fija, `emailVerified: true`; si ya existe, se reutiliza) y entra con `signInWithEmailAndPassword`; `antesDeIniciarSesion` le da el claim `owner`. Ambos usan `connectAuthEmulator` y `connectFunctionsEmulator('127.0.0.1', 5001)` con `getFunctions(app, 'us-central1')`.

- [ ] **Paso 1: Escribir las pruebas que fallan**

`functions/src/publicacion/publicaciones.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest';
import { despacharAccion } from './publicaciones';

const owner = { token: { owner: true } };

describe('despacharAccion', () => {
  it('sin sesión responde unauthenticated', async () => {
    await expect(despacharAccion(undefined, {}, {})).rejects.toMatchObject({ code: 'unauthenticated' });
  });
  it('sin claim owner responde permission-denied', async () => {
    await expect(despacharAccion({ token: {} }, {}, {})).rejects.toMatchObject({ code: 'permission-denied' });
  });
  it('datos inválidos responden invalid-argument con el mensaje del esquema', async () => {
    const datos = { accion: 'guardar', publicacion: { title: '', assetId: null, base: { text: '', hashtags: [] }, scheduledAt: null, parentId: null, destinos: [] } };
    await expect(despacharAccion(owner, datos, {})).rejects.toMatchObject({ code: 'invalid-argument', message: 'Escribe un título' });
  });
  it('despacha a la acción indicada', async () => {
    const cancelar = vi.fn().mockResolvedValue({ postId: 'p1' });
    await expect(despacharAccion(owner, { accion: 'cancelar', postId: 'p1' }, { cancelar })).resolves.toEqual({ postId: 'p1' });
    expect(cancelar).toHaveBeenCalledWith({ accion: 'cancelar', postId: 'p1' });
  });
  it('una acción sin manejador responde unimplemented', async () => {
    await expect(despacharAccion(owner, { accion: 'cancelar', postId: 'p1' }, {})).rejects.toMatchObject({ code: 'unimplemented' });
  });
});
```

`pruebas/integracion/src/funciones/publicaciones.test.ts` (entrada base: título "Prueba", texto "Hola", asset vertical listo creado con `crearAssetListo`):
```ts
it('rechaza llamadas sin sesión', async () => {
  await expect(anonimo.llamar({ accion: 'cancelar', postId: 'x' })).rejects.toMatchObject({ code: 'functions/unauthenticated' });
});

it('guardar crea la publicación y sus destinos en borrador', async () => {
  const { postId } = await propietario.llamar({ accion: 'guardar', publicacion: entrada([['facebook', 'reel'], ['tiktok', 'tiktok']]) });
  const post = (await db.doc(`posts/${postId}`).get()).data();
  expect(post).toMatchObject({ kind: 'independiente', status: 'borrador', title: 'Prueba', scheduledAt: null });
  const destinos = (await db.collection(`posts/${postId}/targets`).get()).docs.map((d) => d.data());
  expect(destinos).toHaveLength(2);
  expect(destinos[0]).toMatchObject({ status: 'borrador', scheduleVersion: 0, publishMode: 'manual', attempts: 0, parentRef: { status: 'no_aplica' } });
});

it('guardar rechaza una Hija cuyo principal no existe', async () => {
  await expect(propietario.llamar({ accion: 'guardar', publicacion: { ...entrada([['tiktok', 'tiktok']]), parentId: 'no-existe' } }))
    .rejects.toMatchObject({ code: 'functions/failed-precondition', message: 'El video principal elegido ya no existe.' });
});

it('programar sin fecha falla con el error de validación', async () => {
  const { postId } = await propietario.llamar({ accion: 'guardar', publicacion: entrada([['tiktok', 'tiktok']]) });
  await expect(propietario.llamar({ accion: 'programar', postId, inmediata: false }))
    .rejects.toMatchObject({ code: 'functions/failed-precondition', message: 'Elige la fecha y la hora.' });
});

it('publicar ahora a 4 redes deja los 4 destinos en pendiente_manual', async () => {
  const { postId } = await propietario.llamar({ accion: 'guardar', publicacion: entrada(CUATRO) });
  await propietario.llamar({ accion: 'programar', postId, inmediata: true });
  for (const red of ['facebook', 'instagram', 'youtube', 'tiktok']) {
    await esperarHasta(() => leer(postId, red), (d) => d.status === 'pendiente_manual');
  }
});

it('mover una publicación programada no la duplica', async () => {
  const enUnaHora = new Date(Date.now() + 3_600_000).toISOString();
  const { postId } = await propietario.llamar({ accion: 'guardar', publicacion: { ...entrada([['tiktok', 'tiktok']]), scheduledAt: enUnaHora } });
  await propietario.llamar({ accion: 'programar', postId, inmediata: false });
  await new Promise((r) => setTimeout(r, 3_000)); // la tarea v1 llega de inmediato en el emulador y termina como anticipada
  await propietario.llamar({ accion: 'mover', postId, scheduledAt: new Date(Date.now() + 5_000).toISOString() });
  const destino = await esperarHasta(() => leer(postId, 'tiktok'), (d) => d.status === 'pendiente_manual');
  expect(destino).toMatchObject({ scheduleVersion: 2, attempts: 1 });
  expect((await db.collection(`posts/${postId}/targets`).get()).size).toBe(1);
  expect((await db.collection(`posts/${postId}/targets/tiktok/attempts`).get()).size).toBe(1);
});

it('mover al pasado se rechaza', async () => {
  // publicación programada; mover a hace 1 minuto → failed-precondition 'No se puede mover al pasado.'
});

it('guardar una publicación programada la vuelve a programar', async () => {
  // programada para dentro de 1 hora (scheduleVersion 1); guardar con otro texto y la misma fecha
  // → el destino queda programada con scheduleVersion 2 y enqueuedVersion 2
});
```
`CUATRO` es `[['facebook', 'reel'], ['instagram', 'reel'], ['youtube', 'short'], ['tiktok', 'tiktok']]`. En cada archivo de prueba, `entrada = (redes, assetId = assetVertical) => entradaDePrueba(assetId, redes)`, con `assetVertical` creado en `beforeAll` con `crearAssetListo`.

- [ ] **Paso 2: Ejecutar y verificar que fallan**

Run: `pnpm vitest run --project functions` y `pnpm test:integracion`
Expected: FAIL.

- [ ] **Paso 3: Implementar `autorizacion.ts` y `publicaciones.ts`**

`despacharAccion`: `exigirPropietario`; `accionPublicacionSchema.safeParse`; si falla, `HttpsError('invalid-argument', issues[0].message)`; si no hay manejador, `HttpsError('unimplemented', 'Acción no disponible.')`. `publicaciones = onCall(opciones, (req) => despacharAccion(req.auth, req.data, manejadores(deps)))` con `deps = { db: getFirestore(), ahora: new Date(), encolar: encoladorCloudTasks() }` por llamada.

- [ ] **Paso 4: Implementar `guardarPublicacion`**

1. Si trae `postId`: lee la publicación completa (`not-found`: `La publicación no existe.`); si no `esEditable`: `failed-precondition` `Esta publicación ya no se puede editar.`.
2. Lee el principal (si hay `parentId`) y el número de Hijas (`count()` de `posts` con `parentId == postId`). `problemasDeJerarquia` → `failed-precondition` con los mensajes unidos por espacio.
3. Transacción: escribe la publicación (`kind = tipoDePublicacion`, hashtags con `normalizarHashtags`, `scheduledAt` como `Date` o `null`, `updatedAt`; al crear: `status: 'borrador'`, `targetStatus: {}`, `createdAt`), crea con `destinoNuevo` los destinos nuevos, actualiza `format`, `youtube` y `parentRef` (`en_espera` al volverse Hija, `no_aplica` al dejar de serlo) de los existentes y borra los que ya no están.
4. Después: `recursiveDelete` de los destinos quitados (arrastra sus `attempts`). Si antes había algún destino `programada`, llama a `programarPublicacion(postId, false, deps)`.

- [ ] **Paso 5: Implementar `programarPublicacion` y `moverPublicacion`**

`programarPublicacion`: exige `esEditable` (`Esta publicación ya no se puede programar.`); valida con `hora: inmediata ? 'inmediata' : 'programada'` y responde `failed-precondition` con `mensajeProblemas`; `leerModos`; en una transacción, cada destino pasa a `programada` con `scheduleVersion + 1`, `publishMode`, `scheduledAt` (ahora si es inmediata, si no `publicacion.scheduledAt`), `statusChangedAt`, y borra `lease`, `checkpoint` y `lastError`; si es inmediata, también `post.scheduledAt = ahora`. Después encola cada destino con `encolarDestino`; un fallo al encolar se registra y no se propaga (lo recupera `encolarPendientes` en la Tarea 8).

`moverPublicacion`: `nuevaFecha <= ahora` → `No se puede mover al pasado.`; `!esEditable` → `Esta publicación ya no se puede mover.`. Transacción: `post.scheduledAt = nuevaFecha`; cada destino sin `overrides.scheduledAt` toma la nueva fecha y, si está `programada`, `scheduleVersion + 1` y `statusChangedAt`. Después encola los programados.

Registrar `guardar`, `programar` y `mover` en los manejadores y exportar `publicaciones` en `index.ts`.

- [ ] **Paso 6: Ejecutar y verificar que pasan**

Run: `pnpm vitest run --project functions && pnpm --filter @omnistream/functions typecheck && pnpm test:integracion`
Expected: PASS.

- [ ] **Paso 7: Commit**

```bash
git add functions pruebas/integracion
git commit -m "feat(functions): invocable publicaciones para guardar, programar y mover"
```

---

### Tarea 6: Acciones de cierre: cancelar, reintentar, eliminar, desvincular y marcar publicada

**Archivos:**
- Crear: `functions/src/publicacion/acciones/cierre.ts`, `pruebas/integracion/src/funciones/cierre.test.ts`
- Modificar: `functions/src/publicacion/acciones/programar.ts` (+ `reintentarDestino`), `functions/src/publicacion/publicaciones.ts`

**Interfaces:**
- Consume: Tareas 1, 2, 4 y 5.
- Produce (todas devuelven `Promise<RespuestaPublicaciones>` y reciben `deps: DependenciasAccion`):
  `cancelarPublicacion(postId, deps)`, `reintentarDestino(postId, red, deps)`, `eliminarPublicacion(postId, deps)`, `desvincularHija(postId, deps)`, `marcarPublicada(postId, red, url, deps)`, `marcarReferencia(postId, red, deps)`.

- [ ] **Paso 1: Escribir las pruebas que fallan**

`cierre.test.ts`:
```ts
it('cancelar deja los destinos cancelados', async () => {
  // publicación programada a 1 hora con 2 redes → cancelar → ambos destinos 'cancelada'
});
it('cancelar sin destinos cancelables se rechaza', async () => {
  // borrador sin destinos → failed-precondition 'No hay destinos que cancelar.'
});
it('reintentar vuelve a programar un destino fallido', async () => {
  await db.doc('connections/facebook').set({ authStatus: 'conectada', publishMode: 'api' });
  const { postId } = await propietario.llamar({ accion: 'guardar', publicacion: entrada([['facebook', 'reel']]) });
  await propietario.llamar({ accion: 'programar', postId, inmediata: true });
  await esperarHasta(() => leer(postId, 'facebook'), (d) => d.status === 'fallida');
  await db.doc('connections/facebook').delete();
  await propietario.llamar({ accion: 'reintentar', postId, platform: 'facebook' });
  expect(await esperarHasta(() => leer(postId, 'facebook'), (d) => d.status === 'pendiente_manual')).toMatchObject({ scheduleVersion: 2 });
});
it('reintentar un destino que no falló se rechaza', async () => {
  // → failed-precondition 'Solo se puede reintentar un destino fallido.'
});
it('marcar publicada con una URL válida guarda remote', async () => {
  // publicar ahora a TikTok → pendiente_manual → marcarPublicada con https://www.tiktok.com/@cuenta/video/7300000000000000001
  // → status 'publicada', remote: { id: '7300000000000000001', url, publishedAt: Timestamp }
});
it('marcar publicada rechaza una URL de otra red', async () => {
  // Instagram pendiente_manual + URL de YouTube → invalid-argument 'La URL no corresponde a una publicación de Instagram.'
});
it('marcar publicada exige pendiente_manual', async () => {
  // destino en borrador → failed-precondition 'Este destino no está pendiente de publicación manual.'
});
it('eliminar un principal con Hijas está prohibido hasta desvincularlas', async () => {
  // principal (youtube video_largo, asset horizontal) + hija (tiktok, parentId) → eliminar principal:
  // failed-precondition 'Esta publicación tiene Hijas. Desvincúlalas antes de eliminarla.'
  // desvincular la hija → kind 'independiente', sin parentId, parentRef 'no_aplica'
  // eliminar principal → el documento y sus targets ya no existen
});
it('eliminar una publicación publicada está prohibido', async () => {
  // → failed-precondition 'No se puede eliminar una publicación publicada o en curso.'
});
```

- [ ] **Paso 2: Ejecutar y verificar que fallan**

Run: `pnpm test:integracion`
Expected: FAIL (`unimplemented`).

- [ ] **Paso 3: Implementar `cierre.ts` y `reintentarDestino`**

- `cancelarPublicacion`: destinos en `ESTADOS_CANCELABLES` → `cancelada` con `statusChangedAt`; ninguno → `No hay destinos que cancelar.`.
- `reintentarDestino`: exige `fallida`; valida con `hora: 'sin_comprobar'` y los errores de esa red; modo con `leerModos`; transacción: `programada`, `scheduleVersion + 1`, `scheduledAt: ahora`, `publishMode`, `statusChangedAt`, sin `lastError` ni `lease` (conserva `checkpoint`); después encola.
- `eliminarPublicacion`: inexistente → `not-found`; `!sePuedeEliminar` → mensaje de la prueba; principal con Hijas → mensaje de la prueba; `db.recursiveDelete(refPublicacion)`. Las tareas pendientes terminan como `inexistente`.
- `desvincularHija`: si no es Hija, `Esta publicación no pertenece a un video principal.`; `kind: 'independiente'`, borra `parentId`, `updatedAt`; destinos con `parentRef` `en_espera` o `pendiente` → `no_aplica`. Se permite en cualquier estado.
- `marcarPublicada`: exige `pendiente_manual`; `analizarUrlPublica` → `invalid-argument` con `` `La URL no corresponde a una publicación de ${ETIQUETAS_RED[red]}.` ``; escribe `status: 'publicada'`, `statusChangedAt`, `remote: { id, url, publishedAt: ahora }` y, en TikTok con `parentRef` distinto de `no_aplica`, `parentRef.status: 'publicada'` (la referencia va en la descripción).
- `marcarReferencia`: exige `parentRef.status === 'pendiente'` (`La referencia no está pendiente.`) → `publicada`.

Registrar las seis acciones en los manejadores.

- [ ] **Paso 4: Ejecutar y verificar que pasan**

Run: `pnpm --filter @omnistream/functions typecheck && pnpm test:integracion`
Expected: PASS.

- [ ] **Paso 5: Commit**

```bash
git add functions pruebas/integracion
git commit -m "feat(functions): cancelar, reintentar, eliminar, desvincular y marcar publicada"
```

---

### Tarea 7: `alCambiarDestino`, avisos push y referencias al Padre

**Archivos:**
- Crear: `packages/core/src/publicaciones/avisos.ts` (+ `avisos.test.ts`), `functions/src/publicacion/{notificaciones,alCambiarDestino}.ts`
- Crear: `pruebas/integracion/src/funciones/{notificaciones,alCambiarDestino}.test.ts`
- Modificar: `functions/src/index.ts`

**Interfaces:**
- Consume: Tareas 1 a 6.
- Produce:
  ```ts
  // core
  type TipoAviso = 'pendiente_manual' | 'fallo' | 'referencia';
  interface Aviso { tipo: TipoAviso; titulo: string; cuerpo: string; enlace: string }
  function avisoDe(tipo: TipoAviso, datos: { postId: string; titulo: string; platform: Platform; error?: string }): Aviso;
  // functions
  type Notificador = (id: string, aviso: Aviso) => Promise<void>;
  type EnviarPush = (tokens: string[], aviso: Aviso) => Promise<{ enviados: number; invalidos: string[] }>;
  function crearNotificador(db: Firestore, enviarPush: EnviarPush): Notificador;
  function enviarPushFcm(): EnviarPush;
  function reaccionarACambio(db: Firestore, cambio: { postId: string; platform: Platform; antes: Destino | null; despues: Destino | null; idEvento: string }, notificar: Notificador): Promise<void>;
  const alCambiarDestino: CloudFunction<...>; // onDocumentWritten({ document: 'posts/{postId}/targets/{platform}', region: REGION })
  ```

- [ ] **Paso 1: Escribir las pruebas que fallan**

`avisos.test.ts`:
```ts
import { expect, it } from 'vitest';
import { avisoDe } from './avisos';

it.each([
  ['pendiente_manual', { titulo: 'Publicación pendiente', cuerpo: 'Mi corto · TikTok', enlace: '/pendientes/p1/tiktok' }],
  ['fallo', { titulo: 'Falló una publicación', cuerpo: 'Mi corto · TikTok: Sin conector.', enlace: '/publicaciones/p1' }],
  ['referencia', { titulo: 'Referencia al video principal pendiente', cuerpo: 'Mi corto · TikTok', enlace: '/pendientes' }],
] as const)('%s', (tipo, esperado) => {
  expect(avisoDe(tipo, { postId: 'p1', titulo: 'Mi corto', platform: 'tiktok', error: 'Sin conector.' })).toEqual({ tipo, ...esperado });
});
```

`notificaciones.test.ts` (importa `crearNotificador` de `@omnistream/functions/src/publicacion/notificaciones` y usa Firestore del emulador):
```ts
it('un mismo id envía el push una sola vez', async () => {
  await db.doc('settings/app').set({ fcmTokens: ['t1'] }, { merge: true });
  const enviar = vi.fn().mockResolvedValue({ enviados: 1, invalidos: [] });
  const notificar = crearNotificador(db, enviar);
  const id = `evento-${randomUUID()}`;
  await notificar(id, aviso);
  await notificar(id, aviso);
  expect(enviar).toHaveBeenCalledTimes(1);
  expect((await db.doc(`notifications/${id}`).get()).data()).toMatchObject({ ...aviso, push: { enviados: 1, fallidos: 0 } });
});
it('quita los tokens inválidos', async () => {
  // fcmTokens ['t1', 't2']; enviar responde { enviados: 1, invalidos: ['t2'] } → settings/app.fcmTokens = ['t1']
});
it('sin tokens registra el aviso y no envía', async () => {
  // fcmTokens [] → enviar no se llama; el documento existe con push { enviados: 0, fallidos: 0 }
});
```

`alCambiarDestino.test.ts` (por la invocable y el disparador del emulador):
```ts
it('un destino que llega a pendiente_manual genera su aviso y actualiza la publicación', async () => {
  // publicar ahora a TikTok → notifications con enlace `/pendientes/${postId}/tiktok` y tipo 'pendiente_manual' (exactamente 1)
  // posts/{postId}: status 'programada', targetStatus { tiktok: 'pendiente_manual' }
});
it('un destino fallido genera aviso de fallo', async () => {
  // conexión api sin conector → notifications tipo 'fallo' con enlace `/publicaciones/${postId}`
});
it('publicada en las 4 redes deja la publicación publicada', async () => {
  // publicar ahora a 4 redes y marcar las 4 → posts/{postId}.status 'publicada'
});
it('una Hija publicada antes que su Principal recibe su referencia al publicarse este', async () => {
  const largo = await crearAssetListo(db, { width: 1920, height: 1080, aspect: 1.7778, durationSec: 600 });
  const { postId: principal } = await propietario.llamar({ accion: 'guardar', publicacion: { ...entrada([['youtube', 'video_largo']], largo), title: 'Largo' } });
  await propietario.llamar({ accion: 'programar', postId: principal, inmediata: true });
  const tituloHija = `Hija ${randomUUID()}`;
  const { postId: hija } = await propietario.llamar({ accion: 'guardar', publicacion: { ...entrada([['instagram', 'reel'], ['tiktok', 'tiktok']]), parentId: principal, title: tituloHija } });
  await propietario.llamar({ accion: 'programar', postId: hija, inmediata: true });
  for (const red of ['instagram', 'tiktok'] as const) await esperarHasta(() => leer(hija, red), (d) => d.status === 'pendiente_manual');
  await propietario.llamar({ accion: 'marcarPublicada', postId: hija, platform: 'instagram', url: 'https://www.instagram.com/reel/C1a2B3c4D5e/' });
  await propietario.llamar({ accion: 'marcarPublicada', postId: hija, platform: 'tiktok', url: 'https://www.tiktok.com/@cuenta/video/7300000000000000001' });
  await new Promise((r) => setTimeout(r, 2_000));
  expect((await leer(hija, 'instagram')).parentRef.status).toBe('en_espera');
  expect((await leer(hija, 'tiktok')).parentRef.status).toBe('publicada');
  await esperarHasta(() => leer(principal, 'youtube'), (d) => d.status === 'pendiente_manual');
  await propietario.llamar({ accion: 'marcarPublicada', postId: principal, platform: 'youtube', url: 'https://youtu.be/dQw4w9WgXcQ' });
  await esperarHasta(() => leer(hija, 'instagram'), (d) => d.parentRef.status === 'pendiente');
  const avisos = await db.collection('notifications').where('tipo', '==', 'referencia').where('cuerpo', '==', `${tituloHija} · Instagram`).get();
  expect(avisos.size).toBe(1);
  await propietario.llamar({ accion: 'marcarReferencia', postId: hija, platform: 'instagram' });
  expect((await leer(hija, 'instagram')).parentRef.status).toBe('publicada');
});
it('una Hija publicada después de su Principal queda con la referencia pendiente', async () => {
  // principal ya publicado (marcado) → hija Instagram marcada publicada → parentRef 'pendiente' y un aviso 'referencia'
});
```
Cada prueba usa títulos únicos cuando consulta `notifications`, que se comparte entre archivos.

- [ ] **Paso 2: Ejecutar y verificar que fallan**

Run: `pnpm vitest run --project core` y `pnpm test:integracion`
Expected: FAIL.

- [ ] **Paso 3: Implementar `avisos.ts`, `notificaciones.ts` y `alCambiarDestino.ts`**

- `crearNotificador`: `create()` de `notifications/{id}` con `{ ...aviso, createdAt, push: { enviados: 0, fallidos: 0 } }`; si ya existe (código gRPC 6), termina sin enviar. Lee `settings/app.fcmTokens`; sin tokens, termina. Con tokens: `enviarPush`, actualiza `push` (`fallidos = tokens.length - enviados`) y quita los inválidos con `arrayRemove`. Un error al enviar se registra con `logger.warn` y deja `fallidos = tokens.length`.
- `enviarPushFcm`: `getMessaging().sendEachForMulticast({ tokens, data: { titulo, cuerpo, enlace } })` (mensaje solo de datos: el service worker de la Tarea 15 lo muestra); son inválidos los tokens con `messaging/registration-token-not-registered` o `messaging/invalid-registration-token`.
- `reaccionarACambio`:
  1. Si la publicación no existe, termina. Recalcula `estadoPublicacion` y `targetStatus` con todos sus destinos; escribe solo si cambiaron.
  2. Si `antes?.status !== despues?.status`: `pendiente_manual` → aviso con id `idEvento`; `fallida` → aviso de fallo con `lastError.message`; `publicada` → referencias:
     - Hija, red distinta de TikTok, `parentRef` `en_espera`: si el destino YouTube del Principal tiene `remote`, pasa a `pendiente` y avisa (`${idEvento}-ref`).
     - Principal y red YouTube: para cada Hija (`posts` con `parentId`), cada destino `publicada`, distinto de TikTok, con `parentRef` `en_espera` pasa a `pendiente` y avisa (`${idEvento}-${hijaId}-${red}`).
- `alCambiarDestino`: convierte `event.data.before/after` con `leerDestino` y llama a `reaccionarACambio(getFirestore(), …, crearNotificador(getFirestore(), enviarPushFcm()))` con `idEvento = event.id`.

- [ ] **Paso 4: Ejecutar y verificar que pasan**

Run: `pnpm vitest run --project core && pnpm --filter @omnistream/functions typecheck && pnpm test:integracion`
Expected: PASS.

- [ ] **Paso 5: Commit**

```bash
git add packages/core functions pruebas/integracion
git commit -m "feat(functions): alCambiarDestino con avisos push y referencias al Padre"
```

---

### Tarea 8: `encolarPendientes`: ventana de 29 días y recuperación

**Archivos:**
- Crear: `functions/src/publicacion/encolarPendientes.ts`, `pruebas/integracion/src/funciones/encolarPendientes.test.ts`
- Modificar: `functions/src/index.ts`

**Interfaces:**
- Consume: Tarea 4 (`necesitaEncolarse`, `estaAtascado`, `encolarDestino`, `Encolador`).
- Produce: `encolarPendientesAhora(deps: { db: Firestore; encolar: Encolador; ahora: Date }): Promise<{ encolados: number; recuperados: number }>` y `encolarPendientes = onSchedule({ schedule: 'every 60 minutes', timeZone: 'UTC', region: REGION }, …)`.

- [ ] **Paso 1: Escribir la prueba que falla**

```ts
it('encola lo que entra en la ventana y recupera lo atascado', async () => {
  const ahora = new Date();
  const dias = (n: number) => new Date(ahora.getTime() + n * 86_400_000);
  const ids = {
    enVentana: await sembrarPublicacion(db, { destinos: [{ platform: 'tiktok', format: 'tiktok', status: 'programada', scheduleVersion: 1, scheduledAt: dias(10) }] }),
    lejana: await sembrarPublicacion(db, { destinos: [{ platform: 'tiktok', format: 'tiktok', status: 'programada', scheduleVersion: 1, scheduledAt: dias(40) }] }),
    yaEncolada: await sembrarPublicacion(db, { destinos: [{ platform: 'tiktok', format: 'tiktok', status: 'programada', scheduleVersion: 1, enqueuedVersion: 1, scheduledAt: dias(1) }] }),
    atascada: await sembrarPublicacion(db, { destinos: [{ platform: 'tiktok', format: 'tiktok', status: 'publicando', scheduleVersion: 3, attempts: 2, scheduledAt: dias(-1), lease: { attemptId: 'x', until: dias(-0.01) } }] }),
    enCurso: await sembrarPublicacion(db, { destinos: [{ platform: 'tiktok', format: 'tiktok', status: 'publicando', scheduleVersion: 1, scheduledAt: dias(-1), lease: { attemptId: 'y', until: dias(0.01) } }] }),
  };
  const llamadas: string[] = [];
  await encolarPendientesAhora({ db, ahora, encolar: async (_t, { id }) => void llamadas.push(id) });
  const propias = llamadas.filter((id) => Object.values(ids).some((p) => id.startsWith(p)));
  expect(propias.sort()).toEqual([`${ids.atascada}-tiktok-v3-r2`, `${ids.enVentana}-tiktok-v1`].sort());
  expect((await leer(ids.enVentana, 'tiktok')).enqueuedVersion).toBe(1);
});
```

- [ ] **Paso 2: Ejecutar y verificar que falla**

Run: `pnpm test:integracion`
Expected: FAIL (módulo inexistente).

- [ ] **Paso 3: Implementar**

Dos consultas al grupo `targets`: `status == 'programada'` con `scheduledAt <= ahora + VENTANA_COLA_MS`, ordenada por `scheduledAt`, filtrada con `necesitaEncolarse`; y `status == 'publicando'` ordenada por `scheduledAt`, filtrada con `estaAtascado` y encolada con `recuperacion: true`. El `postId` sale de `doc.ref.parent.parent!.id`. Un error al encolar un destino se registra y no detiene los demás.

- [ ] **Paso 4: Ejecutar y verificar que pasa**

Run: `pnpm --filter @omnistream/functions typecheck && pnpm test:integracion`
Expected: PASS.

- [ ] **Paso 5: Commit**

```bash
git add functions pruebas/integracion
git commit -m "feat(functions): encolarPendientes con ventana de 29 días y recuperación"
```

---

### Tarea 9: Retención: `limpiarRetencion` y purga en la Biblioteca

**Archivos:**
- Crear: `packages/core/src/archivos/retencion.ts` (+ `retencion.test.ts`), `functions/src/publicacion/limpiarRetencion.ts`, `pruebas/integracion/src/funciones/limpiarRetencion.test.ts`
- Modificar: `packages/core/src/archivos/{asset.ts,index.ts}` (`retainUntil?: Date`), `functions/src/index.ts`
- Modificar: `apps/web/src/lib/archivos/repositorio.ts`, `apps/web/src/components/biblioteca/DetalleArchivo.tsx` (+ prueba), `apps/web/src/app/(app)/biblioteca/page.tsx`

**Interfaces:**
- Produce (`core`):
  ```ts
  const DIAS_SIN_USO = 30; const DIAS_FALLIDA_TERMINAL = 30;
  interface UsoDeArchivo { status: EstadoDestino; statusChangedAt: Date }
  function calcularPurga(entrada: { createdAt: Date; usos: readonly UsoDeArchivo[]; retentionDays: number; retainUntil?: Date; ahora: Date }): Date | null;
  function fechaDePurgaVisible(asset: Pick<Asset, 'purgeAt' | 'retainUntil'>): Date | undefined; // la mayor de las dos
  ```
- Produce (`functions`): `limpiarRetencionAhora(deps: { db: Firestore; bucket: Bucket; ahora: Date }): Promise<{ purgados: string[] }>` y `limpiarRetencion = onSchedule({ schedule: 'every day 04:00', timeZone: 'UTC', region: REGION, memory: '512MiB', timeoutSeconds: 540 }, …)`.
- Produce (web): `posponerPurga(asset: Asset, ahora?: Date): Promise<void>` (escribe `retainUntil = max(fechaDePurgaVisible(asset), ahora) + 7 días`), `class ArchivoEnUso extends Error { usos: number }`; `eliminarArchivo` cuenta `posts` con `assetId == asset.id` y lanza `ArchivoEnUso` si hay alguna.

- [ ] **Paso 1: Escribir las pruebas que fallan**

`retencion.test.ts`:
```ts
import { expect, it } from 'vitest';
import { calcularPurga } from './retencion';

const ahora = new Date('2026-10-07T12:00:00Z');
const hace = (dias: number) => new Date(ahora.getTime() - dias * 86_400_000);
const base = { createdAt: hace(40), retentionDays: 7, ahora };

it('sin usos se purga a los 30 días de creado', () => {
  expect(calcularPurga({ ...base, usos: [] })).toEqual(hace(10));
});
it('con un uso no terminal no se purga', () => {
  expect(calcularPurga({ ...base, usos: [{ status: 'publicada', statusChangedAt: hace(9) }, { status: 'programada', statusChangedAt: hace(9) }] })).toBeNull();
});
it('todos terminales: el último más los días de retención', () => {
  expect(calcularPurga({ ...base, usos: [{ status: 'publicada', statusChangedAt: hace(9) }, { status: 'cancelada', statusChangedAt: hace(8) }] })).toEqual(hace(1));
});
it('un fallido cuenta como terminal a los 30 días', () => {
  expect(calcularPurga({ ...base, usos: [{ status: 'fallida', statusChangedAt: hace(10) }] })).toBeNull();
  expect(calcularPurga({ ...base, usos: [{ status: 'fallida', statusChangedAt: hace(35) }] })).toEqual(hace(-2));
});
it('posponer gana si es posterior', () => {
  expect(calcularPurga({ ...base, usos: [], retainUntil: hace(-5) })).toEqual(hace(-5));
});
```
(El fallido de hace 35 días es terminal desde hace 5; más 7 de retención: dentro de 2 días.)

`limpiarRetencion.test.ts` (sube bytes a `originales/{id}`, `fotogramas/{id}/start.jpg` y `derivados/{postId}/tiktok/x.mp4` con el SDK de administración; `settings/app.retentionDays = 7`):
```ts
it('purga el original y los derivados de un archivo ya publicado y conserva los fotogramas', async () => {
  // asset listo + publicación con destino 'publicada' y statusChangedAt hace 10 días
  // → original y derivado eliminados, fotograma existe, assets/{id}.status 'purgado'
});
it('no purga un archivo con una publicación programada y quita purgeAt', async () => {});
it('purga un archivo sin publicaciones creado hace 31 días', async () => {});
it('respeta retainUntil y lo refleja en purgeAt', async () => {});
```

`DetalleArchivo.test.tsx`, agregar:
```ts
it('muestra la fecha de purga y permite posponerla', async () => {
  const alPosponer = vi.fn();
  render(<DetalleArchivo asset={{ ...videoListo, purgeAt: new Date('2026-10-20T12:00:00Z') }} urls={{}} abierto alCerrar={() => {}} zonaHoraria="UTC" alPosponer={alPosponer} />);
  expect(screen.getByText(/Se purgará el/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Posponer 7 días' }));
  expect(alPosponer).toHaveBeenCalled();
});
it('ofrece crear una publicación con el archivo listo', () => {
  render(<DetalleArchivo asset={videoListo} urls={{}} abierto alCerrar={() => {}} zonaHoraria="UTC" alPosponer={() => {}} />);
  expect(screen.getByRole('link', { name: 'Crear publicación' })).toHaveAttribute('href', `/crear?archivo=${videoListo.id}`);
});
```
(`videoListo` es el fixture de `components/biblioteca/fixtures.ts`.)

- [ ] **Paso 2: Ejecutar y verificar que fallan**

Run: `pnpm test` y `pnpm test:integracion`
Expected: FAIL.

- [ ] **Paso 3: Implementar**

- `limpiarRetencionAhora`: `retentionDays` con `leerAjustes(settings/app)`; recorre `assets` con `status in ['listo', 'fallido']`; por cada uno, `posts` con `assetId == id` y sus `targets` (una publicación sin destinos cuenta como un uso `borrador`); `calcularPurga`. Si es `null`, borra `purgeAt` si existía. Si vence (`<= ahora`): borra `originales/{id}` (ignora "no encontrado"), `bucket.deleteFiles({ prefix: \`derivados/${postId}/\` })` por cada publicación y escribe `{ status: 'purgado', purgeAt }`. Si no vence, actualiza `purgeAt` cuando cambió.
- `DetalleArchivo`: nueva prop `alPosponer(): void`; si `fechaDePurgaVisible(asset)` existe, muestra `Se purgará el {formatearFechaHora(fecha, zonaHoraria)}` y el botón "Posponer 7 días"; si el archivo está `listo`, enlace "Crear publicación" a `/crear?archivo={id}`.
- `biblioteca/page.tsx`: `alPosponer` llama a `posponerPurga` (toast "Purga pospuesta"); al eliminar, `ArchivoEnUso` muestra el toast `` `Este archivo se usa en ${usos} publicaciones. Elimínalas primero.` `` (con 1: "en 1 publicación").

- [ ] **Paso 4: Ejecutar y verificar que pasan**

Run: `pnpm test && pnpm typecheck && pnpm test:integracion`
Expected: PASS.

- [ ] **Paso 5: Commit**

```bash
git add packages/core functions apps/web pruebas/integracion
git commit -m "feat: retención de archivos con purga diaria y posponer desde la Biblioteca"
```

---

### Tarea 10: Web: base de la fase 2 (funciones, lecturas, fechas, navegación y privacidad)

**Archivos:**
- Modificar: `apps/web/package.json` (`luxon@^3.7.2`, `@types/luxon` en desarrollo), `apps/web/src/lib/firebase/cliente.ts`, `apps/web/src/components/shell/{navegacion.ts,navegacion.test.ts}`, `apps/web/src/app/page.tsx`, `apps/web/src/app/(publico)/entrar/page.tsx`, `apps/web/e2e/fase1.spec.ts`
- Crear: `apps/web/src/lib/publicaciones/{acciones.ts,acciones.test.ts,repositorio.ts}`, `apps/web/src/lib/{fechas.ts,fechas.test.ts}`, `apps/web/src/lib/ajustes/useAjustes.ts`
- Crear: `apps/web/src/components/publicaciones/{InsigniaRed.tsx,InsigniaRed.test.tsx}`, `apps/web/src/app/(publico)/privacidad/{page.tsx,page.test.tsx}`

**Interfaces:**
- Consume: Tareas 1 y 2 (tipos, `leerPublicacion`, `leerDestino`, `leerIntento`, `AccionPublicacion`).
- Produce:
  ```ts
  // lib/firebase/cliente.ts: ServiciosFirebase gana `functions: Functions` (us-central1; emulador 127.0.0.1:5001)
  // lib/publicaciones/acciones.ts
  const MENSAJE_ERROR_GENERICO = 'No se pudo completar la acción. Intenta de nuevo.';
  function ejecutarAccion(accion: AccionPublicacion): Promise<RespuestaPublicaciones>; // httpsCallable 'publicaciones'
  function mensajeDeError(error: unknown): string;
  // lib/publicaciones/repositorio.ts (hooks en tiempo real; `cargando` mientras llega el primer resultado)
  function usePublicacion(id: string): { publicacion: Publicacion | null; destinos: Destino[]; cargando: boolean };
  function usePublicacionesEnRango(desde: Date | null, hasta: Date | null): Publicacion[];
  function useBorradoresSinFecha(): Publicacion[];           // posts con scheduledAt == null, ordenados por updatedAt desc en el cliente
  function usePrincipales(): { publicacion: Publicacion; hijas: number }[]; // kind 'principal' con estado programada, publicando, publicada o parcial
  function useHijas(postId: string | null): Publicacion[];
  function useIntentos(postId: string, red: Platform): Intento[];
  interface ItemPendiente { postId: string; destino: Destino }
  function usePendientes(): { manuales: ItemPendiente[]; referencias: ItemPendiente[]; total: number };
  // lib/fechas.ts
  function aFechaUtc(fecha: string /* yyyy-MM-dd */, hora: string /* HH:mm */, zona: string): Date;
  function aPartesLocales(fecha: Date, zona: string): { fecha: string; hora: string };
  // lib/ajustes/useAjustes.ts
  function useAjustes(): AjustesApp; // AJUSTES_POR_DEFECTO mientras carga
  // components/publicaciones/InsigniaRed.tsx
  function InsigniaRed(props: { platform: Platform; estado?: EstadoDestino }): JSX.Element;
  ```

- [ ] **Paso 1: Escribir las pruebas que fallan**

`fechas.test.ts`:
```ts
import { expect, it } from 'vitest';
import { aFechaUtc, aPartesLocales } from './fechas';

it('convierte la hora local de la zona a UTC', () => {
  expect(aFechaUtc('2026-10-08', '10:30', 'America/Mexico_City').toISOString()).toBe('2026-10-08T16:30:00.000Z');
});
it('una hora inexistente por horario de verano pasa a la siguiente válida', () => {
  expect(aFechaUtc('2026-03-08', '02:30', 'America/New_York').toISOString()).toBe('2026-03-08T07:30:00.000Z');
});
it('aPartesLocales es la inversa', () => {
  expect(aPartesLocales(new Date('2026-10-08T16:30:00Z'), 'America/Mexico_City')).toEqual({ fecha: '2026-10-08', hora: '10:30' });
});
```

`acciones.test.ts`:
```ts
import { FirebaseError } from 'firebase/app';
import { expect, it } from 'vitest';
import { MENSAJE_ERROR_GENERICO, mensajeDeError } from './acciones';

it('usa el mensaje del servidor en errores esperados', () => {
  expect(mensajeDeError(new FirebaseError('functions/failed-precondition', 'Elige un archivo.'))).toBe('Elige un archivo.');
});
it('usa el mensaje genérico en errores internos o desconocidos', () => {
  expect(mensajeDeError(new FirebaseError('functions/internal', 'INTERNAL'))).toBe(MENSAJE_ERROR_GENERICO);
  expect(mensajeDeError(new Error('x'))).toBe(MENSAJE_ERROR_GENERICO);
});
```
Son "esperados" los códigos `functions/` `invalid-argument`, `failed-precondition`, `not-found`, `permission-denied` y `unauthenticated`.

`InsigniaRed.test.tsx`:
```ts
it('muestra la abreviatura con la etiqueta accesible del estado', () => {
  render(<InsigniaRed platform="instagram" estado="pendiente_manual" />);
  expect(screen.getByLabelText('Instagram: Pendiente manual')).toHaveTextContent('IG');
});
```

`privacidad/page.test.tsx`:
```ts
it('incluye las secciones y enlaces que exigen las redes', () => {
  render(<Privacidad />);
  for (const t of ['Responsable', 'Datos que se tratan', 'Para qué se usan', 'Servicios de terceros', 'Conservación', 'Seguridad', 'Borrado de datos', 'Contacto']) {
    expect(screen.getByRole('heading', { name: t })).toBeInTheDocument();
  }
  expect(screen.getByRole('heading', { name: 'Borrado de datos' }).closest('section')).toHaveAttribute('id', 'borrado-de-datos');
  for (const href of ['https://policies.google.com/privacy', 'https://www.youtube.com/t/terms', 'https://myaccount.google.com/permissions',
    'https://www.facebook.com/settings?tab=applications', 'https://www.tiktok.com/legal/privacy-policy']) {
    expect(document.querySelector(`a[href="${href}"]`)).not.toBeNull();
  }
});
```

En `navegacion.test.ts`, la prueba de disponibilidad espera `['/calendario', '/crear', '/pendientes', '/biblioteca', '/ajustes/general']`.

- [ ] **Paso 2: Ejecutar y verificar que fallan**

Run: `pnpm vitest run --project web`
Expected: FAIL.

- [ ] **Paso 3: Implementar**

- `fechas.ts` con Luxon: `DateTime.fromISO(\`${fecha}T${hora}\`, { zone })` (Luxon avanza las horas inexistentes) y `DateTime.fromJSDate(fecha, { zone }).toFormat(...)`.
- `repositorio.ts`: lecturas con `onSnapshot` y `leerPublicacion`/`leerDestino`/`leerIntento`; el `postId` de un destino del grupo `targets` es `doc.ref.parent.parent!.id`. Consultas: rango por `scheduledAt` (`>= desde`, `< hasta`, orden ascendente); `scheduledAt == null`; `kind == 'principal'` (el filtro por estado y el conteo de Hijas, con una consulta de `posts` con `kind == 'hija'`, se hacen en el cliente); grupo `targets` con `status == 'pendiente_manual'` y con `parentRef.status == 'pendiente'`, ambos ordenados por `scheduledAt`; `attempts` ordenados por `at` descendente.
- `InsigniaRed`: tonos por estado como en la Biblioteca (`borrador` y `cancelada` secundario, esta última tachada; `programada` y `publicando` oro profundo; `publicada` éxito; `fallida` peligro; `pendiente_manual` alerta); sin `estado`, tono neutro y etiqueta solo con el nombre de la red.
- `navegacion.ts`: `FASE_ACTUAL = 2`. `app/page.tsx` redirige a `/calendario` y `/entrar` también, tras iniciar sesión.
- `privacidad/page.tsx` (grupo `(publico)`, sin sesión): secciones de la prueba en español; el correo de contacto sale de `NEXT_PUBLIC_CORREO_CONTACTO` (si falta, "el correo de contacto indicado en la ficha de la app"); "Borrado de datos" explica cómo quitar la app en Facebook, revocar el acceso de Google, desconectar cada red y pedir el borrado por correo, con respuesta en un máximo de 30 días.
- `e2e/fase1.spec.ts`: tras entrar se espera `/calendario` y se navega a `/biblioteca` antes de subir.

- [ ] **Paso 4: Ejecutar y verificar que pasan**

Run: `pnpm --filter @omnistream/web lint && pnpm vitest run --project web && pnpm --filter @omnistream/web typecheck`
Expected: PASS.

- [ ] **Paso 5: Commit**

```bash
git add apps/web pnpm-lock.yaml
git commit -m "feat(web): base de la fase 2, lecturas en tiempo real y página de privacidad"
```

---

### Tarea 11: Web: editor básico (`/crear` y `/publicaciones/[id]/editar`)

**Archivos:**
- Crear: `apps/web/src/lib/publicaciones/{formulario.ts,formulario.test.ts}`, `apps/web/src/components/publicaciones/{EditorPublicacion.tsx,EditorPublicacion.test.tsx}`
- Crear: `apps/web/src/app/(app)/publicaciones/[id]/editar/page.tsx`; modificar `apps/web/src/app/(app)/crear/page.tsx`
- Agregar con el CLI de shadcn: `checkbox`

**Interfaces:**
- Consume: Tareas 1, 2 y 10.
- Produce:
  ```ts
  interface FormularioPublicacion {
    title: string; assetId: string; text: string; hashtags: string; fecha: string; hora: string; parentId: string;
    redes: Partial<Record<Platform, FormatoDestino>>;
    youtube: { description: string; tags: string; categoryId: string; privacy: CamposYoutube['privacy']; madeForKids: boolean; frame: Fotograma };
  }
  const FORMULARIO_VACIO: FormularioPublicacion;
  function aEntrada(form: FormularioPublicacion, zona: string, postId?: string): EntradaPublicacion;
  function aFormulario(publicacion: Publicacion, destinos: Destino[], zona: string): FormularioPublicacion;
  type Intencion = 'guardar' | 'programar' | 'publicar_ahora';
  function EditorPublicacion(props: {
    zona: string; archivos: Asset[]; principales: { publicacion: Publicacion; hijas: number }[];
    inicial?: { publicacion: Publicacion; destinos: Destino[]; hijas: number }; archivoInicial?: string;
    ahora?: () => Date; alEnviar(entrada: EntradaPublicacion, intencion: Intencion): Promise<void>;
  }): JSX.Element;
  ```

- [ ] **Paso 1: Escribir las pruebas que fallan**

`formulario.test.ts`:
```ts
it('aEntrada arma destinos, hashtags, etiquetas de YouTube y la fecha en UTC', () => {
  const entrada = aEntrada({ ...FORMULARIO_VACIO, title: 'Hola', assetId: 'a1', hashtags: '#uno dos', fecha: '2026-10-08', hora: '10:30',
    redes: { youtube: 'short', tiktok: 'tiktok' }, youtube: { ...FORMULARIO_VACIO.youtube, tags: 'viaje, mar ,' } }, 'America/Mexico_City');
  expect(entrada).toMatchObject({ title: 'Hola', assetId: 'a1', parentId: null, scheduledAt: '2026-10-08T16:30:00.000Z',
    base: { text: '', hashtags: ['uno', 'dos'] } });
  expect(entrada.destinos).toEqual([
    { platform: 'youtube', format: 'short', youtube: { description: '', tags: ['viaje', 'mar'], categoryId: '22', privacy: 'public', madeForKids: false, thumbnail: { frame: 'start' } } },
    { platform: 'tiktok', format: 'tiktok' },
  ]);
});
it('sin fecha u hora, scheduledAt es null', () => {
  expect(aEntrada({ ...FORMULARIO_VACIO, title: 'x', fecha: '2026-10-08' }, 'UTC').scheduledAt).toBeNull();
});
it('aFormulario es la inversa de aEntrada', () => {
  // publicación con 2 destinos y fecha → aFormulario → aEntrada produce los mismos destinos y la misma fecha
});
```

`EditorPublicacion.test.tsx` (con `alEnviar = vi.fn().mockResolvedValue(undefined)`, `ahora = () => new Date('2026-10-07T12:00:00Z')`, zona `America/Mexico_City`, archivos: un video vertical de 30 s 1080×1920 y uno de 480×854):
```ts
it('al elegir un archivo sugiere las redes', async () => {
  // elegir el radio "vertical.mp4" → checkboxes Facebook, Instagram, YouTube y TikTok marcados;
  // selects "Formato en YouTube" = Short, "Formato en Facebook" = Reel
});
it('muestra el contador por red y marca el exceso', async () => {
  // con Instagram marcado, escribir 2201 caracteres → "Instagram: 2201 / 2200" con aria-invalid="true"
});
it('bloquea Programar con errores y los lista', async () => {
  // sin fecha → clic "Programar" → región role="alert" contiene "Elige la fecha y la hora."; alEnviar no se llama
});
it('pide confirmación y muestra las advertencias', async () => {
  // archivo de 480×854, fecha 2026-10-08 10:30 → "Programar" → diálogo con "La resolución es menor a 720p."
  // → "Confirmar" → alEnviar(entrada con scheduledAt '2026-10-08T16:30:00.000Z', 'programar')
});
it('ofrece los principales para videos cortos', async () => {
  // principales: [{ publicacion: { id: 'p1', title: 'Mi video largo', ... }, hijas: 2 }]
  // select "¿Pertenece a un video principal?" tiene "Mi video largo (2 Hijas)"; elegirla → entrada.parentId 'p1'
});
it('con video largo de YouTube anuncia que será Principal y oculta el selector', async () => {});
it('muestra los campos de YouTube solo con YouTube elegido', async () => {
  // "Descripción de YouTube", "Etiquetas de YouTube", "Categoría", "Privacidad", "Hecho para niños", "Miniatura"
});
it('guardar borrador no exige fecha', async () => {
  // título + archivo → "Guardar borrador" → alEnviar(..., 'guardar') sin diálogo
});
```

- [ ] **Paso 2: Ejecutar y verificar que fallan**

Run: `pnpm vitest run --project web`
Expected: FAIL.

- [ ] **Paso 3: Implementar `formulario.ts` y `EditorPublicacion`**

- Secciones con encabezado: "Archivo" (radios con el nombre del archivo y su miniatura; sin archivos listos: "No hay archivos listos. Sube uno en la Biblioteca." con enlace), "Redes" (checkbox por red con su select "Formato en {Red}" según `FORMATOS_POR_RED`; al elegir archivo y si no hay redes marcadas, aplica `sugerirDestinos`), "Jerarquía" (con video largo de YouTube: "Esta publicación será un video Principal."; si no: select "¿Pertenece a un video principal?" con "No pertenece" y `Título (N Hijas)`, "1 Hija" en singular), "Contenido" ("Título", "Texto", "Hashtags" con ayuda "Separados por espacios o comas", y un contador `{Red}: {n} / {límite}` por cada red con `limiteTexto` sobre `contenidoFinal`), "YouTube" (campos de la prueba; categorías de `CATEGORIAS_YOUTUBE`; privacidad Pública, No listada, Privada; miniatura Inicio, Mitad, Final) y "Fecha y hora" ("Fecha" `type=date`, "Hora" `type=time`, ayuda `Zona horaria: {zona}`).
- Botones: borrador o nueva → "Guardar borrador", "Programar", "Publicar ahora"; programada → "Guardar cambios", "Publicar ahora".
- Antes de enviar, `validarPublicacion` con el archivo elegido, el principal elegido, `tipoActual` y `numeroDeHijas` de `inicial`, y `hora` según la intención (`guardar` en una publicación no programada solo bloquea por jerarquía). Con errores: región `role="alert"` con la lista. Para `programar` y `publicar_ahora`: diálogo "Confirmar programación" o "Confirmar publicación" con las advertencias (o "Sin advertencias.") y botón "Confirmar".
- `crear/page.tsx` (dentro de `<Suspense>` por `useSearchParams`): `archivoInicial` desde `?archivo=`; `alEnviar` → `ejecutarAccion({ accion: 'guardar', publicacion })` y, según la intención, `ejecutarAccion({ accion: 'programar', postId, inmediata })`; con éxito redirige a `/calendario?resaltar={postId}` (o a `/publicaciones/{postId}` tras guardar) con toast "Publicación programada", "Publicando ahora" o "Borrador guardado"; los errores muestran `mensajeDeError`.
- `publicaciones/[id]/editar/page.tsx`: igual, con `inicial` desde `usePublicacion` y `useHijas`; si la publicación no es editable, muestra "Esta publicación ya no se puede editar." con enlace al detalle.

- [ ] **Paso 4: Ejecutar y verificar que pasan**

Run: `pnpm --filter @omnistream/web lint && pnpm vitest run --project web && pnpm --filter @omnistream/web typecheck`
Expected: PASS.

- [ ] **Paso 5: Commit**

```bash
git add apps/web
git commit -m "feat(web): editor básico de publicaciones"
```

---

### Tarea 12: Web: detalle de la publicación (`/publicaciones/[id]`)

**Archivos:**
- Crear: `apps/web/src/components/publicaciones/{DetallePublicacion.tsx,DetallePublicacion.test.tsx}`, `apps/web/src/app/(app)/publicaciones/[id]/page.tsx`

**Interfaces:**
- Consume: Tareas 1, 10 y 11.
- Produce:
  ```ts
  function DetallePublicacion(props: {
    publicacion: Publicacion; destinos: Destino[]; principal: Publicacion | null; hijas: Publicacion[];
    intentos: Partial<Record<Platform, Intento[]>>; zona: string; ahora?: () => Date;
    alAccion(accion: AccionPublicacion): Promise<void>;
  }): JSX.Element;
  ```

- [ ] **Paso 1: Escribir las pruebas que fallan**

`DetallePublicacion.test.tsx`:
```ts
it('un borrador con fecha ofrece Editar, Programar, Publicar ahora y Eliminar', () => {});
it('programada ofrece Cancelar publicación y no Programar', () => {});
it('un destino fallido muestra su error y Reintentar', async () => {
  // destino tiktok 'fallida' con lastError.message 'Sin conector.' → región "TikTok" contiene 'Sin conector.'
  // clic "Reintentar" → alAccion({ accion: 'reintentar', postId, platform: 'tiktok' })
});
it('un destino pendiente enlaza a su paquete', () => {
  // link "Abrir paquete" → href `/pendientes/${id}/instagram`
});
it('un destino publicado enlaza a la publicación en la red', () => {
  // link "Ver publicación" → href remote.url, target _blank
});
it('Eliminar pide confirmación', async () => {
  // "Eliminar" → diálogo "¿Eliminar esta publicación?" → "Eliminar" → alAccion({ accion: 'eliminar', postId })
});
it('un Principal lista sus Hijas y una Hija enlaza a su Principal con Desvincular', () => {});
it('muestra los intentos de cada destino', () => {
  // intentos tiktok [{ stage: 'manual', result: 'ok', at }] → sección "Intentos" con la fecha formateada en la zona
});
```

- [ ] **Paso 2: Ejecutar y verificar que fallan**

Run: `pnpm vitest run --project web`
Expected: FAIL.

- [ ] **Paso 3: Implementar**

Encabezado con título, `ETIQUETAS_ESTADO_PUBLICACION`, `ETIQUETAS_TIPO` y fecha (`formatearFechaHora`). Botones según estados: "Editar" (enlace) si `esEditable`; "Programar" si todos los destinos están en borrador o cancelados y hay fecha; "Publicar ahora" si `esEditable`; "Cancelar publicación" si algún destino está en `ESTADOS_CANCELABLES`; "Eliminar" si `sePuedeEliminar`; "Desvincular del principal" en las Hijas. "Programar" y "Publicar ahora" validan con `validarPublicacion` (con el contexto que da la página) y piden la misma confirmación que el editor. Una región por destino (`aria-label` = red) con `InsigniaRed`, formato, estado, hora, `lastError.message`, referencia al Padre (`en_espera`: "La referencia se habilitará cuando se publique el video principal."; `pendiente`: enlace a `/pendientes`), acciones y "Intentos". La página obtiene los datos con `usePublicacion`, `useHijas`, `usePublicacion(parentId)` y `useIntentos`, y tras `eliminar` redirige a `/calendario`.

- [ ] **Paso 4: Ejecutar y verificar que pasan**

Run: `pnpm --filter @omnistream/web lint && pnpm vitest run --project web && pnpm --filter @omnistream/web typecheck`
Expected: PASS.

- [ ] **Paso 5: Commit**

```bash
git add apps/web
git commit -m "feat(web): detalle de publicación con acciones por destino"
```

---

### Tarea 13: Web: calendario con arrastrar y soltar

**Archivos:**
- Modificar: `apps/web/package.json` (`@fullcalendar/core`, `@fullcalendar/react`, `@fullcalendar/daygrid`, `@fullcalendar/timegrid`, `@fullcalendar/interaction`, `@fullcalendar/luxon3`, todos `6.1.21` exactos), `apps/web/src/app/globals.css`, `apps/web/src/app/(app)/calendario/page.tsx`
- Crear: `apps/web/src/components/calendario/{eventos.ts,eventos.test.ts,CalendarioPublicaciones.tsx,BorradoresSinFecha.tsx}`

**Interfaces:**
- Consume: Tareas 1, 10 y 12.
- Produce:
  ```ts
  interface EventoPublicacion { id: string; title: string; start: Date; editable: boolean; classNames: string[];
    extendedProps: { status: EstadoPublicacion; targetStatus: Partial<Record<Platform, EstadoDestino>> } }
  function aEventos(publicaciones: readonly Publicacion[], ahora: Date, resaltar?: string): EventoPublicacion[];
  function CalendarioPublicaciones(props: { publicaciones: Publicacion[]; zona: string; resaltar?: string;
    alMover(postId: string, fecha: Date): Promise<void>; alAbrir(postId: string): void;
    alCambiarRango(desde: Date, hasta: Date): void }): JSX.Element;
  ```

- [ ] **Paso 1: Escribir las pruebas que fallan**

`eventos.test.ts`:
```ts
const ahora = new Date('2026-10-07T12:00:00Z');
it('una publicación programada futura es arrastrable', () => {
  const [e] = aEventos([pub({ status: 'programada', scheduledAt: new Date('2026-10-09T10:00:00Z'), targetStatus: { tiktok: 'programada' } })], ahora);
  expect(e).toMatchObject({ editable: true, classNames: ['evento-publicacion', 'evento-programada'] });
});
it('publicada, en curso o en el pasado no se arrastra', () => {
  // status 'publicada' → editable false; targetStatus { tiktok: 'pendiente_manual' } → false; scheduledAt pasado → false
});
it('las ideas llevan su clase propia', () => {
  // status 'idea' → classNames ['evento-publicacion', 'evento-idea']
});
it('resalta la publicación indicada', () => {
  // aEventos([...], ahora, 'p1') → classNames del evento p1 contiene 'evento-resaltado'
});
it('omite publicaciones sin fecha', () => {});
```
(`pub` es un ayudante local que completa una `Publicacion`.)

- [ ] **Paso 2: Ejecutar y verificar que fallan**

Run: `pnpm vitest run --project web`
Expected: FAIL.

- [ ] **Paso 3: Implementar**

- `aEventos`: omite las publicaciones sin `scheduledAt`; `editable = esEditable(Object.values(targetStatus)) && scheduledAt > ahora` (las ideas, sin destinos, también se mueven si su fecha es futura); clases `evento-publicacion` y `evento-{status}`, más `evento-resaltado` si corresponde.
- `CalendarioPublicaciones`: `FullCalendar` con `dayGridPlugin`, `timeGridPlugin`, `interactionPlugin`, `luxonPlugin`; `timeZone={zona}`, `locale={esLocale}`, vistas `dayGridMonth` y `timeGridWeek` (botones "Mes" y "Semana"), `snapDuration: '00:15:00'`, `eventAllow: (info) => info.start > new Date()`, `eventDrop` → `alMover(id, event.start)`; si falla, `info.revert()`. `eventContent` muestra el título y una `InsigniaRed` por red de `targetStatus`. `eventClick` → `alAbrir`. `datesSet` → `alCambiarRango`. `initialDate` = fecha de la publicación resaltada.
- `globals.css`: variables `--fc-*` con los colores del tema (borde, fondo de hoy en `--oro-claro` translúcido, evento en `--superficie-elevada` con borde `--oro`), `.evento-idea` con borde punteado y `.evento-resaltado` con anillo `--oro`.
- `calendario/page.tsx` (dentro de `<Suspense>`): encabezado "Calendario", `usePublicacionesEnRango` con el rango visible, `alMover` → `ejecutarAccion({ accion: 'mover', postId, scheduledAt })` con toast "Publicación movida" o el error; `alAbrir` → `/publicaciones/{id}`; panel "Borradores sin fecha" (`useBorradoresSinFecha`, enlaces al detalle; vacío: "No hay borradores sin fecha.").

- [ ] **Paso 4: Ejecutar y verificar que pasan**

Run: `pnpm --filter @omnistream/web lint && pnpm vitest run --project web && pnpm --filter @omnistream/web typecheck && pnpm --filter @omnistream/web build`
Expected: PASS.

- [ ] **Paso 5: Commit**

```bash
git add apps/web pnpm-lock.yaml
git commit -m "feat(web): calendario con arrastrar y soltar"
```

---

### Tarea 14: Web: pendientes y paquete del modo asistido

**Archivos:**
- Crear: `apps/web/src/components/pendientes/{ListaPendientes.tsx,ListaPendientes.test.tsx,PaquetePendiente.tsx,PaquetePendiente.test.tsx}`, `apps/web/src/app/(app)/pendientes/[postId]/[red]/page.tsx`
- Modificar: `apps/web/src/app/(app)/pendientes/page.tsx`, `apps/web/src/components/shell/{BarraLateral.tsx,Shell.tsx,AreaPrivada.tsx}`

**Interfaces:**
- Consume: Tareas 1, 2, 10.
- Produce:
  ```ts
  function ListaPendientes(props: { manuales: { publicacion: Publicacion; destino: Destino }[];
    referencias: { publicacion: Publicacion; destino: Destino; principal: Publicacion | null; urlPrincipal?: string }[];
    zona: string; alMarcarReferencia(postId: string, red: Platform): Promise<void> }): JSX.Element;
  function PaquetePendiente(props: { publicacion: Publicacion; destino: Destino; principal: Publicacion | null;
    urlPrincipal?: string; urlDescarga?: string; urlMiniatura?: string; zona: string;
    alMarcarPublicada(url: string): Promise<void> }): JSX.Element;
  // BarraLateral: nueva prop opcional `contadores?: Partial<Record<string, number>>` (por ruta)
  ```

- [ ] **Paso 1: Escribir las pruebas que fallan**

`ListaPendientes.test.tsx`:
```ts
it('lista los pendientes por hora con enlace a su paquete', () => {
  // dos manuales → artículos con aria-label 'Mi corto · TikTok' e 'Mi corto · Instagram' en orden de scheduledAt;
  // link "Abrir paquete" → /pendientes/p1/tiktok
});
it('las referencias muestran el texto listo para copiar y se marcan', async () => {
  // referencia Instagram de la Hija 'Mi corto' con principal 'Largo' y urlPrincipal 'https://youtu.be/abc'
  // → texto 'Video completo en YouTube: «Largo» https://youtu.be/abc'; "Marcar referencia como publicada" → alMarcarReferencia('p1', 'instagram')
});
it('sin elementos muestra "No hay pendientes."', () => {});
```

`PaquetePendiente.test.tsx`:
```ts
it('TikTok incluye la referencia al Principal en el texto final', () => {
  // Hija con principal 'Largo' sin URL → textarea "Texto final" termina en 'Video completo en YouTube: «Largo»'
});
it('YouTube muestra título, descripción, etiquetas, privacidad y miniatura', () => {});
it('ofrece descargar el archivo', () => {
  // urlDescarga → link "Descargar archivo" con atributo download
});
it('rechaza una URL de otra red sin llamar al servidor', async () => {
  // destino instagram; escribir una URL de YouTube en "URL publicada" → "Marcar como publicada"
  // → texto 'La URL no corresponde a una publicación de Instagram.'; alMarcarPublicada no se llama
});
it('marca publicada con una URL válida', async () => {});
it('copia el texto final', async () => {
  // "Copiar texto" → navigator.clipboard.writeText con el texto final; toast "Copiado"
});
```

En `BarraLateral` (prueba nueva en `components/shell/BarraLateral.test.tsx`): con `contadores={{ '/pendientes': 3 }}` muestra la insignia "3" con `aria-label` "3 pendientes".

- [ ] **Paso 2: Ejecutar y verificar que fallan**

Run: `pnpm vitest run --project web`
Expected: FAIL.

- [ ] **Paso 3: Implementar**

- `PaquetePendiente`: encabezado `{título} · {Red}`, "Hora objetivo" (`formatearFechaHora`), "Descargar archivo", "Texto final" (`contenidoFinal`; en TikTok con `textoReferencia(principal.title, urlPrincipal)` si es Hija) con "Copiar texto"; en YouTube, "Título", "Descripción" y "Etiquetas" con su propio botón de copiar, privacidad, "Hecho para niños" y el fotograma de miniatura con enlace de descarga; formulario "URL publicada" + "Marcar como publicada" que valida con `analizarUrlPublica` antes de llamar. Estructura con `<dl>` y etiquetas visibles, estable para que Claude en el navegador la siga.
- `pendientes/[postId]/[red]/page.tsx`: datos con `usePublicacion` (y la del principal); `urlDescarga` con `getDownloadURL` del `storagePath` del archivo (si falla, "El archivo ya no está disponible."); `urlMiniatura` del fotograma elegido; `urlPrincipal` = `urlVideoYoutube(remote.id)` del destino YouTube del Principal. Si el destino ya no está `pendiente_manual`, muestra su estado con enlace al detalle. `alMarcarPublicada` → `ejecutarAccion({ accion: 'marcarPublicada', … })`, toast "Marcada como publicada" y vuelve a `/pendientes`.
- `pendientes/page.tsx`: encabezado "Pendientes", secciones "Publicaciones" y "Referencias al video principal" con `usePendientes` y las publicaciones de cada elemento.
- `AreaPrivada` pasa `{ '/pendientes': usePendientes().total }` a `Shell` → `BarraLateral`.

- [ ] **Paso 4: Ejecutar y verificar que pasan**

Run: `pnpm --filter @omnistream/web lint && pnpm vitest run --project web && pnpm --filter @omnistream/web typecheck`
Expected: PASS.

- [ ] **Paso 5: Commit**

```bash
git add apps/web
git commit -m "feat(web): pendientes y paquete del modo asistido"
```

---

### Tarea 15: Web: notificaciones push e instalación

**Archivos:**
- Crear: `apps/web/public/sw-notificaciones.js` (+ `apps/web/src/lib/notificaciones/sw.test.ts`), `apps/web/public/icono.svg`, `apps/web/src/app/manifest.ts`
- Crear: `apps/web/src/lib/notificaciones/{estado.ts,estado.test.ts,activar.ts}`, `apps/web/src/components/ajustes/{TarjetaNotificaciones.tsx,TarjetaNotificaciones.test.tsx}`
- Modificar: `apps/web/src/app/(app)/ajustes/general/page.tsx`, `apps/web/.env.development` (comentario sobre `NEXT_PUBLIC_FIREBASE_VAPID_KEY`)

**Interfaces:**
- Produce:
  ```ts
  type EstadoNotificaciones = 'no_soportado' | 'sin_configurar' | 'bloqueadas' | 'desactivadas' | 'activadas';
  function estadoNotificaciones(entorno: { soportado: boolean; vapid?: string; permiso: NotificationPermission; tokenRegistrado: boolean }): EstadoNotificaciones;
  function activarNotificaciones(): Promise<'activadas' | 'bloqueadas'>;
  //   Notification.requestPermission → navigator.serviceWorker.register('/sw-notificaciones.js')
  //   → getToken(getMessaging(app), { vapidKey, serviceWorkerRegistration }) → settings/app.fcmTokens arrayUnion(token)
  //   → localStorage 'omnistream.fcmToken' (con try/catch)
  function TarjetaNotificaciones(props: { estado: EstadoNotificaciones; alActivar(): Promise<void> }): JSX.Element;
  ```

- [ ] **Paso 1: Escribir las pruebas que fallan**

`estado.test.ts`:
```ts
it.each([
  [{ soportado: false, vapid: 'k', permiso: 'default', tokenRegistrado: false }, 'no_soportado'],
  [{ soportado: true, vapid: undefined, permiso: 'default', tokenRegistrado: false }, 'sin_configurar'],
  [{ soportado: true, vapid: 'k', permiso: 'denied', tokenRegistrado: false }, 'bloqueadas'],
  [{ soportado: true, vapid: 'k', permiso: 'granted', tokenRegistrado: false }, 'desactivadas'],
  [{ soportado: true, vapid: 'k', permiso: 'granted', tokenRegistrado: true }, 'activadas'],
] as const)('%j → %s', (entorno, esperado) => {
  expect(estadoNotificaciones(entorno)).toBe(esperado);
});
```

`sw.test.ts` (evalúa `public/sw-notificaciones.js` con un `self` simulado que registra los manejadores):
```ts
it('muestra el aviso con los datos del mensaje', async () => {
  // evento 'push' con data.json() = { data: { titulo: 'Publicación pendiente', cuerpo: 'Mi corto · TikTok', enlace: '/pendientes/p1/tiktok' } }
  // → self.registration.showNotification('Publicación pendiente', { body: 'Mi corto · TikTok', data: { enlace: '/pendientes/p1/tiktok' }, icon: '/icono.svg' })
});
it('al tocar el aviso abre el enlace', async () => {
  // evento 'notificationclick' → notification.close() y clients.openWindow('/pendientes/p1/tiktok')
});
```

`TarjetaNotificaciones.test.tsx`:
```ts
it.each([
  ['no_soportado', 'Este navegador no admite notificaciones push. En iPhone, instala OmniStream en la pantalla de inicio desde Safari.'],
  ['sin_configurar', 'Falta configurar la llave VAPID (NEXT_PUBLIC_FIREBASE_VAPID_KEY).'],
  ['bloqueadas', 'Las notificaciones están bloqueadas en este navegador. Permítelas en la configuración del sitio.'],
  ['activadas', 'Activadas en este dispositivo.'],
] as const)('%s', (estado, texto) => {
  render(<TarjetaNotificaciones estado={estado} alActivar={vi.fn()} />);
  expect(screen.getByText(texto)).toBeInTheDocument();
});
it('desactivadas ofrece activar', async () => {
  // botón "Activar en este dispositivo" → alActivar
});
```

- [ ] **Paso 2: Ejecutar y verificar que fallan**

Run: `pnpm vitest run --project web`
Expected: FAIL.

- [ ] **Paso 3: Implementar**

- `sw-notificaciones.js`: manejadores `push` (lee `payload.data ?? payload.notification`, muestra el aviso; siempre muestra uno, como exige `userVisibleOnly`) y `notificationclick` (enfoca una ventana abierta de la app o abre `enlace`).
- `activar.ts`: `isSupported()` de `firebase/messaging`; `vapid` de `NEXT_PUBLIC_FIREBASE_VAPID_KEY`.
- `manifest.ts`: `name` y `short_name` "OmniStream", `start_url: '/calendario'`, `display: 'standalone'`, `background_color` y `theme_color` `#F3ECE1`, ícono `/icono.svg` (`sizes: 'any'`, `image/svg+xml`). `icono.svg`: el laurel de `components/marca/Laurel.tsx` en `#B08442` sobre `#F3ECE1`.
- `ajustes/general/page.tsx`: tarjeta "Notificaciones" bajo el formulario; calcula el estado al montar (en el cliente) y lo recalcula tras activar; toast "Notificaciones activadas" o el error.

- [ ] **Paso 4: Ejecutar y verificar que pasan**

Run: `pnpm --filter @omnistream/web lint && pnpm vitest run --project web && pnpm --filter @omnistream/web typecheck`
Expected: PASS.

- [ ] **Paso 5: Commit**

```bash
git add apps/web
git commit -m "feat(web): notificaciones push e instalación como app"
```

---

### Tarea 16: Pruebas E2E de la fase 2A, guía y README

**Archivos:**
- Crear: `apps/web/e2e/fase2.spec.ts`
- Modificar: `apps/web/e2e/ayudantes.ts` (+ `subirArchivo`), `pruebas/integracion/src/admin.ts` (si hace falta para E2E), `docs/configuracion.md`, `README.md`

**Interfaces:**
- Consume: todo lo anterior; `adminDemo` (Tarea 4) desde `@omnistream/pruebas-integracion/admin`.
- Produce: `subirArchivo(page: Page, ruta: string, nombre: string): Promise<void>` (sube desde `/biblioteca` y espera "Listo").

- [ ] **Paso 1: Escribir las pruebas E2E**

```ts
test('programa a 4 redes en modo manual, llega a pendientes con aviso y se marca publicada', async ({ page }) => {
  await page.goto('/entrar');
  await entrarComo(page, 'propietario@omnistream.test');
  await subirArchivo(page, fixtures.video, 'video-vertical.mp4');
  await page.getByRole('button', { name: /Ver detalle/ }).first().click();
  await page.getByRole('link', { name: 'Crear publicación' }).click();
  for (const red of ['Facebook', 'Instagram', 'YouTube', 'TikTok']) await expect(page.getByRole('checkbox', { name: red })).toBeChecked();
  const titulo = `Prueba E2E ${Date.now()}`;
  await page.getByLabel('Título').fill(titulo);
  await page.getByLabel('Texto').fill('Hola desde OmniStream');
  await page.getByRole('button', { name: 'Publicar ahora' }).click();
  await page.getByRole('button', { name: 'Confirmar' }).click();
  await expect(page).toHaveURL(/\/calendario\?resaltar=/);
  const postId = new URL(page.url()).searchParams.get('resaltar')!;
  await page.goto('/pendientes');
  for (const red of ['Facebook', 'Instagram', 'YouTube', 'TikTok']) {
    await expect(page.getByRole('article', { name: `${titulo} · ${red}` })).toBeVisible({ timeout: 60_000 });
  }
  const avisos = await db.collection('notifications').where('enlace', '==', `/pendientes/${postId}/tiktok`).get();
  expect(avisos.size).toBe(1);
  await page.getByRole('article', { name: `${titulo} · TikTok` }).getByRole('link', { name: 'Abrir paquete' }).click();
  await expect(page.getByLabel('Texto final')).toHaveValue(/Hola desde OmniStream/);
  await page.getByLabel('URL publicada').fill('https://www.tiktok.com/@cuenta/video/7300000000000000001');
  await page.getByRole('button', { name: 'Marcar como publicada' }).click();
  await expect(page).toHaveURL(/\/pendientes$/);
  await expect(page.getByRole('article', { name: `${titulo} · TikTok` })).toHaveCount(0);
  await page.goto(`/publicaciones/${postId}`);
  await expect(page.getByRole('region', { name: 'TikTok' }).getByText('Publicada')).toBeVisible();
});

test('mover una publicación en el calendario no la duplica', async ({ page }) => {
  // entrar; subir el video; crear publicación solo con Facebook (Reel), fecha = mañana (UTC) 10:00 → Programar → Confirmar
  // en /calendario (vista Mes) arrastrar el evento con page.mouse (move con steps: 10) a td[data-date="pasado mañana"]
  // → toast "Publicación movida"; con adminDemo: posts/{id}.scheduledAt = pasado mañana 10:00 UTC,
  //   targets: 1 documento, facebook.scheduleVersion 2, attempts 0
});
```
`db` sale de `adminDemo('e2e')`. Las fechas de "mañana" y "pasado mañana" se calculan en UTC (la zona por defecto de los ajustes).

- [ ] **Paso 2: Ejecutar y verificar**

Run: `pnpm test:e2e`
Expected: PASS (fase 1 y fase 2). Si una prueba falla, corregir la causa en la tarea correspondiente; no se relajan las esperas por encima de 60 s.

- [ ] **Paso 3: Actualizar `docs/configuracion.md` y `README.md`**

`docs/configuracion.md`:
- "Ejecutar en local": el emulador de Cloud Tasks (puerto 9499) arranca con el de funciones; en local las tareas se entregan de inmediato y las programadas a futuro terminan como anticipadas.
- Nueva sección "Producción: fase 2A", en orden:
  1. APIs (Google Cloud > APIs y servicios): habilitar Cloud Tasks API, Cloud Scheduler API y Firebase Cloud Messaging API.
  2. IAM: a la cuenta de servicio de las funciones (`NUMERO_DE_PROYECTO-compute@developer.gserviceaccount.com`), los roles "Encolador de Cloud Tasks", "Usuario de cuenta de servicio" y "Administrador de la API de Firebase Cloud Messaging"; a la cuenta de despliegue, "Administrador de Cloud Tasks" y "Administrador de Cloud Scheduler".
  3. Llave VAPID: Firebase > Configuración del proyecto > Cloud Messaging > Configuración web > Certificados de push web > Generar par de claves; la clave pública va en Vercel como `NEXT_PUBLIC_FIREBASE_VAPID_KEY`.
  4. `NEXT_PUBLIC_CORREO_CONTACTO` en Vercel (aparece en `/privacidad`).
  5. Despliegue: el flujo "Desplegar" publica funciones, reglas e índices; en Firestore > Índices, esperar a que los dos índices de `targets` estén "Habilitado" antes de usar `/pendientes`.
  6. Notificaciones: en cada dispositivo, Ajustes > Notificaciones > "Activar en este dispositivo". En iPhone: abrir el sitio en Safari, Compartir > Agregar a inicio, abrir desde el ícono y activar.
  7. Verificación (criterios 2A): programar a las 4 redes en modo manual y confirmar el aviso y `/pendientes`; mover una programada en el calendario y confirmar que solo llega un aviso; publicar una Hija antes que su Principal y confirmar que su referencia pasa a pendiente al marcar el Principal.
- Tabla "Próximas fases": apps de Google, Meta y TikTok en 2B.

`README.md`: enlace al plan de la fase 2A y fila de `functions` actualizada ("acceso, procesamiento de archivos y publicación").

- [ ] **Paso 4: Verificación completa**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm --filter @omnistream/web build && pnpm test:integracion && pnpm test:e2e`
Expected: PASS.

- [ ] **Paso 5: Commit**

```bash
git add apps/web docs README.md pruebas/integracion
git commit -m "test(e2e): flujo de publicación asistida y guía de la fase 2A"
```
