import type { LonLat } from './geo';
import { horasRestantes, invertir, puntoEn, ruta, segmentoEn, type Red, type Trayecto } from './red';
import { nombreCorto } from './sitios';

/**
 * Freight trains. A train runs a service — a list of stops — back and forth:
 * A → B → C, then C → B → A, and again, stopping at every station to load and
 * unload. Pure state and a pure step function; the clock that drives it lives
 * in `state/`, and how a train looks is the board's business.
 */

/** A Mexican freight train is ~100 cars: close to two kilometres of train. */
export const LARGO_TREN_KM = 1.8;
/** Hours at the ends of the line (full load/unload) and at stops along the way. */
export const ESPERA_TERMINAL_H = 3;
export const ESPERA_INTERMEDIA_H = 1;

export type EstadoTren = 'ruta' | 'estacion';

export type Tren = {
  id: string;
  nombre: string;
  color: string;
  /** Site keys of the service, one direction: [A, B, C]. */
  paradas: string[];
  /** The round trip as legs: A→B, B→C, C→B, B→A. */
  piernas: Trayecto[];
  /** Site key at the end of each leg. */
  destinos: string[];
  pierna: number;
  /** Distance travelled along the current leg. */
  km: number;
  /**
   * 'estacion': stopped at the end of the current leg (`destinos[pierna]`),
   * `espera` hours to go; on departure it moves on to the next leg.
   */
  estado: EstadoTren;
  espera: number;
  /** Total km run since the train was created. */
  odometro: number;
};

/**
 * Warm colours only: amber is the rail colour, and cyan stays reserved for the
 * sea. Each train gets the next one, so neighbours on the roster differ.
 */
export const COLORES_TREN = ['#ffd166', '#ff9f68', '#ff7aa8', '#c3a6ff', '#8ef0b0', '#f4f1de', '#ff6f61', '#d4f27a'];

export type NuevoTren = {
  id: string;
  color: string;
  paradas: string[];
  /** Hours to fast-forward the train after creating it, so a fleet doesn't start in lockstep. */
  desfase?: number;
};

/** Builds the train, or null if some stop has no station or two stops aren't connected by rail. */
export function crearTren(red: Red, def: NuevoTren): Tren | null {
  if (def.paradas.length < 2) return null;
  const ida: Trayecto[] = [];
  for (let i = 0; i + 1 < def.paradas.length; i++) {
    const a = red.estaciones.get(def.paradas[i]);
    const b = red.estaciones.get(def.paradas[i + 1]);
    if (!a || !b) return null;
    const t = ruta(red, a.nodo, b.nodo);
    if (!t) return null;
    ida.push(t);
  }
  const vuelta = [...ida].reverse().map(invertir);
  const piernas = [...ida, ...vuelta];
  const destinos = [...def.paradas.slice(1), ...[...def.paradas].reverse().slice(1)];

  const tren: Tren = {
    id: def.id,
    nombre: `${nombreCorto(def.paradas[0])} ⇄ ${nombreCorto(def.paradas[def.paradas.length - 1])}`,
    color: def.color,
    paradas: def.paradas,
    piernas,
    destinos,
    // Born at the first stop, loading: as if it had just arrived on the last
    // leg of the previous round trip.
    pierna: piernas.length - 1,
    km: piernas[piernas.length - 1].km,
    estado: 'estacion',
    espera: ESPERA_TERMINAL_H,
    odometro: 0,
  };
  if (def.desfase) avanzar(tren, def.desfase);
  tren.odometro = 0;
  return tren;
}

/** Hours to wait at the end of leg `i`: longer at the two ends of the line. */
function esperaAlLlegar(t: Tren, i: number): number {
  const destino = t.destinos[i];
  const terminal = destino === t.paradas[0] || destino === t.paradas[t.paradas.length - 1];
  return terminal ? ESPERA_TERMINAL_H : ESPERA_INTERMEDIA_H;
}

/**
 * Move the train `horas` forward. Runs segment by segment, because speed
 * changes with the class of track; a long step can span several stations.
 */
export function avanzar(t: Tren, horas: number): void {
  let h = horas;
  // A cap on iterations, never reached in play: a pathological step can't hang a frame.
  for (let guard = 0; h > 1e-9 && guard < 10_000; guard++) {
    if (t.estado === 'estacion') {
      if (t.espera > h) {
        t.espera -= h;
        return;
      }
      h -= t.espera;
      t.espera = 0;
      t.estado = 'ruta';
      t.pierna = (t.pierna + 1) % t.piernas.length;
      t.km = 0;
      continue;
    }
    const leg = t.piernas[t.pierna];
    const i = segmentoEn(leg, t.km);
    const v = leg.vel[i];
    const fin = leg.acum[i + 1];
    const tiempo = (fin - t.km) / v;
    if (tiempo > h) {
      t.km += v * h;
      t.odometro += v * h;
      return;
    }
    t.odometro += fin - t.km;
    t.km = fin;
    h -= tiempo;
    if (t.km >= leg.km - 1e-9) {
      t.km = leg.km;
      t.estado = 'estacion';
      t.espera = esperaAlLlegar(t, t.pierna);
    }
  }
}

export function trayectoActual(t: Tren): Trayecto {
  return t.piernas[t.pierna];
}

/** Where the front of the train is. */
export function posicion(t: Tren): LonLat {
  return puntoEn(t.piernas[t.pierna], t.km);
}

/** Speed right now, km/h (0 at a station). */
export function velocidad(t: Tren): number {
  if (t.estado === 'estacion') return 0;
  const leg = t.piernas[t.pierna];
  return leg.vel[segmentoEn(leg, t.km)];
}

/** The stop it's at, when stopped. */
export function paradaActual(t: Tren): string | null {
  return t.estado === 'estacion' ? t.destinos[t.pierna] : null;
}

/** The next stop it will pull into. */
export function proximaParada(t: Tren): string {
  return t.estado === 'estacion' ? t.destinos[(t.pierna + 1) % t.destinos.length] : t.destinos[t.pierna];
}

/** Hours until it pulls into `proximaParada`, dwell included when it's stopped now. */
export function horasAProxima(t: Tren): number {
  if (t.estado === 'estacion') return t.espera + t.piernas[(t.pierna + 1) % t.piernas.length].horas;
  return horasRestantes(t.piernas[t.pierna], t.km);
}

/** How long the current stop lasts in total (for a loading-progress readout). */
export function esperaTotal(t: Tren): number {
  return esperaAlLlegar(t, t.pierna);
}

/** Share of the current leg done, 0–1. */
export function avanceDePierna(t: Tren): number {
  const leg = t.piernas[t.pierna];
  return leg.km > 0 ? t.km / leg.km : 1;
}

/** Length of one direction of the service. */
export function kmDelServicio(t: Tren): number {
  return t.piernas.slice(0, t.piernas.length / 2).reduce((s, p) => s + p.km, 0);
}

// ---- the opening timetable -----------------------------------------------------------

/**
 * Services the board starts with, on real freight corridors: the Pacific
 * ports to the capital, the NAFTA corridor to Nuevo Laredo, the Gulf, the
 * isthmus. Stops are site keys; the route between them is whatever the
 * network says is fastest.
 */
export const SERVICIOS: string[][] = [
  ['puerto:manzanillo', 'ciudad:guadalajara', 'ciudad:ciudad-de-mexico'],
  ['puerto:lazaro-cardenas', 'ciudad:san-luis-potosi', 'ciudad:monterrey', 'ciudad:nuevo-laredo'],
  ['puerto:veracruz', 'ciudad:puebla', 'ciudad:ciudad-de-mexico'],
  ['ciudad:ciudad-de-mexico', 'ciudad:queretaro', 'ciudad:torreon', 'ciudad:chihuahua', 'ciudad:ciudad-juarez'],
  ['ciudad:guadalajara', 'puerto:mazatlan', 'ciudad:hermosillo', 'ciudad:nogales'],
  ['puerto:altamira', 'ciudad:monterrey'],
  ['puerto:coatzacoalcos', 'puerto:salina-cruz'],
  ['puerto:coatzacoalcos', 'ciudad:merida', 'puerto:progreso'],
];
