import type { Destino, Publicacion, TipoPublicacion } from './tipos';

type DestinoBasico = Pick<Destino, 'platform' | 'format'>;

export const MENSAJES_JERARQUIA = {
  principalConPadre: 'Un video principal no puede pertenecer a otro.',
  principalInexistente: 'El video principal elegido ya no existe.',
  noEsPrincipal: 'La publicación elegida no es un video principal.',
  hijaConVideoLargo: 'Una Hija solo puede tener videos cortos o imágenes.',
  principalConHijas: 'Esta publicación tiene Hijas. Desvincúlalas antes de quitarle el video largo de YouTube.',
} as const;

const esVideoLargoDeYoutube = (d: DestinoBasico) => d.platform === 'youtube' && d.format === 'video_largo';

export function tipoDePublicacion(destinos: readonly DestinoBasico[], parentId?: string | null): TipoPublicacion {
  if (destinos.some(esVideoLargoDeYoutube)) return 'principal';
  return parentId ? 'hija' : 'independiente';
}

export interface ContextoJerarquia {
  destinos: readonly DestinoBasico[];
  parentId?: string | null;
  principal: Pick<Publicacion, 'id' | 'kind'> | null;
  tipoActual?: TipoPublicacion;
  numeroDeHijas: number;
}

export function problemasDeJerarquia(contexto: ContextoJerarquia): string[] {
  const problemas: string[] = [];
  const seraPrincipal = contexto.destinos.some(esVideoLargoDeYoutube);
  if (contexto.parentId) {
    if (seraPrincipal) problemas.push(MENSAJES_JERARQUIA.principalConPadre);
    if (!contexto.principal) problemas.push(MENSAJES_JERARQUIA.principalInexistente);
    else if (contexto.principal.kind !== 'principal') problemas.push(MENSAJES_JERARQUIA.noEsPrincipal);
    if (contexto.destinos.some((d) => d.format === 'video_largo')) problemas.push(MENSAJES_JERARQUIA.hijaConVideoLargo);
  }
  if (contexto.tipoActual === 'principal' && contexto.numeroDeHijas > 0 && !seraPrincipal) {
    problemas.push(MENSAJES_JERARQUIA.principalConHijas);
  }
  return problemas;
}
