import { nombreCorto } from '$lib/domain/sitios';
import { horasAProxima, paradaActual, proximaParada, type Tren } from '$lib/domain/trenes';

const entero = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });

export const km = (n: number) => `${entero.format(n)} km`;

/** Simulated hours as "2 h 15 min", "40 min" or "1 d 3 h". */
export function duracion(horas: number): string {
  const min = Math.max(0, Math.round(horas * 60));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return min % 60 ? `${h} h ${min % 60} min` : `${h} h`;
  const d = Math.floor(h / 24);
  return h % 24 ? `${d} d ${h % 24} h` : `${d} d`;
}

/** A moment of game time as "Día 3 · 14:05". */
export function horaDeJuego(horas: number): string {
  const dia = Math.floor(horas / 24) + 1;
  const h = Math.floor(horas % 24);
  const m = Math.floor((horas % 1) * 60);
  return `Día ${dia} · ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** One line for a train: where it is or where it's headed, and when. */
export function estadoTren(t: Tren): string {
  const aqui = paradaActual(t);
  if (aqui) return `En ${nombreCorto(aqui)} · sale en ${duracion(t.espera)}`;
  return `→ ${nombreCorto(proximaParada(t))} · ${duracion(horasAProxima(t))}`;
}
