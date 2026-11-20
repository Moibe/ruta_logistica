import type { LonLat } from './geo';
import { crearTrayecto, type Trayecto } from './trayecto';

/**
 * Sea lanes. `npm run datos` routes one lane between every pair of ports and
 * gateways (static/data/rutas-maritimas.json): shortest path on a 0.05° grid
 * of Natural Earth's land, kept ~20 km off the coast where it can be,
 * straightened into straight runs, through the Panama Canal when the two ends
 * are on different oceans, and audited so no lane crosses land.
 */

export type RutasMarJson = {
  fuente: string;
  canalPanama: [number, number][];
  rutas: { a: string; b: string; km: number; coords: number[]; canal: number[] }[];
};

type Carril = { puntos: LonLat[]; canal: boolean[] };

export type Mar = {
  /** By `a|b` in the direction stored; `carril()` reverses as needed. */
  carriles: Map<string, Carril>;
  /** The canal's centreline, Pacific → Caribbean, for drawing it. */
  canalPanama: LonLat[];
};

/**
 * Average speed through the Panama Canal, km/h: ~80 km of locks, cut and lake
 * in about nine hours.
 */
export const VELOCIDAD_CANAL = 9;

export function construirMar(json: RutasMarJson): Mar {
  const carriles = new Map<string, Carril>();
  for (const r of json.rutas) {
    const puntos: LonLat[] = [];
    for (let i = 0; i < r.coords.length; i += 2) puntos.push([r.coords[i], r.coords[i + 1]]);
    const canal = new Array<boolean>(puntos.length - 1).fill(false);
    for (const i of r.canal) canal[i] = true;
    carriles.set(`${r.a}|${r.b}`, { puntos, canal });
  }
  return { carriles, canalPanama: json.canalPanama.map(([lon, lat]) => [lon, lat]) };
}

function carril(mar: Mar, desde: string, hasta: string): Carril | null {
  const ida = mar.carriles.get(`${desde}|${hasta}`);
  if (ida) return ida;
  const vuelta = mar.carriles.get(`${hasta}|${desde}`);
  return vuelta ? { puntos: [...vuelta.puntos].reverse(), canal: [...vuelta.canal].reverse() } : null;
}

/** The lane between two ports or gateways at a ship's speed (canal at canal speed). */
export function rutaMar(mar: Mar, desde: string, hasta: string, velocidad: number): Trayecto | null {
  if (desde === hasta) return null;
  const c = carril(mar, desde, hasta);
  if (!c) return null;
  return crearTrayecto(
    c.puntos,
    c.canal.map((enCanal) => (enCanal ? VELOCIDAD_CANAL : velocidad))
  );
}

/** Whether the lane between two points goes through the Panama Canal. */
export function cruzaElCanal(mar: Mar, desde: string, hasta: string): boolean {
  return carril(mar, desde, hasta)?.canal.some(Boolean) ?? false;
}
