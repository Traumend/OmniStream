import { estadoDeRed, type Asset, type ContextoValidacion, type Destino, type Platform } from '@omnistream/core';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import { revisarEnvio } from '@/lib/publicaciones/revisarEnvio';
import { PasoCanvas } from './PasoCanvas';

const horizontal = {
  id: 'a1',
  kind: 'video',
  source: 'subida',
  originalName: 'horizontal.mp4',
  storagePath: 'originales/a1',
  mimeType: 'video/mp4',
  sizeBytes: 1000,
  status: 'listo',
  width: 3840,
  height: 2160,
  aspect: 16 / 9,
  durationSec: 30,
  createdAt: new Date('2026-10-01T00:00:00Z'),
} satisfies Asset;
const URLS = {
  start: 'https://img.test/inicio.jpg',
  middle: 'https://img.test/mitad.jpg',
  end: 'https://img.test/fin.jpg',
};
const ETIQUETA = { correcto: 'Correcto', advertencia: 'Advertencia', error: 'Error' } as const;
const recorte916 = { aspect: '9:16', x: 0.3418, y: 0, w: 0.3164, h: 1 } as const;

type DestinoCanvas = Pick<Destino, 'platform' | 'format' | 'overrides'>;

function contexto(asset: Asset, destinos: DestinoCanvas[]): Omit<ContextoValidacion, 'hora'> {
  return {
    publicacion: { title: 'Hola', assetId: asset.id, base: { text: 'Hola', hashtags: [] }, scheduledAt: null },
    destinos,
    asset,
    principal: null,
    numeroDeHijas: 0,
    ahora: new Date('2026-10-07T12:00:00Z'),
  };
}

function montar(asset: Asset, destinos: DestinoCanvas[]) {
  const { problemas } = revisarEnvio(contexto(asset, destinos), 'guardar', false);
  const user = userEvent.setup();
  render(
    <PasoCanvas
      asset={asset}
      destinos={destinos.map((d) => ({
        platform: d.platform,
        format: d.format,
        crop: d.overrides.crop,
        personalizado: Object.keys(d.overrides).length > 0,
      }))}
      problemas={problemas}
      urls={URLS}
    />,
  );
  return { user, problemas };
}

const indicador = (red: string) =>
  within(screen.getByRole('list', { name: 'Redes' })).getByRole('button', { name: new RegExp(`^${red}`) });

it('el indicador de cada red coincide con la validación del servidor', () => {
  const casos: [Asset, DestinoCanvas[], Platform, string][] = [
    [horizontal, [{ platform: 'tiktok', format: 'tiktok', overrides: {} }], 'tiktok', 'Advertencia'],
    [horizontal, [{ platform: 'tiktok', format: 'tiktok', overrides: { crop: recorte916 } }], 'tiktok', 'Correcto'],
    [
      { ...horizontal, durationSec: 20 * 60 },
      [{ platform: 'instagram', format: 'reel', overrides: {} }],
      'instagram',
      'Error',
    ],
  ];
  for (const [asset, destinos, red, esperado] of casos) {
    const { problemas } = montar(asset, destinos);
    const nombre = { tiktok: 'TikTok', instagram: 'Instagram' }[red as 'tiktok' | 'instagram'];
    expect(within(indicador(nombre)).getByText(ETIQUETA[estadoDeRed(problemas, red)])).toBeInTheDocument();
    expect(within(indicador(nombre)).getByText(esperado)).toBeInTheDocument();
    document.body.innerHTML = '';
  }
});

it('el interruptor muestra las zonas seguras de la red activa', async () => {
  const { user } = montar(horizontal, [
    { platform: 'tiktok', format: 'tiktok', overrides: {} },
    { platform: 'youtube', format: 'video_largo', overrides: {} },
  ]);
  const marco = screen.getByRole('figure', { name: 'Marco de TikTok' });
  expect(marco.querySelectorAll('[data-zona]')).toHaveLength(0);
  await user.click(screen.getByRole('switch', { name: 'Zonas seguras' }));
  expect(marco.querySelectorAll('[data-zona]')).toHaveLength(3);
  await user.click(indicador('YouTube'));
  expect(screen.getByRole('figure', { name: 'Marco de YouTube' }).querySelectorAll('[data-zona]')).toHaveLength(0);
});

it('elegir un fotograma lo muestra en el marco', async () => {
  const { user } = montar(horizontal, [{ platform: 'tiktok', format: 'tiktok', overrides: {} }]);
  expect(screen.getByRole('img', { name: 'Fotograma en el marco' })).toHaveAttribute('src', URLS.start);
  await user.click(screen.getByRole('button', { name: 'Fotograma Mitad' }));
  expect(screen.getByRole('img', { name: 'Fotograma en el marco' })).toHaveAttribute('src', URLS.middle);
  expect(screen.getByRole('button', { name: 'Fotograma Mitad' })).toHaveAttribute('aria-pressed', 'true');
});

it('la red personalizada lo indica', () => {
  montar(horizontal, [
    { platform: 'tiktok', format: 'tiktok', overrides: { text: 'Propio' } },
    { platform: 'facebook', format: 'video_largo', overrides: {} },
  ]);
  expect(within(indicador('TikTok')).getByText('Personalizado')).toBeInTheDocument();
  expect(within(indicador('Facebook')).queryByText('Personalizado')).not.toBeInTheDocument();
});

it('los avisos de la red activa se listan bajo el marco', () => {
  montar(horizontal, [{ platform: 'tiktok', format: 'tiktok', overrides: {} }]);
  expect(
    within(screen.getByRole('list', { name: 'Avisos de TikTok' })).getByText(/no es la recomendada/),
  ).toBeInTheDocument();
});
