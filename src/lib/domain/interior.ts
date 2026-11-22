import DATOS from './datos/interiores.json';
import {
  costoBaseMdp,
  EXPONENTE_CUADRILLAS,
  HORAS_POR_MES,
  MAX_CUADRILLAS,
  mesesUnaCuadrilla,
  obraNueva,
  pagarAvance,
  personasPorObra,
  SOBRECOSTO_POR_CUADRILLA,
  type Caja,
  type EstadoFrente,
  type ObraPolo,
} from './obras';
import { obraVia, presupuestarObra } from './obrasVia';
import { POLOS, type Polo } from './sitios';

/**
 * The inside of a Polo del Bienestar: its close-up view and its work by
 * fronts (`datos/interiores.json`, from `scripts/polos/gen-interior.mjs`, every
 * figure with its source). For now only Huamantla has one.
 *
 * - **The urban fronts** (roads and lighting, water and drainage, power, the
 *   services centre) share the polo's cost and time by their part of it (an
 *   estimate). They share the polo's 4 crews (`MAX_CUADRILLAS`, the most a
 *   whole polo took). Crews on different fronts work in parallel; crews piled
 *   on one front help less and less, with the same exponents as a whole polo.
 *   Well spread and moved on as fronts finish, 4 crews build Huamantla in
 *   7 to 9 months, around the real record of 8.5.
 * - **The rail spur** goes from the nearest main line to the polo, at the
 *   cost per km of the Dos Bocas branch line. The polo gets its station only
 *   with it built.
 * - The polo is urbanized (operating) when the four urban fronts are done.
 */

type Fuente = { fuente: string; url: string };
export type Dato = { dato: string; fuentes: string[] };

export type FrenteUrbano = { id: string; nombre: string; corto: string; parte: number };

export type Interior = {
  nombre: string;
  frentes: FrenteUrbano[];
  frentesDato: Dato;
  espuela: { km: number; via: string; operador: string; mesesMinimos: number } & Dato;
  energia: { mva: number; kmLinea: number } & Dato;
  lotes: Dato;
  vocaciones: string[];
  vocacionesDato: Dato;
};

type InterioresJson = { corte: string; fuentes: Record<string, Fuente>; polos: Record<string, Interior> };

const D = DATOS as unknown as InterioresJson;
export const fuenteInterior = (k: string) => D.fuentes[k];

export const tieneInterior = (id: string) => id in D.polos;
export const interior = (id: string): Interior | null => D.polos[id] ?? null;

/** The spur's front id. */
export const ESPUELA = 'espuela';

/** A front as the view lists it: the four urban ones, then the spur. */
export type Frente = { id: string; nombre: string; corto: string; parte: number | null };
export function frentesDe(id: string): Frente[] {
  const i = interior(id);
  if (!i) return [];
  return [...i.frentes, { id: ESPUELA, nombre: `Espuela de tren (${i.espuela.km.toLocaleString('es-MX')} km)`, corto: 'Espuela', parte: null }];
}

export type PlanFrente = { cuadrillas: number; costoMdp: number; meses: number; horas: number; personasEnObra: number };

/** What front `frente` of `polo` takes with `n` crews (1–4). */
export function planFrente(polo: Polo, frente: string, n: number): PlanFrente | null {
  const i = interior(polo.id);
  if (!i) return null;
  const k = Math.max(1, Math.min(MAX_CUADRILLAS, Math.round(n)));
  if (frente === ESPUELA) {
    // The Dos Bocas branch line: its cost per km and its pace (km a month with four crews).
    const ramal = obraVia('dos-bocas');
    if (!ramal || !ramal.km) return null;
    const meses4 = Math.max(i.espuela.mesesMinimos, i.espuela.km / (ramal.km / ramal.mesesGobierno));
    const p = presupuestarObra(i.espuela.km * ramal.costoMdpKm, meses4, k);
    return { cuadrillas: k, costoMdp: p.costoMdp, meses: p.meses, horas: p.horas, personasEnObra: p.personasEnObra };
  }
  const f = i.frentes.find((x) => x.id === frente);
  if (!f) return null;
  const costoMdp = f.parte * costoBaseMdp(polo) * (1 + SOBRECOSTO_POR_CUADRILLA * (k - 1));
  const meses = (f.parte * mesesUnaCuadrilla(polo)) / k ** EXPONENTE_CUADRILLAS;
  return { cuadrillas: k, costoMdp, meses, horas: meses * HORAS_POR_MES, personasEnObra: personasPorObra(costoMdp, meses) };
}

const frenteNuevo = (): EstadoFrente => ({ cuadrillas: 0, avance: 0, pagadoMdp: 0, detenida: false });

/** A polo's work as the game starts it: by fronts when it has a close-up. */
export function obraDelPolo(id: string): ObraPolo {
  const o = obraNueva(id);
  if (tieneInterior(id)) o.frentes = Object.fromEntries(frentesDe(id).map((f) => [f.id, frenteNuevo()]));
  return o;
}

/** All four urban fronts done. */
export const urbanizado = (o: ObraPolo, id: string) => !!interior(id)?.frentes.every((f) => (o.frentes?.[f.id]?.avance ?? 0) >= 1);
/** The spur built. */
export const conEspuela = (o: ObraPolo) => (o.frentes?.[ESPUELA]?.avance ?? 0) >= 1;

/**
 * Sum up the fronts into the polo's figures: progress (the urban fronts by
 * their part), money paid, and a `plan` with the crews at work now — what the
 * rest of the game reads (jobs on site, the polo's card).
 */
export function resumir(o: ObraPolo, polo: Polo) {
  const i = interior(polo.id);
  if (!i || !o.frentes) return;
  o.avance = i.frentes.reduce((s, f) => s + f.parte * (o.frentes![f.id]?.avance ?? 0), 0);
  o.pagadoMdp = Object.values(o.frentes).reduce((s, f) => s + f.pagadoMdp, 0);
  let cuadrillas = 0;
  let costo = 0;
  let personas = 0;
  let horas = 0;
  let activos = 0;
  let detenidos = 0;
  for (const f of frentesDe(polo.id)) {
    const e = o.frentes[f.id];
    if (!e || e.cuadrillas <= 0 || e.avance >= 1) continue;
    const p = planFrente(polo, f.id, e.cuadrillas);
    if (!p) continue;
    activos++;
    cuadrillas += e.cuadrillas;
    costo += p.costoMdp;
    horas = Math.max(horas, (1 - e.avance) * p.horas);
    if (e.detenida) detenidos++;
    else personas += p.personasEnObra;
  }
  o.detenida = activos > 0 && detenidos === activos;
  o.plan = {
    cuadrillas,
    costoMdp: costo,
    meses: horas / HORAS_POR_MES,
    horas,
    personasEnObra: personas,
    empleosLleno: o.plan?.empleosLleno ?? 0,
  };
}

/** Crews on the urban fronts now (the spur's are its own). */
export function cuadrillasUrbanas(o: ObraPolo, id: string): number {
  return (interior(id)?.frentes ?? []).reduce((s, f) => {
    const e = o.frentes?.[f.id];
    return s + (e && e.avance < 1 ? e.cuadrillas : 0);
  }, 0);
}

/** The most crews front `frente` can take now: 4 for the spur; for an urban front, what the polo's 4 leave free. */
export function maxCuadrillas(o: ObraPolo, id: string, frente: string): number {
  if (frente === ESPUELA) return MAX_CUADRILLAS;
  const propias = o.frentes?.[frente]?.cuadrillas ?? 0;
  return Math.max(0, MAX_CUADRILLAS - (cuadrillasUrbanas(o, id) - propias));
}

/**
 * Put `n` crews on a front, up to what it can take. The first crew on any
 * front starts the work; 0 stops that front where it is.
 */
export function fijarCuadrillas(o: ObraPolo, polo: Polo, frente: string, n: number, empleosLleno: number) {
  const e = o.frentes?.[frente];
  if (!e || e.avance >= 1) return;
  e.cuadrillas = Math.max(0, Math.min(maxCuadrillas(o, polo.id, frente), Math.round(n)));
  if (e.cuadrillas === 0) e.detenida = false;
  if (o.fase === 'por-construir' && e.cuadrillas > 0) o.fase = 'en-obra';
  o.plan = { ...(o.plan ?? { cuadrillas: 0, costoMdp: 0, meses: 0, horas: 0, personasEnObra: 0 }), empleosLleno };
  resumir(o, polo);
}

/**
 * Move each front with crews `horas` forward, paid as it advances. Returns
 * true on the hour the polo is urbanized or its spur is finished: either
 * changes the rail network.
 */
export function avanzarInterior(o: ObraPolo, horas: number, caja: Caja): boolean {
  if (!o.frentes) return false;
  const polo = POLOS.find((p) => p.id === o.id);
  if (!polo) return false;
  let cambio = false;
  const antes = urbanizado(o, polo.id);
  for (const [id, e] of Object.entries(o.frentes)) {
    if (e.cuadrillas <= 0 || e.avance >= 1) continue;
    const p = planFrente(polo, id, e.cuadrillas);
    if (!p) continue;
    const pago = { plan: { costoMdp: p.costoMdp, horas: p.horas }, avance: e.avance, pagadoMdp: e.pagadoMdp, detenida: e.detenida };
    const listo = pagarAvance(pago, horas, caja);
    e.avance = pago.avance;
    e.pagadoMdp = pago.pagadoMdp;
    e.detenida = pago.detenida;
    if (listo) {
      e.cuadrillas = 0;
      if (id === ESPUELA) cambio = true;
    }
  }
  resumir(o, polo);
  if (!antes && urbanizado(o, polo.id)) {
    o.fase = 'operando';
    cambio = true;
  }
  return cambio;
}
