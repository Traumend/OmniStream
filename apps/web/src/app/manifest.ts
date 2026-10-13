import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'OmniStream',
    short_name: 'OmniStream',
    description: 'Una visión. Cada plataforma.',
    lang: 'es',
    start_url: '/calendario',
    display: 'standalone',
    background_color: '#F3ECE1',
    theme_color: '#F3ECE1',
    icons: [{ src: '/icono.svg', sizes: 'any', type: 'image/svg+xml' }],
  };
}
