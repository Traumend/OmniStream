export type EstadoNotificaciones = 'no_soportado' | 'sin_configurar' | 'bloqueadas' | 'desactivadas' | 'activadas';

export interface EntornoNotificaciones {
  soportado: boolean;
  vapid?: string;
  permiso: NotificationPermission;
  tokenRegistrado: boolean;
}

export function estadoNotificaciones({
  soportado,
  vapid,
  permiso,
  tokenRegistrado,
}: EntornoNotificaciones): EstadoNotificaciones {
  if (!soportado) return 'no_soportado';
  if (!vapid) return 'sin_configurar';
  if (permiso === 'denied') return 'bloqueadas';
  if (permiso === 'granted' && tokenRegistrado) return 'activadas';
  return 'desactivadas';
}
