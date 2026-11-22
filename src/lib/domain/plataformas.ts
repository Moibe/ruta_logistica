import DATOS from './datos/plataformas.json';
import { añoDe } from './calendario';

/**
 * Pemex's offshore oil in the Bay of Campeche (`datos/plataformas.json`,
 * every figure with its source). Some 240 platforms, grouped as Pemex reports
 * its production: one complex per production asset.
 *
 * - **The crude** reaches the shore by submarine pipeline (to Dos Bocas, or
 *   it's loaded at sea at Cayo Arcas on the buyers' ships): it isn't the
 *   player's to carry. Each complex produces its real crude of the year.
 * - **The supplies** — people, diesel, water, pipe, equipment — go by sea
 *   from the supply bases (Dos Bocas and Ciudad del Carmen). That is the
 *   player's: supply vessels load at a base and unload at the complexes.
 * - **A complex short of supplies produces less**: how well it has been
 *   supplied over the last month sets its output, down to a floor.
 */

type Fuente = { fuente: string; url: string };
type Dato = { dato: string; fuentes: string[] };
type Serie = Record<string, number>;

export type Complejo = {
  id: string;
  nombre: string;
  /** For the map label. */
  corto: string;
  /** Pemex's production block. */
  bloque: string;
  /** Its main processing center. */
  centro: string;
  estado: string;
  lonLat: [number, number];
  /** Platforms of its processing center, when a source gives them. */
  plataformasCentro?: number;
  ubicacion: Dato;
};

type ComplejoJson = Omit<Complejo, 'lonLat'> & { lon: number; lat: number };

type PlataformasJson = {
  corte: string;
  fuentes: Record<string, Fuente>;
  complejos: ComplejoJson[];
  /** Crude each complex produced each year, Mbd (and Pemex's whole production). */
  produccion: { porComplejo: Record<string, Serie>; total: Serie; parcial: Record<string, string> } & Dato;
  /** The export terminal at sea, with its crude exports (tonnes). */
  cayoArcas: { nombre: string; lon: number; lat: number; exportacion: Serie } & Dato;
  /** Tonnes of supplies the complexes take in a year, and how they're shared out. */
  abasto: { toneladasAño: number } & Dato;
  /** Tonnes a supply vessel carries. */
  barco: { toneladas: number } & Dato;
  /** Ports supplies load at. */
  bases: string[];
  /** Rules: days of supplies a complex stores, the month its output remembers, the floor it falls to. */
  reglas: { diasReserva: number; diasMemoria: number; piso: number } & Dato;
};

const P = DATOS as unknown as PlataformasJson;
export const PLATAFORMAS = P;
export const fuentePlataformas = (k: string) => P.fuentes[k];

export const COMPLEJOS: Complejo[] = P.complejos.map(({ lon, lat, ...c }) => ({ ...c, lonLat: [lon, lat] }));
export const complejo = (id: string) => COMPLEJOS.find((c) => c.id === id) ?? null;
export const CAYO_ARCAS = { ...P.cayoArcas, lonLat: [P.cayoArcas.lon, P.cayoArcas.lat] as [number, number] };

/** Supply bases: a supply vessel loads there. */
export const BASES_ABASTO: ReadonlySet<string> = new Set(P.bases);
/** Tonnes a supply vessel carries. */
export const TONELADAS_ABASTECEDOR = P.barco.toneladas;
export const DIAS_RESERVA = P.reglas.diasReserva;
export const DIAS_MEMORIA = P.reglas.diasMemoria;
export const PISO = P.reglas.piso;

const AÑOS = Object.keys(P.produccion.total).map(Number);
const enSerie = (año: number) => String(Math.max(AÑOS[0], Math.min(año, AÑOS[AÑOS.length - 1])));

/** A complex's real crude in a game year, Mbd (later years repeat the last). */
export const produccionComplejo = (id: string, año: number) => P.produccion.porComplejo[id]?.[enSerie(año)] ?? 0;
/** Pemex's real crude in a game year, Mbd. */
export const produccionTotal = (año: number) => P.produccion.total[enSerie(año)];
/** What doesn't come from the four complexes: onshore and the rest, Mbd. */
export const produccionFuera = (año: number) =>
  produccionTotal(año) - COMPLEJOS.reduce((s, c) => s + produccionComplejo(c.id, año), 0);

/** Tonnes of supplies a complex takes a day that year: its share of the complexes' crude (an estimate). */
export function abastoDiario(id: string, año: number): number {
  const total = COMPLEJOS.reduce((s, c) => s + produccionComplejo(c.id, año), 0);
  return total > 0 ? ((P.abasto.toneladasAño / 365) * produccionComplejo(id, año)) / total : 0;
}

/** Output of a complex from how well supplied it has been (0–1): the floor when never, all of it when always. */
export const factorAbasto = (surtido: number) => PISO + (1 - PISO) * Math.max(0, Math.min(1, surtido));

/** Crude a complex produces now in the game, Mbd. */
export const produccionJuego = (id: string, horas: number, surtido: number) => produccionComplejo(id, añoDe(horas)) * factorAbasto(surtido);
