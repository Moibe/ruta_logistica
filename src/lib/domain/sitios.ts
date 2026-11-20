import type { LonLat } from './geo';
import ciudadesJson from './datos/ciudades.json';
import polosJson from './datos/polos.json';
import puertasJson from './datos/puertas.json';
import puertosJson from './datos/puertos.json';

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

export type TipoSitio = 'ciudad' | 'puerto' | 'puerta' | 'polo';

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
  ...POLOS.map((p) => ({ clave: `polo:${p.id}`, tipo: 'polo' as const, id: p.id, nombre: `Polo ${p.corto}`, estado: p.estado, lonLat: p.lonLat })),
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
