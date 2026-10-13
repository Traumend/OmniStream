import type { Crop } from '@omnistream/core';

const porcentaje = (valor: number) => `${Number(valor.toFixed(4)) || 0}%`;

// Estilo del elemento interno (imagen o video) para que su contenedor muestre solo el recorte: se agranda en
// proporción inversa al recorte y se desplaza hasta su esquina. Así la vista previa simula el derivado con CSS.
export function estiloRecorte(crop: Crop): { width: string; height: string; left: string; top: string } {
  return {
    width: porcentaje(100 / crop.w),
    height: porcentaje(100 / crop.h),
    left: porcentaje((-crop.x / crop.w) * 100),
    top: porcentaje((-crop.y / crop.h) * 100),
  };
}
