import type { LonLat } from './geo';
import ciudadesJson from './datos/ciudades.json';

/**
 * The fixed places of the board. Pure data: nothing here knows how a site is
 * drawn, so the Mexico board and the world views read the same list.
 *
 * Cities come from Natural Earth through `npm run datos` (state capitals, every
 * city over 300k and a handful of border and port towns). Ports are curated by
 * hand below, because Natural Earth's port layer misses the two biggest ones in
 * the country (Lázaro Cárdenas and Altamira).
 */

export type ClaveEstado = string;

export type Ciudad = {
  id: string;
  nombre: string;
  estado: ClaveEstado;
  lonLat: LonLat;
  poblacion: number;
  capital: 'pais' | 'estado' | null;
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
};

export const CIUDADES: readonly Ciudad[] = (ciudadesJson as CiudadJson[]).map((c) => ({
  id: c.id,
  nombre: c.nombre,
  estado: c.estado,
  lonLat: [c.lon, c.lat],
  poblacion: c.poblacion,
  capital: c.capital,
}));

/** Port terminals (the docks, not the town centre), ordered Pacific north → south, then Gulf. */
export const PUERTOS: readonly Puerto[] = [
  { id: 'ensenada', nombre: 'Ensenada', estado: 'BC', lonLat: [-116.625, 31.855], litoral: 'pacifico', principal: false },
  { id: 'guaymas', nombre: 'Guaymas', estado: 'SON', lonLat: [-110.86, 27.915], litoral: 'pacifico', principal: false },
  { id: 'topolobampo', nombre: 'Topolobampo', estado: 'SIN', lonLat: [-109.05, 25.6], litoral: 'pacifico', principal: false },
  { id: 'mazatlan', nombre: 'Mazatlán', estado: 'SIN', lonLat: [-106.405, 23.195], litoral: 'pacifico', principal: false },
  { id: 'manzanillo', nombre: 'Manzanillo', estado: 'COL', lonLat: [-104.305, 19.065], litoral: 'pacifico', principal: true },
  { id: 'lazaro-cardenas', nombre: 'Lázaro Cárdenas', estado: 'MICH', lonLat: [-102.175, 17.945], litoral: 'pacifico', principal: true },
  { id: 'salina-cruz', nombre: 'Salina Cruz', estado: 'OAX', lonLat: [-95.195, 16.165], litoral: 'pacifico', principal: false },
  { id: 'puerto-chiapas', nombre: 'Puerto Chiapas', estado: 'CHIS', lonLat: [-92.405, 14.705], litoral: 'pacifico', principal: false },
  { id: 'altamira', nombre: 'Altamira', estado: 'TAMPS', lonLat: [-97.84, 22.48], litoral: 'golfo', principal: true },
  { id: 'tampico', nombre: 'Tampico', estado: 'TAMPS', lonLat: [-97.78, 22.258], litoral: 'golfo', principal: false },
  { id: 'tuxpan', nombre: 'Tuxpan', estado: 'VER', lonLat: [-97.28, 20.955], litoral: 'golfo', principal: false },
  { id: 'veracruz', nombre: 'Veracruz', estado: 'VER', lonLat: [-96.135, 19.205], litoral: 'golfo', principal: true },
  { id: 'coatzacoalcos', nombre: 'Coatzacoalcos', estado: 'VER', lonLat: [-94.41, 18.14], litoral: 'golfo', principal: false },
  { id: 'dos-bocas', nombre: 'Dos Bocas', estado: 'TAB', lonLat: [-93.18, 18.43], litoral: 'golfo', principal: false },
  { id: 'progreso', nombre: 'Progreso', estado: 'YUC', lonLat: [-89.665, 21.285], litoral: 'golfo', principal: false },
];

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

/** Geographic centre of mass of the country, where cameras aim when they "look at Mexico". */
export const CENTRO_MEXICO: LonLat = [-102.5, 23.6];
