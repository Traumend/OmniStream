import { render, screen, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import { PasoVistaPrevia } from './PasoVistaPrevia';

it('cada red tiene su maqueta con el nombre de su cuenta', () => {
  render(
    <PasoVistaPrevia
      destinos={[
        { platform: 'tiktok', format: 'tiktok', texto: 'Hola' },
        { platform: 'facebook', format: 'reel', texto: 'Hola' },
      ]}
      cuentas={{ tiktok: { nombre: 'Mi TikTok' } }}
      medio={{ tipo: 'video', url: 'https://video.test/v.mp4' }}
    />,
  );
  expect(
    within(screen.getByRole('region', { name: 'Vista previa en TikTok' })).getByText('Mi TikTok'),
  ).toBeInTheDocument();
  expect(
    within(screen.getByRole('region', { name: 'Vista previa en Facebook' })).getByText('Tu cuenta'),
  ).toBeInTheDocument();
  expect(screen.getByText('Aproximación de cómo se verá; cada red muestra su propia interfaz.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Siguiente' })).toBeInTheDocument();
});
