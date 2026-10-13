import { leerConexion, type Asset, type Destino, type InfoCreadorTiktok, type Publicacion } from '@omnistream/core';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { PasosCreacion } from './PasosCreacion';

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
const destinoTiktok = (status: Destino['status']): Destino => ({
  platform: 'tiktok',
  format: 'tiktok',
  overrides: {},
  scheduleVersion: 1,
  publishMode: 'manual',
  status,
  statusChangedAt: new Date(),
  parentRef: { status: 'no_aplica' },
  attempts: 0,
});

type Props = Parameters<typeof PasosCreacion>[0];

function montar(props: Partial<Props> = {}) {
  const alEnviar = vi.fn().mockResolvedValue(undefined);
  const alGuardarBorrador = vi.fn().mockResolvedValue({ postId: 'nuevo' });
  const user = userEvent.setup();
  render(
    <PasosCreacion
      zona="America/Mexico_City"
      archivos={[base, baja]}
      principales={[]}
      ahora={() => new Date('2026-10-07T12:00:00Z')}
      alEnviar={alEnviar}
      alGuardarBorrador={alGuardarBorrador}
      retardoAutoguardadoMs={10}
      {...props}
    />,
  );
  return { alEnviar, alGuardarBorrador, user };
}

type Usuario = ReturnType<typeof userEvent.setup>;
const pasos = () => screen.getByRole('navigation', { name: 'Pasos' });
const irA = (user: Usuario, paso: string) => user.click(within(pasos()).getByRole('button', { name: paso }));

async function elegirArchivo(user: Usuario, nombre: string) {
  await irA(user, 'Archivo');
  await user.click(screen.getByRole('radio', { name: new RegExp(nombre) }));
}

async function escribirTitulo(user: Usuario, titulo: string) {
  await irA(user, 'Contenido');
  await user.type(screen.getByLabelText('Título'), titulo);
}

async function ponerFecha(user: Usuario) {
  await irA(user, 'Publicar');
  fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2026-10-08' } });
  fireEvent.change(screen.getByLabelText('Hora'), { target: { value: '10:30' } });
}

it('sin archivo solo Archivo está habilitado', () => {
  montar();
  expect(within(pasos()).getByRole('button', { name: 'Archivo' })).toBeEnabled();
  expect(within(pasos()).getByRole('button', { name: 'Archivo' })).toHaveAttribute('aria-current', 'step');
  for (const paso of ['Destinos', 'Canvas', 'Contenido', 'Vista previa', 'Publicar']) {
    expect(within(pasos()).getByRole('button', { name: paso })).toBeDisabled();
  }
});

it('con archivo se navega libremente entre los pasos', async () => {
  const { user } = montar();
  await elegirArchivo(user, 'vertical.mp4');
  await irA(user, 'Publicar');
  expect(within(pasos()).getByRole('button', { name: 'Publicar' })).toHaveAttribute('aria-current', 'step');
  expect(screen.getByLabelText('Fecha')).toBeInTheDocument();
  await irA(user, 'Destinos');
  expect(screen.getByRole('checkbox', { name: 'TikTok' })).toBeInTheDocument();
  expect(window.location.search).toBe('?paso=destinos');
});

it('un borrador con título se autoguarda', async () => {
  const { user, alGuardarBorrador } = montar();
  await elegirArchivo(user, 'vertical.mp4');
  await escribirTitulo(user, 'Hola');
  await waitFor(() => expect(alGuardarBorrador).toHaveBeenCalled());
  expect(alGuardarBorrador.mock.lastCall?.[0]).toMatchObject({ title: 'Hola', assetId: 'a1' });
  expect(await screen.findByText('Guardado')).toBeInTheDocument();
  // El primer guardado deja el id en la URL de Crear, sin cambiar de ruta ni volver a montar el editor.
  expect(new URLSearchParams(window.location.search).get('id')).toBe('nuevo');
  expect(window.location.pathname).not.toMatch(/^\/publicaciones\//);
});

it('una publicación programada no se autoguarda y ofrece Guardar cambios', async () => {
  const { user, alGuardarBorrador } = montar({
    inicial: {
      publicacion: { ...principal, kind: 'independiente', id: 'p2', assetId: 'a1', title: 'Ya programada' },
      destinos: [destinoTiktok('programada')],
      hijas: 0,
    },
  });
  await escribirTitulo(user, ' más');
  await new Promise((r) => setTimeout(r, 50));
  expect(alGuardarBorrador).not.toHaveBeenCalled();
  await irA(user, 'Publicar');
  expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeInTheDocument();
});

it('sin título no se autoguarda', async () => {
  const { user, alGuardarBorrador } = montar();
  await elegirArchivo(user, 'vertical.mp4');
  await irA(user, 'Destinos');
  await user.click(screen.getByRole('checkbox', { name: 'TikTok' }));
  await new Promise((r) => setTimeout(r, 50));
  expect(alGuardarBorrador).not.toHaveBeenCalled();
});

it('al elegir un archivo sugiere las redes', async () => {
  const { user } = montar();
  await elegirArchivo(user, 'vertical.mp4');
  await irA(user, 'Destinos');
  for (const red of ['Facebook', 'Instagram', 'YouTube', 'TikTok']) {
    expect(screen.getByRole('checkbox', { name: red })).toBeChecked();
  }
  expect(screen.getByRole('combobox', { name: 'Formato en YouTube' })).toHaveValue('short');
  expect(screen.getByRole('combobox', { name: 'Formato en Facebook' })).toHaveValue('reel');
});

it('muestra el contador por red y marca el exceso', async () => {
  const { user } = montar();
  await elegirArchivo(user, 'vertical.mp4');
  await irA(user, 'Contenido');
  fireEvent.change(screen.getByLabelText('Texto'), { target: { value: 'a'.repeat(2201) } });
  const contador = screen.getByText('Instagram: 2201 / 2200');
  expect(contador).toHaveAttribute('data-excedido', 'true');
  expect(contador).toHaveClass('text-peligro');
});

it('bloquea Programar con errores y los lista', async () => {
  const { user, alEnviar } = montar();
  await elegirArchivo(user, 'vertical.mp4');
  await escribirTitulo(user, 'Hola');
  await irA(user, 'Publicar');
  await user.click(screen.getByRole('button', { name: 'Programar' }));
  expect(within(screen.getByRole('alert')).getByText('Elige la fecha y la hora.')).toBeInTheDocument();
  expect(alEnviar).not.toHaveBeenCalled();
});

it('pide confirmación y muestra las advertencias', async () => {
  const { user, alEnviar } = montar();
  await elegirArchivo(user, 'baja.mp4');
  await escribirTitulo(user, 'Hola');
  await ponerFecha(user);
  await user.click(screen.getByRole('button', { name: 'Programar' }));
  const dialogo = await screen.findByRole('dialog');
  expect(within(dialogo).getByText('La resolución es menor a 720p.')).toBeInTheDocument();
  await user.click(within(dialogo).getByRole('button', { name: 'Confirmar' }));
  await waitFor(() =>
    expect(alEnviar).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Hola', assetId: 'a2', scheduledAt: '2026-10-08T16:30:00.000Z' }),
      'programar',
    ),
  );
});

it('ofrece los principales para videos cortos', async () => {
  const { user, alEnviar } = montar({ principales: [{ publicacion: principal, hijas: 2 }] });
  await elegirArchivo(user, 'vertical.mp4');
  await escribirTitulo(user, 'Hola');
  await irA(user, 'Destinos');
  const selector = screen.getByRole('combobox', { name: '¿Pertenece a un video principal?' });
  expect(within(selector).getByRole('option', { name: 'Mi video largo (2 Hijas)' })).toBeInTheDocument();
  await user.selectOptions(selector, 'p1');
  await irA(user, 'Publicar');
  await user.click(screen.getByRole('button', { name: 'Guardar borrador' }));
  await waitFor(() => expect(alEnviar).toHaveBeenCalledWith(expect.objectContaining({ parentId: 'p1' }), 'guardar'));
});

it('con video largo de YouTube anuncia que será Principal y oculta el selector', async () => {
  const { user } = montar({ principales: [{ publicacion: principal, hijas: 1 }] });
  await elegirArchivo(user, 'vertical.mp4');
  await irA(user, 'Destinos');
  await user.selectOptions(screen.getByRole('combobox', { name: 'Formato en YouTube' }), 'video_largo');
  expect(screen.getByText('Esta publicación será un video Principal.')).toBeInTheDocument();
  expect(screen.queryByRole('combobox', { name: '¿Pertenece a un video principal?' })).not.toBeInTheDocument();
});

it('muestra los campos de YouTube solo con YouTube elegido', async () => {
  const { user } = montar();
  await elegirArchivo(user, 'vertical.mp4');
  await irA(user, 'Destinos');
  await user.click(screen.getByRole('checkbox', { name: 'YouTube' }));
  await irA(user, 'Contenido');
  expect(screen.queryByLabelText('Descripción de YouTube')).not.toBeInTheDocument();
  await irA(user, 'Destinos');
  await user.click(screen.getByRole('checkbox', { name: 'YouTube' }));
  await irA(user, 'Contenido');
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
  await elegirArchivo(user, 'vertical.mp4');
  await escribirTitulo(user, 'Hola');
  await irA(user, 'Publicar');
  await user.click(screen.getByRole('button', { name: 'Guardar borrador' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await waitFor(() =>
    expect(alEnviar).toHaveBeenCalledWith(expect.objectContaining({ title: 'Hola', scheduledAt: null }), 'guardar'),
  );
});

it('una publicación programada ofrece Guardar cambios y no Programar', async () => {
  const { user } = montar({
    inicial: {
      publicacion: { ...principal, kind: 'independiente', id: 'p2', assetId: 'a1', title: 'Ya programada' },
      destinos: [destinoTiktok('programada')],
      hijas: 0,
    },
  });
  await irA(user, 'Publicar');
  expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Programar' })).not.toBeInTheDocument();
  await irA(user, 'Contenido');
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
  await irA(user, 'Contenido');
  expect(screen.queryByRole('region', { name: 'TikTok' })).not.toBeInTheDocument();
});

it('con TikTok por API muestra su sección', async () => {
  const { user } = montar(TIKTOK_API);
  await elegirArchivo(user, 'vertical.mp4');
  await irA(user, 'Contenido');
  expect(screen.getByRole('region', { name: 'TikTok' })).toBeInTheDocument();
  expect(screen.getByText('Publicará como Mi Canal (@micanal)')).toBeInTheDocument();
});

it('Programar sin privacidad de TikTok por API muestra el error y no confirma', async () => {
  const { user, alEnviar } = montar(TIKTOK_API);
  await elegirArchivo(user, 'vertical.mp4');
  await escribirTitulo(user, 'Hola');
  await ponerFecha(user);
  await user.click(screen.getByRole('button', { name: 'Programar' }));
  expect(
    within(screen.getByRole('alert')).getByText('Elige quién puede ver la publicación en TikTok.'),
  ).toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

  await irA(user, 'Contenido');
  await user.selectOptions(screen.getByLabelText('¿Quién puede verlo?'), 'PUBLIC_TO_EVERYONE');
  await irA(user, 'Publicar');
  await user.click(screen.getByRole('button', { name: 'Programar' }));
  await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Confirmar' }));
  await waitFor(() => expect(alEnviar).toHaveBeenCalled());
  expect(alEnviar.mock.calls[0]?.[0].destinos).toContainEqual(
    expect.objectContaining({ platform: 'tiktok', tiktok: expect.objectContaining({ privacy: 'PUBLIC_TO_EVERYONE' }) }),
  );
});

it('la duración máxima de la cuenta de TikTok bloquea el envío', async () => {
  const { user } = montar({
    ...TIKTOK_API,
    infoTiktok: { ...TIKTOK_API.infoTiktok, info: { ...INFO_TIKTOK, duracionMaximaSeg: 15 } },
  });
  await elegirArchivo(user, 'vertical.mp4');
  await escribirTitulo(user, 'Hola');
  await irA(user, 'Publicar');
  await user.click(screen.getByRole('button', { name: 'Publicar ahora' }));
  expect(
    within(screen.getByRole('alert')).getByText('Tu cuenta de TikTok admite videos de hasta 0:15.'),
  ).toBeInTheDocument();
});

it('cada red muestra su modo', async () => {
  const { user } = montar(TIKTOK_API);
  await elegirArchivo(user, 'vertical.mp4');
  await irA(user, 'Destinos');
  expect(within(screen.getByRole('group', { name: 'Red TikTok' })).getByText('Por API')).toBeInTheDocument();
  expect(within(screen.getByRole('group', { name: 'Red Facebook' })).getByText('Manual')).toBeInTheDocument();
});

it('el recorte del canvas se guarda en los ajustes de su red y cambia su indicador', async () => {
  const horizontal: Asset = {
    ...base,
    id: 'a3',
    originalName: 'horizontal.mp4',
    width: 3840,
    height: 2160,
    aspect: 16 / 9,
  };
  const { user, alGuardarBorrador } = montar({ archivos: [horizontal] });
  await elegirArchivo(user, 'horizontal.mp4');
  await escribirTitulo(user, 'Hola');
  await irA(user, 'Destinos');
  for (const red of ['Facebook', 'Instagram', 'YouTube']) {
    const casilla = screen.getByRole('checkbox', { name: red });
    if ((casilla as HTMLInputElement).checked) await user.click(casilla);
  }
  if (!(screen.getByRole('checkbox', { name: 'TikTok' }) as HTMLInputElement).checked) {
    await user.click(screen.getByRole('checkbox', { name: 'TikTok' }));
  }
  await irA(user, 'Canvas');
  const redes = screen.getByRole('list', { name: 'Redes' });
  expect(within(redes).getByText('Advertencia')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Aplicar guía 9:16' }));
  expect(within(redes).getByText('Correcto')).toBeInTheDocument();
  expect(within(redes).getByText('Personalizado')).toBeInTheDocument();
  await waitFor(() =>
    expect(alGuardarBorrador.mock.lastCall?.[0].destinos).toContainEqual(
      expect.objectContaining({ platform: 'tiktok', overrides: { crop: expect.objectContaining({ aspect: '9:16' }) } }),
    ),
  );
});

it('los contadores usan el texto propio de cada red', async () => {
  const { user } = montar({
    inicial: {
      publicacion: {
        ...principal,
        kind: 'independiente',
        id: 'p3',
        status: 'borrador',
        assetId: 'a1',
        base: { text: 'Hola mundo', hashtags: [] },
      },
      destinos: [
        { ...destinoTiktok('borrador'), overrides: { text: 'abc' } },
        { ...destinoTiktok('borrador'), platform: 'instagram', format: 'reel' },
      ],
      hijas: 0,
    },
  });
  await irA(user, 'Contenido');
  expect(screen.getByText('TikTok: 3 / 2200')).toBeInTheDocument();
  expect(screen.getByText('Instagram: 10 / 2200')).toBeInTheDocument();
});

it('la miniatura propia elige una imagen de la Biblioteca y va como thumbnail.assetId', async () => {
  const imagen: Asset = {
    ...base,
    id: 'img1',
    kind: 'image',
    originalName: 'portada.jpg',
    mimeType: 'image/jpeg',
    durationSec: undefined,
  };
  const { user, alEnviar } = montar({ archivos: [base, imagen] });
  await elegirArchivo(user, 'vertical.mp4');
  await escribirTitulo(user, 'Hola');
  await user.click(screen.getByRole('radio', { name: 'Imagen propia' }));
  await user.selectOptions(screen.getByLabelText('Imagen de la Biblioteca'), 'img1');
  await irA(user, 'Publicar');
  await user.click(screen.getByRole('button', { name: 'Guardar borrador' }));
  await waitFor(() => expect(alEnviar).toHaveBeenCalled());
  expect(alEnviar.mock.calls[0]?.[0].destinos).toContainEqual(
    expect.objectContaining({
      platform: 'youtube',
      youtube: expect.objectContaining({ thumbnail: { assetId: 'img1' } }),
    }),
  );
});

it('Programar guarda lo pendiente antes de programar', async () => {
  const { user, alEnviar, alGuardarBorrador } = montar({ retardoAutoguardadoMs: 60_000 });
  await elegirArchivo(user, 'vertical.mp4');
  await escribirTitulo(user, 'Hola');
  await ponerFecha(user);
  expect(alGuardarBorrador).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Programar' }));
  await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Confirmar' }));
  await waitFor(() => expect(alEnviar).toHaveBeenCalled());
  expect(alGuardarBorrador).toHaveBeenCalledTimes(1);
  expect(alGuardarBorrador.mock.invocationCallOrder[0]).toBeLessThan(alEnviar.mock.invocationCallOrder[0] as number);
  expect(alEnviar).toHaveBeenCalledWith(expect.objectContaining({ postId: 'nuevo' }), 'programar');
});

it('cambiar de archivo quita los recortes de cada red', async () => {
  const horizontal: Asset = {
    ...base,
    id: 'a3',
    originalName: 'horizontal.mp4',
    width: 3840,
    height: 2160,
    aspect: 16 / 9,
  };
  const { user, alEnviar } = montar({ archivos: [horizontal, base] });
  await elegirArchivo(user, 'horizontal.mp4');
  await escribirTitulo(user, 'Hola');
  await irA(user, 'Destinos');
  const casillaTiktok = screen.getByRole('checkbox', { name: 'TikTok' }) as HTMLInputElement;
  if (!casillaTiktok.checked) await user.click(casillaTiktok);
  await irA(user, 'Canvas');
  await user.click(within(screen.getByRole('list', { name: 'Redes' })).getByRole('button', { name: /^TikTok/ }));
  await user.click(screen.getByRole('button', { name: 'Aplicar guía 9:16' }));
  await elegirArchivo(user, 'vertical.mp4');
  await irA(user, 'Publicar');
  await user.click(screen.getByRole('button', { name: 'Guardar borrador' }));
  await waitFor(() => expect(alEnviar).toHaveBeenCalled());
  const tiktok = alEnviar.mock.calls[0]?.[0].destinos.find((d: { platform: string }) => d.platform === 'tiktok');
  expect(tiktok?.overrides?.crop).toBeUndefined();
});
