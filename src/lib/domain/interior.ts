import DATOS from './datos/interiores.json';
import { mwDelPolo } from './energia';
import { KW_POR_EMPLEO, sector as sectorDe } from './sectores';
import {
  costoBaseMdp,
  curvaOcupacion,
  empleosLleno,
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
  type EstadoLote,
  type ObraPolo,
} from './obras';
import { obraVia, presupuestarObra } from './obrasVia';
import { POLOS, type Polo } from './sitios';

/**
 * The inside of a Polo del Bienestar: its close-up view and its work by
 * fronts (`datos/interiores.json`, from `scripts/polos/gen-interior.mjs`, every
 * figure with its source). Huamantla and Coatzacoalcos I have one.
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
 * - **Its substation** gives its companies its official MW (or the median of
 *   the official ones). Once its power front is built, the CFE can enlarge it
 *   bank by bank, paid from the CFE's till, with crews of its own.
 */

type Fuente = { fuente: string; url: string };
export type Dato = { dato: string; fuentes: string[] };

export type FrenteUrbano = { id: string; nombre: string; corto: string; parte: number };

export type Interior = {
  nombre: string;
  /** «Huamantla, Tlaxcala». */
  lugar: string;
  /** The sectors a lot can be promoted for: its vocations (`sectores.ts`). */
  sectores: string[];
  /** Its sources, for the panel. */
  fuentesLista: string[];
  /** How the real polo stands, for Realidad. */
  realNota: string;
  frentes: FrenteUrbano[];
  frentesDato: Dato;
  espuela: { km: number; via: string; operador: string; mesesMinimos: number } & Dato;
  energia: { mva: number; fuenteCorta: string; kmLinea: number } & Dato;
  lotes: { lista: { n: number; ha: number; empresa: string | null }[] } & Dato;
  vocaciones: string[];
  vocacionesDato: Dato;
};

type Subestacion = { mvaBanco: number; mdpPorMva: number; mesesGobierno: number } & Dato;
type InterioresJson = { corte: string; fuentes: Record<string, Fuente>; subestacion: Subestacion; polos: Record<string, Interior> };

const D = DATOS as unknown as InterioresJson;
export const fuenteInterior = (k: string) => D.fuentes[k];

export const tieneInterior = (id: string) => id in D.polos;
export const interior = (id: string): Interior | null => D.polos[id] ?? null;

/** The spur's front id. */
export const ESPUELA = 'espuela';
/** The substation's enlargement: one bank at a time, by the CFE. */
export const SUBESTACION = 'subestacion';
export const SUBESTACION_DATOS = D.subestacion;
export const MVA_BANCO = D.subestacion.mvaBanco;

/** A front as the view lists it: the four urban ones, the spur, then the substation's enlargement. */
export type Frente = { id: string; nombre: string; corto: string; parte: number | null };
export function frentesDe(id: string): Frente[] {
  const i = interior(id);
  if (!i) return [];
  return [
    ...i.frentes,
    { id: ESPUELA, nombre: `Espuela de tren (${i.espuela.km.toLocaleString('es-MX')} km)`, corto: 'Espuela', parte: null },
    { id: SUBESTACION, nombre: `Ampliar la subestación: un banco de ${MVA_BANCO} MVA (CFE)`, corto: 'Subestación', parte: null },
  ];
}

export type PlanFrente = { cuadrillas: number; costoMdp: number; meses: number; horas: number; personasEnObra: number };

/** What front `frente` of `polo` takes with `n` crews (1–4). */
export function planFrente(polo: Polo, frente: string, n: number): PlanFrente | null {
  const i = interior(polo.id);
  if (!i) return null;
  const k = Math.max(1, Math.min(MAX_CUADRILLAS, Math.round(n)));
  if (frente === SUBESTACION) {
    // A bank: the CFE's median cost per MVA, at the pace of its latest new substations.
    const s = D.subestacion;
    const p = presupuestarObra(s.mvaBanco * s.mdpPorMva, s.mesesGobierno, k);
    return { cuadrillas: k, costoMdp: p.costoMdp, meses: p.meses, horas: p.horas, personasEnObra: p.personasEnObra };
  }
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

/** A polo's work as the game starts it: by fronts, and its lots not promoted yet, when it has a close-up. */
export function obraDelPolo(id: string): ObraPolo {
  const o = obraNueva(id);
  const i = interior(id);
  if (i) {
    o.frentes = Object.fromEntries(frentesDe(id).map((f) => [f.id, frenteNuevo()]));
    o.lotes = i.lotes.lista.map(() => ({ sector: null, orden: 0, lleno: 0 }));
    o.bancos = 0;
  }
  return o;
}

// ---- the lots and their companies ---------------------------------------------------------

/**
 * What the company in lot `n` (index into the list) of a polo asks with sector
 * `s`, the lot full: its people (the polo's jobs shared out by area), MW (its
 * people at the manufacturing average per job, times how much its sector
 * spends on electricity against the average) and tonnes by rail a year. Per
 * job, so a worker asks the same in any polo.
 */
export function demandaLote(polo: Polo, n: number, s: string | null) {
  const i = interior(polo.id);
  const l = i?.lotes.lista[n];
  const sec = sectorDe(s);
  if (!i || !l) return null;
  const areaEmpresas = i.lotes.lista.reduce((t, x) => t + x.ha, 0);
  const personas = (empleosLleno(polo) * l.ha) / areaEmpresas;
  const mw = ((personas * KW_POR_EMPLEO) / 1000) * (sec?.energia ?? 1);
  const toneladas = personas * (sec?.toneladas ?? 0);
  return { ha: l.ha, personas, mw, toneladas, exportacion: sec?.exportacion ?? 0, agua: sec?.agua ?? 1 };
}

/**
 * MW the polo has for its companies (its substation): its official figure, or
 * the median of the official ones, and the banks the CFE has added.
 */
export const capacidadMw = (o: ObraPolo, id: string) => (interior(id) ? mwDelPolo(id) + (o.bancos ?? 0) * MVA_BANCO : Infinity);

/** Its power front built: the substation can be enlarged. */
export const conEnergia = (o: ObraPolo) => (o.frentes?.energia?.avance ?? 0) >= 1;

/** MW its companies use now (in as far as they've moved in). */
export function mwEnUso(o: ObraPolo, polo: Polo): number {
  return (o.lotes ?? []).reduce((t, l, n) => t + (l.lleno > 0 ? (demandaLote(polo, n, l.sector)?.mw ?? 0) * l.lleno : 0), 0);
}

/** MW the polo would use with every promoted lot full. */
export function mwPromovido(o: ObraPolo, polo: Polo): number {
  return (o.lotes ?? []).reduce((t, l, n) => t + (l.sector ? (demandaLote(polo, n, l.sector)?.mw ?? 0) : 0), 0);
}

/** A lot that can't take its company: with it, the polo would need more MW than it has. */
export function sinEnergiaLote(o: ObraPolo, polo: Polo, n: number): boolean {
  const l = o.lotes?.[n];
  if (!l?.sector || l.lleno >= 1) return false;
  return !cabeLote(o, polo, n);
}

/**
 * The promoted lots that fit under the substation: the ones whose company is
 * already in, then the rest in the order they were promoted, each if what's
 * taken so far leaves room for it. One that doesn't fit takes nothing.
 */
function lotesQueCaben(o: ObraPolo, polo: Polo): Set<number> {
  const lotes = o.lotes ?? [];
  const cap = capacidadMw(o, polo.id) + 1e-9;
  const caben = new Set<number>();
  let mw = 0;
  for (const [n, l] of lotes.entries()) {
    if (!l.sector || l.lleno <= 0) continue;
    caben.add(n);
    mw += demandaLote(polo, n, l.sector)?.mw ?? 0;
  }
  const fila = lotes.map((l, n) => ({ l, n })).filter((x) => x.l.sector && x.l.lleno <= 0).sort((a, b) => a.l.orden - b.l.orden);
  for (const { l, n } of fila) {
    const suyo = demandaLote(polo, n, l.sector)?.mw ?? 0;
    if (mw + suyo > cap) continue;
    caben.add(n);
    mw += suyo;
  }
  return caben;
}

/** Whether lot `n` fits under the substation with the lots promoted before it. */
const cabeLote = (o: ObraPolo, polo: Polo, n: number) => lotesQueCaben(o, polo).has(n);

/**
 * Promote lot `n` for a sector (null takes it off). Only a lot without its
 * company yet; it joins the line behind the ones promoted before.
 */
export function promoverLote(o: ObraPolo, n: number, s: string | null, orden: number) {
  const l = o.lotes?.[n];
  if (!l || l.lleno > 0) return;
  l.sector = s && sectorDe(s) ? s : null;
  l.orden = l.sector ? orden : 0;
}

/**
 * Companies move in: the polo's usual curve (only while a train and the
 * region's electricity reach it) says how many hectares companies want; they
 * take the promoted lots in the order they were promoted, skipping the ones
 * that don't fit under the substation. The polo's occupancy is how full its
 * company lots are.
 */
export function ocuparLotes(o: ObraPolo, polo: Polo) {
  const i = interior(polo.id);
  if (!i || !o.lotes) return;
  const area = i.lotes.lista.reduce((t, x) => t + x.ha, 0);
  if (o.fase === 'operando') {
    let quieren = curvaOcupacion(o.horasConectado) * area;
    const caben = lotesQueCaben(o, polo);
    const fila = o.lotes.map((l, n) => ({ l, n })).filter((x) => x.l.sector).sort((a, b) => a.l.orden - b.l.orden);
    for (const { l, n } of fila) {
      const ha = i.lotes.lista[n].ha;
      if (!caben.has(n)) continue;
      const ahora = Math.max(l.lleno, Math.min(1, Math.max(0, quieren / ha)));
      l.lleno = ahora;
      quieren -= ha * ahora;
    }
  }
  o.ocupacion = o.lotes.reduce((t, l, n) => t + l.lleno * i.lotes.lista[n].ha, 0) / area;
}

/** Tonnes a year the polo's companies send by rail now: for export and for the country. */
export function cargaDelPolo(o: ObraPolo, polo: Polo): { exportacion: number; nacional: number } {
  let exportacion = 0;
  let nacional = 0;
  for (const [n, l] of (o.lotes ?? []).entries()) {
    if (l.lleno <= 0) continue;
    const d = demandaLote(polo, n, l.sector);
    if (!d) continue;
    exportacion += d.toneladas * d.exportacion * l.lleno;
    nacional += d.toneladas * (1 - d.exportacion) * l.lleno;
  }
  return { exportacion, nacional };
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
  // What the State paid: the substation is the CFE's.
  o.pagadoMdp = Object.entries(o.frentes).reduce((s, [id, f]) => s + (id === SUBESTACION ? 0 : f.pagadoMdp), 0);
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

/**
 * The most crews front `frente` can take now: 4 for the spur; 4 for the
 * substation once the power front is built; for an urban front, what the
 * polo's 4 leave free.
 */
export function maxCuadrillas(o: ObraPolo, id: string, frente: string): number {
  if (frente === ESPUELA) return MAX_CUADRILLAS;
  if (frente === SUBESTACION) return conEnergia(o) ? MAX_CUADRILLAS : 0;
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
 * Move each front with crews `horas` forward, paid as it advances: from the
 * State's till, the substation from the CFE's. A finished bank adds its MVA
 * and the front waits for the next one. Returns true on the hour the polo is
 * urbanized or its spur is finished: either changes the rail network.
 */
export function avanzarInterior(o: ObraPolo, horas: number, caja: Caja, cajaCfe: Caja): boolean {
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
    const listo = pagarAvance(pago, horas, id === SUBESTACION ? cajaCfe : caja);
    e.avance = pago.avance;
    e.pagadoMdp = pago.pagadoMdp;
    e.detenida = pago.detenida;
    if (listo) {
      e.cuadrillas = 0;
      if (id === ESPUELA) cambio = true;
      if (id === SUBESTACION) {
        o.bancos = (o.bancos ?? 0) + 1;
        e.avance = 0;
      }
    }
  }
  resumir(o, polo);
  if (!antes && urbanizado(o, polo.id)) {
    o.fase = 'operando';
    cambio = true;
  }
  return cambio;
}
