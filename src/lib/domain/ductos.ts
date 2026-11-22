import DATOS from './datos/ductos.json';
import type { LonLat } from './geo';
import type { EtapaReal } from './realidad';

/**
 * The pipelines of the board (`datos/ductos.json`, built by
 * `scripts/ductos/gen-ductos.mjs`, every figure with its source): natural gas
 * (the State's national network run by the CENAGAS, the private pipelines
 * integrated to it, the private ones outside it and the import lines on the US
 * side), petroleum products and crude.
 *
 * Most of what came after 2018 was built by private transporters under CFE
 * contracts: those pipelines arrive on their real dates, in the game as in
 * Realidad, like the private power plants. The State's gas work is the Cuxtal
 * II, the Mayakan's expansion: the only way gas reaches the Yucatán peninsula,
 * and what lets its new combined cycles run (`energia.ts`).
 */

export type TipoDucto = 'gas' | 'petroliferos' | 'crudo';
/** sng: the State's national network (CENAGAS); sistrangas: private, integrated to it; privado: private outside it; importacion: US side; pemex: Pemex Logística. */
export type RedDucto = 'sng' | 'sistrangas' | 'privado' | 'importacion' | 'pemex';
type Fuente = { fuente: string; url: string };

export type Ducto = {
  id: string;
  nombre: string;
  tipo: TipoDucto;
  red: RedDucto;
  operador: string;
  /** Official length of the line (a SISTRANGAS segment carries its whole tramo's). */
  km: number | null;
  /** Gas: million cubic feet a day (MMpcd). Petroleum: barrels a day. */
  capacidad?: number | null;
  permiso?: string | null;
  /** It has a real record (`ductos-real.json`, by its own id): it comes after December 2018. */
  real?: boolean;
  /** Out of service (Guaymas–El Oro). */
  fuera?: { desde: string; texto: string; fuentes: string[] };
  nota?: string;
  /** Drawn by the game through the places the sources name. */
  aproximado?: boolean;
  fuente: string;
  trazo: LonLat[][];
};

export type ObraGas = {
  id: string;
  nombre: string;
  region: string;
  /** The pipeline whose corridor it follows (the Mayakan). */
  ducto: string;
  km: number;
  /** What reaches the region once it's in service, MMpcd. */
  capacidad: number;
  costoMusd: number;
  costo: Fuente & { dato: string };
  mesesGobierno: number;
  tiempo: Fuente & { dato: string };
  real: string;
};

export type GasRegion = {
  /** MMpcd that reach the region through its pipelines in 2018. */
  capacidad: number;
  /** The work that raises it, and to how much. */
  obra: string;
  capacidadConObra: number;
  ducto: string;
  dato: string;
  fuentes: string[];
};

type DuctosJson = {
  corte: string;
  nota: string;
  fuentes: Record<string, Fuente>;
  totales: Record<string, number> & { dato: string; fuentes: string[] };
  gas: {
    mmpcdPorMW: number;
    factorDato: string;
    factorFuentes: string[];
    regiones: Record<string, GasRegion>;
    obras: ObraGas[];
  };
  ductos: (Omit<Ducto, 'trazo'> & { trazo: number[][][] })[];
};

const D = DATOS as unknown as DuctosJson;

export const DUCTOS: Ducto[] = D.ductos.map((d) => ({ ...d, trazo: d.trazo.map((l) => l.map((p) => [p[0], p[1]] as LonLat)) }));
export const ducto = (id: string) => DUCTOS.find((d) => d.id === id) ?? null;
export const fuenteDucto = (k: string) => D.fuentes[k];
export const TOTALES_DUCTOS = D.totales;
/** MMpcd of gas a combined cycle burns per MW at full load (EIA figures, a game calculation). */
export const MMPCD_POR_MW = D.gas.mmpcdPorMW;
export const FACTOR_GAS = { dato: D.gas.factorDato, fuentes: D.gas.factorFuentes };
/** Regions the gas reaching them limits: the peninsula, through the Mayakan alone. */
export const GAS_REGIONES = new Map(Object.entries(D.gas.regiones));
export const OBRAS_GAS = D.gas.obras;
export const obraGas = (id: string) => OBRAS_GAS.find((o) => o.id === id) ?? null;

/** How a pipeline stands on the board: running, being built (dashed), out of service, or not there yet. */
export type SituacionDucto = 'opera' | 'obra' | 'fuera' | 'no';

/** A pipeline's situation from its real stage (pipelines after 2018), or by what it is. */
export function situacionDucto(d: Ducto, etapa: EtapaReal | null): SituacionDucto {
  if (d.fuera) return 'fuera';
  if (!d.real) return 'opera';
  return etapa === 'en-operacion' ? 'opera' : etapa === 'en-obra' ? 'obra' : 'no';
}

/** "2,600 millones de pies cúbicos diarios", "25,000 barriles diarios". */
export function capacidadDucto(d: Ducto): string | null {
  if (!d.capacidad) return null;
  const n = Math.round(d.capacidad).toLocaleString('es-MX');
  return d.tipo === 'gas' ? `${n} millones de pies cúbicos diarios` : `${n} barriles diarios`;
}

export const NOMBRE_RED: Record<RedDucto, string> = {
  sng: 'Gasoducto del Estado (Sistema Nacional, CENAGAS)',
  sistrangas: 'Gasoducto privado integrado al sistema nacional',
  privado: 'Gasoducto privado',
  importacion: 'Gasoducto de importación (Estados Unidos)',
  pemex: 'Ducto de Pemex',
};
