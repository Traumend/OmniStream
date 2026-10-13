import { render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { PasoPublicar } from './PasoPublicar';

it('el resumen agrupa errores y advertencias por red y bloquea con errores', () => {
  render(
    <PasoPublicar
      fecha=""
      hora=""
      zona="UTC"
      errores={[]}
      problemas={[
        { nivel: 'error', red: 'tiktok', mensaje: 'TikTok · Video: el video dura 20:00 y el máximo es 10:00.' },
        {
          nivel: 'advertencia',
          red: 'tiktok',
          mensaje: 'TikTok · Video: la proporción 16:9 no es la recomendada (9:16).',
        },
        {
          nivel: 'advertencia',
          red: 'facebook',
          mensaje: 'Facebook · Reel: la proporción 16:9 no es la recomendada (9:16).',
        },
        { nivel: 'advertencia', mensaje: 'La resolución es menor a 720p.' },
      ]}
      esProgramada={false}
      enviando={false}
      alCambiarFecha={vi.fn()}
      alEnviar={vi.fn()}
    />,
  );
  const resumen = screen.getByRole('region', { name: 'Resumen' });
  const tiktok = within(resumen).getByRole('group', { name: 'TikTok' });
  expect(within(tiktok).getByText(/el video dura 20:00/)).toHaveAttribute('data-nivel', 'error');
  expect(within(tiktok).getByText(/no es la recomendada/)).toHaveAttribute('data-nivel', 'advertencia');
  expect(within(resumen).getByRole('group', { name: 'Facebook' })).toHaveTextContent('no es la recomendada');
  expect(within(resumen).getByRole('group', { name: 'Todas las redes' })).toHaveTextContent('menor a 720p');
  expect(within(resumen).getByText('Corrige los errores para programar o publicar.')).toBeInTheDocument();
});

it('sin problemas el resumen lo dice', () => {
  render(
    <PasoPublicar
      fecha=""
      hora=""
      zona="UTC"
      errores={[]}
      problemas={[]}
      esProgramada={false}
      enviando={false}
      alCambiarFecha={vi.fn()}
      alEnviar={vi.fn()}
    />,
  );
  expect(
    within(screen.getByRole('region', { name: 'Resumen' })).getByText('Todo listo para publicar.'),
  ).toBeInTheDocument();
});
