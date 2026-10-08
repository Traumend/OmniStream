// Service worker de los avisos push de OmniStream.
// Recibe los mensajes de solo datos de Firebase Cloud Messaging y arma la notificación.
// Se mantiene sin dependencias para que el navegador lo cargue tal cual desde /sw-notificaciones.js.

const ICONO = '/icono.svg';
const AVISO_GENERICO = { titulo: 'OmniStream', cuerpo: 'Hay novedades en tus publicaciones.', enlace: '/pendientes' };

function leerAviso(evento) {
  try {
    const payload = evento.data ? evento.data.json() : null;
    const datos = (payload && (payload.data || payload.notification)) || {};
    return {
      titulo: datos.titulo || datos.title || AVISO_GENERICO.titulo,
      cuerpo: datos.cuerpo || datos.body || AVISO_GENERICO.cuerpo,
      enlace: datos.enlace || AVISO_GENERICO.enlace,
    };
  } catch {
    return AVISO_GENERICO;
  }
}

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(self.clients.claim());
});

// Siempre se muestra un aviso: los navegadores lo exigen para cada push (userVisibleOnly).
self.addEventListener('push', (evento) => {
  const aviso = leerAviso(evento);
  evento.waitUntil(
    self.registration.showNotification(aviso.titulo, {
      body: aviso.cuerpo,
      data: { enlace: aviso.enlace },
      icon: ICONO,
    }),
  );
});

async function abrir(enlace) {
  const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  const ventana = ventanas.find((v) => v.url.startsWith(self.location.origin));
  if (ventana) {
    try {
      await ventana.navigate(enlace);
      await ventana.focus();
      return;
    } catch {
      // La ventana no está controlada por este service worker: se abre una nueva.
    }
  }
  await self.clients.openWindow(enlace);
}

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  const enlace = (evento.notification.data && evento.notification.data.enlace) || AVISO_GENERICO.enlace;
  evento.waitUntil(abrir(enlace));
});
