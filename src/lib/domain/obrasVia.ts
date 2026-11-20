import OBRAS_JSON from './datos/obras-via.json';
import type { LonLat } from './geo';
import {
  cifra,
  EXPONENTE_CUADRILLAS,
  HORAS_POR_MES,
  MAX_CUADRILLAS,
  pagarAvance,
  SOBRECOSTO_POR_CUADRILLA,
  type Caja,
} from './obras';
import { recorridoDeParadas, type Red, type TrazoObra } from './red';

/**
 * The State's rail works: the catalog the player builds from. Every work is a
 * real one (built, under way or announced since 2018) on its official route,
 * with its official cost per km and its official time — or, where the
 * government hasn't published one, an estimate that says so
 * (`datos/obras-via.json`, each figure with its source).
 *
 * Four kinds, by what they do to the network (`red.ts` lays them on):
 *
 * - **nueva**: new track along its official trace (the Tren Maya, Dos Bocas).
 * - **paralela**: a double track of the State's own beside the freight line,
 *   between the stops of a passenger line. Private trains stay on theirs.
 * - **modernizar**: the State's own lines rebuilt (the Interoceánico): faster
 *   (main-line speed) and roomier (centralised traffic control).
 * - **rehabilitar**: track out of service since before 2018, back in service
 *   and the State's.
 *
 * Crews work as for the polos. Four crews are the government's own pace and
 * cost (the official figures); fewer go slower and cheaper, with the same
 * exponents as the polos.
 */

export type GrupoObra = 'tren-maya' | 'carga' | 'interoceanico' | 'pasajeros' | 'rehabilitar';

export const GRUPOS_OBRA: { id: GrupoObra; nombre: string; texto: string }[] = [
  { id: 'tren-maya', nombre: 'Tren Maya', texto: 'Vía nueva por la península, en los tramos en que se licitó y construyó.' },
  { id: 'carga', nombre: 'Carga', texto: 'Ramales nuevos de carga.' },
  { id: 'interoceanico', nombre: 'Corredor Interoceánico', texto: 'Modernizar las líneas del propio Estado: más velocidad y más capacidad.' },
  { id: 'pasajeros', nombre: 'Trenes de pasajeros', texto: 'Doble vía del Estado junto a la vía de carga concesionada.' },
  { id: 'rehabilitar', nombre: 'Rehabilitar vías muertas', texto: 'Vías fuera de operación desde antes de 2018: vuelven al servicio y pasan al Estado.' },
];

export type Fuente = { dato: string; fuente: string; url: string };

export type ObraVia = TrazoObra & {
  nombre: string;
  grupo: GrupoObra;
  /** Official cost per km, millions of pesos (the government's pace: 4 crews). */
  costoMdpKm: number;
  costo: Fuente;
  /** Months it takes with 4 crews: the government's pace. */
  mesesGobierno: number;
  tiempo: Fuente;
  /** What happened, or is happening, in reality. */
  real: string;
  /** Known km (new track, rehabilitations); the rest are measured on the network. */
  km?: number;
};

type ObrasJson = {
  corte: string;
  nota: string;
  trazosFuente: Fuente;
  obras: (Omit<ObraVia, 'trazo'> & { trazo?: number[][] })[];
};
const DATOS = OBRAS_JSON as unknown as ObrasJson;

export const OBRAS_VIA: ObraVia[] = DATOS.obras.map((o) => ({ ...o, trazo: o.trazo?.map((p) => [p[0], p[1]] as LonLat) }));
export const TRAZOS_FUENTE = DATOS.trazosFuente;
export const obraVia = (id: string) => OBRAS_VIA.find((o) => o.id === id) ?? null;

export const TIPOS_OBRA: Record<ObraVia['tipo'], string> = {
  nueva: 'Vía nueva',
  paralela: 'Doble vía paralela del Estado',
  modernizar: 'Modernización de vía del Estado',
  rehabilitar: 'Rehabilitación',
};

// ---- what a work takes ---------------------------------------------------------------------

/** The work as laid on the 2018 network: its km and the lines to draw for it. */
export type Medida = { km: number; piezas: LonLat[][] };

/** Measures every work once, on the network without works (so a parallel line never follows another). */
export function medirObras(red: Red): Map<string, Medida> {
  const out = new Map<string, Medida>();
  for (const o of OBRAS_VIA) {
    if (o.tipo === 'nueva' && o.trazo) {
      out.set(o.id, { km: o.km ?? 0, piezas: [o.trazo] });
    } else if (o.tipo === 'rehabilitar' && o.bases) {
      const bases = new Set(o.bases);
      const piezas = red.tramos.filter((t) => bases.has(t.base)).map((t) => t.puntos);
      out.set(o.id, { km: o.bases.reduce((s, b) => s + (red.vias[b]?.km ?? 0), 0), piezas });
    } else if (o.paradas) {
      const pasos = recorridoDeParadas(red, o.paradas);
      if (pasos) out.set(o.id, { km: pasos.reduce((s, t) => s + t.km, 0), piezas: pasos.map((t) => t.puntos) });
    }
  }
  return out;
}

/** What any State work takes with some number of crews: rail works and CFE plants alike. */
export type PresupuestoObra = {
  cuadrillas: number;
  /** Millions of pesos, all told. */
  costoMdp: number;
  meses: number;
  horas: number;
  /** People working on it at once. */
  personasEnObra: number;
};

export type PresupuestoVia = {
  cuadrillas: number;
  km: number;
  /** Millions of pesos, all told. */
  costoMdp: number;
  meses: number;
  horas: number;
  /** People working on it at once. */
  personasEnObra: number;
};

/** Four crews cost this much more than one (each extra crew adds 15 % of one crew's cost). */
const SOBRECOSTO_4 = 1 + SOBRECOSTO_POR_CUADRILLA * (MAX_CUADRILLAS - 1);

/**
 * Any State work from its official cost and time (the government's pace: 4
 * crews): fewer crews make it cheaper and slower, with the polos' exponents.
 */
export function presupuestarObra(costoGobiernoMdp: number, mesesGobierno: number, cuadrillas: number): PresupuestoObra {
  const n = Math.max(1, Math.min(MAX_CUADRILLAS, Math.round(cuadrillas)));
  const costoMdp = (costoGobiernoMdp / SOBRECOSTO_4) * (1 + SOBRECOSTO_POR_CUADRILLA * (n - 1));
  const meses = mesesGobierno * (MAX_CUADRILLAS / n) ** EXPONENTE_CUADRILLAS;
  return {
    cuadrillas: n,
    costoMdp,
    meses,
    horas: meses * HORAS_POR_MES,
    personasEnObra: (costoMdp * cifra('empleosAnioPorMdp')) / (meses / 12),
  };
}

export function presupuestarVia(o: ObraVia, km: number, cuadrillas: number): PresupuestoVia {
  return { ...presupuestarObra(km * o.costoMdpKm, o.mesesGobierno, cuadrillas), km };
}

// ---- a work's life ------------------------------------------------------------------------

export type FaseObraVia = 'por-construir' | 'en-obra' | 'en-servicio';

export type ObraViaEstado = {
  id: string;
  fase: FaseObraVia;
  plan: PresupuestoObra | null;
  /** 0–1. */
  avance: number;
  pagadoMdp: number;
  /** Stopped: the money ran out. It goes on by itself when there's money again. */
  detenida: boolean;
  /** Game hour it went into service. */
  enServicioDesde: number | null;
};

export const obraViaNueva = (id: string): ObraViaEstado => ({
  id,
  fase: 'por-construir',
  plan: null,
  avance: 0,
  pagadoMdp: 0,
  detenida: false,
  enServicioDesde: null,
});

/** Move a work `horas` forward, paid as it goes. True on the hour it's finished. */
export function avanzarObraVia(o: ObraViaEstado, horas: number, caja: Caja, ahora: number): boolean {
  if (o.fase !== 'en-obra' || !o.plan) return false;
  if (!pagarAvance(o, horas, caja)) return false;
  o.fase = 'en-servicio';
  o.enServicioDesde = ahora;
  return true;
}

export function personasEnObraVia(o: ObraViaEstado): number {
  return o.fase === 'en-obra' && o.plan && !o.detenida ? o.plan.personasEnObra : 0;
}
