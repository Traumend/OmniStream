export const PASOS = ['archivo', 'destinos', 'canvas', 'contenido', 'vista', 'publicar'] as const;
export type Paso = (typeof PASOS)[number];

export const ETIQUETAS_PASO: Record<Paso, string> = {
  archivo: 'Archivo',
  destinos: 'Destinos',
  canvas: 'Canvas',
  contenido: 'Contenido',
  vista: 'Vista previa',
  publicar: 'Publicar',
};

export const pasoDe = (valor: string | null | undefined): Paso | undefined => PASOS.find((paso) => paso === valor);
