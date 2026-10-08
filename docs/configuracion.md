# Guía de configuración de OmniStream

Esta guía explica cómo ejecutar OmniStream en tu equipo y cómo preparar el proyecto de Firebase para producción. Cada fase agrega sus propios pasos; aquí están los de las fases 1, 2A y 2B y la lista de lo que vendrá.

## 1. Ejecutar en local

### Requisitos

- Node.js 22 o superior.
- pnpm 10 (`corepack enable` lo activa a partir de `packageManager` en `package.json`).
- Java 21 (lo necesitan los emuladores de Firestore y Storage).

### Arranque

```bash
pnpm install
pnpm --filter @omnistream/functions build
node scripts/firebase.cjs emulators:start --only auth,firestore,storage,functions
```

En otra terminal:

```bash
pnpm --filter @omnistream/web dev
```

Abre `http://localhost:3000`. En la ventana de inicio de sesión del emulador, elige "Add new account" y usa el correo `propietario@omnistream.test`; cualquier otro correo será rechazado. Ese correo de prueba está definido en `functions/.env.demo-omnistream`.

El emulador de Cloud Tasks (puerto 9499) arranca junto con el de funciones. En local las tareas se entregan de inmediato, sin respetar su hora: la de una publicación programada a futuro termina como "anticipada" sin hacer nada, y las tareas programadas (`encolarPendientes`, `limpiarRetencion`) no corren solas. Para probar el flujo completo en local, usa "Publicar ahora"; en producción Cloud Tasks entrega cada tarea a su hora. Firebase Cloud Messaging no tiene emulador, así que en local Ajustes > Notificaciones no puede activar los avisos push; los avisos sí se registran en la colección `notifications`.

Las funciones de la fase 2B leen secretos (la llave de cifrado y los de cada red). En local, `pnpm test:integracion` y `pnpm test:e2e` ejecutan antes `node scripts/secretos-demo.cjs`, que crea `functions/.secret.local` con valores de demostración si no existe; si arrancas los emuladores a mano, ejecútalo una vez antes. Los conectores no llaman a las redes en local: conectar una red real requiere el proyecto de producción.

`scripts/firebase.cjs` lanza firebase-tools respetando `NO_PROXY`. Solo importa si tu red usa un proxy: sin él, firebase-tools enviaría el tráfico entre emuladores por el proxy y fallaría. Sin proxy, funciona igual que el comando `firebase`.

### Pruebas

| Comando | Qué verifica |
|---|---|
| `pnpm test` | Pruebas unitarias de `core`, `platforms` (contratos de las APIs de las redes), `functions` y `web` |
| `pnpm test:integracion` | Reglas de seguridad, bloqueo de acceso, procesamiento de archivos y publicación contra los emuladores |
| `pnpm test:e2e` | Flujos completos en el navegador contra los emuladores |
| `pnpm lint` y `pnpm typecheck` | Estilo y tipos |

Si la versión de Playwright no coincide con el Chromium instalado en tu equipo, indica el ejecutable con `PLAYWRIGHT_CHROMIUM_PATH=/ruta/a/chromium pnpm test:e2e`.

## 2. Producción: fase 1

Sigue los pasos en orden. Los nombres de los menús son los de la consola de Firebase y de Google Cloud.

1. **Proyecto y facturación.** Crea un proyecto en la consola de Firebase y cámbialo al plan Blaze. En Google Cloud > Facturación > Presupuestos y alertas, crea un presupuesto mensual con alertas (por ejemplo, 5 USD).
2. **Firestore y Storage.** Crea la base de datos de Firestore en modo nativo y el bucket de Storage, ambos en `us-central1` (las cuotas gratuitas aplican en regiones de Estados Unidos).
3. **Authentication.** En Authentication > Configuración, actualiza a "Firebase Authentication with Identity Platform" (lo requieren las funciones de bloqueo). Habilita el proveedor Google.
4. **Permiso para firmar URLs.** En Google Cloud > IAM, da el rol "Creador de tokens de cuenta de servicio" a la cuenta de servicio de las funciones (`NUMERO_DE_PROYECTO-compute@developer.gserviceaccount.com`). Las funciones lo usan para leer los videos con enlaces firmados.
5. **Vercel.** En Vercel, elige "Add New… > Project" e importa este repositorio de GitHub:
   - Root Directory: `apps/web` (Vercel detecta Next.js y el monorepo de pnpm).
   - Variable de entorno `NEXT_PUBLIC_FIREBASE_WEBAPP_CONFIG`: el objeto de configuración de tu app web de Firebase en una sola línea, por ejemplo `{"apiKey":"…","authDomain":"…","projectId":"…","storageBucket":"…","appId":"…"}`. Lo encuentras en Firebase > Configuración del proyecto > Tus apps > App web.
   - En Firebase > Authentication > Configuración > Dominios autorizados, agrega el dominio de Vercel (`tu-proyecto.vercel.app`) y tu dominio propio si lo conectas.
   - Vercel publica `main` y crea una vista previa por cada pull request. Sin la variable de Firebase, la app muestra un aviso en lugar de permitir la entrada.
6. **GitHub Actions.** Crea en Google Cloud una cuenta de servicio para despliegues con los roles "Administrador de Firebase" y "Usuario de cuenta de servicio", y genera una clave JSON. En el repositorio de GitHub (Settings > Secrets and variables > Actions):
   - Secreto `FIREBASE_SERVICE_ACCOUNT`: el contenido de la clave JSON.
   - Variable `FIREBASE_PROJECT_ID`: el id del proyecto.
   - Variable `ALLOWED_EMAIL`: tu correo de Google.

   Si un despliegue falla por permisos, el mensaje de error indica el rol que falta.
7. **Primer despliegue.** Al actualizar `main`, Vercel publica la web y el flujo "Desplegar" publica funciones y reglas. Las reglas de Storage consultan Firestore; si la consola de Firebase pide autorizar que Storage lea Firestore, acéptalo. Verifica en Authentication > Configuración > Funciones de bloqueo que aparezcan `antesDeCrearUsuario` y `antesDeIniciarSesion`.
8. **Verificación.**
   - Entra con tu correo y confirma que otro correo es rechazado.
   - Sube un video y confirma que muestra sus datos técnicos y 3 fotogramas.
   - Prueba de reanudación (criterio de la fase 1): sube un video de unos 2 GB, corta la red durante un minuto a mitad de la subida y confirma que continúa al volver la conexión.

## 3. Producción: fase 2A (publicación asistida)

Parte de un proyecto que ya cumple la fase 1. Sigue los pasos en orden.

1. **APIs.** En Google Cloud > APIs y servicios > Biblioteca, habilita Cloud Tasks API, Cloud Scheduler API y Firebase Cloud Messaging API.
2. **IAM.** En Google Cloud > IAM:
   - A la cuenta de servicio de las funciones (`NUMERO_DE_PROYECTO-compute@developer.gserviceaccount.com`), agrega los roles "Encolador de Cloud Tasks", "Usuario de cuenta de servicio" y "Administrador de la API de Firebase Cloud Messaging".
   - A la cuenta de servicio de despliegues (la del secreto `FIREBASE_SERVICE_ACCOUNT`), agrega "Administrador de Cloud Tasks" y "Administrador de Cloud Scheduler".
3. **Llave VAPID.** En Firebase > Configuración del proyecto > Cloud Messaging > Configuración web > Certificados de push web, elige "Generar par de claves". Copia la clave pública y agrégala en Vercel como variable de entorno `NEXT_PUBLIC_FIREBASE_VAPID_KEY`.
4. **Contacto.** En Vercel, agrega `NEXT_PUBLIC_CORREO_CONTACTO` con el correo que debe aparecer en `/privacidad`.
5. **Despliegue.** Al actualizar `main`, el flujo "Desplegar" publica funciones, reglas e índices, y crea la cola de `publicarDestino` y las tareas programadas de `encolarPendientes` y `limpiarRetencion`. En Firestore > Índices, espera a que los dos índices de `targets` (grupo de colecciones) estén "Habilitado" antes de usar `/pendientes`; mientras se construyen, la lista queda vacía. Vuelve a desplegar en Vercel para que tome las variables nuevas.
6. **Notificaciones.** En cada dispositivo, abre Ajustes > Notificaciones y elige "Activar en este dispositivo". En iPhone (iOS 16.4 o posterior): abre el sitio en Safari, Compartir > Agregar a inicio, abre OmniStream desde el ícono y actívalas ahí; Safari fuera de la pantalla de inicio no admite avisos push.
7. **Verificación (criterios de la fase 2A).**
   - Programa una publicación a las 4 redes para dentro de unos minutos; al llegar la hora, confirma que llega el aviso y que `/pendientes` muestra un paquete por red. Publica uno a mano, pega su URL y confirma que pasa a "Publicada".
   - Mueve una publicación programada en el calendario y confirma que, a la nueva hora, llega un solo aviso por red.
   - Publica una Hija antes que su Principal: al marcar publicado el YouTube del Principal, la referencia de la Hija pasa a pendiente y aparece en `/pendientes`.

## 4. Producción: fase 2B (conectores y promoción)

Parte de un proyecto que ya cumple la fase 2A. Sigue los pasos en orden; `{URL_PUBLICA}` es el dominio de la web (por ejemplo `https://tu-proyecto.vercel.app`).

0. **Costos (D17).** En Google Cloud > Facturación > Presupuestos y alertas, crea un presupuesto mensual de 1 USD con alertas al 50 %, 90 % y 100 %. Ejecuta `node scripts/firebase.cjs functions:artifacts:setpolicy --project TU_PROYECTO` para que se borren las imágenes antiguas de las funciones. En Ajustes, deja la retención en 0 días: el video se borra en cuanto se publica en todas sus redes y solo se conservan sus datos.
1. **URL pública.** El dominio de Vercel (o el propio) es `URL_PUBLICA`. En Vercel, agrega `FUNCIONES_URL=https://us-central1-TU_PROYECTO.cloudfunctions.net` y vuelve a desplegar: así `/api/conexiones/retorno`, `/api/meta/borrado-datos` y `/api/media/…` llegan a las funciones desde el dominio de la app.
2. **Parámetros.** En GitHub (Settings > Secrets and variables > Actions > Variables), crea `URL_PUBLICA`, `META_APP_ID`, `META_CONFIG_ID`, `GOOGLE_CLIENT_ID` y `TIKTOK_CLIENT_KEY`. El flujo "Desplegar" los escribe en `functions/.env.TU_PROYECTO`.
3. **Secretos.** Con `node scripts/firebase.cjs functions:secrets:set NOMBRE --project TU_PROYECTO`:
   - `CLAVE_CIFRADO`, generada con `openssl rand -base64 32`. Cifra los accesos a las redes guardados en Firestore; si la cambias, hay que volver a conectar cada red.
   - `META_APP_SECRET`, `GOOGLE_CLIENT_SECRET` y `TIKTOK_CLIENT_SECRET`.

   La cuenta de despliegue necesita el rol "Administrador de Secret Manager".
4. **Google (YouTube):**
   - Habilita YouTube Data API v3 y YouTube Analytics API.
   - En la pantalla de consentimiento (tipo Externo), agrega los permisos `youtube.upload`, `youtube.force-ssl`, `youtube.readonly` y `yt-analytics.readonly`, y publica la app ("En producción"; con "Prueba", el acceso caduca cada 7 días).
   - Crea un cliente OAuth de tipo Aplicación web con el URI de redirección `{URL_PUBLICA}/api/conexiones/retorno`.
   - Mientras el proyecto no pase la auditoría, YouTube deja privados los videos subidos por API: usa el modo manual o solicita la auditoría. Importar un video ya subido (en Crear publicación) solo lee sus datos y funciona sin auditoría.
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
   - Importa un video de tu canal en Crear publicación > Importar desde YouTube y confirma que recibe su lista de promoción; los pendientes vencidos llegan como aviso y aparecen en `/pendientes`.
   - Desconecta y vuelve a conectar.
   - Registra el resultado de V1 a V3 en la spec (sección 15).

## 5. Próximas fases

| Elemento | Fase |
|---|---|
| Llaves de Anthropic y OpenAI | 4 |
| Llave pública de Google para YouTube (tendencias) | 6 |
