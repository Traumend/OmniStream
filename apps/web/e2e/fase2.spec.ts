import { expect, test, type Page } from '@playwright/test';
import { adminDemo } from '@omnistream/pruebas-integracion/admin';
import { prepararFixtures, type Fixtures } from '@omnistream/pruebas-integracion/fixtures';
import { entrarComo, subirArchivo } from './ayudantes';

const { db } = adminDemo('e2e');
const REDES = ['Facebook', 'Instagram', 'YouTube', 'TikTok'];
const DIA_MS = 24 * 60 * 60 * 1000;

let fixtures: Fixtures;

test.beforeAll(async () => {
  fixtures = await prepararFixtures();
  // Las fechas de las pruebas se calculan en UTC.
  await db.doc('settings/app').set({ timezone: 'UTC' }, { merge: true });
});

const diaUtc = (desplazamiento: number) => new Date(Date.now() + desplazamiento * DIA_MS).toISOString().slice(0, 10);

async function entrarYCrear(page: Page) {
  await page.goto('/entrar');
  await entrarComo(page, 'propietario@omnistream.test');
  await expect(page).toHaveURL(/\/calendario$/);
  await subirArchivo(page, fixtures.video, 'video-vertical.mp4');
  await page
    .getByRole('button', { name: /Ver detalle/ })
    .first()
    .click();
  await page.getByRole('link', { name: 'Crear publicación' }).click();
  await expect(page.getByRole('heading', { name: 'Crear publicación' })).toBeVisible();
}

const postIdResaltado = (page: Page) => new URL(page.url()).searchParams.get('resaltar') as string;

test('programa a 4 redes en modo manual, llega a pendientes con aviso y se marca publicada', async ({ page }) => {
  await entrarYCrear(page);
  for (const red of REDES) await expect(page.getByRole('checkbox', { name: red })).toBeChecked();
  const titulo = `Prueba E2E ${Date.now()}`;
  await page.getByLabel('Título').fill(titulo);
  await page.getByLabel('Texto', { exact: true }).fill('Hola desde OmniStream');
  await page.getByRole('button', { name: 'Publicar ahora' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmar' }).click();
  await expect(page).toHaveURL(/\/calendario\?resaltar=/);
  const postId = postIdResaltado(page);

  await page.goto('/pendientes');
  for (const red of REDES) {
    await expect(page.getByRole('article', { name: `${titulo} · ${red}` })).toBeVisible({ timeout: 60_000 });
  }
  // El aviso lo escribe alCambiarDestino después de que la red pasa a pendiente, así que puede llegar más tarde que la tarjeta.
  const avisos = db.collection('notifications').where('enlace', '==', `/pendientes/${postId}/tiktok`);
  await expect.poll(async () => (await avisos.get()).size, { timeout: 30_000 }).toBe(1);

  await page
    .getByRole('article', { name: `${titulo} · TikTok` })
    .getByRole('link', { name: 'Abrir paquete' })
    .click();
  await expect(page.getByLabel('Texto final')).toHaveValue(/Hola desde OmniStream/);
  await page.getByLabel('URL publicada').fill('https://www.tiktok.com/@cuenta/video/7300000000000000001');
  await page.getByRole('button', { name: 'Marcar como publicada' }).click();
  await expect(page).toHaveURL(/\/pendientes$/);
  await expect(page.getByRole('article', { name: `${titulo} · TikTok` })).toHaveCount(0);

  await page.goto(`/publicaciones/${postId}`);
  await expect(page.getByRole('region', { name: 'TikTok' }).getByText('Publicada', { exact: true })).toBeVisible();
});

test('mover una publicación en el calendario no la duplica', async ({ page }) => {
  await entrarYCrear(page);
  for (const red of ['Instagram', 'YouTube', 'TikTok']) await page.getByRole('checkbox', { name: red }).uncheck();
  await expect(page.getByRole('checkbox', { name: 'Facebook' })).toBeChecked();
  await page.getByLabel('Formato en Facebook').selectOption('reel');
  const titulo = `Mover E2E ${Date.now()}`;
  await page.getByLabel('Título').fill(titulo);
  await page.getByLabel('Texto', { exact: true }).fill('Se mueve un día');
  const manana = diaUtc(1);
  const pasadoManana = diaUtc(2);
  await page.getByLabel('Fecha').fill(manana);
  await page.getByLabel('Hora').fill('10:00');
  await page.getByRole('button', { name: 'Programar' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmar' }).click();
  await expect(page).toHaveURL(/\/calendario\?resaltar=/);
  const postId = postIdResaltado(page);

  const evento = page.locator('.fc-event', { hasText: titulo });
  await expect(evento).toBeVisible();
  const origen = await evento.boundingBox();
  const destino = await page.locator(`td[data-date="${pasadoManana}"]`).boundingBox();
  if (!origen || !destino) throw new Error('No se encontró el evento o el día de destino en el calendario');
  await page.mouse.move(origen.x + origen.width / 2, origen.y + origen.height / 2);
  await page.mouse.down();
  await page.mouse.move(destino.x + destino.width / 2, destino.y + destino.height / 2, { steps: 10 });
  await page.mouse.up();
  await expect(page.getByText('Publicación movida')).toBeVisible();

  const post = await db.doc(`posts/${postId}`).get();
  expect(post.get('scheduledAt').toDate().toISOString()).toBe(`${pasadoManana}T10:00:00.000Z`);
  const destinos = await db.collection(`posts/${postId}/targets`).get();
  expect(destinos.size).toBe(1);
  const facebook = destinos.docs[0];
  expect(facebook?.id).toBe('facebook');
  expect(facebook?.get('scheduleVersion')).toBe(2);
  expect(facebook?.get('attempts')).toBe(0);
});
