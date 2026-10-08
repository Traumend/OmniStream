import type { Platform, RemoteRef } from './tipos';

type Extractor = (host: string, partes: string[], parametros: URLSearchParams) => string | undefined;

const ID_YOUTUBE = /^[A-Za-z0-9_-]{11}$/;
const CODIGO = /^[A-Za-z0-9_.-]+$/;
const valido = (valor: string | null | undefined, patron: RegExp = CODIGO) =>
  valor && patron.test(valor) ? valor : undefined;

const EXTRACTORES: Record<Platform, Extractor> = {
  youtube(host, partes, parametros) {
    if (host === 'youtu.be') return valido(partes[0], ID_YOUTUBE);
    if (host !== 'youtube.com') return undefined;
    if (partes[0] === 'watch') return valido(parametros.get('v'), ID_YOUTUBE);
    if (partes[0] === 'shorts' || partes[0] === 'live' || partes[0] === 'embed') return valido(partes[1], ID_YOUTUBE);
    return undefined;
  },
  instagram(host, partes) {
    if (host !== 'instagram.com') return undefined;
    const indice = partes.findIndex((p) => p === 'p' || p === 'reel' || p === 'reels' || p === 'tv');
    return indice === 0 || indice === 1 ? valido(partes[indice + 1]) : undefined;
  },
  facebook(host, partes, parametros) {
    if (host === 'fb.watch') return valido(partes[0]);
    if (host !== 'facebook.com' && host !== 'fb.com') return undefined;
    const [primera, segunda, tercera] = partes;
    if (primera === 'reel') return valido(segunda);
    if (primera === 'watch') return valido(parametros.get('v'));
    if (primera === 'photo' || primera === 'photo.php') return valido(parametros.get('fbid'));
    if (primera === 'permalink.php' || primera === 'story.php') return valido(parametros.get('story_fbid'));
    if (primera === 'share') return valido(tercera);
    if (segunda === 'posts' || segunda === 'videos') return valido(tercera);
    if (segunda === 'photos') return valido(partes.at(-1));
    return undefined;
  },
  tiktok(host, partes) {
    if (host === 'vm.tiktok.com' || host === 'vt.tiktok.com') return valido(partes[0]);
    if (host !== 'tiktok.com') return undefined;
    if (partes[0] === 't') return valido(partes[1]);
    if (partes[0]?.startsWith('@') && (partes[1] === 'video' || partes[1] === 'photo')) return valido(partes[2], /^\d+$/);
    return undefined;
  },
};

// Extrae el id de una publicación a partir de la URL que el usuario pega en el modo manual.
export function analizarUrlPublica(platform: Platform, url: string): RemoteRef | null {
  const limpia = url.trim();
  let direccion: URL;
  try {
    direccion = new URL(limpia);
  } catch {
    return null;
  }
  if (direccion.protocol !== 'https:' && direccion.protocol !== 'http:') return null;
  const host = direccion.hostname.toLowerCase().replace(/^(www|m)\./, '');
  const partes = direccion.pathname.split('/').filter(Boolean);
  const id = EXTRACTORES[platform](host, partes, direccion.searchParams);
  return id ? { id, url: limpia } : null;
}
