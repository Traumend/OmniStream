import { expect, type BrowserContext, type Page } from '@playwright/test';

const IFRAME_DE_AUTH = '/emulator/auth/iframe';
const SCRIPTS_DE_GOOGLE = /^https:\/\/apis\.google\.com\//;
const INTENTOS_DE_DESCARGA = 3;

// El iframe y la ventana del emulador de Auth cargan gapi desde apis.google.com. En CI esa descarga a veces
// se cuelga y el iframe queda en "loading" hasta agotar el tiempo, así que se descarga con tiempo límite y
// se reintenta.
const contextosConReintento = new WeakSet<BrowserContext>();
async function reintentarScriptsDeGoogle(contexto: BrowserContext): Promise<void> {
  if (contextosConReintento.has(contexto)) return;
  contextosConReintento.add(contexto);
  await contexto.route(SCRIPTS_DE_GOOGLE, async (ruta) => {
    for (let intento = 1; intento <= INTENTOS_DE_DESCARGA; intento++) {
      try {
        await ruta.fulfill({ response: await ruta.fetch({ timeout: 15_000 }) });
        return;
      } catch {
        // Tiempo agotado o conexión cortada: se reintenta.
      }
    }
    await ruta.abort().catch(() => undefined);
  });
}

// La ventana del emulador entrega el resultado al iframe de Auth de la página que la abrió; si ese iframe
// aún no cargó (pasa en frío), el resultado se pierde ("No matching frame") y el inicio de sesión no ocurre.
// El marco se busca de nuevo en cada sondeo porque puede reemplazarse mientras se espera.
async function esperarIframeDeAuth(page: Page): Promise<void> {
  await expect
    .poll(
      async () => {
        const marco = page.frames().find((f) => f.url().includes(IFRAME_DE_AUTH));
        return marco?.evaluate(() => document.readyState).catch(() => undefined);
      },
      { timeout: 60_000 },
    )
    .toBe('complete');
}

// Completa la ventana de inicio de sesión del emulador de Auth con una cuenta de Google simulada.
// La ventana asigna sus eventos de clic después de cargar un script externo, así que se espera
// a que termine de cargar y se reintenta el clic hasta que aparezca el formulario.
export async function entrarComo(page: Page, email: string): Promise<void> {
  await reintentarScriptsDeGoogle(page.context());
  const [ventana] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('button', { name: 'Entrar con Google' }).click(),
  ]);
  await ventana.waitForLoadState('load');
  await esperarIframeDeAuth(page);
  const cerrada = ventana.waitForEvent('close', { timeout: 60_000 });
  const existente = ventana.locator('li.js-reuse-account', { hasText: email }).first();
  if ((await existente.count()) > 0) {
    await existente.click();
  } else {
    const correo = ventana.locator('#email-input');
    await expect(async () => {
      if (!(await correo.isVisible())) await ventana.locator('#add-account-button button').click();
      await expect(correo).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 60_000 });
    await correo.fill(email);
    await ventana.locator('#display-name-input').fill('Propietario');
    await ventana.locator('#sign-in').click();
  }
  // La app cierra la ventana al recibir el resultado, también cuando la función de bloqueo lo rechaza.
  await cerrada;
}

// Sube un archivo desde la Biblioteca y espera a que su tarjeta (la más reciente con ese nombre) quede "Listo".
export async function subirArchivo(page: Page, ruta: string, nombre: string): Promise<void> {
  await page.goto('/biblioteca');
  const tarjetas = page.getByRole('article', { name: nombre });
  await expect(page.getByRole('heading', { name: 'Biblioteca' })).toBeVisible();
  await expect(page.getByText('Cargando archivos…')).toHaveCount(0);
  const antes = await tarjetas.count();
  await page.locator('input[type=file]').setInputFiles(ruta);
  await expect(tarjetas).toHaveCount(antes + 1, { timeout: 60_000 });
  await expect(tarjetas.first().getByText('Listo')).toBeVisible({ timeout: 90_000 });
}
