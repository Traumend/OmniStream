import { expect, test, type Page } from '@playwright/test';
import { adminDemo } from '@omnistream/pruebas-integracion/admin';
import { prepararFixtures, type Fixtures } from '@omnistream/pruebas-integracion/fixtures';
import { entrarComo, irAlPaso, subirArchivo } from './ayudantes';

const { db } = adminDemo('e2e-fase3');
const REDES = ['Facebook', 'Instagram', 'YouTube', 'TikTok'];

let fixtures: Fixtures;

test.beforeAll(async () => {
  fixtures = await prepararFixtures();
});

// Sube el archivo desde la Biblioteca y abre Crear con él elegido.
async function crearCon(page: Page, ruta: string, nombre: string) {
  await page.goto('/entrar');
  await entrarComo(page, 'propietario@omnistream.test');
  await expect(page).toHaveURL(/\/calendario$/);
  await subirArchivo(page, ruta, nombre);
  await page
    .getByRole('button', { name: /Ver detalle/ })
    .first()
    .click();
  await page.getByRole('link', { name: 'Crear publicación' }).click();
  await expect(page.getByRole('heading', { name: 'Crear publicación' })).toBeVisible();
}

// Deja marcadas solo las redes pedidas.
async function elegirRedes(page: Page, redes: string[]) {
  await irAlPaso(page, 'Destinos');
  for (const red of REDES) {
    const casilla = page.getByRole('checkbox', { name: red });
    if (redes.includes(red)) await casilla.check();
    else await casilla.uncheck();
  }
}

const redEnCanvas = (page: Page, red: string) =>
  page.getByRole('list', { name: 'Redes' }).getByRole('button', { name: new RegExp(`^${red}`) });

test('un video 16:9 recortado a 9:16 para TikTok y 1:1 para Facebook publica un archivo distinto por red', async ({
  page,
}) => {
  test.setTimeout(420_000);
  await crearCon(page, fixtures.videoHorizontal, 'video-horizontal.mp4');
  await elegirRedes(page, ['Facebook', 'TikTok']);
  await page.getByLabel('Formato en Facebook').selectOption('video_largo');

  await irAlPaso(page, 'Canvas');
  await redEnCanvas(page, 'TikTok').click();
  await page.getByRole('button', { name: 'Aplicar guía 9:16' }).click();
  await redEnCanvas(page, 'Facebook').click();
  await page.getByRole('group', { name: 'Proporción' }).getByRole('button', { name: /^1:1/ }).click();

  await irAlPaso(page, 'Contenido');
  const titulo = `Recorte E2E ${Date.now()}`;
  await page.getByLabel('Título').fill(titulo);
  await expect(page.getByText('Guardado', { exact: true })).toBeVisible();
  const postId = new URL(page.url()).searchParams.get('id') as string;
  expect(postId).toBeTruthy();

  // El emulador de Cloud Tasks no respeta scheduleTime: las esperas de 120 s de publicarDestino se agotarían en
  // segundos. Se publica cuando los derivados ya están listos; la espera la cubren las pruebas de integración.
  const destino = (red: string) => db.doc(`posts/${postId}/targets/${red}`);
  for (const red of ['tiktok', 'facebook']) {
    await expect
      .poll(async () => (await destino(red).get()).get('derivative.status'), { timeout: 240_000 })
      .toBe('listo');
  }

  await irAlPaso(page, 'Publicar');
  await page.getByRole('button', { name: 'Publicar ahora' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmar' }).click();
  await expect(page).toHaveURL(new RegExp(`/calendario\\?resaltar=${postId}`));
  for (const red of ['tiktok', 'facebook']) {
    await expect
      .poll(async () => (await destino(red).get()).get('status'), { timeout: 120_000 })
      .toBe('pendiente_manual');
  }
  const rutaTiktok = (await destino('tiktok').get()).get('derivative.storagePath') as string;
  const rutaFacebook = (await destino('facebook').get()).get('derivative.storagePath') as string;
  expect(rutaTiktok).not.toBe(rutaFacebook);
  expect(rutaTiktok).toMatch(/\.mp4$/);
  expect(rutaFacebook).toMatch(/\.mp4$/);

  await page.goto(`/pendientes/${postId}/tiktok`);
  await expect(page.getByRole('link', { name: 'Descargar archivo' })).toHaveAttribute(
    'href',
    new RegExp(`derivados%2F${postId}%2Ftiktok%2F`),
  );
});

test('el autoguardado conserva el borrador al recargar', async ({ page }) => {
  await crearCon(page, fixtures.video, 'video-vertical.mp4');
  await irAlPaso(page, 'Contenido');
  const titulo = `Autoguardado E2E ${Date.now()}`;
  await page.getByLabel('Título').fill(titulo);
  await expect(page.getByText('Guardado', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/crear\?.*id=[^&]+/);
  await expect(page).toHaveURL(/paso=contenido/);

  await page.reload();
  await expect(page.getByLabel('Título')).toHaveValue(titulo);
  await expect(
    page.getByRole('navigation', { name: 'Pasos' }).getByRole('button', { name: 'Contenido' }),
  ).toHaveAttribute('aria-current', 'step');
});

test('las zonas seguras se ven en el canvas', async ({ page }) => {
  await crearCon(page, fixtures.video, 'video-vertical.mp4');
  await elegirRedes(page, ['TikTok']);
  await irAlPaso(page, 'Canvas');
  const marco = page.getByRole('figure', { name: 'Marco de TikTok' });
  await expect(marco.locator('[data-zona]')).toHaveCount(0);
  await page.getByRole('switch', { name: 'Zonas seguras' }).click();
  await expect(marco.locator('[data-zona]')).toHaveCount(3);
  for (const zona of await marco.locator('[data-zona]').all()) await expect(zona).toBeVisible();
});
