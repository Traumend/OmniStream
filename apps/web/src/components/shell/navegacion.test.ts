import { expect, it } from 'vitest';
import { estaDisponible, NAV_LATERAL, NAV_SUPERIOR } from './navegacion';

it('define la barra lateral en orden', () => {
  expect(NAV_LATERAL.map((i) => [i.etiqueta, i.ruta, i.fase])).toEqual([
    ['Calendario', '/calendario', 2],
    ['Crear', '/crear', 2],
    ['Pendientes', '/pendientes', 2],
    ['Biblioteca', '/biblioteca', 1],
    ['Estadísticas', '/estadisticas', 5],
    ['Tendencias', '/tendencias', 6],
    ['Plan', '/plan', 6],
    ['Ajustes', '/ajustes/general', 1],
  ]);
});

it('define la barra superior', () => {
  expect(NAV_SUPERIOR).toEqual([
    { etiqueta: 'CREAR', ruta: '/crear' },
    { etiqueta: 'PLANIFICAR', ruta: '/plan' },
    { etiqueta: 'PUBLICAR', ruta: '/calendario' },
    { etiqueta: 'ANALIZAR', ruta: '/estadisticas' },
    { etiqueta: 'CRECER', ruta: '/tendencias' },
  ]);
});

it('marca disponibles solo las secciones de la fase actual o anteriores', () => {
  expect(NAV_LATERAL.filter((i) => estaDisponible(i)).map((i) => i.ruta)).toEqual([
    '/calendario',
    '/crear',
    '/pendientes',
    '/biblioteca',
    '/ajustes/general',
  ]);
});
