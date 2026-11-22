import DATOS from './datos/comercio-mar.json';
import type { ClaseBarco } from './barcos';

/**
 * Sea trade through the board's ports (`datos/comercio-mar.json`, every figure
 * with its source): what each port really exported and imported by sea in
 * 2024, by kind of cargo, and how much of it moves by rail.
 *
 * - **Exports** wait in the port's yard for a ship of their kind. What comes
 *   by road reaches the yard on its own, at the port's real rate; what comes
 *   by rail is what the player's trains bring (their export cargo, unloaded
 *   at the port, becomes the kind the port exports most).
 * - **Imports**: each port asks for its real imports of each kind. The
 *   player's ships load at a gateway (the far port) and unload where they're
 *   asked for. What leaves the port by rail waits in its yard for the
 *   player's trains, at the rail rate of the year (ATTRAPI).
 * - What the player's ships don't carry goes on the shipping lines' ships:
 *   a yard holds a month, and past that it isn't the player's.
 *
 * The game uses 2024 for every year: the per-port yearbook of 2018 isn't
 * published any more.
 */

export type TipoCarga = 'contenedores' | 'granel' | 'general';
export const TIPOS_CARGA: readonly TipoCarga[] = ['contenedores', 'granel', 'general'];
export const NOMBRE_CARGA: Record<TipoCarga, string> = {
  contenedores: 'contenedores',
  granel: 'granel',
  general: 'carga general',
};

type Fuente = { fuente: string; url: string };
type Dato = { dato: string; fuentes: string[] };
type PorTipo = Record<TipoCarga, number>;

export type ComercioPuerto = {
  /** Tonnes a year by sea, 2024. */
  exp: PorTipo;
  imp: PorTipo;
  /** Tonnes a year that reach the port by rail for export, and leave it by rail as imports (ATTRAPI 2025). */
  trenExp: number;
  trenImp: number;
  /** The kind a train's export cargo becomes here. */
  deTren: TipoCarga;
  /** Share of its exports that comes by road. */
  caminoExp: number;
  /** Share of its imports that leaves by rail. */
  trenImpParte: number;
};

type ComercioJson = {
  corte: string;
  fuentes: Record<string, Fuente>;
  puertos: Record<string, ComercioPuerto>;
  puertosDato: Dato;
  barcos: Record<'contenedores' | 'granel' | 'roro', { carga: TipoCarga; toneladas: number }> & Dato;
  reglas: { diasPatio: number; diasInicio: number } & Dato;
};

const C = DATOS as unknown as ComercioJson;
export const COMERCIO_MAR = C;
export const fuenteComercio = (k: string) => C.fuentes[k];

const HORAS_AÑO = 365.25 * 24;
/** A yard holds this many days of its port's flow; the game opens with `DIAS_INICIO`. */
export const DIAS_PATIO = C.reglas.diasPatio;
export const DIAS_INICIO = C.reglas.diasInicio;

/** The port's trade, by site key (`puerto:<id>`), or null for a port without data. */
export function comercioDe(clave: string): ComercioPuerto | null {
  return clave.startsWith('puerto:') ? (C.puertos[clave.slice('puerto:'.length)] ?? null) : null;
}

/** Ports with trade, by site key. */
export const PUERTOS_COMERCIO = Object.keys(C.puertos).map((id) => `puerto:${id}`);

/** The kind of cargo a class of ship carries, or null if it carries none of these. */
export function cargaDeClase(clase: ClaseBarco): TipoCarga | null {
  return clase === 'contenedores' || clase === 'granel' || clase === 'roro' ? C.barcos[clase].carga : null;
}

/** Tonnes a ship of that class carries per call. */
export function toneladasDeClase(clase: ClaseBarco): number {
  return clase === 'contenedores' || clase === 'granel' || clase === 'roro' ? C.barcos[clase].toneladas : 0;
}

/** Tonnes per hour of a port's exports of a kind that reach it by road. */
export const flujoExportacion = (p: ComercioPuerto, tipo: TipoCarga) => (p.exp[tipo] * p.caminoExp) / HORAS_AÑO;
/** Tonnes per hour of a port's imports of a kind. */
export const flujoImportacion = (p: ComercioPuerto, tipo: TipoCarga) => p.imp[tipo] / HORAS_AÑO;
/** Tonnes per hour of imports that leave the port by rail. */
export const flujoImportacionTren = (p: ComercioPuerto) => p.trenImp / HORAS_AÑO;

/** The most of a kind a port's export yard holds: a month of all of it, rail included. */
export const topeExportacion = (p: ComercioPuerto, tipo: TipoCarga) =>
  ((p.exp[tipo] * p.caminoExp + (tipo === p.deTren ? p.trenExp : 0)) / HORAS_AÑO) * 24 * DIAS_PATIO;
