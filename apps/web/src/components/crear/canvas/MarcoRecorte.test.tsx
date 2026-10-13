import { recorteCentrado, REGLAS, type Crop } from '@omnistream/core';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { MarcoRecorte } from './MarcoRecorte';

const reglaTiktok = REGLAS.tiktok.tiktok!;

function montar(props: Partial<Parameters<typeof MarcoRecorte>[0]> = {}) {
  const alCambiar = vi.fn<(crop: Crop | undefined) => void>();
  const user = userEvent.setup();
  render(
    <MarcoRecorte
      imagen="https://img.test/inicio.jpg"
      ancho={1920}
      alto={1080}
      regla={reglaTiktok}
      compatible={false}
      permitido
      alCambiar={alCambiar}
      {...props}
    />,
  );
  return { alCambiar, user };
}

const proporcion = (nombre: string) => screen.getByRole('button', { name: new RegExp(`^${nombre}`) });

it('elegir 9:16 coloca un recorte centrado', async () => {
  const { alCambiar, user } = montar();
  await user.click(proporcion('9:16'));
  expect(alCambiar).toHaveBeenCalledWith(recorteCentrado('9:16', 1920, 1080));
});

it('las flechas mueven el recorte y no salen del cuadro', () => {
  const crop = recorteCentrado('9:16', 1920, 1080);
  const alFinal = { ...crop, x: 1 - crop.w };
  const { alCambiar } = montar({ crop: alFinal });
  const recuadro = screen.getByRole('group', { name: 'Recorte' });
  fireEvent.keyDown(recuadro, { key: 'ArrowRight' });
  const derecha = alCambiar.mock.lastCall?.[0] as Crop;
  expect(derecha.x + derecha.w).toBeLessThanOrEqual(1);
  fireEvent.keyDown(recuadro, { key: 'ArrowLeft' });
  const izquierda = alCambiar.mock.lastCall?.[0] as Crop;
  expect(izquierda.x).toBeCloseTo(alFinal.x - 0.01, 6);
  expect(izquierda.w).toBe(alFinal.w);
});

it('Aplicar guía aparece solo con un archivo incompatible', async () => {
  const { alCambiar, user } = montar();
  await user.click(screen.getByRole('button', { name: 'Aplicar guía 9:16' }));
  expect(alCambiar).toHaveBeenCalledWith(recorteCentrado('9:16', 1920, 1080));
  document.body.innerHTML = '';
  montar({ compatible: true });
  expect(screen.queryByRole('button', { name: /Aplicar guía/ })).not.toBeInTheDocument();
});

it('Quitar recorte vuelve al original', async () => {
  const { alCambiar, user } = montar({ crop: recorteCentrado('9:16', 1920, 1080) });
  await user.click(screen.getByRole('button', { name: 'Quitar recorte' }));
  expect(alCambiar).toHaveBeenCalledWith(undefined);
});

it('las proporciones recomendadas están marcadas', () => {
  montar();
  expect(proporcion('9:16')).toHaveTextContent('Recomendada');
  expect(proporcion('16:9')).not.toHaveTextContent('Recomendada');
});

it('con un video de más de 15 minutos los controles se deshabilitan con el motivo', () => {
  montar({ permitido: false });
  expect(
    screen.getByText('El recorte de video se permite para videos de hasta 15 minutos y 2 GB.'),
  ).toBeInTheDocument();
  for (const nombre of ['16:9', '9:16', '1:1', '4:5', '1.91:1']) expect(proporcion(nombre)).toBeDisabled();
  expect(screen.queryByRole('button', { name: /Aplicar guía/ })).not.toBeInTheDocument();
});

it('Ampliar y Reducir escalan el recorte', async () => {
  const crop = { aspect: '1:1', x: 0.3, y: 0.3, w: 0.2, h: 0.3556 } as const;
  const { alCambiar, user } = montar({ crop });
  await user.click(screen.getByRole('button', { name: 'Ampliar' }));
  expect((alCambiar.mock.lastCall?.[0] as Crop).w).toBeCloseTo(0.22, 4);
  await user.click(screen.getByRole('button', { name: 'Reducir' }));
  expect((alCambiar.mock.lastCall?.[0] as Crop).w).toBeCloseTo(0.2 / 1.1, 4);
});

it('muestra el estado del derivado', () => {
  montar({ crop: recorteCentrado('9:16', 1920, 1080), estadoDerivado: 'generando' });
  expect(screen.getByText('Generando recorte…')).toBeInTheDocument();
});
