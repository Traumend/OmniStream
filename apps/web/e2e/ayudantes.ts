import type { Page } from '@playwright/test';

// Completa la ventana de inicio de sesión del emulador de Auth con una cuenta de Google simulada.
export async function entrarComo(page: Page, email: string): Promise<void> {
  const [ventana] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('button', { name: 'Entrar con Google' }).click(),
  ]);
  await ventana.locator('#add-account-button').waitFor();
  const existente = ventana.locator('li.js-reuse-account', { hasText: email }).first();
  if ((await existente.count()) > 0) {
    await existente.click();
    return;
  }
  await ventana.locator('#add-account-button button').click();
  await ventana.locator('#email-input').fill(email);
  await ventana.locator('#display-name-input').fill('Propietario');
  await ventana.locator('#sign-in').click();
}
