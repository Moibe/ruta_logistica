import DATOS from './datos/exportaciones.json';
import ADUANAS_JSON from './datos/aduanas.json';

/**
 * Exports, in the mixed cargo approach: domestic cargo will be just a number,
 * but an export goes from an origin to an exit, and that's what the game
 * measures (`datos/exportaciones.json`, `datos/aduanas.json`, every figure with
 * its source).
 *
 * - **Exits** are the customs offices a train can reach: border crossings,
 *   sea ports and the airports with their own customs office (ANAM), plus the
 *   ports the railway yearbook counts rail exports through.
 * - **Origins** are every other station. Each state generates export cargo at
 *   its share of the country's export value (INEGI) times the tonnes that leave
 *   the country by rail that year (ATTRAPI): an estimate of the game's. The
 *   cargo waits at the state's stations, up to a month of it.
 * - **A train** loads up to the average net load of a Mexican freight train
 *   at the origins it stops at, and unloads at the first exit it reaches: that
 *   is an export.
 */

type Fuente = { fuente: string; url: string; dato?: string };

export type TipoAduana = 'fronteriza' | 'interior' | 'maritima';
export type Aduana = {
  id: string;
  nombre: string;
  tipo: TipoAduana;
  /** Its site on the board, when it has one. */
  sitio: string | null;
  /** A train can leave the country through it. */
  salida: boolean;
  /** Million pesos collected in 2025. */
  recaudacion2025: number;
  /** Million pesos of goods cleared in 2025, imports and exports together. */
  valorOperaciones2025: number;
};

type ExportJson = {
  fuentes: Record<'inegi' | 'attrapi' | 'cargaPorTren', Fuente>;
  cargaPorTren: number;
  /** Million USD by state and year. */
  porEstado: Record<string, Record<string, number>>;
  totalPais: Record<string, number>;
  /** Million tonnes by year. */
  ferrocarril: Record<'exportacion' | 'importacion' | 'exportacionFronteras' | 'exportacionPuertos', Record<string, number>>;
  /** Million tonnes exported by rail through each exit in 2025. */
  porSalida2025: Record<string, number>;
};
type AduanasJson = { fuente: Fuente; creacion: Fuente; aduanas: Aduana[]; salidas: string[] };

export const EXPORTACIONES = DATOS as unknown as ExportJson;
const ADUANAS_DATOS = ADUANAS_JSON as unknown as AduanasJson;
export const ADUANAS = ADUANAS_DATOS.aduanas;
export const FUENTE_ADUANAS = ADUANAS_DATOS.fuente;
export const CREACION_ANAM = ADUANAS_DATOS.creacion;

/** Tonnes a freight train carries: the system's average net load per train. */
export const CARGA_POR_TREN = EXPORTACIONES.cargaPorTren;
/** Sites a train exports through. */
export const SALIDAS: ReadonlySet<string> = new Set(ADUANAS_DATOS.salidas);
/** The customs office at each site that has one (exit or not). */
export const ADUANA_DEL_SITIO = new Map(ADUANAS.filter((a) => a.sitio).map((a) => [a.sitio!, a] as const));

const AÑOS = Object.keys(EXPORTACIONES.totalPais).map(Number);
const HORAS_AÑO = 365.25 * 24;
/** A state's waiting export cargo holds at most this many days of its flow. */
export const DIAS_EN_ESPERA = 30;

/** The data year for a game year: before the series, its first; after, its last. */
export const añoDeDatos = (año: number) => Math.max(AÑOS[0], Math.min(año, AÑOS[AÑOS.length - 1]));

/** Tonnes of export cargo a state generates per game hour in `año` (estimate: its value share times rail exports). */
export function flujoDelEstado(estado: string, año: number): number {
  const a = String(añoDeDatos(año));
  const valor = EXPORTACIONES.porEstado[a]?.[estado] ?? 0;
  if (!valor) return 0;
  const parte = valor / EXPORTACIONES.totalPais[a];
  return (parte * EXPORTACIONES.ferrocarril.exportacion[a] * 1e6) / HORAS_AÑO;
}

/** The states that export anything, for the clock to walk through. */
export const ESTADOS_EXPORTADORES = Object.keys(EXPORTACIONES.porEstado[String(AÑOS[AÑOS.length - 1])]);
