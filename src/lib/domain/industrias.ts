import DATOS from './datos/industrias.json';
import type { ClaveEstado } from './sitios';
import type { LonLat } from './geo';

/**
 * The big private industries (`datos/industrias.json`, from `scripts/industrias/gen-industrias.mjs`):
 * plants and parks the player doesn't build but that live off the network, each with its place, its
 * dates and its sources. For now the light vehicle assembly plants, with their company's yearly
 * production and exports (INEGI, RAIAVL: by brand, not by plant), the logistics parks, and what the
 * mines feed: the integrated steel mills and the copper smelter.
 *
 * They're on the board from the day they start working until the day they stop, in both modes:
 * like the private power plants, they come on their own dates.
 */

type Fuente = { fuente: string; url: string };

export type TipoIndustria = 'armadora' | 'logistica' | 'acerera' | 'metalurgica';

export type Empresa = {
  nombre: string;
  /** Its brands in the RAIAVL. */
  marcas: string[];
  /** Units per year: production in Mexico and exports. */
  serie: Record<string, { produccion: number; exportacion: number }>;
  fuentes: string[];
};

export type Industria = {
  id: string;
  nombre: string;
  /** Short name for the map's label. */
  corto: string;
  tipo: TipoIndustria;
  /** The company whose figures it shares (`Empresa`), when it's a carmaker. */
  empresa?: string;
  municipio: string;
  estado: ClaveEstado;
  lonLat: LonLat;
  /** Where `lonLat` comes from. */
  ubicacion: string;
  /** What it makes or does. */
  que: string;
  /** When it started working (when a source says) and when it stopped, as precise as known ("1967", "2019-06"). */
  desde?: string;
  hasta?: string;
  /** When its construction started (when a source says): on the board, hollow, from then until `desde`. */
  obraDesde?: string;
  /** What its sources say about rail. */
  tren?: string;
  /** A note for its card (a plant that changed hands, a park's link to an airport). */
  nota?: string;
  fuentes: string[];
};

type IndustriasJson = {
  corte: string;
  fuentes: Record<string, Fuente>;
  /** The last year's months in the RAIAVL. */
  parcial: { año: number; meses: number };
  empresas: Record<string, Empresa>;
  plantas: Industria[];
};

const D = DATOS as unknown as IndustriasJson;
export const INDUSTRIAS: readonly Industria[] = D.plantas;
export const EMPRESAS_INDUSTRIA = D.empresas;
export const FUENTES_INDUSTRIA = D.fuentes;
export const PARCIAL_RAIAVL = D.parcial;

/** The company's plants on the board (all its dates), for a card that shares its figures. */
export const plantasDe = (empresa: string) => INDUSTRIAS.filter((p) => p.empresa === empresa);

/** The year whose figures a card shows at `año`: that one, within the register's years. */
export function añoRaiavl(año: number): number {
  const años = Object.keys(Object.values(D.empresas)[0]?.serie ?? {}).map(Number);
  return Math.max(Math.min(...años), Math.min(año, Math.max(...años)));
}
