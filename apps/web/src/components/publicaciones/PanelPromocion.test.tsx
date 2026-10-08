import {
  crearPromocion,
  PLANTILLA_PROMOCION_POR_DEFECTO,
  type ItemPromocion,
  type Publicacion,
} from '@omnistream/core';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { PanelPromocion } from './PanelPromocion';

const BASE = new Date('2026-10-10T15:00:00Z');
let n = 0;
const items = (): ItemPromocion[] => crearPromocion(PLANTILLA_PROMOCION_POR_DEFECTO, BASE, () => `i${++n}`);

const principal = (lista: ItemPromocion[], cambios: Partial<Publicacion> = {}): Publicacion => ({
  id: 'p1',
  kind: 'principal',
  status: 'publicada',
  title: 'Mi video largo',
  base: { text: '', hashtags: [] },
  scheduledAt: BASE,
  targetStatus: {},
  createdAt: BASE,
  updatedAt: BASE,
  promotion: { items: lista },
  ...cambios,
});

function montar(lista: ItemPromocion[], props: Partial<Parameters<typeof PanelPromocion>[0]> = {}) {
  const alGuardar = vi.fn().mockResolvedValue(undefined);
  const user = userEvent.setup();
  render(
    <PanelPromocion
      publicacion={principal(lista)}
      hijas={[]}
      zona="UTC"
      fechaBase={BASE}
      ahora={() => new Date('2026-10-12T00:00:00Z')}
      alGuardar={alGuardar}
      {...props}
    />,
  );
  return { alGuardar, user };
}

const fila = (n: number) => screen.getByRole('listitem', { name: `Pendiente ${n}` });

it('muestra el progreso y marca un vencido', () => {
  const lista = items();
  lista[2] = { ...lista[2]!, status: 'hecho' };
  montar(lista);
  const panel = screen.getByRole('region', { name: 'Promoción' });
  expect(within(panel).getByText('1 de 5')).toBeInTheDocument();
  expect(within(fila(1)).getByText('Vencido')).toBeInTheDocument();
  expect(within(fila(2)).queryByText('Vencido')).not.toBeInTheDocument();
  expect(within(fila(3)).queryByText('Vencido')).not.toBeInTheDocument();
  expect(
    within(fila(4)).getByText(
      'YouTube no permite publicar en Comunidad por API: hazlo en YouTube Studio y márcalo aquí.',
    ),
  ).toBeInTheDocument();
});

it('editar la fecha marca dueAtEdited y Restablecer la quita', async () => {
  const { alGuardar, user } = montar(items());
  fireEvent.change(within(fila(2)).getByLabelText('Fecha del pendiente 2'), { target: { value: '2026-10-20T09:30' } });
  await user.click(within(fila(2)).getByRole('button', { name: 'Restablecer fecha' }));
  expect(within(fila(2)).queryByRole('button', { name: 'Restablecer fecha' })).not.toBeInTheDocument();
  expect(within(fila(2)).getByLabelText('Fecha del pendiente 2')).toHaveValue('2026-10-13T15:00');
  fireEvent.change(within(fila(2)).getByLabelText('Fecha del pendiente 2'), { target: { value: '2026-10-20T09:30' } });
  await user.click(screen.getByRole('button', { name: 'Guardar promoción' }));
  expect(alGuardar.mock.calls[0]?.[0][1]).toMatchObject({
    dueAt: new Date('2026-10-20T09:30:00Z'),
    dueAtEdited: true,
  });
});

it('marcar hecho y guardar envía los items', async () => {
  const lista = items();
  const { alGuardar, user } = montar(lista);
  await user.click(within(fila(4)).getByRole('checkbox', { name: 'Post en Comunidad' }));
  await user.type(within(fila(4)).getByLabelText('Nota del pendiente 4'), 'Encuesta');
  await user.click(screen.getByRole('button', { name: 'Guardar promoción' }));
  const enviados = alGuardar.mock.calls[0]?.[0] as ItemPromocion[];
  expect(enviados).toHaveLength(5);
  expect(enviados[3]).toMatchObject({ id: lista[3]!.id, status: 'hecho', note: 'Encuesta' });
  expect(screen.getByText('1 de 5')).toBeInTheDocument();
});

it('agregar y quitar pendientes', async () => {
  const { alGuardar, user } = montar(items());
  await user.click(screen.getByRole('button', { name: 'Agregar pendiente' }));
  expect(screen.getByText('0 de 6')).toBeInTheDocument();
  await user.clear(within(fila(6)).getByLabelText('Título del pendiente 6'));
  await user.type(within(fila(6)).getByLabelText('Título del pendiente 6'), 'Historia de Instagram');
  await user.selectOptions(within(fila(6)).getByLabelText('Tipo del pendiente 6'), 'exposicion');
  await user.click(within(fila(1)).getByRole('button', { name: 'Quitar' }));
  await user.click(screen.getByRole('button', { name: 'Guardar promoción' }));
  const enviados = alGuardar.mock.calls[0]?.[0] as ItemPromocion[];
  expect(enviados.map((i) => i.title)).toEqual([
    'Short 2',
    'Short 3',
    'Post en Comunidad',
    'Exposición en medios propios',
    'Historia de Instagram',
  ]);
  expect(enviados[4]).toMatchObject({ type: 'exposicion', status: 'pendiente', dueAtEdited: false, dueAt: BASE });
});

it('un short cumplido enlaza a su Hija', () => {
  const lista = items();
  lista[0] = { ...lista[0]!, status: 'hecho', hijaId: 'h1' };
  const hija: Publicacion = { ...principal([]), id: 'h1', kind: 'hija', title: 'Corto uno', promotion: undefined };
  montar(lista, { hijas: [hija] });
  expect(within(fila(1)).getByRole('link', { name: 'Corto uno' })).toHaveAttribute('href', '/publicaciones/h1');
});

it('un Principal importado enlaza a su video', () => {
  montar(items(), {
    publicacion: principal(items(), { origin: 'youtube_importado' }),
    urlYoutube: 'https://youtu.be/dQw4w9WgXcQ',
  });
  expect(screen.getByText('Importado de YouTube')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Ver en YouTube' })).toHaveAttribute('href', 'https://youtu.be/dQw4w9WgXcQ');
});
