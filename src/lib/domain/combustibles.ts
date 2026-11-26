import DATOS from './datos/combustibles.json';
import { añoDe } from './calendario';
import { CARGA_POR_TREN } from './exportaciones';
import { DEMANDA_COMBUSTIBLES, type Refinacion } from './petroleo';
import { PUERTOS } from './sitios';

/**
 * Fuels as cargo (`datos/combustibles.json`, every figure with its source).
 * What the game measures is how the gasoline, diesel and jet fuel the country
 * uses gets to it: from its own refineries — by pipeline, or on the player's
 * trains and tankers — or from abroad.
 *
 * - **Use.** Each state uses its share of the 1,231 thousand barrels a day the
 *   country used in December 2018 (the figure `petroleo.ts` measures against).
 * - **Pipelines are automatic.** A zone is a set of refineries and the part of
 *   each state their pipelines (and the trucks out of the terminals on them)
 *   reach. The zone's fuel goes to that part first, up to what it uses.
 * - **What a zone can't take** waits at its refineries, up to some days of it:
 *   in the yard for a train (a refinery is a station) or at its port for a
 *   tanker. Past that it has no way out.
 * - **What a state still lacks** — the part no pipeline reaches, and the rest
 *   when its zone falls short — a train or a tanker can bring, up to some days
 *   of it at once. The country's fuel always goes before imports.
 * - **Imports come in through a port**, each up to what it imported in 2018:
 *   a zone's through the ports at the head of its pipelines (past them, by
 *   land from the US); a sea-fed state's through its own. What a port can't
 *   import comes coastwise from its coast's hub: half on the tankers Pemex
 *   rents, half waiting there for the player's. What doesn't arrive is
 *   missing (measured, nothing more yet).
 * - **Crude** comes out of the ground at the country's real pace; what the
 *   Mexican refineries don't run is exported, on the buyers' ships, through
 *   four ports.
 */

type Fuente = { fuente: string; url: string };
type Dato = { dato: string; fuentes: string[] };

export type Zona = {
  id: string;
  nombre: string;
  /** Refineries whose fuel goes down the zone's pipelines (Deer Park's enters through an import terminal). */
  refinerias: string[];
  /** The part of each state's use the zone's pipelines reach (0–1). */
  estados: Record<string, number>;
} & Dato;

/** A year of the real series: Mbd, with the year's coverage when it isn't whole. */
type Serie = Record<string, number>;

/** How a Pemex terminal is supplied, as SENER's 2018 map says it. */
export type MedioTerminal = string;
/** Where its fuel comes from in the game: a zone's pipelines, the sea or the rail. */
export type RedTerminal = 'centro' | 'noreste' | 'sur' | 'mar' | 'tren';

export type Terminal = {
  nombre: string;
  estado: string;
  /** The 2018 map's region. */
  region: string;
  medio: MedioTerminal;
  /** Operating capacity, thousand barrels. */
  capacidad: number;
  lonLat: [number, number];
  red: RedTerminal;
  /** Where its supply comes from: the terminal it's trucked from, or the marine terminal its pipeline starts at. */
  desde?: string;
};

/** Petroleum through a port in a year, tonnes: imported, exported, received and sent coastwise. */
type MovimientoPuerto = [number, number, number, number];

export type Costa = 'golfo' | 'pacifico';

type CombustiblesJson = {
  corte: string;
  nota: string;
  fuentes: Record<string, Fuente>;
  /** Tonnes per barrel of the country's mix of gasoline, diesel and jet fuel. */
  densidad: { tPorBarril: number } & Dato;
  /** Barrels a Pemex tanker carries. */
  tanque: { barriles: number } & Dato;
  /** Each state's share of the country's use. */
  consumo: { año: number; parte: Record<string, number> } & Dato;
  zonas: Zona[];
  /** Each state's use split by how its terminals are supplied (0–1 by zone, `mar` and `tren`). */
  reparto: { porEstado: Record<string, Partial<Record<RedTerminal, number>>> } & Dato;
  terminales: Terminal[];
  /** Ports that also supply a neighbouring state without a port of its own. */
  surte: Record<string, string[]>;
  puertos: { porPuerto: Record<string, { '2018': MovimientoPuerto; '2024': MovimientoPuerto; nota?: string }> } & Dato;
  /** Where each coastal refinery loads tankers. */
  puertoDeRefineria: Record<string, string>;
  /**
   * Imports: the most each port takes from abroad (Mbd), the ports each zone
   * imports through, the share of a sea-fed state's fuel that comes through
   * each port, the hub of each coast, each of those ports' coast, and the
   * share of the coastwise trade Pemex's rented tankers carry.
   */
  importacion: {
    tope: Record<string, number>;
    puertasZona: Record<string, string[]>;
    puertaMar: Record<string, Record<string, number>>;
    concentradores: Record<Costa, string>;
    costa: Record<string, Costa>;
    parteRentados: number;
  } & Dato;
  /** Petroleum each of the four ports the game's crude leaves through shipped abroad in 2018, tonnes. */
  crudoPorPuerto: { toneladas: Record<string, number> } & Dato;
  /** Days of surplus a refinery holds, and days of a state's shortfall a delivery can cover at once. */
  dias: { patio: number; porSurtir: number } & Dato;
  real: {
    /** Pemex's crude production and crude exports, Mbd. */
    crudo: { produccion: Serie; exportacion: Serie; parcial: Record<string, string> } & Dato;
    /** Gasoline, diesel and jet fuel (querosenos): what Pemex made and imported, Mbd. */
    combustibles: {
      produccion: Serie;
      importacion: Serie;
      porProducto: Record<'gasolinas' | 'diesel' | 'querosenos', { produccion: Serie; importacion: Serie }>;
      parcial: Record<string, string>;
    } & Dato;
    /** Fuels moved by rail, millions of tonnes. */
    tren: { porAño: Record<string, { gasolina: number; diesel: number; combustoleo: number }> } & Dato;
    /** How Pemex moved what it moved in 2018 (crude and products), Mbd. */
    modos: { año: number; ducto: number; autotanque: number; carrotanque: number; buquetanque: number } & Dato;
  };
};

export const COMBUSTIBLES = DATOS as unknown as CombustiblesJson;
export const fuenteCombustibles = (k: string) => COMBUSTIBLES.fuentes[k];
export const ZONAS = COMBUSTIBLES.zonas;
export const REAL_COMBUSTIBLES = COMBUSTIBLES.real;

/** Tonnes per barrel of the fuel mix (EIA factors, weighted by what the country used). */
export const T_POR_BARRIL = COMBUSTIBLES.densidad.tPorBarril;
/** Barrels a freight train carries when all it carries is fuel: the average net load of a train. */
export const BARRILES_POR_TREN = CARGA_POR_TREN / T_POR_BARRIL;
/** Barrels a tanker carries. */
export const BARRILES_POR_TANQUE = COMBUSTIBLES.tanque.barriles;
export const DIAS_EN_PATIO = COMBUSTIBLES.dias.patio;
export const DIAS_POR_SURTIR = COMBUSTIBLES.dias.porSurtir;

/** The tanker port of each coastal refinery, and the refinery of each such port. */
export const PUERTO_DE_REFINERIA = new Map(Object.entries(COMBUSTIBLES.puertoDeRefineria));
export const REFINERIA_DEL_PUERTO = new Map([...PUERTO_DE_REFINERIA].map(([r, p]) => [p, r] as const));

export const ESTADOS_CONSUMO = Object.keys(COMBUSTIBLES.consumo.parte);

/** Thousand barrels a day a state uses. */
export const consumoDelEstado = (estado: string) => DEMANDA_COMBUSTIBLES * (COMBUSTIBLES.consumo.parte[estado] ?? 0);

/** The zone of each refinery, and the zones whose pipelines reach each state. */
export const ZONA_DE_REFINERIA = new Map(ZONAS.flatMap((z) => z.refinerias.map((r) => [r, z] as const)));
export const ZONAS_DEL_ESTADO = new Map(ESTADOS_CONSUMO.map((e) => [e, ZONAS.filter((z) => z.estados[e])] as const));
export const ZONA = new Map(ZONAS.map((z) => [z.id, z] as const));

/** How each state is supplied: the part by its zones' pipelines, by sea and by rail (0–1). */
export const REPARTO = COMBUSTIBLES.reparto.porEstado;
export const TERMINALES = COMBUSTIBLES.terminales;
export const PUERTOS_COMBUSTIBLE = COMBUSTIBLES.puertos.porPuerto;

/** The states a delivery at a site supplies: its own, plus the neighbours that come through it. */
export function estadosQueSurte(clave: string, estado: string): string[] {
  return [estado, ...(COMBUSTIBLES.surte[clave] ?? [])];
}

// ---- imports: through which port ------------------------------------------------------------------

export const IMPORTACION = COMBUSTIBLES.importacion;
/** The most a port takes from abroad, Mbd: what it imported in 2018 (0 if nothing). */
export const topeImportacion = (puerto: string) => IMPORTACION.tope[puerto] ?? 0;
/** Share of the coastwise trade Pemex's rented tankers carry on their own (a game rule). */
export const PARTE_RENTADOS = IMPORTACION.parteRentados;
/** Where a pipeline zone's imports come in, and what that adds up to (Mbd). */
export const PUERTAS_ZONA = new Map(Object.entries(IMPORTACION.puertasZona));
/** By sea-fed state, the share of what it gets by sea that comes through each port. */
export const PUERTA_MAR = new Map(Object.entries(IMPORTACION.puertaMar).map(([e, r]) => [e, Object.entries(r)] as const));
/** The ports the coastwise fuel leaves from, and the hub of each sea port. */
export const CONCENTRADORES = new Set(Object.values(IMPORTACION.concentradores));
export const concentradorDe = (puerto: string): string | null => {
  const c = IMPORTACION.costa[puerto];
  return c ? IMPORTACION.concentradores[c] : null;
};
/** The refineries whose fuel is loaded at a port of each coast: Pemex's rented tankers take it first. */
export const REFINERIAS_DE_COSTA = new Map<Costa, string[]>(
  (['golfo', 'pacifico'] as const).map((c) => [
    c,
    [...PUERTO_DE_REFINERIA].filter(([, p]) => PUERTOS.find((x) => `puerto:${x.id}` === p)?.litoral === c).map(([r]) => r),
  ])
);
export const costaDe = (puerto: string): Costa | null => IMPORTACION.costa[puerto] ?? null;

/** Where the crude exported now leaves, Mbd by port (Cayo Arcas as `cayo-arcas`), shared as in 2018. */
export function crudoPorPuerto(exportado: number): Map<string, number> {
  const t = COMBUSTIBLES.crudoPorPuerto.toneladas;
  const total = Object.values(t).reduce((s, x) => s + x, 0);
  return new Map(Object.entries(t).map(([p, x]) => [p, total > 0 ? (exportado * x) / total : 0]));
}
export const DATO_CRUDO_POR_PUERTO = COMBUSTIBLES.crudoPorPuerto.dato;

/**
 * How fuel gets around today, thousand barrels a day: what each state uses,
 * what its pipelines bring from the country's refineries, what it still
 * lacks, and what each refinery has left over for trains and tankers.
 */
export type Abasto = {
  consumo: Map<string, number>;
  porDucto: Map<string, number>;
  hueco: Map<string, number>;
  /** By refinery: fuel its zone can't take. */
  sobrante: Map<string, number>;
  /** By state, what it lacks split by how it's supplied: what each zone's pipelines don't cover, by sea, by rail. */
  faltaZona: Map<string, Map<string, number>>;
  porMar: Map<string, number>;
  porTren: Map<string, number>;
  /** By sea port: what its states ask of it, the most it imports, and the rest, which has to come coastwise. */
  puertos: Map<string, { pide: number; tope: number; cabotaje: number }>;
  /** By state: what has to come to it coastwise, and by hub, what its coast needs that way. */
  cabotaje: Map<string, number>;
  porConcentrador: Map<string, number>;
};

/** Barrels in `horas` hours of a flow of `mbd` thousand barrels a day. */
export const barrilesEn = (mbd: number, horas: number) => (mbd * 1000 * horas) / 24;

/** The flows of the game, with the refineries as they stand. */
export function abastoJuego(r: Refinacion): Abasto {
  const consumo = new Map(ESTADOS_CONSUMO.map((e) => [e, consumoDelEstado(e)]));
  const porDucto = new Map(ESTADOS_CONSUMO.map((e) => [e, 0]));
  const sobrante = new Map<string, number>();
  const faltaZona = new Map<string, Map<string, number>>();
  for (const z of ZONAS) {
    const prod = z.refinerias.reduce((s, id) => s + (r.porRefineria.get(id)?.combustibles ?? 0), 0);
    const demanda = Object.entries(z.estados).reduce((s, [e, f]) => s + (consumo.get(e) ?? 0) * f, 0);
    const llega = demanda > 0 ? Math.min(1, prod / demanda) : 0;
    for (const [e, f] of Object.entries(z.estados)) {
      porDucto.set(e, (porDucto.get(e) ?? 0) + (consumo.get(e) ?? 0) * f * llega);
      const falta = (consumo.get(e) ?? 0) * f * (1 - llega);
      if (falta > 0) faltaZona.set(e, (faltaZona.get(e) ?? new Map()).set(z.id, falta));
    }
    const sobra = Math.max(0, prod - demanda);
    for (const id of z.refinerias) {
      const p = r.porRefineria.get(id)?.combustibles ?? 0;
      // A refinery with nowhere to load (Deer Park, through an import terminal) keeps nothing in a yard.
      const sale = id === 'deer-park' ? 0 : prod > 0 ? (sobra * p) / prod : 0;
      sobrante.set(id, (sobrante.get(id) ?? 0) + sale);
    }
  }
  // A coastal refinery outside every zone sends all it makes by sea.
  for (const [id, e] of r.porRefineria) if (!ZONA_DE_REFINERIA.has(id) && id !== 'deer-park') sobrante.set(id, e.combustibles);
  const hueco = new Map(ESTADOS_CONSUMO.map((e) => [e, Math.max(0, consumo.get(e)! - porDucto.get(e)!)]));
  const porMar = new Map(ESTADOS_CONSUMO.map((e) => [e, consumo.get(e)! * (REPARTO[e]?.mar ?? 0)]));
  const porTren = new Map(ESTADOS_CONSUMO.map((e) => [e, consumo.get(e)! * (REPARTO[e]?.tren ?? 0)]));
  // Each sea port imports up to its room; what its states ask past that has to come coastwise from its coast's hub.
  const puertos = new Map<string, { pide: number; tope: number; cabotaje: number }>();
  for (const [e, partes] of PUERTA_MAR)
    for (const [p, f] of partes) {
      const x = puertos.get(p) ?? { pide: 0, tope: topeImportacion(p), cabotaje: 0 };
      x.pide += porMar.get(e)! * f;
      puertos.set(p, x);
    }
  for (const x of puertos.values()) x.cabotaje = Math.max(0, x.pide - x.tope);
  const cabotaje = new Map<string, number>();
  for (const [e, partes] of PUERTA_MAR) {
    const c = partes.reduce((s, [p, f]) => {
      const x = puertos.get(p)!;
      return s + (x.pide > 0 ? ((porMar.get(e)! * f) / x.pide) * x.cabotaje : 0);
    }, 0);
    if (c > 0) cabotaje.set(e, c);
  }
  const porConcentrador = new Map<string, number>();
  for (const [p, x] of puertos) {
    const h = concentradorDe(p);
    if (h && x.cabotaje > 0) porConcentrador.set(h, (porConcentrador.get(h) ?? 0) + x.cabotaje);
  }
  return { consumo, porDucto, hueco, sobrante, faltaZona, porMar, porTren, puertos, cabotaje, porConcentrador };
}

// ---- what happened in a year -----------------------------------------------------------------------

/**
 * Barrels in a year: used; brought from the country's refineries by
 * pipeline, on the player's trains and tankers and on the tankers Pemex
 * rents; imported; and what a state lacked because nobody brought it.
 */
export type Cuenta = { consumo: number; ducto: number; tren: number; barco: number; rentados: number; importado: number; faltante: number };
export const cuentaVacia = (): Cuenta => ({ consumo: 0, ducto: 0, tren: 0, barco: 0, rentados: 0, importado: 0, faltante: 0 });

/** Share of a year's use that came from the country's refineries (0–1). */
export const delPais = (c: Cuenta) => (c.consumo > 0 ? (c.ducto + c.tren + c.barco + c.rentados) / c.consumo : 0);

/** Where the year's imports came in, barrels: a port's key, or `tierra` for what came by land from the US. */
export const POR_TIERRA = 'tierra';

// ---- the real series (Pemex's crude in the game: `plataformas.ts`) ------------------------------------

/** A year of the real series, if published: crude produced and exported, fuels made and imported (Mbd). */
export function realDelAño(año: number) {
  const a = String(año);
  const c = REAL_COMBUSTIBLES.crudo;
  const f = REAL_COMBUSTIBLES.combustibles;
  if (c.exportacion[a] === undefined && f.importacion[a] === undefined) return null;
  return {
    crudo: c.produccion[a] ?? null,
    exportado: c.exportacion[a] ?? null,
    hecho: f.produccion[a] ?? null,
    importado: f.importacion[a] ?? null,
    parcial: c.parcial[a] ?? f.parcial[a] ?? null,
  };
}
