import type { LonLat } from './geo';
import { horasRestantes, invertir, puntoEn, segmentoEn, type Trayecto } from './trayecto';

/**
 * A service: a vehicle running its stops forever, stopping at each one. Trains
 * and ships are both this; they differ in how a leg is routed (rail network or
 * sea lanes), how long they stop, and how they're drawn. Pure state and a pure
 * step function.
 */

/**
 * How the stops are run. A rail line goes there and back (A→B→C→B→A); a
 * shipping service loops (A→B→C→A), the way liner services do.
 */
export type Recorrido = 'ida-y-vuelta' | 'circular';

export type EstadoMarcha = 'ruta' | 'parada';

export type Marcha = {
  /** Stop keys, in the order given. */
  paradas: string[];
  recorrido: Recorrido;
  /** The cycle as legs. */
  piernas: Trayecto[];
  /** Stop key at the end of each leg. */
  destinos: string[];
  /** Hours stopped at the end of each leg. */
  esperas: number[];
  pierna: number;
  /** Distance travelled along the current leg. */
  km: number;
  /**
   * 'parada': stopped at the end of the current leg (`destinos[pierna]`),
   * `espera` hours to go; on departure it moves on to the next leg.
   */
  estado: EstadoMarcha;
  espera: number;
  /** Total km run since the vehicle entered service. */
  odometro: number;
  /** Legs just finished (their index), oldest first, for whoever keeps the cargo: trains only. */
  llegadas?: number[];
};

export type Armado = {
  paradas: string[];
  recorrido: Recorrido;
  /** Routes one leg; null when the two stops can't be joined. */
  ruta: (desde: string, hasta: string) => Trayecto | null;
  /** Hours stopped at `destino`; `terminal` is true at the two ends of an ida-y-vuelta line. */
  espera: (destino: string, terminal: boolean) => number;
  /** Born under way at the start of the first leg, instead of loading at the first stop. */
  zarpando?: boolean;
  /** Hours to fast-forward after creation, so a fleet doesn't start in lockstep. */
  desfase?: number;
};

/** Lays the service out, or null if some leg can't be routed. */
export function armarMarcha(a: Armado): Marcha | null {
  const n = a.paradas.length;
  if (n < 2) return null;
  let piernas: Trayecto[];
  let destinos: string[];
  if (a.recorrido === 'ida-y-vuelta') {
    const ida: Trayecto[] = [];
    for (let i = 0; i + 1 < n; i++) {
      const t = a.ruta(a.paradas[i], a.paradas[i + 1]);
      if (!t) return null;
      ida.push(t);
    }
    piernas = [...ida, ...[...ida].reverse().map(invertir)];
    destinos = [...a.paradas.slice(1), ...[...a.paradas].reverse().slice(1)];
  } else {
    piernas = [];
    for (let i = 0; i < n; i++) {
      const t = a.ruta(a.paradas[i], a.paradas[(i + 1) % n]);
      if (!t) return null;
      piernas.push(t);
    }
    destinos = [...a.paradas.slice(1), a.paradas[0]];
  }
  const terminal = (d: string) => a.recorrido === 'ida-y-vuelta' && (d === a.paradas[0] || d === a.paradas[n - 1]);
  const esperas = destinos.map((d) => a.espera(d, terminal(d)));

  const ultima = piernas.length - 1;
  const m: Marcha = {
    paradas: a.paradas,
    recorrido: a.recorrido,
    piernas,
    destinos,
    esperas,
    // Born at the first stop, as if just arrived on the last leg of the
    // previous cycle — or, `zarpando`, just leaving it.
    pierna: a.zarpando ? 0 : ultima,
    km: a.zarpando ? 0 : piernas[ultima].km,
    estado: a.zarpando ? 'ruta' : 'parada',
    espera: a.zarpando ? 0 : esperas[ultima],
    odometro: 0,
  };
  if (a.desfase) avanzar(m, a.desfase);
  m.odometro = 0;
  return m;
}

/**
 * Move `horas` forward. Runs segment by segment, because speed changes along
 * a route (class of track, a canal); a long step can span several stops.
 */
export function avanzar(m: Marcha, horas: number): void {
  let h = horas;
  // A cap on iterations, never reached in play: a pathological step can't hang a frame.
  for (let guard = 0; h > 1e-9 && guard < 10_000; guard++) {
    if (m.estado === 'parada') {
      if (m.espera > h) {
        m.espera -= h;
        return;
      }
      h -= m.espera;
      m.espera = 0;
      m.estado = 'ruta';
      m.pierna = (m.pierna + 1) % m.piernas.length;
      m.km = 0;
      continue;
    }
    const leg = m.piernas[m.pierna];
    const i = segmentoEn(leg, m.km);
    const v = leg.vel[i];
    const fin = leg.acum[i + 1];
    const tiempo = (fin - m.km) / v;
    if (tiempo > h) {
      m.km += v * h;
      m.odometro += v * h;
      return;
    }
    m.odometro += fin - m.km;
    m.km = fin;
    h -= tiempo;
    if (m.km >= leg.km - 1e-9) {
      m.km = leg.km;
      m.estado = 'parada';
      m.espera = m.esperas[m.pierna];
      m.llegadas?.push(m.pierna);
    }
  }
}

export function trayectoActual(m: Marcha): Trayecto {
  return m.piernas[m.pierna];
}

/** Where the front of the vehicle is. */
export function posicion(m: Marcha): LonLat {
  return puntoEn(m.piernas[m.pierna], m.km);
}

/**
 * Where it is as far as the Mexico board is concerned: its position, held at
 * the gateway while it's on an ocean crossing beyond it.
 */
export function posicionEnTablero(m: Marcha): LonLat {
  const leg = m.piernas[m.pierna];
  return puntoEn(leg, Math.max(leg.enTablero[0], Math.min(leg.enTablero[1], m.km)));
}

/** Speed right now, km/h (0 when stopped). */
export function velocidad(m: Marcha): number {
  if (m.estado === 'parada') return 0;
  const leg = m.piernas[m.pierna];
  return leg.vel[segmentoEn(leg, m.km)];
}

/** The stop it's at, when stopped. */
export function paradaActual(m: Marcha): string | null {
  return m.estado === 'parada' ? m.destinos[m.pierna] : null;
}

/** The next stop it will reach. */
export function proximaParada(m: Marcha): string {
  return m.estado === 'parada' ? m.destinos[(m.pierna + 1) % m.destinos.length] : m.destinos[m.pierna];
}

/** Hours until it reaches `proximaParada`, the current stop included when it's stopped. */
export function horasAProxima(m: Marcha): number {
  if (m.estado === 'parada') return m.espera + m.piernas[(m.pierna + 1) % m.piernas.length].horas;
  return horasRestantes(m.piernas[m.pierna], m.km);
}

/** How long the current stop lasts in total (for a progress readout). */
export function esperaTotal(m: Marcha): number {
  return m.esperas[m.pierna];
}

/** Share of the current leg done, 0–1. */
export function avanceDePierna(m: Marcha): number {
  const leg = m.piernas[m.pierna];
  return leg.km > 0 ? m.km / leg.km : 1;
}

/** One direction of an ida-y-vuelta line, or one full loop of a circular service. */
export function kmDelRecorrido(m: Marcha): number {
  const piernas = m.recorrido === 'ida-y-vuelta' ? m.piernas.slice(0, m.piernas.length / 2) : m.piernas;
  return piernas.reduce((s, p) => s + p.km, 0);
}

/** The legs worth drawing for the whole service: one direction of a line, the whole loop of a circuit. */
export function piernasDelRecorrido(m: Marcha): Trayecto[] {
  return m.recorrido === 'ida-y-vuelta' ? m.piernas.slice(0, m.piernas.length / 2) : m.piernas;
}
