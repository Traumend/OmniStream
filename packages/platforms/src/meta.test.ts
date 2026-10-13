import { describe, expect, it } from 'vitest';
import { clasificarMeta, crearOAuthMeta, GRAPH } from './meta';
import { fetchGrabado, type Intercambio } from './prueba/fetchGrabado';

const oauth = (intercambios: Intercambio[]) =>
  crearOAuthMeta({ appId: 'app', appSecret: 'sec', configId: 'cfg', http: fetchGrabado(intercambios) });
const ok = (json: unknown) => ({ status: 200, json });
const pagina = (extra: object = {}) => ({
  id: '111',
  name: 'Mi página',
  access_token: 'EAAP',
  picture: { data: { url: 'https://img.test/p' } },
  ...extra,
});
const canje = (paginas: object[]): Intercambio[] => [
  {
    metodo: 'GET',
    url: /\/oauth\/access_token\?client_id=app&redirect_uri=.*&client_secret=sec&code=c$/,
    respuesta: ok({ access_token: 'corto', expires_in: 3600 }),
  },
  {
    metodo: 'GET',
    url: /\/oauth\/access_token\?grant_type=fb_exchange_token&client_id=app&client_secret=sec&fb_exchange_token=corto$/,
    respuesta: ok({ access_token: 'largo' }),
  },
  {
    metodo: 'GET',
    url: `${GRAPH}/me/permissions`,
    revisar: ({ headers }) => expect(headers.get('Authorization')).toBe('Bearer largo'),
    respuesta: ok({
      data: [
        { permission: 'pages_manage_posts', status: 'granted' },
        { permission: 'instagram_content_publish', status: 'granted' },
        { permission: 'read_insights', status: 'declined' },
      ],
    }),
  },
  { metodo: 'GET', url: /\/me\/accounts\?fields=/, respuesta: ok({ data: paginas }) },
];

describe('OAuth de Meta', () => {
  it('la URL de autorización usa config_id y la versión v26.0', () => {
    const url = new URL(
      oauth([]).buildAuthUrl({ state: 's1', redirectUri: 'https://app.test/api/conexiones/retorno' }),
    );
    expect(url.origin + url.pathname).toBe('https://www.facebook.com/v26.0/dialog/oauth');
    expect(url.searchParams.get('config_id')).toBe('cfg');
    expect(url.searchParams.get('state')).toBe('s1');
    expect(url.searchParams.get('response_type')).toBe('code');
  });

  it('canjea el código, obtiene el acceso largo, los permisos y la página con su Instagram', async () => {
    const r = await oauth(
      canje([
        pagina({
          instagram_business_account: { id: '222', username: 'micuenta', profile_picture_url: 'https://img.test/i' },
        }),
      ]),
    ).exchangeCode({ code: 'c', redirectUri: 'https://app.test/r' });
    expect(r.sesion).toEqual({ accessToken: 'EAAP', datos: { pageId: '111', igUserId: '222' } });
    expect(r.scopes).toEqual(['pages_manage_posts', 'instagram_content_publish']);
    expect(r.cuentas).toEqual({
      facebook: { id: '111', name: 'Mi página', avatarUrl: 'https://img.test/p' },
      instagram: { id: '222', name: 'micuenta', handle: 'micuenta', avatarUrl: 'https://img.test/i' },
    });
  });

  it('sin páginas o con varias es error definitivo con el mensaje', async () => {
    await expect(oauth(canje([])).exchangeCode({ code: 'c', redirectUri: 'r' })).rejects.toMatchObject({
      kind: 'definitivo',
      message: 'Elige una página de Facebook al conectar.',
    });
    await expect(
      oauth(canje([pagina(), pagina({ id: '112' })])).exchangeCode({ code: 'c', redirectUri: 'r' }),
    ).rejects.toMatchObject({ kind: 'definitivo', message: 'Elige una sola página de Facebook al conectar.' });
  });

  it('una página sin Instagram solo conecta Facebook', async () => {
    const r = await oauth(canje([pagina()])).exchangeCode({ code: 'c', redirectUri: 'r' });
    expect(Object.keys(r.cuentas)).toEqual(['facebook']);
    expect(r.sesion.datos).toEqual({ pageId: '111' });
  });

  it('renovar valida el acceso de la página y con error 190 es de autenticación', async () => {
    const sesion = { accessToken: 'EAAP', datos: { pageId: '111' } };
    expect(
      await oauth([{ metodo: 'GET', url: `${GRAPH}/111?fields=id`, respuesta: ok({ id: '111' }) }]).refresh(sesion),
    ).toEqual(sesion);
    await expect(
      oauth([
        {
          metodo: 'GET',
          url: `${GRAPH}/111?fields=id`,
          respuesta: { status: 400, json: { error: { code: 190, message: 'Expired' } } },
        },
      ]).refresh(sesion),
    ).rejects.toMatchObject({ kind: 'auth' });
  });
});

describe('clasificarMeta', () => {
  const r = (status: number, error: object) => ({ status, headers: new Headers(), json: { error }, texto: '' });
  it.each([
    [{ code: 190 }, 'auth'],
    [{ code: 200 }, 'auth'],
    [{ code: 613 }, 'temporal'],
    [{ code: 2 }, 'temporal'],
    [{ code: 506 }, 'ambiguo'],
  ] as const)('%j → %s', (error, kind) => {
    expect(clasificarMeta('Facebook', r(400, error))?.kind).toBe(kind);
  });

  it('otro error es definitivo con error_user_msg', () => {
    expect(
      clasificarMeta('Facebook', r(400, { code: 100, message: 'x', error_user_msg: 'Video demasiado corto' })),
    ).toMatchObject({
      kind: 'definitivo',
      message: 'Meta rechazó la publicación: Video demasiado corto',
    });
  });

  it('el mensaje de autenticación nombra la red', () => {
    expect(clasificarMeta('Instagram', r(400, { code: 190 }))?.message).toBe(
      'El acceso a Instagram venció o le faltan permisos. Vuelve a conectar Meta.',
    );
  });

  it('una respuesta sin error no es error', () => {
    expect(
      clasificarMeta('Facebook', { status: 200, headers: new Headers(), json: { id: '1' }, texto: '' }),
    ).toBeNull();
  });
});
