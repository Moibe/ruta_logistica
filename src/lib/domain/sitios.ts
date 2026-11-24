import type { LonLat } from './geo';
import aeropuertosJson from './datos/aeropuertos.json';
import ciudadesJson from './datos/ciudades.json';
import petroleoJson from './datos/petroleo.json';
import plataformasJson from './datos/plataformas.json';
import interioresJson from './datos/interiores.json';
import polosJson from './datos/polos.json';
import puertasJson from './datos/puertas.json';
import puertosJson from './datos/puertos.json';
import { SITIOS_CADENA } from './cadenas';

/**
 * The fixed places of the board. Pure data: nothing here knows how a site is
 * drawn, so the Mexico board and the world views read the same list.
 *
 * Cities come from Natural Earth through `npm run datos` (state capitals, every
 * city over 300k and a handful of border and port towns). Ports are curated by
 * hand in `datos/puertos.json`, because Natural Earth's port layer misses the
 * two biggest ones in the country after Manzanillo's (Lázaro Cárdenas and
 * Altamira). They are JSON, not TS, so `npm run datos` can read them too: the
 * sea lanes between ports are computed there.
 */

export type ClaveEstado = string;

/**
 * The ten airports that moved the most cargo in 2025 (AFAC), with their tonnes.
 * Not stops yet: they'll be dry ports when cargo comes in.
 */
export type Aeropuerto = {
  id: string;
  nombre: string;
  /** For the map label: "AIFA", "Aerop. Monterrey". */
  corto: string;
  iata: string;
  estado: ClaveEstado;
  lonLat: LonLat;
  /** Tonnes of cargo in the year. */
  t2024: number;
  t2025: number;
  /** Only when the AFAC lists it among the top ten of that kind. */
  domestica2025?: number;
  internacional2025?: number;
  /** Tonnes each year from 2018 (AFAC series), and its place in the country that year. */
  serie: Record<string, AñoAeropuerto>;
  /** First month with cargo ("2022-03" for the AIFA, which opened then). */
  desde: string;
};

export type AñoAeropuerto = { nacional: number; internacional: number; lugar: number | null };

type AeropuertosJson = {
  fuente: { fuente: string; url: string };
  totalPais: Record<'2024' | '2025', number>;
  serie: {
    fuente: string;
    url: string;
    /** The last year, still running: how many of its months are in. */
    parcial: { año: number; meses: number };
    totalPais: Record<string, number>;
  };
  aeropuertos: (Omit<Aeropuerto, 'lonLat'> & { lon: number; lat: number })[];
};
const AEROPUERTOS_JSON = aeropuertosJson as AeropuertosJson;

/** Biggest first: their place in the list is their place in the country. */
export const AEROPUERTOS: readonly Aeropuerto[] = AEROPUERTOS_JSON.aeropuertos
  .map(({ lon, lat, ...a }) => ({ ...a, lonLat: [lon, lat] as LonLat }))
  .sort((x, y) => y.t2025 - x.t2025);
export const FUENTE_AEROPUERTOS = AEROPUERTOS_JSON.fuente;
/** Tonnes of air cargo in the whole country. */
export const CARGA_AEREA_PAIS = AEROPUERTOS_JSON.totalPais;
/** The yearly series behind Realidad: source, the partial last year, the country's total each year. */
export const SERIE_AEROPUERTOS = AEROPUERTOS_JSON.serie;
export const AÑOS_AEROPUERTOS = Object.keys(SERIE_AEROPUERTOS.totalPais).map(Number);

/** The year whose tonnes an airport shows: 2025 in the game; in Realidad, the date's own year (within the series). */
export function añoDeCarga(año: number): number {
  return Math.max(AÑOS_AEROPUERTOS[0], Math.min(año, AÑOS_AEROPUERTOS[AÑOS_AEROPUERTOS.length - 1]));
}

/** Tonnes of an airport in a year (0 when it had none). */
export const toneladas = (a: Aeropuerto, año: number) => {
  const s = a.serie[String(año)];
  return s ? s.nacional + s.internacional : 0;
};

export type Ciudad = {
  id: string;
  nombre: string;
  estado: ClaveEstado;
  lonLat: LonLat;
  poblacion: number;
  capital: 'pais' | 'estado' | null;
  /**
   * Where its station goes when that isn't the track nearest to the city: a
   * real station that serves it from farther than `ESTACION_MAX_KM`
   * (Cancún's is at the airport).
   */
  estacion?: { nombre: string; lonLat: LonLat };
};

export type Litoral = 'pacifico' | 'golfo';

export type Puerto = {
  id: string;
  nombre: string;
  estado: ClaveEstado;
  lonLat: LonLat;
  litoral: Litoral;
  /** The four that move most of Mexico's containers get a heavier symbol. */
  principal: boolean;
};

type CiudadJson = {
  id: string;
  nombre: string;
  estado: string;
  lon: number;
  lat: number;
  poblacion: number;
  capital: 'pais' | 'estado' | null;
  estacion?: { nombre: string; lon: number; lat: number };
};

export const CIUDADES: readonly Ciudad[] = (ciudadesJson as CiudadJson[]).map((c) => ({
  id: c.id,
  nombre: c.nombre,
  estado: c.estado,
  lonLat: [c.lon, c.lat],
  poblacion: c.poblacion,
  capital: c.capital,
  ...(c.estacion ? { estacion: { nombre: c.estacion.nombre, lonLat: [c.estacion.lon, c.estacion.lat] as LonLat } } : {}),
}));

type PuertoJson = {
  id: string;
  nombre: string;
  estado: string;
  lon: number;
  lat: number;
  litoral: Litoral;
  principal: boolean;
};

/**
 * Port terminals (the docks, not the town centre), ordered Pacific north →
 * south, then Gulf. River ports (Altamira, Tampico, Tuxpan) sit at their
 * harbour mouth, which is where a ship arrives.
 */
export const PUERTOS: readonly Puerto[] = (puertosJson as PuertoJson[]).map((p) => ({
  id: p.id,
  nombre: p.nombre,
  estado: p.estado,
  lonLat: [p.lon, p.lat],
  litoral: p.litoral,
  principal: p.principal,
}));

/**
 * Gateways to the rest of the world, on the edge of the board. A ship that
 * sails out through one crosses the ocean to the port it stands for (`hacia`):
 * off the board, on the world views. As a stop, a gateway *is* that far port —
 * a ship "calling at Asia" loads and unloads in Shanghái.
 */
export type Puerta = {
  id: string;
  nombre: string;
  lonLat: LonLat;
  /** The far port the crossing goes to. */
  hacia: string;
  haciaLonLat: LonLat;
  /** The ocean the crossing goes over. */
  oceano: string;
};

type PuertaJson = {
  id: string;
  nombre: string;
  lon: number;
  lat: number;
  hacia: string;
  haciaLon: number;
  haciaLat: number;
  oceano: string;
};

export const PUERTAS: readonly Puerta[] = (puertasJson as PuertaJson[]).map((p) => ({
  id: p.id,
  nombre: p.nombre,
  lonLat: [p.lon, p.lat],
  hacia: p.hacia,
  haciaLonLat: [p.haciaLon, p.haciaLat],
  oceano: p.oceano,
}));

/**
 * Port cities: the city that shares its name with a port (Veracruz, Mazatlán,
 * Manzanillo…), keyed by port id. They are one place on the board — the
 * port's label stands for both, and its card shows the city's population.
 */
export const CIUDAD_DEL_PUERTO: ReadonlyMap<string, Ciudad> = new Map(
  PUERTOS.flatMap((p) => {
    const c = CIUDADES.find((c) => c.nombre === p.nombre);
    return c ? [[p.id, c] as const] : [];
  })
);

/** Reverse of `CIUDAD_DEL_PUERTO`: city id → its port. */
export const PUERTO_DE_LA_CIUDAD: ReadonlyMap<string, Puerto> = new Map(
  PUERTOS.flatMap((p) => {
    const c = CIUDAD_DEL_PUERTO.get(p.id);
    return c ? [[c.id, p] as const] : [];
  })
);

/**
 * The Polos del Bienestar: industrial estates the federal government has
 * declared in the DOF since 2023, under three programmes. On the board they
 * are sites **for the player to build**, like any work from 2018 on; this is
 * only where they'll be. Every one sits where its own declaratoria puts it: the
 * centroid of the biggest polygon of its "cuadro de construcción" (see
 * `datos/polos.json` and the encyclopedia for the method and the exceptions).
 */
export type ProgramaPolo = 'interoceanico' | 'plan-mexico' | 'economia-circular';

export const PROGRAMAS_POLO: Record<ProgramaPolo, string> = {
  interoceanico: 'Corredor Interoceánico',
  'plan-mexico': 'Plan México',
  'economia-circular': 'Economía circular',
};

export type Polo = {
  id: string;
  /** As the declaratoria names it. */
  nombre: string;
  /** For the map label: where it is, when the official name doesn't say. */
  corto: string;
  programa: ProgramaPolo;
  estado: ClaveEstado;
  municipio: string;
  lonLat: LonLat;
  /** Surface the declaratoria gives. */
  hectareas: number;
  /** Publication date of the declaratoria in the DOF (yyyy-mm-dd) and the note's code there. */
  dof: string;
  codigoDof: number;
  /** How the point was obtained: from the coordinate table, or one of the documented exceptions. */
  ubicacion: 'cuadro' | 'tme' | 'imagen' | 'frontera';
};

type PoloJson = {
  id: string;
  nombre: string;
  corto: string;
  programa: ProgramaPolo;
  estado: string;
  municipio: string;
  lon: number;
  lat: number;
  ha: number;
  dof: string;
  codigo: number;
  ubicacion: Polo['ubicacion'];
};

export const POLOS: readonly Polo[] = (polosJson as PoloJson[]).map((p) => ({
  id: p.id,
  nombre: p.nombre,
  corto: p.corto,
  programa: p.programa,
  estado: p.estado,
  municipio: p.municipio,
  lonLat: [p.lon, p.lat],
  hectareas: p.ha,
  dof: p.dof,
  codigoDof: p.codigo,
  ubicacion: p.ubicacion,
}));

/** The declaratoria in the DOF's own site. */
export function urlDof(p: Polo): string {
  const [a, m, d] = p.dof.split('-');
  return `https://dof.gob.mx/nota_detalle.php?codigo=${p.codigoDof}&fecha=${d}/${m}/${a}`;
}

/** Geographic centre of mass of the country, where cameras aim when they "look at Mexico". */
export const CENTRO_MEXICO: LonLat = [-102.5, 23.6];

// ---- one registry for every kind of site ------------------------------------

export type TipoSitio = 'ciudad' | 'puerto' | 'puerta' | 'polo' | 'aeropuerto' | 'refineria' | 'plataforma' | 'mina' | 'industria';

/**
 * Pemex's offshore complexes in the Bay of Campeche are stops at sea for the
 * supply vessels (`plataformas.ts`); the sea lanes reach them like ports.
 */
type ComplejoSitioJson = { id: string; corto: string; estado: string; lon: number; lat: number };
const COMPLEJOS_SITIO = (plataformasJson as unknown as { complejos: ComplejoSitioJson[] }).complejos;

/**
 * Pemex's refineries in Mexico are freight stations too: within reach of the
 * track they get one, like a city, and fuel loads there. Read straight from
 * the oil data (`petroleo.ts` builds on this module's neighbours, so it isn't
 * imported here). Deer Park, in Texas, is off the network.
 */
type RefineriaSitioJson = { id: string; corto: string; estado: string; lonLat: LonLat; extranjera?: boolean };
const REFINERIAS_SITIO = (petroleoJson as unknown as { refinerias: RefineriaSitioJson[] }).refinerias.filter((r) => !r.extranjera);

/**
 * Any place on the board, whatever its kind, under one key. Ids alone clash
 * ("veracruz" is a city and a port), so the key is `tipo:id` — `puerto:veracruz`,
 * `ciudad:veracruz`. Stations, train stops and (later) player-built sites all
 * refer to places by this key.
 */
export type Sitio = {
  clave: string;
  tipo: TipoSitio;
  id: string;
  nombre: string;
  estado: ClaveEstado;
  lonLat: LonLat;
  /** Where its station is sought, when not at `lonLat` (`Ciudad.estacion`). */
  lonLatEstacion?: LonLat;
  /** How far from the track its station may be, when farther than `ESTACION_MAX_KM`: a polo's spur. */
  alcanceKm?: number;
};

/**
 * A built polo reaches the track as far as the spur of its close-up goes, plus a margin (the spur
 * is measured from the land's edge, the station from its marker): Seybaplaya's goes 37 km to the
 * Tren Maya, San Jerónimo's 15 km to Ferromex in Ciudad Juárez.
 */
const MARGEN_ESPUELA_KM = 3;
const INTERIORES = (interioresJson as unknown as { polos: Record<string, { espuela?: { km: number } }> }).polos;
export const alcanceDelPolo = (id: string) => {
  const km = INTERIORES[id]?.espuela?.km;
  return km === undefined ? undefined : km + MARGEN_ESPUELA_KM;
};

export const SITIOS: readonly Sitio[] = [
  ...PUERTOS.map((p) => ({ clave: `puerto:${p.id}`, tipo: 'puerto' as const, id: p.id, nombre: p.nombre, estado: p.estado, lonLat: p.lonLat })),
  ...CIUDADES.map((c) => ({
    clave: `ciudad:${c.id}`,
    tipo: 'ciudad' as const,
    id: c.id,
    nombre: c.nombre,
    estado: c.estado,
    lonLat: c.lonLat,
    lonLatEstacion: c.estacion?.lonLat,
  })),
  // Gateways belong to no estado.
  ...PUERTAS.map((p) => ({ clave: `puerta:${p.id}`, tipo: 'puerta' as const, id: p.id, nombre: p.nombre, estado: '', lonLat: p.lonLat })),
  ...POLOS.map((p) => ({ clave: `polo:${p.id}`, tipo: 'polo' as const, id: p.id, nombre: `Polo ${p.corto}`, estado: p.estado, lonLat: p.lonLat, alcanceKm: alcanceDelPolo(p.id) })),
  // Cargo airports are dry ports: within reach of the track they get a station like a city.
  ...AEROPUERTOS.map((a) => ({ clave: `aeropuerto:${a.id}`, tipo: 'aeropuerto' as const, id: a.id, nombre: a.corto, estado: a.estado, lonLat: a.lonLat })),
  ...REFINERIAS_SITIO.map((r) => ({ clave: `refineria:${r.id}`, tipo: 'refineria' as const, id: r.id, nombre: `Ref. ${r.corto}`, estado: r.estado, lonLat: r.lonLat })),
  // At sea: never a station (the track is far), only a stop for supply vessels.
  ...COMPLEJOS_SITIO.map((c) => ({
    clave: `plataforma:${c.id}`,
    tipo: 'plataforma' as const,
    id: c.id,
    nombre: c.corto,
    estado: c.estado,
    lonLat: [c.lon, c.lat] as LonLat,
  })),
  // The mines and plants of a supply chain (`cadenas.ts`): within reach of the track they get a station.
  ...SITIOS_CADENA,
];

export function polo(clave: string): Polo | null {
  return clave.startsWith('polo:') ? (POLOS.find((p) => `polo:${p.id}` === clave) ?? null) : null;
}

export function puerta(clave: string): Puerta | null {
  return clave.startsWith('puerta:') ? (PUERTAS.find((p) => `puerta:${p.id}` === clave) ?? null) : null;
}

const POR_CLAVE = new Map(SITIOS.map((s) => [s.clave, s]));

export function sitio(clave: string): Sitio {
  const s = POR_CLAVE.get(clave);
  if (!s) throw new Error(`Sitio desconocido: ${clave}`);
  return s;
}

/**
 * The name as it fits on a train's board: CDMX, not "Ciudad de México". A
 * gateway goes by its far port, which is where a ship calling there calls.
 */
export function nombreCorto(clave: string): string {
  const p = puerta(clave);
  if (p) return p.hacia;
  const s = sitio(clave);
  return s.nombre === 'Ciudad de México' ? 'CDMX' : s.nombre;
}
