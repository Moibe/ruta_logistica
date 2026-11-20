// Builds the geography of the Mexico board from Natural Earth 10m.
//
//   npm run datos
//
// Outputs (all committed, so the app never needs this script or the network):
//   static/data/mexico.topo.json         estados + países vecinos
//   static/data/red-ferroviaria.json     la red como grafo: nodos y tramos
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
