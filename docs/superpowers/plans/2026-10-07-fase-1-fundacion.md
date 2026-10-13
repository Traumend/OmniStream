# Fase 1 (Fundación): plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: usar superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para implementar este plan tarea por tarea. Los pasos usan casillas (`- [ ]`) para el seguimiento.

**Objetivo:** dejar operativa la base de OmniStream: monorepo con CI, acceso restringido a un solo correo, estructura de la interfaz con el tema neoclásico, Ajustes generales, subida reanudable de archivos con análisis en el servidor (datos técnicos y 3 fotogramas) y biblioteca de archivos.

**Arquitectura:** monorepo pnpm con `packages/core` (dominio puro y probado), `functions/` (Cloud Functions 2.ª gen, empaquetadas con esbuild en `functions/dist`), `apps/web` (Next.js App Router) y `pruebas/integracion` (pruebas contra el Emulator Suite). El navegador lee y escribe Firestore y Storage directamente, protegido por reglas que exigen el claim `owner`; las funciones de bloqueo de Auth asignan ese claim solo al correo permitido.

**Stack:** Node.js 22, pnpm 10, TypeScript estricto, Zod, Vitest, Testing Library, Playwright, Next.js (estable vigente) con React 19, Tailwind CSS v4, shadcn/ui, lucide-react, react-hook-form, Firebase JS SDK, firebase-admin, firebase-functions, firebase-tools, esbuild, ffmpeg-static, ffprobe-static, sharp, heic-convert.

**Spec:** `docs/superpowers/specs/2026-10-07-omnistream-design.md` (secciones 5, 5.5, 6.1, 6.3, 11, 12, 13 y 14).

## Restricciones globales

- Node.js ≥ 22. Solo pnpm (nunca npm o yarn en la raíz; `npm install` únicamente dentro de `functions/dist`).
- TypeScript con `strict` y `noUncheckedIndexedAccess`. Módulos ESM, salvo el paquete desplegado de funciones (CJS).
- Todo texto visible en español neutro, sin voseo. Locale de formato: `es-419`.
- Región de funciones: `us-central1`. Proyecto de emuladores: `demo-omnistream`. Bucket por defecto en emuladores: `demo-omnistream.appspot.com`.
- Formatos permitidos: mp4, mov, webm, jpg/jpeg, png, webp, heic. Imágenes ≤ 50 MB. `maxUploadGb` por defecto 10 (rango 1–50). `retentionDays` por defecto 7 (rango 1–90). 1 GB = 1024³ bytes.
- Fotogramas: segundo 1, mitad y un segundo antes del final; JPEG de máximo 1280 px de ancho.
- Paleta, tipografía y ornamentos según la spec 5.5. Texto con contraste ≥ 4.5:1; dorado no textual ≥ 3:1.
- No se copia código de Postmill ni de Easel.
- Ninguna prueba automática hace llamadas reales a redes sociales ni a proveedores de IA.
- Mensajes de commit en español con prefijo convencional (`feat`, `test`, `chore`, `docs`).

## Foco de revisión

1. **Video vertical grabado con metadatos de rotación** (1920×1080 con rotación 90 o −90): debe guardarse como 1080×1920 y proporción 9:16. Prueba en la Tarea 6.
2. **Extensión en mayúsculas o MIME vacío** (`clip.MOV`, HEIC en Chrome con tipo vacío): debe detectarse por extensión. Prueba en la Tarea 2.
3. **Archivo dañado**: el asset debe terminar en `fallido` con mensaje en español, nunca quedar en `procesando`. Pruebas en la Tarea 7 (unitaria e integración).
4. **Recarga de la página a mitad de una subida**: el archivo debe mostrarse como "Subida interrumpida" con opción de eliminar. Pruebas en las Tareas 2 y 12.
5. **Correo permitido escrito con mayúsculas o espacios, o la misma dirección sin verificar**: el primero entra; el segundo no. Pruebas en las Tareas 1 y 5.

---

## Estructura de archivos

```
package.json, pnpm-workspace.yaml, tsconfig.base.json, eslint.config.mjs, .prettierrc.json,
.gitignore, .nvmrc, vitest.config.ts, firebase.json, .firebaserc,
firestore.rules, firestore.indexes.json, storage.rules, README.md
.github/workflows/ci.yml, .github/workflows/desplegar.yml
docs/configuracion.md
packages/core/src/
  index.ts
  acceso.ts                      evaluarAcceso, MENSAJES_ACCESO
  ajustes.ts                     ajustesAppSchema, AJUSTES_POR_DEFECTO, leerAjustes, esZonaHorariaValida
  archivos/formatos.ts           detectarTipo, validarArchivo, LIMITE_IMAGEN_BYTES
  archivos/fotogramas.ts         tiemposDeFotogramas, dimensionesEfectivas, describirProporcion
  archivos/formato.ts            formatearBytes, formatearDuracion, LOCALE
  archivos/asset.ts              Asset, EstadoAsset, estadoVisible, ETIQUETAS_ESTADO, rutaOriginal, rutaFotograma
functions/
  build.mjs, .env.demo-omnistream
  src/index.ts, src/config.ts
  src/acceso/bloqueos.ts         verificarUsuario, antesDeCrearUsuario, antesDeIniciarSesion
  src/archivos/analizar.ts       analizarSalidaFfprobe, ErrorAnalisis
  src/archivos/medios.ts         probar, extraerFotograma, procesarImagen, convertirHeicAJpeg
  src/archivos/urlLectura.ts     urlDeLectura
  src/archivos/procesarObjeto.ts procesarObjeto, DependenciasProcesamiento
  src/archivos/procesarArchivo.ts  trigger y dependencias reales
pruebas/integracion/src/
  reglas.test.ts, fixtures.ts, funciones/acceso.test.ts, funciones/procesarArchivo.test.ts
apps/web/
  apphosting.yaml, playwright.config.ts, .env.development
  e2e/fase1.spec.ts, e2e/ayudantes.ts
  src/app/layout.tsx, src/app/globals.css, src/app/page.tsx
  src/app/(publico)/entrar/page.tsx
  src/app/(app)/layout.tsx
  src/app/(app)/{calendario,crear,pendientes,estadisticas,tendencias,plan}/page.tsx
  src/app/(app)/biblioteca/page.tsx, src/app/(app)/ajustes/general/page.tsx
  src/estilos/contraste.test.ts
  src/components/marca/{Logo,Meandro,Laurel}.tsx
  src/components/shell/{navegacion.ts,BarraLateral.tsx,BarraSuperior.tsx,Shell.tsx,GuardiaSesion.tsx}
  src/components/comunes/ProximaFase.tsx
  src/components/ajustes/FormularioAjustes.tsx
  src/components/biblioteca/{ZonaSubida,TarjetaArchivo,DetalleArchivo,ConfirmarEliminacion}.tsx
  src/lib/firebase/{config.ts,cliente.ts,sesion.tsx,erroresEntrada.ts}
  src/lib/ajustes/repositorio.ts
  src/lib/archivos/{gestorSubidas.ts,metadatosLocales.ts,dependenciasFirebase.ts,useSubidas.ts,repositorio.ts}
```

---

### Tarea 1: Monorepo y regla de acceso en `core`

**Archivos:**
- Crear: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `eslint.config.mjs`, `.prettierrc.json`, `.gitignore`, `.nvmrc`, `vitest.config.ts`
- Crear: `packages/core/package.json`, `packages/core/tsconfig.json`, `packages/core/vitest.config.ts`, `packages/core/src/index.ts`, `packages/core/src/acceso.ts`
- Prueba: `packages/core/src/acceso.test.ts`

**Interfaces:**
- Produce:
  ```ts
  type MotivoRechazo = 'correo_no_permitido' | 'correo_no_verificado' | 'sin_correo';
  type ResultadoAcceso = { permitido: true } | { permitido: false; motivo: MotivoRechazo };
  function evaluarAcceso(usuario: { email?: string | null; emailVerified: boolean }, correoPermitido: string): ResultadoAcceso;
  const MENSAJES_ACCESO: Record<MotivoRechazo, string>;
  ```
  Paquete `@omnistream/core`, consumido desde el código fuente (`"exports": { ".": "./src/index.ts" }`).

- [ ] **Paso 1: Crear el andamiaje del monorepo**

  - `pnpm-workspace.yaml`: `apps/*`, `packages/*`, `functions`, `pruebas/*`.
  - Raíz `package.json`: `"private": true`, `"packageManager": "pnpm@10.28.0"`, `"engines": { "node": ">=22" }`. Scripts: `lint` (`eslint . && pnpm -r --if-present lint`), `typecheck` (`pnpm -r typecheck`), `test` (`vitest run`), `format` (`prettier --write .`).
  - `tsconfig.base.json`: `strict`, `noUncheckedIndexedAccess`, `target: ES2022`, `module: ESNext`, `moduleResolution: Bundler`, `isolatedModules`, `skipLibCheck`.
  - `vitest.config.ts` raíz con `test.projects: ['packages/core', 'functions', 'apps/web']`. Las rutas que aún no existan se agregan en su tarea.
  - `.gitignore`: `node_modules`, `.next`, `functions/dist`, `coverage`, `*.log`, `.firebase`, `functions/.env.*`, `!functions/.env.demo-omnistream`, `pruebas/**/.fixtures`, `apps/web/test-results`, `apps/web/playwright-report`.
  - `eslint.config.mjs`: `typescript-eslint` recomendado; ignora `apps/web/**` (la web usa su propia configuración de Next), `**/dist/**`, `**/.next/**` y `pruebas/**/.fixtures/**`.
  - `.nvmrc`: `22`.
  - `packages/core/package.json`: nombre `@omnistream/core`, `"type": "module"`, dependencia `zod`, script `typecheck` (`tsc --noEmit`).

- [ ] **Paso 2: Escribir la prueba que falla**

```ts
import { describe, expect, it } from 'vitest';
import { evaluarAcceso, MENSAJES_ACCESO } from './acceso';

const permitido = 'propietario@omnistream.test';

describe('evaluarAcceso', () => {
  it('permite el correo configurado y verificado', () => {
    expect(evaluarAcceso({ email: permitido, emailVerified: true }, permitido)).toEqual({ permitido: true });
  });
  it('ignora mayúsculas y espacios', () => {
    expect(evaluarAcceso({ email: '  Propietario@OmniStream.test ', emailVerified: true }, permitido)).toEqual({ permitido: true });
  });
  it('rechaza otro correo', () => {
    expect(evaluarAcceso({ email: 'intruso@ejemplo.com', emailVerified: true }, permitido)).toEqual({ permitido: false, motivo: 'correo_no_permitido' });
  });
  it('rechaza el correo permitido sin verificar', () => {
    expect(evaluarAcceso({ email: permitido, emailVerified: false }, permitido)).toEqual({ permitido: false, motivo: 'correo_no_verificado' });
  });
  it('rechaza cuentas sin correo', () => {
    expect(evaluarAcceso({ email: null, emailVerified: false }, permitido)).toEqual({ permitido: false, motivo: 'sin_correo' });
  });
  it('rechaza todo si no hay correo configurado', () => {
    expect(evaluarAcceso({ email: permitido, emailVerified: true }, '')).toEqual({ permitido: false, motivo: 'correo_no_permitido' });
  });
});

describe('MENSAJES_ACCESO', () => {
  it('tiene un mensaje por motivo', () => {
    expect(MENSAJES_ACCESO).toEqual({
      correo_no_permitido: 'Esta cuenta no tiene acceso a OmniStream.',
      correo_no_verificado: 'Verifica tu correo antes de entrar.',
      sin_correo: 'La cuenta no tiene un correo asociado.',
    });
  });
});
```

- [ ] **Paso 3: Ejecutar y confirmar que falla**

Ejecutar: `pnpm install && pnpm vitest run packages/core/src/acceso.test.ts`
Esperado: FAIL ("Failed to resolve import ./acceso").

- [ ] **Paso 4: Implementar `evaluarAcceso` y `MENSAJES_ACCESO` en `packages/core/src/acceso.ts` y exportarlos desde `src/index.ts`**

Normalizar ambos correos con `trim().toLowerCase()`. Orden de las verificaciones: sin correo, distinto del permitido (o permitido vacío), no verificado.

- [ ] **Paso 5: Verificar**

Ejecutar: `pnpm test && pnpm lint && pnpm typecheck`
Esperado: 7 pruebas en verde; lint y typecheck sin errores.

- [ ] **Paso 6: Commit**

```bash
git add -A && git commit -m "chore: crear monorepo y regla de acceso en core"
```

---

### Tarea 2: Dominio de archivos en `core`

**Archivos:**
- Crear: `packages/core/src/archivos/{formatos,fotogramas,formato,asset,index}.ts`
- Modificar: `packages/core/src/index.ts` (reexportar `archivos`)
- Prueba: `packages/core/src/archivos/{formatos,fotogramas,formato,asset}.test.ts`

**Interfaces:**
- Produce:
  ```ts
  type TipoArchivo = 'video' | 'image';
  const LIMITE_IMAGEN_BYTES = 50 * 1024 ** 2;
  function detectarTipo(nombre: string, mime: string): { tipo: TipoArchivo; mime: string } | null;
  type ErrorArchivo = 'formato_no_soportado' | 'archivo_vacio' | 'excede_limite' | 'imagen_excede_limite';
  function validarArchivo(a: { nombre: string; mime: string; bytes: number }, maxUploadGb: number):
    { ok: true; tipo: TipoArchivo; mime: string } | { ok: false; error: ErrorArchivo; mensaje: string };

  type Fotograma = 'start' | 'middle' | 'end';
  function tiemposDeFotogramas(durationSec: number): Record<Fotograma, number>;
  function dimensionesEfectivas(ancho: number, alto: number, rotacion: number): { width: number; height: number; aspect: number };
  function describirProporcion(aspect: number): string;

  const LOCALE = 'es-419';
  function formatearBytes(bytes: number): string;
  function formatearDuracion(segundos: number): string;

  type EstadoAsset = 'subiendo' | 'procesando' | 'listo' | 'fallido' | 'purgado';
  type EstadoVisible = EstadoAsset | 'interrumpido';
  interface Asset {
    id: string; kind: 'video' | 'image' | 'audio'; source: 'subida' | 'tts';
    originalName: string; storagePath: string; mimeType: string; sizeBytes: number;
    width?: number; height?: number; aspect?: number; durationSec?: number; fps?: number;
    hasAudio?: boolean; codec?: string; rotation?: number;
    frames?: { start: string; middle?: string; end?: string };
    status: EstadoAsset; error?: string; createdAt: Date; purgeAt?: Date;
  }
  function rutaOriginal(assetId: string): string;            // 'originales/{id}'
  function rutaFotograma(assetId: string, f: Fotograma): string; // 'fotogramas/{id}/{f}.jpg'
  function estadoVisible(asset: Pick<Asset, 'id' | 'status'>, subidasActivas: ReadonlySet<string>): EstadoVisible;
  const ETIQUETAS_ESTADO: Record<EstadoVisible, string>;
  ```

- [ ] **Paso 1: Escribir las pruebas que fallan**

```ts
// formatos.test.ts
const GB = 1024 ** 3;
it('detecta por extensión sin importar mayúsculas', () => {
  expect(detectarTipo('clip.MOV', '')).toEqual({ tipo: 'video', mime: 'video/quicktime' });
  expect(detectarTipo('foto.heic', '')).toEqual({ tipo: 'image', mime: 'image/heic' });
});
it('usa el MIME si no hay extensión', () => {
  expect(detectarTipo('sin-extension', 'video/mp4')).toEqual({ tipo: 'video', mime: 'video/mp4' });
});
it('devuelve null para formatos no soportados', () => {
  expect(detectarTipo('doc.pdf', 'application/pdf')).toBeNull();
});
it('acepta un video dentro del límite', () => {
  expect(validarArchivo({ nombre: 'a.mp4', mime: 'video/mp4', bytes: 2 * GB }, 10)).toEqual({ ok: true, tipo: 'video', mime: 'video/mp4' });
});
it('rechaza archivos vacíos, excedidos y no soportados', () => {
  expect(validarArchivo({ nombre: 'a.mp4', mime: 'video/mp4', bytes: 0 }, 10)).toMatchObject({ ok: false, error: 'archivo_vacio', mensaje: 'El archivo está vacío.' });
  expect(validarArchivo({ nombre: 'a.mp4', mime: 'video/mp4', bytes: 11 * GB }, 10)).toMatchObject({ ok: false, error: 'excede_limite', mensaje: 'El archivo supera el límite de 10 GB.' });
  expect(validarArchivo({ nombre: 'a.png', mime: 'image/png', bytes: 51 * 1024 ** 2 }, 10)).toMatchObject({ ok: false, error: 'imagen_excede_limite', mensaje: 'Las imágenes no pueden superar 50 MB.' });
  expect(validarArchivo({ nombre: 'a.pdf', mime: 'application/pdf', bytes: 10 }, 10)).toMatchObject({ ok: false, error: 'formato_no_soportado', mensaje: 'Formato no soportado. Usa mp4, mov, webm, jpg, png, webp o heic.' });
});

// fotogramas.test.ts
it('usa segundo 1, mitad y un segundo antes del final', () => {
  expect(tiemposDeFotogramas(60)).toEqual({ start: 1, middle: 30, end: 59 });
});
it('ajusta videos de menos de 2 segundos', () => {
  expect(tiemposDeFotogramas(1.5)).toEqual({ start: 0, middle: 0.75, end: 1.4 });
});
it('rechaza duraciones inválidas', () => {
  expect(() => tiemposDeFotogramas(0)).toThrow(RangeError);
  expect(() => tiemposDeFotogramas(Number.NaN)).toThrow(RangeError);
});
it('intercambia dimensiones con rotación de 90 o 270 grados', () => {
  expect(dimensionesEfectivas(1920, 1080, 90)).toEqual({ width: 1080, height: 1920, aspect: 0.5625 });
  expect(dimensionesEfectivas(1920, 1080, -90)).toEqual({ width: 1080, height: 1920, aspect: 0.5625 });
  expect(dimensionesEfectivas(1920, 1080, 180)).toEqual({ width: 1920, height: 1080, aspect: 1.7778 });
});
it('describe proporciones comunes con tolerancia del 2 %', () => {
  expect(describirProporcion(0.5625)).toBe('9:16');
  expect(describirProporcion(0.565)).toBe('9:16');
  expect(describirProporcion(1.7778)).toBe('16:9');
  expect(describirProporcion(1)).toBe('1:1');
  expect(describirProporcion(0.8)).toBe('4:5');
  expect(describirProporcion(1.91)).toBe('1.91:1');
  expect(describirProporcion(1.5)).toBe('1.5:1');
});

// formato.test.ts
it('formatea bytes', () => {
  expect(formatearBytes(0)).toBe('0 B');
  expect(formatearBytes(1536)).toBe('1.5 KB');
  expect(formatearBytes(10.25 * 1024 ** 2)).toBe('10.3 MB');
  expect(formatearBytes(2 * 1024 ** 3)).toBe('2 GB');
});
it('formatea duraciones', () => {
  expect(formatearDuracion(4)).toBe('0:04');
  expect(formatearDuracion(75.4)).toBe('1:15');
  expect(formatearDuracion(3725)).toBe('1:02:05');
});

// asset.test.ts
it('construye rutas de Storage', () => {
  expect(rutaOriginal('abc')).toBe('originales/abc');
  expect(rutaFotograma('abc', 'middle')).toBe('fotogramas/abc/middle.jpg');
});
it('marca como interrumpida una subida que no está activa en esta sesión', () => {
  expect(estadoVisible({ id: 'a', status: 'subiendo' }, new Set(['a']))).toBe('subiendo');
  expect(estadoVisible({ id: 'a', status: 'subiendo' }, new Set())).toBe('interrumpido');
  expect(estadoVisible({ id: 'a', status: 'listo' }, new Set())).toBe('listo');
});
it('tiene etiquetas en español', () => {
  expect(ETIQUETAS_ESTADO).toEqual({
    subiendo: 'Subiendo', procesando: 'Procesando', listo: 'Listo',
    fallido: 'Error', interrumpido: 'Subida interrumpida', purgado: 'Purgado',
  });
});
```

- [ ] **Paso 2: Ejecutar y confirmar que fallan**

Ejecutar: `pnpm vitest run packages/core/src/archivos`
Esperado: FAIL (módulos inexistentes).

- [ ] **Paso 3: Implementar los módulos con las firmas de Interfaces**

- `detectarTipo`: tabla de extensiones `mp4→video/mp4`, `mov→video/quicktime`, `webm→video/webm`, `jpg|jpeg→image/jpeg`, `png→image/png`, `webp→image/webp`, `heic→image/heic`. Primero la extensión en minúsculas; si no hay extensión, el MIME si pertenece a la tabla.
- `validarArchivo`: orden formato → vacío → límite de imagen → límite general.
- `tiemposDeFotogramas`: si `d ≥ 2` → `{1, d/2, d−1}`; si `0 < d < 2` → `{0, d/2, max(0, d−0.1)}`; redondear a 3 decimales.
- `dimensionesEfectivas`: normalizar `((r % 360) + 360) % 360` e intercambiar en 90 y 270; `aspect` con 4 decimales.
- `describirProporcion`: candidatas `9:16, 16:9, 1:1, 4:5, 1.91:1`; si la diferencia relativa es ≤ 2 % se usa la candidata; si no, `${redondeo a 2 decimales sin ceros finales}:1`.
- `formatearBytes`: unidades B, KB, MB, GB, TB en base 1024 con `Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 })`.
- `formatearDuracion`: redondeo hacia abajo a segundos; `m:ss` o `h:mm:ss`.

- [ ] **Paso 4: Ejecutar y confirmar que pasan**

Ejecutar: `pnpm vitest run packages/core`
Esperado: PASS.

- [ ] **Paso 5: Commit**

```bash
git add packages/core && git commit -m "feat(core): dominio de archivos, fotogramas y formatos"
```

---

### Tarea 3: Ajustes generales en `core`

**Archivos:**
- Crear: `packages/core/src/ajustes.ts`
- Modificar: `packages/core/src/index.ts`
- Prueba: `packages/core/src/ajustes.test.ts`

**Interfaces:**
- Produce:
  ```ts
  const ajustesAppSchema: z.ZodObject<{ timezone; retentionDays; maxUploadGb }>;
  type AjustesApp = { timezone: string; retentionDays: number; maxUploadGb: number };
  const AJUSTES_POR_DEFECTO: AjustesApp; // { timezone: 'UTC', retentionDays: 7, maxUploadGb: 10 }
  function esZonaHorariaValida(tz: string): boolean;
  function leerAjustes(datos: unknown): AjustesApp;
  ```

- [ ] **Paso 1: Escribir la prueba que falla**

```ts
it('acepta valores válidos', () => {
  expect(ajustesAppSchema.parse({ timezone: 'America/Bogota', retentionDays: 14, maxUploadGb: 20 })).toEqual({ timezone: 'America/Bogota', retentionDays: 14, maxUploadGb: 20 });
});
it('valida rangos y zona horaria con mensajes en español', () => {
  const r = ajustesAppSchema.safeParse({ timezone: 'Marte/Olimpo', retentionDays: 0, maxUploadGb: 51 });
  expect(r.success).toBe(false);
  const mensajes = r.success ? [] : r.error.issues.map((i) => i.message);
  expect(mensajes).toEqual(expect.arrayContaining(['Zona horaria inválida', 'Debe ser entre 1 y 90 días', 'Debe ser entre 1 y 50 GB']));
});
it('usa los valores por defecto si no hay datos', () => {
  expect(leerAjustes(undefined)).toEqual({ timezone: 'UTC', retentionDays: 7, maxUploadGb: 10 });
});
it('completa los campos faltantes', () => {
  expect(leerAjustes({ retentionDays: 14, timezone: 'America/Bogota' })).toEqual({ timezone: 'America/Bogota', retentionDays: 14, maxUploadGb: 10 });
});
it('reemplaza solo los campos inválidos', () => {
  expect(leerAjustes({ retentionDays: -3, maxUploadGb: 20 })).toEqual({ timezone: 'UTC', retentionDays: 7, maxUploadGb: 20 });
});
```

- [ ] **Paso 2: Ejecutar y confirmar que falla**

Ejecutar: `pnpm vitest run packages/core/src/ajustes.test.ts`
Esperado: FAIL.

- [ ] **Paso 3: Implementar `ajustes.ts`**

`retentionDays`: entero 1–90. `maxUploadGb`: número 1–50. `esZonaHorariaValida`: `new Intl.DateTimeFormat('en', { timeZone: tz })` dentro de `try`. `leerAjustes` valida cada campo por separado con `ajustesAppSchema.shape[campo].safeParse` y usa el valor por defecto en los inválidos.

- [ ] **Paso 4: Ejecutar y confirmar que pasa**

Ejecutar: `pnpm vitest run packages/core`
Esperado: PASS.

- [ ] **Paso 5: Commit**

```bash
git add packages/core && git commit -m "feat(core): esquema y lectura de ajustes generales"
```

---

### Tarea 4: Configuración de Firebase y reglas de seguridad

**Archivos:**
- Crear: `firebase.json`, `.firebaserc`, `firestore.rules`, `firestore.indexes.json`, `storage.rules`
- Crear: `pruebas/integracion/{package.json,tsconfig.json,vitest.config.ts}`
- Modificar: `package.json` raíz (dependencia `firebase-tools` y script `test:integracion`)
- Prueba: `pruebas/integracion/src/reglas.test.ts`

**Interfaces:**
- Produce: claim `owner: true` como único criterio de acceso en reglas; script `pnpm test:integracion`.

- [ ] **Paso 1: Configurar Firebase**

`.firebaserc`: `{ "projects": { "default": "demo-omnistream" } }`.

`firebase.json`:

```json
{
  "firestore": { "rules": "firestore.rules", "indexes": "firestore.indexes.json" },
  "storage": { "rules": "storage.rules" },
  "functions": [{ "source": "functions/dist", "codebase": "default",
                  "predeploy": ["pnpm --filter @omnistream/functions build"] }],
  "emulators": {
    "auth": { "port": 9099 }, "firestore": { "port": 8080 }, "storage": { "port": 9199 },
    "functions": { "port": 5001 }, "ui": { "enabled": true, "port": 4000 }, "singleProjectMode": true
  }
}
```

`firestore.indexes.json`: `{ "indexes": [], "fieldOverrides": [] }`.

`firestore.rules`:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function esPropietario() { return request.auth != null && request.auth.token.owner == true; }
    match /secrets/{id} { allow read, write: if false; }
    match /settings/{id} { allow read, write: if esPropietario(); }
    match /assets/{id} { allow read, write: if esPropietario(); }
  }
}
```

`storage.rules`:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    function esPropietario() { return request.auth != null && request.auth.token.owner == true; }
    match /originales/{assetId} {
      allow read, delete: if esPropietario();
      allow create, update: if esPropietario()
        && firestore.exists(/databases/(default)/documents/assets/$(assetId))
        && request.resource.size < 50 * 1024 * 1024 * 1024
        && request.resource.contentType.matches('(video|image)/.+');
    }
    match /fotogramas/{assetId}/{archivo} {
      allow read, delete: if esPropietario();
    }
  }
}
```

`pruebas/integracion/package.json`: nombre `@omnistream/pruebas-integracion`, `"type": "module"`, scripts `test` (`vitest run`) y `typecheck`; dependencias de desarrollo `@firebase/rules-unit-testing`, `firebase`, `firebase-admin`, `vitest`. `vitest.config.ts` con `testTimeout: 120_000` y `fileParallelism: false`.

Script raíz: `"test:integracion": "firebase emulators:exec --only firestore,storage --project demo-omnistream \"pnpm --filter @omnistream/pruebas-integracion test\""`.

- [ ] **Paso 2: Escribir las pruebas de reglas**

Con `initializeTestEnvironment({ projectId: 'demo-omnistream', firestore: { rules }, storage: { rules } })`. Contextos: `anonimo = unauthenticatedContext()`, `extraño = authenticatedContext('u2', {})`, `propietario = authenticatedContext('u1', { owner: true })`.

```ts
describe('Firestore', () => {
  it('anónimo no lee settings/app', () => assertFails(getDoc(doc(anonimo.firestore(), 'settings/app'))));
  it('usuario sin claim owner no lee assets', () => assertFails(getDoc(doc(extraño.firestore(), 'assets/a1'))));
  it('propietario lee y escribe settings/app', async () => {
    await assertSucceeds(setDoc(doc(propietario.firestore(), 'settings/app'), { retentionDays: 7 }));
    await assertSucceeds(getDoc(doc(propietario.firestore(), 'settings/app')));
  });
  it('propietario crea assets', () => assertSucceeds(setDoc(doc(propietario.firestore(), 'assets/a1'), { status: 'subiendo' })));
  it('propietario no lee ni escribe secrets', async () => {
    await assertFails(getDoc(doc(propietario.firestore(), 'secrets/ai_anthropic')));
    await assertFails(setDoc(doc(propietario.firestore(), 'secrets/ai_anthropic'), { x: 1 }));
  });
  it('colecciones no declaradas están denegadas', () => assertFails(getDoc(doc(propietario.firestore(), 'posts/p1'))));
});

describe('Storage', () => {
  // beforeEach: crear assets/a1 con withSecurityRulesDisabled
  it('propietario sube el original si existe el asset', () =>
    assertSucceeds(uploadBytes(ref(propietario.storage(), 'originales/a1'), bytes, { contentType: 'video/mp4' })));
  it('sin documento de asset la subida falla', () =>
    assertFails(uploadBytes(ref(propietario.storage(), 'originales/zz'), bytes, { contentType: 'video/mp4' })));
  it('rechaza tipos de contenido no permitidos', () =>
    assertFails(uploadBytes(ref(propietario.storage(), 'originales/a1'), bytes, { contentType: 'text/plain' })));
  it('propietario no puede escribir fotogramas', () =>
    assertFails(uploadBytes(ref(propietario.storage(), 'fotogramas/a1/start.jpg'), bytes, { contentType: 'image/jpeg' })));
  it('propietario lee fotogramas', () => assertSucceeds(getBytes(ref(propietario.storage(), 'fotogramas/a1/start.jpg'))));
  // el fotograma se crea antes con withSecurityRulesDisabled
  it('usuario sin owner no lee originales', () => assertFails(getBytes(ref(extraño.storage(), 'originales/a1'))));
});
```

- [ ] **Paso 3: Ejecutar**

Ejecutar: `pnpm test:integracion`
Esperado: 12 pruebas en verde. Requiere Java 21 (`java -version`); si falta, instalarlo antes de seguir.

- [ ] **Paso 4: Commit**

```bash
git add -A && git commit -m "feat: configuración de Firebase y reglas de seguridad con pruebas"
```

---

### Tarea 5: Funciones: empaquetado y bloqueo de acceso

**Archivos:**
- Crear: `functions/package.json`, `functions/tsconfig.json`, `functions/vitest.config.ts`, `functions/build.mjs`, `functions/.env.demo-omnistream`
- Crear: `functions/src/index.ts`, `functions/src/config.ts`, `functions/src/acceso/bloqueos.ts`
- Prueba: `functions/src/acceso/bloqueos.test.ts`, `pruebas/integracion/src/funciones/acceso.test.ts`
- Modificar: `package.json` raíz (`test:integracion`)

**Interfaces:**
- Consume: `evaluarAcceso`, `MENSAJES_ACCESO` (Tarea 1).
- Produce:
  ```ts
  // config.ts
  const REGION = 'us-central1';
  const correoPermitido: StringParam; // defineString('ALLOWED_EMAIL')
  // acceso/bloqueos.ts
  function verificarUsuario(u: { email?: string | null; emailVerified?: boolean }, correo: string): { customClaims: { owner: true } };
  // lanza HttpsError('permission-denied', MENSAJES_ACCESO[motivo])
  const antesDeCrearUsuario;   // beforeUserCreated({ region: REGION })
  const antesDeIniciarSesion;  // beforeUserSignedIn({ region: REGION })
  ```
  Script de empaquetado: `pnpm --filter @omnistream/functions build [--sin-instalar]`.

- [ ] **Paso 1: Escribir la prueba unitaria que falla**

```ts
it('devuelve el claim owner para el correo permitido', () => {
  expect(verificarUsuario({ email: 'propietario@omnistream.test', emailVerified: true }, 'propietario@omnistream.test'))
    .toEqual({ customClaims: { owner: true } });
});
it('lanza permission-denied con mensaje en español', () => {
  expect(() => verificarUsuario({ email: 'intruso@ejemplo.com', emailVerified: true }, 'propietario@omnistream.test'))
    .toThrowError(expect.objectContaining({ code: 'permission-denied', message: 'Esta cuenta no tiene acceso a OmniStream.' }));
});
```

- [ ] **Paso 2: Ejecutar y confirmar que falla**

Ejecutar: `pnpm vitest run functions/src/acceso`
Esperado: FAIL.

- [ ] **Paso 3: Implementar `config.ts`, `bloqueos.ts` e `index.ts`**

Ambos disparadores llaman a `verificarUsuario(event.data, correoPermitido.value())` y devuelven su resultado. `index.ts` exporta `antesDeCrearUsuario` y `antesDeIniciarSesion`.

- [ ] **Paso 4: Implementar `build.mjs`**

1. esbuild: entrada `src/index.ts`, salida `dist/index.js`, `bundle`, `platform: 'node'`, `format: 'cjs'`, `target: 'node22'`. Externas: todas las `dependencies` de `functions/package.json` (así `@omnistream/core`, que está en `devDependencies`, queda incluido en el paquete).
2. Escribir `dist/package.json` con `name: "omnistream-functions"`, `main: "index.js"`, `engines: { node: "22" }` y las mismas `dependencies`.
3. Copiar `functions/.env.*` a `dist/`.
4. Salvo con `--sin-instalar`, ejecutar `npm install --omit=dev --no-audit --no-fund --no-package-lock` dentro de `dist/`.

`functions/package.json`: nombre `@omnistream/functions`; `dependencies`: `firebase-admin`, `firebase-functions`; `devDependencies`: `@omnistream/core` (`workspace:*`), `esbuild`, `typescript`, `vitest`. `.env.demo-omnistream`: `ALLOWED_EMAIL=propietario@omnistream.test`. Agregar `functions` a los proyectos de Vitest.

- [ ] **Paso 5: Escribir la prueba de integración**

Con el SDK cliente conectado a los emuladores de Auth y Functions, iniciando sesión con una credencial de Google simulada (el emulador acepta un JSON sin firmar como ID token):

```ts
const credencial = (email: string) =>
  GoogleAuthProvider.credential(JSON.stringify({ sub: email, email, email_verified: true }));

it('el correo permitido entra y recibe el claim owner', async () => {
  const { user } = await signInWithCredential(auth, credencial('propietario@omnistream.test'));
  const token = await user.getIdTokenResult(true);
  expect(token.claims.owner).toBe(true);
});
it('otro correo es rechazado', async () => {
  await expect(signInWithCredential(auth, credencial('intruso@ejemplo.com'))).rejects.toThrow(/Esta cuenta no tiene acceso a OmniStream/);
});
```

Actualizar el script raíz: `"test:integracion": "pnpm --filter @omnistream/functions build && firebase emulators:exec --only auth,firestore,storage,functions --project demo-omnistream \"pnpm --filter @omnistream/pruebas-integracion test\""`.

- [ ] **Paso 6: Ejecutar**

Ejecutar: `pnpm test && pnpm test:integracion`
Esperado: PASS en unitarias, reglas y acceso.

- [ ] **Paso 7: Commit**

```bash
git add -A && git commit -m "feat(functions): empaquetado y bloqueo de acceso por correo"
```

---

### Tarea 6: Funciones: análisis de medios

**Archivos:**
- Crear: `functions/src/archivos/analizar.ts`, `functions/src/archivos/medios.ts`
- Modificar: `functions/package.json` (agregar a `dependencies`: `ffmpeg-static`, `ffprobe-static`, `sharp`, `heic-convert`)
- Prueba: `functions/src/archivos/analizar.test.ts`, `functions/src/archivos/medios.test.ts`

**Interfaces:**
- Consume: `dimensionesEfectivas` (Tarea 2).
- Produce:
  ```ts
  interface AnalisisVideo { width: number; height: number; aspect: number; durationSec: number; fps: number; hasAudio: boolean; codec: string; rotation: number }
  class ErrorAnalisis extends Error { codigo: 'sin_pista_video' | 'duracion_invalida' }
  function analizarSalidaFfprobe(salida: FfprobeSalida): AnalisisVideo;
  function probar(url: string, cabeceras?: string): Promise<FfprobeSalida>;
  function extraerFotograma(url: string, segundo: number, destino: string, cabeceras?: string): Promise<void>;
  function procesarImagen(entrada: Buffer): Promise<{ width: number; height: number; aspect: number; rotation: number; miniatura: Buffer }>;
  function convertirHeicAJpeg(entrada: Buffer): Promise<Buffer>;
  ```

- [ ] **Paso 1: Escribir las pruebas de `analizarSalidaFfprobe`**

```ts
const video = { codec_type: 'video', codec_name: 'h264', width: 1080, height: 1920, r_frame_rate: '30000/1001' };
it('extrae los datos de un video vertical con audio', () => {
  expect(analizarSalidaFfprobe({ streams: [video, { codec_type: 'audio' }], format: { duration: '12.345' } }))
    .toEqual({ width: 1080, height: 1920, aspect: 0.5625, durationSec: 12.345, fps: 29.97, hasAudio: true, codec: 'h264', rotation: 0 });
});
it('aplica la rotación de la matriz de visualización', () => {
  const r = analizarSalidaFfprobe({ streams: [{ ...video, width: 1920, height: 1080, side_data_list: [{ side_data_type: 'Display Matrix', rotation: -90 }] }], format: { duration: '5' } });
  expect(r).toMatchObject({ width: 1080, height: 1920, aspect: 0.5625, rotation: 270, hasAudio: false });
});
it('aplica la rotación de la etiqueta rotate', () => {
  const r = analizarSalidaFfprobe({ streams: [{ ...video, width: 1920, height: 1080, tags: { rotate: '90' } }], format: { duration: '5' } });
  expect(r).toMatchObject({ width: 1080, height: 1920, rotation: 90 });
});
it('falla sin pista de video', () => {
  expect(() => analizarSalidaFfprobe({ streams: [{ codec_type: 'audio' }], format: { duration: '5' } })).toThrowError(expect.objectContaining({ codigo: 'sin_pista_video' }));
});
it('falla con duración ausente o cero', () => {
  expect(() => analizarSalidaFfprobe({ streams: [video], format: {} })).toThrowError(expect.objectContaining({ codigo: 'duracion_invalida' }));
  expect(() => analizarSalidaFfprobe({ streams: [video], format: { duration: '0' } })).toThrowError(expect.objectContaining({ codigo: 'duracion_invalida' }));
});
```

- [ ] **Paso 2: Escribir las pruebas de `medios`**

En `beforeAll`, generar con `ffmpeg-static` un video de 3 s de 720×1280 con audio en un directorio temporal: `-f lavfi -i testsrc=size=720x1280:rate=30 -f lavfi -i sine=frequency=440 -t 3 -c:v libx264 -pix_fmt yuv420p -c:a aac`.

```ts
it('probar y analizar leen el video generado', async () => {
  const r = analizarSalidaFfprobe(await probar(rutaVideo));
  expect(r).toMatchObject({ width: 720, height: 1280, hasAudio: true });
  expect(r.durationSec).toBeCloseTo(3, 0);
});
it('extraerFotograma escribe un JPEG', async () => {
  await extraerFotograma(rutaVideo, 1.5, destino);
  expect((await readFile(destino)).subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
});
it('procesarImagen aplica la orientación EXIF', async () => {
  const jpg = await sharp({ create: { width: 1200, height: 800, channels: 3, background: '#B08442' } }).jpeg().withMetadata({ orientation: 6 }).toBuffer();
  const r = await procesarImagen(jpg);
  expect(r).toMatchObject({ width: 800, height: 1200, rotation: 90 });
  expect((await sharp(r.miniatura).metadata()).format).toBe('jpeg');
});
```

- [ ] **Paso 3: Ejecutar y confirmar que fallan**

Ejecutar: `pnpm vitest run functions/src/archivos`
Esperado: FAIL.

- [ ] **Paso 4: Implementar `analizar.ts` y `medios.ts`**

- `analizarSalidaFfprobe`: primera pista `video`; rotación desde `side_data_list[].rotation` o `tags.rotate`, normalizada a [0, 360); `fps` a partir de `r_frame_rate` con 2 decimales; duración desde `format.duration` o, si falta, la de la pista; dimensiones con `dimensionesEfectivas`.
- `probar`: `execFile(ffprobePath, ['-v','error','-print_format','json','-show_streams','-show_format', ...(cabeceras ? ['-headers', cabeceras] : []), url])`.
- `extraerFotograma`: `ffmpeg -ss {segundo} [-headers ...] -i url -frames:v 1 -vf "scale='min(1280,iw)':-2" -q:v 3 -y destino`. `-ss` antes de `-i` para buscar sin leer todo el archivo.
- `procesarImagen`: `sharp(entrada).metadata()`; orientación EXIF 5–8 → rotación 90 o 270; `miniatura = sharp(entrada).rotate().resize({ width: 1280, withoutEnlargement: true }).jpeg({ quality: 82 })`.
- `convertirHeicAJpeg`: `heic-convert` con `format: 'JPEG', quality: 0.9`.

- [ ] **Paso 5: Ejecutar y confirmar que pasan**

Ejecutar: `pnpm vitest run functions`
Esperado: PASS.

- [ ] **Paso 6: Commit**

```bash
git add -A && git commit -m "feat(functions): análisis de video e imagen con ffprobe, ffmpeg y sharp"
```

---

### Tarea 7: Funciones: `procesarArchivo`

**Archivos:**
- Crear: `functions/src/archivos/urlLectura.ts`, `functions/src/archivos/procesarObjeto.ts`, `functions/src/archivos/procesarArchivo.ts`
- Modificar: `functions/src/index.ts` (exportar `procesarArchivo`)
- Prueba: `functions/src/archivos/procesarObjeto.test.ts`, `pruebas/integracion/src/fixtures.ts`, `pruebas/integracion/src/funciones/procesarArchivo.test.ts`

**Interfaces:**
- Consume: Tareas 2 y 6.
- Produce:
  ```ts
  function urlDeLectura(bucket: string, ruta: string): Promise<{ url: string; cabeceras?: string }>;
  interface DependenciasProcesamiento {
    leerAsset(id: string): Promise<{ status: EstadoAsset } | null>;
    actualizarAsset(id: string, datos: Record<string, unknown>): Promise<void>;
    descargar(ruta: string): Promise<Buffer>;
    subir(ruta: string, datos: Buffer, contentType: string, metadata?: Record<string, string>): Promise<void>;
    urlDeLectura(ruta: string): Promise<{ url: string; cabeceras?: string }>;
    probar: typeof probar; extraerFotograma: typeof extraerFotograma;
    procesarImagen: typeof procesarImagen; convertirHeicAJpeg: typeof convertirHeicAJpeg;
    directorioTemporal(): Promise<{ ruta: string; limpiar(): Promise<void> }>;
  }
  function procesarObjeto(obj: { name: string; contentType?: string }, deps: DependenciasProcesamiento): Promise<void>;
  const MENSAJE_ERROR_LECTURA = 'No se pudo leer el archivo. Puede estar dañado o en un formato no soportado.';
  const procesarArchivo; // onObjectFinalized({ region: REGION, memory: '2GiB', timeoutSeconds: 540 })
  ```

- [ ] **Paso 1: Escribir las pruebas unitarias con dependencias falsas**

```ts
it('ignora objetos fuera de originales/', async () => {
  await procesarObjeto({ name: 'fotogramas/a1/start.jpg', contentType: 'image/jpeg' }, deps);
  expect(deps.actualizarAsset).not.toHaveBeenCalled();
});
it('no hace nada si el asset no existe', async () => {
  deps.leerAsset.mockResolvedValue(null);
  await procesarObjeto({ name: 'originales/a1', contentType: 'video/mp4' }, deps);
  expect(deps.actualizarAsset).not.toHaveBeenCalled();
});
it('video: marca procesando, extrae 3 fotogramas y queda listo', async () => {
  deps.probar.mockResolvedValue(salidaVertical60s); // 1080×1920, 60 s, con audio
  await procesarObjeto({ name: 'originales/a1', contentType: 'video/mp4' }, deps);
  expect(deps.actualizarAsset).toHaveBeenNthCalledWith(1, 'a1', { status: 'procesando' });
  expect(deps.extraerFotograma.mock.calls.map((c) => c[1])).toEqual([1, 30, 59]);
  expect(deps.actualizarAsset).toHaveBeenLastCalledWith('a1', expect.objectContaining({
    status: 'listo', width: 1080, height: 1920, aspect: 0.5625, durationSec: 60, hasAudio: true,
    frames: { start: 'fotogramas/a1/start.jpg', middle: 'fotogramas/a1/middle.jpg', end: 'fotogramas/a1/end.jpg' },
  }));
});
it('imagen: guarda dimensiones y un fotograma', async () => {
  await procesarObjeto({ name: 'originales/a1', contentType: 'image/png' }, deps);
  expect(deps.actualizarAsset).toHaveBeenLastCalledWith('a1', expect.objectContaining({ status: 'listo', frames: { start: 'fotogramas/a1/start.jpg' } }));
});
it('heic: convierte y vuelve a subir como JPEG sin marcar listo', async () => {
  await procesarObjeto({ name: 'originales/a1', contentType: 'image/heic' }, deps);
  expect(deps.subir).toHaveBeenCalledWith('originales/a1', jpegConvertido, 'image/jpeg', { heicConvertido: '1' });
  expect(deps.actualizarAsset).toHaveBeenLastCalledWith('a1', { mimeType: 'image/jpeg' });
});
it('un error de lectura deja el asset fallido con mensaje en español', async () => {
  deps.probar.mockRejectedValue(new Error('Invalid data found'));
  await procesarObjeto({ name: 'originales/a1', contentType: 'video/mp4' }, deps);
  expect(deps.actualizarAsset).toHaveBeenLastCalledWith('a1', { status: 'fallido', error: MENSAJE_ERROR_LECTURA });
});
it('siempre limpia el directorio temporal', async () => {
  deps.probar.mockRejectedValue(new Error('x'));
  await procesarObjeto({ name: 'originales/a1', contentType: 'video/mp4' }, deps);
  expect(limpiar).toHaveBeenCalled();
});
```

- [ ] **Paso 2: Ejecutar y confirmar que fallan**

Ejecutar: `pnpm vitest run functions/src/archivos/procesarObjeto.test.ts`
Esperado: FAIL.

- [ ] **Paso 3: Implementar `procesarObjeto`, `urlDeLectura` y `procesarArchivo`**

- `procesarObjeto`: ignorar lo que no empiece por `originales/`; leer el asset; marcar `procesando`; HEIC → convertir, `subir` y actualizar `mimeType`, sin seguir (la nueva subida dispara otro evento); imagen → `descargar`, `procesarImagen`, subir la miniatura a `rutaFotograma(id, 'start')`; video → `urlDeLectura`, `probar`, `analizarSalidaFfprobe`, `tiemposDeFotogramas` y 3 llamadas a `extraerFotograma` en el directorio temporal; después subir cada JPEG. Cualquier excepción → `fallido` con `MENSAJE_ERROR_LECTURA`, y el detalle va a `logger.error`. `limpiar()` en `finally`.
- `subir` en las dependencias reales agrega `firebaseStorageDownloadTokens: randomUUID()` a la metadata de los fotogramas, para que `getDownloadURL` funcione en el cliente.
- `urlDeLectura`: si `process.env.FUNCTIONS_EMULATOR === 'true'`, devolver `http://${FIREBASE_STORAGE_EMULATOR_HOST}/v0/b/${bucket}/o/${encodeURIComponent(ruta)}?alt=media` con `cabeceras: 'Authorization: Bearer owner\r\n'`; si no, URL firmada v4 de lectura válida por 15 minutos.
- `procesarArchivo`: arma las dependencias reales con `firebase-admin` (Firestore `assets/{id}`, `getStorage().bucket(event.data.bucket)`) y llama a `procesarObjeto(event.data, deps)`.

- [ ] **Paso 4: Escribir las pruebas de integración**

`fixtures.ts` genera con `ffmpeg-static` (agregar a las dependencias de desarrollo de `pruebas/integracion`), en `pruebas/integracion/.fixtures/`: `video-vertical.mp4` (720×1280, 4 s, con audio), `imagen.jpg` (1200×800) y `danado.mp4` (64 KB aleatorios). Exporta `prepararFixtures(): Promise<{ video: string; imagen: string; danado: string }>`.

Cada prueba crea `assets/{id}` con `status: 'subiendo'` usando el SDK de administración, sube el archivo a `originales/{id}` con su `contentType` y espera hasta 60 s a que el estado sea `listo` o `fallido`.

```ts
it('un video subido queda listo con sus datos y 3 fotogramas', async () => {
  const asset = await subirYEsperar(fixtures.video, 'video/mp4');
  expect(asset).toMatchObject({ status: 'listo', width: 720, height: 1280, aspect: 0.5625, hasAudio: true });
  expect(asset.durationSec).toBeCloseTo(4, 0);
  for (const f of ['start', 'middle', 'end']) expect((await bucket.file(`fotogramas/${asset.id}/${f}.jpg`).exists())[0]).toBe(true);
});
it('una imagen queda lista con un fotograma', async () => {
  expect(await subirYEsperar(fixtures.imagen, 'image/jpeg')).toMatchObject({ status: 'listo', width: 1200, height: 800, frames: { start: expect.any(String) } });
});
it('un archivo dañado queda fallido', async () => {
  expect(await subirYEsperar(fixtures.danado, 'video/mp4')).toMatchObject({ status: 'fallido', error: 'No se pudo leer el archivo. Puede estar dañado o en un formato no soportado.' });
});
```

- [ ] **Paso 5: Ejecutar**

Ejecutar: `pnpm test && pnpm test:integracion`
Esperado: PASS.

- [ ] **Paso 6: Commit**

```bash
git add -A && git commit -m "feat(functions): procesarArchivo con metadatos y fotogramas"
```

---

### Tarea 8: Web: proyecto, tema neoclásico y marca

**Archivos:**
- Crear: `apps/web` con `pnpm create next-app@latest apps/web --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm`
- Crear: `apps/web/vitest.config.ts`, `apps/web/vitest.setup.ts`, `apps/web/src/estilos/contraste.test.ts`
- Crear: `apps/web/src/components/marca/{Logo,Laurel,Meandro}.tsx` y su prueba `Logo.test.tsx`
- Modificar: `apps/web/src/app/layout.tsx`, `apps/web/src/app/globals.css`, `apps/web/next.config.ts`, `apps/web/package.json`

**Interfaces:**
- Produce: variables CSS de la spec 5.5; utilidades `.neu-elevado`, `.neu-hundido`, `.boton-oro`, `.fondo-marmol`, `.etiqueta-ornamental`; variables de fuente `--fuente-titulo`, `--fuente-ornamental`, `--fuente-texto`; componentes `<Logo variante?: 'completo' | 'compacto' />`, `<Laurel className? />`, `<Meandro className? />`.

- [ ] **Paso 1: Crear la app e instalar dependencias**

Nombre del paquete: `@omnistream/web`. `next.config.ts`: `transpilePackages: ['@omnistream/core']` y `env: { NEXT_PUBLIC_FIREBASE_WEBAPP_CONFIG: process.env.FIREBASE_WEBAPP_CONFIG ?? process.env.NEXT_PUBLIC_FIREBASE_WEBAPP_CONFIG ?? '' }`. Ejecutar `pnpm dlx shadcn@latest init` (color base `stone`) y agregar `button card dialog input label select progress badge dropdown-menu sonner tooltip switch separator skeleton command popover`. Dependencias: `@omnistream/core` (`workspace:*`), `firebase`, `react-hook-form`, `@hookform/resolvers`, `zod`, `lucide-react`, `react-dropzone`. Desarrollo: `vitest`, `jsdom`, `@vitejs/plugin-react`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `@playwright/test`. Agregar `apps/web` a los proyectos de Vitest (entorno `jsdom`).

- [ ] **Paso 2: Escribir la prueba de contraste que falla**

La prueba lee `src/app/globals.css`, extrae las variables hexadecimales de `:root` y calcula la razón de contraste WCAG.

```ts
const textos = ['--texto', '--texto-secundario', '--oro-profundo', '--exito', '--alerta', '--peligro'];
const fondos = ['--fondo', '--superficie', '--superficie-elevada'];
it.each(textos.flatMap((t) => fondos.map((f) => [t, f])))('%s sobre %s cumple 4.5:1', (t, f) => {
  expect(contraste(vars[t], vars[f])).toBeGreaterThanOrEqual(4.5);
});
it.each(['--boton-oro-inicio', '--boton-oro-fin'])('--sobre-oro sobre %s cumple 4.5:1', (f) => {
  expect(contraste(vars['--sobre-oro'], vars[f])).toBeGreaterThanOrEqual(4.5);
});
it('--oro sobre --superficie cumple 3:1 para elementos no textuales', () => {
  expect(contraste(vars['--oro'], vars['--superficie'])).toBeGreaterThanOrEqual(3);
});
```

- [ ] **Paso 3: Ejecutar y confirmar que falla**

Ejecutar: `pnpm vitest run apps/web/src/estilos`
Esperado: FAIL (variables inexistentes).

- [ ] **Paso 4: Definir el tema en `globals.css` y las fuentes en `layout.tsx`**

- Variables con los valores exactos de la tabla de la spec 5.5. Además: `--sombra-oscura: rgba(140, 110, 70, 0.22)`, `--sombra-clara: rgba(255, 255, 255, 0.85)`, `--radio: 18px`.
- Mapear las variables de shadcn: `--background → --fondo`, `--foreground → --texto`, `--card → --superficie`, `--popover → --superficie-elevada`, `--primary → --boton-oro-fin`, `--primary-foreground → --sobre-oro`, `--muted-foreground → --texto-secundario`, `--border` e `--input → --borde`, `--ring → --oro`, `--destructive → --peligro`, `--radius → --radio`.
- `.neu-elevado`: fondo `--superficie`, borde 1 px `--borde`, `box-shadow: 10px 10px 24px var(--sombra-oscura), -8px -8px 20px var(--sombra-clara)`.
- `.neu-hundido`: `box-shadow: inset 4px 4px 10px var(--sombra-oscura), inset -4px -4px 10px var(--sombra-clara)`.
- `.boton-oro`: `linear-gradient(180deg, var(--boton-oro-inicio), var(--boton-oro-fin))`, color `--sobre-oro`.
- `.fondo-marmol`: `--fondo` más dos gradientes radiales `--fondo-marmol-veta` (`#E6DACA`) al 35 % y un ruido SVG `feTurbulence` en data URI con opacidad 0.06.
- `.etiqueta-ornamental`: `--fuente-ornamental`, mayúsculas, `letter-spacing: 0.25em`.
- Fuentes con `next/font/google`: `Cormorant_Garamond` (500, 600, 700), `Cinzel` (400, 500, 600) y `Source_Serif_4` (variable). `<html lang="es">`, `body` con `fondo-marmol` y `--fuente-texto`; números con `font-variant-numeric: tabular-nums` en tablas y metadatos.

- [ ] **Paso 5: Crear los componentes de marca y su prueba**

```ts
it('Logo expone el nombre y el lema', () => {
  render(<Logo />);
  expect(screen.getByRole('img', { name: 'OmniStream' })).toBeInTheDocument();
  expect(screen.getByText('UNA VISIÓN. CADA PLATAFORMA.')).toBeInTheDocument();
});
```

`Laurel`: SVG de dos ramas simétricas de hojas en `--oro`, `aria-hidden`. `Logo`: contenedor `role="img"` con `aria-label="OmniStream"`, laurel, palabra "OmniStream" en `--fuente-titulo` 600 color `--oro-profundo`, y el lema en `.etiqueta-ornamental` (la variante `compacto` omite el lema). `Meandro`: franja SVG con patrón de greca griega repetible en `--oro-claro`, `aria-hidden`.

- [ ] **Paso 6: Ejecutar**

Ejecutar: `pnpm test && pnpm --filter @omnistream/web build`
Esperado: PASS y compilación sin errores.

- [ ] **Paso 7: Commit**

```bash
git add -A && git commit -m "feat(web): proyecto Next.js con tema neoclásico y marca"
```

---

### Tarea 9: Web: sesión, entrada y estructura de la app

**Archivos:**
- Crear: `apps/web/.env.development`, `apps/web/src/lib/firebase/{config.ts,cliente.ts,sesion.tsx,erroresEntrada.ts}`
- Crear: `apps/web/src/app/(publico)/entrar/page.tsx`, `apps/web/src/app/(app)/layout.tsx`, `apps/web/src/app/page.tsx`
- Crear: `apps/web/src/components/shell/{navegacion.ts,BarraLateral.tsx,BarraSuperior.tsx,Shell.tsx,GuardiaSesion.tsx}`, `apps/web/src/components/comunes/ProximaFase.tsx`
- Crear: `apps/web/src/app/(app)/{calendario,crear,pendientes,estadisticas,tendencias,plan}/page.tsx`
- Prueba: `navegacion.test.ts`, `GuardiaSesion.test.tsx`, `erroresEntrada.test.ts`

**Interfaces:**
- Consume: `Logo`, `Meandro` (Tarea 8).
- Produce:
  ```ts
  // cliente.ts
  function obtenerFirebase(): { app: FirebaseApp; auth: Auth; db: Firestore; storage: FirebaseStorage };
  // sesion.tsx
  type EstadoSesion =
    | { estado: 'cargando' } | { estado: 'anonimo'; mensaje?: string }
    | { estado: 'autenticado'; usuario: { uid: string; email: string; nombre: string | null; foto: string | null } };
  function ProveedorSesion(props: { children: ReactNode }): JSX.Element;
  function useSesion(): EstadoSesion & { entrar(): Promise<void>; salir(): Promise<void> };
  // erroresEntrada.ts
  function interpretarErrorEntrada(error: unknown): string | null;
  // navegacion.ts
  interface ItemNavegacion { etiqueta: string; ruta: string; icono: LucideIcon; fase: number }
  const FASE_ACTUAL = 1;
  const NAV_LATERAL: ItemNavegacion[];
  const NAV_SUPERIOR: { etiqueta: string; ruta: string }[];
  function estaDisponible(item: ItemNavegacion, fase?: number): boolean;
  // GuardiaSesion.tsx
  function GuardiaSesion(props: { sesion: EstadoSesion; children: ReactNode }): JSX.Element;
  // ProximaFase.tsx
  function ProximaFase(props: { titulo: string; fase: number; descripcion: string }): JSX.Element;
  ```

- [ ] **Paso 1: Escribir las pruebas que fallan**

```ts
// navegacion.test.ts
it('define la barra lateral en orden', () => {
  expect(NAV_LATERAL.map((i) => [i.etiqueta, i.ruta, i.fase])).toEqual([
    ['Calendario', '/calendario', 2], ['Crear', '/crear', 2], ['Pendientes', '/pendientes', 2],
    ['Biblioteca', '/biblioteca', 1], ['Estadísticas', '/estadisticas', 5], ['Tendencias', '/tendencias', 6],
    ['Plan', '/plan', 6], ['Ajustes', '/ajustes/general', 1],
  ]);
});
it('define la barra superior', () => {
  expect(NAV_SUPERIOR).toEqual([
    { etiqueta: 'CREAR', ruta: '/crear' }, { etiqueta: 'PLANIFICAR', ruta: '/plan' },
    { etiqueta: 'PUBLICAR', ruta: '/calendario' }, { etiqueta: 'ANALIZAR', ruta: '/estadisticas' },
    { etiqueta: 'CRECER', ruta: '/tendencias' },
  ]);
});
it('marca disponibles solo las secciones de la fase actual o anteriores', () => {
  expect(NAV_LATERAL.filter((i) => estaDisponible(i)).map((i) => i.ruta)).toEqual(['/biblioteca', '/ajustes/general']);
});

// erroresEntrada.test.ts
it('traduce el rechazo de la función de bloqueo', () => {
  expect(interpretarErrorEntrada({ code: 'auth/internal-error', message: 'BLOCKING_FUNCTION_ERROR_RESPONSE : {"error":{"status":"PERMISSION_DENIED"}}' }))
    .toBe('Esta cuenta no tiene acceso a OmniStream.');
});
it('ignora el cierre de la ventana emergente', () => {
  expect(interpretarErrorEntrada({ code: 'auth/popup-closed-by-user' })).toBeNull();
});
it('usa un mensaje genérico en otros casos', () => {
  expect(interpretarErrorEntrada(new Error('red'))).toBe('No se pudo iniciar sesión. Inténtalo de nuevo.');
});

// GuardiaSesion.test.tsx (con next/navigation simulado)
it('redirige a /entrar si no hay sesión', () => {
  render(<GuardiaSesion sesion={{ estado: 'anonimo' }}><p>app</p></GuardiaSesion>);
  expect(replace).toHaveBeenCalledWith('/entrar');
  expect(screen.queryByText('app')).toBeNull();
});
it('muestra el contenido con sesión', () => {
  render(<GuardiaSesion sesion={{ estado: 'autenticado', usuario }}><p>app</p></GuardiaSesion>);
  expect(screen.getByText('app')).toBeInTheDocument();
});
it('muestra un indicador mientras carga', () => {
  render(<GuardiaSesion sesion={{ estado: 'cargando' }}><p>app</p></GuardiaSesion>);
  expect(screen.getByText('Cargando…')).toBeInTheDocument();
});
```

- [ ] **Paso 2: Ejecutar y confirmar que fallan**

Ejecutar: `pnpm vitest run apps/web/src/components/shell apps/web/src/lib/firebase`
Esperado: FAIL.

- [ ] **Paso 3: Implementar Firebase cliente y sesión**

- `config.ts`: `JSON.parse(process.env.NEXT_PUBLIC_FIREBASE_WEBAPP_CONFIG)`; `usarEmuladores = process.env.NEXT_PUBLIC_USAR_EMULADORES === 'true'`.
- `cliente.ts`: instancia única. Con emuladores conecta Auth (`http://127.0.0.1:9099`), Firestore (`127.0.0.1:8080`) y Storage (`127.0.0.1:9199`). Siempre fija `storage.maxUploadRetryTime = 60 * 60 * 1000`.
- `.env.development`: `NEXT_PUBLIC_USAR_EMULADORES=true` y `NEXT_PUBLIC_FIREBASE_WEBAPP_CONFIG={"apiKey":"demo-key","authDomain":"demo-omnistream.firebaseapp.com","projectId":"demo-omnistream","storageBucket":"demo-omnistream.appspot.com","appId":"demo-app"}`.
- `sesion.tsx`: `onIdTokenChanged`. Con usuario, lee `getIdTokenResult()`; si `claims.owner !== true`, cierra sesión y queda `anonimo` con `mensaje: 'Esta cuenta no tiene acceso a OmniStream.'`. `entrar()` usa `signInWithPopup(auth, new GoogleAuthProvider())` y guarda `interpretarErrorEntrada(error)` como mensaje.
- `interpretarErrorEntrada`: rechazo si el mensaje contiene `BLOCKING_FUNCTION_ERROR_RESPONSE`, `PERMISSION_DENIED` o `permission-denied`.

- [ ] **Paso 4: Implementar las pantallas y la estructura**

- `/entrar`: panel `.neu-elevado` centrado con `<Logo />`, título "Bienvenido a OmniStream", botón `.boton-oro` "Entrar con Google" y el mensaje de error de la sesión en `--peligro` con `role="alert"`. Si ya hay sesión, redirige a `/biblioteca`.
- `ProveedorSesion` se monta en `src/app/layout.tsx`, para que `/entrar` también tenga sesión. `(app)/layout.tsx`: `GuardiaSesion` (con `useSesion()`) → `Shell`.
- `Shell`: `BarraSuperior` (logo, `NAV_SUPERIOR` en `.etiqueta-ornamental`, menú de usuario con foto, nombre y "Cerrar sesión") y `BarraLateral` (`NAV_LATERAL` con íconos lucide en `--oro`; el elemento activo como píldora `.neu-elevado` con borde izquierdo dorado; los elementos no disponibles muestran la insignia "Fase N" y no se deshabilitan; abajo `<Meandro />` y el lema "CREAR · AUTOMATIZAR · AMPLIFICAR").
- Por debajo de 1024 px, la barra lateral se vuelve un panel desplegable desde un botón "Menú".
- `/` redirige a `/biblioteca` (en la fase 2 cambia a `/calendario`).
- Páginas provisionales: `<ProximaFase titulo="Calendario" fase={2} descripcion="Programa y reorganiza tus publicaciones." />`. Equivalentes para Crear (2), Pendientes (2), Estadísticas (5), Tendencias (6) y Plan (6). El texto muestra "Disponible en la fase {n}".

- [ ] **Paso 5: Ejecutar**

Ejecutar: `pnpm test && pnpm --filter @omnistream/web build`
Esperado: PASS y compilación sin errores.

- [ ] **Paso 6: Commit**

```bash
git add -A && git commit -m "feat(web): sesión con Google, entrada y estructura de navegación"
```

---

### Tarea 10: Web: Ajustes generales

**Archivos:**
- Crear: `apps/web/src/lib/ajustes/repositorio.ts`, `apps/web/src/components/ajustes/FormularioAjustes.tsx`, `apps/web/src/app/(app)/ajustes/general/page.tsx`
- Prueba: `apps/web/src/components/ajustes/FormularioAjustes.test.tsx`

**Interfaces:**
- Consume: `ajustesAppSchema`, `AjustesApp`, `leerAjustes`, `esZonaHorariaValida` (Tarea 3); `obtenerFirebase` (Tarea 9).
- Produce:
  ```ts
  function escucharAjustes(cb: (ajustes: AjustesApp, existe: boolean) => void): Unsubscribe; // settings/app
  function guardarAjustes(ajustes: AjustesApp): Promise<void>;                            // setDoc con merge
  function FormularioAjustes(props: { valores: AjustesApp; zonas: string[]; alGuardar(v: AjustesApp): Promise<void> }): JSX.Element;
  ```

- [ ] **Paso 1: Escribir la prueba que falla**

```ts
const valores = { timezone: 'America/Bogota', retentionDays: 7, maxUploadGb: 10 };
it('muestra los valores actuales', () => {
  render(<FormularioAjustes valores={valores} zonas={['America/Bogota', 'UTC']} alGuardar={vi.fn()} />);
  expect(screen.getByLabelText('Días de retención')).toHaveValue(7);
  expect(screen.getByLabelText('Tamaño máximo de subida (GB)')).toHaveValue(10);
  expect(screen.getByRole('combobox', { name: 'Zona horaria' })).toHaveTextContent('America/Bogota');
});
it('no guarda con una retención inválida y muestra el error', async () => {
  const alGuardar = vi.fn();
  render(<FormularioAjustes valores={valores} zonas={['America/Bogota']} alGuardar={alGuardar} />);
  await user.clear(screen.getByLabelText('Días de retención'));
  await user.type(screen.getByLabelText('Días de retención'), '0');
  await user.click(screen.getByRole('button', { name: 'Guardar' }));
  expect(await screen.findByText('Debe ser entre 1 y 90 días')).toBeInTheDocument();
  expect(alGuardar).not.toHaveBeenCalled();
});
it('guarda valores válidos', async () => {
  const alGuardar = vi.fn().mockResolvedValue(undefined);
  render(<FormularioAjustes valores={valores} zonas={['America/Bogota']} alGuardar={alGuardar} />);
  await user.clear(screen.getByLabelText('Días de retención'));
  await user.type(screen.getByLabelText('Días de retención'), '14');
  await user.click(screen.getByRole('button', { name: 'Guardar' }));
  expect(alGuardar).toHaveBeenCalledWith({ timezone: 'America/Bogota', retentionDays: 14, maxUploadGb: 10 });
});
```

- [ ] **Paso 2: Ejecutar y confirmar que falla**

Ejecutar: `pnpm vitest run apps/web/src/components/ajustes`
Esperado: FAIL.

- [ ] **Paso 3: Implementar repositorio, formulario y página**

- Formulario con `react-hook-form` y `zodResolver(ajustesAppSchema)`. Zona horaria con combobox de búsqueda (Popover + Command de shadcn). Campos numéricos con `valueAsNumber`. Textos de ayuda:
  - Retención: "Días que se conservan los archivos originales después de publicarse en todas las redes."
  - Tamaño: "Límite por archivo."
- Página "Ajustes generales" dentro de un panel `.neu-elevado`, con `zonas = Intl.supportedValuesOf('timeZone')`. Si el documento no existe, la zona inicial es la del navegador (si es válida) o `UTC`. Al guardar muestra el toast "Ajustes guardados" o, si falla, "No se pudieron guardar los ajustes.".

- [ ] **Paso 4: Ejecutar**

Ejecutar: `pnpm test`
Esperado: PASS.

- [ ] **Paso 5: Commit**

```bash
git add -A && git commit -m "feat(web): ajustes generales"
```

---

### Tarea 11: Web: gestor de subidas

**Archivos:**
- Crear: `apps/web/src/lib/archivos/{gestorSubidas.ts,metadatosLocales.ts,dependenciasFirebase.ts,useSubidas.ts,repositorio.ts}`
- Prueba: `apps/web/src/lib/archivos/gestorSubidas.test.ts`

**Interfaces:**
- Consume: `validarArchivo`, `rutaOriginal`, `Asset`, `EstadoAsset` (Tarea 2); `obtenerFirebase` (Tarea 9).
- Produce:
  ```ts
  type EstadoSubida = 'subiendo' | 'pausada' | 'error' | 'completada' | 'cancelada';
  interface ProgresoSubida { assetId: string; nombre: string; bytesTransferidos: number; bytesTotales: number; estado: EstadoSubida; error?: string }
  interface TareaSubida { alProgresar(cb: (transferidos: number, total: number) => void): void; pausar(): boolean; reanudar(): boolean; cancelar(): boolean; terminado: Promise<void> }
  interface MetadatosLocales { width?: number; height?: number; durationSec?: number }
  interface DependenciasSubida {
    generarId(): string;
    crearDocumento(datos: Omit<Asset, 'createdAt'>): Promise<void>; // createdAt lo agrega con serverTimestamp()
    subir(ruta: string, archivo: File, mime: string): TareaSubida;
    eliminarDocumento(id: string): Promise<void>;
    leerMetadatosLocales(archivo: File, tipo: 'video' | 'image'): Promise<MetadatosLocales>;
  }
  interface GestorSubidas {
    iniciar(archivo: File, maxUploadGb: number): Promise<{ ok: true; assetId: string } | { ok: false; mensaje: string }>;
    pausar(id: string): void; reanudar(id: string): void; cancelar(id: string): Promise<void>;
    suscribir(cb: () => void): () => void;
    obtenerEstado(): ReadonlyMap<string, ProgresoSubida>;
    activas(): ReadonlySet<string>; // ids con estado 'subiendo' o 'pausada'
  }
  function crearGestorSubidas(deps: DependenciasSubida): GestorSubidas;
  function useSubidas(): { gestor: GestorSubidas; estado: ReadonlyMap<string, ProgresoSubida>; activas: ReadonlySet<string> };
  // repositorio.ts
  function useArchivos(): { archivos: Asset[]; cargando: boolean };  // assets ordenados por createdAt desc
  function eliminarArchivo(asset: Asset): Promise<void>;              // original, fotogramas y documento (en ese orden; ignora objetos inexistentes)
  function useUrlsFotogramas(asset: Asset): Partial<Record<Fotograma, string>>; // getDownloadURL
  ```

- [ ] **Paso 1: Escribir las pruebas con dependencias falsas**

La tarea falsa expone `emitirProgreso(t, total)`, `completar()` y `fallar(error)`.

```ts
it('rechaza un formato no soportado sin crear documento', async () => {
  const r = await gestor.iniciar(archivo('doc.pdf', 'application/pdf', 10), 10);
  expect(r).toEqual({ ok: false, mensaje: 'Formato no soportado. Usa mp4, mov, webm, jpg, png, webp o heic.' });
  expect(deps.crearDocumento).not.toHaveBeenCalled();
});
it('crea el documento en estado subiendo y luego sube', async () => {
  deps.leerMetadatosLocales.mockResolvedValue({ width: 720, height: 1280, durationSec: 4 });
  await gestor.iniciar(archivo('clip.mp4', 'video/mp4', 1000), 10);
  expect(deps.crearDocumento).toHaveBeenCalledWith({
    id: 'a1', kind: 'video', source: 'subida', originalName: 'clip.mp4', storagePath: 'originales/a1',
    mimeType: 'video/mp4', sizeBytes: 1000, status: 'subiendo', width: 720, height: 1280, durationSec: 4,
  });
  expect(deps.subir).toHaveBeenCalledWith('originales/a1', expect.any(File), 'video/mp4');
});
it('reporta el progreso y mantiene la subida activa', async () => {
  await gestor.iniciar(archivo('clip.mp4', 'video/mp4', 100), 10);
  tarea.emitirProgreso(50, 100);
  expect(gestor.obtenerEstado().get('a1')).toMatchObject({ bytesTransferidos: 50, bytesTotales: 100, estado: 'subiendo' });
  expect(gestor.activas().has('a1')).toBe(true);
});
it('al completar deja de estar activa', async () => {
  await gestor.iniciar(archivo('clip.mp4', 'video/mp4', 100), 10);
  await tarea.completar();
  expect(gestor.obtenerEstado().get('a1')?.estado).toBe('completada');
  expect(gestor.activas().size).toBe(0);
});
it('pausa y reanuda', async () => {
  await gestor.iniciar(archivo('clip.mp4', 'video/mp4', 100), 10);
  gestor.pausar('a1');
  expect(gestor.obtenerEstado().get('a1')?.estado).toBe('pausada');
  gestor.reanudar('a1');
  expect(gestor.obtenerEstado().get('a1')?.estado).toBe('subiendo');
});
it('cancelar elimina el documento', async () => {
  await gestor.iniciar(archivo('clip.mp4', 'video/mp4', 100), 10);
  await gestor.cancelar('a1');
  expect(deps.eliminarDocumento).toHaveBeenCalledWith('a1');
  expect(gestor.obtenerEstado().get('a1')?.estado).toBe('cancelada');
});
it('un error deja un mensaje en español', async () => {
  await gestor.iniciar(archivo('clip.mp4', 'video/mp4', 100), 10);
  await tarea.fallar(new Error('storage/retry-limit-exceeded'));
  expect(gestor.obtenerEstado().get('a1')).toMatchObject({ estado: 'error', error: 'La subida falló. Revisa tu conexión e inténtalo de nuevo.' });
});
it('si fallan los metadatos locales, la subida continúa', async () => {
  deps.leerMetadatosLocales.mockRejectedValue(new Error('no soportado'));
  const r = await gestor.iniciar(archivo('clip.mov', '', 100), 10);
  expect(r).toEqual({ ok: true, assetId: 'a1' });
  expect(deps.crearDocumento).toHaveBeenCalledWith(expect.not.objectContaining({ width: expect.anything() }));
});
it('notifica a los suscriptores en cada cambio', async () => {
  const cb = vi.fn(); gestor.suscribir(cb);
  await gestor.iniciar(archivo('clip.mp4', 'video/mp4', 100), 10);
  tarea.emitirProgreso(10, 100);
  expect(cb).toHaveBeenCalled();
});
```

- [ ] **Paso 2: Ejecutar y confirmar que fallan**

Ejecutar: `pnpm vitest run apps/web/src/lib/archivos`
Esperado: FAIL.

- [ ] **Paso 3: Implementar el gestor y las dependencias reales**

- `gestorSubidas.ts`: estado en un `Map` inmutable que se reemplaza en cada cambio, para que `useSyncExternalStore` detecte el cambio. La cancelación no se reporta como error.
- `dependenciasFirebase.ts`: `generarId = doc(collection(db, 'assets')).id`; `crearDocumento` con `setDoc` más `createdAt: serverTimestamp()`; `subir` envuelve `uploadBytesResumable(ref(storage, ruta), archivo, { contentType: mime })`; `eliminarDocumento` con `deleteDoc`.
- `metadatosLocales.ts`: video con `HTMLVideoElement` (`preload = 'metadata'`, tiempo máximo 10 s); imagen con `createImageBitmap`. Siempre libera el `ObjectURL`.
- `useSubidas.ts`: gestor único por módulo y `useSyncExternalStore`.
- `repositorio.ts`: conversor de Firestore que mapea `Timestamp → Date`.

- [ ] **Paso 4: Ejecutar**

Ejecutar: `pnpm test`
Esperado: PASS.

- [ ] **Paso 5: Commit**

```bash
git add -A && git commit -m "feat(web): gestor de subidas reanudables"
```

---

### Tarea 12: Web: Biblioteca

**Archivos:**
- Crear: `apps/web/src/app/(app)/biblioteca/page.tsx`, `apps/web/src/components/biblioteca/{ZonaSubida,TarjetaArchivo,DetalleArchivo,ConfirmarEliminacion}.tsx`
- Prueba: `TarjetaArchivo.test.tsx`, `DetalleArchivo.test.tsx`

**Interfaces:**
- Consume: Tareas 2 y 11.
- Produce:
  ```ts
  function TarjetaArchivo(props: { asset: Asset; estado: EstadoVisible; progreso?: ProgresoSubida; miniatura?: string;
    alAbrir(): void; alPausar?(): void; alReanudar?(): void; alCancelar?(): void; alEliminar(): void }): JSX.Element;
  function DetalleArchivo(props: { asset: Asset; urls: Partial<Record<Fotograma, string>>; abierto: boolean; alCerrar(): void }): JSX.Element;
  function ZonaSubida(props: { maxUploadGb: number }): JSX.Element;
  ```

- [ ] **Paso 1: Escribir las pruebas que fallan**

```ts
// TarjetaArchivo.test.tsx
it('muestra el porcentaje mientras sube', () => {
  render(<TarjetaArchivo asset={subiendo} estado="subiendo" progreso={{ ...p, bytesTransferidos: 450, bytesTotales: 1000 }} {...acciones} />);
  expect(screen.getByText('Subiendo 45%')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Pausar' })).toBeInTheDocument();
});
it('ofrece eliminar una subida interrumpida', () => {
  render(<TarjetaArchivo asset={subiendo} estado="interrumpido" {...acciones} />);
  expect(screen.getByText('Subida interrumpida')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Eliminar' })).toBeInTheDocument();
});
it('muestra duración y resolución cuando está listo', () => {
  render(<TarjetaArchivo asset={videoListo} estado="listo" {...acciones} />);
  expect(screen.getByText('0:04')).toBeInTheDocument();
  expect(screen.getByText('720 × 1280')).toBeInTheDocument();
});

// DetalleArchivo.test.tsx
it('muestra los 3 fotogramas y los datos técnicos de un video', () => {
  render(<DetalleArchivo asset={videoListo} urls={{ start: 'a', middle: 'b', end: 'c' }} abierto alCerrar={vi.fn()} />);
  for (const alt of ['Fotograma de inicio', 'Fotograma de la mitad', 'Fotograma del final']) expect(screen.getByAltText(alt)).toBeInTheDocument();
  expect(fila('Proporción')).toHaveTextContent('9:16');
  expect(fila('Duración')).toHaveTextContent('0:04');
  expect(fila('Audio')).toHaveTextContent('Sí');
});
it('muestra una sola vista para imágenes', () => {
  render(<DetalleArchivo asset={imagenLista} urls={{ start: 'a' }} abierto alCerrar={vi.fn()} />);
  expect(screen.getAllByRole('img')).toHaveLength(1);
  expect(screen.getByAltText('Vista de la imagen')).toBeInTheDocument();
});
it('muestra el error de un archivo fallido', () => {
  render(<DetalleArchivo asset={{ ...videoListo, status: 'fallido', error: 'No se pudo leer el archivo. Puede estar dañado o en un formato no soportado.' }} urls={{}} abierto alCerrar={vi.fn()} />);
  expect(screen.getByRole('alert')).toHaveTextContent('No se pudo leer el archivo');
});
```

`videoListo`: 720×1280, `aspect` 0.5625, 4 s, con audio, `status: 'listo'`. `fila(nombre)` devuelve el `<dd>` asociado al `<dt>` con ese texto.

- [ ] **Paso 2: Ejecutar y confirmar que fallan**

Ejecutar: `pnpm vitest run apps/web/src/components/biblioteca`
Esperado: FAIL.

- [ ] **Paso 3: Implementar los componentes y la página**

- **`ZonaSubida`:** usa `react-dropzone` con `multiple` y acepta `.mp4,.mov,.webm,.jpg,.jpeg,.png,.webp,.heic`. Panel `.neu-hundido` con el texto "Arrastra tus videos e imágenes aquí" y el botón "Elegir archivos". Cada archivo pasa por `gestor.iniciar(archivo, maxUploadGb)`; los rechazos se muestran como toast con el mensaje del gestor.
- **`TarjetaArchivo`:** `<article aria-label={asset.originalName}>` con estilo `.neu-elevado`, miniatura 16:9 (`object-cover`, o un ícono si aún no hay fotograma), nombre truncado con `title`, tipo, tamaño (`formatearBytes`), duración y resolución, e insignia de estado (`ETIQUETAS_ESTADO`, con "Subiendo N%" durante la subida).
  - Acciones según el estado: Pausar, Reanudar o Cancelar mientras sube; Eliminar en interrumpido, listo y fallido.
  - Clic en la tarjeta: abre el detalle.
- **`DetalleArchivo`:**
  - Diálogo con los fotogramas etiquetados "Inicio", "Mitad" y "Final" (o una sola vista en imágenes).
  - Lista `<dl>` con Tipo, Formato, Tamaño, Resolución, Proporción (`describirProporcion`), Duración, FPS, Audio (Sí/No), Códec y Fecha (formateada en `es-419` con la zona horaria de los ajustes).
  - Si el archivo está fallido, el error en un `role="alert"`.
- **`ConfirmarEliminacion`:** diálogo "¿Eliminar este archivo? Esta acción no se puede deshacer." con los botones "Cancelar" y "Eliminar", que llama a `eliminarArchivo`.
- **Página `/biblioteca`:**
  - Título "Biblioteca" y subtítulo "Tus videos e imágenes, listos para publicar".
  - Debajo, `ZonaSubida` y una cuadrícula adaptable de tarjetas que combina `useArchivos()` con el estado de `useSubidas()` mediante `estadoVisible(asset, activas)`.
  - Estado vacío: "Aún no hay archivos. Sube el primero para empezar.".

- [ ] **Paso 4: Ejecutar**

Ejecutar: `pnpm test && pnpm --filter @omnistream/web build`
Esperado: PASS.

- [ ] **Paso 5: Commit**

```bash
git add -A && git commit -m "feat(web): biblioteca con subida, detalle y eliminación"
```

---

### Tarea 13: Pruebas de extremo a extremo

**Archivos:**
- Crear: `apps/web/playwright.config.ts`, `apps/web/e2e/ayudantes.ts`, `apps/web/e2e/fase1.spec.ts`
- Modificar: `package.json` raíz (script `test:e2e`)

**Interfaces:**
- Consume: toda la aplicación; `prepararFixtures` (Tarea 7) para el video de prueba. `@omnistream/pruebas-integracion` expone `./fixtures` en `exports` y la web lo agrega como dependencia de desarrollo.
- Produce: `entrarComo(page: Page, email: string): Promise<void>` en `ayudantes.ts`, que completa la ventana emergente del emulador de Auth ("Add new account", correo y confirmación).

- [ ] **Paso 1: Configurar Playwright**

`webServer: { command: 'pnpm dev', port: 3000, reuseExistingServer: !process.env.CI }`, solo Chromium, `timeout: 120_000`. Script raíz: `"test:e2e": "pnpm --filter @omnistream/functions build && firebase emulators:exec --only auth,firestore,storage,functions --project demo-omnistream \"pnpm --filter @omnistream/web exec playwright test\""`.

- [ ] **Paso 2: Escribir las pruebas**

```ts
test('rechaza un correo no permitido', async ({ page }) => {
  await page.goto('/entrar');
  await entrarComo(page, 'intruso@ejemplo.com');
  await expect(page.getByRole('alert')).toHaveText('Esta cuenta no tiene acceso a OmniStream.');
  await expect(page).toHaveURL(/\/entrar$/);
});

test('sube un video y muestra sus datos y 3 fotogramas', async ({ page }) => {
  await page.goto('/entrar');
  await entrarComo(page, 'propietario@omnistream.test');
  await expect(page).toHaveURL(/\/biblioteca$/);
  await page.locator('input[type=file]').setInputFiles(fixtures.video);
  const tarjeta = page.getByRole('article', { name: /video-vertical\.mp4/ });
  await expect(tarjeta.getByText('Listo')).toBeVisible({ timeout: 90_000 });
  await tarjeta.click();
  for (const alt of ['Fotograma de inicio', 'Fotograma de la mitad', 'Fotograma del final']) await expect(page.getByAltText(alt)).toBeVisible();
  await expect(page.getByText('720 × 1280')).toBeVisible();
  await expect(page.getByText('9:16')).toBeVisible();
});

test('guarda los ajustes generales', async ({ page }) => {
  await page.goto('/entrar');
  await entrarComo(page, 'propietario@omnistream.test');
  await page.goto('/ajustes/general');
  await page.getByLabel('Días de retención').fill('14');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Ajustes guardados')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Días de retención')).toHaveValue('14');
});
```


- [ ] **Paso 3: Ejecutar**

Ejecutar: `pnpm test:e2e`
Esperado: 3 pruebas en verde. El emulador de Auth marca como verificado el correo de las cuentas de Google simuladas. Si una prueba falla por `correo_no_verificado`, se corrige la creación de la cuenta de prueba, no la regla de acceso.

- [ ] **Paso 4: Commit**

```bash
git add -A && git commit -m "test(e2e): acceso, subida con fotogramas y ajustes"
```

---

### Tarea 14: CI, despliegue y guía de configuración

**Archivos:**
- Crear: `.github/workflows/ci.yml`, `.github/workflows/desplegar.yml`, `apps/web/apphosting.yaml`, `docs/configuracion.md`, `README.md`

**Interfaces:**
- Produce: variables del repositorio que usa el despliegue: `vars.FIREBASE_PROJECT_ID`, `vars.ALLOWED_EMAIL` y `secrets.FIREBASE_SERVICE_ACCOUNT`.

- [ ] **Paso 1: CI**

`ci.yml`, en cada push y pull request:
- Trabajo `verificar`: checkout, pnpm (`pnpm/action-setup`), Node 22 con caché de pnpm, `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm test` y `pnpm --filter @omnistream/web build`.
- Trabajo `integracion` (necesita `verificar`): agrega Java 21 (`actions/setup-java`, temurin), caché de `~/.cache/firebase/emulators`, `pnpm exec playwright install --with-deps chromium`, `pnpm test:integracion` y `pnpm test:e2e`.

- [ ] **Paso 2: Despliegue**

`desplegar.yml` se ejecuta en push a `main` y con `workflow_dispatch`, con `if: vars.FIREBASE_PROJECT_ID != ''`.
1. `google-github-actions/auth@v2` con `credentials_json: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}`.
2. Escribir `functions/.env.${{ vars.FIREBASE_PROJECT_ID }}` con `ALLOWED_EMAIL=${{ vars.ALLOWED_EMAIL }}`.
3. Ejecutar `pnpm exec firebase deploy --only functions,firestore,storage --project ${{ vars.FIREBASE_PROJECT_ID }} --non-interactive --force`.

`apphosting.yaml`: `runConfig: { minInstances: 0, maxInstances: 2 }`. App Hosting inyecta `FIREBASE_WEBAPP_CONFIG`, que `next.config.ts` expone al cliente.

- [ ] **Paso 3: Guía de configuración (`docs/configuracion.md`)**

Pasos de la fase 1, en orden:
1. Crear el proyecto de Firebase y activar el plan Blaze con una alerta de presupuesto.
2. Crear Firestore (modo nativo) y el bucket de Storage en `us-central1`.
3. Activar Authentication con Identity Platform y habilitar el proveedor Google.
4. Dar el rol "Creador de tokens de cuenta de servicio" a la cuenta de servicio de las funciones, para firmar URLs.
5. Crear el backend de App Hosting conectado al repositorio con directorio raíz `apps/web` y conectar el dominio propio.
6. Crear una cuenta de servicio para GitHub Actions y guardar `FIREBASE_SERVICE_ACCOUNT`, `FIREBASE_PROJECT_ID` y `ALLOWED_EMAIL` en el repositorio.
7. Primer despliegue y verificación: entrar con el correo permitido, subir un video y ver sus fotogramas.

Incluir también la ejecución local:
- Requisitos: Node 22, pnpm y Java 21.
- Arranque: `pnpm install`, luego `pnpm --filter @omnistream/functions build` y `pnpm exec firebase emulators:start` en una terminal, y `pnpm --filter @omnistream/web dev` en otra.
- Para entrar en local se usa el correo `propietario@omnistream.test` en la ventana del emulador.

`README.md`: qué es OmniStream, enlace a la spec, al plan y a la guía, y los comandos `test`, `test:integracion` y `test:e2e`.

- [ ] **Paso 4: Verificar**

Ejecutar: `pnpm dlx @action-validator/cli .github/workflows/ci.yml && pnpm dlx @action-validator/cli .github/workflows/desplegar.yml && pnpm lint && pnpm typecheck && pnpm test && pnpm test:integracion && pnpm test:e2e`
Esperado: los flujos de trabajo son válidos y todas las verificaciones quedan en verde.

- [ ] **Paso 5: Commit**

```bash
git add -A && git commit -m "chore: CI, despliegue y guía de configuración de la fase 1"
```

---

## Cobertura de los criterios de aceptación de la fase 1

| Criterio (spec 14) | Dónde se prueba |
|---|---|
| Solo el correo permitido entra | Tareas 1, 5 (integración) y 13 (E2E) |
| Un video de 2 GB se sube y se reanuda tras cortar la conexión | Reintentos de la subida reanudable configurados a 60 min (Tarea 9) y gestor (Tarea 11). Verificación manual con un archivo real de 2 GB en el proyecto desplegado: cortar la red 1 minuto a mitad de la subida y confirmar que continúa. |
| Muestra sus datos técnicos y 3 fotogramas | Tareas 7 (integración) y 13 (E2E) |
| Las reglas impiden leer `secrets` desde el cliente | Tarea 4 |
