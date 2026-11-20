import type { LonLat } from './geo';

/**
 * A route flattened into one polyline, with a speed on every segment: what a
 * train or a ship actually moves along. Rail routes come from the network
 * graph (`red.ts`), sea routes from the precomputed lanes (`mar.ts`); from here
 * on they're the same thing.
 */
export type Trayecto = {
  puntos: LonLat[];
  /** Cumulative km along `puntos`; first 0, last = length. */
  acum: number[];
  /** Speed on each segment (puntos[i] → puntos[i + 1]), km/h. */
  vel: number[];
  /** Cumulative hours along `puntos`, at each segment's speed. */
  acumH: number[];
  km: number;
  horas: number;
  /**
   * The stretch on the Mexico board, as [from, to] km along the route. All of
   * it, except a ship's ocean crossing beyond a gateway: that part only exists
   * on the world views.
   */
  enTablero: [number, number];
  /**
   * Rail only: per segment, the network tramo it runs on (`Via.base`) and the
   * speed on free track. A saturated tramo slows the train down from that
   * (`saturacion.ts` rewrites `vel` through `fijarVelocidades`).
   */
  vias?: number[];
  velLibre?: number[];
};

const D2R = Math.PI / 180;

/** Distance in km; equirectangular at the pair's mean latitude — exact enough for track and lane segments. */
export function kmEntre(a: LonLat, b: LonLat): number {
  const c = Math.cos(((a[1] + b[1]) / 2) * D2R);
  return 6371 * Math.hypot((b[0] - a[0]) * D2R * c, (b[1] - a[1]) * D2R);
}

export function acumulado(puntos: LonLat[]): number[] {
  const out = [0];
  for (let i = 1; i < puntos.length; i++) out.push(out[i - 1] + kmEntre(puntos[i - 1], puntos[i]));
  return out;
}

export const lerp = (a: LonLat, b: LonLat, u: number): LonLat => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];

/**
 * `vel` has one entry per segment (puntos.length - 1). `tablero` gives the
 * vertices where the route enters and leaves the board, when it doesn't lie on
 * it whole.
 */
export function crearTrayecto(puntos: LonLat[], vel: number[], tablero?: [number, number]): Trayecto {
  const acum = acumulado(puntos);
  const acumH = [0];
  for (let i = 1; i < puntos.length; i++) acumH.push(acumH[i - 1] + (acum[i] - acum[i - 1]) / vel[i - 1]);
  const km = acum[acum.length - 1];
  const enTablero: [number, number] = tablero ? [acum[tablero[0]], acum[tablero[1]]] : [0, km];
  return { puntos, acum, vel, acumH, km, horas: acumH[acumH.length - 1], enTablero };
}

/** The same path, travelled the other way. */
export function invertir(t: Trayecto): Trayecto {
  const r = crearTrayecto([...t.puntos].reverse(), [...t.vel].reverse());
  r.enTablero = [t.km - t.enTablero[1], t.km - t.enTablero[0]];
  if (t.vias) r.vias = [...t.vias].reverse();
  if (t.velLibre) r.velLibre = [...t.velLibre].reverse();
  return r;
}

/** New speeds per segment, in place: positions are kept in km, so a vehicle under way stays put. */
export function fijarVelocidades(t: Trayecto, vel: number[]): void {
  t.vel = vel;
  for (let i = 1; i < t.puntos.length; i++) t.acumH[i] = t.acumH[i - 1] + (t.acum[i] - t.acum[i - 1]) / vel[i - 1];
  t.horas = t.acumH[t.acumH.length - 1];
}

/** Index of the segment that contains `km` (binary search on `acum`). */
export function segmentoEn(t: Trayecto, km: number): number {
  let lo = 0;
  let hi = t.acum.length - 2;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (t.acum[mid] <= km) lo = mid;
    else hi = mid - 1;
  }
  return Math.max(0, lo);
}

export function puntoEn(t: Trayecto, km: number): LonLat {
  const k = Math.max(0, Math.min(t.km, km));
  const i = segmentoEn(t, k);
  const largo = t.acum[i + 1] - t.acum[i];
  return lerp(t.puntos[i], t.puntos[i + 1], largo > 0 ? (k - t.acum[i]) / largo : 0);
}

/** Hours of running left from `km` to the end. */
export function horasRestantes(t: Trayecto, km: number): number {
  const k = Math.max(0, Math.min(t.km, km));
  const i = segmentoEn(t, k);
  return t.horas - (t.acumH[i] + (k - t.acum[i]) / t.vel[i]);
}

/** The polyline between two distances along the path (clamped), interior vertices included. */
export function seccion(t: Trayecto, km0: number, km1: number): LonLat[] {
  const a = Math.max(0, Math.min(t.km, km0));
  const b = Math.max(0, Math.min(t.km, km1));
  if (b <= a) return [puntoEn(t, a)];
  const i = segmentoEn(t, a);
  const j = segmentoEn(t, b);
  const out: LonLat[] = [puntoEn(t, a)];
  for (let n = i + 1; n <= j; n++) out.push(t.puntos[n]);
  out.push(puntoEn(t, b));
  return out;
}

/** The part of the route that lies on the Mexico board. */
export function tramoEnTablero(t: Trayecto): LonLat[] {
  return seccion(t, t.enTablero[0], t.enTablero[1]);
}
