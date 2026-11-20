import DATOS from './datos/presupuesto.json';
import { AÑO_INICIAL } from './calendario';

/**
 * The State's money. Each year it gets what the federal government really
 * put into railways that year (`datos/presupuesto.json`: spent from 2019 to
 * 2025, approved for 2026, proposed for 2027, and 2027 again after that), plus
 * the fee the private concessionaires pay for using the track: a share of
 * their revenue, 1.25 % and 3 % from 2027.
 *
 * It arrives in twelve equal monthly payments, like the government's spending
 * calendar, and whatever isn't spent stays in the till. Polos and rail works
 * are paid from the same till.
 */

export type Serie = 'ejercido' | 'aprobado' | 'proyecto';

export type AñoFederal = {
  año: number;
  mdp: number;
  serie: Serie;
  /** What Congress approved, for the years where `mdp` is what was spent. */
  aprobado?: number;
  desglose: { sict: number; trenMaya: number; istmo: number };
  nota?: string;
};

type Fuente = { dato: string; fuente: string; url: string; consultado: string };

export const FEDERAL = DATOS.federal as Fuente & { años: AñoFederal[] };
export const DERECHO = DATOS.derecho as Fuente & {
  urlReforma: string;
  tasas: { desde: number; tasa: number }[];
  ingresos: { año: number; mdp: number; porEmpresa: Record<string, number> }[];
};

const ultimo = <T>(xs: T[]) => xs[xs.length - 1];

/** The federal rail budget of `año`; past the data, the last year's again. */
export function federalDe(año: number): AñoFederal & { repetido: boolean } {
  const f = FEDERAL.años.find((x) => x.año === año);
  return f ? { ...f, repetido: false } : { ...ultimo(FEDERAL.años), repetido: true };
}

/** The concession fee's rate in `año`. */
export function tasaDerecho(año: number): number {
  let t = DERECHO.tasas[0].tasa;
  for (const x of DERECHO.tasas) if (año >= x.desde) t = x.tasa;
  return t;
}

/** The private concessionaires' revenue in `año`; past the data, the last year's again. */
export function ingresosPrivadas(año: number): number {
  return (DERECHO.ingresos.find((x) => x.año === año) ?? ultimo(DERECHO.ingresos)).mdp;
}

export type Mensualidad = {
  /** Months since the start (0 is January 2019). */
  mes: number;
  año: number;
  /** One twelfth of the year's federal rail budget. */
  federal: number;
  /** One twelfth of the year's concession fees. */
  derecho: number;
  total: number;
  serie: Serie;
  /** Past the data: the last known year, repeated. */
  repetido: boolean;
};

/** What comes in at the start of month `mes`. */
export function mensualidad(mes: number): Mensualidad {
  const año = AÑO_INICIAL + Math.floor(mes / 12);
  const f = federalDe(año);
  const federal = f.mdp / 12;
  const derecho = (ingresosPrivadas(año) * tasaDerecho(año)) / 12;
  return { mes, año, federal, derecho, total: federal + derecho, serie: f.serie, repetido: f.repetido };
}

/** The whole year, as the encyclopedia and the ledger show it. */
export function añoCompleto(año: number) {
  const f = federalDe(año);
  const derecho = ingresosPrivadas(año) * tasaDerecho(año);
  return { año, federal: f.mdp, serie: f.serie, repetido: f.repetido, derecho, tasa: tasaDerecho(año), total: f.mdp + derecho };
}

/** A work the money can't finish in this many months is reported as never finishing. */
const MESES_MAXIMOS = 1200;

/**
 * Months a work really takes when the money sets the pace: it would pay
 * `costoMdp` evenly over `meses`, but each month it can only spend what's in
 * the till, which starts at `saldo` and gets each coming month's payment from
 * the real calendar (`mensualidad`, from month `mesActual` on). Assumes no
 * other work draws on the till.
 */
export function mesesAlRitmoDelDinero(costoMdp: number, meses: number, saldo: number, mesActual: number): number {
  const porMes = costoMdp / meses;
  let falta = costoMdp;
  let caja = saldo;
  for (let t = 0; t < MESES_MAXIMOS; t++) {
    const puede = Math.min(porMes, caja);
    // Done within this month, at full pace.
    if (falta <= puede) return t + falta / porMes;
    caja -= puede;
    falta -= puede;
    caja += mensualidad(mesActual + t + 1).total;
  }
  return Infinity;
}
