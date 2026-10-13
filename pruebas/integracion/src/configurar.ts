import { adminDemo } from './admin';

// Desde la fase 2B la retención por defecto es de 0 días: un archivo se purga en cuanto sus destinos quedan
// terminales. Las pruebas comparten archivos entre publicaciones, así que corren con 7 días salvo las que
// prueban la retención y la fijan ellas mismas.
await adminDemo('configurar').db.doc('settings/app').set({ retentionDays: 7 }, { merge: true });
