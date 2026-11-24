import { EMPRESAS_INDUSTRIA, INDUSTRIAS, PARCIAL_RAIAVL, añoRaiavl, type Industria } from './industrias';
import { MINAS, cifraMina } from './mineria';
import { horasDeFecha } from './calendario';
import aeropuertosJson from './datos/aeropuertos.json';
import type { LonLat } from './geo';
import type { ClaveEstado } from './sitios';

/**
 * Supply chains, first link: the minerals that go by train from a mine (or a port of entry) to the
 * plant that uses them. Each flow is cargo with an origin and a destination: it waits at the
 * origin's station (up to `DIAS_EN_PATIO` days of it) and only boards a train that will stop at its
 * destination; delivered, it counts in tonnes and tonne-km.
 *
 * No invented tonnes: a mine's flows are its own production (its company's report) and the
 * imports are the rail yearbook's (ARTF 2018). How a mine's output splits among its destinations
 * is an estimate of the game, said in each flow. The domestic flows come out of their state's
 * generic domestic cargo, so the country's total stays the yearbook's.
 *
 * Only what goes by rail: MICARE (belt to Nava), Las Truchas (slurry pipeline), Hércules and the
 * mine of La Caridad (no source for how they ship) and Baja California Sur (no railway) don't load.
 */

export type Producto = 'hierro' | 'carbon' | 'coque' | 'cobre' | 'aerea';
export const NOMBRE_PRODUCTO: Record<Producto, string> = { hierro: 'mineral de hierro', carbon: 'carbón', coque: 'coque', cobre: 'concentrado de cobre', aerea: 'carga aérea' };

/** The mines and plants that are stops of a chain: they get a station like a city. */
export type SitioCadena = { clave: string; tipo: 'mina' | 'industria'; id: string; nombre: string; estado: ClaveEstado; lonLat: LonLat; lonLatEstacion?: LonLat };

/** Peña Colorada ships from its pelletizing plant by the port of Manzanillo (OpenStreetMap, «Planta concentradora de hierro Peña Colorada»). */
const ESTACION_PENA_COLORADA: LonLat = [-104.27668, 19.08422];

const MINAS_CADENA = ['pena-colorada', 'las-encinas', 'cerro-de-mercado', 'mimosa', 'buenavista-del-cobre'];
const PLANTAS_CADENA = ['ahmsa', 'ternium-guerrero', 'ternium-puebla', 'la-caridad-fundicion'];

export const SITIOS_CADENA: SitioCadena[] = [
  ...MINAS.filter((m) => MINAS_CADENA.includes(m.id)).map((m) => ({
    clave: `mina:${m.id}`,
    tipo: 'mina' as const,
    id: m.id,
    nombre: m.corto,
    estado: m.estado,
    lonLat: m.lonLat,
    lonLatEstacion: m.id === 'pena-colorada' ? ESTACION_PENA_COLORADA : undefined,
  })),
  ...INDUSTRIAS.filter((p) => PLANTAS_CADENA.includes(p.id) || p.tipo === 'armadora' || p.tipo === 'logistica').map((p) => ({ clave: `industria:${p.id}`, tipo: 'industria' as const, id: p.id, nombre: p.corto, estado: p.estado, lonLat: p.lonLat })),
];

export type Flujo = {
  id: string;
  producto: Producto;
  /** Site keys of the origin's and the destination's stations. */
  origen: string;
  destino: string;
  /** A mine's flow: this share of its yearly figure. */
  mina?: string;
  parte?: number;
  /** An import's flow: tonnes a year (ARTF 2018, carried on). */
  fijo?: number;
  /** An airport's flow: this share of its international air cargo (AFAC). */
  aeropuerto?: string;
  /** The flow starts when its newer end opens. */
  desde?: string;
  /** Imports come from abroad: they don't come out of the state's domestic cargo. */
  importado?: boolean;
  /** The flow stops when either end stops (`hasta`). */
  hasta?: string;
  /** Why these tonnes, in the card's words. */
  dato: string;
};

const HASTA_AHMSA = '2022-12-23';

export const FLUJOS: Flujo[] = [
  {
    id: 'pc-ternium-mty',
    producto: 'hierro',
    origen: 'mina:pena-colorada',
    destino: 'industria:ternium-guerrero',
    mina: 'pena-colorada',
    parte: 0.25,
    dato: 'La mitad de Ternium en Peña Colorada, repartida por igual entre Monterrey y Puebla (estimación del juego); la otra mitad es de ArcelorMittal y va por barco',
  },
  { id: 'pc-ternium-pue', producto: 'hierro', origen: 'mina:pena-colorada', destino: 'industria:ternium-puebla', mina: 'pena-colorada', parte: 0.25, dato: 'La mitad de Ternium en Peña Colorada, repartida por igual entre Monterrey y Puebla (estimación del juego)' },
  { id: 'encinas-mty', producto: 'hierro', origen: 'mina:las-encinas', destino: 'industria:ternium-guerrero', mina: 'las-encinas', parte: 0.5, dato: 'Sus pélets, repartidos por igual entre Monterrey y Puebla (estimación del juego)' },
  { id: 'encinas-pue', producto: 'hierro', origen: 'mina:las-encinas', destino: 'industria:ternium-puebla', mina: 'las-encinas', parte: 0.5, dato: 'Sus pélets, repartidos por igual entre Monterrey y Puebla (estimación del juego)' },
  { id: 'mercado-ahmsa', producto: 'hierro', origen: 'mina:cerro-de-mercado', destino: 'industria:ahmsa', mina: 'cerro-de-mercado', parte: 1, hasta: HASTA_AHMSA, dato: 'Todo su concentrado va a Monclova (AHMSA)' },
  {
    id: 'mimosa-ahmsa',
    producto: 'carbon',
    origen: 'mina:mimosa',
    destino: 'industria:ahmsa',
    mina: 'mimosa',
    parte: 0.44,
    hasta: HASTA_AHMSA,
    dato: 'Su carbón metalúrgico, 44 % de lo que sacó en 2018 (1.39 de 3.15 millones de toneladas), va por tren a las coquizadoras de Monclova (AHMSA)',
  },
  {
    id: 'piedras-negras-ahmsa',
    producto: 'carbon',
    origen: 'ciudad:piedras-negras',
    destino: 'industria:ahmsa',
    fijo: 2100000,
    importado: true,
    hasta: HASTA_AHMSA,
    dato: 'El carbón que entró por tren por Piedras Negras en 2018 (ARTF); que vaya a AHMSA es estimación del juego',
  },
  {
    id: 'altamira-coque-ahmsa',
    producto: 'coque',
    origen: 'puerto:altamira',
    destino: 'industria:ahmsa',
    fijo: 1700000,
    importado: true,
    hasta: HASTA_AHMSA,
    dato: 'El coque que llegó por Altamira y siguió en tren en 2018 (ARTF); que vaya a AHMSA es estimación del juego',
  },
  {
    id: 'buenavista-fundicion',
    producto: 'cobre',
    origen: 'mina:buenavista-del-cobre',
    destino: 'industria:la-caridad-fundicion',
    mina: 'buenavista-del-cobre',
    parte: 0.43,
    dato: 'Lo que la fundición fundió en 2018 menos lo de su propia mina (1.04 − 0.45 millones de toneladas), 43 % del concentrado de Buenavista (estimación del juego)',
  },
  { id: 'buenavista-guaymas', producto: 'cobre', origen: 'mina:buenavista-del-cobre', destino: 'puerto:guaymas', mina: 'buenavista-del-cobre', parte: 0.57, dato: 'El resto de su concentrado sale a exportar por Guaymas (estimación del juego)' },
  // T-MEX Park, next to the AIFA: the international air cargo of the airport goes through the park.
  {
    id: 'aifa-tmex',
    producto: 'aerea',
    origen: 'aeropuerto:aifa',
    destino: 'industria:tmex-park',
    aeropuerto: 'aifa',
    parte: 0.5,
    desde: '2025-08',
    importado: true,
    dato: 'Lo que llega del extranjero al AIFA y se almacena en T-MEX: la mitad de su carga internacional (AFAC); que pase por T-MEX y en esa proporción es estimación del juego',
  },
  {
    id: 'tmex-aifa',
    producto: 'aerea',
    origen: 'industria:tmex-park',
    destino: 'aeropuerto:aifa',
    aeropuerto: 'aifa',
    parte: 0.5,
    desde: '2025-08',
    importado: true,
    dato: 'Lo que sale de T-MEX para volar desde el AIFA: la otra mitad de su carga internacional (AFAC; estimación del juego)',
  },
];

type AñoAereo = { nacional: number; internacional: number };
const AEREOS = (aeropuertosJson as unknown as { aeropuertos: { id: string; serie: Record<string, AñoAereo> }[]; serie: { parcial: { año: number; meses: number } } });

/** An airport's international cargo in a year (the running year annualized; the last year carried on). */
function internacional(id: string, año: number): number {
  const s = AEREOS.aeropuertos.find((a) => a.id === id)?.serie ?? {};
  const años = Object.keys(s).map(Number).sort((a, b) => a - b);
  const a = años.filter((x) => x <= año).pop() ?? años[0];
  if (a === undefined) return 0;
  const p = AEREOS.serie.parcial;
  return a === p.año ? (s[String(a)].internacional * 12) / p.meses : s[String(a)].internacional;
}

export const FLUJO = new Map(FLUJOS.map((f) => [f.id, f]));
/**
 * Rule of the game: the private railroads (Ferromex, CPKC) carry this share of every mineral flow on
 * their own, straight to its destination; only the rest waits for the player's trains. In reality
 * they carry all of it; the share keeps the chains from collapsing before the player runs a train.
 */
export const PARTE_PRIVADOS = 0.5;
export const llevanPrivados = (f: Flujo) => f.producto !== 'aerea';
/** A flow's cargo waits at its origin this many days of it, like the states' cargo. */
export const DIAS_EN_PATIO = 30;

/** Tonnes a year of a flow at a game hour: 0 once it stopped. */
export function toneladasAño(f: Flujo, horas: number, año: number): number {
  if (f.hasta && horas >= horasDeFecha(f.hasta)) return 0;
  if (f.desde && horas < horasDeFecha(f.desde)) return 0;
  if (f.fijo) return f.fijo;
  if (f.aeropuerto) return internacional(f.aeropuerto, año) * (f.parte ?? 0);
  const m = MINAS.find((x) => x.id === f.mina);
  if (!m || (m.hasta && horas >= horasDeFecha(m.hasta))) return 0;
  return (cifraMina(m, año)?.toneladas ?? 0) * (f.parte ?? 0);
}

// ---- cars: the vehicles exported by train leave from the carmakers' stations ---------------

/**
 * Vehicles that left the country by train in 2018 (ARTF, table 10: 4.9 million tonnes; 77.6 % by
 * Nuevo Laredo and Piedras Negras). Each year scales with the units the carmakers exported (INEGI,
 * RAIAVL), and each brand's share is its exports; a brand with several plants splits it equally
 * among those working (estimate of the game).
 */
export const T_AUTOS_2018 = 4_900_000;

function exportadas(empresa: string, año: number): number {
  const a = añoRaiavl(año);
  const x = EMPRESAS_INDUSTRIA[empresa]?.serie[String(a)]?.exportacion ?? 0;
  return PARCIAL_RAIAVL && a === PARCIAL_RAIAVL.año ? (x * 12) / PARCIAL_RAIAVL.meses : x;
}
const TOTAL_2018 = Object.keys(EMPRESAS_INDUSTRIA).reduce((s, e) => s + exportadas(e, 2018), 0);
const trabaja = (p: Industria, horas: number) => (!p.desde || horas >= horasDeFecha(p.desde)) && (!p.hasta || horas < horasDeFecha(p.hasta));

/** Tonnes a year of vehicles a carmaker sends to export by train at a game hour. */
export function autosAño(p: Industria, horas: number, año: number): number {
  if (p.tipo !== 'armadora' || !p.empresa || !trabaja(p, horas)) return 0;
  const activas = INDUSTRIAS.filter((x) => x.empresa === p.empresa && x.tipo === 'armadora' && trabaja(x, horas)).length;
  return (T_AUTOS_2018 * exportadas(p.empresa, año)) / TOTAL_2018 / Math.max(1, activas);
}

export const ARMADORAS = INDUSTRIAS.filter((p) => p.tipo === 'armadora');

// ---- step 3: what the steel mills make depends on what reaches them ---------------------------

/**
 * Domestic steel by train in 2018 (ARTF, tables 6-1 and 6-2): 6,468,776 t of sheets and plates plus
 * 2,646,656 t of construction bar, less the 2.7 million tonnes of sheet imported by Matamoros.
 */
export const T_ACERO_TREN = 6_468_776 + 2_646_656 - 2_700_000;
/** Each mill's share of the country's steel (CANACERO in the SGM yearbook, 2016, the last by company: AHMSA 4,652 and Ternium 3,515 of 18,811 thousand tonnes); Ternium's split equally between its two units (estimate). */
export const ACERERAS: { id: string; parte: number; hasta?: string }[] = [
  { id: 'ahmsa', parte: 4652 / 18811, hasta: HASTA_AHMSA },
  { id: 'ternium-guerrero', parte: 3515 / 18811 / 2 },
  { id: 'ternium-puebla', parte: 3515 / 18811 / 2 },
];
/** Rules of the game, as the offshore complexes': a mill keeps up to 15 days of its rail inputs; it makes steel by how it was supplied in the last month, and with nothing, half. */
export const RESERVA_DIAS = 15;
export const MEMORIA_DIAS = 30;
export const PISO_ACERO = 0.5;
export const factorAcero = (surtido: number) => PISO_ACERO + (1 - PISO_ACERO) * Math.max(0, Math.min(1, surtido));

/** Tonnes a year of rail inputs a plant expects now (its chain flows). */
export function insumosAño(planta: string, horas: number, año: number): number {
  return FLUJOS.filter((f) => f.destino === `industria:${planta}`).reduce((s, f) => s + toneladasAño(f, horas, año), 0);
}

/** Tonnes a year of steel a mill sends by train at a game hour, given how it was supplied. */
export function aceroAño(id: string, horas: number, surtido: number): number {
  const a = ACERERAS.find((x) => x.id === id);
  if (!a || (a.hasta && horas >= horasDeFecha(a.hasta))) return 0;
  return T_ACERO_TREN * a.parte * factorAcero(surtido);
}

/** The domestic flows that load in each state, to take out of its generic domestic cargo. */
export const FLUJOS_DEL_ESTADO = new Map<string, Flujo[]>();
for (const f of FLUJOS) {
  if (f.importado) continue;
  const e = SITIOS_CADENA.find((s) => s.clave === f.origen)?.estado;
  if (!e) continue;
  FLUJOS_DEL_ESTADO.set(e, [...(FLUJOS_DEL_ESTADO.get(e) ?? []), f]);
}
