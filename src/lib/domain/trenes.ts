import { ruta, type CostoTramo, type Red } from './red';
import { armarMarcha, type Marcha } from './servicio';
import { nombreCorto } from './sitios';

/**
 * Freight trains: a service (`servicio.ts`) run there and back on the rail
 * network, stopping at every station to load and unload. How a train looks is
 * the board's business.
 */

/** A Mexican freight train is ~100 cars: close to two kilometres of train. */
export const LARGO_TREN_KM = 1.8;
/** Hours at the ends of the line (full load/unload) and at stops along the way. */
export const ESPERA_TERMINAL_H = 3;
export const ESPERA_INTERMEDIA_H = 1;

export type Tren = Marcha & {
  tipo: 'tren';
  id: string;
  nombre: string;
  color: string;
  /** Export cargo aboard, tonnes, and the states it came from. */
  carga: number;
  cargaDe: Record<string, number>;
  /** Tonnes it has exported so far. */
  exportado: number;
  /** Domestic cargo aboard, for its next stop, and what it has delivered so far (tonnes). */
  cargaNacional: number;
  movidoNacional: number;
  /** Fuel aboard (barrels), the refinery it came from, and the barrels it has delivered so far (`combustibles.ts`). */
  combustible: number;
  combustibleDe: string | null;
  entregadoCombustible: number;
};

/**
 * Warm colours only: amber is the rail colour, and cyan stays reserved for the
 * sea. Each train gets the next one, so neighbours on the roster differ.
 */
export const COLORES_TREN = ['#ffd166', '#ff9f68', '#ff7aa8', '#c3a6ff', '#8ef0b0', '#f4f1de', '#ff6f61', '#d4f27a'];

export type NuevoTren = {
  id: string;
  color: string;
  paradas: string[];
  /** Hours to fast-forward the train after creating it, so a fleet doesn't start in lockstep. */
  desfase?: number;
};

/**
 * Builds the train, or null if some stop has no station or two stops aren't
 * connected by rail. `costo` is how it weighs each tramo when choosing its way
 * (free-track hours by default; the simulation passes current line use).
 */
export function crearTren(red: Red, def: NuevoTren, costo?: CostoTramo): Tren | null {
  const marcha = armarMarcha({
    paradas: def.paradas,
    recorrido: 'ida-y-vuelta',
    ruta: (a, b) => {
      const ea = red.estaciones.get(a);
      const eb = red.estaciones.get(b);
      return ea && eb ? ruta(red, ea.nodo, eb.nodo, costo) : null;
    },
    espera: (_, terminal) => (terminal ? ESPERA_TERMINAL_H : ESPERA_INTERMEDIA_H),
    desfase: def.desfase,
  });
  if (!marcha) return null;
  return {
    ...marcha,
    tipo: 'tren',
    id: def.id,
    nombre: `${nombreCorto(def.paradas[0])} ⇄ ${nombreCorto(def.paradas[def.paradas.length - 1])}`,
    color: def.color,
    // Born at its first stop as if just arrived there: it loads before leaving.
    llegadas: marcha.estado === 'parada' ? [marcha.pierna] : [],
    carga: 0,
    cargaDe: {},
    exportado: 0,
    cargaNacional: 0,
    movidoNacional: 0,
    combustible: 0,
    combustibleDe: null,
    entregadoCombustible: 0,
  };
}

// ---- the opening timetable -----------------------------------------------------------

/**
 * Services the board starts with, on real freight corridors: the Pacific
 * ports to the capital, the NAFTA corridor to Nuevo Laredo, the Gulf, the
 * isthmus. Stops are site keys; the route between them is whatever the
 * network says is fastest.
 */
export const SERVICIOS: string[][] = [
  ['puerto:manzanillo', 'ciudad:guadalajara', 'ciudad:ciudad-de-mexico'],
  ['puerto:lazaro-cardenas', 'ciudad:san-luis-potosi', 'ciudad:monterrey', 'ciudad:nuevo-laredo'],
  ['puerto:veracruz', 'ciudad:puebla', 'ciudad:ciudad-de-mexico'],
  ['ciudad:ciudad-de-mexico', 'ciudad:queretaro', 'ciudad:torreon', 'ciudad:chihuahua', 'ciudad:ciudad-juarez'],
  ['ciudad:guadalajara', 'puerto:mazatlan', 'ciudad:hermosillo', 'ciudad:nogales'],
  ['puerto:altamira', 'ciudad:monterrey'],
  ['puerto:coatzacoalcos', 'puerto:salina-cruz'],
  ['puerto:coatzacoalcos', 'ciudad:merida', 'puerto:progreso'],
];
