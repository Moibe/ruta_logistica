import DATOS from './datos/mineria.json';
import type { LonLat } from './geo';
import type { ClaveEstado } from './sitios';

/**
 * The big heavy-tonnage mines (`datos/mineria.json`, from `scripts/mineria/gen-mineria.mjs`): iron,
 * coal, copper and salt, each with its place, what it sends where, its dates and its sources. They
 * are the raw material of the board's other industries (steel mills, the copper smelter, the
 * coal-fired plants) and of its ports; for now they're cards, they don't move cargo yet.
 *
 * Like the big industries, a mine is on the board until the day it stops, in both modes.
 */

type Fuente = { fuente: string; url: string };

export type Mineral = 'hierro' | 'carbon' | 'cobre' | 'sal';
export const NOMBRE_MINERAL: Record<Mineral, string> = { hierro: 'hierro', carbon: 'carbón', cobre: 'cobre', sal: 'sal' };

export type Mina = {
  id: string;
  nombre: string;
  corto: string;
  mineral: Mineral;
  empresa: string;
  municipio: string;
  estado: ClaveEstado;
  lonLat: LonLat;
  /** Where `lonLat` comes from. */
  ubicacion: string;
  que: string;
  /** What `serie` counts ("concentrado de cobre"). */
  unidad: string;
  /** Tonnes a year, the years a source gives. */
  serie: Record<string, number>;
  /** Where its product goes, as its sources say it. */
  destino: string;
  /** The board's sites it feeds (`industria:<id>`, `puerto:<id>`, `central:<id>`). */
  destinos: string[];
  desde?: string;
  hasta?: string;
  nota?: string;
  fuentes: string[];
};

type MineriaJson = {
  corte: string;
  fuentes: Record<string, Fuente>;
  nacional: { dato: string; fuentes: string[] } & Record<Mineral, Record<string, number>>;
  minas: Mina[];
};

const D = DATOS as unknown as MineriaJson;
export const MINAS: readonly Mina[] = D.minas;
export const FUENTES_MINERIA = D.fuentes;
export const MINERIA_NACIONAL = D.nacional;

/** The mine's figure a card shows at `año`: the latest year with data up to it, or its first. */
export function cifraMina(m: Mina, año: number): { año: number; toneladas: number } | null {
  const años = Object.keys(m.serie).map(Number).sort((a, b) => a - b);
  if (!años.length) return null;
  const a = años.filter((x) => x <= año).pop() ?? años[0];
  return { año: a, toneladas: m.serie[String(a)] };
}
