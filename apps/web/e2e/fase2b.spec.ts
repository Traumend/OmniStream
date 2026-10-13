import { expect, test, type Page } from '@playwright/test';
import { adminDemo } from '@omnistream/pruebas-integracion/admin';
import { entrarComo } from './ayudantes';

const { db } = adminDemo('e2e2b');
const DIA_MS = 24 * 60 * 60 * 1000;
const REDES = ['facebook', 'instagram', 'youtube', 'tiktok'];

test.beforeAll(async () => {
  // Empieza sin conexiones: los demás archivos de prueba pueden haber dejado alguna.
  for (const red of REDES) await db.doc(`connections/${red}`).delete();
});

async function entrar(page: Page) {
  await page.goto('/entrar');
  await entrarComo(page, 'propietario@omnistream.test');
  await expect(page).toHaveURL(/\/calendario$/);
}

test('Conexiones lista las 4 redes y Conectar lleva a TikTok con state', async ({ page }) => {
  await entrar(page);
  await page.goto('/ajustes/conexiones');
  for (const red of ['Facebook', 'Instagram', 'YouTube', 'TikTok']) {
    await expect(page.getByRole('region', { name: red }).getByText('Sin conectar')).toBeVisible();
  }
  const autorizacion = page.waitForRequest((r) => r.url().startsWith('https://www.tiktok.com/v2/auth/authorize/'));
  await page.route('https://www.tiktok.com/**', (ruta) => ruta.abort());
  await page.getByRole('region', { name: 'TikTok' }).getByRole('button', { name: 'Conectar con TikTok' }).click();
  const url = new URL((await autorizacion).url());
  expect(url.searchParams.get('client_key')).toBe('demo-tiktok');
  expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:3000/api/conexiones/retorno');
  expect(url.searchParams.get('state')?.length).toBeGreaterThanOrEqual(43);
});

test('una red conectada pasa a modo API y lo conserva', async ({ page }) => {
  await db.doc('connections/youtube').set({
    platform: 'youtube',
    authStatus: 'conectada',
    publishMode: 'manual',
    readEnabled: true,
    scopes: ['https://www.googleapis.com/auth/youtube.upload'],
    account: { id: 'UC1', name: 'Mi canal' },
  });
  await entrar(page);
  await page.goto('/ajustes/conexiones');
  const youtube = page.getByRole('region', { name: 'YouTube' });
  await expect(youtube.getByText('Mi canal')).toBeVisible();
  await youtube.getByLabel('Modo de publicación').selectOption('api');
  await expect(
    youtube.getByText('Mientras Google no audite la app, los videos subidos por API quedan privados.'),
  ).toBeVisible();
  await expect.poll(async () => (await db.doc('connections/youtube').get()).get('publishMode')).toBe('api');
  await page.reload();
  await expect(page.getByRole('region', { name: 'YouTube' }).getByLabel('Modo de publicación')).toHaveValue('api');
  await db.doc('connections/youtube').delete();
});

test('un Principal con promoción vencida aparece en Pendientes y se marca hecho', async ({ page }) => {
  const ayer = new Date(Date.now() - DIA_MS);
  const publicado = new Date(Date.now() - 3 * DIA_MS);
  const post = db.doc('posts/yt-e2e');
  await db.recursiveDelete(post);
  await post.set({
    kind: 'principal',
    origin: 'youtube_importado',
    status: 'publicada',
    title: 'Video importado',
    base: { text: '', hashtags: [] },
    scheduledAt: publicado,
    targetStatus: { youtube: 'publicada' },
    createdAt: publicado,
    updatedAt: publicado,
    promotion: {
      items: [
        {
          id: 'i1',
          type: 'comunidad',
          title: 'Post en Comunidad',
          offsetDays: 2,
          dueAt: ayer,
          dueAtEdited: false,
          status: 'pendiente',
        },
      ],
    },
  });
  await post
    .collection('targets')
    .doc('youtube')
    .set({
      platform: 'youtube',
      format: 'video_largo',
      overrides: {},
      scheduleVersion: 0,
      publishMode: 'manual',
      status: 'publicada',
      statusChangedAt: publicado,
      scheduledAt: publicado,
      parentRef: { status: 'no_aplica' },
      attempts: 0,
      remote: { id: 'dQw4w9WgXcQ', url: 'https://youtu.be/dQw4w9WgXcQ', publishedAt: publicado },
    });

  await entrar(page);
  await page.goto('/pendientes');
  const tarjeta = page.getByRole('article', { name: 'Post en Comunidad · Video importado' });
  await expect(tarjeta.getByText('Vencido')).toBeVisible();
  await tarjeta.getByRole('link', { name: 'Ver principal' }).click();
  await expect(page).toHaveURL(/\/publicaciones\/yt-e2e$/);

  const panel = page.getByRole('region', { name: 'Promoción' });
  await expect(panel.getByText('Importado de YouTube')).toBeVisible();
  await expect(panel.getByText('0 de 1')).toBeVisible();
  await panel.getByRole('checkbox', { name: 'Post en Comunidad' }).check();
  await panel.getByRole('button', { name: 'Guardar promoción' }).click();
  await expect.poll(async () => (await post.get()).get('promotion.items')[0].status).toBe('hecho');
  await expect(page.getByRole('region', { name: 'Promoción' }).getByText('1 de 1')).toBeVisible();
});

test('el retorno de OAuth sin state válido vuelve a Conexiones con el error', async ({ page }) => {
  await entrar(page);
  await page.goto('/api/conexiones/retorno?state=falso&code=x');
  await expect(page).toHaveURL(/\/ajustes\/conexiones$/);
  await expect(page.getByText('La conexión venció o no es válida. Vuelve a intentarlo.')).toBeVisible();
});
