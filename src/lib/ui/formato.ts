import { enElCanal, fueraDelMapa, KM_POR_MILLA } from '$lib/domain/barcos';
import { horasAProxima, paradaActual, proximaParada } from '$lib/domain/servicio';
import { nombreCorto, puerta } from '$lib/domain/sitios';
import type { Unidad } from '$lib/state/simulacion.svelte';

const entero = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });

export const km = (n: number) => `${entero.format(n)} km`;

/** km/h as knots, the way ships' speeds are given. */
export const nudos = (kmh: number) => `${entero.format(kmh / KM_POR_MILLA)} nudos`;

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

/** One line for a train or ship: where it is or where it's headed, and when. */
export function estadoUnidad(u: Unidad): string {
  if (u.tipo === 'barco') {
    if (fueraDelMapa(u)) {
      const p = puerta(u.destinos[u.pierna]);
      return `En travesía a ${p?.hacia ?? 'ultramar'} · vuelve en ${duracion(u.espera)}`;
    }
    const aqui = paradaActual(u);
    if (aqui) return `En ${nombreCorto(aqui)} · zarpa en ${duracion(u.espera)}`;
    const destino = nombreCorto(proximaParada(u));
    if (enElCanal(u)) return `Cruzando el Canal de Panamá · → ${destino}`;
    return `→ ${destino} · ${duracion(horasAProxima(u))}`;
  }
  const aqui = paradaActual(u);
  if (aqui) return `En ${nombreCorto(aqui)} · sale en ${duracion(u.espera)}`;
  return `→ ${nombreCorto(proximaParada(u))} · ${duracion(horasAProxima(u))}`;
}
