import DATOS from './datos/petroleo.json';
import { fechaDe, horasDeFecha, mesDe } from './calendario';
import { ENERGIA } from './energia';
import type { LonLat } from './geo';
import { presupuestarObra, type PresupuestoObra } from './obrasVia';

/**
 * Oil: Pemex's refineries (`datos/petroleo.json`, every figure with its
 * source). What the game measures is what the government set out to fix:
 * how much crude the country refines and how much of the gasoline, diesel and
 * jet fuel it uses it makes itself.
 *
 * - **The six old refineries** start as they were in 2018: most of them
 *   barely working (Madero and Minatitlán below 10 % of their capacity). A
 *   rehabilitation takes each one from its 2018 run to its "optimal capacity"
 *   (what each declared to the ASF in May 2022), in step with the work.
 * - **The Olmeca** (Dos Bocas) is a new refinery; finished, it runs at its best
 *   month so far.
 * - **The cokers** of Tula and Salina Cruz turn fuel oil into gasoline and
 *   diesel: so many more barrels a day of fuels.
 * - **Deer Park**, in Texas, is half Pemex's from the start; what it makes
 *   only counts for the country once Pemex buys Shell's half. Then it can be
 *   made more reliable.
 *
 * Pemex pays from its own till (`cajaPemexDelMes`): what the federal
 * government transferred to it for refining, month by month.
 */

type Fuente = { fuente: string; url: string };
type FuenteDato = Fuente & { dato: string };

export type Refineria = {
  id: string;
  nombre: string;
  corto: string;
  estado: string;
  lugar: string;
  lonLat: LonLat;
  /** Primary distillation capacity, thousand barrels a day (Mbd). */
  capacidad: number;
  /** Crude run in 2018, Mbd (for Deer Park, what it ran when Pemex bought it). */
  proceso2018: number;
  /** What it can run once its works are done, Mbd. */
  optima: number;
  optimaDato?: string;
  situacion2018?: string;
  /** Built in the game (the Olmeca). */
  nueva?: boolean;
  /** Abroad: Deer Park. */
  extranjera?: boolean;
  /** Real crude runs by year, Mbd. */
  anual: Record<string, number>;
  /** Real crude runs by month: each series starts at its key's month ("2024-10"). */
  mensual: Record<string, number[]>;
};

export type TipoObraPemex = 'rehabilitar' | 'nueva' | 'coquizadora' | 'mejora';

export type ObraPemex = {
  id: string;
  refineria: string;
  tipo: TipoObraPemex;
  nombre: string;
  /** Millions of pesos at the government's pace (4 crews). */
  costoMdp: number;
  costo: FuenteDato;
  /** Months it takes with 4 crews. */
  meses: number;
  tiempo: FuenteDato;
  real: string;
  /** Barrels a day of gasoline and diesel it adds once in service (the cokers). */
  combustiblesExtra?: number;
};

type ObraJson = Omit<ObraPemex, 'costoMdp' | 'costo' | 'meses' | 'tiempo'> & {
  costoMusd?: number;
  costo?: FuenteDato;
  meses?: number;
  tiempo?: FuenteDato;
};

type PetroleoJson = {
  corte: string;
  nota: string;
  fuentes: Record<string, Fuente>;
  cajaPemex: { tramos: { desde: string; mdpMes: number }[]; dato: string; fuentes: string[] };
  demanda: { mbd: number; dato: string; fuentes: string[] };
  rendimientos: { snr: number; olmeca: number; deerPark: number; dato: string; fuentes: string[] };
  rehabilitacion: { costoRequeridoMdp: number; ejercidoMdp: number; dato: string; meses: number; mesesDato: string; fuentes: string[] };
  refinerias: Refineria[];
  totales: { anual: Record<string, number>; parcial: Record<string, string>; mensual: Record<string, number[]>; dato: string; fuentes: string[] };
  obras: ObraJson[];
  compraDeerPark: { costoMdp: number; fecha: string; dato: string; fuentes: string[] };
};

export const PETROLEO = DATOS as unknown as PetroleoJson;
export const REFINERIAS = PETROLEO.refinerias;
export const refineria = (id: string) => REFINERIAS.find((r) => r.id === id) ?? null;
export const fuentePetroleo = (k: string) => PETROLEO.fuentes[k];
/** Gasoline, diesel and jet fuel the country uses, Mbd. */
export const DEMANDA_COMBUSTIBLES = PETROLEO.demanda.mbd;
export const COMPRA_DEER_PARK = PETROLEO.compraDeerPark;
export const DEER_PARK = 'deer-park';

/**
 * What rehabilitating costs per thousand barrels a day recovered: the
 * 2019–2021 program's requirement (ASF) over what the six would recover, from
 * their 2018 runs to their optimal capacities. A game estimate built on
 * official figures.
 */
export const COSTO_POR_MBD = (() => {
  const recupera = REFINERIAS.filter((r) => !r.nueva && !r.extranjera).reduce((s, r) => s + (r.optima - r.proceso2018), 0);
  return PETROLEO.rehabilitacion.costoRequeridoMdp / recupera;
})();

const ASF = PETROLEO.fuentes['asf-2021-0219'];
const entero = (n: number) => Math.round(n).toLocaleString('es-MX');

export const OBRAS_PEMEX: ObraPemex[] = PETROLEO.obras.map((o) => {
  const r = refineria(o.refineria)!;
  if (o.tipo === 'rehabilitar' || o.tipo === 'mejora') {
    const recupera = r.optima - r.proceso2018;
    const costoMdp = COSTO_POR_MBD * recupera;
    const estimacion = o.tipo === 'mejora' ? 'Estimación del juego: no hay un costo oficial. ' : '';
    return {
      ...o,
      costoMdp,
      costo: {
        dato:
          `${estimacion}Recupera ${entero(recupera)} Mbd (de ${entero(r.proceso2018)} a ${entero(r.optima)}) a ${entero(COSTO_POR_MBD)} millones de pesos ` +
          'por cada mil barriles diarios: lo que requería el Programa de Rehabilitaciones 2019–2021 (65,692 millones), repartido por lo que recupera cada refinería.',
        ...ASF,
      },
      meses: o.meses ?? PETROLEO.rehabilitacion.meses,
      tiempo: o.tiempo ?? { dato: PETROLEO.rehabilitacion.mesesDato, ...ASF },
    };
  }
  const costoMdp = (o.costoMusd ?? 0) * ENERGIA.tipoCambio;
  return {
    ...o,
    costoMdp,
    costo: { ...o.costo!, dato: `${o.costo!.dato} A ${ENERGIA.tipoCambio} pesos por dólar (promedio de 2024).` },
    meses: o.meses!,
    tiempo: o.tiempo!,
  };
});
export const obraPemex = (id: string) => OBRAS_PEMEX.find((o) => o.id === id) ?? null;
/** The works of each refinery, rehabilitation first. */
export const OBRAS_DE_REFINERIA = new Map(REFINERIAS.map((r) => [r.id, OBRAS_PEMEX.filter((o) => o.refineria === r.id)]));
/** The work a refinery's card opens on: its rehabilitation, or the Olmeca itself (the board sends Deer Park to its purchase first). */
export const obraPrincipal = (refId: string) => OBRAS_DE_REFINERIA.get(refId)?.[0]?.id ?? refId;

export const presupuestarObraPemex = (o: ObraPemex, cuadrillas: number): PresupuestoObra => presupuestarObra(o.costoMdp, o.meses, cuadrillas);

// ---- Pemex's till -----------------------------------------------------------------------------

const TRAMOS = PETROLEO.cajaPemex.tramos.map((t) => ({ desde: mesDe(horasDeFecha(t.desde)), mdpMes: t.mdpMes }));

/** What Pemex gets for refining in game month `mes` (0 is December 2018), millions of pesos. */
export function cajaPemexDelMes(mes: number): number {
  let n = 0;
  for (const t of TRAMOS) if (mes >= t.desde) n = t.mdpMes;
  return n;
}

/** Months a Pemex work really takes when Pemex's till sets the pace, from month `mes` with `saldo` in hand. */
export function mesesConCajaPemex(costoMdp: number, meses: number, saldo: number, mes: number): number {
  const porMes = costoMdp / meses;
  let falta = costoMdp;
  let caja = saldo;
  for (let t = 0; t < 1200; t++) {
    const puede = Math.min(porMes, caja);
    if (falta <= puede) return t + falta / porMes;
    caja -= puede;
    falta -= puede;
    caja += cajaPemexDelMes(mes + t + 1);
  }
  return Infinity;
}

// ---- what the refineries run and make ------------------------------------------------------------

/** How far each of the player's works has got (0–1; 1 once in service), and whether Deer Park is Pemex's. */
export type EstadoPemex = { avance: (obraId: string) => number; deerParkPropia: boolean };

/** Crude a refinery runs, Mbd, with the player's works as they stand. */
export function procesoJuego(r: Refineria, e: EstadoPemex): number {
  // The Olmeca's work has the refinery's own id.
  if (r.nueva) return e.avance(r.id) >= 1 ? r.optima : 0;
  const obra = r.extranjera ? `${r.id}-mejora` : `rehab-${r.id}`;
  const a = r.extranjera && !e.deerParkPropia ? 0 : e.avance(obra);
  return r.proceso2018 + (r.optima - r.proceso2018) * a;
}

const RENDIMIENTO = PETROLEO.rendimientos;
export const rendimiento = (r: Refineria) => (r.nueva ? RENDIMIENTO.olmeca : r.extranjera ? RENDIMIENTO.deerPark : RENDIMIENTO.snr);

/** Gasoline, diesel and jet fuel a refinery makes for the country, Mbd. */
export function combustiblesJuego(r: Refineria, proceso: number, e: EstadoPemex): number {
  if (r.extranjera && !e.deerParkPropia) return 0;
  let n = proceso * rendimiento(r);
  for (const o of OBRAS_DE_REFINERIA.get(r.id) ?? []) if (o.combustiblesExtra && e.avance(o.id) >= 1) n += o.combustiblesExtra;
  return n;
}

export type Refinacion = {
  /** Crude run in Mexico (the six and the Olmeca), Mbd. */
  proceso: number;
  /** Deer Park's run, when it's Pemex's. */
  procesoDeerPark: number;
  /** Gasoline, diesel and jet fuel for the country, Mbd. */
  combustibles: number;
  /** Share of the country's use it covers. */
  autosuficiencia: number;
  porRefineria: Map<string, { proceso: number; combustibles: number }>;
};

/** The whole system with the player's works as they stand. */
export function refinacionJuego(e: EstadoPemex): Refinacion {
  const porRefineria = new Map<string, { proceso: number; combustibles: number }>();
  let proceso = 0;
  let procesoDeerPark = 0;
  let combustibles = 0;
  for (const r of REFINERIAS) {
    const p = procesoJuego(r, e);
    const c = combustiblesJuego(r, p, e);
    porRefineria.set(r.id, { proceso: p, combustibles: c });
    if (r.extranjera) procesoDeerPark += e.deerParkPropia ? p : 0;
    else proceso += p;
    combustibles += c;
  }
  return { proceso, procesoDeerPark, combustibles, autosuficiencia: combustibles / DEMANDA_COMBUSTIBLES, porRefineria };
}

// ---- Realidad -----------------------------------------------------------------------------------

/** "2025-03" for a game moment. */
function claveMes(horas: number): string {
  const f = fechaDe(horas);
  return `${f.getUTCFullYear()}-${String(f.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** The value of a monthly series (`{ "2024-10": [...] }`) for month "2025-03", if published. */
function delMes(series: Record<string, number[]>, mes: string): number | null {
  const [a, m] = mes.split('-').map(Number);
  for (const [inicio, valores] of Object.entries(series)) {
    const [a0, m0] = inicio.split('-').map(Number);
    const i = (a - a0) * 12 + (m - m0);
    if (i >= 0 && i < valores.length) return valores[i];
  }
  return null;
}

const MESES_TXT = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export type ProcesoReal = { mbd: number; cuando: string };

/** What a refinery really ran around game hour `horas`: that month if published, else that year; null if neither is. */
export function procesoReal(r: Refineria, horas: number): ProcesoReal | null {
  const mes = claveMes(horas);
  const m = delMes(r.mensual, mes);
  const [a, mm] = mes.split('-');
  if (m !== null) return { mbd: m, cuando: `${MESES_TXT[+mm - 1]} de ${a}` };
  const anual = r.anual[a];
  if (anual !== undefined) return { mbd: anual, cuando: a === '2026' && r.extranjera ? 'enero a septiembre de 2026' : a };
  return null;
}

/** The system's real crude run in a year (Mbd), with a word on how complete it is. */
export function totalReal(año: number): { mbd: number; parcial: string | null } | null {
  const v = PETROLEO.totales.anual[String(año)];
  return v === undefined ? null : { mbd: v, parcial: PETROLEO.totales.parcial[String(año)] ?? null };
}

/** Deer Park became Pemex's on this date. */
export const HORAS_COMPRA_DEER_PARK = horasDeFecha(COMPRA_DEER_PARK.fecha);
