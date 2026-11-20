import calibracionJson from './datos/calibracion.json';
import type { Polo } from './sitios';

/**
 * Building a Polo del Bienestar: the State pays, crews work, and once it's
 * built and the track reaches it, companies move in.
 *
 * Every number comes from `datos/calibracion.json`, where each one carries its
 * official source and the date it was checked (`npm run al-dia` flags the
 * stale ones). The formulas only shape them:
 *
 * - **Cost** is per hectare (Reserva Zapotlán's declaratoria), more with each
 *   extra crew (overtime, more machinery on site).
 * - **Time**: one crew builds a Huamantla-sized polo (53 ha) at the usual pace,
 *   about two years; four crews match Huamantla's record (8.5 months). Bigger
 *   polos take longer but not in proportion — they're built on several fronts
 *   and in phases at once — so time grows with the size to the power 0.3.
 * - **Construction jobs** follow the money: INEGI's ratio of people employed
 *   to construction output, spread over the months the work lasts.
 * - **Permanent jobs** follow occupancy: Huamantla's projection per hectare,
 *   times how full the polo is. Occupancy only grows while a train can get there.
 */

type Cifra = { valor: number; unidad: string; dato: string; fuente: string; url: string; consultado: string };
export type Calibracion = { corte: string; nota: string; cifras: Record<string, Cifra>; dofRevisados: number[] };

export const CALIBRACION = calibracionJson as Calibracion;
export const cifra = (k: string) => CALIBRACION.cifras[k].valor;
const c = cifra;

export const MAX_CUADRILLAS = 4;
/** Each crew beyond the first adds this share of the base cost. */
export const SOBRECOSTO_POR_CUADRILLA = 0.15;
/** How time grows with size: a polo 31 times bigger (Altamira) takes 2.8 times longer. */
const EXPONENTE_TAMAÑO = 0.3;
/** From the two official paces: four crews do in 8.5 months what one does in 24. */
export const EXPONENTE_CUADRILLAS = Math.log(c('mesesObraTipica') / c('mesesObraRecord')) / Math.log(MAX_CUADRILLAS);

export const HORAS_POR_MES = (365 * 24) / 12;
const HORAS_POR_AÑO = 365 * 24;

export type Presupuesto = {
  cuadrillas: number;
  /** Millions of pesos, all told. */
  costoMdp: number;
  meses: number;
  horas: number;
  /** People working on site at once. */
  personasEnObra: number;
  /** Permanent jobs once the polo is full. */
  empleosLleno: number;
};

/** What building `polo` with `cuadrillas` crews takes and gives. */
export function presupuestar(polo: Polo, cuadrillas: number): Presupuesto {
  const n = Math.max(1, Math.min(MAX_CUADRILLAS, Math.round(cuadrillas)));
  const costoMdp = polo.hectareas * c('costoMdpPorHa') * (1 + SOBRECOSTO_POR_CUADRILLA * (n - 1));
  const mesesUna = c('mesesObraTipica') * (polo.hectareas / c('haReferencia')) ** EXPONENTE_TAMAÑO;
  const meses = mesesUna / n ** EXPONENTE_CUADRILLAS;
  return {
    cuadrillas: n,
    costoMdp,
    meses,
    horas: meses * HORAS_POR_MES,
    personasEnObra: (costoMdp * c('empleosAnioPorMdp')) / (meses / 12),
    empleosLleno: polo.hectareas * c('empleosPorHa'),
  };
}

// ---- a polo's life ------------------------------------------------------------------------

export type FasePolo = 'por-construir' | 'en-obra' | 'operando';

export type ObraPolo = {
  id: string;
  fase: FasePolo;
  /** Set when the work is ordered. */
  plan: Presupuesto | null;
  /** 0–1. */
  avance: number;
  pagadoMdp: number;
  /** Stopped: the money ran out. It goes on by itself when there's money again. */
  detenida: boolean;
  /** Hours since a train could reach it, once operating (occupancy runs on this). */
  horasConectado: number;
  /** 0–1: how full of companies it is. */
  ocupacion: number;
};

export function obraNueva(id: string): ObraPolo {
  return { id, fase: 'por-construir', plan: null, avance: 0, pagadoMdp: 0, detenida: false, horasConectado: 0, ocupacion: 0 };
}

/** The State's cash, mutated in place as works are paid. */
export type Caja = { mdp: number };

/** Any work being paid by progress: a polo or a rail work. */
export type EnPago = {
  plan: { costoMdp: number; horas: number } | null;
  avance: number;
  pagadoMdp: number;
  detenida: boolean;
};

/**
 * Pay `horas` of work, as far as the money goes. Work is paid as it advances
 * (the way public works are paid, by progress), so a work the money can't
 * cover stops where it is. True when it's done.
 */
export function pagarAvance(o: EnPago, horas: number, caja: Caja): boolean {
  if (!o.plan) return false;
  const porHora = o.plan.costoMdp / o.plan.horas;
  const faltan = (1 - o.avance) * o.plan.horas;
  const pagables = porHora > 0 ? Math.min(horas, faltan, caja.mdp / porHora) : Math.min(horas, faltan);
  o.detenida = pagables < Math.min(horas, faltan) - 1e-9;
  if (pagables > 0) {
    caja.mdp -= pagables * porHora;
    o.pagadoMdp += pagables * porHora;
    o.avance = Math.min(1, o.avance + pagables / o.plan.horas);
  }
  if (o.avance >= 1 - 1e-9) {
    o.avance = 1;
    o.detenida = false;
    return true;
  }
  return false;
}

/**
 * Move a polo `horas` forward. Work is paid as it advances (the way public
 * works are paid, by progress), so a work the money can't cover stops where it
 * is. Returns true on the hour it's finished.
 */
export function avanzarObra(o: ObraPolo, horas: number, caja: Caja, conectado: boolean): boolean {
  if (o.fase === 'en-obra' && o.plan) {
    if (!pagarAvance(o, horas, caja)) return false;
    o.fase = 'operando';
    return true;
  }
  if (o.fase === 'operando' && conectado) {
    o.horasConectado += horas;
    const u = Math.min(1, o.horasConectado / (c('aniosOcupacion') * HORAS_POR_AÑO));
    // Slow at first, fastest midway, levelling off as the last lots fill.
    o.ocupacion = u * u * (3 - 2 * u);
  }
  return false;
}

/** People working on the site right now. */
export function personasTrabajando(o: ObraPolo): number {
  return o.fase === 'en-obra' && o.plan && !o.detenida ? o.plan.personasEnObra : 0;
}

/** Permanent jobs right now. */
export function empleosPermanentes(o: ObraPolo, polo: Polo): number {
  return o.fase === 'operando' ? o.ocupacion * polo.hectareas * c('empleosPorHa') : 0;
}

