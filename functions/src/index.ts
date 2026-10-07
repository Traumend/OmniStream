import { initializeApp } from 'firebase-admin/app';

initializeApp();

export { antesDeCrearUsuario, antesDeIniciarSesion } from './acceso/bloqueos';
export { procesarArchivo } from './archivos/procesarArchivo';
