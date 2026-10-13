# Fase 3 (Smart Canvas): plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: usar superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para implementar este plan tarea por tarea. Los pasos usan casillas (`- [ ]`) para el seguimiento.

**Objetivo:** convertir Crear y Editar en el flujo de seis pasos de la spec (Archivo → Destinos → Canvas → Contenido → Vista previa → Publicar) con autoguardado. El Canvas muestra las advertencias de cada red, las zonas seguras y un recorte por red que `generarRecorte` convierte en un archivo derivado. Cada red publica su derivado, por API o en el paquete manual. Se suman los ajustes por red (desvincular y revincular texto, hashtags, título, recorte y hora) y la vista previa en maquetas de teléfono.

**Arquitectura:**
- **`core`:** suma el tipo `Crop` y el cálculo puro de recortes: recorte centrado, ajuste al mover o ampliar, píxeles pares para ffmpeg, resolución de salida y huella `cropHash`. También las zonas seguras como datos, la combinación `efectivo = override ?? base` y la validación que tiene en cuenta el recorte. La web y las funciones usan exactamente esas funciones, así las advertencias del Canvas coinciden con las del servidor.
- **`functions`:**
  - `guardar` persiste `overrides`. Cuando el recorte cambia, marca `derivative` como `pendiente` y encola `generarRecorte`, una cola nueva con 4 GiB que usa ffmpeg para video y sharp para imagen.
  - `publicarDestino` publica el derivado listo o espera a que lo esté.
  - El paquete manual descarga el derivado.
- **Web:** el editor actual se divide en un contenedor de pasos y un componente por paso. El estado sigue siendo un solo `FormularioPublicacion`, que ahora lleva `overrides` por red.

**Stack:** lo de las fases anteriores. ffmpeg (`ffmpeg-static`, con libx264) y sharp, que ya están en `functions`. Pointer Events del navegador para arrastrar el recorte. Sin dependencias nuevas.

**Spec:** `docs/superpowers/specs/2026-10-07-omnistream-design.md`: secciones 5.4 (`generarRecorte`), 6.3 (rutas de Storage), 6.4 (`overrides`, `Crop` y `derivative`), 7.4 (resoluciones de salida), 7.7 (los derivados se purgan con su original), 8 completa, 12 (cálculo de recortes con dimensiones pares) y la fila 3 de la sección 14.

## Restricciones globales

- **Lo que ya rige:**
  - Node.js ≥ 22 y solo pnpm.
  - TypeScript `strict` con `noUncheckedIndexedAccess`.
  - Español neutro sin voseo, locale `es-419`.
  - Región `us-central1` y proyecto de emuladores `demo-omnistream`.
  - Commits en español con prefijo convencional.
  - El cliente nunca escribe `posts`, `targets`, `attempts`, `notifications` ni `connections`.
  - Ninguna prueba llama a las redes reales.
  - Los mensajes que ve el usuario están en español y los fija este plan.
- **Una sola fuente de reglas:** el estado de cada red en el Canvas (correcto, advertencia o error) se calcula con `validarPublicacion` de `core`, la misma función que valida el servidor al programar. Ninguna regla de recorte, proporción o resolución se escribe dos veces.
- **`Crop`:** coordenadas normalizadas de 0 a 1 sobre el original ya rotado, con `aspect` en `'16:9' | '9:16' | '1:1' | '4:5' | '1.91:1'` (spec 6.4).
- **Resoluciones de salida (spec 7.4):** 9:16 → 1080×1920; 1:1 → 1080×1080; 4:5 → 1080×1350; 16:9 → 1920×1080; 1.91:1 → 1080×566.
- **Límite del recorte de video:** solo para videos de hasta 15 minutos y 2 GB (spec 8.3).
- **Ruta del derivado:** `derivados/{postId}/{red}/{cropHash}.{mp4|jpg}` (spec 6.3). Se purga con el original, porque `limpiarRetencion` y `purgarSiTerminal` ya borran `derivados/{postId}/`.
- **Memoria:**
  - `generarRecorte`: 4 GiB, `timeoutSeconds: 1800`, `maxConcurrentDispatches: 2`.
  - `publicarDestino` sigue con 1 GiB y no genera recortes.

## Decisiones de este plan (rulings; la Tarea 1 actualiza la spec)

1. **`publicarDestino` espera el derivado en vez de generarlo.**
   - **Por qué:** la spec 8.3 dice que lo genera al publicar si no está listo, pero `publicarDestino` tiene 1 GiB y el recorte de un video de 15 minutos necesita los 4 GiB de `generarRecorte`.
   - **Qué hace:** si el derivado no está listo, encola `generarRecorte` (si falta) y vuelve a encolar la tarea de publicación cada 120 s, con id `{postId}-{red}-v{scheduleVersion}-d{n}`.
   - **Límite:** a la espera número 15 (30 min), el destino queda `fallida` con "No se pudo generar el recorte para {Red}.".
   - Lo mismo vale para el modo manual: el paquete se habilita cuando el derivado está listo.
2. **Recortes con cola de espera de 60 s y huella.**
   - `generarRecorte` se encola con `scheduleTime = ahora + 60 s` e id `{postId}-{red}-{cropHash}`.
   - Una tarea cuyo `cropHash` ya no coincide con el del destino termina sin hacer nada.
   - Arrastrar el recorte con autoguardado deja una sola generación real: la del último recorte.
   - Al terminar un derivado nuevo se borran los anteriores de `derivados/{postId}/{red}/`.
3. **`cropHash`:**
   - Es FNV-1a de 32 bits en base 36 sobre `{assetId}|{aspect}|{x}|{y}|{w}|{h}`, con coordenadas redondeadas a 4 decimales.
   - Vive en `core`, así web y funciones calculan lo mismo, y no usa `node:crypto` (`core` corre en el navegador).
   - Cambiar el archivo de la publicación cambia la huella y obliga a regenerar.
4. **Autoguardado solo en borradores.** Se guarda 1 s después del último cambio y únicamente cuando:
   - hay título,
   - la jerarquía es válida (`problemasDeJerarquia` vacío),
   - y ningún destino está `programada`.

   Una publicación programada se guarda con "Guardar cambios", que la vuelve a programar una vez, como en la 2A. Los guardados se encadenan: nunca hay dos llamadas en curso. El primer guardado de `/crear` cambia la URL a `/publicaciones/{id}/editar` con `history.replaceState`, sin volver a montar el editor.
5. **Codificación del derivado:**
   - **Video:** MP4 H.264 (`libx264`, `-preset veryfast`, `-crf 20`, `-pix_fmt yuv420p`), AAC 160 kbps y `-movflags +faststart`, con el filtro `crop=W:H:X:Y,scale=OW:OH,setsar=1`. ffmpeg aplica la rotación del original antes del filtro, porque el autorrotado está activo por defecto.
   - **Imagen:** sharp con `rotate()`, `extract()`, `resize(OW, OH)` y JPEG de calidad 90. JPEG lo aceptan las cuatro redes (Instagram solo admite JPEG).
6. **Recorte mínimo y dimensiones pares:**
   - El lado menor del recorte no puede bajar del 10 % del lado correspondiente del original.
   - `pixelesDeRecorte` redondea `x`, `y`, `w` y `h` hacia abajo a números pares y nunca sale del cuadro.
7. **Zonas seguras (spec 8.3).** Son aproximaciones propias de la interfaz de cada red, sin cifras oficiales, y se muestran como guía. Los rectángulos van en porcentajes `{ x, y, w, h }`:
   - **TikTok video:**
     - `{0,0,100,8}` (barra superior)
     - `{0,80,100,20}` (descripción)
     - `{86,40,14,40}` (botones)
   - **Instagram Reel:**
     - `{0,0,100,10}`
     - `{0,78,100,22}`
     - `{85,45,15,35}`
   - **Facebook Reel:** las mismas que el Reel de Instagram.
   - **YouTube Short:**
     - `{0,0,100,9}`
     - `{0,80,100,20}`
     - `{84,42,16,38}`
   - Los demás formatos no tienen zonas.
8. **Vista previa.** Corte del texto con "... más" a partir de 125 caracteres en Instagram y Facebook y de 80 en TikTok. YouTube muestra el título completo y la descripción cortada a 100. El nombre y el avatar salen de la conexión de la red; sin cuenta, se usa "Tu cuenta".
9. **Miniatura propia del Principal (spec 8.4).**
   - Se elige una imagen ya subida (`kind: 'image'`, `listo`) de la Biblioteca y se guarda como `youtube.thumbnail = { assetId }`.
   - `fuentesDePublicacion` la usa como miniatura.
   - Las reglas de retención la tratan como cualquier archivo: no se agrega uso por miniatura. Si ya fue purgada, YouTube publica sin miniatura propia, porque el paso de miniatura ignora errores.
10. **Derivados legibles por el propietario.**
    - Nueva regla de Storage: `match /derivados/{postId}/{red}/{archivo}` con `allow read: if esPropietario()`.
    - El derivado se guarda con `firebaseStorageDownloadTokens`, como los fotogramas, para que el paquete obtenga su URL de descarga.
11. **El paso actual va en la URL:** `?paso=archivo|destinos|canvas|contenido|vista|publicar`, para que una recarga conserve el paso. Sin parámetro, se abre en Archivo al crear y en Canvas al editar.

## Foco de revisión

1. **Recorte editado mientras se genera el anterior, o tareas viejas que llegan tarde:** solo el `cropHash` vigente produce el derivado que se publica, y ningún derivado viejo queda en Storage. Prueba en la Tarea 4.
2. **Cambiar de archivo o quitar el recorte con un derivado listo:** el derivado deja de usarse, el destino publica el archivo correcto y los derivados viejos se borran. Prueba en las Tareas 3 y 4.
3. **Video rotado (`rotation: 90`) o con dimensiones impares:** el recorte se aplica sobre el cuadro ya rotado, y las dimensiones enviadas a ffmpeg son pares y caben en el cuadro. Pruebas en las Tareas 2 y 4.
4. **La hora de publicar llega antes que el derivado:** `publicarDestino` espera sin publicar el original y, tras 30 minutos, falla con un mensaje claro en vez de publicar sin recorte. Prueba en la Tarea 5.
5. **Autoguardado que coincide con "Programar" o con otro guardado:** nunca hay dos guardados en curso, programar usa la versión guardada más reciente y una publicación programada no se vuelve a programar sola. Prueba en la Tarea 6.

---

## Estructura de archivos

```
packages/core/src/
  publicaciones/recorte.ts        Crop, ASPECTOS_RECORTE, RESOLUCION_SALIDA, recorteCentrado, ajustarRecorte,
                                  pixelesDeRecorte, hashRecorte, recortePermitido
  publicaciones/zonasSeguras.ts   ZONAS_SEGURAS, zonasSeguras(red, formato)
  publicaciones/ajustes.ts        CampoAjustable, ajustesEfectivos(publicacion, destino), estadoDeRed(problemas, red)
  (modificados) tipos.ts, conversion.ts, entrada.ts, validacion.ts, efectivo.ts
functions/src/
  archivos/recortar.ts            recortarVideo, recortarImagen (ffmpeg/sharp)
  publicacion/generarRecorte.ts   ejecutarRecorte, encoladorRecortes, generarRecorte (onTaskDispatched)
  (modificados) publicacion/acciones/guardar.ts, publicacion/fuentes.ts, publicacion/publicarDestino.ts, index.ts
storage.rules                     + derivados
apps/web/src/
  components/crear/
    PasosCreacion.tsx              contenedor: barra de pasos, estado del formulario, autoguardado
    PasoArchivo.tsx  PasoDestinos.tsx  PasoCanvas.tsx  PasoContenido.tsx  PasoVistaPrevia.tsx  PasoPublicar.tsx
    canvas/ListaRedes.tsx  canvas/MarcoRecorte.tsx  canvas/TiraFotogramas.tsx  canvas/CapaZonasSeguras.tsx
    canvas/AjustesRed.tsx
    vista/MaquetaTelefono.tsx
  lib/crear/autoguardado.ts        crearAutoguardado (cola de guardados con retardo)
  lib/crear/recorteVisual.ts       estiloRecorte (CSS para simular el recorte)
  (modificados) lib/publicaciones/formulario.ts, revisarEnvio.ts, app/(app)/crear/page.tsx,
                app/(app)/publicaciones/[id]/editar/page.tsx, app/(app)/pendientes/[postId]/[red]/page.tsx,
                components/publicaciones/DetallePublicacion.tsx
  (eliminados) components/publicaciones/EditorPublicacion.tsx y su prueba: su contenido se reparte en los pasos
pruebas/integracion/src/
  fixtures.ts                      + videoHorizontal (1280×720, 4 s) y videoRotado (1280×720 con rotate=90)
  funciones/recortes.test.ts       guardar + generarRecorte + publicación con derivado
apps/web/e2e/fase3.spec.ts
```

---

### Tarea 1: Recorte y ajustes en el dominio, y la spec al día

**Archivos:**
- Crear: `packages/core/src/publicaciones/recorte.ts` y `ajustes.ts`, con sus pruebas.
- Modificar:
  - `packages/core/src/publicaciones/tipos.ts`, `conversion.ts`, `entrada.ts` e `index.ts`, con sus pruebas.
  - `docs/superpowers/specs/2026-10-07-omnistream-design.md`: secciones 5.4 y 8.3, con las decisiones 1, 2, 4 y 9.

**Interfaces:**
- Produce:
  ```ts
  // recorte.ts
  export const ASPECTOS_RECORTE = ['16:9', '9:16', '1:1', '4:5', '1.91:1'] as const;   // = Proporcion
  export type Crop = { aspect: Proporcion; x: number; y: number; w: number; h: number };
  export const RESOLUCION_SALIDA: Record<Proporcion, { width: number; height: number }>;
  export const LIMITE_RECORTE_VIDEO = { duracionSec: 900, bytes: 2 * 1024 ** 3 };
  export const LADO_MINIMO_RECORTE = 0.1;
  export function recorteCentrado(aspect: Proporcion, ancho: number, alto: number): Crop;      // el mayor posible, centrado
  export function ajustarRecorte(crop: Crop, cambio: { dx?: number; dy?: number; escala?: number }, ancho: number, alto: number): Crop;
  export function pixelesDeRecorte(crop: Crop, ancho: number, alto: number): { x: number; y: number; w: number; h: number }; // pares, dentro del cuadro
  export function hashRecorte(assetId: string, crop: Crop): string;
  export function recortePermitido(asset: Pick<Asset, 'kind' | 'durationSec' | 'sizeBytes'>): boolean;
  // tipos.ts
  //   Destino.overrides: + crop?: Crop
  //   Destino: + derivative?: { cropHash: string; storagePath?: string; status: 'pendiente' | 'generando' | 'listo' | 'fallido'; error?: string }
  //   CamposYoutube.thumbnail?: { frame: Fotograma } | { assetId: string }
  // entrada.ts
  //   destinoEntradaSchema: + overrides?: { text?, hashtags?, title?, crop?, scheduledAt?: ISO }
  //   camposYoutubeSchema.thumbnail: { frame } | { assetId }
  export const cropSchema;                     // valores en [0, 1], x + w ≤ 1, y + h ≤ 1, w y h ≥ LADO_MINIMO_RECORTE
  // ajustes.ts
  export const CAMPOS_AJUSTABLES = ['text', 'hashtags', 'title', 'crop', 'scheduledAt'] as const;
  export type CampoAjustable = (typeof CAMPOS_AJUSTABLES)[number];
  export interface AjustesEfectivos { text: string; hashtags: string[]; title: string; crop?: Crop; scheduledAt: Date | null }
  export function ajustesEfectivos(publicacion: Pick<Publicacion, 'title' | 'base' | 'scheduledAt'>, destino: Pick<Destino, 'overrides'>): AjustesEfectivos;
  export const esPersonalizado = (destino: Pick<Destino, 'overrides'>): boolean; // algún campo con override
  export function estadoDeRed(problemas: readonly Problema[], red: Platform): 'correcto' | 'advertencia' | 'error';
  ```

- [ ] **Paso 1: Escribir las pruebas que fallan**

`recorte.test.ts`:
- `'el recorte centrado 9:16 de un 1920×1080 ocupa todo el alto'`:
  - `recorteCentrado('9:16', 1920, 1080)` da `h: 1`.
  - `w` vale `(1080 * 9 / 16) / 1920` con 4 decimales.
  - `x` vale `(1 - w) / 2`.
- `'el recorte centrado 16:9 de un vertical ocupa todo el ancho'`.
- `'ajustar no sale del cuadro, conserva la proporción y respeta el lado mínimo'`:
  - Mover 0.5 a la derecha deja `x + w === 1`.
  - Escalar ×0.01 deja `min(w, h) ≥ 0.1` en la unidad del lado menor.
  - El cociente `(w * ancho) / (h * alto)` se mantiene ±0.01.
- `'los píxeles son pares y caben en el cuadro'`: con `ancho` 1081 y `alto` 1921, todos los valores son pares, `x + w ≤ 1081` y `y + h ≤ 1921`.
- `'la huella cambia con el archivo y con el recorte, y no con ruido de redondeo'`:
  - Cambia con otro `assetId`.
  - No cambia con `x + 0.00001`.
  - Cambia con `x + 0.001`.
- `'el recorte de video solo hasta 15 minutos y 2 GB'`:
  - 900 s es `true` y 901 s es `false`.
  - `2 * 1024 ** 3 + 1` bytes es `false`.
  - Una imagen siempre es `true`.

`ajustes.test.ts`:
- `'sin overrides hereda todo de la base'`.
- `'cada override reemplaza solo su campo'`.
- `'un override de hashtags vacío reemplaza los de la base'`: `[]` no es `undefined`.
- `'estadoDeRed toma el peor problema de esa red o de toda la publicación'`.

En `entrada.test.ts`:
- `'acepta overrides con recorte'`.
- `'rechaza un recorte fuera del cuadro'` (`x: 0.8`, `w: 0.3`).

En `conversion.test.ts`:
- `'leerDestino lee overrides.crop y derivative'`.
- `'thumbnail con assetId'`.

- [ ] **Paso 2: Ejecutar y verificar que fallan**

Run: `pnpm vitest run --project core`
Expected: FAIL (módulos `recorte` y `ajustes` inexistentes).

- [ ] **Paso 3: Implementar.**

- `RESOLUCION_SALIDA` y `LIMITE_RECORTE_VIDEO` se definen con los valores de las restricciones globales.
- `Proporcion` sigue en `reglas.ts`; `recorte.ts` la reexporta.
- Actualizar la spec:
  - **5.4:** `publicarDestino` espera el derivado; `generarRecorte` se encola con 60 s de retraso.
  - **8.3:** autoguardado solo en borradores; recorte mínimo del 10 %.
  - **8.4:** la miniatura propia es una imagen de la Biblioteca.

- [ ] **Paso 4: Ejecutar y verificar que pasan**

Run: `pnpm vitest run --project core && pnpm -r typecheck`
Expected: PASS.

- [ ] **Paso 5: Commit**

```bash
git add packages/core docs/superpowers/specs
git commit -m "feat(core): recorte, ajustes por red y huella del derivado"
```

---

### Tarea 2: Validación con recorte y zonas seguras

**Archivos:**
- Crear: `packages/core/src/publicaciones/zonasSeguras.ts`, con su prueba.
- Modificar: `packages/core/src/publicaciones/validacion.ts`, `efectivo.ts` y `texto.ts`, con sus pruebas.

**Interfaces:**
- Consume: Tarea 1.
- Produce:
  ```ts
  export interface ZonaSegura { x: number; y: number; w: number; h: number } // porcentajes 0..100
  export const ZONAS_SEGURAS: Partial<Record<Platform, Partial<Record<FormatoDestino, ZonaSegura[]>>>>;
  export function zonasSeguras(red: Platform, formato: FormatoDestino): ZonaSegura[]; // [] si no hay
  // validarPublicacion: el destino puede traer overrides.crop
  // DestinoEfectivo: + crop?: Crop
  ```

**Comportamiento de la validación con recorte:**
- **Proporción:** se evalúa con `VALOR_PROPORCION[crop.aspect]` en vez de `asset.aspect`.
- **Resolución mínima (720):** se evalúa con `min(pixelesDeRecorte(...).w, .h)` en vez del lado menor del original.
- **Recorte no permitido:** un recorte sobre un video que excede `LIMITE_RECORTE_VIDEO` es error: "El recorte de video se permite para videos de hasta 15 minutos y 2 GB.".
- **Recorte incompatible:** un recorte cuya proporción no está entre las recomendadas de la red, cuando la regla tiene recomendadas, es advertencia: "{Etiqueta}: el recorte {aspect} no es la proporción recomendada ({lista}).".
- **Hora por red:** `overrides.scheduledAt` cuenta como la hora del destino al comprobar "La hora ya pasó".
- `destinoEfectivo` toma `overrides.title` y `crop`; `contenidoFinal` no cambia.

- [ ] **Paso 1: Escribir las pruebas que fallan**

En `validacion.test.ts`:
- `'un 16:9 recortado a 9:16 ya no advierte proporción en TikTok'`.
- `'un recorte pequeño de un video 720p advierte resolución'`.
- `'recortar un video de 16 minutos es error'`.
- `'un recorte 1:1 en Instagram Reel advierte la proporción recomendada'`.
- `'la hora propia de una red se valida por separado'`.

En `zonasSeguras.test.ts`:
- `'TikTok video tiene 3 zonas dentro de 0..100'`.
- `'YouTube video largo no tiene zonas'`.

En `efectivo.test.ts`:
- `'el destino efectivo lleva el recorte y el título propio'`.

- [ ] **Paso 2: Ejecutar y verificar que fallan**

Run: `pnpm vitest run --project core`
Expected: FAIL.

- [ ] **Paso 3: Implementar**, con los valores de la decisión 7.

- [ ] **Paso 4: Ejecutar y verificar que pasan**

Run: `pnpm vitest run --project core && pnpm -r typecheck`
Expected: PASS. Las pruebas de la 2A y la 2B siguen en verde.

- [ ] **Paso 5: Commit**

```bash
git add packages/core
git commit -m "feat(core): validación con recorte y zonas seguras por red"
```

---

### Tarea 3: `guardar` persiste los ajustes por red y pide el derivado

**Archivos:**
- Crear: `functions/src/publicacion/generarRecorte.ts`, solo con `encoladorRecortes` y el tipo de la tarea; la función llega en la Tarea 4.
- Modificar:
  - `functions/src/publicacion/acciones/guardar.ts` y `dependencias.ts`.
  - `functions/src/publicacion/publicaciones.ts`.
  - `pruebas/integracion/src/funciones/recortes.test.ts` (nuevo) y `pruebas/integracion/src/fixtures.ts`.

**Interfaces:**
- Consume: Tarea 1.
- Produce:
  ```ts
  export interface TareaRecorte { postId: string; platform: Platform; cropHash: string }
  export type EncoladorRecortes = (tarea: TareaRecorte) => Promise<void>; // id `${postId}-${platform}-${cropHash}`, scheduleTime ahora + 60 s
  export function encoladorRecortes(): EncoladorRecortes;                  // cola locations/us-central1/functions/generarRecorte; ignora task-already-exists
  // DependenciasAccion: + encolarRecorte?: EncoladorRecortes  (las llamadas sin él no piden derivados)
  // fixtures: + videoHorizontal (1280×720, 4 s, con audio) y videoRotado (1280×720 con metadato rotate=90)
  ```

**Comportamiento de `guardar`:**
- Escribe `overrides` del destino tal como llega (`set` en un destino nuevo y reemplazo completo en uno existente). `scheduledAt` se convierte a `Date`.
- Por cada destino con `overrides.crop`, calcula `hashRecorte(assetId, crop)`.
  - Si el hash difiere de `derivative.cropHash`, o no hay `derivative`, escribe `derivative: { cropHash, status: 'pendiente' }` y, al terminar la transacción, llama a `encolarRecorte`.
  - Si el hash coincide, no toca `derivative`.
- Un destino sin recorte borra `derivative` con `FieldValue.delete()`.
- `recortePermitido(asset)` falso con recorte → `failed-precondition` "El recorte de video se permite para videos de hasta 15 minutos y 2 GB.". Pasa también con un borrador, porque el recorte no se puede generar.

- [ ] **Paso 1: Escribir las pruebas que fallan** (integración, `guardarPublicacion` con `encolarRecorte` que registra)

- `'guardar con recorte deja el derivado pendiente y lo encola una vez'`: dos guardados iguales dan una sola llamada a `encolarRecorte`.
- `'cambiar el recorte cambia la huella y vuelve a encolar'`.
- `'quitar el recorte borra el derivado'`.
- `'cambiar de archivo con el mismo recorte obliga a regenerar'`.
- `'guardar conserva los overrides de texto, hashtags, título y hora'`.
- `'recortar un video de más de 15 minutos se rechaza'`: asset con `durationSec: 901`.

- [ ] **Paso 2: Ejecutar y verificar que fallan**

Run: `pnpm test:integracion`
Expected: FAIL.

- [ ] **Paso 3: Implementar.** `publicaciones` pasa `encolarRecorte: encoladorRecortes()`.

- [ ] **Paso 4: Ejecutar y verificar que pasan**

Run: `pnpm --filter @omnistream/functions typecheck && pnpm test:integracion`
Expected: PASS.

- [ ] **Paso 5: Commit**

```bash
git add functions pruebas/integracion
git commit -m "feat(functions): guardar ajustes por red y pedir el derivado del recorte"
```

---

### Tarea 4: `generarRecorte`

**Archivos:**
- Crear: `functions/src/archivos/recortar.ts`, con su prueba unitaria de argumentos.
- Modificar:
  - `functions/src/publicacion/generarRecorte.ts` y `functions/src/index.ts`.
  - `storage.rules`, `pruebas/integracion/src/reglas.test.ts` y `pruebas/integracion/src/funciones/recortes.test.ts`.

**Interfaces:**
- Consume: Tareas 1 y 3; `urlDeLectura` y `probar` de la fase 1.
- Produce:
  ```ts
  // recortar.ts
  export function argumentosRecorteVideo(p: { url: string; cabeceras?: string; px: { x; y; w; h }; salida: { width; height }; destino: string }): string[];
  export async function recortarVideo(p: Parameters<typeof argumentosRecorteVideo>[0]): Promise<void>; // timeout 1.700 s
  export async function recortarImagen(entrada: Buffer, crop: Crop, salida: { width; height }): Promise<Buffer>;
  // generarRecorte.ts
  export async function ejecutarRecorte(db: Firestore, bucket: Bucket, tarea: TareaRecorte, deps?: { ahora: () => Date }): Promise<'listo' | 'omitido' | 'fallido'>;
  export const generarRecorte; // onTaskDispatched({ region, memory: '4GiB', timeoutSeconds: 1800, retryConfig: { maxAttempts: 3, minBackoffSeconds: 60 }, rateLimits: { maxConcurrentDispatches: 2 } })
  ```

**Comportamiento de `ejecutarRecorte`:**
1. Lee el destino. Sin `overrides.crop`, o con `hashRecorte` distinto de `tarea.cropHash`, devuelve `'omitido'` sin escribir.
2. Lee el asset. Si está `purgado` o no existe: `derivative.status = 'fallido'` con `error: 'El archivo original ya no está disponible.'`.
3. Marca `generando`.
   - **Video:** recorta con ffmpeg sobre la URL de lectura (sin descargar el original) y escribe en un directorio temporal.
   - **Imagen:** descarga y recorta con sharp.
   - **Ambos:** usa `pixelesDeRecorte` sobre `asset.width` y `asset.height` (dimensiones ya rotadas) y `RESOLUCION_SALIDA[crop.aspect]`.
4. Sube `derivados/{postId}/{red}/{cropHash}.{mp4|jpg}` con `contentType` y `firebaseStorageDownloadTokens`.
5. En una transacción que vuelve a exigir el mismo `cropHash`, escribe `derivative = { cropHash, storagePath, status: 'listo' }`. Si el hash ya cambió, borra lo subido y devuelve `'omitido'`.
6. Borra los demás archivos de `derivados/{postId}/{red}/`.
7. Un error de ffmpeg o de sharp (después de los reintentos de la cola) deja `fallido`, con `error: 'No se pudo generar el recorte.'`; el detalle va al registro.

- [ ] **Paso 1: Escribir las pruebas que fallan**

Unitaria, `recortar.test.ts`:
- `'los argumentos de ffmpeg recortan, escalan y codifican en H.264 con inicio rápido'`. Contiene:
  - `crop=404:720:438:0,scale=1080:1920,setsar=1`
  - `libx264`, `veryfast`, `20` y `yuv420p`
  - `aac` y `+faststart`

Integración, en `recortes.test.ts`, con ffmpeg real sobre los fixtures en el emulador de Storage:
- `'un 16:9 recortado a 9:16 para TikTok y 1:1 para Facebook genera dos archivos distintos'` (criterio de la fase):
  - Ambos derivados quedan `listo`, con rutas distintas.
  - `ffprobe` da 1080×1920 y 1080×1080.
- `'una tarea con huella vieja no hace nada y no deja archivos'`.
- `'al terminar un recorte nuevo se borra el anterior'`.
- `'un video rotado se recorta sobre el cuadro ya rotado'`: `videoRotado` con recorte 9:16 da 1080×1920 sin bandas (ffprobe de la salida sin rotación).
- `'una imagen se recorta con sharp a 1080×1350'`.
- `'si el original fue purgado queda fallido con el mensaje'`.

En `reglas.test.ts`:
- `'el propietario lee derivados y no los escribe'`.

- [ ] **Paso 2: Ejecutar y verificar que fallan**

Run: `pnpm vitest run --project functions && pnpm test:integracion`
Expected: FAIL.

- [ ] **Paso 3: Implementar.**

- [ ] **Paso 4: Ejecutar y verificar que pasan**

Run: `pnpm --filter @omnistream/functions typecheck && pnpm vitest run --project functions && pnpm test:integracion`
Expected: PASS.

- [ ] **Paso 5: Commit**

```bash
git add functions storage.rules pruebas/integracion
git commit -m "feat(functions): generarRecorte con ffmpeg y sharp"
```

---

### Tarea 5: Cada red publica su derivado

**Archivos:**
- Modificar:
  - `functions/src/publicacion/fuentes.ts` y `functions/src/publicacion/publicarDestino.ts`.
  - `apps/web/src/app/(app)/pendientes/[postId]/[red]/page.tsx` y `apps/web/src/lib/archivos/descarga.ts`, con sus pruebas.
  - `pruebas/integracion/src/funciones/recortes.test.ts`.

**Interfaces:**
- Consume: Tareas 1, 3 y 4; `ejecutarTarea` y `DependenciasApi` de la 2B.
- Produce:
  ```ts
  // fuentes.ts
  export function rutaDePublicacion(asset: Asset, destino: Pick<Destino, 'overrides' | 'derivative'>): string | null;
  //   sin recorte → asset.storagePath; con recorte y derivative listo de la huella vigente → derivative.storagePath; si no → null
  // fuentesDePublicacion: usa rutaDePublicacion; el derivado de video es 'video/mp4', el de imagen 'image/jpeg', y su tamaño se lee de Storage
  //   miniatura: thumbnail.frame → fotograma; thumbnail.assetId → original de esa imagen si está 'listo'
  // publicarDestino: + espera del derivado (decisión 1)
  export const ESPERA_DERIVADO_SEG = 120;
  export const MAX_ESPERAS_DERIVADO = 15;
  // TareaPublicacion: + esperaDerivado?: number
  // contexto de ejecutarTarea: + encolarRecorte?: EncoladorRecortes (Tarea 3); publicarDestino pasa encoladorRecortes()
  // descarga.ts: estadoDescarga suma el estado 'generando' cuando el destino tiene recorte sin derivado listo
  ```

**Espera del derivado en `ejecutarTarea`:**
- Ocurre después de validar y antes de las ramas manual y API.
- Si el destino tiene recorte y `rutaDePublicacion` devuelve `null`:
  - Si `derivative` falta o está `fallido`, encola `generarRecorte` con la huella vigente.
  - Libera el lease con `{ stage: 'recorte', result: 'omitido' }`.
  - Encola la misma tarea con `esperaDerivado: n + 1`, id `{postId}-{red}-v{version}-d{n+1}` y `scheduleTime: ahora + 120 s`. Devuelve `'esperando'`.
- Con `esperaDerivado === 15`, queda `fallida` con `{ code: 'recorte', kind: 'definitivo', message: 'No se pudo generar el recorte para {Red}.' }`.
- La recuperación de `encolarPendientes` no interfiere, porque la espera actualiza `statusChangedAt` (2B).

- [ ] **Paso 1: Escribir las pruebas que fallan**

Integración:
- `'cada red publica su derivado'`:
  - El adaptador falso recibe en `ctx.archivo` el tamaño del derivado de su red.
  - TikTok recibe 1080×1920 y Facebook 1080×1080, comprobado por `size` distinto y `mimeType: 'video/mp4'`.
- `'sin derivado listo la tarea espera y vuelve en 120 s sin publicar el original'`:
  - El encolador recibe el id `-d1`.
  - El adaptador no se llama.
- `'a la espera 15 falla con el mensaje'`.
- `'una red sin recorte sigue publicando el original'`.
- `'en modo manual el destino pasa a pendiente_manual solo con el derivado listo'`.
- `'la miniatura propia usa la imagen elegida'`.

Web, `descarga.test.ts`:
- `'con recorte sin derivado listo, el paquete dice que el recorte se está generando'`. El texto: "Generando el recorte para esta red…".

- [ ] **Paso 2: Ejecutar y verificar que fallan**

Run: `pnpm vitest run --project web && pnpm test:integracion`
Expected: FAIL.

- [ ] **Paso 3: Implementar.** El paquete descarga `derivative.storagePath` cuando existe y es de la huella vigente; si no, el original.

- [ ] **Paso 4: Ejecutar y verificar que pasan**

Run: `pnpm --filter @omnistream/functions typecheck && pnpm vitest run --project web && pnpm test:integracion`
Expected: PASS. Las pruebas de publicación por API de la 2B siguen en verde.

- [ ] **Paso 5: Commit**

```bash
git add functions apps/web pruebas/integracion
git commit -m "feat: cada red publica su derivado y espera a que esté listo"
```

---

### Tarea 6: Pasos de creación y autoguardado

**Archivos:**
- Crear:
  - `apps/web/src/components/crear/PasosCreacion.tsx` y `PasoArchivo.tsx`, con sus pruebas.
  - `apps/web/src/lib/crear/autoguardado.ts`, con su prueba.
- Modificar:
  - `apps/web/src/lib/publicaciones/formulario.ts` (+ `overrides` por red).
  - `apps/web/src/lib/publicaciones/enviar.ts`.
  - `apps/web/src/app/(app)/crear/page.tsx` y `apps/web/src/app/(app)/publicaciones/[id]/editar/page.tsx`.

**Interfaces:**
- Consume: Tarea 1; `useSubidas`, `useArchivos`, `revisarEnvio` y `aEntrada`.
- Produce:
  ```ts
  export const PASOS = ['archivo', 'destinos', 'canvas', 'contenido', 'vista', 'publicar'] as const;
  export type Paso = (typeof PASOS)[number];
  export const ETIQUETAS_PASO: Record<Paso, string>; // 'Archivo', 'Destinos', 'Canvas', 'Contenido', 'Vista previa', 'Publicar'
  // FormularioPublicacion: + overrides: Partial<Record<Platform, FormularioOverrides>>
  export interface FormularioOverrides { text?: string; hashtags?: string; title?: string; crop?: Crop; fecha?: string; hora?: string }
  // autoguardado.ts
  export interface Autoguardado { programar(entrada: EntradaPublicacion): void; vaciar(): Promise<string | undefined>; cancelar(): void }
  export function crearAutoguardado(p: { guardar(entrada: EntradaPublicacion): Promise<{ postId: string }>; alEstado(e: EstadoGuardado): void; retardoMs?: number }): Autoguardado;
  export type EstadoGuardado = 'sin_cambios' | 'pendiente' | 'guardando' | 'guardado' | 'error';
  // PasosCreacion: props = las del antiguo EditorPublicacion + alGuardarBorrador(entrada): Promise<{ postId: string }>
  ```

**Comportamiento:**
- **Barra de pasos:** `nav aria-label="Pasos"` con un botón por paso y `aria-current="step"` en el activo. Antes de elegir un archivo solo está habilitado Archivo; después, todos (spec 8). El paso sale de `?paso=`, según la decisión 11.
- **Autoguardado (decisión 4):**
  - `retardoMs` vale 1.000 por defecto.
  - `programar` reinicia el temporizador. Si hay un guardado en curso, el siguiente espera a que termine y usa la última entrada.
  - `vaciar` guarda de inmediato lo pendiente y devuelve el `postId`. Lo usan "Programar" y "Publicar ahora" antes de programar.
  - El indicador muestra "Guardando…", "Guardado" o "No se pudo guardar el borrador.".
  - En `/crear`, el primer guardado hace `history.replaceState` a `/publicaciones/{id}/editar?paso=…`.
- **Paso Archivo (spec 8.1):**
  - La lista de archivos listos y en proceso, y el botón "Subir archivo", que usa el gestor de subidas de la Biblioteca y elige el archivo en cuanto se crea.
  - Un archivo que aún se sube muestra su progreso.
  - "Programar" y "Publicar ahora" siguen bloqueados por "El archivo aún no está listo." de la validación.

- [ ] **Paso 1: Escribir las pruebas que fallan**

`autoguardado.test.ts`, con temporizadores falsos:
- `'guarda una vez 1 s después del último cambio'`.
- `'nunca hay dos guardados en curso y el segundo usa la última entrada'`.
- `'vaciar guarda lo pendiente y devuelve el postId'`.
- `'un error deja el estado error y el siguiente cambio reintenta'`.

`PasosCreacion.test.tsx`:
- `'sin archivo solo Archivo está habilitado'`.
- `'con archivo se navega libremente entre los pasos'`.
- `'un borrador con título se autoguarda'`.
- `'una publicación programada no se autoguarda y ofrece Guardar cambios'`.
- `'sin título no se autoguarda'`.

`PasoArchivo.test.tsx`:
- `'Subir archivo elige el archivo nuevo y muestra su progreso'`.

En `formulario.test.ts`:
- `'los overrides van y vuelven, con la hora por red en la zona'`.

- [ ] **Paso 2: Ejecutar y verificar que fallan**

Run: `pnpm vitest run --project web`
Expected: FAIL.

- [ ] **Paso 3: Implementar.**

- `PasosCreacion` reemplaza a `EditorPublicacion` en `crear` y `editar`. Este paso no mueve las secciones de contenido: las Tareas 7 a 10 llenan los otros pasos.
- Para que nada quede sin pantalla mientras tanto, los pasos aún no implementados muestran las secciones actuales del editor, movidas tal cual a sus pasos: Redes y Jerarquía en Destinos; Contenido, YouTube y TikTok en Contenido; Fecha y hora y los botones en Publicar.
- `EditorPublicacion.tsx` se elimina en esta tarea. Sus pruebas se trasladan a los pasos que heredan cada sección y conservan sus nombres.

- [ ] **Paso 4: Ejecutar y verificar que pasan**

Run: `pnpm --filter @omnistream/web lint && pnpm vitest run --project web && pnpm --filter @omnistream/web typecheck && pnpm --filter @omnistream/web build`
Expected: PASS.

- [ ] **Paso 5: Commit**

```bash
git add apps/web
git commit -m "feat(web): pasos de creación con autoguardado"
```

---

### Tarea 7: Canvas: redes, marco, fotogramas y zonas seguras

**Archivos:**
- Crear:
  - `apps/web/src/components/crear/PasoCanvas.tsx`.
  - En `apps/web/src/components/crear/canvas/`: `ListaRedes.tsx`, `TiraFotogramas.tsx` y `CapaZonasSeguras.tsx`.
  - Sus pruebas.
- Modificar: `PasosCreacion.tsx`.

**Interfaces:**
- Consume: Tareas 1, 2 y 6; `useUrlsFotogramas`.
- Produce:
  ```ts
  export function ListaRedes(p: { destinos: { platform: Platform; format: FormatoDestino; personalizado: boolean }[]; problemas: Problema[]; activa: Platform; alElegir(r: Platform): void }): JSX.Element;
  export function TiraFotogramas(p: { urls: Partial<Record<Fotograma, string>>; activo: Fotograma; crop?: Crop; alElegir(f: Fotograma): void }): JSX.Element;
  export function CapaZonasSeguras(p: { zonas: ZonaSegura[] }): JSX.Element; // div absoluto con un rectángulo semitransparente por zona, aria-hidden
  ```

**Distribución (spec 8.3):**
- **Izquierda:** las redes, cada una con su indicador: `estadoDeRed` da "Correcto", "Advertencia" o "Error", como texto y con color. "Personalizado" aparece si `esPersonalizado`.
- **Centro:** el fotograma activo dentro del marco de la red, con la proporción del recorte o la del archivo.
- **Derecha:** los controles, que la Tarea 8 llena con el recorte.
- **Abajo:** la tira de 3 fotogramas.
- **Avisos de la red activa:** se listan bajo el marco.
- **Zonas seguras:** interruptor "Zonas seguras" que superpone `zonasSeguras(red, formato)`.

- [ ] **Paso 1: Escribir las pruebas que fallan**

- `'el indicador de cada red coincide con la validación del servidor'` (criterio de la fase). La prueba construye el contexto, llama a `revisarEnvio` y compara cada indicador con `estadoDeRed` sobre los mismos problemas. Datos:
  - Un 16:9 con TikTok sin recorte da "Advertencia".
  - Con el recorte 9:16 da "Correcto".
  - Instagram Reel con un video de 20 minutos da "Error".
- `'el interruptor muestra las zonas seguras de la red activa'`: 3 rectángulos en TikTok y ninguno en YouTube video largo.
- `'elegir un fotograma lo muestra en el marco'`.
- `'la red personalizada lo indica'`.

- [ ] **Paso 2: Ejecutar y verificar que fallan**

Run: `pnpm vitest run --project web`
Expected: FAIL.

- [ ] **Paso 3: Implementar.**

- [ ] **Paso 4: Ejecutar y verificar que pasan**

Run: `pnpm --filter @omnistream/web lint && pnpm vitest run --project web && pnpm --filter @omnistream/web typecheck`
Expected: PASS.

- [ ] **Paso 5: Commit**

```bash
git add apps/web
git commit -m "feat(web): canvas con estado por red, fotogramas y zonas seguras"
```

---

### Tarea 8: Canvas: recorte

**Archivos:**
- Crear:
  - `apps/web/src/components/crear/canvas/MarcoRecorte.tsx`, con su prueba.
  - `apps/web/src/lib/crear/recorteVisual.ts`, con su prueba.
- Modificar: `PasoCanvas.tsx` y `TiraFotogramas.tsx`.

**Interfaces:**
- Consume: Tareas 1, 2 y 7.
- Produce:
  ```ts
  export function estiloRecorte(crop: Crop): { width: string; height: string; left: string; top: string }; // porcentajes para el elemento interno
  export function MarcoRecorte(p: { imagen: string; ancho: number; alto: number; crop?: Crop; alCambiar(crop: Crop | undefined): void }): JSX.Element;
  ```

**Comportamiento (spec 8.3):**
- **Proporciones:** botones "16:9", "9:16", "1:1", "4:5" y "1.91:1". Las recomendadas de la red activa (`regla.proporciones`) llevan la marca "Recomendada". Elegir una aplica `recorteCentrado`.
- **Aplicar guía:** si la proporción del archivo no es compatible y no hay recorte, aparece el botón "Aplicar guía {proporción}", con la primera recomendada, que coloca el recorte centrado.
- **Mover y ampliar:**
  - El recuadro se arrastra con el puntero; las teclas de flecha lo mueven un 1 %.
  - Se amplía con la rueda o con los botones "Ampliar" y "Reducir", que escalan ×1,1 y ×1/1,1.
  - Todo pasa por `ajustarRecorte`.
- **Sobre la tira:** el recuadro se muestra también sobre los 3 fotogramas de la tira.
- **Quitar:** "Quitar recorte" deja `crop` sin definir.
- **Límite:** si `recortePermitido` es falso, los controles se deshabilitan con "El recorte de video se permite para videos de hasta 15 minutos y 2 GB.".
- **Estado del derivado:** al editar, el detalle del destino muestra el estado del derivado: "Generando recorte…", "Recorte listo" o "No se pudo generar el recorte.".
- **Dónde se guarda:** el recorte va a `overrides[red].crop`, porque el recorte es un ajuste por red.

- [ ] **Paso 1: Escribir las pruebas que fallan**

`recorteVisual.test.ts`:
- `'el estilo escala y desplaza para mostrar solo el recorte'`: para `{x: 0.25, y: 0, w: 0.5, h: 1}` da `width: '200%'` y `left: '-50%'`.

`MarcoRecorte.test.tsx`:
- `'elegir 9:16 coloca un recorte centrado'`.
- `'las flechas mueven el recorte y no salen del cuadro'`.
- `'Aplicar guía aparece solo con un archivo incompatible'`.
- `'Quitar recorte vuelve al original'`.
- `'las proporciones recomendadas están marcadas'`.
- `'con un video de más de 15 minutos los controles se deshabilitan con el motivo'`.

- [ ] **Paso 2: Ejecutar y verificar que fallan**

Run: `pnpm vitest run --project web`
Expected: FAIL.

- [ ] **Paso 3: Implementar.**

- [ ] **Paso 4: Ejecutar y verificar que pasan**

Run: `pnpm --filter @omnistream/web lint && pnpm vitest run --project web && pnpm --filter @omnistream/web typecheck`
Expected: PASS.

- [ ] **Paso 5: Commit**

```bash
git add apps/web
git commit -m "feat(web): recorte por red en el canvas"
```

---

### Tarea 9: Ajustes por red (desvincular y revincular)

**Archivos:**
- Crear: `apps/web/src/components/crear/canvas/AjustesRed.tsx`, con su prueba.
- Modificar: `PasoCanvas.tsx` y `apps/web/src/components/publicaciones/DetallePublicacion.tsx`, con su prueba.

**Interfaces:**
- Consume: Tareas 1, 6 y 8.
- Produce:
  ```ts
  export function AjustesRed(p: { red: Platform; base: { text: string; hashtags: string; title: string; fecha: string; hora: string }; overrides: FormularioOverrides; zona: string; alCambiar(o: FormularioOverrides): void }): JSX.Element;
  ```

**Comportamiento (spec 8.3):**
- **Campos:** debajo del recorte, la sección "Ajustes de {Red}" muestra texto, hashtags, título (solo YouTube) y hora.
- **Heredado:** cada campo muestra el valor heredado en solo lectura, con el botón "Desvincular".
- **Desvincular:** copia el valor base al override y habilita la edición.
- **Revincular:** borra el override.
- **Hora propia:** se valida como la de la publicación ("La hora ya pasó") y se guarda como `overrides.scheduledAt`.
- **Detalle de publicación:** el destino con overrides muestra "Personalizado".

- [ ] **Paso 1: Escribir las pruebas que fallan**

- `'desvincular copia la base y permite editar'`.
- `'revincular borra el override y vuelve a mostrar la base'`.
- `'el título solo aparece en YouTube'`.
- `'la hora propia de la red se guarda en su override'`.
- En `DetallePublicacion.test.tsx`: `'un destino con overrides muestra Personalizado'`.

- [ ] **Paso 2: Ejecutar y verificar que fallan**

Run: `pnpm vitest run --project web`
Expected: FAIL.

- [ ] **Paso 3: Implementar.**

- [ ] **Paso 4: Ejecutar y verificar que pasan**

Run: `pnpm --filter @omnistream/web lint && pnpm vitest run --project web && pnpm --filter @omnistream/web typecheck`
Expected: PASS.

- [ ] **Paso 5: Commit**

```bash
git add apps/web
git commit -m "feat(web): ajustes por red con desvincular y revincular"
```

---

### Tarea 10: Pasos Contenido y Destinos, y miniatura propia

**Archivos:**
- Crear: `apps/web/src/components/crear/PasoContenido.tsx` y `PasoDestinos.tsx`, con sus pruebas.
- Modificar: `PasosCreacion.tsx` y `apps/web/src/lib/publicaciones/formulario.ts` (el esquema con `thumbnail.assetId` ya lo dejó la Tarea 1).

**Interfaces:**
- Consume: Tareas 1, 6 y 9; `SeccionTiktok` de la 2B.
- Produce: `FormularioPublicacion.youtube.miniatura: { tipo: 'fotograma'; frame: Fotograma } | { tipo: 'imagen'; assetId: string }`.

**Comportamiento:**
- **Destinos:** las secciones Redes y Jerarquía del antiguo editor, sin cambios de comportamiento (sugerencias, formato y modo por red, Principal).
- **Contenido (spec 8.4):**
  - Título, texto base con contadores por red y hashtags.
  - Campos de YouTube.
  - La sección de TikTok en modo API.
  - Miniatura: "Fotograma" (Inicio, Mitad o Final) o "Imagen propia", con un selector de las imágenes listas de la Biblioteca.
- **Contadores:** usan el texto efectivo de cada red, así una red con texto propio cuenta el suyo.

- [ ] **Paso 1: Escribir las pruebas que fallan**

- `'los contadores usan el texto propio de cada red'`.
- `'la miniatura propia elige una imagen de la Biblioteca y va como thumbnail.assetId'`.
- Las pruebas trasladadas del antiguo editor sobre redes, jerarquía, YouTube y TikTok siguen pasando con el mismo nombre.

- [ ] **Paso 2: Ejecutar y verificar que fallan**

Run: `pnpm vitest run --project web`
Expected: FAIL.

- [ ] **Paso 3: Implementar.**

- [ ] **Paso 4: Ejecutar y verificar que pasan**

Run: `pnpm --filter @omnistream/web lint && pnpm vitest run --project web && pnpm --filter @omnistream/web typecheck`
Expected: PASS.

- [ ] **Paso 5: Commit**

```bash
git add apps/web
git commit -m "feat(web): pasos Destinos y Contenido con miniatura propia"
```

---

### Tarea 11: Vista previa y Publicar

**Archivos:**
- Crear:
  - `apps/web/src/components/crear/PasoVistaPrevia.tsx` y `PasoPublicar.tsx`.
  - `apps/web/src/components/crear/vista/MaquetaTelefono.tsx`.
  - Sus pruebas.
- Modificar: `PasosCreacion.tsx`.

**Interfaces:**
- Consume: Tareas 1, 2, 6 y 8; `useConexiones` y `useUrlDescarga`.
- Produce:
  ```ts
  export const CORTE_TEXTO: Record<Platform, number>; // instagram 125, facebook 125, tiktok 80, youtube 100 (decisión 8)
  export function textoCortado(texto: string, limite: number): { visible: string; cortado: boolean };
  export function MaquetaTelefono(p: { red: Platform; formato: FormatoDestino; cuenta: { nombre: string; avatarUrl?: string }; medio: { tipo: 'video' | 'imagen'; url: string }; crop?: Crop; titulo?: string; texto: string }): JSX.Element;
  ```

**Comportamiento:**
- **Vista previa (spec 8.5):**
  - Una maqueta por red, lado a lado, con `section aria-label="Vista previa en {Red}"`. En pantallas angostas se ve una a la vez, con los botones "Anterior" y "Siguiente".
  - Cada maqueta muestra la cuenta y el texto final (`contenidoFinal`) cortado con "... más". El botón "más" despliega el texto completo.
  - El video se reproduce sin sonido y en bucle desde la URL de descarga del original, con el recorte simulado mediante `estiloRecorte`. Una imagen se muestra igual.
  - Pie: "Aproximación de cómo se verá; cada red muestra su propia interfaz.".
- **Publicar (spec 8.6):**
  - Fecha y hora en la zona configurada.
  - El resumen agrupa por red los errores, que bloquean, y las advertencias, que requieren confirmación (`ConfirmarEnvio`).
  - Botones "Guardar borrador" o "Guardar cambios", "Programar" y "Publicar ahora".
  - Antes de programar se llama a `vaciar()` del autoguardado. Al confirmar, se redirige a `/calendario?resaltar={id}`, como en la 2A.

- [ ] **Paso 1: Escribir las pruebas que fallan**

- `'el texto largo se corta con ... más y se despliega'`: 130 caracteres en Instagram muestran 125 y "... más".
- `'cada red tiene su maqueta con el nombre de su cuenta'`: el nombre sale de la conexión o es "Tu cuenta".
- `'la maqueta aplica el recorte de su red'`: el estilo del medio es el de `estiloRecorte`.
- `'el resumen agrupa errores y advertencias por red y bloquea con errores'`.
- `'Programar guarda lo pendiente antes de programar'`: `vaciar` se llama antes de `alEnviar` con la intención `programar`.

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
git commit -m "feat(web): vista previa en maquetas y paso Publicar"
```

---

### Tarea 12: E2E de la fase 3, guía y README

**Archivos:**
- Crear: `apps/web/e2e/fase3.spec.ts`.
- Modificar:
  - `apps/web/e2e/fase2.spec.ts`, `apps/web/e2e/ayudantes.ts` y `pruebas/integracion/src/fixtures.ts`, porque el editor ahora va por pasos.
  - `docs/configuracion.md` y `README.md`.

**Interfaces:**
- Consume: todo lo anterior.
- Produce: `ayudantes.ts` suma `irAlPaso(page, nombre: string)`, que hace clic en el botón del paso dentro de `nav[aria-label="Pasos"]`.

- [ ] **Paso 1: Escribir las pruebas E2E**

`fase3.spec.ts`:

```ts
test('un video 16:9 recortado a 9:16 para TikTok y 1:1 para Facebook publica un archivo distinto por red', async ({ page }) => {
  // entrar → /crear → Subir archivo (fixtures.videoHorizontal) → elegirlo cuando esté "Listo"
  // Destinos: Facebook (Video) y TikTok; Canvas: TikTok "Aplicar guía 9:16"; Facebook botón "1:1"
  // Contenido: título "Recorte E2E"; Publicar: "Publicar ahora" → Confirmar
  // admin: esperar los dos derivative.status === 'listo' y luego status 'pendiente_manual' en ambos destinos
  // los dos derivative.storagePath son distintos y terminan en .mp4
  // /pendientes/{id}/tiktok: el enlace de descarga apunta a derivados%2F{id}%2Ftiktok%2F
});

test('el autoguardado conserva el borrador al recargar', async ({ page }) => {
  // crear: elegir archivo, escribir título → esperar "Guardado" → la URL es /publicaciones/{id}/editar
  // recargar → el título sigue y el paso es el mismo
});

test('las zonas seguras se ven en el canvas', async ({ page }) => {
  // Canvas con TikTok → activar "Zonas seguras" → 3 rectángulos visibles en el marco
});
```

`fase2.spec.ts` sigue el mismo flujo, pero pasa por los pasos con `irAlPaso`.

- [ ] **Paso 2: Ejecutar y verificar**

Run: `PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm test:e2e`
Expected: PASS en las fases 1, 2A, 2B y 3. Si una prueba falla, se corrige la causa en la tarea correspondiente.

- [ ] **Paso 3: Actualizar la guía y el README**

`docs/configuracion.md`, nueva sección "Producción: fase 3":

1. **Cola de recortes.** El flujo "Desplegar" crea la cola de `generarRecorte` (4 GiB, hasta 30 min por recorte). No hace falta configurar nada.
2. **Costos.** Cada recorte de video consume cómputo de Cloud Functions, aproximadamente el tiempo que dura recodificar el video. Con el presupuesto de 1 USD, revisa el consumo en Facturación tras las primeras semanas. Recortar solo las redes que lo necesitan reduce el costo; con la retención en 0 días, los derivados se borran junto con el original.
3. **Verificación (criterio 3):**
   - Recorta un video 16:9 a 9:16 para TikTok y a 1:1 para Facebook, y publica.
   - Confirma que cada red recibe su archivo: el paquete manual descarga el derivado, y por API cada publicación tiene la proporción elegida.
   - Confirma que el estado de cada red en el Canvas coincide con lo que "Programar" bloquea.

`README.md`: enlace al plan de la fase 3.

- [ ] **Paso 4: Verificación completa**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm --filter @omnistream/web build && pnpm test:integracion && PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm test:e2e`
Expected: PASS.

- [ ] **Paso 5: Commit**

```bash
git add apps/web docs README.md pruebas/integracion
git commit -m "test(e2e): smart canvas con recorte por red y guía de la fase 3"
```
