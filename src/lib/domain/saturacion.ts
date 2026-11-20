import { DUEÑOS, horasTramo, type CostoTramo, type Red, type Via } from './red';
import type { Marcha } from './servicio';
import { fijarVelocidades } from './trayecto';

/**
 * How full a line is, and what that does to the trains on it. Every line
 * carries its private traffic (`Via.privados`) plus the player's trains that
 * pass over it; divided by what fits (`Via.capacidad`), that is its use. Past
 * a comfortable use, trains wait for each other at sidings, and a train's
 * average speed over the line drops.
 *
 * The player's trains are counted by their timetable on free track (how often
 * they would pass with nobody in the way), so a slowdown doesn't feed back on
 * itself.
 */

/**
 * Up to here a line runs at full speed: the share of capacity that UIC 406
 * (the international rail-capacity method, which ARTF adopted) recommends as
 * the daily ceiling on mixed-traffic lines.
 */
export const USO_HOLGADO = 0.6;
/** Never slower than this share of the free speed, however packed the line. */
export const FACTOR_MINIMO = 0.25;

/**
 * Share of the free speed a train keeps on a line at use `u`:
 * 100 % up to 60 % use, then down in a straight line to 60 % at full use,
 * and past full use halving again by 150 % (never under 25 %).
 */
export function factorVelocidad(u: number): number {
  if (u <= USO_HOLGADO) return 1;
  if (u <= 1) return 1 - (u - USO_HOLGADO);
  return Math.max(FACTOR_MINIMO, 0.6 / (1 + 2 * (u - 1)));
}

/** How a line's use reads on the map and in the cards. */
export type NivelUso = 'holgada' | 'cargada' | 'saturada';
export const nivelUso = (u: number): NivelUso => (u <= USO_HOLGADO ? 'holgada' : u <= 1 ? 'cargada' : 'saturada');

/** Free-track hours of a leg: its length at `velLibre`. */
function horasLibres(t: Marcha['piernas'][number]): number {
  const v = t.velLibre ?? t.vel;
  let h = 0;
  for (let i = 0; i < v.length; i++) h += (t.acum[i + 1] - t.acum[i]) / v[i];
  return h;
}

/**
 * The player's trains a day on each line (by `Via.base`), both directions:
 * a train passes a line once per leg that runs on it, and runs 24 / cycle
 * legs' worth of cycles a day.
 */
export function trenesDelJugador(trenes: readonly Marcha[]): Map<number, number> {
  const out = new Map<number, number>();
  for (const t of trenes) {
    const ciclo = t.piernas.reduce((h, p) => h + horasLibres(p), 0) + t.esperas.reduce((h, e) => h + e, 0);
    if (ciclo <= 0) continue;
    const porDia = 24 / ciclo;
    for (const p of t.piernas) {
      if (!p.vias) continue;
      for (const base of new Set(p.vias)) out.set(base, (out.get(base) ?? 0) + porDia);
    }
  }
  return out;
}

export type Uso = { privados: number; jugador: number; capacidad: number; uso: number };

export function usoDe(v: Via, jugador: ReadonlyMap<number, number>): Uso {
  const j = jugador.get(v.base) ?? 0;
  return { privados: v.privados, jugador: j, capacidad: v.capacidad, uso: (v.privados + j) / v.capacidad };
}

/**
 * How the player's trains choose their way: the time each line takes at its
 * current use, so a full line is avoided when there's another way round. On
 * equal terms the State's own track wins (no one to pay for passing).
 */
export function costoConUso(red: Red, jugador: ReadonlyMap<number, number>): CostoTramo {
  const factor = red.vias.map((v) => {
    const propia = v.dueño && DUEÑOS[v.dueño].tipo === 'estatal';
    return factorVelocidad(usoDe(v, jugador).uso) * (propia ? 1 : 0.99);
  });
  return (t) => horasTramo(t) / factor[t.base];
}

/** Rewrites every train's speeds for the lines' current use. */
export function aplicarSaturacion(red: Red, trenes: readonly Marcha[], jugador: ReadonlyMap<number, number>): void {
  const factor = red.vias.map((v) => factorVelocidad(usoDe(v, jugador).uso));
  for (const t of trenes) {
    for (const p of t.piernas) {
      if (!p.vias || !p.velLibre) continue;
      fijarVelocidades(
        p,
        p.velLibre.map((v, i) => v * factor[p.vias![i]])
      );
    }
  }
}
