declare module 'heic-convert' {
  function convertir(opciones: { buffer: Buffer | ArrayBuffer; format: 'JPEG' | 'PNG'; quality?: number }): Promise<ArrayBuffer>;
  export default convertir;
}

declare module 'ffprobe-static' {
  const ffprobe: { path: string };
  export default ffprobe;
}
