import type { LonLat } from './geo';
import type { Sitio } from './sitios';
import OBRAS_JSON from './datos/obras-via.json';
import VIAS from './datos/vias.json';
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
 *
 * Every tramo of the source graph is also a `Via`: who owns it, whether it was
 * running in 2018, how many private trains use it and how many fit
 * (`datos/vias.json`). Track out of service carries no trains and anchors no
 * station; it stays on the map, dimmed, until the State rehabilitates it.
 *
 * The State's works (`obrasVia.ts`) change the network once they're finished,
 * and `construirRed` lays them on: rehabilitated lines come back into service,
 * new track is added along its official trace, a parallel passenger line
 * doubles the route between its stops with track of the State's own, and a
 * modernised line gets faster and roomier.
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

/** Who runs a line (`datos/vias.json`): the concessionaires and the State's own railways. */
export type Dueño = 'FXE' | 'KCSM' | 'FSRR' | 'LCD' | 'FTVM' | 'FIT' | 'ADMICARGA' | 'EST';
export type TipoDueño = 'privada' | 'mixta' | 'estatal';
export type InfoDueño = { nombre: string; largo: string; tipo: TipoDueño; trenesDia: number };
export const DUEÑOS = VIAS.dueños as Record<Dueño, InfoDueño>;

/** Trains a day that fit on a line, by how it is run (`datos/vias.json`, `capacidad`). */
export const CAPACIDAD = {
  sencilla: VIAS.capacidad.sencilla,
  centralizada: VIAS.capacidad.centralizada,
  doble: VIAS.capacidad.doble,
};

type Corredor = { nombre: string; desde: string; hasta: string; trenesDia: number; capacidad?: string };
const CORREDORES = VIAS.corredores as Corredor[];

/**
 * A line of the source graph (one per `RedJson` tramo, same index): the unit
 * that has an owner, traffic and capacity. A station can split it into
 * several `Tramo`s, all with the same `base`.
 */
export type Via = {
  base: number;
  dueño: Dueño | null;
  operando: boolean;
  doble: boolean;
  km: number;
  /** Private trains a day, both directions: the owner's average, or its corridor's figure. */
  privados: number;
  /** Trains a day that fit. */
  capacidad: number;
  /** The corridor whose figure it carries, if any. */
  corredor: string | null;
  /** The State's work that built it or last changed it. */
  obra?: string;
  /** Track laid by a work (new line or parallel line), not the 2018 network. */
  nueva?: boolean;
};

// ---- the State's works on the network -------------------------------------------------------

export type TipoObraVia = 'nueva' | 'paralela' | 'modernizar' | 'rehabilitar';
export type CapacidadObra = keyof typeof CAPACIDAD;

/** What a work does to the track (its cost and time live in `obrasVia.ts`). */
export type TrazoObra = {
  id: string;
  tipo: TipoObraVia;
  capacidad: CapacidadObra;
  /** New track: its official trace, end to end. */
  trazo?: LonLat[];
  /** Parallel and modernised lines: the stops (site or anchor keys) whose route they follow. */
  paradas?: string[];
  /** Rehabilitations: the lines (`Via.base`) brought back. */
  bases?: number[];
};

/**
 * Fixed points where a work starts or ends and no site is (Palenque, Ixtepec…).
 * Each one splits its line in two lines of their own, so a work can change
 * one side only.
 */
export type Ancla = { clave: string; nombre: string; lonLat: LonLat };
export const ANCLAS = OBRAS_JSON.anclas as Ancla[];
/** An anchor or a work's end farther than this from the track doesn't join it. */
const UNION_MAX_KM = 6;

type FilaVia = { a: number[]; b: number[]; dueño: string | null; operando: boolean };
const FILAS = VIAS.tramos as FilaVia[];

/** Same point to within ~20 m (the rows store 4 decimals). */
const cerca = (p: number[], lon: number, lat: number) => Math.abs(p[0] - lon) < 2e-4 && Math.abs(p[1] - lat) < 2e-4;

/** The row for a source tramo: same index when the data hasn't moved, else whichever row has its two ends. */
function filaDe(t: RedJson['tramos'][number], base: number): FilaVia | undefined {
  const n = t.coords.length;
  const es = (f: FilaVia) => cerca(f.a, t.coords[0], t.coords[1]) && cerca(f.b, t.coords[n - 2], t.coords[n - 1]);
  return FILAS[base] && es(FILAS[base]) ? FILAS[base] : FILAS.find(es);
}

export type Tramo = {
  id: number;
  /** The source line it is part of (`Red.vias`). */
  base: number;
  operando: boolean;
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
  /** Per source line (`Tramo.base`): owner, state, traffic and capacity. */
  vias: Via[];
  /** Per node, the ids of the tramos in service that touch it. */
  ady: number[][];
  /** Node of each anchor (`Ancla.clave`). */
  anclas: Map<string, number>;
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

function nuevoTramo(
  id: number,
  base: number,
  operando: boolean,
  a: number,
  b: number,
  clase: Clase,
  doble: boolean,
  puntos: LonLat[]
): Tramo {
  const acum = acumulado(puntos);
  return { id, base, operando, a, b, clase, doble, puntos, acum, km: acum[acum.length - 1] };
}

/** The line's owner and state from `vias.json`, matched by its two ends. */
function viaDe(t: RedJson['tramos'][number], base: number): Via {
  const fila = filaDe(t, base);
  if (!fila) console.warn(`vias.json no tiene el tramo ${base}; se toma como en operación y sin dueño`);
  const dueño = (fila?.dueño ?? null) as Dueño | null;
  const operando = fila?.operando ?? true;
  const doble = t.doble === 1;
  return {
    base,
    dueño,
    operando,
    doble,
    km: t.km,
    privados: operando && dueño ? DUEÑOS[dueño].trenesDia : 0,
    capacidad: doble ? CAPACIDAD.doble : CAPACIDAD.sencilla,
    corredor: null,
  };
}

/**
 * `polosEnServicio`: keys of the Polos del Bienestar already built; within
 * reach of the track they get a station like any city. The rest only get
 * their distance to the track measured (`aLaVia`). `hechas`: the State's
 * finished works, in catalog order.
 */
export function construirRed(
  json: RedJson,
  sitios: readonly Sitio[],
  polosEnServicio: ReadonlySet<string> = new Set(),
  hechas: readonly TrazoObra[] = []
): Red {
  const nodos: LonLat[] = json.nodos.map(([lon, lat]) => [lon, lat]);
  const vias = json.tramos.map(viaDe);
  const tramos: Tramo[] = json.tramos.map((t, id) => {
    const puntos: LonLat[] = [];
    for (let i = 0; i < t.coords.length; i += 2) puntos.push([t.coords[i], t.coords[i + 1]]);
    return nuevoTramo(id, id, vias[id].operando, t.a, t.b, claseDe(t.rango), t.doble === 1, puntos);
  });

  /** Nearest point on the track in service: dead track serves nobody. */
  function masCercano(p: LonLat) {
    let best = { km: Infinity, tramo: -1, seg: 0, u: 0 };
    for (const t of tramos) {
      if (!t.operando) continue;
      for (let i = 0; i < t.puntos.length - 1; i++) {
        const hit = sobreSegmento(p, t.puntos[i], t.puntos[i + 1]);
        if (hit.km < best.km) best = { km: hit.km, tramo: t.id, seg: i, u: hit.u };
      }
    }
    return best;
  }

  /**
   * A node where `hit` lands: the tramo's end when it's that close, else the
   * tramo is split there (the first half keeps its id, the second is
   * appended). `separar` gives the second half a line (`Via`) of its own.
   */
  function nodoEn(hit: ReturnType<typeof masCercano>, separar = false): number {
    const t = tramos[hit.tramo];
    const along = t.acum[hit.seg] + (t.acum[hit.seg + 1] - t.acum[hit.seg]) * hit.u;
    if (along <= SNAP_NODO_KM) return t.a;
    if (t.km - along <= SNAP_NODO_KM) return t.b;
    const p = lerp(t.puntos[hit.seg], t.puntos[hit.seg + 1], hit.u);
    const nodo = nodos.length;
    nodos.push(p);
    const antes = [...t.puntos.slice(0, hit.seg + 1), p];
    const despues = [p, ...t.puntos.slice(hit.seg + 1)];
    let base = t.base;
    if (separar) {
      base = vias.length;
      const v = vias[t.base];
      vias.push({ ...v, base, km: t.km - along });
      v.km -= t.km - along;
    }
    tramos[t.id] = nuevoTramo(t.id, t.base, t.operando, t.a, nodo, t.clase, t.doble, antes);
    tramos.push(nuevoTramo(tramos.length, base, t.operando, nodo, t.b, t.clase, t.doble, despues));
    return nodo;
  }

  /** A line of the State's, built by work `o`. */
  function viaDelEstado(o: TrazoObra, km: number): Via {
    const via: Via = {
      base: vias.length,
      dueño: 'EST',
      operando: true,
      doble: o.capacidad === 'doble',
      km,
      privados: 0,
      capacidad: CAPACIDAD[o.capacidad],
      corredor: null,
      obra: o.id,
      nueva: true,
    };
    vias.push(via);
    return via;
  }

  // 1. Rehabilitated lines are in service again, and the State's.
  for (const o of hechas) {
    if (o.tipo !== 'rehabilitar' || !o.bases) continue;
    for (const b of o.bases) {
      const v = vias[b];
      if (!v) continue;
      Object.assign(v, { operando: true, dueño: 'EST', privados: 0, capacidad: Math.max(v.capacidad, CAPACIDAD[o.capacidad]), obra: o.id });
      tramos[b].operando = true;
    }
  }

  // 2. Anchors, always (the network's lines must not depend on what's built).
  const anclas = new Map<string, number>();
  for (const a of ANCLAS) {
    const hit = masCercano(a.lonLat);
    if (hit.km <= UNION_MAX_KM) anclas.set(a.clave, nodoEn(hit, true));
  }

  // 3. New track along its official trace; each end joins the track in
  //    service when it's close (an earlier tramo of the same line included).
  for (const o of hechas) {
    if (o.tipo !== 'nueva' || !o.trazo || o.trazo.length < 2) continue;
    const extremos = [o.trazo[0], o.trazo[o.trazo.length - 1]].map((p) => {
      const hit = masCercano(p);
      if (hit.km <= UNION_MAX_KM) return nodoEn(hit);
      nodos.push([p[0], p[1]]);
      return nodos.length - 1;
    });
    const puntos: LonLat[] = [nodos[extremos[0]], ...o.trazo.slice(1, -1), nodos[extremos[1]]];
    const km = acumulado(puntos).at(-1)!;
    const via = viaDelEstado(o, km);
    tramos.push(nuevoTramo(tramos.length, via.base, true, extremos[0], extremos[1], 'primaria', via.doble, puntos));
  }

  // 4. Stations.
  const estaciones = new Map<string, Estacion>();
  const sinEstacion = new Map<string, number>();
  const aLaVia = new Map<string, number>();
  // Gateways are out at sea and never get a station.
  for (const s of sitios.filter((x) => x.tipo !== 'puerta')) {
    const best = masCercano(s.lonLatEstacion ?? s.lonLat);
    if (s.tipo === 'polo') {
      aLaVia.set(s.clave, best.km);
      // Only a polo the player has built gets its station (its spur).
      if (!polosEnServicio.has(s.clave)) continue;
    }
    if (best.km > ESTACION_MAX_KM) {
      sinEstacion.set(s.clave, best.km);
      continue;
    }
    estaciones.set(s.clave, { sitio: s.clave, nodo: nodoEn(best), distanciaKm: best.km });
  }

  const red: Red = { nodos, tramos, vias, ady: [], componente: [], anclas, estaciones, sinEstacion, aLaVia };
  indexar(red);

  // 5. Parallel lines and modernisations follow the route the 2018 network
  //    already has between their stops (never another work's new track).
  let cambio = false;
  for (const o of hechas) {
    if ((o.tipo !== 'paralela' && o.tipo !== 'modernizar') || !o.paradas) continue;
    const pasos = recorridoDeParadas(red, o.paradas);
    if (!pasos) {
      console.warn(`obra sin recorrido: ${o.id}`);
      continue;
    }
    if (o.tipo === 'paralela') {
      const via = viaDelEstado(o, pasos.reduce((km, t) => km + t.km, 0));
      for (const t of pasos) tramos.push(nuevoTramo(tramos.length, via.base, true, t.a, t.b, 'primaria', via.doble, t.puntos));
    } else {
      for (const t of pasos) {
        t.clase = 'primaria';
        const v = vias[t.base];
        v.capacidad = Math.max(v.capacidad, CAPACIDAD[o.capacidad]);
        if (v.dueño !== 'FIT') v.dueño = 'EST';
        v.obra = o.id;
      }
    }
    cambio = true;
  }
  if (cambio) indexar(red);

  aplicarCorredores(red);
  return red;
}

/** Adjacency (track in service only) and connected pieces. */
function indexar(red: Red) {
  const ady: number[][] = red.nodos.map(() => []);
  for (const t of red.tramos) {
    if (!t.operando) continue;
    ady[t.a].push(t.id);
    if (t.b !== t.a) ady[t.b].push(t.id);
  }
  const componente = new Array<number>(red.nodos.length).fill(-1);
  let c = 0;
  for (let start = 0; start < red.nodos.length; start++) {
    if (componente[start] !== -1) continue;
    const pila = [start];
    componente[start] = c;
    while (pila.length) {
      const n = pila.pop()!;
      for (const id of ady[n]) {
        const t = red.tramos[id];
        const otro = t.a === n ? t.b : t.a;
        if (componente[otro] === -1) {
          componente[otro] = c;
          pila.push(otro);
        }
      }
    }
    c++;
  }
  red.ady = ady;
  red.componente = componente;
}

/** Running time on the 2018 network only: a work's new track is not part of another work's route. */
const soloRedOriginal = (red: Red) => (t: Tramo) => (red.vias[t.base].nueva ? Infinity : horasTramo(t));

/** The tramos of the route through `paradas` (site or anchor keys) on the 2018 network, or null. */
export function recorridoDeParadas(red: Red, paradas: readonly string[]): Tramo[] | null {
  const nodo = (k: string) => red.estaciones.get(k)?.nodo ?? red.anclas.get(k);
  const out: Tramo[] = [];
  for (let i = 0; i + 1 < paradas.length; i++) {
    const a = nodo(paradas[i]);
    const b = nodo(paradas[i + 1]);
    if (a === undefined || b === undefined) return null;
    const pasos = camino(red, a, b, soloRedOriginal(red));
    if (!pasos) return null;
    out.push(...pasos.map((p) => p.tramo));
  }
  return out;
}

/**
 * The busy corridors carry more than their owner's average: every line on the
 * route between the corridor's two ends takes its figure, and the ones that
 * move more than single track allows get centralised traffic control (they
 * couldn't carry it otherwise).
 */
function aplicarCorredores(red: Red) {
  for (const c of CORREDORES) {
    const a = red.estaciones.get(c.desde);
    const b = red.estaciones.get(c.hasta);
    const t = a && b ? ruta(red, a.nodo, b.nodo, soloRedOriginal(red)) : null;
    if (!t?.vias) {
      console.warn(`corredor sin ruta: ${c.nombre}`);
      continue;
    }
    for (const base of new Set(t.vias)) {
      const v = red.vias[base];
      if (c.trenesDia > v.privados) {
        v.privados = c.trenesDia;
        v.corredor = c.nombre;
      }
      if (c.capacidad === 'centralizada' && !v.doble) v.capacidad = Math.max(v.capacidad, CAPACIDAD.centralizada);
    }
  }
}

// ---- routing ------------------------------------------------------------------------------

export const horasTramo = (t: Tramo) => t.km / VELOCIDAD[t.clase];

/**
 * Fastest route between two nodes (Dijkstra on running time, so a train takes
 * the main line over a shorter branch when the main line is quicker — as a
 * dispatcher would). Null when they're on different pieces of network.
 */
export function ruta(red: Red, desde: number, hasta: number, costo: CostoTramo = horasTramo): Trayecto | null {
  const pasos = camino(red, desde, hasta, costo);
  if (!pasos) return null;
  const puntos: LonLat[] = [];
  const vel: number[] = [];
  const vias: number[] = [];
  for (const { tramo, alReves } of pasos) {
    const pts = alReves ? [...tramo.puntos].reverse() : tramo.puntos;
    const v = VELOCIDAD[tramo.clase];
    for (let i = puntos.length ? 1 : 0; i < pts.length; i++) {
      if (puntos.length) {
        vel.push(v);
        vias.push(tramo.base);
      }
      puntos.push(pts[i]);
    }
  }
  const t = crearTrayecto(puntos, vel);
  t.vias = vias;
  t.velLibre = [...vel];
  return t;
}

/** What a tramo costs a route: hours on free track by default. */
export type CostoTramo = (t: Tramo) => number;

/** The cheapest chain of tramos from `desde` to `hasta`, in travel order, or null. */
function camino(red: Red, desde: number, hasta: number, costoDe: CostoTramo): { tramo: Tramo; alReves: boolean }[] | null {
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
      const nc = c + costoDe(t);
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
  return pasos;
}
