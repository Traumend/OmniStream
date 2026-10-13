import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { destinoDePrueba, publicacionDePrueba } from './fixtures';
import { ListaPendientes } from './ListaPendientes';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const publicacion = publicacionDePrueba();

it('lista los pendientes por hora con enlace a su paquete', () => {
  render(
    <ListaPendientes
      manuales={[
        {
          publicacion,
          destino: destinoDePrueba('instagram', 'pendiente_manual', { scheduledAt: new Date('2026-10-08T18:00:00Z') }),
        },
        {
          publicacion,
          destino: destinoDePrueba('tiktok', 'pendiente_manual', { scheduledAt: new Date('2026-10-08T16:00:00Z') }),
        },
      ]}
      referencias={[]}
      zona="UTC"
      alMarcarReferencia={vi.fn()}
    />,
  );
  const articulos = screen.getAllByRole('article');
  expect(articulos.map((a) => a.getAttribute('aria-label'))).toEqual(['Mi corto · TikTok', 'Mi corto · Instagram']);
  expect(within(articulos[0]!).getByRole('link', { name: 'Abrir paquete' })).toHaveAttribute(
    'href',
    '/pendientes/p1/tiktok',
  );
});

it('las referencias muestran el texto listo para copiar y se marcan', async () => {
  const alMarcarReferencia = vi.fn().mockResolvedValue(undefined);
  const user = userEvent.setup();
  const hija = publicacionDePrueba({ kind: 'hija', parentId: 'p0' });
  render(
    <ListaPendientes
      manuales={[]}
      referencias={[
        {
          publicacion: hija,
          destino: destinoDePrueba('instagram', 'publicada', { parentRef: { status: 'pendiente' } }),
          principal: publicacionDePrueba({ id: 'p0', kind: 'principal', title: 'Largo' }),
          urlPrincipal: 'https://youtu.be/abc',
        },
      ]}
      zona="UTC"
      alMarcarReferencia={alMarcarReferencia}
    />,
  );
  expect(screen.getByText('Video completo en YouTube: «Largo» https://youtu.be/abc')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Marcar referencia como publicada' }));
  expect(alMarcarReferencia).toHaveBeenCalledWith('p1', 'instagram');
});

it('sin elementos muestra "No hay pendientes."', () => {
  render(<ListaPendientes manuales={[]} referencias={[]} zona="UTC" alMarcarReferencia={vi.fn()} />);
  expect(screen.getByText('No hay pendientes.')).toBeInTheDocument();
});

it('la sección Promoción lista vencidos y próximos', () => {
  const item = (id: string, title: string, dueAt: string) => ({
    id,
    type: 'short' as const,
    title,
    offsetDays: 1,
    dueAt: new Date(dueAt),
    dueAtEdited: false,
    status: 'pendiente' as const,
  });
  render(
    <ListaPendientes
      manuales={[]}
      referencias={[]}
      promociones={[
        {
          postId: 'p9',
          tituloPrincipal: 'Video largo',
          item: item('a', 'Short 1', '2026-10-07T10:00:00Z'),
          vencido: true,
        },
        {
          postId: 'p9',
          tituloPrincipal: 'Video largo',
          item: item('b', 'Short 2', '2026-10-09T10:00:00Z'),
          vencido: false,
        },
      ]}
      zona="UTC"
      alMarcarReferencia={vi.fn()}
    />,
  );
  const seccion = screen.getByRole('region', { name: 'Promoción' });
  const articulos = within(seccion).getAllByRole('article');
  expect(articulos.map((a) => a.getAttribute('aria-label'))).toEqual([
    'Short 1 · Video largo',
    'Short 2 · Video largo',
  ]);
  expect(within(articulos[0]!).getByText('Vencido')).toBeInTheDocument();
  expect(within(articulos[1]!).queryByText('Vencido')).not.toBeInTheDocument();
  expect(within(articulos[0]!).getByRole('link', { name: 'Ver principal' })).toHaveAttribute(
    'href',
    '/publicaciones/p9',
  );
});
