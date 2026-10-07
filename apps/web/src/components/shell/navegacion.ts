import {
  CalendarDays,
  ChartColumnIncreasing,
  Inbox,
  Library,
  ListTodo,
  Settings,
  SquarePen,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';

export interface ItemNavegacion {
  etiqueta: string;
  ruta: string;
  icono: LucideIcon;
  fase: number;
}

export const FASE_ACTUAL = 1;

export const NAV_LATERAL: ItemNavegacion[] = [
  { etiqueta: 'Calendario', ruta: '/calendario', icono: CalendarDays, fase: 2 },
  { etiqueta: 'Crear', ruta: '/crear', icono: SquarePen, fase: 2 },
  { etiqueta: 'Pendientes', ruta: '/pendientes', icono: Inbox, fase: 2 },
  { etiqueta: 'Biblioteca', ruta: '/biblioteca', icono: Library, fase: 1 },
  { etiqueta: 'Estadísticas', ruta: '/estadisticas', icono: ChartColumnIncreasing, fase: 5 },
  { etiqueta: 'Tendencias', ruta: '/tendencias', icono: TrendingUp, fase: 6 },
  { etiqueta: 'Plan', ruta: '/plan', icono: ListTodo, fase: 6 },
  { etiqueta: 'Ajustes', ruta: '/ajustes/general', icono: Settings, fase: 1 },
];

export const NAV_SUPERIOR: { etiqueta: string; ruta: string }[] = [
  { etiqueta: 'CREAR', ruta: '/crear' },
  { etiqueta: 'PLANIFICAR', ruta: '/plan' },
  { etiqueta: 'PUBLICAR', ruta: '/calendario' },
  { etiqueta: 'ANALIZAR', ruta: '/estadisticas' },
  { etiqueta: 'CRECER', ruta: '/tendencias' },
];

export function estaDisponible(item: ItemNavegacion, fase: number = FASE_ACTUAL): boolean {
  return item.fase <= fase;
}
