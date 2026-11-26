import { distanceKm, interpolate, type LonLat } from './geo';
import { crearTrayecto, type Trayecto } from './trayecto';
import { PUERTAS } from './sitios';

/** Gateways whose far port is on the board (Houston): the board follows the whole crossing. */
const TRAVESIA_EN_TABLERO = new Set(PUERTAS.filter((p) => p.enTablero).map((p) => `puerta:${p.id}`));

/**
 * Sea lanes. `npm run datos` routes one lane between every pair of ports and
 * gateways (static/data/rutas-maritimas.json): shortest path on a 0.05° grid
 * of Natural Earth's land, kept ~20 km off the coast where it can be,
 * straightened into straight runs, through the Panama Canal when the two ends
 * are on different oceans, and audited so no lane crosses land.
 *
 * Beyond each gateway runs its ocean crossing (`scripts/travesias.mjs`): the
 * same method on a 0.1° grid of the whole world, straightened into
 * great-circle arcs, out to the far port the gateway stands for. A leg to or
 * from a gateway is the lane plus that crossing: the ship really sails to
 * Shanghái or Róterdam, and the board shows the part between the gateways.
 */

export type RutasMarJson = {
  fuente: string;
  canalPanama: [number, number][];
  rutas: { a: string; b: string; km: number; coords: number[]; canal: number[] }[];
  /** Turning points, gateway → far port; each pair of them is joined by a great circle. */
  travesias: { puerta: string; hacia: string; km: number; coords: number[] }[];
};

type Carril = { puntos: LonLat[]; canal: boolean[] };

export type Mar = {
  /** By `a|b` in the direction stored; `carril()` reverses as needed. */
  carriles: Map<string, Carril>;
  /** The canal's centreline, Pacific → Caribbean, for drawing it. */
  canalPanama: LonLat[];
  /**
   * Gateway key → its crossing, gateway → far port, as a polyline dense enough
   * to follow the great circles (see `PASO_TRAVESIA_KM`). Longitudes run on
   * continuously from the gateway's — through the antimeridian to Shanghái
   * they reach −238° — so distances and interpolation along it stay local.
   */
  travesias: Map<string, LonLat[]>;
};

/**
 * Average speed through the Panama Canal, km/h: ~80 km of locks, cut and lake
 * in about nine hours.
 */
export const VELOCIDAD_CANAL = 9;

/**
 * Densify the crossings' great-circle arcs to vertices this far apart. A ship
 * moves straight in lon/lat between vertices; over 50 km that stays within
 * metres of the great circle, and the km measured per segment agree with the
 * great-circle length to well under 0.1%.
 */
const PASO_TRAVESIA_KM = 50;

/** Shift a polyline by whole turns so its point `i` sits at the longitude of `ref`. */
function alinear(puntos: LonLat[], i: number, ref: LonLat): LonLat[] {
  const d = 360 * Math.round((ref[0] - puntos[i][0]) / 360);
  return d ? puntos.map(([lon, lat]) => [lon + d, lat]) : puntos;
}

function travesia(coords: number[]): LonLat[] {
  const vertices: LonLat[] = [];
  for (let i = 0; i < coords.length; i += 2) vertices.push([coords[i], coords[i + 1]]);
  const out: LonLat[] = [vertices[0]];
  for (let k = 1; k < vertices.length; k++) {
    const a = vertices[k - 1];
    const b = vertices[k];
    const n = Math.max(1, Math.ceil(distanceKm(a, b) / PASO_TRAVESIA_KM));
    for (let s = 1; s <= n; s++) {
      const p = s === n ? b : interpolate(a, b, s / n);
      const previo = out[out.length - 1];
      out.push([p[0] + 360 * Math.round((previo[0] - p[0]) / 360), p[1]]);
    }
  }
  return out;
}

export function construirMar(json: RutasMarJson): Mar {
  const carriles = new Map<string, Carril>();
  for (const r of json.rutas) {
    const puntos: LonLat[] = [];
    for (let i = 0; i < r.coords.length; i += 2) puntos.push([r.coords[i], r.coords[i + 1]]);
    const canal = new Array<boolean>(puntos.length - 1).fill(false);
    for (const i of r.canal) canal[i] = true;
    carriles.set(`${r.a}|${r.b}`, { puntos, canal });
  }
  const travesias = new Map<string, LonLat[]>();
  for (const t of json.travesias ?? []) travesias.set(t.puerta, travesia(t.coords));
  return { carriles, canalPanama: json.canalPanama.map(([lon, lat]) => [lon, lat]), travesias };
}

function carril(mar: Mar, desde: string, hasta: string): Carril | null {
  const ida = mar.carriles.get(`${desde}|${hasta}`);
  if (ida) return ida;
  const vuelta = mar.carriles.get(`${hasta}|${desde}`);
  return vuelta ? { puntos: [...vuelta.puntos].reverse(), canal: [...vuelta.canal].reverse() } : null;
}

/**
 * The route between two ports or gateways at a ship's speed (canal at canal
 * speed). From a gateway it starts at its far port and sails the crossing in;
 * to a gateway it sails the crossing out to the far port. `enTablero` marks the
 * lane between.
 */
export function rutaMar(mar: Mar, desde: string, hasta: string, velocidad: number): Trayecto | null {
  if (desde === hasta) return null;
  const c = carril(mar, desde, hasta);
  if (!c) return null;
  const salida = mar.travesias.get(desde);
  const llegada = mar.travesias.get(hasta);
  // Far port → gateway, ending on the lane's first point; gateway → far port, from its last.
  const antes = salida ? alinear([...salida].reverse(), salida.length - 1, c.puntos[0]) : [];
  const despues = llegada ? alinear(llegada, 0, c.puntos[c.puntos.length - 1]) : [];
  const i0 = Math.max(0, antes.length - 1);
  const puntos = [...antes.slice(0, -1), ...c.puntos, ...despues.slice(1)];
  const vel = [
    ...antes.slice(1).map(() => velocidad),
    ...c.canal.map((enCanal) => (enCanal ? VELOCIDAD_CANAL : velocidad)),
    ...despues.slice(1).map(() => velocidad),
  ];
  const desdeTablero = TRAVESIA_EN_TABLERO.has(desde) ? 0 : i0;
  const hastaTablero = TRAVESIA_EN_TABLERO.has(hasta) ? puntos.length - 1 : i0 + c.puntos.length - 1;
  return crearTrayecto(puntos, vel, [desdeTablero, hastaTablero]);
}

/** Whether the lane between two points goes through the Panama Canal. */
export function cruzaElCanal(mar: Mar, desde: string, hasta: string): boolean {
  return carril(mar, desde, hasta)?.canal.some(Boolean) ?? false;
}

/** Length of a gateway's ocean crossing, km (0 for anything else). */
export function kmTravesia(mar: Mar, clave: string): number {
  const t = mar.travesias.get(clave);
  if (!t) return 0;
  let km = 0;
  for (let i = 1; i < t.length; i++) km += distanceKm(t[i - 1], t[i]);
  return km;
}
