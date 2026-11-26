import { EMPRESAS_INDUSTRIA, INDUSTRIAS, PARCIAL_RAIAVL, añoRaiavl, type Industria } from './industrias';
import { MINAS, cifraMina } from './mineria';
import { horasDeFecha } from './calendario';
import aeropuertosJson from './datos/aeropuertos.json';
import energiaJson from './datos/energia.json';
import combustoleoJson from './datos/combustoleo.json';
import type { LonLat } from './geo';
import type { ClaveEstado } from './sitios';

/**
 * Supply chains. Each flow is cargo with an origin and a destination: it waits at the origin's
 * station (up to `DIAS_EN_PATIO` days of it) and only boards a train that will stop at its
 * destination; delivered, it counts in tonnes and tonne-km.
 *
 * The links: minerals from a mine (or a port of entry) to the plant that uses them; coal to the
 * coal-fired plants of Nava; the steel mills' steel to the carmakers near them; and T-MEX with the
 * AIFA. Some plants depend on what reaches them (`PLANTAS_INSUMO`): a steel mill makes less steel,
 * the copper smelter less copper and Nava fewer MW when they're short of inputs.
 *
 * No invented tonnes: a mine's flows are its own production (its company's report), the imports
 * are the rail yearbook's (ARTF 2018) and the steel is the mills' share of the yearbook's. How an
 * output splits among its destinations is an estimate of the game, said in each flow. The domestic
 * flows come out of their state's generic domestic cargo, so the country's total stays the
 * yearbook's.
 *
 * Only what goes by rail: Las Truchas (slurry pipeline), Hércules and the mine of La Caridad (no
 * source for how they ship) and Baja California Sur (no railway) don't load. MICARE's coal reaches
 * Nava by conveyor belt: it's a flow, but no train carries it.
 */

export type Producto = 'hierro' | 'carbon' | 'coque' | 'cobre' | 'acero' | 'aerea';
export const NOMBRE_PRODUCTO: Record<Producto, string> = {
  hierro: 'mineral de hierro',
  carbon: 'carbón',
  coque: 'coque',
  cobre: 'concentrado de cobre',
  acero: 'acero',
  aerea: 'carga aérea',
};

/** The mines and plants that are stops of a chain: they get a station like a city. */
export type SitioCadena = { clave: string; tipo: 'mina' | 'industria' | 'central'; id: string; nombre: string; estado: ClaveEstado; lonLat: LonLat; lonLatEstacion?: LonLat };

/** Peña Colorada ships from its pelletizing plant by the port of Manzanillo (OpenStreetMap, «Planta concentradora de hierro Peña Colorada»). */
const ESTACION_PENA_COLORADA: LonLat = [-104.27668, 19.08422];

/** The CFE's coal-fired plants of Nava (José López Portillo, «Río Escondido», and Carbón II), one entry in the energy data. */
type PlantaJson = { nombre: string; mw: number; estado: string; municipio: string; region: string; lonLat: LonLat };
const NAVA = (energiaJson as unknown as { plantas2018: PlantaJson[] }).plantas2018.find((p) => /Escondido/.test(p.nombre))!;
export const NOMBRE_NAVA = NAVA.nombre;

const MINAS_CADENA = ['pena-colorada', 'las-encinas', 'cerro-de-mercado', 'mimosa', 'region-carbonifera', 'buenavista-del-cobre'];
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
  { clave: 'central:nava', tipo: 'central', id: 'nava', nombre: 'Carboeléctricas de Nava', estado: NAVA.estado, lonLat: NAVA.lonLat },
  // The fuel-oil plants that get it by rail at a station of their own (`combustoleo.ts`; read from the data here, which `sitios.ts` builds on).
  ...(combustoleoJson as unknown as { centrales: { entrega: string; planta: string }[] }).centrales
    .filter((c) => c.entrega.startsWith('central:'))
    .map((c) => {
      const p = (energiaJson as unknown as { plantas2018: PlantaJson[] }).plantas2018.find((x) => x.nombre === c.planta)!;
      const id = c.entrega.slice('central:'.length);
      return { clave: c.entrega, tipo: 'central' as const, id, nombre: `Termoeléctrica ${p.nombre.replace(/ \(.*\)$/, '')}`, estado: p.estado, lonLat: p.lonLat };
    }),
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
  /** A steel mill's flow to a carmaker: its share of the mill's steel (the rules below). */
  acerera?: string;
  armadora?: string;
  /** Not by train: a conveyor belt carries it all, straight to the plant. */
  medio?: 'banda';
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
  // Coal for the CFE's plants of Nava.
  {
    id: 'micare-nava',
    producto: 'carbon',
    origen: 'mina:micare',
    destino: 'central:nava',
    mina: 'micare',
    parte: 1,
    medio: 'banda',
    dato: 'Todo su carbón va a las carboeléctricas, a unos 10 km, por banda transportadora (AHMSA): ningún tren lo lleva',
  },
  {
    id: 'mimosa-nava',
    producto: 'carbon',
    origen: 'mina:mimosa',
    destino: 'central:nava',
    mina: 'mimosa',
    parte: 0.56,
    dato: 'Su carbón térmico, 56 % de lo que sacó en 2018 (1.76 de 3.15 millones de toneladas), se vendía a la CFE (AHMSA); que vaya en tren es estimación del juego',
  },
  {
    id: 'region-nava',
    producto: 'carbon',
    origen: 'mina:region-carbonifera',
    destino: 'central:nava',
    mina: 'region-carbonifera',
    parte: 1,
    desde: '2020-07-01',
    dato: 'El carbón que la CFE les compra desde julio de 2020; que vaya en tren es estimación del juego',
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
const AEREOS = aeropuertosJson as unknown as { aeropuertos: { id: string; serie: Record<string, AñoAereo> }[]; serie: { parcial: { año: number; meses: number } } };

/** An airport's international cargo in a year (the running year annualized; the last year carried on). */
function internacional(id: string, año: number): number {
  const s = AEREOS.aeropuertos.find((a) => a.id === id)?.serie ?? {};
  const años = Object.keys(s).map(Number).sort((a, b) => a - b);
  const a = años.filter((x) => x <= año).pop() ?? años[0];
  if (a === undefined) return 0;
  const p = AEREOS.serie.parcial;
  return a === p.año ? (s[String(a)].internacional * 12) / p.meses : s[String(a)].internacional;
}

/**
 * Rule of the game: the private railroads (Ferromex, CPKC) carry this share of every rail flow of
 * the chains on their own, straight to its destination; only the rest waits for the player's
 * trains. In reality they carry all of it; the share keeps the chains from collapsing before the
 * player runs a train.
 */
export const PARTE_PRIVADOS = 0.5;
export const llevanPrivados = (f: Flujo) => f.producto !== 'aerea' && f.medio !== 'banda';
/** The share of a flow that gets there without the player: all of a belt's, the private railroads' share of the rest. */
export const parteAutomatica = (f: Flujo) => (f.medio === 'banda' ? 1 : llevanPrivados(f) ? PARTE_PRIVADOS : 0);
/** A flow's cargo waits at its origin this many days of it, like the states' cargo. */
export const DIAS_EN_PATIO = 30;

// ---- cars: the vehicles exported by train leave from the carmakers' stations ---------------

/**
 * Vehicles that left the country by train in 2018 (ARTF, table 10: 4.9 million tonnes; 77.6 % by
 * Nuevo Laredo and Piedras Negras). Each year scales with the units the carmakers exported (INEGI,
 * RAIAVL), and each brand's share is its exports; a brand with several plants splits it equally
 * among those working (estimate of the game).
 */
export const T_AUTOS_2018 = 4_900_000;

/** A brand's units in a year (the running year annualized). */
function unidades(empresa: string, año: number, cual: 'produccion' | 'exportacion'): number {
  const a = añoRaiavl(año);
  const x = EMPRESAS_INDUSTRIA[empresa]?.serie[String(a)]?.[cual] ?? 0;
  return PARCIAL_RAIAVL && a === PARCIAL_RAIAVL.año ? (x * 12) / PARCIAL_RAIAVL.meses : x;
}
const TOTAL_2018 = Object.keys(EMPRESAS_INDUSTRIA).reduce((s, e) => s + unidades(e, 2018, 'exportacion'), 0);
const trabaja = (p: Industria, horas: number) => (!p.desde || horas >= horasDeFecha(p.desde)) && (!p.hasta || horas < horasDeFecha(p.hasta));
const activasDe = (p: Industria, horas: number) => INDUSTRIAS.filter((x) => x.empresa === p.empresa && x.tipo === 'armadora' && trabaja(x, horas)).length;

/** Tonnes a year of vehicles a carmaker sends to export by train at a game hour. */
export function autosAño(p: Industria, horas: number, año: number): number {
  if (p.tipo !== 'armadora' || !p.empresa || !trabaja(p, horas)) return 0;
  return (T_AUTOS_2018 * unidades(p.empresa, año, 'exportacion')) / TOTAL_2018 / Math.max(1, activasDe(p, horas));
}

/** Vehicles a carmaker makes a year: its brand's (INEGI, RAIAVL) split equally among its working plants. */
export function vehiculosPlanta(p: Industria, horas: number, año: number): number {
  if (p.tipo !== 'armadora' || !p.empresa || !trabaja(p, horas)) return 0;
  return unidades(p.empresa, año, 'produccion') / Math.max(1, activasDe(p, horas));
}

export const ARMADORAS = INDUSTRIAS.filter((p) => p.tipo === 'armadora');

// ---- plants that depend on what reaches them -----------------------------------------------

/**
 * Domestic steel by train in 2018 (ARTF, tables 6-1 and 6-2): 6,468,776 t of sheets and plates plus
 * 2,646,656 t of construction bar, less the 2.7 million tonnes of sheet imported by Matamoros.
 */
export const T_ACERO_TREN = 6_468_776 + 2_646_656 - 2_700_000;
/** Each mill's share of the country's steel: CANACERO in the SGM yearbook, 2016, the last by company (thousand tonnes). */
const ACERO_PAIS_2016 = 18_811;

export type Salida = 'acero' | 'cobre' | 'electricidad';
export type PlantaInsumo = {
  /** Where its inputs arrive (its station's site key). */
  clave: string;
  id: string;
  sale: Salida;
  /** What it makes fully supplied: steel by train and copper cathodes in tonnes a year, power in MW. */
  plena: number;
  /** What it still makes with none of its chain inputs (0–1). */
  piso: number;
  hasta?: string;
  /** A power plant's electricity region, where its lost MW are missed. */
  region?: string;
  /** Where `plena` and `piso` come from. */
  dato: string;
};

export const PLANTAS_INSUMO: PlantaInsumo[] = [
  {
    clave: 'industria:ahmsa',
    id: 'ahmsa',
    sale: 'acero',
    plena: (T_ACERO_TREN * 4652) / ACERO_PAIS_2016,
    piso: 0.5,
    hasta: HASTA_AHMSA,
    dato: 'Su parte del acero del país (4,652 de 18,811 miles de toneladas en 2016, CANACERO) del acero mexicano que movió el tren en 2018; sin insumos de la cadena, la mitad (regla del juego)',
  },
  {
    clave: 'industria:ternium-guerrero',
    id: 'ternium-guerrero',
    sale: 'acero',
    plena: (T_ACERO_TREN * 3515) / ACERO_PAIS_2016 / 2,
    piso: 0.5,
    dato: 'La mitad de la parte de Ternium (3,515 de 18,811 miles de toneladas en 2016, CANACERO; repartida por igual entre sus dos unidades, estimación del juego); sin insumos de la cadena, la mitad (regla del juego)',
  },
  {
    clave: 'industria:ternium-puebla',
    id: 'ternium-puebla',
    sale: 'acero',
    plena: (T_ACERO_TREN * 3515) / ACERO_PAIS_2016 / 2,
    piso: 0.5,
    dato: 'La mitad de la parte de Ternium (3,515 de 18,811 miles de toneladas en 2016, CANACERO; repartida por igual entre sus dos unidades, estimación del juego); sin insumos de la cadena, la mitad (regla del juego)',
  },
  {
    clave: 'industria:la-caridad-fundicion',
    id: 'la-caridad-fundicion',
    sale: 'cobre',
    plena: 239_000,
    piso: 446.2 / 1042,
    dato: 'Sus cátodos de 2018: 239 mil toneladas (Southern Copper); sin el concentrado de Buenavista funde solo el de su propia mina, que no llega en tren: 446 de las 1,042 mil toneladas que fundió en 2018 (dicho de la empresa)',
  },
  {
    clave: 'central:nava',
    id: 'nava',
    sale: 'electricidad',
    plena: NAVA.mw,
    piso: 0.5,
    region: NAVA.region,
    dato: `Sus ${NAVA.mw.toLocaleString('es-MX')} MW (PRODESEN); sin carbón de la cadena, la mitad (regla del juego, como las acereras)`,
  },
];
export const PLANTA_INSUMO = new Map(PLANTAS_INSUMO.map((p) => [p.clave, p]));
export const ACERERAS = PLANTAS_INSUMO.filter((p) => p.sale === 'acero');

/** Rules of the game, as the offshore complexes': a plant keeps up to 15 days of its chain inputs, and what it makes depends on how it was supplied in the last month. */
export const RESERVA_DIAS = 15;
export const MEMORIA_DIAS = 30;
export const factorPlanta = (p: PlantaInsumo, surtido: number) => p.piso + (1 - p.piso) * Math.max(0, Math.min(1, surtido));

/** What a plant makes now, given how it was supplied (tonnes a year, or MW). */
export function salidaPlanta(p: PlantaInsumo, horas: number, surtido: number): number {
  if (p.hasta && horas >= horasDeFecha(p.hasta)) return 0;
  return p.plena * factorPlanta(p, surtido);
}

// ---- steel: the mills' steel to the carmakers near them --------------------------------------

/**
 * Of what the iron and steel industry sold in the country in 2018, the carmakers bought 9.0 %
 * (INEGI, input-output matrix 2018, domestic flows at basic prices: 19,535 of 218,113 million
 * pesos; parts makers, another 4.4 %). Using that share of pesos for tonnes is an estimate of the
 * game.
 */
export const PARTE_ARMADORAS = 19_535 / 218_113;
/** «Most of Ternium's Mexican customers are located near its plants» (Ternium, 20-F 2024): the game takes this far. */
export const KM_CLIENTES = 300;
const kmEntre = (a: LonLat, b: LonLat) => {
  const r = Math.PI / 180;
  const x = (b[0] - a[0]) * r * Math.cos(((a[1] + b[1]) / 2) * r);
  const y = (b[1] - a[1]) * r;
  return 6371 * Math.hypot(x, y);
};
/** Nissan CIVAC has no station (42 km from the track): no train would reach it. */
const SIN_ESTACION = new Set(['nissan-civac']);

for (const a of ACERERAS) {
  const m = INDUSTRIAS.find((x) => x.id === a.id)!;
  for (const c of ARMADORAS) {
    if (SIN_ESTACION.has(c.id) || kmEntre(m.lonLat, c.lonLat) > KM_CLIENTES) continue;
    FLUJOS.push({
      id: `acero-${a.id}-${c.id}`,
      producto: 'acero',
      origen: a.clave,
      destino: `industria:${c.id}`,
      acerera: a.id,
      armadora: c.id,
      hasta: a.hasta,
      dato: `${(PARTE_ARMADORAS * 100).toLocaleString('es-MX', { maximumFractionDigits: 1 })} % de su acero va a las armadoras a menos de ${KM_CLIENTES} km (INEGI, matriz insumo-producto 2018), repartido por los vehículos que hace cada una (estimación del juego)`,
    });
  }
}

export const FLUJO = new Map(FLUJOS.map((f) => [f.id, f]));

/**
 * Tonnes a year of a flow at a game hour: 0 once it stopped. A steel flow follows its mill's steel,
 * so it takes how each plant was supplied (`surtido`, by site key; fully supplied when absent).
 */
export function toneladasAño(f: Flujo, horas: number, año: number, surtido?: (clave: string) => number): number {
  if (f.hasta && horas >= horasDeFecha(f.hasta)) return 0;
  if (f.desde && horas < horasDeFecha(f.desde)) return 0;
  if (f.fijo) return f.fijo;
  if (f.aeropuerto) return internacional(f.aeropuerto, año) * (f.parte ?? 0);
  if (f.acerera) {
    const a = PLANTA_INSUMO.get(`industria:${f.acerera}`)!;
    const de = (id?: string) => {
      const c = INDUSTRIAS.find((x) => x.id === id);
      return c ? vehiculosPlanta(c, horas, año) : 0;
    };
    const total = FLUJOS.filter((g) => g.acerera === f.acerera).reduce((s, g) => s + de(g.armadora), 0);
    if (total <= 0) return 0;
    return (salidaPlanta(a, horas, surtido?.(a.clave) ?? 1) * PARTE_ARMADORAS * de(f.armadora)) / total;
  }
  const m = MINAS.find((x) => x.id === f.mina);
  if (!m || (m.hasta && horas >= horasDeFecha(m.hasta))) return 0;
  return (cifraMina(m, año)?.toneladas ?? 0) * (f.parte ?? 0);
}

/** Tonnes a year of chain inputs a plant expects now (its flows). */
export function insumosAño(clave: string, horas: number, año: number): number {
  return FLUJOS.filter((f) => f.destino === clave).reduce((s, f) => s + toneladasAño(f, horas, año), 0);
}

/**
 * The domestic rail flows that load in each state, to take out of its generic domestic cargo. Not
 * the imports, nor the belt, nor the steel (the mills' whole steel comes out already).
 */
export const FLUJOS_DEL_ESTADO = new Map<string, Flujo[]>();
for (const f of FLUJOS) {
  if (f.importado || f.medio === 'banda' || f.acerera) continue;
  const e = SITIOS_CADENA.find((s) => s.clave === f.origen)?.estado;
  if (!e) continue;
  FLUJOS_DEL_ESTADO.set(e, [...(FLUJOS_DEL_ESTADO.get(e) ?? []), f]);
}
