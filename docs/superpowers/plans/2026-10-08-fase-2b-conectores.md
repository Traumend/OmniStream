# Fase 2B (Conectores y promoción): plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: usar superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para implementar este plan tarea por tarea. Los pasos usan casillas (`- [ ]`) para el seguimiento.

**Objetivo:** conectar Facebook, Instagram, YouTube y TikTok por OAuth y publicar por API de punta a punta, por etapas y con continuación desde el `checkpoint`. También: comentar la referencia al Principal por API, renovar los accesos, mostrar la interfaz de publicación que exige TikTok y atender el borrado de datos de Meta. Ninguna red pierde el modo manual: el modo de publicación se elige por red. Además (D17–D19): importar un Principal desde YouTube sin subir el archivo, la lista de promoción de cada Principal (shorts, Comunidad, exposición) con fechas relativas y avisos, y la retención de 0 días (el video se borra al publicarse).

**Arquitectura:** el nuevo paquete `packages/platforms` contiene los conectores de red. Son funciones puras sobre un `fetch` inyectado y no dependen de Firebase:
- `OAuthProvider` por proveedor: `meta`, `youtube`, `tiktok`.
- `PlatformAdapter` por red, con `publishStep`, `findExisting` y `postComment`.

`functions` agrega:
- La invocable `conexiones` y la HTTP `retornoConexion`, que inician y completan OAuth y guardan la sesión cifrada (AES-256-GCM) en `secrets/{proveedor}`.
- Las funciones que usan esa sesión: `publicarDestino` (ahora también por API), `comentarReferencia`, `renovarSesiones`, `media` y `borradoDatosMeta`.

`core` concentra las decisiones puras: modo efectivo por red y formato, permisos, límites por API, campos de TikTok, destino efectivo y avisos. La web suma Ajustes > Conexiones, la sección de TikTok del editor y reescrituras de Vercel `/api/*` hacia las funciones HTTP.

**Stack:** lo de las fases 1 y 2A más Graph API de Meta `v26.0`, YouTube Data API v3 con subida reanudable, TikTok Login Kit y Content Posting API (Direct Post), `defineSecret` de Firebase (Secret Manager) y `node:crypto` (AES-256-GCM y HMAC-SHA256).

**Spec:** `docs/superpowers/specs/2026-10-07-omnistream-design.md`: secciones 2.1 (D8, D11, D15, D16), 4, 5.2, 5.4, 5.6, 6.2, 6.4, 6.7, 7.1, 7.2, 7.3, 7.4, 7.4.1, 7.5, 7.6, 11, 12, 13, la fila 2B de la sección 14 y la sección 15 (V1 a V3).

## Restricciones globales

- **Lo que ya rige:** las restricciones de las fases 1 y 2A:
  - Node.js ≥ 22 y solo pnpm.
  - TypeScript `strict` con `noUncheckedIndexedAccess`.
  - Español neutro sin voseo, locale `es-419`.
  - Región `us-central1` y proyecto de emuladores `demo-omnistream`.
  - Commits en español con prefijo convencional.
  - El cliente nunca escribe `posts`, `targets`, `attempts`, `notifications` ni `connections`.
- **Sin red real en las pruebas.** Ninguna prueba llama a las redes reales. Todo HTTP de los conectores pasa por un `fetch` inyectado (`Http = typeof fetch`). Las pruebas de `packages/platforms` usan intercambios grabados (`fetchGrabado`), y las de funciones usan conectores falsos.
- **Tokens:** nunca van a los registros ni a mensajes de error. Solo se guardan cifrados en `secrets/{meta|youtube|tiktok}`. `secrets`, `oauthStates` y `dataDeletions` son inaccesibles desde el cliente.
- **Versiones y endpoints:**
  - Graph API de Meta: `v26.0`, en una sola constante `VERSION_GRAPH`.
  - Endpoints de YouTube: `https://oauth2.googleapis.com/token`, `https://accounts.google.com/o/oauth2/v2/auth`, `https://www.googleapis.com/upload/youtube/v3/...` y `https://www.googleapis.com/youtube/v3/...`.
  - Endpoints de TikTok: `https://www.tiktok.com/v2/auth/authorize/` y `https://open.tiktokapis.com/v2/...`.
- **Redirección de OAuth:** `{URL_PUBLICA}/api/conexiones/retorno`, una para todos los proveedores. El `state` identifica al proveedor, dura 10 minutos y se usa una sola vez.
- **Tareas de cola:**
  - Una continuación usa el id `{postId}-{red}-v{scheduleVersion}-c{seq}`.
  - Una referencia usa `{postId}-{red}-ref-v{scheduleVersion}`.
  - Se conservan los ids de la 2A.
- **Ejecución de `publicarDestino`:** presupuesto de 25 min (el límite es 1.800 s) y memoria de 1 GiB.
- **Mensajes:** los que ve el usuario están en español y los fija este plan. Los textos de error de las redes (en inglés) solo se anexan después de un prefijo en español.

## Decisiones de este plan (rulings; la Tarea 1 actualiza la spec)

1. **Interfaz de los conectores dividida.** La interfaz de 5.2 se divide en `OAuthProvider` (por proveedor) y `PlatformAdapter` (por red), porque un solo inicio de sesión de Meta crea dos conexiones (6.2). `postComment` devuelve `{ id }`: Instagram no da URL del comentario. `PublishContext` lleva `reanudando: boolean`. `fetchMetrics` y `fetchFollowers` quedan para la fase 5.
2. **TikTok web sin PKCE.** La documentación de Login Kit for Web no usa PKCE: `code_verifier` es solo para móvil y escritorio. La protección es el `state` del servidor, de un solo uso.
3. **Meta conecta una sola página.** Si el diálogo devuelve 0 o varias páginas, la conexión falla con un mensaje claro. Facebook e Instagram usan el token de página, que no caduca.
4. **Nuevo estado `publicando` en la referencia.** `parentRef.status` suma `'publicando'` (comentario por API en cola) y `parentRef.error`. Si el comentario falla, la referencia vuelve a `'pendiente'` (modo manual en `/pendientes`) con aviso push. El valor `'fallida'` queda sin uso.
5. **Comentar por API exige tres condiciones:** conexión `conectada`, modo `api` y el permiso de comentar.
6. **`checkpoint.seq`.** El `checkpoint` lleva `seq`, que sube en cada paso guardado; da el id único de cada continuación. Un paso que pide esperar libera el `lease` y encola la continuación con `scheduleTime`.
7. **Modo efectivo por red y formato:** `api` solo si la conexión está `conectada`, en modo `api` y con el permiso de publicar de la red. Además, en TikTok imagen, solo con `mediaVerified`: el dominio de `/api/media/` está verificado en TikTok, un campo nuevo de la conexión.
8. **Límites por API (V3, verificados el 2026-10-08)** en `core` (`LIMITES_API`); se aplican solo a destinos en modo API.
   - Facebook imagen: ≤ 10 MB; JPEG, PNG, GIF, BMP o TIFF.
   - Instagram Reel: ≤ 300 MB.
   - Instagram imagen: ≤ 8 MB, solo JPEG.
   - TikTok video: ≤ 4 GB y ≤ 10 min.
   - TikTok foto: ≤ 20 MB; JPEG o WEBP.
   - La descripción de YouTube se mide en bytes (≤ 5.000).
   - Instagram admite ≤ 20 menciones.
9. **Avisos nuevos.** Aviso `conexion`: "Reconecta {Red}", con enlace a `/ajustes/conexiones` y un id por red y por día. Al terminar una publicación por API en TikTok, el detalle avisa que puede tardar unos minutos en verse, como exigen las pautas de TikTok.
10. **Secretos en el emulador.** El emulador lee `functions/.secret.local`, que genera `scripts/secretos-demo.cjs` con valores de demostración. Ese archivo se ignora en git y en el despliegue.
11. **Resultado de las verificaciones (sección 15):**
    - **V1:** según la documentación de Meta, lo publicado con la app en modo desarrollo solo lo ven las personas con rol en la app. Facebook e Instagram se usan por API solo con la app en modo Live; mientras tanto, modo manual.
    - **V2:** sin auditoría, TikTok solo publica como `SELF_ONLY` y en cuentas privadas, así que TikTok queda en modo manual hasta la auditoría. La bandeja de borradores (`video.upload`) no se implementa.
    - **V3:** queda resuelta con el punto 8.
12. **Importar un Principal desde YouTube (D18):**
    - Solo se acepta un video del canal conectado (`snippet.channelId` igual al de la sesión).
    - El post importado usa el id `yt-{videoId}`, así importarlo dos veces falla con un mensaje claro en vez de duplicarlo.
    - Un video programado o privado deja las referencias de sus Hijas en espera. Se activan cuando pasa `publishAt`: un campo `awaitingPublicationUntil` y la revisión horaria de `encolarPendientes`.
13. **Promoción del Principal (D19, spec 6.10):**
    - Los avisos de vencido salen de `encolarPendientes`, así no se agrega una cuarta tarea programada y el plan sigue dentro de las 3 gratuitas de Cloud Scheduler.
    - Una Hija cumple el siguiente short pendiente la primera vez que alguno de sus destinos queda `publicada`.
14. **Retención de 0 días (D17):**
    - `retentionDays` admite 0 y vale 0 por defecto.
    - Con 0, `alCambiarDestino` purga el original en cuanto todos los destinos que lo usan quedan terminales; `limpiarRetencion` sigue como red de seguridad diaria.

## Foco de revisión

1. **Continuación, reintento o recuperación que llega después de publicar, o con el destino tomado por otro intento:** no debe publicar dos veces. La toma transaccional decide, y un `lease` perdido detiene el ciclo sin escribir. Prueba en la Tarea 11.
2. **Caída entre una llamada a la red y el guardado del `checkpoint`:**
   - Al reanudar, YouTube consulta cuántos bytes recibió.
   - Una sesión de subida vencida (404 en YouTube; 403 o 416 en TikTok) reinicia la subida.
   - Un paso final sin respuesta es `ambiguo` y pasa por `findExisting` antes de repetir.

   Pruebas en las Tareas 4, 7 y 11.
3. **Renovación de accesos:** TikTok entrega un nuevo token de actualización en cada renovación y hay que guardarlo. Un acceso revocado marca expiradas todas las redes del proveedor y avisa una sola vez por día. Pruebas en la Tarea 9.
4. **`state` de OAuth reutilizado, vencido o inventado, y cancelación en el proveedor:** no se guarda ningún acceso y se vuelve a Conexiones con un mensaje claro. Pruebas en la Tarea 10.
5. **Secretos en reposo y en tránsito:**
   - El documento de `secrets` no contiene el token en claro.
   - Las reglas niegan `secrets`, `oauthStates` y `dataDeletions`.
   - `signed_request` de Meta y los tokens de `/api/media/` se verifican con HMAC y caducan.

   Pruebas en las Tareas 8, 10 y 13.
6. **Fecha base de la promoción que cambia** (se mueve el Principal o se publica antes de lo previsto): los `dueAt` no editados se recalculan, los editados se conservan y un pendiente ya avisado no vuelve a avisar salvo que su fecha cambie. Pruebas en las Tareas 16 y 17.

## Estructura de archivos

```
packages/core/src/
  index.ts                                (+ export de conexiones)
  conexiones/index.ts
  conexiones/tipos.ts                     Proveedor, Conexion, leerConexion, permisos, InfoCreadorTiktok, privacidades
  conexiones/modos.ts                     modoDePublicacion(conexion, formato), puedePublicarPorApi, puedeComentarPorApi, mensajePermisoFaltante
  conexiones/entrada.ts                   accionConexionSchema, RespuestaConexiones
  publicaciones/tipos.ts                  (+ CamposTiktok, Destino.tiktok, checkpoint.seq, parentRef 'publicando' y error)
  publicaciones/conversion.ts             (+ tiktok en leerDestino y destinoNuevo)
  publicaciones/entrada.ts                (+ camposTiktokSchema en el destino)
  publicaciones/cola.ts                   (+ idContinuacion, idReferencia; modoDePublicacion se mueve a conexiones)
  publicaciones/avisos.ts                 (+ 'conexion', avisoConexion)
  publicaciones/reglas.ts                 (+ LIMITES_API, descripción de YouTube en bytes)
  publicaciones/validacion.ts             (+ modos, límites por API, TikTok, menciones de Instagram)
  publicaciones/efectivo.ts               destinoEfectivo
packages/platforms/                       paquete nuevo @omnistream/platforms
  src/index.ts, src/tipos.ts, src/errores.ts, src/http.ts, src/particion.ts
  src/youtube.ts, src/meta.ts, src/facebook.ts, src/instagram.ts, src/tiktok.ts
  src/prueba/fetchGrabado.ts              solo para pruebas
functions/src/
  config.ts                               (+ parámetros y secretos)
  conexiones/cifrado.ts, conexiones/secretos.ts, conexiones/proveedores.ts
  conexiones/sesiones.ts                  sesionVigente, marcarExpirada, renovarSesiones
  conexiones/conexiones.ts                despacharConexion, completarConexion, conexiones, retornoConexion
  conexiones/media.ts                     firmarTokenMedia, verificarTokenMedia, servirMedia, media
  conexiones/borradoDatosMeta.ts          verificarSignedRequest, borrarDatosMeta, borradoDatosMeta
  publicacion/fuentes.ts                  fuenteDeStorage, fuentesDePublicacion
  publicacion/porApi.ts                   avanzarPorApi
  publicacion/publicarDestino.ts          (+ rama API, continuaciones)
  publicacion/comentarReferencia.ts       ejecutarReferencia, comentarReferencia
  publicacion/alCambiarDestino.ts         (+ referencia por API)
  publicacion/firestore.ts                (+ leerModos por formato, leerConexionDe)
  publicacion/acciones/{guardar,programar,cierre}.ts  (+ tiktok, modos en la validación, 'publicando')
scripts/secretos-demo.cjs                 escribe functions/.secret.local para el emulador
firestore.rules                           (+ oauthStates, dataDeletions)
apps/web/
  next.config.ts                          (+ reescrituras /api/*)
  src/lib/reescrituras.ts                 reescrituras(base)
  src/app/(app)/ajustes/layout.tsx        pestañas General y Conexiones
  src/app/(app)/ajustes/conexiones/page.tsx
  src/lib/conexiones/{repositorio,acciones,useInfoCreadorTiktok}.ts
  src/components/conexiones/TarjetaConexion.tsx
  src/components/publicaciones/SeccionTiktok.tsx
  src/app/(publico)/privacidad/page.tsx   (+ aviso de borrado completado)
  e2e/fase2b.spec.ts
docs/configuracion.md, README.md, .github/workflows/desplegar.yml
```

---

### Tarea 1: Dominio de conexiones y campos de TikTok en core (y actualización de la spec)

**Archivos:**
- Crear: `packages/core/src/conexiones/{index,tipos,modos,entrada}.ts` y sus pruebas `{tipos,modos,entrada}.test.ts`
- Modificar: `packages/core/src/publicaciones/{tipos,conversion,entrada,cola,avisos}.ts` (+ pruebas), `packages/core/src/index.ts`, `functions/src/publicacion/firestore.ts` (import de `modoDePublicacion`), `docs/superpowers/specs/2026-10-07-omnistream-design.md`

**Interfaces:**
- Produce (core):
  ```ts
  export const PROVEEDORES = ['meta', 'youtube', 'tiktok'] as const;
  export type Proveedor = (typeof PROVEEDORES)[number];
  export const REDES_DE_PROVEEDOR: Record<Proveedor, readonly Platform[]>; // meta: facebook, instagram
  export const ETIQUETAS_PROVEEDOR: Record<Proveedor, string>;             // 'Meta', 'YouTube', 'TikTok'
  export function proveedorDe(red: Platform): Proveedor;
  export type EstadoConexion = 'sin_conectar' | 'conectada' | 'expirada' | 'error';
  export const ETIQUETAS_ESTADO_CONEXION: Record<EstadoConexion, string>;  // 'Sin conectar', 'Conectada', 'Acceso vencido', 'Error'
  export interface CuentaRed { id: string; name: string; handle?: string; avatarUrl?: string }
  export interface Conexion {
    platform: Platform; authStatus: EstadoConexion; readEnabled: boolean; publishMode: ModoPublicacion;
    account?: CuentaRed; scopes: string[]; tokenExpiresAt?: Date; lastMetricsSyncAt?: Date;
    lastError?: { code: string; message: string; at: Date }; mediaVerified?: boolean;
  }
  export function leerConexion(platform: Platform, datos: unknown): Conexion; // sin datos: sin_conectar, manual, readEnabled false, scopes []
  export const PERMISO_PUBLICAR: Record<Platform, string>;
  //   facebook 'pages_manage_posts', instagram 'instagram_content_publish',
  //   youtube 'https://www.googleapis.com/auth/youtube.upload', tiktok 'video.publish'
  export const PERMISO_COMENTAR: Record<Exclude<Platform, 'tiktok'>, string>;
  //   facebook 'pages_manage_engagement', instagram 'instagram_manage_comments',
  //   youtube 'https://www.googleapis.com/auth/youtube.force-ssl'
  export function puedePublicarPorApi(c: Conexion): boolean;  // conectada y con PERMISO_PUBLICAR
  export function modoDePublicacion(c: Conexion | null | undefined, formato?: FormatoDestino): ModoPublicacion;
  export function puedeComentarPorApi(c: Conexion | null | undefined): boolean;
  export function mensajePermisoFaltante(red: Platform): string;
  export const PRIVACIDADES_TIKTOK = ['PUBLIC_TO_EVERYONE', 'MUTUAL_FOLLOW_FRIENDS', 'FOLLOWER_OF_CREATOR', 'SELF_ONLY'] as const;
  export type PrivacidadTiktok = (typeof PRIVACIDADES_TIKTOK)[number];
  export const ETIQUETAS_PRIVACIDAD_TIKTOK: Record<PrivacidadTiktok, string>; // 'Todos', 'Amigos', 'Seguidores', 'Solo yo'
  export interface InfoCreadorTiktok {
    nickname: string; username: string; avatarUrl?: string; privacidades: PrivacidadTiktok[];
    comentariosDesactivados: boolean; duetDesactivado: boolean; stitchDesactivado: boolean; duracionMaximaSeg: number;
  }
  export interface CamposTiktok {
    privacy: PrivacidadTiktok | null; allowComments: boolean; allowDuet: boolean; allowStitch: boolean;
    commercial: { enabled: boolean; yourBrand: boolean; brandedContent: boolean };
  }
  export const CAMPOS_TIKTOK_POR_DEFECTO: CamposTiktok; // privacy null y todo en false
  // Destino: + tiktok?: CamposTiktok; checkpoint?: { stage; data; seq: number };
  //          parentRef: { status: EstadoReferencia; remoteCommentId?: string; error?: string }
  // EstadoReferencia: + 'publicando'
  export const camposTiktokSchema: z.ZodType<CamposTiktok>;     // en destinoEntradaSchema: tiktok opcional
  export const accionConexionSchema; // discriminatedUnion 'accion':
  //   { accion: 'iniciar', proveedor } | { accion: 'desconectar', proveedor }
  //   | { accion: 'configurar', platform, publishMode?, readEnabled?, mediaVerified? } | { accion: 'infoCreadorTiktok' }
  export type AccionConexion = z.infer<typeof accionConexionSchema>;
  export interface RespuestaConexiones { url?: string; info?: InfoCreadorTiktok }
  export function idContinuacion(postId: string, red: Platform, version: number, seq: number): string; // `${idTarea(...)}-c${seq}`
  export function idReferencia(postId: string, red: Platform, version: number): string;               // `${postId}-${red}-ref-v${version}`
  export type TipoAviso = 'pendiente_manual' | 'fallo' | 'referencia' | 'conexion';
  export function avisoConexion(red: Platform): Aviso;
  ```

- [ ] **Paso 1: Escribir las pruebas que fallan**

`conexiones/modos.test.ts`:
```ts
const conectada = (red: Platform, extra: Partial<Conexion> = {}): Conexion =>
  ({ ...leerConexion(red, undefined), authStatus: 'conectada', publishMode: 'api', scopes: [PERMISO_PUBLICAR[red]], ...extra });

it('api solo con conexión conectada, modo api y permiso de publicar', () => {
  expect(modoDePublicacion(conectada('youtube'))).toBe('api');
  expect(modoDePublicacion(conectada('youtube', { authStatus: 'expirada' }))).toBe('manual');
  expect(modoDePublicacion(conectada('youtube', { publishMode: 'manual' }))).toBe('manual');
  expect(modoDePublicacion(conectada('youtube', { scopes: [] }))).toBe('manual');
  expect(modoDePublicacion(null)).toBe('manual');
});
it('TikTok imagen por API exige el dominio verificado', () => {
  expect(modoDePublicacion(conectada('tiktok'), 'imagen')).toBe('manual');
  expect(modoDePublicacion(conectada('tiktok', { mediaVerified: true }), 'imagen')).toBe('api');
  expect(modoDePublicacion(conectada('tiktok'), 'tiktok')).toBe('api');
});
it('comentar por API exige modo api y el permiso de comentar; TikTok nunca', () => {
  expect(puedeComentarPorApi(conectada('instagram', { scopes: ['instagram_content_publish', 'instagram_manage_comments'] }))).toBe(true);
  expect(puedeComentarPorApi(conectada('instagram'))).toBe(false);
  expect(puedeComentarPorApi(conectada('tiktok', { scopes: ['video.publish'] }))).toBe(false);
});
it('mensaje de permiso faltante', () => {
  expect(mensajePermisoFaltante('instagram')).toBe('Falta el permiso para publicar en Instagram. Vuelve a conectar Meta y concédelo.');
});
```

`conexiones/tipos.test.ts`:
- `leerConexion('tiktok', undefined)` es igual a `{ platform: 'tiktok', authStatus: 'sin_conectar', readEnabled: false, publishMode: 'manual', scopes: [] }`.
- Convierte `tokenExpiresAt` y `lastError.at` con `toDate`.
- `proveedorDe('instagram')` es `'meta'`.
- `REDES_DE_PROVEEDOR.meta` es `['facebook', 'instagram']`.

`conexiones/entrada.test.ts`:
- Acepta `{ accion: 'configurar', platform: 'tiktok', mediaVerified: true }`.
- Rechaza `{ accion: 'iniciar', proveedor: 'twitter' }`.

Pruebas en `publicaciones/`:
- `conversion.test.ts`:
  - `leerDestino` conserva `tiktok`.
  - `destinoNuevo('tiktok', 'tiktok', { esHija: false, ahora, tiktok: CAMPOS_TIKTOK_POR_DEFECTO })` lo incluye.
- `entrada.test.ts`:
  - Un destino de TikTok con `tiktok: { ...CAMPOS_TIKTOK_POR_DEFECTO, privacy: 'SELF_ONLY' }` es válido.
  - Con `privacy: 'PRIVADO'` es inválido.
- `cola.test.ts`:
  - `idContinuacion('p1', 'tiktok', 3, 2)` da `'p1-tiktok-v3-c2'`.
  - `idReferencia('p1', 'facebook', 3)` da `'p1-facebook-ref-v3'`.
  - Las pruebas de `modoDePublicacion` se mueven a `conexiones/modos.test.ts`.
- `avisos.test.ts`: `avisoConexion('youtube')` es igual a:
  ```ts
  { tipo: 'conexion', titulo: 'Reconecta YouTube', cuerpo: 'El acceso venció. Vuelve a conectarla para publicar por API.', enlace: '/ajustes/conexiones' }
  ```

- [ ] **Paso 2: Ejecutar y verificar que fallan**

Run: `pnpm vitest run --project core`
Expected: FAIL (módulos y exportaciones inexistentes).

- [ ] **Paso 3: Implementar**

- `modoDePublicacion` se mueve de `publicaciones/cola.ts` a `conexiones/modos.ts` con la nueva firma. `leerModos` de functions pasa a llamar `modoDePublicacion(leerConexion(conexion.id as Platform, conexion.data()))`; la Tarea 11 la hace por formato.
- `leerConexion` usa la misma conversión de fechas que `conversion.ts`.

- [ ] **Paso 4: Actualizar la spec**

En `docs/superpowers/specs/2026-10-07-omnistream-design.md`, aplicar las decisiones 1 a 11 de este plan:
- **5.2:** interfaces `OAuthProvider` y `PlatformAdapter`.
- **5.4:** fila `conexiones` con "Invocable (`conexiones`) y HTTP (`retornoConexion`)"; memoria de `publicarDestino` 1 GiB.
- **6.2:** `mediaVerified?`, contenido cifrado de `secrets/{proveedor}`, colecciones `oauthStates/{state}` y `dataDeletions/{code}`, todas sin acceso del cliente.
- **6.4:** `parentRef.status` con `'publicando'` y `error?`, `checkpoint.seq`, aviso `'conexion'`.
- **7.1:** TikTok web sin PKCE; Meta con una sola página; Graph `v26.0`.
- **7.4:** tabla de límites por API y descripción de YouTube en bytes.
- **7.6:** la referencia que no se pudo comentar vuelve a pendiente.
- **15:** resultado de V1, V2 y V3.

- [ ] **Paso 5: Ejecutar y verificar que pasan**

Run: `pnpm vitest run --project core && pnpm --filter @omnistream/functions typecheck`
Expected: PASS.

- [ ] **Paso 6: Commit**

```bash
git add packages/core functions/src docs/superpowers/specs
git commit -m "feat(core): dominio de conexiones y campos de TikTok"
```

---

### Tarea 2: Límites por API, validación por modo y destino efectivo

**Archivos:**
- Crear: `packages/core/src/publicaciones/efectivo.ts`, `efectivo.test.ts`
- Modificar: `packages/core/src/publicaciones/{reglas,validacion}.ts` (+ pruebas), `publicaciones/index.ts`

**Interfaces:**
- Consume: `CamposTiktok`, `ModoPublicacion` (Tarea 1).
- Produce:
  ```ts
  export interface LimiteApi { tamanoMaxBytes?: number; tiposMime?: readonly string[]; duracionMaxSec?: number }
  export const LIMITES_API: Record<Platform, Partial<Record<FormatoDestino, LimiteApi>>>;
  export function contarBytesUtf8(texto: string): number;
  // ContextoValidacion: + modos?: Partial<Record<Platform, ModoPublicacion>>
  //   asset: + 'mimeType' | 'sizeBytes'; destinos: + 'tiktok'
  export interface DestinoEfectivo {
    platform: Platform; format: FormatoDestino; titulo: string; texto: string; etiquetas: string[];
    youtube?: CamposYoutube; tiktok?: CamposTiktok; duracionSeg?: number;
  }
  export function destinoEfectivo(
    publicacion: Pick<Publicacion, 'title' | 'base'>,
    destino: Pick<Destino, 'platform' | 'format' | 'overrides' | 'youtube' | 'tiktok'>,
    opciones?: { principal?: { title: string; url?: string }; duracionSeg?: number },
  ): DestinoEfectivo;
  ```

Valores de `LIMITES_API`. Los tamaños usan MB decimales: 10 MB = 10_000_000.

| Red / formato | Tamaño máximo | Tipos | Duración máxima |
|---|---|---|---|
| `facebook.imagen` | 10 MB | `image/jpeg`, `image/png`, `image/gif`, `image/bmp`, `image/tiff` | — |
| `instagram.reel` | 300 MB | — | — |
| `instagram.imagen` | 8 MB | `image/jpeg` | — |
| `tiktok.tiktok` | 4_000_000_000 | — | 600 s |
| `tiktok.imagen` | 20 MB | `image/jpeg`, `image/webp` | — |

- [ ] **Paso 1: Escribir las pruebas que fallan**

`validacion.test.ts` (nuevos casos; el contexto base es el de la 2A con `asset` `{ mimeType, sizeBytes }`):
```ts
it('los límites por API solo aplican en modo API', () => {
  const grande = { ...videoVertical, sizeBytes: 400_000_000 };
  const destinos = [{ platform: 'instagram', format: 'reel', overrides: {} }] as const;
  expect(errores({ asset: grande, destinos })).toEqual([]);
  expect(errores({ asset: grande, destinos, modos: { instagram: 'api' } }))
    .toContain('Instagram por API admite archivos de hasta 300 MB.');
});
it('Instagram imagen por API solo JPEG', () => {
  expect(errores({ asset: { ...imagenCuadrada, mimeType: 'image/png' }, destinos: [ig('imagen')], modos: { instagram: 'api' } }))
    .toContain('Instagram por API solo admite imágenes JPEG.');
});
it('Facebook imagen por API: tipos admitidos', () => {
  expect(errores({ asset: { ...imagenCuadrada, mimeType: 'image/webp' }, destinos: [fb('imagen')], modos: { facebook: 'api' } }))
    .toContain('Facebook por API solo admite imágenes JPEG, PNG, GIF, BMP o TIFF.');
});
it('TikTok video por API: hasta 10 minutos', () => {
  expect(errores({ asset: { ...videoVertical, durationSec: 601 }, destinos: [tt()], modos: { tiktok: 'api' } }))
    .toContain('TikTok por API admite videos de hasta 10:00.');
});
it('TikTok por API exige privacidad y declarar bien el contenido comercial', () => {
  const sinPrivacidad = tt({ tiktok: CAMPOS_TIKTOK_POR_DEFECTO });
  expect(errores({ destinos: [sinPrivacidad], modos: { tiktok: 'api' } })).toContain('Elige quién puede ver la publicación en TikTok.');
  expect(errores({ destinos: [sinPrivacidad] })).toEqual([]); // en manual no se exige
  const comercialVacio = tt({ tiktok: { ...CAMPOS_TIKTOK_POR_DEFECTO, privacy: 'PUBLIC_TO_EVERYONE', commercial: { enabled: true, yourBrand: false, brandedContent: false } } });
  expect(errores({ destinos: [comercialVacio], modos: { tiktok: 'api' } }))
    .toContain('Indica si el contenido comercial promociona tu marca, a un tercero o a ambos.');
  const marcaPrivada = tt({ tiktok: { ...CAMPOS_TIKTOK_POR_DEFECTO, privacy: 'SELF_ONLY', commercial: { enabled: true, yourBrand: false, brandedContent: true } } });
  expect(errores({ destinos: [marcaPrivada], modos: { tiktok: 'api' } }))
    .toContain('El contenido de marca no puede ser privado en TikTok.');
});
it('la descripción de YouTube se mide en bytes', () => {
  const desc = 'á'.repeat(2501); // 2.501 caracteres, 5.002 bytes
  expect(errores({ destinos: [yt({ youtube: { ...CAMPOS_YOUTUBE_POR_DEFECTO, description: desc } })] }))
    .toContain('YouTube: la descripción pasa de 5.000 bytes (los acentos y emojis ocupan más de uno).');
});
it('Instagram admite hasta 20 menciones', () => {
  const texto = Array.from({ length: 21 }, (_, i) => `@cuenta${i}`).join(' ');
  expect(errores({ base: { text: texto, hashtags: [] }, destinos: [ig('reel')] }))
    .toContain('Instagram admite hasta 20 menciones (@) por publicación.');
});
```

`efectivo.test.ts`:
- **YouTube:** usa `overrides.title ?? title`, la descripción compuesta y `etiquetas` = `youtube.tags`.
- **Hija en TikTok con principal `{ title: 'Video largo', url: 'https://youtu.be/abcdefghijk' }`:** el texto termina en `'Video completo en YouTube: «Video largo» https://youtu.be/abcdefghijk'`.
- **Instagram:** `titulo` = `publicacion.title`, `etiquetas` = `[]` y `duracionSeg` = el valor recibido.

- [ ] **Paso 2: Ejecutar y verificar que fallan**

Run: `pnpm vitest run --project core`
Expected: FAIL.

- [ ] **Paso 3: Implementar**

- **Mensajes de tipos:** la lista de tipos se escribe con `JPEG`, `PNG`, `GIF`, `BMP`, `TIFF`, `WEBP`, unidas por coma y con " o " antes de la última.
- **Formato de valores:** tamaños con `formatearBytes` y duración con `formatearDuracion`.
- **Descripción de YouTube:** la validación por caracteres se reemplaza por bytes con el mensaje de la prueba.
- **Menciones:** con `/(^|\s)@[\w.]+/g`.

- [ ] **Paso 4: Ejecutar y verificar que pasan**

Run: `pnpm vitest run --project core`
Expected: PASS.

- [ ] **Paso 5: Commit**

```bash
git add packages/core
git commit -m "feat(core): límites por API verificados y destino efectivo"
```

---

### Tarea 3: Paquete platforms: tipos, errores, HTTP y partición

**Archivos:**
- Crear: `packages/platforms/{package.json,tsconfig.json,vitest.config.ts}`, `packages/platforms/src/{index,tipos,errores,http,particion}.ts`, `src/prueba/fetchGrabado.ts`, pruebas `src/{errores,http,particion}.test.ts`
- Modificar: `vitest.config.ts` (raíz: proyecto `packages/platforms`), `functions/package.json` (devDependency `@omnistream/platforms: workspace:*`)

**Interfaces:**
- Produce:
  ```ts
  export type Http = typeof fetch;
  export interface SesionProveedor {
    accessToken: string; refreshToken?: string; expiresAt?: number; refreshExpiresAt?: number; // ms epoch
    datos: Record<string, string>; // meta: pageId, igUserId; youtube: channelId, uploadsPlaylistId; tiktok: openId, username
  }
  export interface ResultadoConexion { sesion: SesionProveedor; scopes: string[]; cuentas: Partial<Record<Platform, CuentaRed>> }
  export interface OAuthProvider {
    proveedor: Proveedor;
    buildAuthUrl(p: { state: string; redirectUri: string }): string;
    exchangeCode(p: { code: string; redirectUri: string }): Promise<ResultadoConexion>;
    refresh(sesion: SesionProveedor): Promise<SesionProveedor>;
  }
  export interface ArchivoFuente {
    size: number; mimeType: string;
    urlFirmada(): Promise<string>;                          // enlace de lectura de 1 hora
    leerRango(inicio: number, finInclusivo: number): Promise<Uint8Array>;
  }
  export interface ContextoLectura { http: Http; sesion: SesionProveedor }
  export interface PublishContext extends ContextoLectura {
    archivo: ArchivoFuente; miniatura?: ArchivoFuente; urlMedia?(): Promise<string>; reanudando: boolean; ahora(): Date;
  }
  export interface Checkpoint { stage: string; data: Record<string, unknown> }
  export type StepResult =
    | { kind: 'continue'; checkpoint: Checkpoint; delaySec?: number }
    | { kind: 'done'; remote: RemoteRef }
    | { kind: 'error'; error: PlatformError };
  export interface PlatformAdapter {
    platform: Platform;
    publishStep(target: DestinoEfectivo, checkpoint: Checkpoint | null, ctx: PublishContext): Promise<StepResult>;
    findExisting(target: DestinoEfectivo, ventana: { desde: Date; hasta: Date }, ctx: ContextoLectura): Promise<RemoteRef | null>;
    postComment(remoteId: string, texto: string, ctx: ContextoLectura): Promise<{ id: string }>;
  }
  export class PlatformError extends Error { constructor(readonly kind: TipoError, readonly code: string, message: string) }
  export interface RespuestaHttp { status: number; headers: Headers; json: unknown; texto: string }
  export async function solicitar(
    http: Http, url: string, init: RequestInit,
    opciones: { red: string; clasificar(r: RespuestaHttp): PlatformError | null; final?: boolean; timeoutMs?: number },
  ): Promise<RespuestaHttp>;
  export const TAMANO_PARTE_YOUTUBE = 64 * 1024 * 1024; // múltiplo de 256 KiB
  export function particionTiktok(size: number): { chunkSize: number; total: number };
  export function rangoDeParte(indice: number, size: number, p: { chunkSize: number; total: number }): { inicio: number; fin: number };
  // prueba/fetchGrabado.ts
  export interface Intercambio {
    metodo: string; url: string | RegExp;
    revisar?(peticion: { cuerpo: string | Uint8Array | undefined; headers: Headers }): void;
    respuesta: { status: number; json?: unknown; texto?: string; headers?: Record<string, string> } | 'sin_respuesta';
  }
  export function fetchGrabado(intercambios: Intercambio[]): Http & { pendientes(): number };
  ```

- [ ] **Paso 1: Escribir las pruebas que fallan**

`http.test.ts`:
```ts
it('devuelve la respuesta cuando clasificar no ve error', async () => {
  const http = fetchGrabado([{ metodo: 'GET', url: 'https://api.test/a', respuesta: { status: 200, json: { ok: 1 } } }]);
  const r = await solicitar(http, 'https://api.test/a', { method: 'GET' }, { red: 'YouTube', clasificar: () => null });
  expect(r.json).toEqual({ ok: 1 });
  expect(http.pendientes()).toBe(0);
});
it('un error de red es temporal y, en el paso final, ambiguo', async () => {
  const http = fetchGrabado([{ metodo: 'POST', url: 'https://api.test/b', respuesta: 'sin_respuesta' }]);
  await expect(solicitar(http, 'https://api.test/b', { method: 'POST' }, { red: 'YouTube', clasificar: () => null }))
    .rejects.toMatchObject({ kind: 'temporal', code: 'red', message: 'No se pudo conectar con YouTube.' });
  const otra = fetchGrabado([{ metodo: 'POST', url: 'https://api.test/b', respuesta: 'sin_respuesta' }]);
  await expect(solicitar(otra, 'https://api.test/b', { method: 'POST' }, { red: 'YouTube', clasificar: () => null, final: true }))
    .rejects.toMatchObject({ kind: 'ambiguo' });
});
it.each([
  [429, { kind: 'temporal' }],
  [503, { kind: 'temporal' }],
  [401, { kind: 'auth', message: 'El acceso a YouTube venció. Vuelve a conectarla.' }],
  [400, { kind: 'definitivo', message: 'YouTube respondió con un error (400).' }],
])('sin clasificación específica, %i', async (status, esperado) => {
  const http = fetchGrabado([{ metodo: 'GET', url: 'https://api.test/c', respuesta: { status, json: {} } }]);
  await expect(solicitar(http, 'https://api.test/c', { method: 'GET' }, { red: 'YouTube', clasificar: () => null }))
    .rejects.toMatchObject(esperado);
});
```
`fetchGrabado` falla la prueba ante una petición inesperada o fuera de orden.

`particion.test.ts`:
```ts
it.each([
  [3_000_000, { chunkSize: 3_000_000, total: 1 }],
  [60_000_000, { chunkSize: 60_000_000, total: 1 }],
  [100_000_000, { chunkSize: 33_554_432, total: 2 }],
])('particionTiktok(%i)', (size, esperado) => expect(particionTiktok(size)).toEqual(esperado));
it('la última parte absorbe el resto', () => {
  expect(rangoDeParte(1, 100_000_000, particionTiktok(100_000_000))).toEqual({ inicio: 33_554_432, fin: 99_999_999 });
});
it('TAMANO_PARTE_YOUTUBE es múltiplo de 256 KiB', () => expect(TAMANO_PARTE_YOUTUBE % 262_144).toBe(0));
```

- [ ] **Paso 2: Ejecutar y verificar que fallan**

Run: `pnpm install && pnpm vitest run --project platforms`
Expected: FAIL.

- [ ] **Paso 3: Implementar**

- **`solicitar`:** usa `AbortSignal.timeout(timeoutMs ?? 60_000)`. Un `fetch` que lanza, o que agota el tiempo, produce `PlatformError(final ? 'ambiguo' : 'temporal', 'red', 'No se pudo conectar con {red}.')`. Primero aplica `clasificar` y después la tabla genérica. El mensaje genérico es `'{red} respondió con un error ({status}).'`; para 401: `'El acceso a {red} venció. Vuelve a conectarla.'`.
- **`particionTiktok`:**
  - `size ≤ 64_000_000` → una sola parte.
  - Si no, partes de `32 * 1024 * 1024` y `total = floor(size / chunkSize)`.
  - Mínimo 5 MiB, máximo 64 MB y última parte ≤ 128 MB, según la documentación de TikTok.

- [ ] **Paso 4: Ejecutar y verificar que pasan**

Run: `pnpm vitest run --project platforms && pnpm -r typecheck`
Expected: PASS.

- [ ] **Paso 5: Commit**

```bash
git add packages/platforms vitest.config.ts functions/package.json pnpm-lock.yaml
git commit -m "feat(platforms): base de los conectores"
```

---

### Tarea 4: Conector de YouTube

**Archivos:**
- Crear: `packages/platforms/src/youtube.ts`, `youtube.test.ts`

**Interfaces:**
- Consume: Tarea 3; `DestinoEfectivo`, `urlVideoYoutube` (core).
- Produce:
  ```ts
  export const ALCANCES_YOUTUBE: readonly string[]; // youtube.upload, youtube.force-ssl, youtube.readonly, yt-analytics.readonly (con prefijo https://www.googleapis.com/auth/)
  export function crearOAuthYoutube(cfg: { clientId: string; clientSecret: string; http: Http; ahora?: () => Date }): OAuthProvider;
  export const adaptadorYoutube: PlatformAdapter;
  ```

**Etapas de `publishStep`** (`checkpoint.stage`):
- **`null` o `'inicio'`:** `POST https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status`.
  - Cuerpo: `{ snippet: { title, description: texto, tags: etiquetas, categoryId }, status: { privacyStatus, selfDeclaredMadeForKids } }`.
  - Encabezados: `X-Upload-Content-Length` y `X-Upload-Content-Type`.
  - Resultado: `continue` con `{ stage: 'subiendo', data: { uploadUrl: Location, offset: 0 } }`.
- **`'subiendo'`:**
  - Con `ctx.reanudando`, primero un `PUT` vacío con `Content-Range: bytes */{size}`. Un `308` con `Range: bytes=0-N` deja el offset en `N+1`; sin `Range`, el offset es 0. Un `200/201` termina, y un `404` reinicia en `{ stage: 'inicio' }`.
  - Luego un `PUT` de `[offset, min(offset + TAMANO_PARTE_YOUTUBE, size) - 1]`. Un `308` continúa con el nuevo offset. Un `200/201` da el `id` del video y pasa a `'miniatura'` si hay `target.youtube.thumbnail` y `ctx.miniatura`; si no, termina.
  - La última parte se envía con `final: true`.
- **`'miniatura'`:** `POST https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=`. Cualquier error se ignora; esta decisión se registra en el ledger. Termina con `{ id, url: urlVideoYoutube(id) }`.

**Clasificación de errores:**
- `401` → `auth`.
- `403` con `reason` `quotaExceeded`, `rateLimitExceeded` o `userRateLimitExceeded` → `temporal`.
- `uploadLimitExceeded` → `definitivo`, `'Tu canal de YouTube alcanzó el límite de subidas del día.'`.
- Otros 4xx → `definitivo`, `'YouTube rechazó el video: {error.message}'`.

**OAuth:**
- **`buildAuthUrl`:** `https://accounts.google.com/o/oauth2/v2/auth` con `client_id`, `redirect_uri`, `response_type=code`, `scope` (separados por espacio), `access_type=offline`, `prompt=consent`, `include_granted_scopes=true` y `state`.
- **`exchangeCode`:**
  - `POST https://oauth2.googleapis.com/token` (form) y luego `GET https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails&mine=true`.
  - Sin canal → `definitivo` `'Esta cuenta de Google no tiene un canal de YouTube.'`.
  - Sin `refresh_token` → `definitivo` `'Google no entregó un acceso sin conexión. Vuelve a intentarlo.'`.
  - `scopes` = `scope.split(' ')`.
  - Cuenta: `{ id, name: snippet.title, handle: snippet.customUrl, avatarUrl }`.
  - `datos`: `{ channelId, uploadsPlaylistId }`.
- **`refresh`:** `grant_type=refresh_token`; `invalid_grant` → `auth` `'El acceso a YouTube fue revocado o venció.'`.

**Lectura y comentarios:**
- **`findExisting`:** `GET .../playlistItems?part=snippet&playlistId={uploadsPlaylistId}&maxResults=10`. Busca el mismo `snippet.title` con `publishedAt` dentro de la ventana.
- **`postComment`:** `POST .../commentThreads?part=snippet` con `{ snippet: { videoId, topLevelComment: { snippet: { textOriginal } } } }`.

- [ ] **Paso 1: Escribir las pruebas de contrato que fallan** (cada una con `fetchGrabado`; `ctx.archivo` falso de 200 MiB que devuelve bytes de relleno)

- `'construye la URL de autorización con acceso sin conexión y los 4 permisos'`: la URL contiene `access_type=offline`, `prompt=consent` y `state=s1`.
- `'canjea el código y lee el canal'`: `cuentas.youtube.id === 'UC123'`, `sesion.datos.uploadsPlaylistId === 'UU123'` y `sesion.expiresAt === ahora + 3599 * 1000`.
- `'sin canal es error definitivo'`, `'sin refresh_token es error definitivo'`.
- `'renovar con invalid_grant es error de autenticación'`.
- `'inicia la subida reanudable con los metadatos'`: revisa el cuerpo JSON y los encabezados `X-Upload-*`; da `stage 'subiendo'` con `offset 0`.
- `'sube una parte y continúa con el offset del 308'`: `Content-Range: bytes 0-67108863/209715200` y el siguiente `offset` es 67108864.
- `'al reanudar consulta cuánto recibió YouTube'`: el primer `PUT` lleva `Content-Range: bytes */209715200` y sigue desde `Range: bytes=0-134217727`.
- `'la sesión vencida (404) reinicia la subida'`.
- `'la última parte sin respuesta es ambigua'`.
- `'la miniatura que falla no impide terminar'`: `done` con `url 'https://youtu.be/vid12345678'`.
- `'cuota agotada es temporal'`, `'límite de subidas es definitivo con el mensaje'`.
- `'findExisting encuentra por título dentro de la ventana y no fuera de ella'`.
- `'comenta con commentThreads'`.

- [ ] **Paso 2: Ejecutar y verificar que fallan**

Run: `pnpm vitest run --project platforms`
Expected: FAIL.

- [ ] **Paso 3: Implementar** según las etapas y valores de arriba.

- [ ] **Paso 4: Ejecutar y verificar que pasan**

Run: `pnpm vitest run --project platforms`
Expected: PASS.

- [ ] **Paso 5: Commit**

```bash
git add packages/platforms
git commit -m "feat(platforms): conector de YouTube"
```

---

### Tarea 5: Conexión de Meta y conector de Facebook

**Archivos:**
- Crear: `packages/platforms/src/{meta,facebook}.ts`, `meta.test.ts`, `facebook.test.ts`

**Interfaces:**
- Produce:
  ```ts
  export const VERSION_GRAPH = 'v26.0';
  export const GRAPH = `https://graph.facebook.com/${VERSION_GRAPH}`;
  export function crearOAuthMeta(cfg: { appId: string; appSecret: string; configId: string; http: Http }): OAuthProvider;
  export function clasificarMeta(red: string, r: RespuestaHttp): PlatformError | null;
  export const adaptadorFacebook: PlatformAdapter;
  ```

**OAuth de Meta:**
- **`buildAuthUrl`:** `https://www.facebook.com/v26.0/dialog/oauth?client_id&redirect_uri&state&response_type=code&config_id`.
- **`exchangeCode`**, en este orden:
  1. `GET {GRAPH}/oauth/access_token?client_id&redirect_uri&client_secret&code`.
  2. `GET {GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id&client_secret&fb_exchange_token`.
  3. `GET {GRAPH}/me/permissions`: `scopes` son los de `status === 'granted'`.
  4. `GET {GRAPH}/me/accounts?fields=id,name,access_token,picture{url},instagram_business_account{id,username,profile_picture_url}`.
- **Páginas:** 0 páginas → `definitivo` `'Elige una página de Facebook al conectar.'`; más de una → `definitivo` `'Elige una sola página de Facebook al conectar.'`.
- **Sesión:** `{ accessToken: página.access_token, datos: { pageId, igUserId? } }`, sin `expiresAt`.
- **Cuentas:**
  - `facebook`: `{ id: pageId, name, avatarUrl }`.
  - `instagram`, solo si hay cuenta vinculada: `{ id, name: username, handle: username, avatarUrl }`.
- **`refresh`:** `GET {GRAPH}/{pageId}?fields=id` con el token de página. Si responde, devuelve la misma sesión.

**`clasificarMeta`** (por `error.code`):
- `190`, `102`, `10` y `200–299` → `auth`: `'El acceso a {red} venció o le faltan permisos. Vuelve a conectar Meta.'`.
- `4`, `17`, `32`, `613`, `80001`, `80002`, `1`, `2`, `341` y `368` → `temporal`.
- `506` → `ambiguo`, porque una publicación duplicada indica que ya existe.
- Otro → `definitivo`: `'Meta rechazó la publicación: {error_user_msg ?? message}'`.

**Etapas de Facebook:**
- **`reel`:**
  1. `null` → `POST {GRAPH}/{pageId}/video_reels` con `upload_phase=start`; `continue` con `'subir'` y `{ videoId, uploadUrl }`.
  2. `'subir'` → `POST uploadUrl` con encabezados `Authorization: OAuth {token}` y `file_url: await archivo.urlFirmada()`; `continue` con `'finalizar'`.
  3. `'finalizar'` → `POST {GRAPH}/{pageId}/video_reels` con `upload_phase=finish`, `video_id`, `video_state=PUBLISHED`, `description=texto` y `title=titulo`, todo con `final: true`. Luego `continue` con `'estado'` y `delaySec: 30`.
  4. `'estado'` → `GET {GRAPH}/{videoId}?fields=status`.
     - `publishing_phase.status === 'published'` o `video_status === 'ready'` → `done` con `{ id: videoId, url: 'https://www.facebook.com/reel/{videoId}' }`.
     - `upload_failed`, `error` o `expired` → `definitivo` `'Facebook no pudo procesar el video.'`.
     - En otro caso, `continue` con `delaySec: 30`. Después de 60 consultas → `definitivo` `'Facebook no terminó de procesar el video.'`.
- **`video_largo`:** `POST https://graph-video.facebook.com/v26.0/{pageId}/videos` con `file_url`, `title` y `description`, con `final: true`. Luego `'estado'` igual que el reel, con `url: 'https://www.facebook.com/{pageId}/videos/{id}'`.
- **`imagen`:** `POST {GRAPH}/{pageId}/photos` con `url` y `caption`, con `final: true`. Luego `GET {GRAPH}/{post_id}?fields=permalink_url` → `done` con `{ id: post_id, url: permalink_url }`.

**Lectura y comentarios de Facebook:**
- **`findExisting`:**
  - Videos: `GET {GRAPH}/{pageId}/videos?fields=id,description,created_time&limit=10`.
  - Imagen: `GET {GRAPH}/{pageId}/published_posts?fields=id,message,created_time,permalink_url&limit=10`.
  - Coincide si el texto es igual, sin espacios de los extremos, y la hora cae dentro de la ventana.
- **`postComment`:** `POST {GRAPH}/{remoteId}/comments` con `message`.

- [ ] **Paso 1: Escribir las pruebas de contrato que fallan**

`meta.test.ts`:
- `'la URL de autorización usa config_id y la versión v26.0'`.
- `'canjea el código, obtiene el acceso largo, los permisos y la página con su Instagram'`: dos cuentas y `sesion.datos` igual a `{ pageId: '111', igUserId: '222' }`.
- `'sin páginas o con varias es error definitivo con el mensaje'`.
- `'una página sin Instagram solo conecta Facebook'`.
- `'renovar con error 190 es de autenticación'`.

`facebook.test.ts`:
- `'publica un reel: inicio, subida por URL, finalización y estado'`. El encabezado `file_url` es la URL firmada y la finalización lleva `video_state=PUBLISHED` y la descripción.
- `'el estado en proceso espera 30 segundos y a las 60 consultas falla'`.
- `'publica un video por file_url en graph-video'`.
- `'publica una foto con caption y lee su permalink'`.
- `'la foto sin respuesta es ambigua'`.
- `'clasificarMeta: 190 auth, 613 temporal, 506 ambiguo, 100 definitivo con error_user_msg'`.
- `'findExisting compara texto y hora'` y `'postComment comenta como la página'`.

- [ ] **Paso 2: Ejecutar y verificar que fallan**

Run: `pnpm vitest run --project platforms`
Expected: FAIL.

- [ ] **Paso 3: Implementar** según lo anterior.

- [ ] **Paso 4: Ejecutar y verificar que pasan**

Run: `pnpm vitest run --project platforms`
Expected: PASS.

- [ ] **Paso 5: Commit**

```bash
git add packages/platforms
git commit -m "feat(platforms): conexión de Meta y conector de Facebook"
```

---

### Tarea 6: Conector de Instagram

**Archivos:**
- Crear: `packages/platforms/src/instagram.ts`, `instagram.test.ts`

**Interfaces:**
- Consume: `GRAPH`, `clasificarMeta` (Tarea 5).
- Produce: `export const adaptadorInstagram: PlatformAdapter;`

**Etapas:**
- **`null`:** `POST {GRAPH}/{igUserId}/media`.
  - Reel: `media_type=REELS`, `video_url=await archivo.urlFirmada()`, `caption=texto`, `share_to_feed=true`.
  - Imagen: `image_url`, `caption`.
  - Resultado: `continue` con `'procesando'`, `{ contenedor: id, consultas: 0 }` y `delaySec: 60`.
- **`'procesando'`:** `GET {GRAPH}/{contenedor}?fields=status_code`.
  - `FINISHED` → `continue` con `'publicar'`.
  - `IN_PROGRESS` → `continue` con `delaySec: 60` y `consultas + 1`. A las 30 consultas → `definitivo` `'Instagram no terminó de procesar el archivo.'`.
  - `ERROR` o `EXPIRED` → `definitivo` `'Instagram no pudo procesar el archivo.'`.
  - `PUBLISHED` → `ambiguo`.
- **`'publicar'`:** `POST {GRAPH}/{igUserId}/media_publish` con `creation_id`, con `final: true`. Luego `continue` con `'enlace'` y `{ mediaId }`.
- **`'enlace'`:** `GET {GRAPH}/{mediaId}?fields=permalink` → `done` con `{ id: mediaId, url: permalink }`.

**Subcódigos (`error.error_subcode`), antes de `clasificarMeta`:**
- `2207042` → `definitivo` `'Instagram alcanzó el límite de publicaciones de las últimas 24 horas.'`.
- `2207027` (todavía no está listo) → `continue` con `'procesando'` y `delaySec: 60`.
- `2207052` y `2207003` → `temporal`.
- `2207020` → `definitivo` `'El contenedor de Instagram venció. Vuelve a intentarlo.'`.
- `2207051` → `definitivo` `'Instagram marcó la publicación como spam.'`.
- `2207026` → `definitivo` `'Instagram no admite el formato de este video.'`.
- `2207009` → `definitivo` `'Instagram no admite la proporción de esta imagen.'`.

**Lectura y comentarios:**
- **`findExisting`:** `GET {GRAPH}/{igUserId}/media?fields=id,caption,timestamp,permalink&limit=10`.
- **`postComment`:** `POST {GRAPH}/{remoteId}/comments` con `message`.

- [ ] **Paso 1: Escribir las pruebas de contrato que fallan**

- `'publica un reel: contenedor, espera de 60 s, publicación y enlace'`.
- `'publica una imagen con image_url'`.
- `'a las 30 consultas en proceso falla con el mensaje'`.
- `'ERROR en el contenedor es definitivo'`.
- `'media_publish sin respuesta es ambiguo'`.
- `'el límite de 24 horas es definitivo con el mensaje'`.
- `'2207027 vuelve a esperar'`.
- `'findExisting compara caption y hora'`.
- `'comenta en el medio'`.

- [ ] **Paso 2: Ejecutar y verificar que fallan**

Run: `pnpm vitest run --project platforms`
Expected: FAIL.

- [ ] **Paso 3: Implementar.**

- [ ] **Paso 4: Ejecutar y verificar que pasan**

Run: `pnpm vitest run --project platforms`
Expected: PASS.

- [ ] **Paso 5: Commit**

```bash
git add packages/platforms
git commit -m "feat(platforms): conector de Instagram"
```

---

### Tarea 7: Conexión y conector de TikTok

**Archivos:**
- Crear: `packages/platforms/src/tiktok.ts`, `tiktok.test.ts`

**Interfaces:**
- Consume: Tarea 3; `InfoCreadorTiktok`, `CamposTiktok`, `formatearDuracion` (core).
- Produce:
  ```ts
  export const ALCANCES_TIKTOK = ['user.info.basic', 'user.info.profile', 'video.publish', 'video.list'] as const;
  export function crearOAuthTiktok(cfg: { clientKey: string; clientSecret: string; http: Http; ahora?: () => Date }): OAuthProvider;
  export async function consultarCreador(ctx: ContextoLectura): Promise<InfoCreadorTiktok>;
  export function clasificarTiktok(r: RespuestaHttp): PlatformError | null;
  export const adaptadorTiktok: PlatformAdapter;
  ```

**OAuth:**
- **`buildAuthUrl`:** `https://www.tiktok.com/v2/auth/authorize/?client_key&scope=` con los `ALCANCES_TIKTOK` unidos por coma, más `&response_type=code&redirect_uri&state`.
- **`exchangeCode`:**
  - `POST https://open.tiktokapis.com/v2/oauth/token/` (form) con `client_key`, `client_secret`, `code`, `grant_type=authorization_code` y `redirect_uri`.
  - Luego `GET https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,username,avatar_url`.
  - Sesión: `{ accessToken, refreshToken, expiresAt: ahora + expires_in·1000, refreshExpiresAt: ahora + refresh_expires_in·1000, datos: { openId, username } }`.
  - `scopes` = `scope.split(',')`; cuenta: `{ id: open_id, name: display_name, handle: username, avatarUrl }`.
- **`refresh`:**
  - `grant_type=refresh_token` y se guarda el nuevo `refresh_token`, porque TikTok puede rotarlo.
  - Si la respuesta trae `error` (`invalid_grant` u otro) → `auth` `'El acceso a TikTok venció. Vuelve a conectarla.'`.

**`consultarCreador`:** `POST https://open.tiktokapis.com/v2/post/publish/creator_info/query/` y mapeo:
- `creator_nickname` → `nickname`, `creator_username` → `username`, `creator_avatar_url` → `avatarUrl`.
- `privacy_level_options` → `privacidades`, filtradas a `PRIVACIDADES_TIKTOK`.
- `comment_disabled`, `duet_disabled`, `stitch_disabled` y `max_video_post_duration_sec` → sus campos.

**Etapas de `publishStep`:**
- **`null` o `'creador'`:** `consultarCreador`.
  - La privacidad ya no está entre las opciones → `definitivo` `'La privacidad elegida ya no está disponible en tu cuenta de TikTok.'`.
  - Video con `duracionSeg > duracionMaximaSeg` → `definitivo` `'Tu cuenta de TikTok admite videos de hasta {formatearDuracion(max)}.'`.
  - Si pasa → `continue` con `'inicio'`.
- **`'inicio'`, video:** `POST /v2/post/publish/video/init/`.
  - `post_info`: `{ title: texto, privacy_level, disable_comment: !allowComments, disable_duet: !allowDuet, disable_stitch: !allowStitch, brand_content_toggle: enabled && brandedContent, brand_organic_toggle: enabled && yourBrand }`.
  - `source_info`: `{ source: 'FILE_UPLOAD', video_size, chunk_size, total_chunk_count }`, con `particionTiktok`.
  - Resultado: `continue` con `'subiendo'` y `{ publishId, uploadUrl, parte: 0 }`.
- **`'inicio'`, imagen:** `POST /v2/post/publish/content/init/`.
  - Cuerpo: `{ post_info: { title: titulo.slice(0, 90), description: texto, privacy_level, disable_comment, brand_content_toggle, brand_organic_toggle }, source_info: { source: 'PULL_FROM_URL', photo_images: [await ctx.urlMedia!()], photo_cover_index: 0 }, post_mode: 'DIRECT_POST', media_type: 'PHOTO' }`.
  - Resultado: `continue` con `'estado'`.
- **`'subiendo'`:** `PUT uploadUrl` con la parte `parte`, `Content-Type: mimeType` y `Content-Range: bytes {inicio}-{fin}/{size}`.
  - `206` → la parte siguiente.
  - `201` → `continue` con `'estado'` y `delaySec: 10`.
  - `403` (URL vencida) o `416` → `continue` con `{ stage: 'inicio' }`: reinicia con un `publish_id` nuevo.
- **`'estado'`:** `POST /v2/post/publish/status/fetch/` con `{ publish_id }`.
  - `PROCESSING_UPLOAD` o `PROCESSING_DOWNLOAD` → `continue` con `delaySec: 10`. A las 180 consultas → `definitivo` `'TikTok no terminó de procesar la publicación.'`.
  - `PUBLISH_COMPLETE` o `SEND_TO_USER_INBOX` → `done`. Con `publicaly_available_post_id[0]`: `{ id, url: 'https://www.tiktok.com/@{username}/video/{id}' }`. Si no: `{ id: publishId, url: 'https://www.tiktok.com/@{username}' }`.
  - `FAILED` → `definitivo` `'TikTok no publicó el contenido: {fail_reason}'`.

**`clasificarTiktok`** (por `error.code`):
- `access_token_invalid`, `scope_not_authorized` y `scope_permission_missed` → `auth`.
- `rate_limit_exceeded` e `internal_error` → `temporal`.
- `spam_risk_too_many_posts` → `'TikTok alcanzó el límite de publicaciones del día para esta cuenta.'`.
- `spam_risk_too_many_pending_share` → `'TikTok tiene demasiadas publicaciones pendientes en esta cuenta. Espera a que terminen.'`.
- `unaudited_client_can_only_post_to_private_accounts` → `'Mientras TikTok no apruebe la app, solo se puede publicar en cuentas privadas.'`.
- `url_ownership_unverified` → `'TikTok no verificó el dominio de las fotos.'`.
- `privacy_level_option_mismatch` → `'La privacidad elegida no está disponible en tu cuenta de TikTok.'`.
- Otro distinto de `ok` → `definitivo` `'TikTok rechazó la publicación: {message}'`.

**Lectura y comentarios:**
- **`findExisting`:** `POST /v2/video/list/?fields=id,title,video_description,create_time,share_url` con `{ max_count: 20 }`. Coincide por los primeros 150 caracteres de la descripción y por `create_time` dentro de la ventana.
- **`postComment`:** lanza `PlatformError('definitivo', 'sin_comentarios', 'TikTok no permite publicar comentarios por API.')`.

- [ ] **Paso 1: Escribir las pruebas de contrato que fallan**

- `'la URL de autorización lleva los 4 permisos separados por coma y el state'`.
- `'canjea el código y lee el usuario'`.
- `'renovar guarda el nuevo refresh_token'`.
- `'renovar con error es de autenticación'`.
- `'consultarCreador mapea los campos'`.
- `'la privacidad que ya no existe es definitiva'` y `'el video más largo que el máximo de la cuenta es definitivo'`.
- `'inicia el video con post_info y la partición'`: revisa los `disable_*` invertidos y los dos toggles comerciales.
- `'sube las partes en orden con Content-Range'` (2 partes de un archivo de 100 MB).
- `'la URL de subida vencida reinicia desde inicio'`.
- `'publica una foto por PULL_FROM_URL con urlMedia'`.
- `'PUBLISH_COMPLETE con id público arma la URL del video'` y `'sin id público usa el perfil'`.
- `'FAILED es definitivo con fail_reason'`.
- `'clasificarTiktok traduce los códigos conocidos'` (con `it.each`).
- `'findExisting compara la descripción y la hora'`.
- `'postComment no está disponible'`.

- [ ] **Paso 2: Ejecutar y verificar que fallan**

Run: `pnpm vitest run --project platforms`
Expected: FAIL.

- [ ] **Paso 3: Implementar.**

- [ ] **Paso 4: Ejecutar y verificar que pasan**

Run: `pnpm vitest run --project platforms`
Expected: PASS.

- [ ] **Paso 5: Commit**

```bash
git add packages/platforms
git commit -m "feat(platforms): conexión y conector de TikTok"
```

---

### Tarea 8: Cifrado, secretos, parámetros y emulador

**Archivos:**
- Crear: `functions/src/conexiones/{cifrado,secretos}.ts`, `functions/src/conexiones/cifrado.test.ts`, `scripts/secretos-demo.cjs`, `pruebas/integracion/src/funciones/secretos.test.ts`
- Modificar:
  - `functions/src/config.ts`, `functions/build.mjs` (copia `.secret.local`), `functions/.env.demo-omnistream`.
  - `firebase.json`: `functions[0].ignore` con `["node_modules", ".git", "*.local", "firebase-debug.*.log"]`.
  - `.gitignore` (`functions/.secret.local`), `package.json` (scripts `test:integracion` y `test:e2e` empiezan con `node scripts/secretos-demo.cjs &&`).
  - `firestore.rules`, `pruebas/integracion/src/reglas.test.ts`.

**Interfaces:**
- Produce:
  ```ts
  // config.ts
  export const urlPublica, metaAppId, metaConfigId, googleClientId, tiktokClientKey; // defineString: URL_PUBLICA, META_APP_ID, META_CONFIG_ID, GOOGLE_CLIENT_ID, TIKTOK_CLIENT_KEY
  export const claveCifrado, metaAppSecret, googleClientSecret, tiktokClientSecret; // defineSecret: CLAVE_CIFRADO, META_APP_SECRET, GOOGLE_CLIENT_SECRET, TIKTOK_CLIENT_SECRET
  export const SECRETOS_CONECTORES = [claveCifrado, metaAppSecret, googleClientSecret, tiktokClientSecret];
  // cifrado.ts
  export interface SecretoCifrado { ciphertext: string; iv: string; authTag: string; keyVersion: number }
  export interface Cifrador { cifrar(texto: string): SecretoCifrado; descifrar(s: SecretoCifrado): string }
  export function crearCifrador(claveBase64: string, keyVersion?: number): Cifrador; // AES-256-GCM, iv de 12 bytes, base64
  // secretos.ts
  export async function guardarSesion(db: Firestore, cifrador: Cifrador, proveedor: Proveedor, sesion: SesionProveedor, ahora: Date): Promise<void>;
  export async function leerSesion(db: Firestore, cifrador: Cifrador, proveedor: Proveedor): Promise<SesionProveedor | null>;
  export async function borrarSesion(db: Firestore, proveedor: Proveedor): Promise<void>;
  ```

**Valores de demostración:**
- `.env.demo-omnistream`:
  ```
  URL_PUBLICA=http://localhost:3000
  META_APP_ID=demo-meta
  META_CONFIG_ID=demo-config
  GOOGLE_CLIENT_ID=demo-google
  TIKTOK_CLIENT_KEY=demo-tiktok
  ```
- `secretos-demo.cjs` escribe `functions/.secret.local` si no existe:
  ```
  CLAVE_CIFRADO=MDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA=
  META_APP_SECRET=demo-meta-secret
  GOOGLE_CLIENT_SECRET=demo-google-secret
  TIKTOK_CLIENT_SECRET=demo-tiktok-secret
  ```

- [ ] **Paso 1: Escribir las pruebas que fallan**

`cifrado.test.ts` (unitaria, proyecto `functions`):
- `'cifra y descifra'`: el ida y vuelta conserva el texto.
- `'dos cifrados del mismo texto usan iv distinto'`.
- `'un authTag alterado no descifra'`: lanza.
- `'la llave debe tener 32 bytes'`: `crearCifrador('YWJj')` lanza `'La llave de cifrado debe tener 32 bytes en base64.'`.

`secretos.test.ts` (integración):
```ts
it('guarda la sesión cifrada sin el token en claro', async () => {
  await guardarSesion(db, cifrador, 'tiktok', { accessToken: 'act.secreto-123', datos: {} }, new Date());
  const crudo = JSON.stringify((await db.doc('secrets/tiktok').get()).data());
  expect(crudo).not.toContain('secreto-123');
  expect(await leerSesion(db, cifrador, 'tiktok')).toMatchObject({ accessToken: 'act.secreto-123' });
});
```
`reglas.test.ts`: el propietario no puede leer ni escribir `oauthStates/x` ni `dataDeletions/x`. La regla de `secrets` ya existe.

- [ ] **Paso 2: Ejecutar y verificar que fallan**

Run: `pnpm vitest run --project functions && pnpm test:integracion`
Expected: FAIL.

- [ ] **Paso 3: Implementar.**

- `build.mjs` copia `.secret.local` a `dist/` si existe.
- `firestore.rules` agrega dos `match` con `allow read, write: if false`.

- [ ] **Paso 4: Ejecutar y verificar que pasan**

Run: `pnpm vitest run --project functions && pnpm test:integracion`
Expected: PASS. El emulador arranca sin pedir Secret Manager.

- [ ] **Paso 5: Commit**

```bash
git add functions scripts firestore.rules firebase.json .gitignore package.json pruebas/integracion
git commit -m "feat(functions): cifrado de sesiones y secretos de los conectores"
```

---

### Tarea 9: Sesiones vigentes y renovación diaria

**Archivos:**
- Crear: `functions/src/conexiones/{proveedores,sesiones}.ts`, `pruebas/integracion/src/funciones/sesiones.test.ts`
- Modificar: `functions/src/index.ts` (+ `renovarSesiones`), `functions/src/publicacion/notificaciones.ts` (si hace falta para el tipo `conexion`)

**Interfaces:**
- Consume: Tareas 3–8; `avisoConexion` y `Notificador` (2A).
- Produce:
  ```ts
  // proveedores.ts
  export function proveedoresReales(http?: Http): Record<Proveedor, OAuthProvider>; // lee parámetros y secretos
  export const ADAPTADORES: Record<Platform, PlatformAdapter>;
  // sesiones.ts
  export interface DependenciasSesion {
    db: Firestore; cifrador: Cifrador; proveedores: Record<Proveedor, OAuthProvider>; ahora: () => Date; notificar: Notificador;
  }
  export async function sesionVigente(red: Platform, deps: DependenciasSesion): Promise<SesionProveedor>;
  export async function marcarExpirada(proveedor: Proveedor, error: PlatformError, deps: DependenciasSesion): Promise<void>;
  export async function renovarSesionesAhora(deps: DependenciasSesion): Promise<{ renovadas: number; vencidas: number }>;
  export const renovarSesiones; // onSchedule('every day 03:00', UTC, secrets: SECRETOS_CONECTORES)
  ```

**Comportamiento:**
- **`sesionVigente`:**
  - Lee `secrets/{proveedorDe(red)}`. Sin sesión → `PlatformError('auth', 'sin_conexion', '{Red} no está conectada.')`.
  - Si `expiresAt` vence en menos de 10 min, llama a `refresh`, guarda la sesión y actualiza `tokenExpiresAt` de sus redes (`refreshExpiresAt` en TikTok).
  - Un error `auth` en `refresh` llama a `marcarExpirada` y se relanza.
- **`marcarExpirada`:**
  - Sus redes pasan a `authStatus: 'expirada'` con `lastError: { code, message, at }`.
  - Avisa con `avisoConexion(red)`, con id `conexion-{red}-{yyyy-mm-dd}`.
- **`renovarSesionesAhora`:**
  - Recorre los proveedores con sesión guardada y llama a `refresh` a todos: valida Meta y YouTube, y renueva TikTok.
  - En éxito, guarda y deja sus redes `conectada`.
  - Con `auth` → `marcarExpirada`. Con otro error, solo registra (sin tokens).

- [ ] **Paso 1: Escribir las pruebas que fallan** (integración, proveedores falsos)

- `'renueva TikTok y guarda el nuevo refresh_token'`.
- `'un acceso que vence en menos de 10 minutos se renueva antes de usarse'` y `'uno vigente no se renueva'`.
- `'un acceso revocado marca expiradas Facebook e Instagram y avisa una sola vez por día'`. Se ejecuta `renovarSesionesAhora` dos veces y se esperan 2 documentos `notifications` (uno por red), no 4.
- `'sin sesión es error de autenticación con el mensaje'`.
- `'un error temporal no cambia la conexión'`.

- [ ] **Paso 2: Ejecutar y verificar que fallan**

Run: `pnpm test:integracion`
Expected: FAIL.

- [ ] **Paso 3: Implementar.**

- [ ] **Paso 4: Ejecutar y verificar que pasan**

Run: `pnpm --filter @omnistream/functions typecheck && pnpm test:integracion`
Expected: PASS.

- [ ] **Paso 5: Commit**

```bash
git add functions pruebas/integracion
git commit -m "feat(functions): sesiones vigentes y renovación diaria"
```

---

### Tarea 10: Invocable `conexiones` y retorno de OAuth

**Archivos:**
- Crear: `functions/src/conexiones/conexiones.ts`, `pruebas/integracion/src/funciones/conexiones.test.ts`
- Modificar: `functions/src/index.ts` (+ `conexiones`, `retornoConexion`)

**Interfaces:**
- Consume: Tareas 1, 3, 7, 8 y 9; `exigirPropietario` (2A).
- Produce:
  ```ts
  export interface DependenciasConexiones extends DependenciasSesion { urlPublica: string; http: Http }
  export const redireccionOAuth = (urlPublica: string) => `${urlPublica}/api/conexiones/retorno`;
  export async function despacharConexion(auth: { token?: Record<string, unknown> } | undefined, datos: unknown, deps: DependenciasConexiones): Promise<RespuestaConexiones>;
  export async function completarConexion(query: Record<string, unknown>, deps: DependenciasConexiones): Promise<string>; // URL de redirección
  export const conexiones;      // onCall({ region, secrets: SECRETOS_CONECTORES, timeoutSeconds: 60 })
  export const retornoConexion; // onRequest({ region, secrets: SECRETOS_CONECTORES }) → 302 a completarConexion(req.query)
  ```

**Acciones:**
- **`iniciar`:** `state = randomBytes(32).toString('base64url')`. Guarda `oauthStates/{state}` con `{ proveedor, createdAt, expiresAt: ahora + 10 min }` y devuelve `{ url: buildAuthUrl({ state, redirectUri }) }`.
- **`desconectar`:** `borrarSesion` y `set` (sin `merge`) en cada red del proveedor con `{ platform, authStatus: 'sin_conectar', publishMode: 'manual', readEnabled: false, scopes: [] }`.
- **`configurar`:**
  - `publishMode: 'api'` exige `puedePublicarPorApi`. Si la red no está conectada → `failed-precondition` `'{Red} no está conectada.'`; si falta el permiso → `failed-precondition` con `mensajePermisoFaltante`.
  - `mediaVerified` en otra red que no sea TikTok → `invalid-argument` `'Esta opción solo aplica a TikTok.'`.
  - Escribe solo los campos recibidos.
- **`infoCreadorTiktok`:** `sesionVigente('tiktok')` + `consultarCreador` → `{ info }`.
  - `auth` → `marcarExpirada` y `failed-precondition` `'Vuelve a conectar TikTok.'`.
  - Otro error → `failed-precondition` `'No se pudo consultar tu cuenta de TikTok.'`.

**`completarConexion`** (cada error vuelve a `{urlPublica}/ajustes/conexiones?error={encodeURIComponent(mensaje)}`):
- **Sin `state`, o `state` desconocido o vencido:** `'La conexión venció o no es válida. Vuelve a intentarlo.'`. El `state` se borra en una transacción antes de cualquier otra cosa.
- **Con `error` en la query (cancelación):** `'Se canceló la conexión con {Proveedor}.'`.
- **`exchangeCode` lanza `PlatformError`:** su mensaje. Cualquier otro error: `'No se pudo completar la conexión con {Proveedor}.'`.
- **Éxito:**
  - `guardarSesion` y, por cada red de `cuentas`, `set` con `merge` de `{ platform, authStatus: 'conectada', account, scopes, tokenExpiresAt?, lastError: delete }`. Se conservan `publishMode` (o `'manual'`) y `readEnabled` (o `true`).
  - Meta sin Instagram: `connections/instagram` pasa a `{ authStatus: 'error', lastError: { code: 'sin_instagram', message: 'La página no tiene una cuenta profesional de Instagram vinculada.' } }`.
  - Redirige a `{urlPublica}/ajustes/conexiones?conectada={proveedor}`.

- [ ] **Paso 1: Escribir las pruebas que fallan** (integración, `despacharConexion` y `completarConexion` con proveedores falsos; una prueba HTTP real contra el emulador)

- `'iniciar guarda un state de 10 minutos y devuelve la URL del proveedor'`: la URL contiene el `state` guardado.
- `'el retorno con un state válido guarda la sesión cifrada y conecta Facebook e Instagram'`.
- `'un state usado dos veces no conecta'`: la segunda llamada redirige con el mensaje y `exchangeCode` se llamó una sola vez.
- `'un state vencido no conecta'`.
- `'cancelar en el proveedor vuelve con el mensaje'`.
- `'Meta sin Instagram deja Instagram con error'`.
- `'configurar a API exige estar conectada y tener el permiso de publicar'`.
- `'desconectar borra la sesión y vuelve a manual'`.
- `'mediaVerified solo aplica a TikTok'`.
- `'sin el claim owner se rechaza'`.
- `'retornoConexion sin state redirige a Conexiones con el error'`: `fetch` a `http://127.0.0.1:5001/demo-omnistream/us-central1/retornoConexion` con `redirect: 'manual'`; espera `302` y `location` que empieza con `http://localhost:3000/ajustes/conexiones?error=`.

- [ ] **Paso 2: Ejecutar y verificar que fallan**

Run: `pnpm test:integracion`
Expected: FAIL.

- [ ] **Paso 3: Implementar.**

- [ ] **Paso 4: Ejecutar y verificar que pasan**

Run: `pnpm --filter @omnistream/functions typecheck && pnpm test:integracion`
Expected: PASS.

- [ ] **Paso 5: Commit**

```bash
git add functions pruebas/integracion
git commit -m "feat(functions): conexión por OAuth con Meta, YouTube y TikTok"
```

---

### Tarea 11: Publicación por API en `publicarDestino`

**Archivos:**
- Crear: `functions/src/publicacion/{porApi,fuentes}.ts`, `pruebas/integracion/src/funciones/publicarPorApi.test.ts`
- Modificar:
  - `functions/src/publicacion/publicarDestino.ts`, `functions/src/publicacion/cola.ts` (`TareaPublicacion.continuacion?`).
  - `functions/src/publicacion/firestore.ts`: `leerModos` por formato y `leerConexionDe`.
  - `functions/src/publicacion/acciones/{programar,guardar}.ts`.
  - `pruebas/integracion/src/datos.ts`: `sembrarConexion` y `sembrarSesion`.

**Interfaces:**
- Consume: Tareas 1–9.
- Produce:
  ```ts
  // cola.ts
  export interface TareaPublicacion { postId: string; platform: Platform; scheduleVersion: number; continuacion?: number }
  // fuentes.ts
  export interface FuentesPublicacion { archivo: ArchivoFuente; miniatura?: ArchivoFuente; urlMedia?(): Promise<string> }
  export function fuenteDeStorage(archivo: File, meta: { size: number; mimeType: string }): ArchivoFuente;
  export function fuentesDePublicacion(bucket: Bucket, asset: Asset, destino: Destino, urlMedia: (ruta: string) => string): FuentesPublicacion;
  // porApi.ts
  export interface DependenciasApi {
    adaptador(red: Platform): PlatformAdapter;
    sesion(red: Platform): Promise<SesionProveedor>;
    fuentes(asset: Asset, destino: Destino): FuentesPublicacion;
    marcarExpirada(red: Platform, error: PlatformError): Promise<void>;
    encolar: Encolador; http: Http; presupuestoMs: number; // 25 * 60 * 1000
  }
  export type ResultadoApi =
    | { tipo: 'hecho'; remote: RemoteRef }
    | { tipo: 'esperar'; delaySec: number; seq: number }
    | { tipo: 'error'; error: PlatformError }
    | { tipo: 'perdido' };
  export async function avanzarPorApi(p: {
    db: Firestore; ref: DocumentReference; attemptId: string; checkpoint: Checkpoint & { seq: number } | null;
    efectivo: DestinoEfectivo; adaptador: PlatformAdapter; ctx: PublishContext; ahora: () => Date; presupuestoMs: number;
  }): Promise<ResultadoApi>;
  // publicarDestino.ts
  export type ResultadoTarea = 'pendiente_manual' | 'publicada' | 'esperando' | 'fallida' | MotivoOmision;
  export async function ejecutarTarea(db, tarea, contexto: { ahora: () => Date; ultimoIntento: boolean; api?: DependenciasApi }): Promise<ResultadoTarea>;
  // firestore.ts
  export async function leerModos(db: Firestore, destinos: readonly Pick<Destino, 'platform' | 'format'>[]): Promise<Partial<Record<Platform, ModoPublicacion>>>;
  ```

**Ciclo de `avanzarPorApi`:**
- Llama a `publishStep` mientras `elapsed < presupuestoMs`.
- Cada `continue` guarda `checkpoint = { ...nuevo, seq: seq + 1 }` y extiende `lease.until = ahora + LEASE_MS`, en una transacción que exige `lease.attemptId === attemptId`. Si no se cumple → `{ tipo: 'perdido' }`.
- Con `delaySec > 0` o el presupuesto agotado → `{ tipo: 'esperar' }`.

**Rama API de `ejecutarTarea`** (después de validar con los modos):
1. Obtiene la sesión con `api.sesion(red)`. Un `PlatformError` de `auth` sigue el camino de error de autenticación (punto 4).
2. Arma el destino efectivo: `destinoEfectivo(publicacion, destino, { principal: { title, url: urlVideoYoutube(remote.id) }?, duracionSeg: asset.durationSec })`.
3. Arma el contexto: `ctx = { http, sesion, ...fuentes, reanudando: toma.decision.continuar, ahora }`.
4. Resultado de `avanzarPorApi`:
   - **`hecho`:** `finalizar` con `{ status: 'publicada', remote: { ...remote, publishedAt }, checkpoint: delete }`. En TikTok, con `parentRef` distinto de `no_aplica`, también `'parentRef.status': 'publicada'`. El intento se registra como `{ stage: 'api', result: 'ok' }`. Devuelve `'publicada'`.
   - **`esperar`:** `finalizar` con `null`: libera el lease y conserva el estado y el `checkpoint`. Luego encola `{ postId, platform, scheduleVersion, continuacion: seq }` con id `idContinuacion(...)` y `scheduleTime: ahora + delaySec` (sin hora si es 0). Devuelve `'esperando'`.
   - **`error`, según el tipo:**
     - `definitivo` → `fallida` con `lastError`.
     - `auth` → `marcarExpirada` + `fallida` con `kind: 'auth'`.
     - `temporal` → lanza (el `catch` de la 2A libera el lease o, en el último intento, deja `fallida`).
     - `ambiguo` → `findExisting(efectivo, { desde: ahora − 30 min, hasta: ahora + 30 min })`: si la encuentra, se trata como `hecho`; si no, lanza como temporal.
   - **`perdido`:** devuelve `'ocupada'` sin escribir.

**Otros cambios:**
- **`encolarDestino` / `Encolador`:** aceptan la tarea con `continuacion`.
- **`publicarDestino`:**
  - `memory: '1GiB'` y `secrets: SECRETOS_CONECTORES`.
  - Arma `api` con `ADAPTADORES`, `sesionVigente`, `fuentesDePublicacion` y `marcarExpirada`.
  - `urlMedia` usa `firmarTokenMedia` (Tarea 13). Hasta entonces, la Tarea 11 deja `urlMedia` sin definir y TikTok imagen por API no se usa en sus pruebas.
- **`programarPublicacion` y `leerModos`:** `programarPublicacion` calcula `leerModos(db, destinos)` antes de validar y pasa `modos` a `validarPublicacion`; también guarda `publishMode` por destino. `leerModos` usa `modoDePublicacion(leerConexion(...), destino.format)`.
- **`guardarPublicacion`:** persiste `tiktok` igual que `youtube` (lo escribe o lo borra con `FieldValue.delete()`).

- [ ] **Paso 1: Escribir las pruebas que fallan**

Integración. Llaman a `ejecutarTarea` directamente con `api` falso: un adaptador guionado por `checkpoint.stage`, `sesion` fija, `fuentes` en memoria y `encolar` que registra llamadas.

```ts
it('publica por API en varios pasos y guarda el checkpoint entre pasos', async () => {
  // adaptador: null → continue {stage:'a'} → continue {stage:'b'} → done {id:'r1', url:'https://www.tiktok.com/@cuenta/video/r1'}
  expect(await ejecutarTarea(db, tarea, contexto)).toBe('publicada');
  const destino = await leerDestinoDe(db, postId, 'tiktok');
  expect(destino).toMatchObject({ status: 'publicada', remote: { id: 'r1' } });
  expect(destino.checkpoint).toBeUndefined();
  expect(adaptador.checkpointsRecibidos.map((c) => c?.stage ?? null)).toEqual([null, 'a', 'b']);
});
```

Más casos:
- `'un paso que pide esperar libera el lease y encola la continuación'`: `encolar` recibe id `${postId}-tiktok-v1-c1` y `scheduleTime` 30 s después. El destino queda `publicando`, sin `lease` y con `checkpoint.seq === 1`. Al ejecutar la tarea de continuación, sigue desde `'a'` y termina `'publicada'`.
- `'una continuación que llega después de publicar no hace nada'`: devuelve `'estado'` y no llama al adaptador.
- `'si otro intento tomó el destino, el ciclo se detiene sin escribir'`: el adaptador cambia `lease.attemptId` antes de devolver `continue`; resultado `'ocupada'`.
- `'error definitivo deja fallida con el mensaje'`.
- `'error de autenticación deja fallida y marca la conexión expirada'`.
- `'error temporal libera el lease y lanza para que Cloud Tasks reintente'`.
- `'ambiguo con la publicación encontrada la da por publicada'` y `'ambiguo sin encontrarla lanza'`.
- `'una Hija en TikTok por API lleva la referencia en la descripción y la marca publicada'`.
- `'el presupuesto agotado continúa en otra ejecución sin hora programada'` (`presupuestoMs: 0`).
- `'programar por API exige la privacidad de TikTok'`: con `connections/tiktok` en API y sin privacidad → `failed-precondition` `'Elige quién puede ver la publicación en TikTok.'`.
- `'programar copia el modo efectivo por formato'`: TikTok imagen sin `mediaVerified` queda `manual`.
- `'guardar conserva los campos de TikTok'`.

- [ ] **Paso 2: Ejecutar y verificar que fallan**

Run: `pnpm test:integracion`
Expected: FAIL.

- [ ] **Paso 3: Implementar.**

- [ ] **Paso 4: Ejecutar y verificar que pasan**

Run: `pnpm --filter @omnistream/functions typecheck && pnpm test:integracion`
Expected: PASS. Las pruebas de la 2A siguen en verde.

- [ ] **Paso 5: Commit**

```bash
git add functions pruebas/integracion
git commit -m "feat(functions): publicación por API por etapas con continuación"
```

---

### Tarea 12: `comentarReferencia` y referencia por API

**Archivos:**
- Crear: `functions/src/publicacion/comentarReferencia.ts`, `pruebas/integracion/src/funciones/comentarReferencia.test.ts`
- Modificar:
  - `functions/src/publicacion/alCambiarDestino.ts`, `functions/src/publicacion/acciones/cierre.ts` (`desvincularHija` también limpia `'publicando'`).
  - `functions/src/index.ts`, `pruebas/integracion/src/funciones/alCambiarDestino.test.ts` (nueva firma).

**Interfaces:**
- Consume: Tareas 1, 9 y 11; `textoReferencia`, `urlVideoYoutube` y `avisoDe` (2A).
- Produce:
  ```ts
  export interface TareaReferencia { postId: string; platform: Platform }
  export async function ejecutarReferencia(db: Firestore, tarea: TareaReferencia, deps: {
    api: Pick<DependenciasApi, 'adaptador' | 'sesion' | 'marcarExpirada' | 'http'>; notificar: Notificador; ultimoIntento: boolean; ahora: () => Date;
  }): Promise<'publicada' | 'omitida' | 'manual'>;
  export const comentarReferencia; // onTaskDispatched({ region, retryConfig: { maxAttempts: 5, minBackoffSeconds: 60, maxBackoffSeconds: 1800 }, secrets })
  // alCambiarDestino.ts
  export interface DependenciasCambio {
    notificar: Notificador;
    encolarReferencia(tarea: TareaReferencia, id: string): Promise<void>;
    conexion(red: Platform): Promise<Conexion>;
  }
  export async function reaccionarACambio(db: Firestore, cambio: CambioDestino, deps: DependenciasCambio): Promise<void>;
  ```

**Comportamiento:**
- **`activarReferencia`:** ahora recibe el estado destino.
  - Con `puedeComentarPorApi(conexion)`, deja `'publicando'` y encola `comentarReferencia` con `idReferencia(postId, red, scheduleVersion)`, sin push.
  - Si no, `'pendiente'` + push `referencia`, igual que en la 2A.
- **`ejecutarReferencia`:**
  - Sin `parentRef.status === 'publicando'` o sin `remote` → `'omitida'`.
  - Texto: `textoReferencia(principal.title, urlVideoYoutube(youtube.remote.id))`.
  - Llama a `postComment(remote.id, texto, ctx)` y luego, en una transacción que exige `'publicando'`, `{ 'parentRef.status': 'publicada', 'parentRef.remoteCommentId': id }`.
  - Error `temporal` sin ser el último intento → lanza.
  - En otro caso, `{ 'parentRef.status': 'pendiente', 'parentRef.error': mensaje }` + `notificar('ref-manual-{postId}-{red}', avisoDe('referencia', ...))`. Con `auth`, además `marcarExpirada`.

- [ ] **Paso 1: Escribir las pruebas que fallan**

- `'con la conexión por API, la referencia se encola en vez de avisar'`: `parentRef` queda `'publicando'`, `encolarReferencia` recibe id `p-facebook-ref-v1` y no hay `notifications`.
- `'sin acceso para comentar, avisa como en la 2A'`.
- `'comentarReferencia publica el comentario y guarda su id'`: el texto recibido es `'Video completo en YouTube: «Video largo» https://youtu.be/abcdefghijk'`.
- `'si el comentario falla, la referencia vuelve a pendiente y avisa'`.
- `'un error temporal relanza hasta el último intento'`.
- `'desvincular durante el comentario lo omite'`.
- `'TikTok nunca se comenta'`.

- [ ] **Paso 2: Ejecutar y verificar que fallan**

Run: `pnpm test:integracion`
Expected: FAIL.

- [ ] **Paso 3: Implementar.**

- [ ] **Paso 4: Ejecutar y verificar que pasan**

Run: `pnpm --filter @omnistream/functions typecheck && pnpm test:integracion`
Expected: PASS.

- [ ] **Paso 5: Commit**

```bash
git add functions pruebas/integracion
git commit -m "feat(functions): referencia al Principal por comentario de API"
```

---

### Tarea 13: `media`, borrado de datos de Meta y reescrituras de Vercel

**Archivos:**
- Crear:
  - `functions/src/conexiones/{media,borradoDatosMeta}.ts`, `functions/src/conexiones/{media,borradoDatosMeta}.test.ts` (unitarias).
  - `pruebas/integracion/src/funciones/media.test.ts`.
  - `apps/web/src/lib/reescrituras.ts` (+ prueba), `apps/web/src/components/privacidad/AvisoBorrado.tsx` (+ prueba).
- Modificar: `functions/src/index.ts`, `functions/src/publicacion/publicarDestino.ts` (`urlMedia`), `apps/web/next.config.ts`, `apps/web/src/app/(publico)/privacidad/page.tsx`

**Interfaces:**
- Produce:
  ```ts
  // media.ts — la llave HMAC es sha256('media:' + CLAVE_CIFRADO)
  export function firmarTokenMedia(clave: string, ruta: string, expiraMs: number): string; // `${base64url(ruta)}.${expiraMs}.${firmaBase64url}`
  export function verificarTokenMedia(clave: string, token: string, ahoraMs: number): string | null; // ruta, o null si es inválido o venció
  export async function servirMedia(token: string, deps: { bucket: Bucket; clave: string; ahora: () => Date }):
    Promise<{ status: 404 } | { status: 200; contentType: string; size: number; stream: NodeJS.ReadableStream }>;
  export const media;            // onRequest GET /{token}; token de 1 hora; Cache-Control: private, max-age=0
  // borradoDatosMeta.ts
  export function verificarSignedRequest(signedRequest: string, appSecret: string): { user_id: string } | null;
  export async function borrarDatosMeta(signedRequest: string, deps: { db: Firestore; appSecret: string; urlPublica: string; ahora: () => Date }):
    Promise<{ status: 200; cuerpo: { url: string; confirmation_code: string } } | { status: 400; cuerpo: { error: string } }>;
  export const borradoDatosMeta; // onRequest POST (form signed_request)
  // web: reescrituras.ts
  export function reescrituras(base: string | undefined, desarrollo: boolean): { source: string; destination: string }[];
  ```

**Valores:**
- **`verificarSignedRequest`:** separa en el primer `.`. Debe cumplirse `HMAC-SHA256(payloadCodificado, appSecret) === base64url-decode(firma)` (comparación de tiempo constante) y `algorithm === 'HMAC-SHA256'`.
- **`borrarDatosMeta`:**
  - Borra `secrets/meta` y deja `connections/facebook` y `connections/instagram` como en `desconectar`.
  - Crea `dataDeletions/{code}` con `{ userId, at }`, donde `code = randomBytes(8).toString('hex')`.
  - Responde `{ url: '{urlPublica}/privacidad?borrado={code}#borrado-de-datos', confirmation_code: code }`.
- **`reescrituras(base, desarrollo)`:**
  - La base es `base ?? (desarrollo ? 'http://127.0.0.1:5001/demo-omnistream/us-central1' : undefined)`. Sin base → `[]`.
  - Rutas:
    - `/api/conexiones/retorno` → `{base}/retornoConexion`.
    - `/api/meta/borrado-datos` → `{base}/borradoDatosMeta`.
    - `/api/media/:token` → `{base}/media/:token`.
- **`next.config.ts`:** `async rewrites() { return reescrituras(process.env.FUNCIONES_URL, process.env.NODE_ENV !== 'production'); }`.
- **`AvisoBorrado`:** con `codigo`, muestra `'Tu solicitud de borrado {codigo} se completó: OmniStream eliminó los accesos y los datos de tu cuenta de Meta.'`. La página de privacidad lo muestra en la sección "Borrado de datos" cuando hay `?borrado=` (`searchParams` asíncrono, según la guía de Next 16 en `node_modules/next/dist/docs`).
- **`urlMedia` en `publicarDestino`:** `{URL_PUBLICA}/api/media/{firmarTokenMedia(clave, storagePath, ahora + 3.600.000)}`.

- [ ] **Paso 1: Escribir las pruebas que fallan**

Unitarias:
- `'el token de media vale una hora y no admite alteraciones'`: ida y vuelta, vencido → `null` y firma alterada → `null`.
- `'signed_request válido devuelve el usuario'` y `'firma inválida o algoritmo distinto es null'`. Se arma un `signed_request` real con `createHmac` en la prueba.

Integración:
- `'servirMedia entrega el archivo con su tipo'`: archivo en el emulador de Storage.
- `'un token vencido es 404'`.
- `'borrarDatosMeta borra la sesión y desconecta Facebook e Instagram'`: respuesta 200 con `confirmation_code` de 16 caracteres hexadecimales y `url` con el código.
- `'un signed_request inválido es 400 y no borra nada'`.

Web:
- `reescrituras.test.ts`:
  - Sin base y en producción → `[]`.
  - En desarrollo usa el emulador.
  - Con base, las 3 reglas.
- `AvisoBorrado.test.tsx`: muestra el texto con el código.

- [ ] **Paso 2: Ejecutar y verificar que fallan**

Run: `pnpm vitest run --project functions --project web && pnpm test:integracion`
Expected: FAIL.

- [ ] **Paso 3: Implementar.**

- [ ] **Paso 4: Ejecutar y verificar que pasan**

Run: `pnpm vitest run && pnpm --filter @omnistream/web build && pnpm test:integracion`
Expected: PASS.

- [ ] **Paso 5: Commit**

```bash
git add functions apps/web pruebas/integracion
git commit -m "feat: media firmada, borrado de datos de Meta y reescrituras /api"
```

---

### Tarea 14: Web: Ajustes > Conexiones

**Archivos:**
- Crear:
  - `apps/web/src/app/(app)/ajustes/layout.tsx`, `apps/web/src/app/(app)/ajustes/conexiones/page.tsx`.
  - `apps/web/src/lib/conexiones/{repositorio,acciones}.ts`.
  - `apps/web/src/components/conexiones/TarjetaConexion.tsx` (+ prueba), `apps/web/src/components/ajustes/PestanasAjustes.tsx` (+ prueba).
- Modificar: `apps/web/src/app/(app)/ajustes/general/page.tsx` (sin cambios de contenido; queda bajo el layout)

**Interfaces:**
- Consume: Tareas 1 y 10.
- Produce:
  ```ts
  export function useConexiones(): { conexiones: Record<Platform, Conexion>; cargando: boolean }; // onSnapshot('connections'); las ausentes con leerConexion(red, undefined)
  export async function ejecutarAccionConexion(accion: AccionConexion): Promise<RespuestaConexiones>; // httpsCallable 'conexiones'; errores con mensajeDeError
  export function TarjetaConexion(props: {
    conexion: Conexion; ocupado: boolean;
    alConectar(): void; alDesconectar(): void;
    alConfigurar(cambios: { publishMode?: ModoPublicacion; readEnabled?: boolean; mediaVerified?: boolean }): void;
  }): JSX.Element;
  ```

**Textos de la tarjeta** (`<section aria-label="{Red}">`):
- **Encabezado:** título con el nombre de la red y el estado con `ETIQUETAS_ESTADO_CONEXION`.
- **Cuenta:** avatar, nombre y `@handle` si existen. Con `tokenExpiresAt`: "Acceso vigente hasta {formatearFechaHora}". Con `expirada` o `error`: `lastError.message` en color de peligro.
- **Selector "Modo de publicación":**
  - Opciones "Manual" y "Por API". "Por API" está deshabilitada si `!puedePublicarPorApi(conexion)`, con la ayuda "Conecta {Red} para publicar por API.".
  - Notas bajo el selector, solo cuando el modo es API:
    - YouTube: "Mientras Google no audite la app, los videos subidos por API quedan privados."
    - TikTok: "Mientras TikTok no apruebe la app, lo publicado por API solo lo ves tú y tu cuenta debe ser privada."
    - Facebook e Instagram: "Con la app de Meta en modo desarrollo, solo las personas con rol en la app ven lo publicado."
- **Casillas:** "Leer métricas" (`readEnabled`). Solo en TikTok: "Dominio verificado en TikTok para fotos" (`mediaVerified`).
- **Botones:**
  - "Conectar con {Proveedor}" cuando está `sin_conectar`. "Reconectar" y "Desconectar" en otro caso.
  - "Desconectar" abre un diálogo:
    - Título: "¿Desconectar {Proveedor}?".
    - Texto: "Se borrarán los accesos guardados de {redes}. Lo programado por API fallará hasta que vuelvas a conectarla."
    - Botones: "Volver" y "Desconectar".
- **Pestañas** (`PestanasAjustes`): `nav aria-label="Ajustes"` con enlaces "General" (`/ajustes/general`) y "Conexiones" (`/ajustes/conexiones`), y `aria-current="page"` en la activa.
- **Página de Conexiones:**
  - Título "Conexiones" y descripción "Conecta cada red y elige si se publica por API o en modo manual."
  - Rejilla de 4 tarjetas en el orden de `PLATAFORMAS`.
  - "Conectar" llama a `iniciar` y luego a `window.location.assign(url)`.
  - Al montar, si hay `?conectada=` muestra el toast "{Proveedor} quedó conectada"; si hay `?error=`, `toast.error(mensaje)`. Después hace `router.replace('/ajustes/conexiones')`.

- [ ] **Paso 1: Escribir las pruebas que fallan**

`TarjetaConexion.test.tsx`:
- `'sin conectar ofrece Conectar con Meta en Facebook'`.
- `'conectada muestra la cuenta y permite elegir Por API'`: `selectOptions` llama a `alConfigurar({ publishMode: 'api' })`.
- `'sin el permiso de publicar, Por API está deshabilitada'`.
- `'acceso vencido muestra el error y Reconectar'`.
- `'la nota de YouTube aparece en modo API'`.
- `'la casilla de dominio verificado solo aparece en TikTok'`.
- `'Desconectar pide confirmación'`.

`PestanasAjustes.test.tsx`: marca la pestaña activa con `aria-current`.

Prueba de la página con `useConexiones` y `ejecutarAccionConexion` simulados: `'el retorno conectado muestra el toast y limpia la URL'`.

- [ ] **Paso 2: Ejecutar y verificar que fallan**

Run: `pnpm vitest run --project web`
Expected: FAIL.

- [ ] **Paso 3: Implementar** con los componentes de la fase 1: `neu-elevado`, `boton-oro`, Dialog de shadcn y `select` nativo estilado, como en el editor.

- [ ] **Paso 4: Ejecutar y verificar que pasan**

Run: `pnpm --filter @omnistream/web lint && pnpm vitest run --project web && pnpm --filter @omnistream/web typecheck && pnpm --filter @omnistream/web build`
Expected: PASS.

- [ ] **Paso 5: Commit**

```bash
git add apps/web
git commit -m "feat(web): Ajustes > Conexiones"
```

---

### Tarea 15: Web: sección de TikTok, modos en el editor y detalle

**Archivos:**
- Crear: `apps/web/src/components/publicaciones/SeccionTiktok.tsx` (+ prueba), `apps/web/src/lib/conexiones/useInfoCreadorTiktok.ts`
- Modificar:
  - `apps/web/src/lib/publicaciones/{formulario,revisarEnvio}.ts` (+ pruebas).
  - `apps/web/src/components/publicaciones/{EditorPublicacion,DetallePublicacion}.tsx` (+ pruebas).
  - `apps/web/src/app/(app)/crear/page.tsx`, `apps/web/src/app/(app)/publicaciones/[id]/editar/page.tsx`.

**Interfaces:**
- Consume: Tareas 1, 2, 10 y 14.
- Produce:
  ```ts
  export function useInfoCreadorTiktok(activo: boolean): { info: InfoCreadorTiktok | null; cargando: boolean; error: string | null };
  export function SeccionTiktok(props: {
    info: InfoCreadorTiktok | null; cargando: boolean; error: string | null;
    valores: CamposTiktok; formato: 'tiktok' | 'imagen'; duracionSeg?: number; alCambiar(v: CamposTiktok): void;
  }): JSX.Element;
  // FormularioPublicacion: + tiktok: CamposTiktok (FORMULARIO_VACIO usa CAMPOS_TIKTOK_POR_DEFECTO)
  // EditorPublicacion: + modos: Partial<Record<Platform, ModoPublicacion>>; + infoTiktok: ReturnType<typeof useInfoCreadorTiktok>
  // revisarEnvio: el contexto suma modos y duracionMaximaTiktokSeg?
  ```

**Contenido de `SeccionTiktok`** (`<section aria-label="TikTok">`, sección 7.4.1 y pautas de TikTok):
- **Cuenta:** "Publicará como {nickname} (@{username})". Mientras carga: "Consultando tu cuenta de TikTok…". Con `error`: el mensaje.
- **Privacidad:** `select` "¿Quién puede verlo?" con la primera opción vacía "Elige una opción" (sin valor por defecto) y las opciones de `info.privacidades` con `ETIQUETAS_PRIVACIDAD_TIKTOK`. "Solo yo" queda deshabilitada si `commercial.brandedContent`, con el texto "El contenido de marca no puede ser privado.".
- **Interacciones:**
  - Casillas "Permitir comentarios", "Permitir Duet" y "Permitir Stitch". Las dos últimas no aparecen en `imagen`.
  - Empiezan sin marcar. Se deshabilitan y desmarcan si la cuenta lo tiene desactivado, con "Desactivado en tu cuenta de TikTok.".
- **Contenido comercial:** interruptor "Divulgar contenido comercial", que al activarse muestra:
  - Las casillas "Tu marca" ("Se etiquetará como «Contenido promocional».") y "Contenido de marca" ("Se etiquetará como «Colaboración pagada».").
  - Si no se marca ninguna: "Indica si tu contenido te promociona a ti, a un tercero o a ambos.".
- **Duración:** si `duracionSeg > info.duracionMaximaSeg`: "Tu cuenta de TikTok admite videos de hasta {formatearDuracion(max)}.".
- **Consentimiento:**
  - "Al publicar, aceptas la [Confirmación de uso de música](https://www.tiktok.com/legal/page/global/music-usage-confirmation/en) de TikTok."
  - Con contenido de marca: "Al publicar, aceptas la [Política de contenido de marca](https://www.tiktok.com/legal/page/global/bc-policy/en) y la [Confirmación de uso de música](...) de TikTok."

**Cambios en el editor:**
- **Redes:** junto a cada red marcada, "Por API" o "Manual", según `modos`.
- **Sección TikTok:** solo con `redes.tiktok` y `modos.tiktok === 'api'`.
- **Validación:** `revisarEnvio` pasa `modos` a `validarPublicacion` y agrega el error de duración cuando `duracionMaximaTiktokSeg` lo excede.
- **Páginas `crear` y `editar`:**
  - Calculan `modos` con `useConexiones` y `modoDePublicacion(conexion, formato)` por cada red marcada.
  - Llaman a `useInfoCreadorTiktok(modos.tiktok === 'api')`.

**Cambios en el detalle:**
- Cada destino muestra "Por API" o "Manual" (`publishMode`).
- Con `lastError.kind === 'auth'`, el enlace "Reconectar en Ajustes" va a `/ajustes/conexiones`.
- TikTok con `publishMode === 'api'` y estado `publicando` o `publicada` muestra "TikTok puede tardar unos minutos en procesarla y mostrarla en tu perfil.".

- [ ] **Paso 1: Escribir las pruebas que fallan**

`SeccionTiktok.test.tsx`:
- `'la privacidad no tiene valor por defecto y usa las opciones de la cuenta'`.
- `'Solo yo se deshabilita con contenido de marca'`.
- `'las interacciones desactivadas en la cuenta quedan deshabilitadas'`.
- `'en imagen solo se ofrece comentarios'`.
- `'el contenido comercial exige elegir una opción'`.
- `'la frase de consentimiento cambia con el contenido de marca'`: revisa los dos `href`.
- `'avisa si el video excede la duración de la cuenta'`.

Editor y formulario:
- `formulario.test.ts`: ida y vuelta de `tiktok` con `aEntrada` y `aFormulario`.
- `EditorPublicacion.test.tsx`:
  - `'la sección de TikTok solo aparece en modo API'`.
  - `'Programar sin privacidad de TikTok por API muestra el error y no confirma'`.
  - `'cada red muestra su modo'`.

`DetallePublicacion.test.tsx`:
- `'muestra el modo de cada destino'`.
- `'un error de autenticación enlaza a Conexiones'`.
- `'TikTok por API avisa que puede tardar unos minutos'`.

- [ ] **Paso 2: Ejecutar y verificar que fallan**

Run: `pnpm vitest run --project web`
Expected: FAIL.

- [ ] **Paso 3: Implementar.**

- [ ] **Paso 4: Ejecutar y verificar que pasan**

Run: `pnpm --filter @omnistream/web lint && pnpm vitest run --project web && pnpm --filter @omnistream/web typecheck && pnpm --filter @omnistream/web build`
Expected: PASS.

- [ ] **Paso 5: Commit**

```bash
git add apps/web
git commit -m "feat(web): publicación de TikTok según sus pautas y modo por red"
```

---

### Tarea 16: Promoción del Principal y retención de 0 días en core

**Archivos:**
- Crear: `packages/core/src/publicaciones/promocion.ts`, `promocion.test.ts`
- Modificar:
  - `packages/core/src/ajustes.ts`: `retentionDays` 0–90, por defecto 0; `promotionTemplate`.
  - `packages/core/src/archivos/retencion.ts` y `publicaciones/{tipos,conversion,entrada,avisos}.ts` (+ pruebas).

**Interfaces:**
- Produce:
  ```ts
  export type TipoPromocion = 'short' | 'comunidad' | 'exposicion';
  export const ETIQUETAS_TIPO_PROMOCION: Record<TipoPromocion, string>; // 'Short', 'Comunidad', 'Exposición'
  export interface PlantillaPromocion { type: TipoPromocion; title: string; offsetDays: number }
  export const PLANTILLA_PROMOCION_POR_DEFECTO: PlantillaPromocion[];
  //   Short 1 (+1), Short 2 (+3), Short 3 (+5), Post en Comunidad (+2), Exposición en medios propios (0)
  export interface ItemPromocion {
    id: string; type: TipoPromocion; title: string; offsetDays: number; dueAt: Date | null; dueAtEdited: boolean;
    status: 'pendiente' | 'hecho'; hijaId?: string; note?: string; notifiedAt?: Date;
  }
  // Publicacion: + origin?: 'omnistream' | 'youtube_importado'; promotion?: { items: ItemPromocion[] }; awaitingPublicationUntil?: Date
  export function fechaBasePromocion(principal: Pick<Publicacion, 'scheduledAt'>, youtube?: Pick<Destino, 'remote' | 'scheduledAt'>): Date | null;
  export function crearPromocion(plantilla: readonly PlantillaPromocion[], base: Date | null, nuevoId: () => string): ItemPromocion[];
  export function recalcularFechas(items: readonly ItemPromocion[], base: Date | null): ItemPromocion[];
  export function asignarHija(items: readonly ItemPromocion[], hijaId: string): ItemPromocion[];
  export function vencidosSinAviso(items: readonly ItemPromocion[], ahora: Date): ItemPromocion[];
  export function proximos(items: readonly ItemPromocion[], ahora: Date, dias?: number): ItemPromocion[]; // por defecto 7
  export function avisoPromocion(datos: { postId: string; tituloPrincipal: string; item: Pick<ItemPromocion, 'title'> }): Aviso;
  // TipoAviso: + 'promocion'
  export const itemPromocionSchema; // para la acción actualizarPromocion
  // accionPublicacionSchema: + { accion: 'actualizarPromocion', postId, items } y { accion: 'importarYoutube', url }
  ```

**Valores:**
- **`fechaBasePromocion`:** `youtube.remote.publishedAt ?? youtube.scheduledAt ?? principal.scheduledAt ?? null`.
- **`dueAt`:** `base + offsetDays` días; con base `null`, queda `null`.
- **`recalcularFechas`:** cambia solo los `dueAtEdited: false`. Si cambia el `dueAt` de un pendiente, borra su `notifiedAt`.
- **`asignarHija`:** marca `hecho` el primer `short` pendiente sin `hijaId` y le asigna esa Hija. Si la Hija ya está asignada, no cambia nada.
- **`avisoPromocion`:** `{ tipo: 'promocion', titulo: 'Promoción pendiente', cuerpo: '{item.title} · {tituloPrincipal}', enlace: '/publicaciones/{postId}' }`.
- **`calcularPurga` con `retentionDays: 0`:** la fecha de purga es la del último destino que quedó terminal.
- **Mensaje de ajustes:** `'La retención debe estar entre 0 y 90 días.'`.

- [ ] **Paso 1: Escribir las pruebas que fallan**

`promocion.test.ts`:
- `'la plantilla por defecto crea 5 pendientes con fechas relativas a la base'`: con base `2026-10-10T15:00Z`, Short 1 vence `2026-10-11T15:00Z` y la exposición `2026-10-10T15:00Z`.
- `'sin fecha base los pendientes quedan sin fecha'`.
- `'recalcular mueve las fechas no editadas, conserva las editadas y rearma el aviso'`.
- `'una Hija cumple el siguiente short y no se asigna dos veces'`.
- `'vencidosSinAviso excluye los hechos, los futuros y los ya avisados'`.
- `'proximos devuelve los pendientes de los próximos 7 días'`.
- `'la fecha base prefiere la publicación real en YouTube'`.

Otras pruebas:
- `avisos.test.ts`: `avisoPromocion` produce el aviso descrito.
- `ajustes.test.ts`: 0 es válido, 91 es inválido con el mensaje, y el valor por defecto es 0 con `PLANTILLA_PROMOCION_POR_DEFECTO`.
- `retencion.test.ts`: con `retentionDays: 0`, la purga es el instante del último destino terminal.
- `entrada.test.ts`: acepta `importarYoutube` con URL y `actualizarPromocion` con items válidos, y rechaza un `type` desconocido.
- `conversion.test.ts`: `leerPublicacion` convierte `promotion.items[].dueAt` y `notifiedAt`.

- [ ] **Paso 2: Ejecutar y verificar que fallan**

Run: `pnpm vitest run --project core`
Expected: FAIL.

- [ ] **Paso 3: Implementar.**

- [ ] **Paso 4: Ejecutar y verificar que pasan**

Run: `pnpm vitest run --project core && pnpm -r typecheck`
Expected: PASS. La web puede requerir ajustar el `min` del campo de retención: se hace en la Tarea 18.

- [ ] **Paso 5: Commit**

```bash
git add packages/core
git commit -m "feat(core): promoción del Principal y retención de 0 días"
```

---

### Tarea 17: Funciones: importar desde YouTube, promoción y purga inmediata

**Archivos:**
- Crear: `functions/src/publicacion/acciones/{importar,promocion}.ts`, `pruebas/integracion/src/funciones/{importarYoutube,promocion}.test.ts`
- Modificar:
  - `packages/platforms/src/youtube.ts` (+ `obtenerVideo` y su prueba de contrato).
  - `functions/src/publicacion/{publicaciones,alCambiarDestino,encolarPendientes,limpiarRetencion}.ts` y `functions/src/publicacion/acciones/guardar.ts`.

**Interfaces:**
- Consume: Tareas 4, 9 y 16.
- Produce:
  ```ts
  // platforms/youtube.ts
  export interface VideoYoutube { id: string; channelId: string; title: string; description: string;
    privacy: 'public' | 'unlisted' | 'private'; publishAt?: Date; publishedAt?: Date }
  export async function obtenerVideo(videoId: string, ctx: ContextoLectura): Promise<VideoYoutube | null>; // GET videos?part=snippet,status&id=
  // functions
  export async function importarYoutube(url: string, deps: DependenciasAccion & { sesion(red: Platform): Promise<SesionProveedor>; http: Http }): Promise<RespuestaPublicaciones>;
  export async function actualizarPromocion(postId: string, items: ItemPromocion[], deps: DependenciasAccion): Promise<RespuestaPublicaciones>;
  export async function activarReferenciasDeHijas(db: Firestore, principalId: string, deps: DependenciasCambio, idEvento: string): Promise<void>; // extraída de reaccionarACambio
  export async function avisarPromocion(db: Firestore, notificar: Notificador, ahora: Date): Promise<number>;
  export async function purgarSiTerminal(db: Firestore, bucket: Bucket, assetId: string, ahora: Date): Promise<boolean>; // de limpiarRetencion
  ```

**Comportamiento:**
- **`importarYoutube`:**
  - Errores, en orden:
    - `analizarUrlPublica('youtube', url)` no da id → `invalid-argument` `'La URL no corresponde a un video de YouTube.'`.
    - YouTube sin conexión → `failed-precondition` `'Conecta YouTube en Ajustes > Conexiones para importar videos.'`.
    - Video inexistente → `not-found` `'No se encontró ese video en YouTube.'`.
    - Video de otro canal → `failed-precondition` `'El video no pertenece a tu canal conectado.'`.
  - Crea con `create()` el post `posts/yt-{id}`:
    - `kind: 'principal'`, `origin: 'youtube_importado'`, `title` y `base: { text: description, hashtags: [] }`.
    - `scheduledAt: publishAt ?? publishedAt`.
    - `promotion` a partir de `settings/app.promotionTemplate`, o la plantilla por defecto.
    - `awaitingPublicationUntil`: `publishAt` si es futuro.
  - Crea el destino `youtube`:
    - `format: 'video_largo'`, `status: 'publicada'`, `publishMode: 'manual'`, `parentRef: { status: 'no_aplica' }`.
    - `remote: { id, url: urlVideoYoutube(id), publishedAt: publishAt ?? publishedAt ?? ahora }`.
  - Si el post ya existe (ALREADY_EXISTS) → `already-exists` `'Ese video ya está en OmniStream.'`.
  - Requiere el alcance `youtube.readonly`, que ya está en `ALCANCES_YOUTUBE`.
- **Referencias en espera:** `principalPublicado` exige además que `remote.publishedAt <= ahora`. `encolarPendientesAhora` busca los Principales con `awaitingPublicationUntil <= ahora`, llama a `activarReferenciasDeHijas` (id de evento `espera-{postId}`) y borra el campo.
- **`actualizarPromocion`:**
  - Solo para `kind: 'principal'`; si no → `failed-precondition` `'Solo un video principal tiene lista de promoción.'`.
  - Reemplaza los items. Conserva el `notifiedAt` de un item cuyo `dueAt` no cambió y recalcula el `dueAt` de los no editados con la fecha base actual.
- **`guardarPublicacion`:** un Principal nuevo recibe `promotion` desde la plantilla.
- **`reaccionarACambio`:**
  - Si cambia el destino `youtube` de un Principal, llama a `recalcularFechas`.
  - Cuando un destino de una Hija pasa a `publicada`, ejecuta `asignarHija` en una transacción sobre su Principal.
  - Con `retentionDays === 0` y `assetId`, llama a `purgarSiTerminal`.
- **`avisarPromocion`:** corre en `encolarPendientesAhora`. Por cada `vencidosSinAviso`, `notificar('promocion-{postId}-{itemId}', avisoPromocion(...))` y fija `notifiedAt` en una transacción.

- [ ] **Paso 1: Escribir las pruebas que fallan**

- Contrato (`youtube.test.ts`): `'obtenerVideo lee snippet y status'` (con `publishAt`) y `'un id inexistente devuelve null'`.
- Integración, con sesión y `http` falsos:
  - `'importar un video publicado crea el Principal con su lista de promoción'`: 5 items, `dueAt` relativos a `publishedAt`.
  - `'importar un video programado deja sus Hijas en espera hasta publishAt'`: a `publishAt − 1 min`, `encolarPendientesAhora` no activa la referencia; a `publishAt + 1 min`, sí, y borra `awaitingPublicationUntil`.
  - `'importar dos veces el mismo video falla sin duplicar'`, `'un video de otro canal se rechaza'` y `'sin conexión de YouTube pide conectarla'`.
  - `'una Hija publicada cumple el siguiente short del Principal'`.
  - `'mover el Principal recalcula las fechas no editadas'`.
  - `'un pendiente vencido avisa una sola vez'`: dos ejecuciones dan un solo documento en `notifications`.
  - `'con retención 0 el original se purga al publicarse la última red'`: `assets/{id}.status === 'purgado'` sin esperar a `limpiarRetencion`.
  - `'actualizarPromocion conserva el aviso de un item sin cambio de fecha'`.

- [ ] **Paso 2: Ejecutar y verificar que fallan**

Run: `pnpm vitest run --project platforms && pnpm test:integracion`
Expected: FAIL.

- [ ] **Paso 3: Implementar.**

- [ ] **Paso 4: Ejecutar y verificar que pasan**

Run: `pnpm --filter @omnistream/functions typecheck && pnpm vitest run --project platforms && pnpm test:integracion`
Expected: PASS.

- [ ] **Paso 5: Commit**

```bash
git add packages/platforms functions pruebas/integracion
git commit -m "feat(functions): importar desde YouTube, promoción con avisos y purga inmediata"
```

---

### Tarea 18: Web: importar desde YouTube, panel de promoción y ajustes

**Archivos:**
- Crear:
  - `apps/web/src/components/publicaciones/{ImportarYoutube,PanelPromocion}.tsx` (+ pruebas).
  - `apps/web/src/components/ajustes/PlantillaPromocion.tsx` (+ prueba).
  - `apps/web/src/lib/publicaciones/promocion.ts` (`usePromocionesPendientes`).
- Modificar:
  - `apps/web/src/app/(app)/crear/page.tsx`, `apps/web/src/components/publicaciones/DetallePublicacion.tsx`.
  - `apps/web/src/components/pendientes/ListaPendientes.tsx`, `apps/web/src/app/(app)/pendientes/page.tsx`.
  - `apps/web/src/components/ajustes/FormularioAjustes.tsx`, `apps/web/src/app/(app)/ajustes/general/page.tsx`.

**Interfaces:**
- Consume: Tareas 14, 16 y 17.
- Produce:
  ```ts
  export function ImportarYoutube(props: { conectado: boolean; alImportar(url: string): Promise<void> }): JSX.Element;
  export function PanelPromocion(props: { publicacion: Publicacion; hijas: Publicacion[]; zona: string; ahora?: () => Date;
    alGuardar(items: ItemPromocion[]): Promise<void> }): JSX.Element;
  export function PlantillaPromocion(props: { valores: PlantillaPromocion[]; alCambiar(v: PlantillaPromocion[]): void }): JSX.Element;
  export function usePromocionesPendientes(ahora?: Date): { postId: string; tituloPrincipal: string; item: ItemPromocion; vencido: boolean }[];
  ```

**Textos y comportamiento:**
- **`ImportarYoutube`** (en `/crear`, sobre el editor; `<section aria-label="Importar desde YouTube">`):
  - Campo "URL del video de YouTube" y botón "Importar".
  - Con `conectado: false`: "Conecta YouTube en Ajustes > Conexiones para importar videos." con enlace, y sin campo.
  - Al importar con éxito, lleva a `/publicaciones/{id}`.
- **`PanelPromocion`** (solo en el detalle de un Principal; `<section aria-label="Promoción">`):
  - Título "Promoción" y progreso "{hechos} de {total}".
  - Por item: casilla con el título, la etiqueta del tipo, la fecha en la zona con un campo editable (editar marca `dueAtEdited`), "Restablecer fecha" si fue editada, nota opcional y, en shorts cumplidos, un enlace a la Hija.
  - Un vencido muestra "Vencido" en color de alerta.
  - Botones "Agregar pendiente" y "Quitar", y "Guardar promoción" para guardar.
  - Comunidad lleva la ayuda "YouTube no permite publicar en Comunidad por API: hazlo en YouTube Studio y márcalo aquí."
  - Un Principal importado muestra "Importado de YouTube" con el enlace al video.
- **`/pendientes`:** nueva sección "Promoción" con los vencidos y los de los próximos 7 días, ordenados por `dueAt`, cada uno con enlace al Principal. `usePromocionesPendientes` consulta `posts` con `kind == 'principal'` y filtra en el cliente.
- **Ajustes generales:**
  - "Días de retención" admite 0, con la ayuda "0 = borrar el video en cuanto se publica en todas sus redes."
  - Tarjeta "Plantilla de promoción": lista editable de tipo, título y días desde la publicación. Se guarda en `settings/app.promotionTemplate`.

- [ ] **Paso 1: Escribir las pruebas que fallan**

`ImportarYoutube`:
- `'sin conexión pide conectar YouTube'`.
- `'importa la URL'`: `alImportar` recibe la URL sin espacios de los extremos.

`PanelPromocion`:
- `'muestra el progreso y marca un vencido'`.
- `'editar la fecha marca dueAtEdited y Restablecer la quita'`.
- `'marcar hecho y guardar envía los items'`.
- `'agregar y quitar pendientes'`.
- `'un short cumplido enlaza a su Hija'`.

Otras:
- `PlantillaPromocion`: `'edita la plantilla'`.
- `ListaPendientes`: `'la sección Promoción lista vencidos y próximos'`.
- `FormularioAjustes`: `'acepta 0 días de retención'`.

- [ ] **Paso 2: Ejecutar y verificar que fallan**

Run: `pnpm vitest run --project web`
Expected: FAIL.

- [ ] **Paso 3: Implementar.**

- [ ] **Paso 4: Ejecutar y verificar que pasan**

Run: `pnpm --filter @omnistream/web lint && pnpm vitest run --project web && pnpm --filter @omnistream/web typecheck && pnpm --filter @omnistream/web build`
Expected: PASS.

- [ ] **Paso 5: Commit**

```bash
git add apps/web
git commit -m "feat(web): importar desde YouTube, promoción del Principal y plantilla"
```

---

### Tarea 19: E2E de la fase 2B, guía, despliegue y README

**Archivos:**
- Crear: `apps/web/e2e/fase2b.spec.ts`
- Modificar: `docs/configuracion.md`, `README.md`, `.github/workflows/desplegar.yml`

**Interfaces:**
- Consume: todo lo anterior; `adminDemo` y `entrarComo`.

- [ ] **Paso 1: Escribir las pruebas E2E**

```ts
test('Conexiones lista las 4 redes y Conectar lleva a TikTok con state', async ({ page }) => {
  await page.goto('/entrar');
  await entrarComo(page, 'propietario@omnistream.test');
  await page.goto('/ajustes/conexiones');
  for (const red of ['Facebook', 'Instagram', 'YouTube', 'TikTok']) {
    await expect(page.getByRole('region', { name: red }).getByText('Sin conectar')).toBeVisible();
  }
  const autorizacion = page.waitForRequest((r) => r.url().startsWith('https://www.tiktok.com/v2/auth/authorize/'));
  await page.route('https://www.tiktok.com/**', (ruta) => ruta.abort());
  await page.getByRole('region', { name: 'TikTok' }).getByRole('button', { name: 'Conectar con TikTok' }).click();
  const url = new URL((await autorizacion).url());
  expect(url.searchParams.get('client_key')).toBe('demo-tiktok');
  expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:3000/api/conexiones/retorno');
  expect(url.searchParams.get('state')?.length).toBeGreaterThanOrEqual(43);
});

test('una red conectada pasa a modo API y lo conserva', async ({ page }) => {
  await db.doc('connections/youtube').set({
    platform: 'youtube', authStatus: 'conectada', publishMode: 'manual', readEnabled: true,
    scopes: ['https://www.googleapis.com/auth/youtube.upload'], account: { id: 'UC1', name: 'Mi canal' },
  });
  // entrar → /ajustes/conexiones → región YouTube muestra 'Mi canal' → selectOption('api') → recargar → el selector vale 'api'
});

test('un Principal con promoción vencida aparece en Pendientes y se marca hecho', async ({ page }) => {
  // admin: posts/yt-e2e (kind 'principal', origin 'youtube_importado', promotion con un item 'Post en Comunidad' vencido ayer)
  // → entrar → /pendientes muestra la sección Promoción con 'Post en Comunidad' y 'Vencido'
  // → clic al enlace → /publicaciones/yt-e2e → marcar la casilla → Guardar promoción → progreso '1 de 1'
});

test('el retorno de OAuth sin state válido vuelve a Conexiones con el error', async ({ page }) => {
  // entrar → page.goto('/api/conexiones/retorno?state=falso&code=x') → URL /ajustes/conexiones
  // → toast 'La conexión venció o no es válida. Vuelve a intentarlo.'
});
```
`db` sale de `adminDemo('e2e2b')`. `beforeAll` borra `connections/*` para empezar sin conexiones.

- [ ] **Paso 2: Ejecutar y verificar**

Run: `pnpm test:e2e`
Expected: PASS (fases 1, 2A y 2B, con la prueba de promoción). Si una prueba falla, se corrige la causa en la tarea correspondiente.

- [ ] **Paso 3: Actualizar la guía, el despliegue y el README**

`docs/configuracion.md`:
- **"Ejecutar en local":** `scripts/secretos-demo.cjs` crea `functions/.secret.local` con valores de demostración. Los conectores no llaman a las redes en local: conectar una red real requiere el proyecto de producción.
- **Nueva sección "Producción: fase 2B"**, en orden:
  0. **Costos (D17).** En Google Cloud > Facturación > Presupuestos y alertas, crea un presupuesto mensual de 1 USD con alertas al 50 %, 90 % y 100 %. Ejecuta `firebase functions:artifacts:setpolicy` para que se borren las imágenes antiguas de las funciones. En Ajustes, deja la retención en 0 días.
  1. **URL pública.** El dominio de Vercel (o el propio) es `URL_PUBLICA`. En Vercel, agrega `FUNCIONES_URL=https://us-central1-{proyecto}.cloudfunctions.net` y vuelve a desplegar.
  2. **Parámetros.** En GitHub (Settings > Secrets and variables > Actions > Variables), crea `URL_PUBLICA`, `META_APP_ID`, `META_CONFIG_ID`, `GOOGLE_CLIENT_ID` y `TIKTOK_CLIENT_KEY`. El flujo "Desplegar" los escribe en `functions/.env.{proyecto}`.
  3. **Secretos.** Con `firebase functions:secrets:set`:
     - `CLAVE_CIFRADO`, generada con `openssl rand -base64 32`.
     - `META_APP_SECRET`, `GOOGLE_CLIENT_SECRET` y `TIKTOK_CLIENT_SECRET`.

     La cuenta de despliegue necesita el rol "Administrador de Secret Manager".
  4. **Google (YouTube):**
     - Habilita YouTube Data API v3 y YouTube Analytics API.
     - En la pantalla de consentimiento (tipo Externo), agrega los permisos `youtube.upload`, `youtube.force-ssl`, `youtube.readonly` y `yt-analytics.readonly`, y publica la app ("En producción"; con "Prueba", el acceso caduca cada 7 días).
     - Crea un cliente OAuth de tipo Aplicación web con el URI de redirección `{URL_PUBLICA}/api/conexiones/retorno`.
     - Mientras el proyecto no pase la auditoría, YouTube deja privados los videos subidos por API: usa el modo manual o solicita la auditoría.
  5. **Meta (Facebook e Instagram):**
     - Crea una app de tipo Negocio con Facebook Login for Business.
     - Crea una configuración con los permisos `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `pages_manage_engagement`, `instagram_basic`, `instagram_content_publish`, `instagram_manage_comments`, `business_management`, `read_insights` e `instagram_manage_insights`. Su id es `META_CONFIG_ID`.
     - URI de redirección válido: `{URL_PUBLICA}/api/conexiones/retorno`. Política de privacidad: `{URL_PUBLICA}/privacidad`. Devolución de llamada de eliminación de datos: `{URL_PUBLICA}/api/meta/borrado-datos`.
     - La cuenta de Instagram debe ser profesional y estar vinculada a la página.
     - **V1:** en modo desarrollo, lo publicado solo lo ven las personas con rol en la app. Para publicar por API, pasa la app a modo Live y confirma que la primera publicación se ve sin iniciar sesión. Si Meta exige App Review para pasarla a Live, deja Facebook e Instagram en manual.
  6. **TikTok:**
     - Crea una app con Login Kit y Content Posting API (Direct Post), con los permisos `user.info.basic`, `user.info.profile`, `video.publish` y `video.list`.
     - URI de redirección: `{URL_PUBLICA}/api/conexiones/retorno`.
     - Para fotos, verifica el prefijo de URL `{URL_PUBLICA}/api/media/` y marca "Dominio verificado en TikTok para fotos" en Conexiones.
     - **V2:** sin auditoría, TikTok solo publica en privado y en cuentas privadas; TikTok queda en manual hasta la auditoría.
  7. **Conectar.** En Ajustes > Conexiones, conecta cada red y elige "Por API" donde corresponda.
  8. **Verificación (criterio 2B):**
     - Por cada red en API: publica ahora un video y confirma que pasa a "Publicada" con su enlace.
     - Publica una Hija y confirma su referencia: comentario en Facebook, Instagram y YouTube; descripción en TikTok.
     - Desconecta y vuelve a conectar.
     - Registra el resultado de V1 a V3 en la spec (sección 15).
- **Tabla "Próximas fases":** quita las filas de 2B.

`.github/workflows/desplegar.yml`: el paso "Configurar el correo permitido" escribe, además de `ALLOWED_EMAIL`, las 5 variables `URL_PUBLICA`, `META_APP_ID`, `META_CONFIG_ID`, `GOOGLE_CLIENT_ID` y `TIKTOK_CLIENT_KEY` desde `vars.*`.

`README.md`: enlace al plan de la fase 2B; fila `packages/platforms` ("Conectores de Facebook, Instagram, YouTube y TikTok"); fila `functions` ("acceso, procesamiento de archivos, publicación y conexiones").

- [ ] **Paso 4: Verificación completa**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm --filter @omnistream/web build && pnpm test:integracion && pnpm test:e2e`
Expected: PASS.

- [ ] **Paso 5: Commit**

```bash
git add apps/web docs README.md .github
git commit -m "test(e2e): conexiones de la fase 2B y guía de producción"
```
