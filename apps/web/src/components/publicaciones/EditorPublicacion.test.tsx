import { leerConexion, type Asset, type InfoCreadorTiktok, type Publicacion } from '@omnistream/core';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { EditorPublicacion } from './EditorPublicacion';

const base: Asset = {
  id: 'a1',
  kind: 'video',
  source: 'subida',
  originalName: 'vertical.mp4',
  storagePath: 'originales/a1',
  mimeType: 'video/mp4',
  sizeBytes: 1000,
  status: 'listo',
  width: 1080,
  height: 1920,
  aspect: 0.5625,
  durationSec: 30,
  createdAt: new Date('2026-10-01T00:00:00Z'),
};
const baja: Asset = { ...base, id: 'a2', originalName: 'baja.mp4', width: 480, height: 854, aspect: 0.5621 };
const principal: Publicacion = {
  id: 'p1',
  kind: 'principal',
  status: 'programada',
  title: 'Mi video largo',
  base: { text: '', hashtags: [] },
  scheduledAt: new Date('2026-10-10T12:00:00Z'),
  targetStatus: { youtube: 'programada' },
  createdAt: new Date(),
  updatedAt: new Date(),
};

function montar(props: Partial<Parameters<typeof EditorPublicacion>[0]> = {}) {
  const alEnviar = vi.fn().mockResolvedValue(undefined);
  const user = userEvent.setup();
  render(
    <EditorPublicacion
      zona="America/Mexico_City"
      archivos={[base, baja]}
      principales={[]}
      ahora={() => new Date('2026-10-07T12:00:00Z')}
      alEnviar={alEnviar}
      {...props}
    />,
  );
  return { alEnviar, user };
}

async function elegirArchivo(user: ReturnType<typeof userEvent.setup>, nombre: string) {
  await user.click(screen.getByRole('radio', { name: new RegExp(nombre) }));
}

it('al elegir un archivo sugiere las redes', async () => {
  const { user } = montar();
  await elegirArchivo(user, 'vertical.mp4');
  for (const red of ['Facebook', 'Instagram', 'YouTube', 'TikTok']) {
    expect(screen.getByRole('checkbox', { name: red })).toBeChecked();
  }
  expect(screen.getByRole('combobox', { name: 'Formato en YouTube' })).toHaveValue('short');
  expect(screen.getByRole('combobox', { name: 'Formato en Facebook' })).toHaveValue('reel');
});

it('muestra el contador por red y marca el exceso', async () => {
  const { user } = montar();
  await user.click(screen.getByRole('checkbox', { name: 'Instagram' }));
  fireEvent.change(screen.getByLabelText('Texto'), { target: { value: 'a'.repeat(2201) } });
  const contador = screen.getByText('Instagram: 2201 / 2200');
  expect(contador).toHaveAttribute('data-excedido', 'true');
  expect(contador).toHaveClass('text-peligro');
});

it('bloquea Programar con errores y los lista', async () => {
  const { user, alEnviar } = montar();
  await user.type(screen.getByLabelText('Título'), 'Hola');
  await elegirArchivo(user, 'vertical.mp4');
  await user.click(screen.getByRole('button', { name: 'Programar' }));
  expect(within(screen.getByRole('alert')).getByText('Elige la fecha y la hora.')).toBeInTheDocument();
  expect(alEnviar).not.toHaveBeenCalled();
});

it('pide confirmación y muestra las advertencias', async () => {
  const { user, alEnviar } = montar();
  await user.type(screen.getByLabelText('Título'), 'Hola');
  await elegirArchivo(user, 'baja.mp4');
  fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2026-10-08' } });
  fireEvent.change(screen.getByLabelText('Hora'), { target: { value: '10:30' } });
  await user.click(screen.getByRole('button', { name: 'Programar' }));
  const dialogo = await screen.findByRole('dialog');
  expect(within(dialogo).getByText('La resolución es menor a 720p.')).toBeInTheDocument();
  await user.click(within(dialogo).getByRole('button', { name: 'Confirmar' }));
  expect(alEnviar).toHaveBeenCalledWith(
    expect.objectContaining({ title: 'Hola', assetId: 'a2', scheduledAt: '2026-10-08T16:30:00.000Z' }),
    'programar',
  );
});

it('ofrece los principales para videos cortos', async () => {
  const { user, alEnviar } = montar({ principales: [{ publicacion: principal, hijas: 2 }] });
  await user.type(screen.getByLabelText('Título'), 'Hola');
  await elegirArchivo(user, 'vertical.mp4');
  const selector = screen.getByRole('combobox', { name: '¿Pertenece a un video principal?' });
  expect(within(selector).getByRole('option', { name: 'Mi video largo (2 Hijas)' })).toBeInTheDocument();
  await user.selectOptions(selector, 'p1');
  await user.click(screen.getByRole('button', { name: 'Guardar borrador' }));
  expect(alEnviar).toHaveBeenCalledWith(expect.objectContaining({ parentId: 'p1' }), 'guardar');
});

it('con video largo de YouTube anuncia que será Principal y oculta el selector', async () => {
  const { user } = montar({ principales: [{ publicacion: principal, hijas: 1 }] });
  await user.click(screen.getByRole('checkbox', { name: 'YouTube' }));
  await user.selectOptions(screen.getByRole('combobox', { name: 'Formato en YouTube' }), 'video_largo');
  expect(screen.getByText('Esta publicación será un video Principal.')).toBeInTheDocument();
  expect(screen.queryByRole('combobox', { name: '¿Pertenece a un video principal?' })).not.toBeInTheDocument();
});

it('muestra los campos de YouTube solo con YouTube elegido', async () => {
  const { user } = montar();
  expect(screen.queryByLabelText('Descripción de YouTube')).not.toBeInTheDocument();
  await user.click(screen.getByRole('checkbox', { name: 'YouTube' }));
  for (const campo of [
    'Descripción de YouTube',
    'Etiquetas de YouTube',
    'Categoría',
    'Privacidad',
    'Hecho para niños',
    'Miniatura',
  ]) {
    expect(screen.getByLabelText(campo)).toBeInTheDocument();
  }
});

it('guardar borrador no exige fecha', async () => {
  const { user, alEnviar } = montar();
  await user.type(screen.getByLabelText('Título'), 'Hola');
  await elegirArchivo(user, 'vertical.mp4');
  await user.click(screen.getByRole('button', { name: 'Guardar borrador' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(alEnviar).toHaveBeenCalledWith(expect.objectContaining({ title: 'Hola', scheduledAt: null }), 'guardar');
});

it('una publicación programada ofrece Guardar cambios y no Programar', () => {
  montar({
    inicial: {
      publicacion: { ...principal, kind: 'independiente', id: 'p2', assetId: 'a1', title: 'Ya programada' },
      destinos: [
        {
          platform: 'tiktok',
          format: 'tiktok',
          overrides: {},
          scheduleVersion: 1,
          publishMode: 'manual',
          status: 'programada',
          statusChangedAt: new Date(),
          parentRef: { status: 'no_aplica' },
          attempts: 0,
        },
      ],
      hijas: 0,
    },
  });
  expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Programar' })).not.toBeInTheDocument();
  expect(screen.getByLabelText('Título')).toHaveValue('Ya programada');
});

const INFO_TIKTOK: InfoCreadorTiktok = {
  nickname: 'Mi Canal',
  username: 'micanal',
  privacidades: ['PUBLIC_TO_EVERYONE', 'SELF_ONLY'],
  comentariosDesactivados: false,
  duetDesactivado: false,
  stitchDesactivado: false,
  duracionMaximaSeg: 600,
};
const TIKTOK_API = {
  conexiones: {
    tiktok: leerConexion('tiktok', { authStatus: 'conectada', publishMode: 'api', scopes: ['video.publish'] }),
  },
  infoTiktok: { info: INFO_TIKTOK, cargando: false, error: null },
};

it('la sección de TikTok solo aparece en modo API', async () => {
  const { user } = montar();
  await elegirArchivo(user, 'vertical.mp4');
  expect(screen.queryByRole('region', { name: 'TikTok' })).not.toBeInTheDocument();
});

it('con TikTok por API muestra su sección', async () => {
  const { user } = montar(TIKTOK_API);
  await elegirArchivo(user, 'vertical.mp4');
  expect(screen.getByRole('region', { name: 'TikTok' })).toBeInTheDocument();
  expect(screen.getByText('Publicará como Mi Canal (@micanal)')).toBeInTheDocument();
});

it('Programar sin privacidad de TikTok por API muestra el error y no confirma', async () => {
  const { user, alEnviar } = montar(TIKTOK_API);
  await user.type(screen.getByLabelText('Título'), 'Hola');
  await elegirArchivo(user, 'vertical.mp4');
  fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2026-10-08' } });
  fireEvent.change(screen.getByLabelText('Hora'), { target: { value: '10:30' } });
  await user.click(screen.getByRole('button', { name: 'Programar' }));
  expect(
    within(screen.getByRole('alert')).getByText('Elige quién puede ver la publicación en TikTok.'),
  ).toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

  await user.selectOptions(screen.getByLabelText('¿Quién puede verlo?'), 'PUBLIC_TO_EVERYONE');
  await user.click(screen.getByRole('button', { name: 'Programar' }));
  await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Confirmar' }));
  expect(alEnviar.mock.calls[0]?.[0].destinos).toContainEqual(
    expect.objectContaining({ platform: 'tiktok', tiktok: expect.objectContaining({ privacy: 'PUBLIC_TO_EVERYONE' }) }),
  );
});

it('la duración máxima de la cuenta de TikTok bloquea el envío', async () => {
  const { user } = montar({
    ...TIKTOK_API,
    infoTiktok: { ...TIKTOK_API.infoTiktok, info: { ...INFO_TIKTOK, duracionMaximaSeg: 15 } },
  });
  await user.type(screen.getByLabelText('Título'), 'Hola');
  await elegirArchivo(user, 'vertical.mp4');
  await user.click(screen.getByRole('button', { name: 'Publicar ahora' }));
  expect(
    within(screen.getByRole('alert')).getByText('Tu cuenta de TikTok admite videos de hasta 0:15.'),
  ).toBeInTheDocument();
});

it('cada red muestra su modo', async () => {
  const { user } = montar(TIKTOK_API);
  await elegirArchivo(user, 'vertical.mp4');
  expect(within(screen.getByRole('group', { name: 'Red TikTok' })).getByText('Por API')).toBeInTheDocument();
  expect(within(screen.getByRole('group', { name: 'Red Facebook' })).getByText('Manual')).toBeInTheDocument();
});
