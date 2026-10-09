import { expect, type Page } from '@playwright/test';

const IFRAME_DE_AUTH = '/emulator/auth/iframe';
const INTENTOS_DE_ENTRADA = 3;
const ESPERA_DE_CARGA_MS = 15_000;

// La ventana del emulador entrega el resultado al iframe de Auth de la página que la abrió; si ese iframe
// aún no cargó (pasa en frío), el resultado se pierde ("No matching frame") y el inicio de sesión no ocurre.
// El marco se busca de nuevo en cada sondeo porque puede reemplazarse mientras se espera.
async function iframeDeAuthListo(page: Page): Promise<boolean> {
  try {
    await expect
      .poll(
        async () => {
          const marco = page.frames().find((f) => f.url().includes(IFRAME_DE_AUTH));
          return marco?.evaluate(() => document.readyState).catch(() => undefined);
        },
        { timeout: ESPERA_DE_CARGA_MS },
      )
      .toBe('complete');
    return true;
  } catch {
    return false;
  }
}

// Abre la ventana de inicio de sesión y espera a que ella y el iframe de Auth terminen de cargar. La página,
// la ventana y el iframe cargan gapi desde apis.google.com, y en CI esa descarga a veces se cuelga sin terminar
// nunca: la ventana no llega a abrirse o el iframe se queda en "loading". En ese caso se cierra la ventana, se
// recarga la página y se repite, para que el navegador haga descargas nuevas.
async function intentarAbrirVentanaDeAuth(page: Page): Promise<Page | undefined> {
  const abierta = page.waitForEvent('popup', { timeout: ESPERA_DE_CARGA_MS }).catch(() => undefined);
  await page.getByRole('button', { name: 'Entrar con Google' }).click();
  const ventana = await abierta;
  if (!ventana) return undefined;
  const cargada = await ventana
    .waitForLoadState('load', { timeout: ESPERA_DE_CARGA_MS })
    .then(() => true)
    .catch(() => false);
  if (cargada && (await iframeDeAuthListo(page))) return ventana;
  await ventana.close().catch(() => undefined);
  return undefined;
}

async function abrirVentanaDeAuth(page: Page): Promise<Page> {
  for (let intento = 1; ; intento++) {
    const ventana = await intentarAbrirVentanaDeAuth(page);
    if (ventana) return ventana;
    if (intento === INTENTOS_DE_ENTRADA) {
      throw new Error(`La ventana o el iframe de Auth del emulador no cargaron tras ${INTENTOS_DE_ENTRADA} intentos.`);
    }
    await page.reload();
  }
}

// Completa la ventana de inicio de sesión del emulador de Auth con una cuenta de Google simulada.
// La ventana asigna sus eventos de clic después de cargar un script externo, así que se espera
// a que termine de cargar y se reintenta el clic hasta que aparezca el formulario.
export async function entrarComo(page: Page, email: string): Promise<void> {
  const ventana = await abrirVentanaDeAuth(page);
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
