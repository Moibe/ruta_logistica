// Builds the geography of the Mexico board from Natural Earth 10m.
//
//   npm run datos
//
// Outputs (all committed, so the app never needs this script or the network):
//   static/data/mexico.topo.json         estados + países vecinos
//   static/data/red-ferroviaria.json     la red como grafo: nodos y tramos
//   static/data/rutas-maritimas.json     rutas por mar entre cada par de puertos y puertas
//   src/lib/domain/datos/ciudades.json   ciudades de referencia
//
// The Natural Earth sources (~85 MB) are downloaded once into `.cache/ne/`
// (gitignored), pinned to one commit of nvkelso/natural-earth-vector so a rerun
// produces the same files. Attribute logic (Spanish names, which cities make the
// cut) and the rail graph live here in plain JS; mapshaper only does geometry:
// dissolve, buffer, clip, simplify and the TopoJSON encoding.
//
// The rail lines are Natural Earth's North America railroads, which come from
// the CEC North American Environmental Atlas (INEGI, USGS and NRCan's joint
// atlas). `scalerank` is Natural Earth's cartographic ranking — the smallest
// scale at which a line still deserves to be drawn — not an operator's
// classification; it still tracks the main corridors closely, so the app uses
// it to tell trunk lines from branches.

import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import mapshaper from 'mapshaper';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(ROOT, '.cache', 'ne');
const NE_COMMIT = 'ca96624a56bd078437bca8184e78163e5039ad19';
const NE_URL = `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/${NE_COMMIT}/geojson`;

/**
 * Neighbours are clipped to this box. It is much larger than anything the
 * Mexico view lets the camera reach, on purpose: a clipped polygon gets a
 * straight edge along the box, and that edge must never be on screen.
 */
const VECINOS_BBOX = [-134, 0, -64, 46];
/** Rough box around Mexico, only used to pre-filter the world rail file. */
const MEXICO_BBOX = [-118.6, 14.3, -86.5, 32.8];

// ---- estados --------------------------------------------------------------

/** ISO 3166-2 suffix (Natural Earth) → clave, nombre y abreviatura de uso común. */
const ESTADOS = {
  AGU: ['AGS', 'Aguascalientes', 'Ags.'],
  BCN: ['BC', 'Baja California', 'B.C.'],
  BCS: ['BCS', 'Baja California Sur', 'B.C.S.'],
  CAM: ['CAMP', 'Campeche', 'Camp.'],
  CHP: ['CHIS', 'Chiapas', 'Chis.'],
  CHH: ['CHIH', 'Chihuahua', 'Chih.'],
  COA: ['COAH', 'Coahuila', 'Coah.'],
  COL: ['COL', 'Colima', 'Col.'],
  DIF: ['CDMX', 'Ciudad de México', 'CDMX'],
  DUR: ['DGO', 'Durango', 'Dgo.'],
  GUA: ['GTO', 'Guanajuato', 'Gto.'],
  GRO: ['GRO', 'Guerrero', 'Gro.'],
  HID: ['HGO', 'Hidalgo', 'Hgo.'],
  JAL: ['JAL', 'Jalisco', 'Jal.'],
  MEX: ['MEX', 'Estado de México', 'Méx.'],
  MIC: ['MICH', 'Michoacán', 'Mich.'],
  MOR: ['MOR', 'Morelos', 'Mor.'],
  NAY: ['NAY', 'Nayarit', 'Nay.'],
  NLE: ['NL', 'Nuevo León', 'N.L.'],
  OAX: ['OAX', 'Oaxaca', 'Oax.'],
  PUE: ['PUE', 'Puebla', 'Pue.'],
  QUE: ['QRO', 'Querétaro', 'Qro.'],
  ROO: ['QROO', 'Quintana Roo', 'Q. Roo'],
  SLP: ['SLP', 'San Luis Potosí', 'S.L.P.'],
  SIN: ['SIN', 'Sinaloa', 'Sin.'],
  SON: ['SON', 'Sonora', 'Son.'],
  TAB: ['TAB', 'Tabasco', 'Tab.'],
  TAM: ['TAMPS', 'Tamaulipas', 'Tamps.'],
  TLA: ['TLAX', 'Tlaxcala', 'Tlax.'],
  VER: ['VER', 'Veracruz', 'Ver.'],
  YUC: ['YUC', 'Yucatán', 'Yuc.'],
  ZAC: ['ZAC', 'Zacatecas', 'Zac.'],
};

function estados(admin1) {
  const out = [];
  for (const f of admin1.features) {
    const p = f.properties;
    if (p.adm0_a3 !== 'MEX') continue;
    // MX-X01~ is Arrecife Alacranes, a reef that belongs to Yucatán. It is
    // given Yucatán's code and dissolved into it below; sorted last so the
    // dissolve copies the attributes (and label point) of mainland Yucatán.
    const iso = p.iso_3166_2 === 'MX-X01~' ? 'YUC' : p.iso_3166_2.slice(3);
    const def = ESTADOS[iso];
    if (!def) throw new Error(`Estado sin mapear: ${p.iso_3166_2} ${p.name}`);
    const [clave, nombre, abrev] = def;
    out.push({
      type: 'Feature',
      properties: { clave, nombre, abrev, lon: p.longitude, lat: p.latitude, orden: p.name ? 0 : 1 },
      geometry: f.geometry,
    });
  }
  out.sort((a, b) => a.properties.orden - b.properties.orden);
  for (const f of out) delete f.properties.orden;
  return { type: 'FeatureCollection', features: out };
}

// ---- vías férreas ---------------------------------------------------------

/**
 * Track the source leaves out, drawn by hand. Each one is a real line that
 * exists on the ground and matters to the game; the first point sits on (or
 * within welding distance of) the Natural Earth line it continues.
 */
const VIAS_A_MANO = [
  {
    nombre: 'Cuyutlán – Manzanillo',
    // Natural Earth's Guadalajara–Colima line stops near Cuyutlán, 34 km short
    // of the busiest container port in the country. The real line runs on
    // along the sand bar between the Laguna de Cuyutlán and the sea (it has
    // since 1908); traced ~1.3 km inland of the 10m coast, like the source's
    // own last kilometres, then north into the port at San Pedrito.
    rango: 6,
    coords: [
      [-104.0258, 18.9092],
      [-104.09, 18.94],
      [-104.18, 18.984],
      [-104.24, 19.004],
      [-104.29, 19.022],
      [-104.3, 19.04],
      [-104.299, 19.058],
    ],
  },
  {
    nombre: 'Ramal del puerto de Altamira',
    // The source has the Tampico–Ciudad Mante line passing Altamira but not
    // the spur into the industrial port, 13 km away, which in reality has rail
    // terminals. Leaves the line just north-west of Tampico and ends at the
    // port basin, a couple of kilometres inland of the harbour mouth.
    rango: 8,
    coords: [
      [-97.9208, 22.3883],
      [-97.912, 22.41],
      [-97.898, 22.435],
      [-97.884, 22.457],
      [-97.87, 22.474],
      [-97.856, 22.482],
    ],
  },
];

function vias(railroads) {
  const [w, s, e, n] = MEXICO_BBOX;
  const touches = (g) =>
    (g.type === 'LineString' ? [g.coordinates] : g.coordinates).some((line) =>
      line.some(([lon, lat]) => lon > w && lon < e && lat > s && lat < n)
    );
  return {
    type: 'FeatureCollection',
    features: [
      ...railroads.features
        .filter((f) => f.geometry && touches(f.geometry))
        .map((f) => ({
          type: 'Feature',
          // scalerank: lower = more important line. Kept to draw trunk lines
          // heavier than branches, and to run trains faster on them.
          properties: { rango: f.properties.scalerank, doble: f.properties.mult_track ? 1 : 0 },
          geometry: f.geometry,
        })),
      ...VIAS_A_MANO.map((v) => ({
        type: 'Feature',
        properties: { rango: v.rango, doble: 0 },
        geometry: { type: 'LineString', coordinates: v.coords },
      })),
    ],
  };
}

// ---- red ferroviaria (grafo) -------------------------------------------------

/** A loose end this close to another line is a gap in the source, not a terminus: weld it. */
const SOLDAR_KM = 1.6;
/** Pieces of network shorter than this are clipping debris, not lines anyone runs trains on. */
const MIN_COMPONENTE_KM = 10;

const D2R = Math.PI / 180;
const kmEntre = (a, b) =>
  6371 * Math.hypot((b[0] - a[0]) * D2R * Math.cos(((a[1] + b[1]) / 2) * D2R), (b[1] - a[1]) * D2R);

/** Nearest point of segment a–b to p, in a local planar frame (fine at these lengths). */
function sobreSegmento(p, a, b) {
  const cx = Math.cos(p[1] * D2R) * 111.32;
  const cy = 110.57;
  const ax = (a[0] - p[0]) * cx;
  const ay = (a[1] - p[1]) * cy;
  const dx = (b[0] - a[0]) * cx;
  const dy = (b[1] - a[1]) * cy;
  const l2 = dx * dx + dy * dy;
  const u = l2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2)) : 0;
  return { km: Math.hypot(ax + u * dx, ay + u * dy), u, punto: [a[0] + u * (b[0] - a[0]), a[1] + u * (b[1] - a[1])] };
}

/**
 * Lines → graph. Vertices are identified by their coordinates (mapshaper has
 * already made shared junctions share vertices); a node is any vertex that is
 * not a plain pass-through: a line end, a junction, or a point where the rank
 * or the track count changes. A tramo is the polyline between two nodes.
 *
 * Returns the graph plus a report, printed by the caller, because every number
 * in it (welds, dropped fragments, components) is a claim about the source
 * data that is worth reading after a rerun.
 */
function red(fc) {
  const r5 = (x) => Math.round(x * 1e5) / 1e5;
  const ids = new Map();
  const pos = [];
  const vertice = ([lon, lat]) => {
    const p = [r5(lon), r5(lat)];
    const k = p[0] + ',' + p[1];
    let i = ids.get(k);
    if (i === undefined) {
      i = pos.length;
      ids.set(k, i);
      pos.push(p);
    }
    return i;
  };

  /** Undirected segments keyed "i-j" (i < j); attributes of the most important line using it. */
  const segs = new Map();
  const ady = [];
  const unir = (i, j, rango, doble) => {
    if (i === j) return;
    const k = i < j ? `${i}-${j}` : `${j}-${i}`;
    const s = segs.get(k);
    if (s) {
      s.rango = Math.min(s.rango, rango);
      s.doble = Math.max(s.doble, doble);
      return;
    }
    segs.set(k, { i: Math.min(i, j), j: Math.max(i, j), rango, doble });
    (ady[i] ??= new Set()).add(j);
    (ady[j] ??= new Set()).add(i);
  };
  const quitar = (i, j) => {
    segs.delete(i < j ? `${i}-${j}` : `${j}-${i}`);
    ady[i]?.delete(j);
    ady[j]?.delete(i);
  };

  for (const f of fc.features) {
    const g = f.geometry;
    if (!g) continue;
    for (const line of g.type === 'LineString' ? [g.coordinates] : g.coordinates) {
      for (let n = 1; n < line.length; n++) {
        unir(vertice(line[n - 1]), vertice(line[n]), f.properties.rango, f.properties.doble);
      }
    }
  }

  // ---- weld loose ends --------------------------------------------------------
  const grado = (i) => ady[i]?.size ?? 0;
  const soldaduras = [];
  const puntas = pos.map((_, i) => i).filter((i) => grado(i) === 1);
  for (const v of puntas) {
    if (grado(v) !== 1) continue; // already welded from the other side
    // Exclude the loose end's own line: walk it back to the first junction.
    const propia = new Set([v]);
    for (let prev = -1, cur = v; ; ) {
      const next = [...ady[cur]].filter((x) => x !== prev);
      if (next.length !== 1 || propia.has(next[0])) break;
      prev = cur;
      cur = next[0];
      propia.add(cur);
      if (grado(cur) !== 2) break;
    }
    let mejor = null;
    for (const s of segs.values()) {
      // Touching its own line at all counts as its own: a short spur would
      // otherwise weld back onto the junction it starts from.
      if (propia.has(s.i) || propia.has(s.j)) continue;
      const hit = sobreSegmento(pos[v], pos[s.i], pos[s.j]);
      if (hit.km <= SOLDAR_KM && (!mejor || hit.km < mejor.km)) mejor = { ...hit, s };
    }
    if (!mejor) continue;
    const { s } = mejor;
    const propio = [...ady[v]][0];
    const attrs = segs.get(v < propio ? `${v}-${propio}` : `${propio}-${v}`);
    // Within 60 m of an existing vertex, use it; otherwise split the segment.
    let destino;
    if (kmEntre(mejor.punto, pos[s.i]) < 0.06) destino = s.i;
    else if (kmEntre(mejor.punto, pos[s.j]) < 0.06) destino = s.j;
    else {
      destino = vertice(mejor.punto);
      quitar(s.i, s.j);
      unir(s.i, destino, s.rango, s.doble);
      unir(destino, s.j, s.rango, s.doble);
    }
    unir(v, destino, attrs.rango, attrs.doble);
    soldaduras.push({ km: mejor.km, en: pos[v] });
  }

  // ---- components; drop debris ----------------------------------------------------
  const comp = new Array(pos.length).fill(-1);
  const componentes = [];
  for (let start = 0; start < pos.length; start++) {
    if (comp[start] !== -1 || !grado(start)) continue;
    const c = { id: componentes.length, km: 0, vertices: [] };
    const pila = [start];
    comp[start] = c.id;
    while (pila.length) {
      const i = pila.pop();
      c.vertices.push(i);
      for (const j of ady[i]) {
        if (i < j) c.km += kmEntre(pos[i], pos[j]);
        if (comp[j] === -1) {
          comp[j] = c.id;
          pila.push(j);
        }
      }
    }
    componentes.push(c);
  }
  const descartados = componentes.filter((c) => c.km < MIN_COMPONENTE_KM);
  for (const c of descartados) for (const i of c.vertices) for (const j of [...(ady[i] ?? [])]) quitar(i, j);

  // ---- nodes and tramos -------------------------------------------------------------
  const seg = (i, j) => segs.get(i < j ? `${i}-${j}` : `${j}-${i}`);
  const esNodo = (i) => {
    if (grado(i) !== 2) return true;
    const [a, b] = [...ady[i]];
    const sa = seg(i, a);
    const sb = seg(i, b);
    return sa.rango !== sb.rango || sa.doble !== sb.doble;
  };
  const nodoId = new Map();
  const nodos = [];
  const nodo = (i) => {
    let n = nodoId.get(i);
    if (n === undefined) {
      n = nodos.length;
      nodoId.set(i, n);
      nodos.push(pos[i]);
    }
    return n;
  };

  const usados = new Set();
  const tramos = [];
  const recorrer = (desde, primero) => {
    const linea = [desde];
    let prev = desde;
    let cur = primero;
    const { rango, doble } = seg(desde, primero);
    let km = 0;
    for (;;) {
      const k = prev < cur ? `${prev}-${cur}` : `${cur}-${prev}`;
      usados.add(k);
      km += kmEntre(pos[prev], pos[cur]);
      linea.push(cur);
      if (esNodo(cur) || cur === desde) break;
      const next = [...ady[cur]].find((x) => x !== prev);
      prev = cur;
      cur = next;
    }
    tramos.push({
      a: nodo(desde),
      b: nodo(cur),
      km: Math.round(km * 1000) / 1000,
      rango,
      doble,
      coords: linea.flatMap((i) => pos[i]),
    });
  };
  for (let i = 0; i < pos.length; i++) {
    if (!grado(i) || !esNodo(i)) continue;
    for (const j of ady[i]) if (!usados.has(i < j ? `${i}-${j}` : `${j}-${i}`)) recorrer(i, j);
  }
  // Closed loops with no node on them (none expected, but never lose track).
  for (const s of segs.values()) if (!usados.has(`${s.i}-${s.j}`)) recorrer(s.i, s.j);

  const vivos = componentes.filter((c) => c.km >= MIN_COMPONENTE_KM).sort((a, b) => b.km - a.km);
  return {
    grafo: { nodos, tramos },
    reporte: {
      soldaduras,
      descartados: descartados.map((c) => ({ km: c.km, en: pos[c.vertices[0]] })),
      componentes: vivos.map((c) => {
        const xs = c.vertices.map((i) => pos[i][0]);
        const ys = c.vertices.map((i) => pos[i][1]);
        return { km: c.km, caja: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] };
      }),
    },
  };
}

// ---- rutas marítimas -----------------------------------------------------------

/**
 * The sea grid: where ships can be routed. Wider than the board so lanes can
 * leave it (Asia to the west, the Atlantic past Florida), and down to 5° N to
 * take in Panama. 0.05° ≈ 5.5 km a cell.
 */
const MAR = { w: -122, e: -70, s: 5, n: 34, res: 0.05 };
/** The audit's grid: five times finer, centre-in-polygon only. */
const AUDITORIA_RES = 0.01;

/**
 * The Panama Canal, Pacific → Caribbean: the approach off Balboa, Miraflores
 * and Pedro Miguel locks, the Culebra cut, Gamboa, Gatún Lake, Gatún locks,
 * Limón Bay. Carved into the grid as water, because at this scale (and in the
 * source) the isthmus is solid land, and it's the only way from one coast of
 * Mexico to the other by sea.
 */
const CANAL_PANAMA = [
  [-79.52, 8.86],
  [-79.57, 8.95],
  [-79.6, 9.0],
  [-79.62, 9.02],
  [-79.67, 9.07],
  [-79.7, 9.12],
  [-79.78, 9.14],
  [-79.86, 9.2],
  [-79.92, 9.27],
  [-79.91, 9.35],
  [-79.92, 9.42],
];

/** Lanes keep this many cells (~22 km) off the coast when they can… */
const OLGURA_CELDAS = 4;
/** …and pay this much extra per cell they come closer. */
const PENALIZACION_COSTA = 0.4;

/**
 * Rasterise polygons onto a grid. A cell is land when its centre is inside a
 * polygon (scanline, even-odd over every ring) and, if `conservadora`, also when
 * a coastline passes through it — so a sand bar or an island narrower than a
 * cell still blocks the way instead of letting a lane slip through.
 */
function rasterizar(colecciones, malla, conservadora) {
  const cols = Math.round((malla.e - malla.w) / malla.res);
  const filas = Math.round((malla.n - malla.s) / malla.res);
  const tierra = new Uint8Array(cols * filas);
  const bordes = [];
  for (const fc of colecciones) {
    for (const f of fc.features) {
      const g = f.geometry;
      if (!g) continue;
      const poligonos = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
      for (const poligono of poligonos) {
        for (const anillo of poligono) {
          for (let i = 1; i < anillo.length; i++) {
            const [x1, y1] = anillo[i - 1];
            const [x2, y2] = anillo[i];
            if (Math.max(y1, y2) < malla.s || Math.min(y1, y2) > malla.n) continue;
            bordes.push([x1, y1, x2, y2]);
          }
        }
      }
    }
  }
  // Scanline: crossings of every edge with each row's centre line. Edges west
  // of the grid still count, or the parity to their east would be wrong.
  //
  // Edges are bucketed by row with a row of slack on each side, and the exact
  // crossing test below decides. Coordinates come rounded to 1e-5, so plenty
  // of vertices sit exactly on a row centre; computed tightly, float error
  // dropped some of those edges from their row, one crossing went missing,
  // the parity flipped and a streak of open sea turned into "land".
  const porFila = Array.from({ length: filas }, () => []);
  for (const b of bordes) {
    const j0 = Math.max(0, Math.ceil((Math.min(b[1], b[3]) - malla.s) / malla.res - 0.5) - 1);
    const j1 = Math.min(filas - 1, Math.floor((Math.max(b[1], b[3]) - malla.s) / malla.res - 0.5) + 1);
    for (let j = j0; j <= j1; j++) porFila[j].push(b);
  }
  for (let j = 0; j < filas; j++) {
    const lat = malla.s + (j + 0.5) * malla.res;
    const xs = [];
    for (const [x1, y1, x2, y2] of porFila[j]) {
      if (y1 <= lat !== y2 <= lat) xs.push(x1 + ((lat - y1) * (x2 - x1)) / (y2 - y1));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const i0 = Math.max(0, Math.ceil((xs[k] - malla.w) / malla.res - 0.5));
      const i1 = Math.min(cols - 1, Math.floor((xs[k + 1] - malla.w) / malla.res - 0.5));
      for (let i = i0; i <= i1; i++) tierra[j * cols + i] = 1;
    }
  }
  if (conservadora) {
    for (const [x1, y1, x2, y2] of bordes) {
      const pasos = Math.max(1, Math.ceil((Math.hypot(x2 - x1, y2 - y1) / malla.res) * 3));
      for (let p = 0; p <= pasos; p++) {
        const i = Math.floor((x1 + ((x2 - x1) * p) / pasos - malla.w) / malla.res);
        const j = Math.floor((y1 + ((y2 - y1) * p) / pasos - malla.s) / malla.res);
        if (i >= 0 && i < cols && j >= 0 && j < filas) tierra[j * cols + i] = 1;
      }
    }
  }
  return { tierra, cols, filas, malla };
}

const celdaDe = (g, [lon, lat]) => [
  Math.floor((lon - g.malla.w) / g.malla.res),
  Math.floor((lat - g.malla.s) / g.malla.res),
];
const centroDe = (g, c) => [
  g.malla.w + ((c % g.cols) + 0.5) * g.malla.res,
  g.malla.s + (Math.floor(c / g.cols) + 0.5) * g.malla.res,
];

/** Min-heap of cell ids by cost, on typed arrays (the grid has ~600k cells). */
function monticulo(capacidad) {
  let costes = new Float64Array(capacidad);
  let ids = new Int32Array(capacidad);
  let n = 0;
  return {
    get size() {
      return n;
    },
    push(c, id) {
      if (n === costes.length) {
        const nc = new Float64Array(n * 2);
        nc.set(costes);
        costes = nc;
        const ni = new Int32Array(n * 2);
        ni.set(ids);
        ids = ni;
      }
      let i = n++;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (costes[p] <= c) break;
        costes[i] = costes[p];
        ids[i] = ids[p];
        i = p;
      }
      costes[i] = c;
      ids[i] = id;
    },
    pop() {
      const top = ids[0];
      const topCoste = costes[0];
      const c = costes[--n];
      const id = ids[n];
      let i = 0;
      for (;;) {
        let h = 2 * i + 1;
        if (h >= n) break;
        if (h + 1 < n && costes[h + 1] < costes[h]) h++;
        if (costes[h] >= c) break;
        costes[i] = costes[h];
        ids[i] = ids[h];
        i = h;
      }
      costes[i] = c;
      ids[i] = id;
      return [topCoste, top];
    },
  };
}

/**
 * Shortest sea lanes between every pair of `puntos` (ports and gateways).
 * Returns the lanes and a report; see the caller for what's checked.
 */
function rutasMaritimas(tierraFc, puntos) {
  const g = rasterizar(tierraFc, MAR, true);
  const { tierra, cols, filas } = g;
  const N = cols * filas;

  // Carve the canal: every cell its centreline passes, plus a corner cell on
  // each diagonal step, so it's a 4-connected channel the router can't refuse.
  const canal = new Uint8Array(N);
  let previa = -1;
  for (let k = 1; k < CANAL_PANAMA.length; k++) {
    const [x1, y1] = CANAL_PANAMA[k - 1];
    const [x2, y2] = CANAL_PANAMA[k];
    const pasos = Math.ceil((Math.hypot(x2 - x1, y2 - y1) / MAR.res) * 4);
    for (let p = 0; p <= pasos; p++) {
      const [i, j] = celdaDe(g, [x1 + ((x2 - x1) * p) / pasos, y1 + ((y2 - y1) * p) / pasos]);
      const c = j * cols + i;
      if (previa >= 0 && c !== previa) {
        const pi = previa % cols;
        const pj = Math.floor(previa / cols);
        if (pi !== i && pj !== j) {
          tierra[pj * cols + i] = 0;
          canal[pj * cols + i] = 1;
        }
      }
      tierra[c] = 0;
      canal[c] = 1;
      previa = c;
    }
  }

  // Distance to land in cells (8-neighbour BFS), capped: it only feeds the
  // coastal penalty and the straightening clearance.
  const MAXD = OLGURA_CELDAS + 2;
  const dist = new Uint8Array(N).fill(255);
  let cola = [];
  for (let c = 0; c < N; c++) {
    if (tierra[c]) {
      dist[c] = 0;
      cola.push(c);
    }
  }
  for (let d = 1; d <= MAXD && cola.length; d++) {
    const sig = [];
    for (const c of cola) {
      const i = c % cols;
      const j = (c / cols) | 0;
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          const ii = i + di;
          const jj = j + dj;
          if (ii < 0 || jj < 0 || ii >= cols || jj >= filas) continue;
          const n = jj * cols + ii;
          if (dist[n] === 255) {
            dist[n] = d;
            sig.push(n);
          }
        }
      }
    }
    cola = sig;
  }

  // The open sea: water connected to the mid-Pacific under the same moves the
  // router makes. At this scale a bay with a narrow mouth (Topolobampo's) is
  // sealed off, and a port that entered the water there would have no way out.
  const abierto = new Uint8Array(N);
  {
    const [i0, j0] = celdaDe(g, [-115, 10]);
    const pila = [j0 * cols + i0];
    abierto[pila[0]] = 1;
    while (pila.length) {
      const c = pila.pop();
      const i = c % cols;
      const j = (c / cols) | 0;
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          const ii = i + di;
          const jj = j + dj;
          if ((!di && !dj) || ii < 0 || jj < 0 || ii >= cols || jj >= filas) continue;
          const n = jj * cols + ii;
          if (abierto[n] || tierra[n]) continue;
          if (di && dj && (tierra[j * cols + ii] || tierra[jj * cols + i])) continue;
          abierto[n] = 1;
          pila.push(n);
        }
      }
    }
  }

  // Where each point enters the water: the nearest cell of open sea.
  const entrada = puntos.map((p) => {
    const [i0, j0] = celdaDe(g, p.lonLat);
    for (let r = 0; r < 30; r++) {
      let mejor = -1;
      let mejorD = Infinity;
      for (let j = j0 - r; j <= j0 + r; j++) {
        for (let i = i0 - r; i <= i0 + r; i++) {
          if (i < 0 || j < 0 || i >= cols || j >= filas || !abierto[j * cols + i]) continue;
          const d = Math.hypot(i - i0, j - j0);
          if (d < mejorD) {
            mejorD = d;
            mejor = j * cols + i;
          }
        }
      }
      if (mejor >= 0) return mejor;
    }
    throw new Error(`Sin agua cerca de ${p.clave}`);
  });

  const cellH = MAR.res * 110.57;
  const cellW = new Float64Array(filas);
  for (let j = 0; j < filas; j++) cellW[j] = MAR.res * 111.32 * Math.cos((MAR.s + (j + 0.5) * MAR.res) * D2R);
  const factor = (c) => (canal[c] ? 1 : 1 + PENALIZACION_COSTA * Math.max(0, OLGURA_CELDAS - dist[c]));

  // Straight-line visibility between two cells for the straightening pass:
  // every cell under the line must be water and keep the clearance asked for.
  // A line across open sea may not touch the canal at all (`sinCanal`).
  //
  // It walks every cell the line passes through (Amanatides–Woo), corners
  // included, rather than sampling: sampling skipped the corner of a land cell
  // and a lane clipped an islet in the Bahamas. With the conservative grid
  // (every cell a coast touches is land) an exact walk means no straight lane
  // can cross land at all.
  const bloquea = (i, j, holgura, sinCanal) => {
    const c = j * cols + i;
    return tierra[c] === 1 || (canal[c] ? sinCanal : dist[c] < holgura);
  };
  const despejado = (a, b, holgura, sinCanal) => {
    let x = a % cols;
    let y = (a / cols) | 0;
    const xb = b % cols;
    const yb = (b / cols) | 0;
    const dx = xb - x;
    const dy = yb - y;
    const sx = Math.sign(dx);
    const sy = Math.sign(dy);
    const tdx = dx ? Math.abs(1 / dx) : Infinity;
    const tdy = dy ? Math.abs(1 / dy) : Infinity;
    // Cell centres sit on integer coordinates: the first boundary is half a cell away.
    let tx = dx ? tdx / 2 : Infinity;
    let ty = dy ? tdy / 2 : Infinity;
    while (x !== xb || y !== yb) {
      if (Math.abs(tx - ty) < 1e-12) {
        // Exactly through a corner: both side cells count.
        if (bloquea(x + sx, y, holgura, sinCanal) || bloquea(x, y + sy, holgura, sinCanal)) return false;
        x += sx;
        y += sy;
        tx += tdx;
        ty += tdy;
      } else if (tx < ty) {
        x += sx;
        tx += tdx;
      } else {
        y += sy;
        ty += tdy;
      }
      if ((x !== xb || y !== yb) && bloquea(x, y, holgura, sinCanal)) return false;
    }
    return true;
  };

  const rutas = [];
  const costeTotal = new Float64Array(N);
  const previo = new Int32Array(N);
  for (let s = 0; s < puntos.length - 1; s++) {
    costeTotal.fill(Infinity);
    previo.fill(-1);
    const origen = entrada[s];
    costeTotal[origen] = 0;
    const heap = monticulo(1 << 16);
    heap.push(0, origen);
    const pendientes = new Set(entrada.slice(s + 1));
    while (heap.size && pendientes.size) {
      const [c0, c] = heap.pop();
      if (c0 > costeTotal[c]) continue;
      pendientes.delete(c);
      const i = c % cols;
      const j = (c / cols) | 0;
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const ii = i + di;
          const jj = j + dj;
          if (ii < 0 || jj < 0 || ii >= cols || jj >= filas) continue;
          const n = jj * cols + ii;
          if (tierra[n]) continue;
          // No cutting a corner of land on a diagonal step.
          if (di && dj && (tierra[j * cols + ii] || tierra[jj * cols + i])) continue;
          const paso = Math.hypot(di * cellW[j], dj * cellH) * factor(n);
          const nc = c0 + paso;
          if (nc < costeTotal[n]) {
            costeTotal[n] = nc;
            previo[n] = c;
            heap.push(nc, n);
          }
        }
      }
    }

    for (let t = s + 1; t < puntos.length; t++) {
      const camino = [];
      for (let c = entrada[t]; c !== -1; c = previo[c]) camino.push(c);
      camino.reverse();
      if (camino[0] !== origen) throw new Error(`Sin ruta por mar: ${puntos[s].clave} → ${puntos[t].clave}`);

      // Straighten: from each kept cell, run as far along the path as the
      // line of sight stays clear. Clearance relaxes near the ends, where a
      // lane has to come close to shore to reach its port.
      //
      // The path is straightened in runs — open sea, canal, open sea — that
      // never merge: a straight line from inside the canal out to sea passes
      // carved cells that are water only on this grid, and in reality cuts
      // across Colón. Each run boundary is kept as a vertex.
      const quedan = [camino[0]];
      let a = 0;
      while (a < camino.length - 1) {
        const enCanal = canal[camino[a + 1]];
        let b = a + 1;
        while (b + 1 < camino.length && canal[camino[b + 1]] === enCanal) {
          const holgura = enCanal ? 0 : Math.min(2, dist[camino[a]], dist[camino[b + 1]]);
          if (!despejado(camino[a], camino[b + 1], holgura, !enCanal)) break;
          b++;
        }
        quedan.push(camino[b]);
        a = b;
      }

      const coords = quedan.map((c) => centroDe(g, c));
      if (kmEntre(puntos[s].lonLat, coords[0]) > 0.05) coords.unshift(puntos[s].lonLat);
      if (kmEntre(puntos[t].lonLat, coords.at(-1)) > 0.05) coords.push(puntos[t].lonLat);
      const segCanal = [];
      let km = 0;
      for (let k = 1; k < coords.length; k++) {
        km += kmEntre(coords[k - 1], coords[k]);
        const medio = [(coords[k - 1][0] + coords[k][0]) / 2, (coords[k - 1][1] + coords[k][1]) / 2];
        const [i, j] = celdaDe(g, medio);
        if (canal[j * cols + i]) segCanal.push(k - 1);
      }
      rutas.push({
        a: puntos[s].clave,
        b: puntos[t].clave,
        km: Math.round(km * 10) / 10,
        coords: coords.flatMap(([lon, lat]) => [Math.round(lon * 1e4) / 1e4, Math.round(lat * 1e4) / 1e4]),
        canal: segCanal,
      });
    }
  }

  // ---- audit: does any lane cross land? ------------------------------------------
  // On a grid five times finer, centre-in-polygon only (nothing conservative
  // here: this asks the plain question). Exempt: the canal, and the first and
  // last 8 km of a lane, where it threads into a port the 10m coast may
  // swallow.
  const fina = rasterizar(tierraFc, { ...MAR, res: AUDITORIA_RES }, false);
  const exentoKm = 8;
  const fallas = [];
  for (const r of rutas) {
    const pts = [];
    for (let k = 0; k < r.coords.length; k += 2) pts.push([r.coords[k], r.coords[k + 1]]);
    let recorrido = 0;
    let enTierra = 0;
    let donde = null;
    for (let k = 1; k < pts.length; k++) {
      const largo = kmEntre(pts[k - 1], pts[k]);
      const enCanal = r.canal.includes(k - 1);
      const pasos = Math.max(1, Math.ceil(largo / 0.5));
      for (let p = 0; p < pasos; p++) {
        const u = p / pasos;
        const kmAqui = recorrido + largo * u;
        if (enCanal || kmAqui < exentoKm || kmAqui > r.km - exentoKm) continue;
        const punto = [pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * u, pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * u];
        // The canal's carved cells are exempt wherever a sample lands in them
        // (a run of open sea starts on the canal's last cell).
        const [ci, cj] = celdaDe(g, punto);
        if (canal[cj * cols + ci]) continue;
        const [i, j] = celdaDe(fina, punto);
        if (i >= 0 && j >= 0 && i < fina.cols && j < fina.filas && fina.tierra[j * fina.cols + i]) {
          enTierra++;
          donde ??= punto;
        }
      }
      recorrido += largo;
    }
    if (enTierra) fallas.push({ ruta: `${r.a} → ${r.b}`, muestras: enTierra, donde });
  }

  return { rutas, reporte: { celdas: N, fallas } };
}

// ---- vecinos --------------------------------------------------------------

/** Spanish names for the countries that show up around Mexico. */
const PAISES = {
  USA: 'Estados Unidos',
  GTM: 'Guatemala',
  BLZ: 'Belice',
  HND: 'Honduras',
  SLV: 'El Salvador',
  NIC: 'Nicaragua',
  CRI: 'Costa Rica',
  PAN: 'Panamá',
  CUB: 'Cuba',
  CAN: 'Canadá',
  JAM: 'Jamaica',
  BHS: 'Bahamas',
  HTI: 'Haití',
  DOM: 'República Dominicana',
  COL: 'Colombia',
  VEN: 'Venezuela',
};

/**
 * The neighbours come from the same admin-1 file as the estados, dissolved per
 * country — not from a countries file. Admin-1 is cut from one consistent
 * topology, so the US/Guatemala/Belize side of the border has exactly Mexico's
 * vertices and mapshaper turns it into shared arcs. That sharing is what lets
 * the app split Mexico's outline into coast and land border. (With the
 * world-atlas countries file the two sides differ by a few hundred metres, no
 * arc is shared and the whole border gets drawn as coast.)
 */
function vecinos(admin1) {
  const [w, s, e, n] = VECINOS_BBOX;
  const touches = (g) => {
    let hit = false;
    (function walk(a) {
      if (hit) return;
      if (typeof a[0] === 'number') hit = a[0] > w && a[0] < e && a[1] > s && a[1] < n;
      else for (const x of a) walk(x);
    })(g.coordinates);
    return hit;
  };
  return {
    type: 'FeatureCollection',
    features: admin1.features
      .filter((f) => f.properties.adm0_a3 !== 'MEX' && f.geometry && touches(f.geometry))
      .map((f) => ({
        type: 'Feature',
        properties: {
          pais: f.properties.adm0_a3,
          nombre: PAISES[f.properties.adm0_a3] ?? f.properties.admin,
        },
        geometry: f.geometry,
      })),
  };
}

// ---- ciudades -------------------------------------------------------------

/** Below a state capital, a city needs this many people to make the board. */
const MIN_POBLACION = 300_000;
/** Logistics nodes kept regardless of size: border crossings and port cities. */
const SIEMPRE = new Set([
  'Nuevo Laredo',
  'Piedras Negras',
  'Nogales',
  'Ciudad Juárez',
  'Matamoros',
  'Lázaro Cárdenas',
  'Manzanillo',
  'Ensenada',
  'Guaymas',
  'Ciudad del Carmen',
  'Salina Cruz',
  'Tapachula',
  'Puerto Vallarta',
  'Los Mochis',
]);
/** A non-capital this close to a bigger kept city is the same metro area. */
const MISMA_ZONA_KM = 35;
const RENOMBRA = {
  'Mexico City': 'Ciudad de México',
  'Ciudad Obregon': 'Ciudad Obregón',
  Tehuacan: 'Tehuacán',
  Nezahualcoyotl: 'Nezahualcóyotl',
};

function ciudades(places) {
  const claveDe = {};
  for (const [, [clave, nombre]] of Object.entries(ESTADOS)) claveDe[nombre] = clave;
  claveDe['Distrito Federal'] = 'CDMX';
  claveDe['México'] = 'MEX';
  claveDe['Coahuila de Zaragoza'] = 'COAH';

  const candidatas = places.features
    .map((f) => f.properties)
    .filter((p) => p.adm0_a3 === 'MEX')
    // Natural Earth carries a ghost "Mazatlán, Sonora" (500k) next to the real
    // one in Sinaloa.
    .filter((p) => !(p.name === 'Mazatlán' && p.adm1name === 'Sonora'))
    .map((p) => ({
      nombre: RENOMBRA[p.name] ?? p.name,
      estado: claveDe[p.adm1name],
      lon: round(p.longitude),
      lat: round(p.latitude),
      poblacion: p.pop_max,
      capital: p.featurecla === 'Admin-0 capital' ? 'pais' : p.featurecla === 'Admin-1 capital' ? 'estado' : null,
    }))
    .filter((c) => c.capital || c.poblacion >= MIN_POBLACION || SIEMPRE.has(c.nombre))
    .sort((a, b) => (b.capital ? 1 : 0) - (a.capital ? 1 : 0) || b.poblacion - a.poblacion);

  const kept = [];
  for (const c of candidatas) {
    if (!c.estado) throw new Error(`Ciudad sin estado: ${c.nombre}`);
    if (!c.capital && kept.some((k) => km(k, c) < MISMA_ZONA_KM)) continue;
    kept.push({ id: slug(c.nombre), ...c });
  }
  return kept.sort((a, b) => b.poblacion - a.poblacion);
}

// ---- utils ----------------------------------------------------------------

const round = (n) => Math.round(n * 1e4) / 1e4;

function km(a, b) {
  const R = 6371;
  const d = Math.PI / 180;
  const s =
    Math.sin(((b.lat - a.lat) * d) / 2) ** 2 +
    Math.cos(a.lat * d) * Math.cos(b.lat * d) * Math.sin(((b.lon - a.lon) * d) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function slug(s) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function source(name) {
  const file = join(CACHE, `${name}.geojson`);
  try {
    await access(file);
  } catch {
    console.log(`descargando ${name}…`);
    const res = await fetch(`${NE_URL}/${name}.geojson`);
    if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
    await mkdir(CACHE, { recursive: true });
    await writeFile(file, Buffer.from(await res.arrayBuffer()));
  }
  return JSON.parse(await readFile(file, 'utf8'));
}

// ---- main -----------------------------------------------------------------

const [admin1, railroads, places] = await Promise.all([
  source('ne_10m_admin_1_states_provinces'),
  source('ne_10m_railroads'),
  source('ne_10m_populated_places_simple'),
]);

const inputs = {
  'estados.json': estados(admin1),
  'vias.json': vias(railroads),
  'vecinos.json': vecinos(admin1),
};

const [w, s, e, n] = VECINOS_BBOX;
const out = await mapshaper.applyCommands(
  [
    '-i estados.json vias.json vecinos.json combine-files snap',
    // Alacranes joins Yucatán; every other estado is a group of one.
    '-dissolve2 clave copy-fields=nombre,abrev,lon,lat target=estados',
    // US states, Guatemalan departments… → one shape per country.
    '-dissolve2 pais copy-fields=nombre target=vecinos',
    // The rail lines are cut at the land border only. Clipping them to Mexico's
    // outline also cut them at the 10m coast, which drops every bridge and
    // causeway over coastal water — the Guaymas–Empalme crossing went that
    // way. So the mask is Mexico grown 3 km out to sea, minus the neighbours.
    '-dissolve target=estados + name=pais',
    '-buffer target=pais radius=3000 + name=mascara',
    '-erase vecinos target=mascara',
    '-clip mascara target=vias',
    '-drop target=pais,mascara',
    `-clip bbox=${w},${s},${e},${n} target=vecinos`,
    // ~250 m: below a pixel at the deepest zoom of the Mexico view.
    '-simplify interval=250 keep-shapes',
    '-filter-slivers min-area=2km2 target=vecinos',
    '-o format=topojson quantization=100000 mexico.topo.json target=estados,vecinos',
    '-o format=geojson precision=0.00001 vias.json target=vias',
    // The same land, as plain polygons, for routing ships around it.
    '-o format=geojson precision=0.00001 tierra-estados.json target=estados',
    '-o format=geojson precision=0.00001 tierra-vecinos.json target=vecinos',
  ].join(' '),
  inputs
);

await writeFile(join(ROOT, 'static', 'data', 'mexico.topo.json'), out['mexico.topo.json']);

const { grafo, reporte } = red(JSON.parse(out['vias.json']));
const redJson = JSON.stringify({
  fuente:
    'Natural Earth 10m railroads (CEC North American Environmental Atlas), recortada a México; ' +
    `tramos agregados a mano: ${VIAS_A_MANO.map((v) => v.nombre).join(', ')}`,
  nodos: grafo.nodos,
  tramos: grafo.tramos,
});
await writeFile(join(ROOT, 'static', 'data', 'red-ferroviaria.json'), redJson);

// Ports (curated by hand) and gateways: the points the sea lanes join.
const datos = join(ROOT, 'src', 'lib', 'domain', 'datos');
const puertosMar = JSON.parse(await readFile(join(datos, 'puertos.json'), 'utf8'));
const puertasMar = JSON.parse(await readFile(join(datos, 'puertas.json'), 'utf8'));
const puntosMar = [
  ...puertosMar.map((p) => ({ clave: `puerto:${p.id}`, lonLat: [p.lon, p.lat] })),
  ...puertasMar.map((p) => ({ clave: `puerta:${p.id}`, lonLat: [p.lon, p.lat] })),
];
const t0Mar = performance.now();
const mar = rutasMaritimas(
  [JSON.parse(out['tierra-estados.json']), JSON.parse(out['tierra-vecinos.json'])],
  puntosMar
);
const marJson = JSON.stringify({
  fuente:
    'Rutas calculadas sobre la tierra de Natural Earth 10m (estados y vecinos), malla de ' +
    `${MAR.res}°, con el Canal de Panamá abierto a mano`,
  malla: MAR,
  canalPanama: CANAL_PANAMA,
  rutas: mar.rutas,
});
await writeFile(join(ROOT, 'static', 'data', 'rutas-maritimas.json'), marJson);

const lista = ciudades(places);
await mkdir(join(ROOT, 'src', 'lib', 'domain', 'datos'), { recursive: true });
await writeFile(
  join(ROOT, 'src', 'lib', 'domain', 'datos', 'ciudades.json'),
  JSON.stringify(lista, null, 1) + '\n'
);

const kb = (x) => `${(Buffer.byteLength(x) / 1024).toFixed(0)} KB`;
const lugar = ([lon, lat]) => `${lon.toFixed(3)}, ${lat.toFixed(3)}`;
const kmTotal = grafo.tramos.reduce((sum, t) => sum + t.km, 0);
console.log(`mexico.topo.json      ${kb(out['mexico.topo.json'])}`);
console.log(`ciudades.json         ${lista.length} ciudades`);
console.log(
  `red-ferroviaria.json  ${kb(redJson)} · ${grafo.nodos.length} nodos · ${grafo.tramos.length} tramos · ${Math.round(kmTotal)} km`
);
console.log(`  soldaduras (puntas sueltas a ≤ ${SOLDAR_KM} km de otra vía): ${reporte.soldaduras.length}`);
for (const s of reporte.soldaduras) console.log(`    ${s.km.toFixed(2)} km en ${lugar(s.en)}`);
console.log(`  pedazos descartados (< ${MIN_COMPONENTE_KM} km): ${reporte.descartados.length}`);
for (const d of reporte.descartados) console.log(`    ${d.km.toFixed(1)} km en ${lugar(d.en)}`);
console.log(`  componentes conectados: ${reporte.componentes.length}`);
for (const c of reporte.componentes) {
  console.log(`    ${Math.round(c.km)} km  caja ${lugar(c.caja.slice(0, 2))} → ${lugar(c.caja.slice(2))}`);
}
console.log(
  `rutas-maritimas.json  ${kb(marJson)} · ${mar.rutas.length} rutas entre ${puntosMar.length} puntos · ` +
    `${mar.reporte.celdas.toLocaleString('es-MX')} celdas · ${((performance.now() - t0Mar) / 1000).toFixed(1)} s`
);
console.log(`  por el Canal de Panamá: ${mar.rutas.filter((r) => r.canal.length).length} rutas`);
console.log(
  `  auditoría (¿alguna ruta pisa tierra, fuera de puertos y del Canal?): ` +
    (mar.reporte.fallas.length ? `${mar.reporte.fallas.length} con problemas` : 'ninguna')
);
for (const f of mar.reporte.fallas) console.log(`    ${f.ruta}: ${f.muestras} muestras en tierra, la primera en ${lugar(f.donde)}`);
