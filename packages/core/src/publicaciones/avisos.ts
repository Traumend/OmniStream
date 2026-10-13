import { ETIQUETAS_RED, type Platform } from './tipos';

export type TipoAviso = 'pendiente_manual' | 'fallo' | 'referencia' | 'conexion' | 'promocion';

export interface Aviso {
  tipo: TipoAviso;
  titulo: string;
  cuerpo: string;
  enlace: string; // ruta de la app
}

export function avisoDe(
  tipo: Exclude<TipoAviso, 'conexion' | 'promocion'>,
  datos: { postId: string; titulo: string; platform: Platform; error?: string },
): Aviso {
  const cuerpo = `${datos.titulo} · ${ETIQUETAS_RED[datos.platform]}`;
  switch (tipo) {
    case 'pendiente_manual':
      return { tipo, titulo: 'Publicación pendiente', cuerpo, enlace: `/pendientes/${datos.postId}/${datos.platform}` };
    case 'fallo':
      return {
        tipo,
        titulo: 'Falló una publicación',
        cuerpo: datos.error ? `${cuerpo}: ${datos.error}` : cuerpo,
        enlace: `/publicaciones/${datos.postId}`,
      };
    case 'referencia':
      return { tipo, titulo: 'Referencia al video principal pendiente', cuerpo, enlace: '/pendientes' };
  }
}

export function avisoConexion(platform: Platform): Aviso {
  return {
    tipo: 'conexion',
    titulo: `Reconecta ${ETIQUETAS_RED[platform]}`,
    cuerpo: 'El acceso venció. Vuelve a conectarla para publicar por API.',
    enlace: '/ajustes/conexiones',
  };
}

export function avisoPromocion(datos: { postId: string; tituloPrincipal: string; item: { title: string } }): Aviso {
  return {
    tipo: 'promocion',
    titulo: 'Promoción pendiente',
    cuerpo: `${datos.item.title} · ${datos.tituloPrincipal}`,
    enlace: `/publicaciones/${datos.postId}`,
  };
}
