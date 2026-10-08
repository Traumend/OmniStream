# OmniStream: especificación de diseño

- **Fecha:** 2026-10-07
- **Estado:** en revisión
- **Origen:** PRD "OmniStream" y sesión de diseño aprobada sección por sección.

---

## 1. Resumen

OmniStream es una aplicación web **de uso personal** para programar y publicar contenido multimedia en Facebook (página), Instagram (Business), YouTube (canal) y TikTok (cuenta Business), con una cuenta por red. Centraliza la creación en un "Smart Canvas", organiza el contenido en una jerarquía Padre/Hijo (video largo de YouTube y sus fragmentos cortos), mide el rendimiento cruzado y delega la ideación, el copy y el análisis a una suite de IA que usa las llaves del propio usuario (BYOK: Anthropic y OpenAI).

Toda la infraestructura corre en Firebase / Google Cloud. Las redes cuya API aún no esté aprobada funcionan en **modo asistido (manual)**, de modo que el producto es útil desde el primer día.

---

## 2. Contexto y decisiones

### 2.1 Indicado por el usuario

| # | Decisión |
|---|---|
| D1 | Herramienta personal: un solo usuario y exactamente una cuenta por red. Sin facturación ni multiusuario. |
| D2 | Software propio. Los repositorios Easel y Postmill son solo referencia; no se copia su código. |
| D3 | Firebase reemplaza a Cloudflare Pages (hosting) y a Supabase (base de datos y autenticación). Render queda descartado. |
| D4 | Un recorte genera un archivo nuevo que se publica solo en la red de destino. |
| D5 | Los Shorts llegan ya optimizados; el procesamiento de video se limita a recortes. |
| D6 | IA únicamente con Anthropic y OpenAI. |
| D7 | Interfaz solo en español por ahora. |
| D8 | Las APIs de las redes se aprobarán gradualmente; mientras tanto se publica de forma manual o con Claude en el navegador. |
| D9 | Infraestructura "todo en Firebase/Google Cloud" (enfoque A). |
| D10 | Modo asistido (manual) y política de retención de archivos, confirmados. |
| D11 | La referencia al Padre en una Hija se publica como primer comentario donde la API lo permita; en TikTok va en la descripción. |
| D12 | Las llamadas a Anthropic incluyen por defecto el respaldo automático del servidor ante rechazos. |
| D13 | Dirección visual: tema claro neoclásico con neumorfismo suave y acentos dorados, según la imagen de referencia del usuario (sección 5.5). Sustituye el "modo oscuro nativo" del PRD. |
| D14 | La aplicación web se publica en Vercel (con vista previa por cada pull request). Firebase sigue como backend: Auth, Firestore, Storage y Cloud Functions. |
| D15 | Las acciones del servidor son Cloud Functions, no rutas de Next.js: una función invocable por dominio (`publicaciones`, `conexiones`, `ia`) y funciones HTTP solo para las URL que llaman las redes. Vercel sirve únicamente la interfaz y no guarda credenciales de servicio. |
| D16 | La fase 2 se divide en 2A (publicación asistida, de punta a punta en modo manual) y 2B (conectores por API), cada una con su plan. |
| D17 | Se usa el plan Blaze con alerta de presupuesto de 1 USD y política de limpieza de imágenes de funciones; el costo esperado es 0. Los videos no se guardan: el original se borra en cuanto todas sus redes quedan publicadas (retención de 0 días por defecto). |
| D18 | Un video Principal de YouTube puede importarse desde YouTube (subido o programado allá) sin pasar el archivo por OmniStream: se guarda solo su información. |
| D19 | El objetivo es dar exposición al video Principal: cada Principal tiene una lista de promoción (shorts, publicación en Comunidad y exposición por medios propios) con fechas relativas editables y avisos al vencer. Las fechas clave sugeridas por IA (efemérides relacionadas con el tema) llegan en la fase 4. |

### 2.2 Supuestos de diseño (aceptados en la revisión por secciones)

- La zona horaria del usuario se configura una sola vez; todas las fechas se guardan en UTC.
- La retención por defecto es de 0 días: el original se borra en cuanto todas las redes de destino que lo usan llegan a un estado terminal (D17). Se puede subir en Ajustes.
- El tamaño máximo de subida es de 10 GB, configurable.
- No hay ambiente de pruebas intermedio: un proyecto de Firebase de producción más emuladores locales.

---

## 3. Alcance

### 3.1 Dentro del alcance

- Calendario unificado (vistas mensual y semanal) con arrastrar y soltar.
- Jerarquía Padre/Hijo con seguimiento de fragmentos publicados.
- Publicación cruzada por API o en modo asistido, programada o inmediata.
- Smart Canvas: 3 fotogramas, advertencias, zonas seguras, recorte, ajustes por red y vista previa final.
- Dashboard de estadísticas y análisis Padre/Hijo.
- Suite de IA BYOK: copy por red, descubrimiento de tendencias, planificación, guiones, locución (TTS) y aprendizaje a partir de métricas.

### 3.2 Fuera del alcance

- Recorte dinámico que sigue al sujeto a lo largo del video.
- Recortar la duración del video o editar con línea de tiempo.
- Subtítulos, filtros y efectos.
- Carruseles de varias imágenes.
- Generación de imágenes con IA (solo sugerencias en texto).
- Modo oscuro (los colores se definen como variables para poder agregarlo después).
- Enlaces cortos propios para contar clics hacia el video Principal.
- Multiusuario, equipos, facturación, varios idiomas de interfaz.
- Publicación autónoma por IA sin aceptación explícita del usuario.

---

## 4. Restricciones externas conocidas

| Tema | Restricción | Cómo la maneja el diseño |
|---|---|---|
| Firebase | Cloud Storage y Cloud Functions requieren el plan Blaze (tarjeta registrada). Blaze conserva una cuota gratuita. | Alertas de presupuesto; política de retención de archivos. |
| Firebase Auth | Las funciones de bloqueo de Auth requieren activar Firebase Authentication con Identity Platform. | Se activa en la configuración de la fase 1. |
| Cloud Tasks | Solo programa tareas hasta 30 días en el futuro. | La función diaria `encolarPendientes` encola lo que entra en esa ventana. |
| YouTube | Mientras el proyecto no pase la auditoría, los videos subidos por API quedan bloqueados como privados. Con la app de Google en estado "Prueba", el acceso caduca cada 7 días. | YouTube publica en modo manual hasta la auditoría; la app de Google se pasa a "En producción" (aunque no esté verificada). La lectura de métricas no depende de la auditoría. |
| TikTok | Sin auditoría, lo publicado por API solo es visible para el autor. La API no permite publicar comentarios. Las fotos solo se publican si TikTok descarga el archivo desde un dominio verificado. La auditoría exige elementos concretos en la interfaz de publicación. | Modo manual hasta la auditoría; referencia al Padre en la descripción; interfaz de TikTok con los elementos exigidos (sección 7.4.1). |
| Meta | Para usuarios que no tienen un rol en la app se requieren App Review y verificación del negocio. El administrador puede usar la app en modo desarrollo. | Se valida en la primera prueba si lo publicado en modo desarrollo es público; si no, modo manual hasta la aprobación. |
| Instagram | La API exige que el archivo esté en una URL pública que Meta descarga; las imágenes deben ser JPEG. | Enlaces firmados de 1 hora; los recortes de imagen para Instagram se generan en JPEG. |

---

## 5. Arquitectura

### 5.1 Organización del repositorio

Monorepo con pnpm:

| Ruta | Contenido |
|---|---|
| `apps/web` | Next.js (App Router) con TypeScript estricto, Tailwind CSS, shadcn/ui sobre Radix, Framer Motion, Recharts y FullCalendar (edición MIT). Tema claro neoclásico (sección 5.5). Se despliega en Vercel. |
| `functions/` | Cloud Functions de 2.ª generación en TypeScript. Se empaquetan con esbuild en un solo archivo antes de desplegarse, para resolver los paquetes internos del monorepo. |
| `packages/core` | Dominio puro, sin dependencias de red: tipos, esquemas Zod, reglas por red, combinación de ajustes por red, máquinas de estados, cálculo de recortes, normalización de métricas y cálculo del impulso estimado. |
| `packages/platforms` | Un conector por red con la misma interfaz: `facebook`, `instagram`, `youtube`, `tiktok` y `manual`. |
| `packages/ai` | Abstracción de proveedores (Anthropic y OpenAI), prompts versionados y esquemas de salida de cada tarea. |
| `docs/` | Especificaciones, planes y guía de configuración. |

Versiones: Node.js LTS soportado tanto por Cloud Functions como por Vercel (22 o superior); Next.js en su versión estable vigente al iniciar la fase 1.

### 5.2 Interfaz común de los conectores (`packages/platforms`)

```ts
// Por proveedor (meta, youtube, tiktok): un inicio de sesión de Meta crea dos conexiones.
interface OAuthProvider {
  proveedor: Proveedor;
  buildAuthUrl(p: { state: string; redirectUri: string }): string;
  exchangeCode(p: { code: string; redirectUri: string }): Promise<ResultadoConexion>; // sesión, permisos y cuentas por red
  refresh(sesion: SesionProveedor): Promise<SesionProveedor>;
}
// Por red.
interface PlatformAdapter {
  platform: Platform;
  // Publicación por etapas: recibe el punto de control y devuelve el siguiente
  publishStep(target: DestinoEfectivo, checkpoint: Checkpoint | null, ctx: PublishContext): Promise<StepResult>;
  findExisting(target: DestinoEfectivo, window: { desde: Date; hasta: Date }, ctx): Promise<RemoteRef | null>;
  postComment(remoteId: string, text: string, ctx): Promise<{ id: string }>; // TikTok lanza un error definitivo
}
// PublishContext lleva reanudando: true cuando la ejecución continúa desde un checkpoint guardado.
// fetchMetrics y fetchFollowers llegan en la fase 5; parsePublicUrl es analizarUrlPublica de core.
```

`StepResult` es `{ kind: 'continue', checkpoint, delaySec? } | { kind: 'done', remote } | { kind: 'error', error: PlatformError }`, y `PlatformError` lleva `kind: 'temporal' | 'definitivo' | 'ambiguo' | 'auth'`.

### 5.3 Componentes en ejecución

```
Navegador ──> Next.js en Vercel (solo interfaz)
               ├──> Firebase Auth (Google; solo el correo permitido)
               ├──> Firestore (lectura; las publicaciones se escriben desde funciones)
               ├──> Cloud Storage (subida reanudable directa desde el navegador)
               └──> Funciones invocables: publicaciones, conexiones, IA interactiva

Cloud Functions (2.ª gen) + Cloud Tasks + Cloud Scheduler + Secret Manager + Cloud Messaging
```

### 5.4 Funciones

| Función | Disparador | Propósito | Fase |
|---|---|---|---|
| `antesDeCrearUsuario` | Bloqueo de Auth | Rechaza cualquier correo distinto al permitido o sin verificar y asigna el claim `owner`. | 1 |
| `antesDeIniciarSesion` | Bloqueo de Auth | Repite la verificación en cada inicio de sesión. | 1 |
| `procesarArchivo` | Fin de subida a Storage | Lee los datos técnicos con ffprobe por URL firmada, sin descargar el archivo completo. Extrae 3 fotogramas (segundo 1, mitad, un segundo antes del final). Convierte heic a jpg. | 1 |
| `generarRecorte` | Cola | Genera el archivo derivado (ffmpeg para video, sharp para imagen) a la resolución recomendada de la red. Memoria 4 GiB, tiempo máximo 30 min. | 3 |
| `publicaciones` | Invocable | Acciones del usuario sobre publicaciones: guardar, eliminar, desvincular, programar o publicar ahora, mover, cancelar, reintentar, marcar publicada y marcar la referencia como publicada. | 2A |
| `publicarDestino` | Cola con hora programada | Publica un destino en una red, por etapas. Para esperas (por ejemplo, el procesamiento de Instagram) se vuelve a encolar con retraso. Memoria de 1 GiB; tiempo máximo 30 min (límite de las funciones de cola); una subida más larga continúa desde su `checkpoint` en otra ejecución. En 2A solo resuelve el modo manual; 2B agrega la publicación por API. | 2A / 2B |
| `comentarReferencia` | Cola | Publica la referencia al Padre por API. | 2B |
| `alCambiarDestino` | Escritura en `targets` | Recalcula el estado de la publicación, marca las referencias de las Hijas como pendientes cuando se publica su Principal y envía notificaciones push (pendiente manual, fallo, referencia pendiente). En 2B además encola `comentarReferencia`. | 2A |
| `encolarPendientes` | Cada hora | Encola los destinos programados que entran en la ventana de 29 días y aún no tienen tarea, y vuelve a encolar los destinos atascados: en `publicando` con el `lease` vencido, o en `programada` con su tarea ya encolada y la hora pasada hace más de 15 minutos (tarea perdida o entregada antes de tiempo). | 2A |
| `conexiones` / `retornoConexion` | Invocable / HTTP | Inicia la conexión con una red, configura su modo, consulta la cuenta de TikTok y desconecta; `retornoConexion` recibe el retorno de OAuth. | 2B |
| `borradoDatosMeta` | HTTP | Recibe las solicitudes de borrado de datos de Meta. | 2B |
| `media` | HTTP | Sirve archivos desde el dominio propio cuando una red exige dominio verificado. | 2B |
| `renovarSesiones` | Diaria | Renueva los accesos a las redes antes de que caduquen. | 2B |
| `limpiarRetencion` | Diaria | Purga originales y derivados según la política de retención. | 2A |
| `sincronizarMetricas` | Cada 6 horas | Sincroniza métricas por antigüedad y guarda los seguidores diarios. | 5 |
| `descubrirTendencias` | Diaria | Recolecta, evalúa y guarda tendencias. | 6 |
| `analizarRendimiento` | Semanal | Calcula las cifras y genera aprendizajes. | 6 |
| `generarLocucion` | Cola | Convierte un guion en audio con OpenAI. | 6 |

Las acciones que escriben publicaciones o encolan tareas pasan por la función invocable `publicaciones`, que exige el claim `owner`, valida con `core` y escribe con el SDK de administración. El navegador solo lee `posts` y `targets`. Las funciones de IA interactiva (fase 4) siguen el mismo patrón con la invocable `ia`.

### 5.5 Dirección visual

Tomada de la imagen de referencia del usuario: estética neoclásica, clara y cálida, con neumorfismo suave.

- **Paleta** (variables CSS; contraste AA verificado por prueba automática):

| Variable | Valor | Uso |
|---|---|---|
| `--fondo` | `#F3ECE1` | Fondo general, con textura de mármol sutil |
| `--superficie` | `#F8F3EB` | Tarjetas y paneles |
| `--superficie-elevada` | `#FCF9F4` | Elementos destacados, menús |
| `--borde` | `#E4D7C5` | Bordes finos |
| `--texto` | `#33281F` | Títulos y texto principal |
| `--texto-secundario` | `#6B5B4B` | Descripciones y etiquetas |
| `--texto-tenue` | `#857360` | Solo texto de 18 px o más, o decorativo |
| `--oro` | `#B08442` | Íconos, bordes activos, gráficos (no texto) |
| `--oro-claro` | `#D9B77A` | Ornamentos |
| `--oro-profundo` | `#7E5A24` | Texto de acento y enlaces |
| `--boton-oro-inicio` / `--boton-oro-fin` | `#8A6328` / `#6F4E1E` | Degradado del botón principal |
| `--sobre-oro` | `#FFFDF8` | Texto sobre el botón principal |
| `--exito` / `--alerta` / `--peligro` | `#3F6B3A` / `#85590C` / `#9A3B2A` | Estados |

- **Tipografía:** Cormorant Garamond (títulos y navegación), Cinzel (logotipo, lema y etiquetas en mayúsculas espaciadas), Source Serif 4 (texto, formularios y cifras con números tabulares).
- **Neumorfismo:** superficies elevadas con sombra doble (oscura cálida abajo a la derecha, clara arriba a la izquierda), estados presionados con sombra interior, radios de 18 px. El botón principal usa el degradado dorado.
- **Ornamentos:** logotipo con laurel en SVG, borde de meandro griego en SVG y textura de mármol generada con CSS/SVG. Las imágenes de estatuas y columnas son opcionales y solo se usan si el usuario aporta archivos con derechos de uso.
- **Iconos:** de trazo fino en dorado.
- **Navegación:** barra superior con logotipo, lema "UNA VISIÓN. CADA PLATAFORMA." y accesos CREAR, PLANIFICAR, PUBLICAR, ANALIZAR y CRECER; barra lateral con todas las secciones; lema inferior "CREAR · AUTOMATIZAR · AMPLIFICAR".

### 5.6 Rutas de la aplicación

| Ruta | Pantalla |
|---|---|
| `/entrar` | Inicio de sesión |
| `/calendario` | Calendario (página de inicio) |
| `/crear` y `/publicaciones/[id]/editar` | Flujo de creación y edición |
| `/publicaciones/[id]` | Detalle: estado por red, historial de intentos, Hijas (si es Principal), métricas |
| `/pendientes` y `/pendientes/[postId]/[red]` | Bandeja y paquete del modo asistido |
| `/biblioteca` | Archivos subidos |
| `/estadisticas` | Dashboard |
| `/tendencias`, `/plan` | IA avanzada |
| `/ajustes/general`, `/ajustes/conexiones`, `/ajustes/ia`, `/ajustes/perfil` | Configuración |
| `/privacidad` | Política de privacidad (requerida por Meta, TikTok y Google) |

Next.js no tiene rutas de servidor: las acciones van a las funciones de la sección 5.4. Las URL públicas que piden las redes (retorno de OAuth, borrado de datos de Meta y `media/[token]`) se publican bajo `/api/...` del dominio de Vercel mediante reescrituras hacia las funciones HTTP, para que las redes vean un solo dominio (fase 2B).

---

## 6. Modelo de datos (Firestore)

Notación de tipos en TypeScript. `Platform = 'facebook' | 'instagram' | 'youtube' | 'tiktok'`. Todas las fechas son `Timestamp` en UTC.

### 6.1 Configuración

```ts
// settings/app
{
  timezone: string;            // IANA, p. ej. "America/Mexico_City"
  retentionDays: number;       // por defecto 0 (0 a 90)
  maxUploadGb: number;         // por defecto 10
  ai: {
    keys: { anthropic?: KeyStatus; openai?: KeyStatus }; // KeyStatus = { status: 'valida' | 'invalida'; hint: string; validatedAt }
    tasks: Record<AiTaskId, { provider: 'anthropic' | 'openai'; model: string; effort?: 'low' | 'medium' | 'high' }>;
    monthlyBudgetUsd?: number; // solo limita ejecuciones automáticas
    priceTable: Record<string /*modelo*/, { inputPerMTok: number; outputPerMTok: number; cacheReadPerMTok?: number }>;
  };
  fcmTokens: string[];         // notificaciones push
  promotionTemplate: { type: 'short' | 'comunidad' | 'exposicion'; title: string; offsetDays: number }[]; // plantilla de la lista de promoción
}

// settings/profile
{
  niche: string; audience: string; voice: string;
  pillars: { id: string; name: string; description: string }[];
  cadence: Partial<Record<Platform, number>>; // publicaciones por semana
  ctas: string[]; avoid: string[]; language: 'es';
}
```

### 6.2 Conexiones y secretos

```ts
// connections/{platform}  — el id del documento es la red: una cuenta por red
{
  platform: Platform;
  authStatus: 'sin_conectar' | 'conectada' | 'expirada' | 'error';
  readEnabled: boolean;               // lectura de métricas
  publishMode: 'api' | 'manual';      // por defecto 'manual'
  account?: { id: string; name: string; handle?: string; avatarUrl?: string };
  scopes: string[];
  tokenExpiresAt?: Timestamp;
  lastMetricsSyncAt?: Timestamp;
  lastError?: { code: string; message: string; at: Timestamp };
  mediaVerified?: boolean;            // TikTok: dominio de /api/media/ verificado (fotos por API)
}

// secrets/{id}  — ids: 'meta', 'youtube', 'tiktok', 'ai_anthropic', 'ai_openai'
// Inaccesible desde el navegador (reglas: deny all). Solo el SDK de administración.
// En los proveedores, el texto cifrado es la sesión: { accessToken, refreshToken?, expiresAt?, refreshExpiresAt?, datos }.
{ ciphertext: string; iv: string; authTag: string; keyVersion: number; updatedAt: Timestamp }

// oauthStates/{state}   — { proveedor, createdAt, expiresAt } (10 minutos, un solo uso). Sin acceso del cliente.
// dataDeletions/{code}  — { userId, at } (solicitudes de borrado de Meta). Sin acceso del cliente.
```

Un solo inicio de sesión de Meta crea las conexiones `facebook` e `instagram`; se conecta exactamente una página.

### 6.3 Archivos

```ts
// assets/{assetId}
{
  kind: 'video' | 'image' | 'audio';
  source: 'subida' | 'tts';
  originalName: string; storagePath: string; mimeType: string; sizeBytes: number;
  width?: number; height?: number; aspect?: number;  // tras aplicar la rotación
  durationSec?: number; fps?: number; hasAudio?: boolean; codec?: string; rotation?: number;
  frames?: { start: string; middle?: string; end?: string };  // rutas; imagen: solo start
  status: 'subiendo' | 'procesando' | 'listo' | 'fallido' | 'purgado';
  error?: string;
  createdAt: Timestamp; purgeAt?: Timestamp;
  retainUntil?: Timestamp;           // "Posponer purga": la purga no ocurre antes de esta fecha
}
```

Rutas en Storage: `originales/{assetId}`, `fotogramas/{assetId}/{start|middle|end}.jpg`, `derivados/{postId}/{red}/{cropHash}.{ext}`, `audio/{assetId}.mp3`.

### 6.4 Publicaciones

```ts
// posts/{postId}
{
  kind: 'principal' | 'hija' | 'independiente';
  parentId?: string;                 // obligatorio si kind = 'hija'
  status: 'idea' | 'borrador' | 'programada' | 'publicando' | 'publicada' | 'parcial' | 'fallida';
  title: string;                     // nombre interno y título por defecto en YouTube
  assetId?: string;                  // ausente en 'idea'
  base: { text: string; hashtags: string[] };
  scheduledAt: Timestamp | null;     // en 'idea' es la fecha sugerida; null explícito para consultar los borradores sin fecha
  targetStatus: Partial<Record<Platform, Target['status']>>; // desnormalizado por alCambiarDestino para el calendario
  pillarId?: string; trendId?: string; planId?: string; planItemId?: string;
  script?: Script;                   // guion generado (sección 9.6)
  createdAt: Timestamp; updatedAt: Timestamp;
}

// posts/{postId}/targets/{platform}
{
  platform: Platform;
  format: 'video_largo' | 'short' | 'reel' | 'tiktok' | 'imagen';
  overrides: { text?: string; hashtags?: string[]; title?: string; crop?: Crop; scheduledAt?: Timestamp };
  youtube?: {
    description: string; tags: string[]; categoryId: string;
    privacy: 'public' | 'unlisted' | 'private'; madeForKids: boolean;
    thumbnail?: { frame: 'start' | 'middle' | 'end' } | { assetId: string };
  };
  tiktok?: {
    privacy: string | null;          // sin valor por defecto; se elige entre las opciones que devuelve TikTok
    allowComments: boolean; allowDuet: boolean; allowStitch: boolean;
    commercial: { enabled: boolean; yourBrand: boolean; brandedContent: boolean };
  };
  scheduledAt?: Timestamp;           // efectivo (override o el de la publicación)
  scheduleVersion: number;
  enqueuedVersion?: number;          // versión para la que ya existe una tarea en la cola
  publishMode: 'api' | 'manual';     // copiado de la conexión al programar
  status: 'borrador' | 'programada' | 'publicando' | 'publicada' | 'fallida' | 'pendiente_manual' | 'cancelada';
  statusChangedAt: Timestamp;        // última transición de estado (retención y orden)
  lease?: { attemptId: string; until: Timestamp };
  checkpoint?: { stage: string; data: Record<string, unknown>; seq: number }; // seq: id único de cada continuación
  derivative?: { cropHash: string; storagePath?: string; status: 'pendiente' | 'generando' | 'listo' | 'fallido' };
  remote?: { id: string; url: string; publishedAt: Timestamp };
  parentRef: { status: 'no_aplica' | 'en_espera' | 'pendiente' | 'publicando' | 'publicada' | 'fallida'; remoteCommentId?: string; error?: string }; // publicando: comentario por API en cola
  metrics?: NormalizedMetrics & { syncedAt: Timestamp };
  attempts: number;
  lastError?: { code: string; message: string; kind: 'temporal' | 'definitivo' | 'ambiguo' | 'auth'; at: Timestamp };
}

// posts/{postId}/targets/{platform}/attempts/{attemptId}
{ at: Timestamp; stage: string; result: 'ok' | 'error' | 'omitido'; error?: string }

// Crop: coordenadas normalizadas 0..1 sobre el original ya rotado
type Crop = { aspect: '16:9' | '9:16' | '1:1' | '4:5' | '1.91:1'; x: number; y: number; w: number; h: number };

// notifications/{id}  — registro de cada aviso; el id deriva del evento que lo produjo, así un reintento no duplica el push
{
  tipo: 'pendiente_manual' | 'fallo' | 'referencia' | 'conexion' | 'promocion';
  titulo: string; cuerpo: string; enlace: string;  // enlace: ruta de la app
  createdAt: Timestamp; push: { enviados: number; fallidos: number };
}
```

Desde el cliente, `posts`, `targets`, `attempts`, `notifications` y `connections` son de solo lectura.

### 6.5 Métricas

```ts
type NormalizedMetrics = {
  views: number; reach: number | null; likes: number; comments: number;
  shares: number | null; saves: number | null; watchTimeMin: number | null;
  trafficSources?: Record<string, number>;   // solo YouTube
};

// posts/{postId}/targets/{platform}/snapshots/{yyyy-mm-dd}
{ metrics: NormalizedMetrics; at: Timestamp }

// accountSnapshots/{platform}_{yyyy-mm-dd}
{ platform: Platform; date: string; followers: number }
```

### 6.6 IA

```ts
// aiRuns/{runId}
{
  task: AiTaskId; provider: 'anthropic' | 'openai'; model: string; effort?: string;
  promptVersion: string; trigger: 'manual' | 'automatica';
  inputRefs: { postId?: string; trendIds?: string[]; planId?: string };
  status: 'ok' | 'error' | 'rechazo';
  usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number };
  costUsdEstimate: number; error?: string; createdAt: Timestamp;
}

// trends/{trendId}
{
  title: string; summary: string; sources: { url: string; title: string }[];
  scores: { afinidad: number; viralidad: number; frescura: number; facilidad: number; total: number }; // 0..10
  angle: string; status: 'nueva' | 'aceptada' | 'descartada' | 'caducada';
  expiresAt: Timestamp; discoveredAt: Timestamp;
}

// plans/{planId}
{
  createdAt: Timestamp; from: Timestamp; to: Timestamp;
  items: {
    id: string; title: string; hook: string; format: Target['format']; platforms: Platform[];
    suggestedAt: Timestamp; pillarId?: string; trendId?: string; outline: string[];
    status: 'propuesta' | 'aceptada' | 'descartada'; postId?: string;
  }[];
}

// insights/{insightId}
{
  claim: string; evidence: { metric: string; value: number; comparison: string }[];
  confidence: 'baja' | 'media' | 'alta'; recommendation: string;
  status: 'activo' | 'archivado'; periodFrom: Timestamp; periodTo: Timestamp; createdAt: Timestamp;
}
```

### 6.7 Reglas de la jerarquía Padre/Hijo

1. Solo puede ser `principal` una publicación con destino `youtube` en formato `video_largo`.
2. Una `hija` es un video corto o una imagen y su `parentId` apunta a un `principal`. Validado en `core` y en la función `publicaciones`.
3. Al publicarse una Hija en Facebook, Instagram o YouTube, `comentarReferencia` publica el primer comentario con el título y la URL del Principal. En TikTok, la referencia se agrega al final de la descripción al publicar: siempre incluye el título del Principal y, si ya está publicado, su URL. En TikTok, `parentRef` pasa directamente a `publicada` con la publicación.
4. Si el Principal aún no tiene `remote.url`, la referencia queda en `en_espera`; cuando el Principal se publica, `alCambiarDestino` encola todas las referencias en espera.
5. Eliminar un Principal con Hijas no está permitido; primero se desvinculan.

### 6.8 Estados

- **Destino:** `borrador` → `programada` → `publicando` → `publicada`, o bien `fallida`, `pendiente_manual` o `cancelada`. Desde `fallida` se puede reintentar (vuelve a `programada`). Desde `pendiente_manual` se pasa a `publicada` al registrar la URL.
- **Publicación:** `idea` y `borrador` los fija el usuario. El resto lo calcula `alCambiarDestino` a partir de sus destinos, ignorando los `cancelada` y aplicando estas reglas en orden:
  1. Si no queda ningún destino → `borrador`.
  2. Todos `publicada` → `publicada`.
  3. Alguno `publicando` → `publicando`.
  4. Alguno `programada` o `pendiente_manual` → `programada`.
  5. Mezcla de `publicada` y `fallida` → `parcial`; solo `fallida` → `fallida`.

### 6.9 Índices

- Grupo de colecciones `targets`: `status` + `scheduledAt` (encolado, recuperación y pendientes); `parentRef.status` + `scheduledAt` (referencias pendientes); `remote.publishedAt` (sincronización por antigüedad, fase 5).
- `posts`: `scheduledAt` (calendario, incluye las ideas); `parentId` (Hijas de un Principal); `assetId` (retención). Son índices simples.
- `trends`: `status` + `discoveredAt`. `insights`: `status` + `createdAt`. `aiRuns`: `createdAt` (consumo mensual).

### 6.10 Promoción del video Principal

```ts
// posts/{postId} con kind 'principal': campos adicionales
{
  origin: 'omnistream' | 'youtube_importado';   // importado: sin assetId; su destino youtube nace 'publicada' con remote
  promotion: {
    items: {
      id: string;
      type: 'short' | 'comunidad' | 'exposicion';
      title: string;                 // p. ej. "Short 1", "Post en Comunidad", "Historia de Instagram"
      offsetDays: number;            // relativo a la publicación del Principal
      dueAt: Timestamp | null;       // calculada; si el usuario la edita, deja de seguir al Principal (dueAtEdited: true)
      dueAtEdited: boolean;
      status: 'pendiente' | 'hecho';
      hijaId?: string;               // en 'short': la Hija que lo cumple
      note?: string;
      notifiedAt?: Timestamp;        // aviso de vencido ya enviado
    }[];
  };
}
```

- **Fecha base:** la publicación del Principal en YouTube: `remote.publishedAt`, o `scheduledAt` mientras está programado. Si la fecha base cambia, se recalculan los `dueAt` no editados.
- **Plantilla por defecto** (`settings/app.promotionTemplate`): Short 1 (+1 día), Short 2 (+3), Short 3 (+5), Post en Comunidad (+2), Exposición en medios propios (0). Se edita en Ajustes y en cada Principal.
- **Shorts:** una Hija vinculada al Principal cumple el siguiente `short` pendiente cuando se publica (o se asigna a mano). Comunidad y exposición se marcan a mano: YouTube no permite publicar en Comunidad por API.
- **Avisos:** `encolarPendientes` (cada hora) envía un push por cada pendiente vencido, una sola vez (`notifiedAt`). `/pendientes` lista los pendientes de promoción vencidos o de los próximos 7 días.
- **Importar de YouTube:** con la URL o el id del video y la conexión de YouTube (lectura), `videos.list` (`part=snippet,status`) da título, `publishAt` o `publishedAt` y privacidad. Mientras el video sea privado con `publishAt` futuro, las referencias de sus Hijas esperan (`en_espera`) hasta esa hora.

---

## 7. Flujo de publicación

### 7.1 Conexiones (Ajustes > Conexiones)

Una tarjeta por red muestra estado, cuenta, caducidad del acceso, interruptor de lectura de métricas y selector de modo de publicación (API o Manual; por defecto Manual).

| Red | Inicio de sesión | Duración del acceso | Notas |
|---|---|---|---|
| Meta | Facebook Login for Business (Graph API `v26.0`): se elige una sola página; se obtiene la cuenta de Instagram vinculada. | El acceso de la página no caduca salvo cambio de contraseña o revocación. | Crea las conexiones `facebook` e `instagram`. |
| YouTube | OAuth de Google con acceso sin conexión. Permisos para subir, comentar y leer métricas. | Se renueva con el token de actualización. | La app de Google debe estar "En producción". |
| TikTok | Login Kit for Web (sin PKCE: la documentación lo reserva a móvil y escritorio; protege el `state` de un solo uso). Permisos `user.info.basic`, `user.info.profile`, `video.publish`, `video.list`. | 24 horas; el token de actualización dura 365 días y puede rotar. | |

Cada inicio de sesión usa un valor `state` (y PKCE donde aplica) guardado en Firestore, inaccesible desde el cliente y con caducidad de 10 minutos. `renovarSesiones` renueva los accesos a diario y `publicarDestino` lo hace también si el acceso vence en menos de 10 minutos. Un error de autenticación marca la conexión como `expirada` y muestra un aviso para reconectar.

### 7.2 Ciclo de una publicación

1. **Programar:** la función `publicaciones` valida la publicación con las reglas de `core`. En una transacción, cada destino pasa a `programada`, incrementa `scheduleVersion`, copia `publishMode` de su conexión y fija su `scheduledAt` efectivo. Después encola en `publicarDestino` una tarea `{ postId, platform, scheduleVersion }` con `scheduleTime`, si cae dentro de 29 días (Cloud Tasks admite hasta 30). El id de la tarea es `{postId}-{red}-v{scheduleVersion}`, así encolar dos veces la misma versión no la duplica; al encolar se guarda `enqueuedVersion`. "Publicar ahora" sigue el mismo camino con la hora actual.
2. **Tomar la tarea:** en una transacción se verifica `status = 'programada'` y que `scheduleVersion` coincida. Si se cumple, el destino pasa a `publicando` con `lease` de 15 minutos. Si no coincide la versión, la tarea termina sin hacer nada. Si faltan más de 60 segundos para `scheduledAt`, también termina sin hacer nada (Cloud Tasks nunca entrega antes de tiempo; el emulador sí). Si hay un `lease` vigente de otro intento, también termina sin hacer nada. Si el `lease` venció, el intento continúa desde el `checkpoint`; `encolarPendientes` vuelve a encolar cada hora los destinos `publicando` con el `lease` vencido y los `programada` cuya tarea nunca los tomó (más de 15 minutos después de su hora).
3. **Validar:** se aplican las reglas de `core`. Si fallan, el destino queda `fallida` con error `definitivo`.
4. **Recortar:** si existe `overrides.crop` y el derivado no está `listo`, se genera en ese momento.
5. **Modo manual:** si `publishMode = 'manual'`, el destino pasa a `pendiente_manual` y se envía una notificación push (sección 7.5). El archivo final ya está listo para descargar.
6. **Publicar por etapas:** se llama a `publishStep` en un ciclo. Después de cada paso que crea algo en la red, se guarda el `checkpoint` antes de continuar. Si un paso pide esperar (`delaySec`), la función se vuelve a encolar y termina.
7. **Cerrar:** se guarda `remote` y el destino pasa a `publicada`. Si la publicación es una Hija, `alCambiarDestino` deja su referencia `pendiente` (o `en_espera` si el Principal aún no tiene URL) y, en 2B, encola `comentarReferencia` cuando la conexión permite comentar.

Mover una publicación en el calendario o editar su hora repite el paso 1. La tarea anterior encontrará otra versión y no hará nada. Cancelar pasa los destinos no publicados a `cancelada`.

### 7.3 Particularidades por red

| Red | Subida | Etapas | Referencia al Padre |
|---|---|---|---|
| YouTube | Subida reanudable leyendo el archivo de Storage como flujo; la URL de la sesión de subida se guarda en el `checkpoint`. | Subir → miniatura (opcional) | Comentario (no se puede fijar por API) |
| Facebook | Directa a la página. | Reel (video vertical corto), video o foto, según el formato | Primer comentario |
| Instagram | Meta descarga el archivo desde un enlace firmado de 1 hora. | Crear contenedor → revisar estado cada 30 s → publicar | Primer comentario |
| TikTok | Por partes desde la función. | Consultar datos del creador → iniciar → subir partes → consultar estado | En la descripción |

Las fotos en TikTok requieren que el archivo se sirva desde un dominio verificado (`/api/media/[token]`). Si el dominio no está verificado, el formato imagen en TikTok usa modo manual.

### 7.4 Reglas por red (`packages/core/rules`)

Se guardan como datos, no como código disperso. Los valores iniciales se verifican contra la documentación oficial en la fase 2B.

| Red / formato | Duración | Proporción | Texto |
|---|---|---|---|
| YouTube video largo | Sin límite práctico | 16:9 recomendada | Título ≤ 100 caracteres; descripción ≤ 5.000; etiquetas ≤ 500 en total |
| YouTube Short | ≤ 3 min | 9:16 o 1:1 | Igual que el video largo |
| Instagram Reel | 3 s a 15 min | 9:16 | ≤ 2.200 caracteres, ≤ 30 hashtags |
| Instagram imagen | No aplica | Entre 4:5 y 1.91:1; JPEG | ≤ 2.200 caracteres, ≤ 30 hashtags |
| Facebook Reel | 3 a 90 s | 9:16 | Sin límite práctico |
| Facebook video / foto | Sin límite práctico | Libre | Sin límite práctico |
| TikTok video | Máximo que informa la cuenta | 9:16 | ≤ 2.200 caracteres |
| TikTok foto | No aplica | 9:16 recomendada | ≤ 2.200 caracteres |

Límites por API (verificados el 2026-10-08, V3; solo para destinos en modo API): Facebook imagen ≤ 10 MB (JPEG, PNG, GIF, BMP o TIFF); Instagram Reel ≤ 300 MB; Instagram imagen ≤ 8 MB, solo JPEG; TikTok video ≤ 4 GB y ≤ 10 min; TikTok foto ≤ 20 MB (JPEG o WEBP). La descripción de YouTube se mide en bytes (≤ 5.000) e Instagram admite ≤ 20 menciones.

Resoluciones de salida de los recortes: 9:16 → 1080×1920; 1:1 → 1080×1080; 4:5 → 1080×1350; 16:9 → 1920×1080; 1.91:1 → 1080×566.

#### 7.4.1 Requisitos de interfaz de TikTok

La pantalla de publicación de TikTok muestra el nombre de la cuenta, un selector de privacidad sin valor por defecto con las opciones que devuelve TikTok, interruptores de comentarios, Duet y Stitch (desactivados si la cuenta no los permite) y la declaración de contenido comercial (tu marca / contenido de marca). No se permite programar sin elegir la privacidad.

### 7.5 Modo asistido (manual)

- A la hora programada el destino pasa a `pendiente_manual` y llega una notificación push.
- `/pendientes` lista los destinos pendientes ordenados por hora objetivo.
- `/pendientes/[postId]/[red]` es el paquete: botón de descarga del archivo final (enlace de descarga de Storage), texto final listo para copiar (texto + hashtags + referencia al Padre en TikTok), título y campos propios de la red, y la hora objetivo. La estructura es simple y estable para que Claude en el navegador pueda seguirla.
- Al pegar la URL publicada, `parsePublicUrl` extrae el id; el destino pasa a `publicada` y, si es una Hija, el texto de la referencia queda visible para comentarlo a mano (o se publica por API si la conexión tiene acceso para comentar).
- Las referencias al Padre pendientes también aparecen en `/pendientes`, con su texto listo para copiar y el botón "Marcar referencia como publicada".
- La barra lateral muestra el número de pendientes. Las notificaciones push requieren activarlas en cada dispositivo desde Ajustes; en iPhone, además, instalar la app en la pantalla de inicio.

### 7.6 Errores, reintentos y duplicados

| Tipo | Ejemplos | Comportamiento |
|---|---|---|
| Temporal | 5xx, 429, red caída | La función lanza error; Cloud Tasks reintenta hasta 5 veces, con esperas de 1 a 30 minutos. Al agotarse: `fallida`. |
| Definitivo | Datos inválidos, formato rechazado | `fallida` con mensaje en español; sin reintento automático; botón "Reintentar". |
| Autenticación | Acceso inválido o revocado | `fallida` y conexión `expirada`; aviso para reconectar. |
| Ambiguo | Tiempo agotado en el paso final | Antes de repetir, `findExisting` busca en las publicaciones recientes de la cuenta una que coincida por título o texto en una ventana de ±30 minutos. Si existe, se toma como publicada. |

Cada intento queda en `attempts`. Los fallos envían una notificación push. Si el comentario de referencia por API falla, la referencia vuelve a `pendiente` (modo manual en `/pendientes`) con aviso.

### 7.7 Retención

- Un archivo original se purga `retentionDays` días (0 por defecto: de inmediato, al cambiar el último destino) después de que todos los destinos que lo usan están en estado terminal (`publicada` o `cancelada`; un destino `fallida` con más de 30 días también se considera terminal).
- Los derivados se purgan con su original. Los fotogramas y los metadatos se conservan; el archivo pasa a `purgado`.
- Un archivo sin publicaciones asociadas se purga a los 30 días.
- La interfaz muestra la fecha de purga y permite posponerla.

---

## 8. Smart Canvas y flujo de creación

La página **Crear** tiene seis pasos: Archivo → Destinos → Canvas → Contenido → Vista previa → Publicar. Después del primero se navega libremente. El borrador se guarda solo (escrituras con retardo de 1 segundo).

### 8.1 Archivo

- Formatos: videos mp4, mov, webm; imágenes jpg, png, webp, heic.
- El navegador lee de inmediato duración, resolución y proporción para mostrar advertencias tempranas.
- La subida es reanudable, con progreso, en segundo plano. "Programar" se habilita cuando la subida terminó.
- `procesarArchivo` confirma los datos técnicos y genera los 3 fotogramas. El canvas trabaja sobre esas imágenes.

### 8.2 Destinos y jerarquía

- Sugerencias según el archivo: video horizontal largo → YouTube `video_largo` como Principal; video vertical ≤ 3 min → Short, Reel y TikTok; imagen → foto en Facebook e Instagram (y TikTok si el dominio está verificado). YouTube no admite imágenes.
- Para videos cortos e imágenes aparece "¿Pertenece a un video principal?", con los Principales programados o publicados y su número de Hijas.

### 8.3 Canvas

- **Distribución:** redes a la izquierda (con indicador correcto / advertencia / error), imagen en el marco de la red al centro, controles a la derecha y tira de 3 fotogramas abajo.
- **Advertencias:** salen de las reglas de `core`. *Error* bloquea (duración o peso excedidos). *Advertencia* permite continuar (resolución menor a 720p, proporción incompatible, video de más de 3 minutos que no se clasificará como Short).
- **Zonas seguras:** interruptor que superpone capas semitransparentes por red y formato. Cada zona es una lista de rectángulos en porcentajes en `core/rules/safe-zones`.
- **Recorte:** proporciones 16:9, 9:16, 1:1, 4:5 y 1.91:1, con las adecuadas destacadas. El recuadro se arrastra y se amplía, y se muestra a la vez sobre los 3 fotogramas. Ante incompatibilidad, "Aplicar guía [proporción]" coloca un recorte centrado. El recorte es fijo para todo el video y se guarda como `Crop`. Al guardar un recorte, `generarRecorte` produce el derivado en segundo plano; si no está listo al publicar, `publicarDestino` lo genera en ese momento. El recorte de video se permite para videos de hasta 15 minutos y 2 GB.
- **Ajustes por red:** cada campo (texto, hashtags, título, recorte, hora) hereda el valor base. "Desvincular" copia el valor base a `overrides` para editarlo; "Revincular" elimina el override. Los destinos con overrides muestran "Personalizado". La combinación es una función pura en `core`: `efectivo = override ?? base`.

### 8.4 Contenido

- Texto base con contadores por red según sus límites; hashtags como etiquetas.
- Campos propios de YouTube y TikTok (sección 6.4 y 7.4.1). Miniatura del Principal: uno de los 3 fotogramas o una imagen propia.
- "Generar con IA" (sección 9.3).

### 8.5 Vista previa final

Maquetas de teléfono por red, lado a lado (una a la vez en pantallas angostas), con el recorte aplicado, nombre y avatar de la cuenta y el texto cortado como en la red ("... más"). El video se reproduce simulando el recorte con CSS. Son aproximaciones propias, no copias exactas de cada app.

### 8.6 Publicar

"Publicar ahora" o "Programar" con fecha y hora en la zona horaria configurada. Un resumen agrupa errores (bloquean) y advertencias (requieren confirmación). Al confirmar se redirige al calendario con la publicación resaltada. Una publicación se puede editar hasta que algún destino pase a `publicando`.

### 8.7 Calendario

- FullCalendar (edición MIT), vistas mensual y semanal, con las variables de color del sistema de diseño.
- Cada evento es una publicación con íconos de sus redes coloreados por estado. Las publicaciones en estado `idea` aparecen como marcadores con estilo distinto.
- Arrastrar: en la vista mensual cambia el día y conserva la hora; en la semanal se mueve en intervalos de 15 minutos. No se permite arrastrar al pasado ni mover publicaciones ya publicadas o en curso. Mover actualiza en una transacción todos los destinos sin hora propia y los vuelve a programar.
- Clic en un evento abre `/publicaciones/[id]`.
- Un panel junto al calendario lista los borradores sin fecha.

---

## 9. Suite de IA (BYOK)

### 9.1 Principios

- **La IA propone y el usuario decide.** Ninguna salida de IA se programa ni se publica sin aceptación explícita.
- El contenido externo (páginas web, RSS) se trata como información, nunca como instrucciones.
- **El código calcula las cifras; la IA solo las interpreta.**

### 9.2 Llaves, modelos y consumo

- La llave se envía a la función invocable `ia`, que la valida consultando la lista de modelos del proveedor. Si es válida se guarda cifrada en `secrets` y `settings/app.ai.keys` guarda el estado y los últimos 4 caracteres.
- El selector de modelos se llena con esa lista; ningún nombre de modelo queda fijo en el código salvo los valores por defecto.
- Valores por defecto en Anthropic: `claude-opus-5-5`, con esfuerzo `low` para copy, `medium` para guion y plan, `high` para análisis. Se puede elegir otro modelo por tarea (por ejemplo, `claude-sonnet-5-5`).
- Peticiones a Anthropic: salida estructurada (`output_config.format` con esquemas Zod), búsqueda web del servidor (`web_search_20260209`) en las tareas que la usan, caché del prefijo estable (perfil y aprendizajes activos), respuesta en flujo para las tareas interactivas, verificación de `stop_reason` y respaldo del servidor ante rechazos (`fallbacks: "default"`).
- OpenAI se usa con salida estructurada, búsqueda web, TTS y transcripción.
- Capacidades: Anthropic no ofrece TTS ni transcripción; las funciones que los requieren se desactivan sin llave de OpenAI.
- Cada ejecución se registra en `aiRuns` con tokens y costo estimado según `priceTable`.
- Si se define `monthlyBudgetUsd`, las ejecuciones automáticas se detienen al alcanzarlo; las manuales no se bloquean.

### 9.3 Perfil de contenido

`settings/profile` (sección 6.1). Se llena a mano o lo genera la IA a partir de una descripción libre (función invocable `ia`). Se incluye al inicio de cada petición junto con los aprendizajes activos.

### 9.4 Copy por red y fechas clave (fase 4)

- **Fechas clave del Principal:** a partir del título y la descripción del Principal, la IA propone fechas relacionadas con su tema (por ejemplo, para un video sobre la independencia de México, el 15 y 16 de septiembre) como nuevos pendientes de exposición con su `dueAt`; el usuario los acepta uno por uno.


- Una petición por red, en paralelo, cada una con su esquema:
  - YouTube: `{ title, description, tags }`, orientado a búsqueda.
  - TikTok: `{ text, hashtags }`, corto y con gancho.
  - Instagram y Facebook: `{ text, hashtags }`, conversacional.
- Entrada: texto base o notas, datos del archivo, los 3 fotogramas como imágenes, el título del Principal si es Hija y, opcionalmente, la transcripción del audio (OpenAI).
- La salida se valida con Zod y con las reglas de la red; si excede un límite, se reintenta una vez indicando el error.
- Cada propuesta aparece en cuanto termina su red, con "Aceptar" (escribe en los campos del destino) y "Otra versión".

### 9.5 Descubrimiento (fase 6)

`descubrirTendencias`, diaria:

1. Fuentes: RSS configurados; lo más popular de YouTube por región y categoría (llave pública de Google); búsquedas web del modelo con consultas derivadas de los pilares, opcionalmente limitadas a dominios.
2. Eliminación de duplicados.
3. Evaluación estructurada de cada tema: afinidad, viralidad, frescura y facilidad de producción (0 a 10) y un total ponderado.
4. Se guardan en `trends` con caducidad de 7 días.

La vista `/tendencias` permite aceptar (crea una idea de plan) o descartar.

### 9.6 Planificación, guion y creación asistida (fase 6)

- **Plan:** a partir de tendencias aceptadas, pilares, frecuencia y aprendizajes activos, la IA genera `plans/{id}` con propuestas (título, gancho, formato, redes, fecha sugerida, estructura). Aceptar una propuesta crea una publicación en estado `idea`, visible en el calendario.
- **Guion:** para una idea, la IA genera `Script = { hook, sections: { title, durationSec, content }[], cta, visualNotes: string[], promptVersion, generatedAt }`.
- **Locución:** `generarLocucion` convierte el guion en audio (OpenAI TTS) y lo guarda como `asset` con `source: 'tts'`.
- **Sugerencias de imágenes:** se incluyen en `visualNotes`, solo en texto.

### 9.7 Análisis y aprendizaje (fase 6)

`analizarRendimiento`, semanal:

1. El código calcula promedios por pilar, formato, red, día y hora, vistas a 24 h / 7 d / 30 d y el impulso Padre/Hijo.
2. La IA recibe esas cifras y devuelve aprendizajes estructurados (`insights`).
3. Los aprendizajes activos se incluyen en las peticiones de copy y planificación. El usuario puede archivarlos.
4. Con menos de 10 publicaciones con métricas no se generan; se muestra "datos insuficientes".

### 9.8 Errores de IA

| Caso | Comportamiento |
|---|---|
| Llave inválida (401) | Se marca `invalida` y aparece un aviso en Ajustes. |
| Límite de peticiones o caída (429 / 5xx) | Reintentos del SDK; en tareas automáticas, reintento en la siguiente ejecución. |
| Rechazo del modelo | Respaldo del servidor; si persiste, mensaje claro y `aiRuns.status = 'rechazo'`. |
| Salida inválida | Un reintento con el error; si persiste, mensaje de error y nada se guarda. |

---

## 10. Estadísticas y análisis Padre/Hijo (fase 5)

### 10.1 Métricas por red

| Red | Métricas |
|---|---|
| YouTube | Vistas, likes, comentarios, minutos vistos, duración media, suscriptores ganados, fuentes de tráfico (búsqueda, sugeridos, Shorts, externas por dominio) |
| Instagram | Alcance, reproducciones, likes, comentarios, compartidos, guardados |
| Facebook | Alcance, reproducciones, reacciones, comentarios, compartidos |
| TikTok | Reproducciones, likes, comentarios, compartidos |

Se normalizan a `NormalizedMetrics`. Tasa de interacción = (likes + comentarios + compartidos + guardados) / (alcance, o vistas si no hay alcance). Las comparaciones entre redes se marcan como indicativas.

### 10.2 Sincronización

| Antigüedad | Frecuencia |
|---|---|
| < 7 días | Cada 6 horas |
| 7 a 90 días | Diaria |
| 90 días a 1 año | Semanal |
| > 1 año | Se detiene |

Se guarda el valor más reciente en el destino y una captura diaria en `snapshots`. Con las capturas se calculan las vistas a 24 h, 7 d y 30 d. Cada día se guardan los seguidores por cuenta. Un fallo de sincronización no afecta lo demás; la interfaz muestra la última sincronización y avisa si los datos tienen más de 24 horas.

### 10.3 Dashboard

- Filtros: rango de fechas, red, formato, pilar, tipo.
- Indicadores: publicaciones, vistas, interacciones, tasa de interacción, variación de seguidores.
- Gráficos: vistas en el tiempo por red, rendimiento por formato y por pilar, mapa de calor por día y hora.
- Tabla de mejores publicaciones, ordenable.

### 10.4 Padre/Hijo

En `/publicaciones/[id]` de un Principal:

- Métricas del Principal y de cada Hija; suma de vistas de las Hijas por red; qué fragmentos ya se publicaron.
- Gráfico diario de vistas del Principal con marcas en las fechas de publicación de cada Hija y su tráfico externo por dominio.
- Las vistas diarias y el tráfico por día del Principal se obtienen de YouTube Analytics con la dimensión día, no de las capturas, cuya frecuencia baja con la antigüedad.
- **Impulso estimado** por Hija: `(vistas promedio diarias del Principal en las 48 h posteriores) / (promedio diario de los 7 días previos) − 1`. Se presenta como estimación de coincidencia, no de causalidad. Requiere al menos 7 días de historial previo; si no, se muestra "historial insuficiente".
- El tráfico de "video relacionado" de los Shorts se incluye solo si la API lo expone.

En `/estadisticas`, la sección Padre/Hijo lista los Principales con número de Hijas, vistas aportadas e impulso promedio.

---

## 11. Seguridad

- **Acceso:** Firebase Auth con Google. `antesDeCrearUsuario` rechaza cualquier correo distinto al configurado (parámetro `ALLOWED_EMAIL` de Functions) o sin verificar, y asigna el claim `owner`; `antesDeIniciarSesion` repite la verificación en cada inicio de sesión. Reglas de Firestore y Storage: lectura y escritura solo con el claim `owner`; `secrets` sin acceso desde el cliente. Las funciones invocables exigen en cada llamada un token de Firebase con el claim `owner`.
- **Cifrado:** AES-256-GCM con llave en Secret Manager; `keyVersion` permite rotarla.
- **Secretos de la aplicación** (credenciales de las apps de Meta, Google y TikTok, llave de cifrado): Secret Manager.
- **Archivos:** privados; acceso mediante enlaces firmados de corta duración.
- **Registros:** nunca incluyen llaves ni accesos (filtro de redacción).
- **Requisitos de las redes:** página `/privacidad` y ruta de solicitud de borrado de datos de Meta.

---

## 12. Pruebas

| Capa | Tipo | Qué cubre |
|---|---|---|
| `packages/core` | Unitarias (Vitest), escritas antes del código | Reglas por red, combinación de ajustes, máquinas de estados, cálculo de recortes (dimensiones pares para ffmpeg), normalización de métricas, impulso estimado, retención. |
| `packages/platforms` | Contrato con respuestas HTTP grabadas | Cada etapa de publicación, clasificación de errores, continuación desde el `checkpoint`, `findExisting`, `parsePublicUrl`. |
| `packages/ai` | Proveedores simulados | Validación de esquemas, reintento por salida inválida, registro en `aiRuns`, copia de referencia de cada prompt. |
| Funciones y reglas | Integración con el Emulator Suite de Firebase | Funciones invocables llamadas con el SDK cliente, toma de tareas con versión y `lease`, encolado, retención, reglas de seguridad (`@firebase/rules-unit-testing`). La lógica de las funciones programadas se prueba importándola con Firestore y Storage del emulador. |
| Aplicación | Extremo a extremo (Playwright) sobre emuladores | Subir → canvas → programar → mover en el calendario → pendiente manual → marcar publicada. |

Las pruebas automáticas no hacen llamadas reales a las redes ni a los proveedores de IA. Cuando se aprueba cada app de red se ejecuta una lista de verificación manual documentada.

---

## 13. Despliegue y operación

- **Ambientes:** un proyecto de Firebase (producción) y emuladores locales.
- **CI (GitHub Actions):** formato, lint, tipos, pruebas unitarias, pruebas con emuladores y compilación en cada push.
- **Despliegue:** Vercel publica la web al actualizar `main` y crea una vista previa por cada pull request. Las funciones, reglas e índices se despliegan desde GitHub Actions con una cuenta de servicio.
- **Monitoreo:** registros estructurados en Cloud Logging, Error Reporting, notificaciones push de fallos y alertas de presupuesto en la facturación.
- **Guía de configuración** (`docs/configuracion.md`), con lo que el usuario debe crear y en qué fase:

| Elemento | Fase |
|---|---|
| Proyecto de Firebase en plan Blaze con alerta de presupuesto; Authentication con Identity Platform; proyecto de Vercel conectado al repositorio | 1 |
| Llave VAPID de Cloud Messaging, correo de contacto para `/privacidad` y permisos de Cloud Tasks y Cloud Messaging para las funciones | 2A |
| App de Google Cloud para YouTube (pantalla de consentimiento "En producción") | 2B |
| App de Meta (Facebook Login for Business; Instagram Business vinculada a la página) | 2B |
| App de TikTok (Login Kit + Content Posting API); verificación de dominio solo para fotos | 2B |
| Llaves de Anthropic y OpenAI | 4 |
| Llave pública de Google para YouTube (tendencias) | 6 |

---

## 14. Fases de entrega

Cada fase tendrá su propio plan de implementación. Una fase termina cuando se cumplen sus criterios de aceptación con las pruebas en verde.

| Fase | Contenido | Criterios de aceptación |
|---|---|---|
| 1. Fundación | Monorepo, CI, configuración de Firebase, acceso restringido, estructura de la interfaz (español, tema neoclásico), Ajustes generales, subida reanudable, `procesarArchivo`, biblioteca de archivos, reglas de seguridad. | Solo el correo permitido entra. Un video de 2 GB se sube, se reanuda tras cortar la conexión y muestra sus datos técnicos y 3 fotogramas. Las reglas impiden leer `secrets` desde el cliente. |
| 2A. Publicación asistida | Modelo de publicaciones y destinos, editor básico (archivo, destinos, textos, campos de YouTube, hora, jerarquía), función `publicaciones`, cola y `publicarDestino` en modo manual, modo asistido con notificaciones push, referencia al Padre manual, calendario con arrastrar y soltar, retención, `/privacidad` con instrucciones de borrado de datos. | Una publicación programada a 4 redes en modo manual llega a `/pendientes` con notificación y se marca publicada con su URL. Mover una publicación en el calendario no la duplica. Una Hija publicada antes que su Principal recibe su referencia al publicarse este. |
| 2B. Conectores y promoción | Conexiones con lectura y publicación separadas, OAuth de Meta, YouTube y TikTok, conectores de las 4 redes con publicación por etapas, `comentarReferencia`, `renovarSesiones`, `media`, interfaz de publicación de TikTok (7.4.1), borrado de datos de Meta, importar un Principal desde YouTube, lista de promoción del Principal (6.10), retención de 0 días. | Con una red conectada por API se publica de punta a punta. Un Principal importado desde YouTube recibe su lista de promoción y avisos al vencer. Las verificaciones V1 a V3 quedan resueltas. |
| 3. Smart Canvas | Pasos completos de creación, advertencias, zonas seguras, recorte con `generarRecorte`, ajustes por red, vista previa final. | Un video 16:9 recortado a 9:16 para TikTok y 1:1 para Facebook genera dos archivos distintos y cada red publica el suyo. Las advertencias del canvas coinciden con las validaciones del servidor. |
| 4. IA de texto | Ajustes de IA, validación y cifrado de llaves, perfil de contenido, copy por red en paralelo, transcripción opcional, `aiRuns` y límite mensual. | Con una llave válida se generan versiones por red que respetan los límites y se aceptan una por una. Una llave inválida se detecta al guardarla. |
| 5. Estadísticas | `sincronizarMetricas`, capturas diarias, seguidores, dashboard, análisis Padre/Hijo. | El dashboard muestra métricas reales de al menos una red conectada y el impulso estimado de un Principal con historial suficiente. |
| 6. IA avanzada | Tendencias, planificación (estado `idea`), guiones, locución, análisis y aprendizajes. | Una tendencia aceptada produce una idea en el calendario; una idea genera guion y locución; con 10 o más publicaciones con métricas se generan aprendizajes con evidencia numérica. |

---

## 15. Puntos a verificar durante la implementación

Cada punto tiene definido su comportamiento si la verificación resulta negativa.

| # | Punto | Fase | Si resulta negativo |
|---|---|---|---|
| V1 | ¿Lo publicado por la app de Meta en modo desarrollo es visible públicamente? Resultado (documentación, 2026-10-08): no, solo lo ven las personas con rol en la app. | 2B | Facebook e Instagram por API solo con la app en modo Live; si exige App Review, modo manual hasta la aprobación. |
| V2 | ¿TikTok permite enviar a la bandeja de borradores y leer métricas sin auditoría? Resultado (documentación): sin auditoría solo publica como `SELF_ONLY` en cuentas privadas; la bandeja de borradores no se implementa. | 2B / 5 | Publicación manual; TikTok sin métricas hasta la auditoría. |
| V3 | Límites vigentes de cada red (tabla 7.4) y nombres vigentes de las métricas de Meta. Resultado: límites verificados el 2026-10-08 (sección 7.4); métricas en la fase 5. | 2B / 5 | Se ajustan los datos en `core/rules` y en el conector. |
| V4 | ¿YouTube Analytics expone el tráfico de "video relacionado" de los Shorts? | 5 | Se omite esa métrica. |
| V5 | Cuota gratuita vigente del plan Blaze para Storage y Functions. | 1 | Se ajusta `retentionDays` y la alerta de presupuesto. |

---

## 16. Referencias

- **Postmill** (`postmill-ai/postmill-app`, AGPL-3.0): consultado como referencia de arquitectura (conectores por red, calendario, BYOK). No se copia su código, para no heredar la licencia AGPL.
- **Easel** (`ZJU-REAL/Easel`, Apache-2.0): consultado como referencia conceptual (ciclo Descubrir → Planificar → Crear → Publicar → Aprender, perfiles con memoria, esquema de puntuación de temas). Los prompts de OmniStream se escriben desde cero en español.
- **PRD original:** "OmniStream — Plataforma Automatizada de Gestión de Redes Sociales".
