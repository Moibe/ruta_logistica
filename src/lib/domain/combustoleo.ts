import DATOS from './datos/combustoleo.json';
import { REFINERIAS_DE_COSTA, PUERTO_DE_REFINERIA, type Costa } from './combustibles';
import { ENERGIA } from './energia';
import type { LonLat } from './geo';
import { OBRAS_PEMEX, REFINERIAS, type EstadoPemex, type Refinacion } from './petroleo';
import { PUERTOS } from './sitios';

/**
 * Fuel oil (`datos/combustoleo.json`, every figure with its source). The
 * refineries make it with their crude and the CFE burns it in its steam and
 * internal-combustion plants; what's left is exported.
 *
 * - **Made.** Each refinery, in step with its crude, at its own 2019–2020
 *   yield (ASF). The Olmeca makes none, and a coker takes off its refinery's
 *   as many barrels as the gasoline and diesel it adds (Tula's, Tula's first
 *   and then Salamanca's).
 * - **Burned.** Each plant its 2018 share of its generation company's fuel
 *   oil (CFE, Informe Anual 2018), fixed like the country's use of fuels.
 * - **How it gets there.** Tula, Salamanca and Altamira by pipeline from the
 *   refinery next to them, as far as it makes. The rest at the plant's port
 *   or station: half on its own (Pemex's rented tankers or the private
 *   railroads, from the refineries' yards or else imported), half on the
 *   player's tankers and trains, up to 15 days of it in store.
 * - **Short of it** a plant gives fewer MW to its region, down to half with
 *   none (a game rule, like Nava without coal).
 * - **What the refineries can't keep** (15 days in the yard) is exported.
 */

type Fuente = { fuente: string; url: string };
type Dato = { dato: string; fuentes: string[] };

export type CentralCombustoleo = {
  id: string;
  /** Its name in the energy data (`energia.json`, PRODESEN). */
  planta: string;
  empresa: string;
  /** MW of its steam and internal-combustion units: what its fuel oil feeds. */
  mw: number;
  mwDato?: string;
  /** Its fuel, as the PRODESEN gives it. */
  combustible: string;
  /** The refinery next to it whose pipeline brings it fuel oil. */
  ducto?: string;
  /** Where trains and tankers deliver the rest: a port, a station of its own, or its refinery's. */
  entrega: string;
  entregaDato?: string;
  /** Thousand barrels a day it burns. */
  mbd: number;
  region: string;
};

type CombustoleoJson = {
  corte: string;
  nota: string;
  fuentes: Record<string, Fuente>;
  unidades: { barrilesPorM3: number; barrilesPorTonelada: number; mjPorBarril: number } & Dato;
  refinerias: Record<string, { rendimiento: number } & Dato>;
  produccion: { calculado2018: number; real2018: number } & Dato;
  coquizadoras: Record<string, { refinerias: string[] } & Dato>;
  empresas: ({ id: string; nombre: string; m3?: number; tcal?: number; mbd: number; centrales: string[] } & Dato)[];
  centrales: CentralCombustoleo[];
  cfe: { mbd: number } & Dato;
  reglas: { parteAutomatica: number; piso: number; diasReserva: number; diasPatio: number } & Dato;
  importacionCfe: { puerto: string } & Dato;
  modos2018: { buque: number; carrotanque: number; trenToneladas: number } & Dato;
  real: { produccion: Record<string, number>; importacion: Record<string, number>; exportacion: Record<string, number>; parcial: Record<string, string> } & Dato;
  /** Fuel oil the whole CFE burned each year (thousand m³) and its share of 2018's; which years are the game's estimate. */
  demanda: { milesM3: Record<string, number>; factor: Record<string, number>; estimados: string[] } & Dato;
};

export const COMBUSTOLEO = DATOS as unknown as CombustoleoJson;
export const fuenteCombustoleo = (k: string) => COMBUSTOLEO.fuentes[k];

/** Tonnes per barrel of fuel oil (EIA: 6.66 barrels a tonne). */
export const T_POR_BARRIL_CO = 1 / COMBUSTOLEO.unidades.barrilesPorTonelada;
/** Game rules: the share that gets there on its own, what a plant gives with none, days in store. */
export const PARTE_AUTOMATICA_CO = COMBUSTOLEO.reglas.parteAutomatica;
export const PISO_CO = COMBUSTOLEO.reglas.piso;
export const DIAS_RESERVA_CO = COMBUSTOLEO.reglas.diasReserva;
export const DIAS_PATIO_CO = COMBUSTOLEO.reglas.diasPatio;

const PLANTAS = new Map(ENERGIA.plantas2018.map((p) => [p.nombre, p]));

export type Central = CentralCombustoleo & {
  /** Short name for cards and boards. */
  nombre: string;
  estado: string;
  lonLat: LonLat;
  /** How what doesn't come by pipeline arrives: by sea at a port, or by rail. */
  llega: 'barco' | 'tren';
  /** The refineries its automatic half is taken from, nearest first: its coast's for a port, any for a station. */
  fuentes: string[];
};

const kmEntre = (a: LonLat, b: LonLat) => {
  const r = Math.PI / 180;
  const x = (b[0] - a[0]) * r * Math.cos(((a[1] + b[1]) / 2) * r);
  const y = (b[1] - a[1]) * r;
  return 6371 * Math.hypot(x, y);
};
const MEXICANAS = REFINERIAS.filter((r) => !r.extranjera);

export const CENTRALES_CO: Central[] = COMBUSTOLEO.centrales.map((c) => {
  const p = PLANTAS.get(c.planta)!;
  const llega = c.entrega.startsWith('puerto:') ? 'barco' : 'tren';
  const costa = llega === 'barco' ? (PUERTOS.find((x) => `puerto:${x.id}` === c.entrega)?.litoral as Costa | undefined) : undefined;
  const candidatas = costa ? MEXICANAS.filter((r) => (REFINERIAS_DE_COSTA.get(costa) ?? []).includes(r.id)) : MEXICANAS;
  return {
    ...c,
    nombre: p.nombre.replace(/ TC y Cogeneración$/, ''),
    estado: p.estado,
    lonLat: p.lonLat,
    llega,
    fuentes: [...candidatas].sort((a, b) => kmEntre(a.lonLat, p.lonLat) - kmEntre(b.lonLat, p.lonLat)).map((r) => r.id),
  };
});
export const CENTRAL_CO = new Map(CENTRALES_CO.map((c) => [c.id, c]));
/** The fuel-oil plants by their name in the energy data (the map's power plants). */
export const CENTRAL_CO_DE_PLANTA = new Map(CENTRALES_CO.map((c) => [c.planta, c]));
/** The plants each stop delivers to. */
export const ENTREGAS_CO = new Map<string, Central[]>();
for (const c of CENTRALES_CO) ENTREGAS_CO.set(c.entrega, [...(ENTREGAS_CO.get(c.entrega) ?? []), c]);

/** The port a refinery's fuel oil leaves by sea, if it has one. */
export const puertoDeRefineria = (id: string) => PUERTO_DE_REFINERIA.get(id) ?? null;

/** Thousand barrels a day of fuel oil each Mexican refinery makes, with the works as they stand. */
export function combustoleoJuego(r: Refinacion, e: EstadoPemex): Map<string, number> {
  const m = new Map<string, number>();
  for (const ref of MEXICANAS) m.set(ref.id, (r.porRefineria.get(ref.id)?.proceso ?? 0) * (COMBUSTOLEO.refinerias[ref.id]?.rendimiento ?? 0));
  // A coker takes off as many barrels of fuel oil as the gasoline and diesel it adds, refinery by refinery.
  for (const [obra, c] of Object.entries(COMBUSTOLEO.coquizadoras)) {
    if (e.avance(obra) < 1) continue;
    let quita = OBRAS_PEMEX.find((o) => o.id === obra)?.combustiblesExtra ?? 0;
    for (const id of c.refinerias) {
      const x = Math.min(quita, m.get(id) ?? 0);
      m.set(id, (m.get(id) ?? 0) - x);
      quita -= x;
    }
  }
  return m;
}

/** What a plant gives (0–1 of its MW) supplied this well in the last month. */
export const factorCentral = (surtido: number) => PISO_CO + (1 - PISO_CO) * Math.max(0, Math.min(1, surtido));
/** MW a plant fails to give its region for want of fuel oil. */
export const mwSinCombustoleo = (c: CentralCombustoleo, surtido: number) => c.mw * (1 - factorCentral(surtido));

/** Share of its 2018 fuel oil the CFE burned in a year (the last known one after it). */
const AÑOS_DEMANDA = Object.keys(COMBUSTOLEO.demanda.factor).map(Number).sort((a, b) => a - b);
export function factorDemandaCo(año: number): number {
  const a = AÑOS_DEMANDA.filter((x) => x <= año).pop() ?? AÑOS_DEMANDA[0];
  return COMBUSTOLEO.demanda.factor[String(a)] ?? 1;
}
/** Thousand barrels a day a plant burns in a year: its 2018 share of what the whole CFE burned. */
export const mbdCentralCo = (c: CentralCombustoleo, año: number) => c.mbd * factorDemandaCo(año);

/** Thousand barrels a day the pipeline brings a plant now, from what its refinery makes. */
export const porDuctoCo = (c: CentralCombustoleo, produccion: ReadonlyMap<string, number>, año: number) =>
  c.ducto ? Math.min(mbdCentralCo(c, año), produccion.get(c.ducto) ?? 0) : 0;

/** The real year: what Pemex made, imported and exported, Mbd (null when not published). */
export function realCombustoleo(año: number) {
  const a = String(año);
  const r = COMBUSTOLEO.real;
  if (r.produccion[a] === undefined) return null;
  return { produccion: r.produccion[a], importacion: r.importacion[a], exportacion: r.exportacion[a], parcial: r.parcial[a] ?? null };
}

/**
 * Barrels in a year: made by the refineries; burned by the CFE's plants and
 * how it got there — pipeline, Pemex's rented tankers, the private railroads,
 * the player's trains and tankers, imported; what was missing; and what the
 * refineries exported.
 */
export type CuentaCo = {
  producido: number;
  quemado: number;
  ducto: number;
  rentados: number;
  privados: number;
  tren: number;
  barco: number;
  importado: number;
  faltante: number;
  exportado: number;
  /** By refinery, what it exported. */
  exportadoDe: Record<string, number>;
  /** By plant, what it asked for and what it burned. */
  centrales: Record<string, { pide: number; quema: number }>;
};
export const cuentaCoVacia = (): CuentaCo => ({
  producido: 0,
  quemado: 0,
  ducto: 0,
  rentados: 0,
  privados: 0,
  tren: 0,
  barco: 0,
  importado: 0,
  faltante: 0,
  exportado: 0,
  exportadoDe: {},
  centrales: {},
});
