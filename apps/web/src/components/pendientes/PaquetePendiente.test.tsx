import { CAMPOS_YOUTUBE_POR_DEFECTO } from '@omnistream/core';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { expect, it, vi } from 'vitest';
import { destinoDePrueba, publicacionDePrueba } from './fixtures';
import { PaquetePendiente } from './PaquetePendiente';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function montar(props: Partial<Parameters<typeof PaquetePendiente>[0]> = {}) {
  const alMarcarPublicada = vi.fn().mockResolvedValue(undefined);
  const user = userEvent.setup();
  render(
    <PaquetePendiente
      publicacion={publicacionDePrueba()}
      destino={destinoDePrueba('instagram')}
      principal={null}
      zona="UTC"
      alMarcarPublicada={alMarcarPublicada}
      {...props}
    />,
  );
  return { alMarcarPublicada, user };
}

it('TikTok incluye la referencia al Principal en el texto final', () => {
  montar({
    publicacion: publicacionDePrueba({ kind: 'hija', parentId: 'p0' }),
    destino: destinoDePrueba('tiktok'),
    principal: publicacionDePrueba({ id: 'p0', kind: 'principal', title: 'Largo' }),
  });
  expect(screen.getByRole('heading', { name: 'Mi corto · TikTok' })).toBeInTheDocument();
  expect((screen.getByLabelText('Texto final') as HTMLTextAreaElement).value).toBe(
    'Hola\n\n#mar\n\nVideo completo en YouTube: «Largo»',
  );
});

it('YouTube muestra título, descripción, etiquetas, privacidad y miniatura', () => {
  montar({
    destino: destinoDePrueba('youtube', 'pendiente_manual', {
      youtube: {
        ...CAMPOS_YOUTUBE_POR_DEFECTO,
        description: 'Desc',
        tags: ['a', 'b'],
        privacy: 'unlisted',
        thumbnail: { frame: 'middle' },
      },
    }),
    urlMiniatura: 'https://ejemplo.test/m.jpg',
  });
  expect(screen.getByLabelText('Título')).toHaveValue('Mi corto');
  expect(screen.getByLabelText('Descripción')).toHaveValue('Desc\n\n#mar');
  expect(screen.getByLabelText('Etiquetas')).toHaveValue('a, b');
  expect(screen.getByText('No listada')).toBeInTheDocument();
  expect(screen.getByAltText('Miniatura')).toHaveAttribute('src', 'https://ejemplo.test/m.jpg');
});

it('ofrece descargar el archivo', () => {
  montar({ urlDescarga: 'https://ejemplo.test/video.mp4' });
  const enlace = screen.getByRole('link', { name: 'Descargar archivo' });
  expect(enlace).toHaveAttribute('href', 'https://ejemplo.test/video.mp4');
  expect(enlace).toHaveAttribute('download');
});

it('mientras se prepara la descarga no dice que el archivo falta', () => {
  montar({ preparandoDescarga: true });
  expect(screen.getByText('Preparando la descarga…')).toBeInTheDocument();
  expect(screen.queryByText('El archivo ya no está disponible.')).not.toBeInTheDocument();
});

it('sin enlace de descarga avisa que el archivo no está disponible', () => {
  montar();
  expect(screen.getByText('El archivo ya no está disponible.')).toBeInTheDocument();
});

it('rechaza una URL de otra red sin llamar al servidor', async () => {
  const { alMarcarPublicada, user } = montar();
  await user.type(screen.getByLabelText('URL publicada'), 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  await user.click(screen.getByRole('button', { name: 'Marcar como publicada' }));
  expect(screen.getByText('La URL no corresponde a una publicación de Instagram.')).toBeInTheDocument();
  expect(alMarcarPublicada).not.toHaveBeenCalled();
});

it('marca publicada con una URL válida', async () => {
  const { alMarcarPublicada, user } = montar();
  await user.type(screen.getByLabelText('URL publicada'), ' https://www.instagram.com/reel/C1a2B3c4D5e/ ');
  await user.click(screen.getByRole('button', { name: 'Marcar como publicada' }));
  expect(alMarcarPublicada).toHaveBeenCalledWith('https://www.instagram.com/reel/C1a2B3c4D5e/');
});

it('copia el texto final', async () => {
  const { user } = montar();
  await user.click(screen.getByRole('button', { name: 'Copiar texto' }));
  expect(await navigator.clipboard.readText()).toBe('Hola\n\n#mar');
  expect(toast.success).toHaveBeenCalledWith('Copiado');
});
