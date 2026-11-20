import type { LonLat } from './geo';
import type { Sitio } from './sitios';
import { acumulado, crearTrayecto, lerp, type Trayecto } from './trayecto';

/**
 * The rail network as a graph, and how to get around it. Pure data and math:
 * nothing here knows how a track or a train is drawn.
 *
 * The graph comes from `npm run datos` (static/data/red-ferroviaria.json):
 * nodes are junctions, line ends and the points where a line changes class;
 * a tramo is the polyline between two nodes. On top of that, `construirRed`
 * anchors a station to every site within reach of the track — splitting the
 * tramo there if needed — so a route always runs node to node.
 */

// ---- shapes ----------------------------------------------------------------

export type RedJson = {
  fuente: string;
  nodos: [number, number][];
  tramos: { a: number; b: number; km: number; rango: number; doble: number; coords: number[] }[];
};

/**
 * Two classes of track, from Natural Earth's cartographic rank (≤ 6 is a main
 * corridor). It is a mapmaker's ranking rather than an operator's, but it
 * follows the trunk lines closely — and it is what the map draws heavier.
 */
export type Clase = 'primaria' | 'secundaria';

export const RANGO_MAX_PRIMARIA = 6;

/** Average running speed of a freight train on each class, km/h. */
export const VELOCIDAD: Record<Clase, number> = { primaria: 60, secundaria: 40 };

/** A site farther than this from any track has no station: no rail service. */
export const ESTACION_MAX_KM = 15;

/** Closer than this to a node, a station uses the node instead of splitting the tramo. */
const SNAP_NODO_KM = 0.25;

export type Tramo = {
  id: number;
  a: number;
  b: number;
  clase: Clase;
  doble: boolean;
  /** a → b. */
  puntos: LonLat[];
  /** Cumulative km along `puntos`; first 0, last = length. */
  acum: number[];
  km: number;
};

export type Estacion = {
  sitio: string;
  nodo: number;
  /** From the site to the track. */
  distanciaKm: number;
};

export type Red = {
  nodos: LonLat[];
  tramos: Tramo[];
  /** Per node, the ids of the tramos that touch it. */
  ady: number[][];
  /** Per node, the id of its connected piece of network. */
  componente: number[];
  /** By site key; only sites with rail service. */
  estaciones: Map<string, Estacion>;
  /** By site key; sites out of reach, with how far the nearest track is. */
  sinEstacion: Map<string, number>;
  /**
   * By site key, for the Polos del Bienestar: how far the nearest track is.
   * They get no station yet — nothing is built there until the player builds it.
   */
  aLaVia: Map<string, number>;
};

// ---- geometry helpers -------------------------------------------------------------

const D2R = Math.PI / 180;

/** Nearest point of segment a–b to p, in a local planar frame. */
function sobreSegmento(p: LonLat, a: LonLat, b: LonLat): { km: number; u: number } {
  const cx = Math.cos(p[1] * D2R) * 111.32;
  const cy = 110.57;
  const ax = (a[0] - p[0]) * cx;
  const ay = (a[1] - p[1]) * cy;
  const dx = (b[0] - a[0]) * cx;
  const dy = (b[1] - a[1]) * cy;
  const l2 = dx * dx + dy * dy;
  const u = l2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2)) : 0;
  return { km: Math.hypot(ax + u * dx, ay + u * dy), u };
}

export const claseDe = (rango: number): Clase => (rango <= RANGO_MAX_PRIMARIA ? 'primaria' : 'secundaria');

// ---- building ------------------------------------------------------------------------

function nuevoTramo(id: number, a: number, b: number, clase: Clase, doble: boolean, puntos: LonLat[]): Tramo {
  const acum = acumulado(puntos);
  return { id, a, b, clase, doble, puntos, acum, km: acum[acum.length - 1] };
}

export function construirRed(json: RedJson, sitios: readonly Sitio[]): Red {
  const nodos: LonLat[] = json.nodos.map(([lon, lat]) => [lon, lat]);
  const tramos: Tramo[] = json.tramos.map((t, id) => {
    const puntos: LonLat[] = [];
    for (let i = 0; i < t.coords.length; i += 2) puntos.push([t.coords[i], t.coords[i + 1]]);
    return nuevoTramo(id, t.a, t.b, claseDe(t.rango), t.doble === 1, puntos);
  });

  const estaciones = new Map<string, Estacion>();
  const sinEstacion = new Map<string, number>();
  const aLaVia = new Map<string, number>();

  // Gateways are out at sea and never get a station.
  for (const s of sitios.filter((x) => x.tipo !== 'puerta')) {
    // Nearest point on the whole network.
    let best = { km: Infinity, tramo: -1, seg: 0, u: 0 };
    for (const t of tramos) {
      for (let i = 0; i < t.puntos.length - 1; i++) {
        const hit = sobreSegmento(s.lonLat, t.puntos[i], t.puntos[i + 1]);
        if (hit.km < best.km) best = { km: hit.km, tramo: t.id, seg: i, u: hit.u };
      }
    }
    if (s.tipo === 'polo') {
      aLaVia.set(s.clave, best.km);
      continue;
    }
    if (best.km > ESTACION_MAX_KM) {
      sinEstacion.set(s.clave, best.km);
      continue;
    }
    const t = tramos[best.tramo];
    const along = t.acum[best.seg] + (t.acum[best.seg + 1] - t.acum[best.seg]) * best.u;
    let nodo: number;
    if (along <= SNAP_NODO_KM) nodo = t.a;
    else if (t.km - along <= SNAP_NODO_KM) nodo = t.b;
    else {
      // Split the tramo at the station: the first half keeps its id, the
      // second is appended.
      const p = lerp(t.puntos[best.seg], t.puntos[best.seg + 1], best.u);
      nodo = nodos.length;
      nodos.push(p);
      const antes = [...t.puntos.slice(0, best.seg + 1), p];
      const despues = [p, ...t.puntos.slice(best.seg + 1)];
      tramos[t.id] = nuevoTramo(t.id, t.a, nodo, t.clase, t.doble, antes);
      tramos.push(nuevoTramo(tramos.length, nodo, t.b, t.clase, t.doble, despues));
    }
    estaciones.set(s.clave, { sitio: s.clave, nodo, distanciaKm: best.km });
  }

  const ady: number[][] = nodos.map(() => []);
  for (const t of tramos) {
    ady[t.a].push(t.id);
    if (t.b !== t.a) ady[t.b].push(t.id);
  }

  const componente = new Array<number>(nodos.length).fill(-1);
  let c = 0;
  for (let start = 0; start < nodos.length; start++) {
    if (componente[start] !== -1) continue;
    const pila = [start];
    componente[start] = c;
    while (pila.length) {
      const n = pila.pop()!;
      for (const id of ady[n]) {
        const t = tramos[id];
        const otro = t.a === n ? t.b : t.a;
        if (componente[otro] === -1) {
          componente[otro] = c;
          pila.push(otro);
        }
      }
    }
    c++;
  }

  return { nodos, tramos, ady, componente, estaciones, sinEstacion, aLaVia };
}

// ---- routing ------------------------------------------------------------------------------

export const horasTramo = (t: Tramo) => t.km / VELOCIDAD[t.clase];

/**
 * Fastest route between two nodes (Dijkstra on running time, so a train takes
 * the main line over a shorter branch when the main line is quicker — as a
 * dispatcher would). Null when they're on different pieces of network.
 */
export function ruta(red: Red, desde: number, hasta: number): Trayecto | null {
  if (red.componente[desde] !== red.componente[hasta]) return null;
  if (desde === hasta) return null;

  const n = red.nodos.length;
  const coste = new Float64Array(n).fill(Infinity);
  const via = new Int32Array(n).fill(-1);
  coste[desde] = 0;

  // Binary heap of [coste, nodo]; stale entries are skipped on pop.
  const heap: [number, number][] = [[0, desde]];
  const push = (item: [number, number]) => {
    heap.push(item);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const pop = (): [number, number] => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };

  while (heap.length) {
    const [c, nodo] = pop();
    if (c > coste[nodo]) continue;
    if (nodo === hasta) break;
    for (const id of red.ady[nodo]) {
      const t = red.tramos[id];
      const otro = t.a === nodo ? t.b : t.a;
      const nc = c + horasTramo(t);
      if (nc < coste[otro]) {
        coste[otro] = nc;
        via[otro] = id;
        push([nc, otro]);
      }
    }
  }
  if (via[hasta] === -1) return null;

  // Walk back to the start, then lay the tramos end to end in travel order.
  const pasos: { tramo: Tramo; alReves: boolean }[] = [];
  for (let nodo = hasta; nodo !== desde; ) {
    const t = red.tramos[via[nodo]];
    const alReves = t.a === nodo; // entered this node from b's side going a-wards
    pasos.push({ tramo: t, alReves });
    nodo = alReves ? t.b : t.a;
  }
  pasos.reverse();

  const puntos: LonLat[] = [];
  const vel: number[] = [];
  for (const { tramo, alReves } of pasos) {
    const pts = alReves ? [...tramo.puntos].reverse() : tramo.puntos;
    const v = VELOCIDAD[tramo.clase];
    for (let i = puntos.length ? 1 : 0; i < pts.length; i++) {
      if (puntos.length) vel.push(v);
      puntos.push(pts[i]);
    }
  }
  return crearTrayecto(puntos, vel);
}
