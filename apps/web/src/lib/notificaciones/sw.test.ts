import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, expect, it, vi } from 'vitest';

const codigo = readFileSync(resolve(__dirname, '../../../public/sw-notificaciones.js'), 'utf8');

type Manejador = (evento: Record<string, unknown>) => void;

let manejadores: Record<string, Manejador>;
let sw: {
  addEventListener(tipo: string, manejador: Manejador): void;
  registration: { showNotification: ReturnType<typeof vi.fn> };
  clients: {
    matchAll: ReturnType<typeof vi.fn>;
    openWindow: ReturnType<typeof vi.fn>;
    claim: ReturnType<typeof vi.fn>;
  };
  skipWaiting: ReturnType<typeof vi.fn>;
  location: { origin: string };
};

beforeEach(() => {
  manejadores = {};
  sw = {
    addEventListener: (tipo, manejador) => {
      manejadores[tipo] = manejador;
    },
    registration: { showNotification: vi.fn().mockResolvedValue(undefined) },
    clients: {
      matchAll: vi.fn().mockResolvedValue([]),
      openWindow: vi.fn().mockResolvedValue(null),
      claim: vi.fn().mockResolvedValue(undefined),
    },
    skipWaiting: vi.fn().mockResolvedValue(undefined),
    location: { origin: 'https://omnistream.test' },
  };
  new Function('self', codigo)(sw);
});

async function despachar(tipo: string, evento: Record<string, unknown>) {
  const pendientes: Promise<unknown>[] = [];
  manejadores[tipo]?.({ ...evento, waitUntil: (promesa: Promise<unknown>) => pendientes.push(promesa) });
  await Promise.all(pendientes);
}

const aviso = { titulo: 'Publicación pendiente', cuerpo: 'Mi corto · TikTok', enlace: '/pendientes/p1/tiktok' };

it('muestra el aviso con los datos del mensaje', async () => {
  await despachar('push', { data: { json: () => ({ data: aviso, from: '123' }) } });
  expect(sw.registration.showNotification).toHaveBeenCalledWith('Publicación pendiente', {
    body: 'Mi corto · TikTok',
    data: { enlace: '/pendientes/p1/tiktok' },
    icon: '/icono.svg',
  });
});

it('sin datos legibles muestra un aviso genérico', async () => {
  await despachar('push', {
    data: {
      json: () => {
        throw new SyntaxError('no es JSON');
      },
    },
  });
  expect(sw.registration.showNotification).toHaveBeenCalledWith('OmniStream', {
    body: 'Hay novedades en tus publicaciones.',
    data: { enlace: '/pendientes' },
    icon: '/icono.svg',
  });
});

it('al tocar el aviso abre el enlace', async () => {
  const close = vi.fn();
  await despachar('notificationclick', { notification: { close, data: { enlace: '/pendientes/p1/tiktok' } } });
  expect(close).toHaveBeenCalled();
  expect(sw.clients.openWindow).toHaveBeenCalledWith('/pendientes/p1/tiktok');
});

it('si la app ya está abierta, la lleva al enlace y la enfoca', async () => {
  const ventana = {
    url: 'https://omnistream.test/calendario',
    navigate: vi.fn().mockResolvedValue(undefined),
    focus: vi.fn().mockResolvedValue(undefined),
  };
  sw.clients.matchAll.mockResolvedValue([ventana]);
  await despachar('notificationclick', { notification: { close: vi.fn(), data: { enlace: '/pendientes/p1/tiktok' } } });
  expect(ventana.navigate).toHaveBeenCalledWith('/pendientes/p1/tiktok');
  expect(ventana.focus).toHaveBeenCalled();
  expect(sw.clients.openWindow).not.toHaveBeenCalled();
});

it('si no puede llevar la ventana abierta al enlace, abre una nueva', async () => {
  const ventana = {
    url: 'https://omnistream.test/calendario',
    navigate: vi.fn().mockRejectedValue(new TypeError('no controlada')),
    focus: vi.fn(),
  };
  sw.clients.matchAll.mockResolvedValue([ventana]);
  await despachar('notificationclick', { notification: { close: vi.fn(), data: { enlace: '/pendientes/p1/tiktok' } } });
  expect(sw.clients.openWindow).toHaveBeenCalledWith('/pendientes/p1/tiktok');
});
