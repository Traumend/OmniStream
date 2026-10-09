import { CAMPOS_TIKTOK_POR_DEFECTO, type CamposTiktok, type InfoCreadorTiktok } from '@omnistream/core';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { SeccionTiktok } from './SeccionTiktok';

const INFO: InfoCreadorTiktok = {
  nickname: 'Mi Canal',
  username: 'micanal',
  privacidades: ['PUBLIC_TO_EVERYONE', 'FOLLOWER_OF_CREATOR', 'SELF_ONLY'],
  comentariosDesactivados: false,
  duetDesactivado: false,
  stitchDesactivado: false,
  duracionMaximaSeg: 600,
};

function montar(props: Partial<Parameters<typeof SeccionTiktok>[0]> = {}) {
  const alCambiar = vi.fn();
  render(
    <SeccionTiktok
      info={INFO}
      cargando={false}
      error={null}
      valores={CAMPOS_TIKTOK_POR_DEFECTO}
      formato="tiktok"
      duracionSeg={30}
      alCambiar={alCambiar}
      {...props}
    />,
  );
  return { alCambiar };
}

const comercial = (cambios: Partial<CamposTiktok['commercial']>): CamposTiktok => ({
  ...CAMPOS_TIKTOK_POR_DEFECTO,
  commercial: { enabled: true, yourBrand: false, brandedContent: false, ...cambios },
});

it('muestra la cuenta que publicará', () => {
  montar();
  expect(screen.getByText('Publicará como Mi Canal (@micanal)')).toBeInTheDocument();
});

it('mientras consulta la cuenta lo indica', () => {
  montar({ info: null, cargando: true });
  expect(screen.getByText('Consultando tu cuenta de TikTok…')).toBeInTheDocument();
});

it('la privacidad no tiene valor por defecto y usa las opciones de la cuenta', async () => {
  const { alCambiar } = montar();
  const selector = screen.getByLabelText('¿Quién puede verlo?');
  expect(selector).toHaveValue('');
  expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
    'Elige una opción',
    'Todos',
    'Seguidores',
    'Solo yo',
  ]);
  await userEvent.selectOptions(selector, 'FOLLOWER_OF_CREATOR');
  expect(alCambiar).toHaveBeenCalledWith({ ...CAMPOS_TIKTOK_POR_DEFECTO, privacy: 'FOLLOWER_OF_CREATOR' });
});

it('Solo yo se deshabilita con contenido de marca', () => {
  montar({ valores: comercial({ brandedContent: true }) });
  expect(screen.getByRole('option', { name: 'Solo yo' })).toBeDisabled();
  expect(screen.getByText('El contenido de marca no puede ser privado.')).toBeInTheDocument();
});

it('las interacciones empiezan sin marcar', () => {
  montar();
  for (const nombre of ['Permitir comentarios', 'Permitir Duet', 'Permitir Stitch']) {
    expect(screen.getByLabelText(nombre)).not.toBeChecked();
  }
});

it('las interacciones desactivadas en la cuenta quedan deshabilitadas', () => {
  const { alCambiar } = montar({
    info: { ...INFO, comentariosDesactivados: true },
    valores: { ...CAMPOS_TIKTOK_POR_DEFECTO, allowComments: true },
  });
  const casilla = screen.getByLabelText('Permitir comentarios');
  expect(casilla).toBeDisabled();
  expect(casilla).not.toBeChecked();
  expect(screen.getByText('Desactivado en tu cuenta de TikTok.')).toBeInTheDocument();
  expect(alCambiar).toHaveBeenCalledWith({ ...CAMPOS_TIKTOK_POR_DEFECTO, allowComments: false });
});

it('en imagen solo se ofrece comentarios', () => {
  montar({ formato: 'imagen' });
  expect(screen.getByLabelText('Permitir comentarios')).toBeInTheDocument();
  expect(screen.queryByLabelText('Permitir Duet')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Permitir Stitch')).not.toBeInTheDocument();
});

it('el contenido comercial exige elegir una opción', async () => {
  const { alCambiar } = montar();
  await userEvent.click(screen.getByRole('switch', { name: 'Divulgar contenido comercial' }));
  expect(alCambiar).toHaveBeenCalledWith(comercial({}));
});

it('con el contenido comercial activo muestra sus opciones y el aviso', () => {
  montar({ valores: comercial({}) });
  expect(screen.getByLabelText('Tu marca')).toBeInTheDocument();
  expect(screen.getByText('Se etiquetará como «Contenido promocional».')).toBeInTheDocument();
  expect(screen.getByLabelText('Contenido de marca')).toBeInTheDocument();
  expect(screen.getByText('Se etiquetará como «Colaboración pagada».')).toBeInTheDocument();
  expect(screen.getByText('Indica si tu contenido te promociona a ti, a un tercero o a ambos.')).toBeInTheDocument();
});

it('la frase de consentimiento cambia con el contenido de marca', () => {
  const { unmount } = render(
    <SeccionTiktok
      info={INFO}
      cargando={false}
      error={null}
      valores={CAMPOS_TIKTOK_POR_DEFECTO}
      formato="tiktok"
      alCambiar={vi.fn()}
    />,
  );
  const musica = 'https://www.tiktok.com/legal/page/global/music-usage-confirmation/en';
  expect(screen.getByRole('link', { name: 'Confirmación de uso de música' })).toHaveAttribute('href', musica);
  expect(screen.queryByRole('link', { name: 'Política de contenido de marca' })).not.toBeInTheDocument();
  unmount();

  montar({ valores: comercial({ brandedContent: true }) });
  expect(screen.getByRole('link', { name: 'Política de contenido de marca' })).toHaveAttribute(
    'href',
    'https://www.tiktok.com/legal/page/global/bc-policy/en',
  );
  expect(screen.getByRole('link', { name: 'Confirmación de uso de música' })).toHaveAttribute('href', musica);
});

it('avisa si el video excede la duración de la cuenta', () => {
  montar({ duracionSeg: 700 });
  expect(screen.getByText('Tu cuenta de TikTok admite videos de hasta 10:00.')).toBeInTheDocument();
});

it('con error muestra el mensaje', () => {
  montar({ info: null, error: 'Vuelve a conectar TikTok.' });
  expect(screen.getByText('Vuelve a conectar TikTok.')).toBeInTheDocument();
});
