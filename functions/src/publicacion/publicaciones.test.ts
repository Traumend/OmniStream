import { describe, expect, it, vi } from 'vitest';
import { despacharAccion } from './publicaciones';

const owner = { token: { owner: true } };

describe('despacharAccion', () => {
  it('sin sesión responde unauthenticated', async () => {
    await expect(despacharAccion(undefined, {}, {})).rejects.toMatchObject({ code: 'unauthenticated' });
  });
  it('sin claim owner responde permission-denied', async () => {
    await expect(despacharAccion({ token: {} }, {}, {})).rejects.toMatchObject({ code: 'permission-denied' });
  });
  it('datos inválidos responden invalid-argument con el mensaje del esquema', async () => {
    const datos = {
      accion: 'guardar',
      publicacion: {
        title: '',
        assetId: null,
        base: { text: '', hashtags: [] },
        scheduledAt: null,
        parentId: null,
        destinos: [],
      },
    };
    await expect(despacharAccion(owner, datos, {})).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'Escribe un título',
    });
  });
  it('despacha a la acción indicada', async () => {
    const cancelar = vi.fn().mockResolvedValue({ postId: 'p1' });
    await expect(despacharAccion(owner, { accion: 'cancelar', postId: 'p1' }, { cancelar })).resolves.toEqual({
      postId: 'p1',
    });
    expect(cancelar).toHaveBeenCalledWith({ accion: 'cancelar', postId: 'p1' });
  });
  it('una acción sin manejador responde unimplemented', async () => {
    await expect(despacharAccion(owner, { accion: 'cancelar', postId: 'p1' }, {})).rejects.toMatchObject({
      code: 'unimplemented',
    });
  });
});
