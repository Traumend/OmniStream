import type { Platform } from '@omnistream/core';
import { encolarPendientesAhora } from '@omnistream/functions/src/publicacion/encolarPendientes';
import { expect, it } from 'vitest';
import { adminDemo } from '../admin';
import { leerDestinoDe, sembrarPublicacion } from '../datos';

const { db } = adminDemo('encolarPendientes');
const leer = (postId: string, red: Platform) => leerDestinoDe(db, postId, red);

it('encola lo que entra en la ventana y recupera lo atascado', async () => {
  const ahora = new Date();
  const dias = (n: number) => new Date(ahora.getTime() + n * 86_400_000);
  const tiktok = { platform: 'tiktok', format: 'tiktok' } as const;
  const ids = {
    enVentana: await sembrarPublicacion(db, {
      destinos: [{ ...tiktok, status: 'programada', scheduleVersion: 1, scheduledAt: dias(10) }],
    }),
    lejana: await sembrarPublicacion(db, {
      destinos: [{ ...tiktok, status: 'programada', scheduleVersion: 1, scheduledAt: dias(40) }],
    }),
    yaEncolada: await sembrarPublicacion(db, {
      destinos: [{ ...tiktok, status: 'programada', scheduleVersion: 1, enqueuedVersion: 1, scheduledAt: dias(1) }],
    }),
    atascada: await sembrarPublicacion(db, {
      destinos: [
        {
          ...tiktok,
          status: 'publicando',
          scheduleVersion: 3,
          attempts: 2,
          scheduledAt: dias(-1),
          lease: { attemptId: 'x', until: dias(-0.01) },
        },
      ],
    }),
    enCurso: await sembrarPublicacion(db, {
      destinos: [
        {
          ...tiktok,
          status: 'publicando',
          scheduleVersion: 1,
          scheduledAt: dias(-1),
          lease: { attemptId: 'y', until: dias(0.01) },
        },
      ],
    }),
  };
  const llamadas: string[] = [];
  await encolarPendientesAhora({ db, ahora, encolar: async (_tarea, { id }) => void llamadas.push(id) });
  const propias = llamadas.filter((id) => Object.values(ids).some((p) => id.startsWith(p)));
  expect(propias.sort()).toEqual([`${ids.atascada}-tiktok-v3-r2`, `${ids.enVentana}-tiktok-v1`].sort());
  expect((await leer(ids.enVentana, 'tiktok')).enqueuedVersion).toBe(1);
});

it('un error al encolar un destino no detiene los demás', async () => {
  const ahora = new Date();
  const enUnaHora = new Date(ahora.getTime() + 3_600_000);
  const destino = {
    platform: 'tiktok',
    format: 'tiktok',
    status: 'programada',
    scheduleVersion: 1,
    scheduledAt: enUnaHora,
  } as const;
  const primero = await sembrarPublicacion(db, { destinos: [destino] });
  const segundo = await sembrarPublicacion(db, { destinos: [destino] });
  const encolados: string[] = [];
  await encolarPendientesAhora({
    db,
    ahora,
    encolar: async (_tarea, { id }) => {
      if (id.startsWith(primero)) throw new Error('cola caída');
      encolados.push(id);
    },
  });
  expect(encolados).toContain(`${segundo}-tiktok-v1`);
  expect((await leer(primero, 'tiktok')).enqueuedVersion).toBeUndefined();
});
