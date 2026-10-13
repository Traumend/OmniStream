'use client';

import esLocale from '@fullcalendar/core/locales/es';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import luxonPlugin from '@fullcalendar/luxon3';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import { PLATAFORMAS, type EstadoDestino, type Platform, type Publicacion } from '@omnistream/core';
import { InsigniaRed } from '@/components/publicaciones/InsigniaRed';
import { aEventos } from './eventos';

export interface PropsCalendario {
  publicaciones: Publicacion[];
  zona: string;
  resaltar?: string;
  fechaInicial?: Date;
  alMover(postId: string, fecha: Date): Promise<void>;
  alAbrir(postId: string): void;
  alCambiarRango(desde: Date, hasta: Date): void;
}

export function CalendarioPublicaciones({
  publicaciones,
  zona,
  resaltar,
  fechaInicial,
  alMover,
  alAbrir,
  alCambiarRango,
}: PropsCalendario) {
  return (
    <FullCalendar
      plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, luxonPlugin]}
      timeZone={zona}
      locale={esLocale}
      initialView="dayGridMonth"
      initialDate={fechaInicial}
      headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek' }}
      buttonText={{ today: 'Hoy', month: 'Mes', week: 'Semana' }}
      height="auto"
      dayMaxEvents
      editable
      eventDurationEditable={false}
      snapDuration="00:15:00"
      events={aEventos(publicaciones, new Date(), resaltar)}
      // No se permite soltar en el pasado; el servidor lo vuelve a comprobar.
      eventAllow={(info) => info.start.getTime() > Date.now()}
      eventDrop={(info) => {
        const fecha = info.event.start;
        if (!fecha) {
          info.revert();
          return;
        }
        alMover(info.event.id, fecha).catch(() => info.revert());
      }}
      eventClick={(info) => {
        info.jsEvent.preventDefault();
        alAbrir(info.event.id);
      }}
      datesSet={(rango) => alCambiarRango(rango.start, rango.end)}
      eventContent={(arg) => {
        const destinos = arg.event.extendedProps.targetStatus as Partial<Record<Platform, EstadoDestino>>;
        return (
          <div className="flex min-w-0 flex-col gap-1 px-1 py-0.5">
            <span className="truncate text-xs font-semibold text-texto">
              {arg.timeText && <span className="cifras mr-1 font-normal text-texto-secundario">{arg.timeText}</span>}
              {arg.event.title}
            </span>
            <span className="flex flex-wrap gap-1">
              {PLATAFORMAS.filter((p) => destinos[p]).map((p) => (
                <InsigniaRed key={p} platform={p} estado={destinos[p]} />
              ))}
            </span>
          </div>
        );
      }}
    />
  );
}
