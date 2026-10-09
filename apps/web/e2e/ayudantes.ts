import { expect, type Page } from '@playwright/test';

const IFRAME_DE_AUTH = '/emulator/auth/iframe';

// La ventana del emulador entrega el resultado al iframe de Auth de la página que la abrió; si ese iframe
// aún no cargó (pasa en frío), el resultado se pierde ("No matching frame") y el inicio de sesión no ocurre.
// El iframe puede recargarse o reemplazarse mientras se espera, así que se busca de nuevo en cada sondeo:
// esperar el evento load de un marco ya desprendido no termina nunca.
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
