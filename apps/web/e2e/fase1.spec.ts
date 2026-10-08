import { expect, test } from '@playwright/test';
import { prepararFixtures, type Fixtures } from '@omnistream/pruebas-integracion/fixtures';
import { entrarComo } from './ayudantes';

let fixtures: Fixtures;

test.beforeAll(async () => {
  fixtures = await prepararFixtures();
});

test('rechaza un correo no permitido', async ({ page }) => {
  await page.goto('/entrar');
  await entrarComo(page, 'intruso@ejemplo.com');
  await expect(page.getByText('Esta cuenta no tiene acceso a OmniStream.')).toBeVisible();
  await expect(page).toHaveURL(/\/entrar$/);
});

test('sube un video y muestra sus datos y 3 fotogramas', async ({ page }) => {
  await page.goto('/entrar');
  await entrarComo(page, 'propietario@omnistream.test');
  await expect(page).toHaveURL(/\/calendario$/);
  await page.goto('/biblioteca');
  await page.locator('input[type=file]').setInputFiles(fixtures.video);
  const tarjeta = page.getByRole('article', { name: 'video-vertical.mp4' });
  await expect(tarjeta.getByText('Listo')).toBeVisible({ timeout: 90_000 });
  await tarjeta.getByRole('button', { name: /Ver detalle/ }).click();
  for (const alt of ['Fotograma de inicio', 'Fotograma de la mitad', 'Fotograma del final']) {
    await expect(page.getByAltText(alt)).toBeVisible();
  }
  const dialogo = page.getByRole('dialog');
  await expect(dialogo.getByText('720 × 1280')).toBeVisible();
  await expect(dialogo.getByText('9:16')).toBeVisible();
});

test('guarda los ajustes generales', async ({ page }) => {
  await page.goto('/entrar');
  await entrarComo(page, 'propietario@omnistream.test');
  await expect(page).toHaveURL(/\/calendario$/);
  await page.goto('/ajustes/general');
  await page.getByLabel('Días de retención').fill('14');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Ajustes guardados')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Días de retención')).toHaveValue('14');
});
