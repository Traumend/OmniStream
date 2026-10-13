import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import { estiloRecorte } from '@/lib/crear/recorteVisual';
import { MaquetaTelefono, textoCortado } from './MaquetaTelefono';

const medio = { tipo: 'video' as const, url: 'https://video.test/v.mp4' };

it('textoCortado corta por caracteres y avisa', () => {
  expect(textoCortado('abc', 5)).toEqual({ visible: 'abc', cortado: false });
  expect(textoCortado('abcdef', 5)).toEqual({ visible: 'abcde', cortado: true });
});

it('el texto largo se corta con ... más y se despliega', async () => {
  const user = userEvent.setup();
  const largo = 'x'.repeat(130);
  render(
    <MaquetaTelefono red="instagram" formato="reel" cuenta={{ nombre: 'Mi cuenta' }} medio={medio} texto={largo} />,
  );
  const region = screen.getByRole('region', { name: 'Vista previa en Instagram' });
  expect(region).toHaveTextContent('x'.repeat(125));
  expect(region).not.toHaveTextContent('x'.repeat(126));
  await user.click(screen.getByRole('button', { name: '... más' }));
  expect(region).toHaveTextContent(largo);
  expect(screen.queryByRole('button', { name: '... más' })).not.toBeInTheDocument();
});

it('la maqueta aplica el recorte de su red', () => {
  const crop = { aspect: '9:16', x: 0.25, y: 0, w: 0.5, h: 1 } as const;
  render(
    <MaquetaTelefono
      red="tiktok"
      formato="tiktok"
      cuenta={{ nombre: 'Tu cuenta' }}
      medio={medio}
      crop={crop}
      texto=""
    />,
  );
  const video = screen.getByLabelText('Video de la publicación');
  const estilo = estiloRecorte(crop);
  expect(video.style.width).toBe(estilo.width);
  expect(video.style.left).toBe(estilo.left);
  expect(video).toHaveProperty('muted', true);
  expect(video).toHaveAttribute('loop');
});

it('YouTube muestra el título completo y la descripción cortada a 100', () => {
  render(
    <MaquetaTelefono
      red="youtube"
      formato="short"
      cuenta={{ nombre: 'Canal' }}
      medio={medio}
      titulo="Un título bastante largo para el video"
      texto={'d'.repeat(120)}
    />,
  );
  const region = screen.getByRole('region', { name: 'Vista previa en YouTube' });
  expect(region).toHaveTextContent('Un título bastante largo para el video');
  expect(region).toHaveTextContent('d'.repeat(100));
  expect(region).not.toHaveTextContent('d'.repeat(101));
});
