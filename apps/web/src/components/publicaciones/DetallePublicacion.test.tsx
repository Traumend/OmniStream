import type { Asset, Destino, EstadoDestino, Platform, Publicacion } from '@omnistream/core';
import { formatearFechaHora } from '@omnistream/core';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { DetallePublicacion } from './DetallePublicacion';

const ahora = () => new Date('2026-10-07T12:00:00Z');
const publicacion: Publicacion = {
  id: 'p1',
  kind: 'independiente',
  status: 'borrador',
  title: 'Mi corto',
  assetId: 'a1',
  base: { text: 'Hola', hashtags: [] },
  scheduledAt: new Date('2026-10-08T16:30:00Z'),
  targetStatus: {},
  createdAt: new Date('2026-10-01T00:00:00Z'),
  updatedAt: new Date('2026-10-01T00:00:00Z'),
};
const asset: Asset = {
  id: 'a1',
  kind: 'video',
  source: 'subida',
  originalName: 'corto.mp4',
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
const destino = (platform: Platform, status: EstadoDestino, extra: Partial<Destino> = {}): Destino => ({
  platform,
  format: platform === 'youtube' ? 'short' : platform === 'tiktok' ? 'tiktok' : 'reel',
  overrides: {},
  scheduleVersion: 1,
  publishMode: 'manual',
  status,
  statusChangedAt: new Date('2026-10-07T10:00:00Z'),
  scheduledAt: new Date('2026-10-08T16:30:00Z'),
  parentRef: { status: 'no_aplica' },
  attempts: 0,
  ...extra,
});

function montar(props: Partial<Parameters<typeof DetallePublicacion>[0]> = {}) {
  const alAccion = vi.fn().mockResolvedValue(undefined);
  const user = userEvent.setup();
  render(
    <DetallePublicacion
      publicacion={publicacion}
      destinos={[destino('tiktok', 'borrador')]}
      principal={null}
      hijas={[]}
      intentos={{}}
      zona="America/Mexico_City"
      asset={asset}
      ahora={ahora}
      alAccion={alAccion}
      {...props}
    />,
  );
  return { alAccion, user };
}

it('un borrador con fecha ofrece Editar, Programar, Publicar ahora y Eliminar', () => {
  montar();
  expect(screen.getByRole('link', { name: 'Editar' })).toHaveAttribute('href', '/publicaciones/p1/editar');
  for (const nombre of ['Programar', 'Publicar ahora', 'Eliminar']) {
    expect(screen.getByRole('button', { name: nombre })).toBeInTheDocument();
  }
});

it('programada ofrece Cancelar publicación y no Programar', () => {
  montar({ publicacion: { ...publicacion, status: 'programada' }, destinos: [destino('tiktok', 'programada')] });
  expect(screen.getByRole('button', { name: 'Cancelar publicación' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Programar' })).not.toBeInTheDocument();
});

it('Publicar ahora pide confirmación y programa de inmediato', async () => {
  const { alAccion, user } = montar();
  await user.click(screen.getByRole('button', { name: 'Publicar ahora' }));
  const dialogo = await screen.findByRole('dialog');
  await user.click(within(dialogo).getByRole('button', { name: 'Confirmar' }));
  expect(alAccion).toHaveBeenCalledWith({ accion: 'programar', postId: 'p1', inmediata: true });
});

it('un destino fallido muestra su error y Reintentar', async () => {
  const fallido = destino('tiktok', 'fallida', {
    lastError: { code: 'sin_conector', message: 'Sin conector.', kind: 'definitivo', at: new Date() },
  });
  const { alAccion, user } = montar({ publicacion: { ...publicacion, status: 'fallida' }, destinos: [fallido] });
  const region = screen.getByRole('region', { name: 'TikTok' });
  expect(within(region).getByText('Sin conector.')).toBeInTheDocument();
  await user.click(within(region).getByRole('button', { name: 'Reintentar' }));
  expect(alAccion).toHaveBeenCalledWith({ accion: 'reintentar', postId: 'p1', platform: 'tiktok' });
});

it('un destino pendiente enlaza a su paquete', () => {
  montar({ destinos: [destino('instagram', 'pendiente_manual')] });
  const region = screen.getByRole('region', { name: 'Instagram' });
  expect(within(region).getByRole('link', { name: 'Abrir paquete' })).toHaveAttribute(
    'href',
    '/pendientes/p1/instagram',
  );
});

it('un destino publicado enlaza a la publicación en la red', () => {
  const url = 'https://www.tiktok.com/@cuenta/video/7300000000000000001';
  montar({
    destinos: [destino('tiktok', 'publicada', { remote: { id: '7300000000000000001', url, publishedAt: new Date() } })],
  });
  const enlace = screen.getByRole('link', { name: 'Ver publicación' });
  expect(enlace).toHaveAttribute('href', url);
  expect(enlace).toHaveAttribute('target', '_blank');
});

it('Eliminar pide confirmación', async () => {
  const { alAccion, user } = montar();
  await user.click(screen.getByRole('button', { name: 'Eliminar' }));
  const dialogo = await screen.findByRole('dialog', { name: '¿Eliminar esta publicación?' });
  await user.click(within(dialogo).getByRole('button', { name: 'Eliminar' }));
  expect(alAccion).toHaveBeenCalledWith({ accion: 'eliminar', postId: 'p1' });
});

it('un Principal lista sus Hijas', () => {
  const hija: Publicacion = { ...publicacion, id: 'h1', kind: 'hija', parentId: 'p1', title: 'Fragmento 1' };
  montar({ publicacion: { ...publicacion, kind: 'principal' }, hijas: [hija] });
  const seccion = screen.getByRole('region', { name: 'Hijas' });
  expect(within(seccion).getByRole('link', { name: /Fragmento 1/ })).toHaveAttribute('href', '/publicaciones/h1');
});

it('sin archivo disponible, Publicar ahora muestra el error y no confirma', async () => {
  const { alAccion, user } = montar({ asset: null });
  await user.click(screen.getByRole('button', { name: 'Publicar ahora' }));
  expect(within(screen.getByRole('alert')).getByText('El archivo ya no está disponible.')).toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(alAccion).not.toHaveBeenCalled();
});

it('una Hija enlaza a su Principal y se puede desvincular', async () => {
  const principal: Publicacion = { ...publicacion, id: 'p0', kind: 'principal', title: 'Video largo' };
  const { alAccion, user } = montar({
    publicacion: { ...publicacion, kind: 'hija', parentId: 'p0' },
    destinos: [destino('instagram', 'publicada', { parentRef: { status: 'en_espera' } })],
    principal,
  });
  expect(screen.getByRole('link', { name: 'Video largo' })).toHaveAttribute('href', '/publicaciones/p0');
  expect(screen.getByText('La referencia se habilitará cuando se publique el video principal.')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Desvincular del principal' }));
  expect(alAccion).toHaveBeenCalledWith({ accion: 'desvincular', postId: 'p1' });
});

it('muestra los intentos de cada destino', () => {
  const at = new Date('2026-10-07T18:05:00Z');
  montar({
    destinos: [destino('tiktok', 'pendiente_manual')],
    intentos: { tiktok: [{ id: 'i1', at, stage: 'manual', result: 'ok' }] },
  });
  const intentos = within(screen.getByRole('region', { name: 'TikTok' })).getByRole('list', { name: 'Intentos' });
  expect(
    within(intentos).getByText(formatearFechaHora(at, 'America/Mexico_City'), { exact: false }),
  ).toBeInTheDocument();
  expect(within(intentos).getByText(/manual/)).toBeInTheDocument();
});
