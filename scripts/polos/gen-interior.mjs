// Builds the inside of a Polo del Bienestar for its close-up view: the land as the DOF declares
// it, what's around it (OpenStreetMap), and a layout of its lots, road, rail spur and power
// connection.
//
//   node scripts/polos/gen-interior.mjs
//
// Huamantla and Coatzacoalcos I. Writes:
//   static/data/polos/<id>.json            the geometry, in metres around the polo (fetched by the view)
//   src/lib/domain/datos/interiores.json   the works by front and the real facts (read by the game)
//
// OpenStreetMap comes from Overpass, in small queries (the big one gets a 502), cached in
// .cache/osm/<polo>/ so it's downloaded once.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// ---- UTM (WGS84) -------------------------------------------------------------------------------

const A = 6378137;
const F = 1 / 298.257223563;
const E2 = F * (2 - F);
const EP2 = E2 / (1 - E2);
const K0 = 0.9996;
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

function meridiano(phi) {
  const e4 = E2 * E2;
  const e6 = e4 * E2;
  return (
    A *
    ((1 - E2 / 4 - (3 * e4) / 64 - (5 * e6) / 256) * phi -
      ((3 * E2) / 8 + (3 * e4) / 32 + (45 * e6) / 1024) * Math.sin(2 * phi) +
      ((15 * e4) / 256 + (45 * e6) / 1024) * Math.sin(4 * phi) -
      ((35 * e6) / 3072) * Math.sin(6 * phi))
  );
}

function aUtm(lon, lat, zona) {
  const phi = rad(lat);
  const l0 = rad(zona * 6 - 183);
  const n = A / Math.sqrt(1 - E2 * Math.sin(phi) ** 2);
  const t = Math.tan(phi) ** 2;
  const c = EP2 * Math.cos(phi) ** 2;
  const a = Math.cos(phi) * (rad(lon) - l0);
  const x = 500000 + K0 * n * (a + ((1 - t + c) * a ** 3) / 6 + ((5 - 18 * t + t * t + 72 * c - 58 * EP2) * a ** 5) / 120);
  const y =
    K0 *
    (meridiano(phi) +
      n * Math.tan(phi) * ((a * a) / 2 + ((5 - t + 9 * c + 4 * c * c) * a ** 4) / 24 + ((61 - 58 * t + t * t + 600 * c - 330 * EP2) * a ** 6) / 720));
  return [x, y];
}

function deUtm(x, y, zona) {
  const e4 = E2 * E2;
  const e6 = e4 * E2;
  const mu = y / K0 / (A * (1 - E2 / 4 - (3 * e4) / 64 - (5 * e6) / 256));
  const e1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2));
  const p1 =
    mu +
    ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) +
    ((21 * e1 * e1) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) +
    ((151 * e1 ** 3) / 96) * Math.sin(6 * mu) +
    ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu);
  const c1 = EP2 * Math.cos(p1) ** 2;
  const t1 = Math.tan(p1) ** 2;
  const n1 = A / Math.sqrt(1 - E2 * Math.sin(p1) ** 2);
  const r1 = (A * (1 - E2)) / (1 - E2 * Math.sin(p1) ** 2) ** 1.5;
  const d = (x - 500000) / (n1 * K0);
  const lat =
    p1 -
    ((n1 * Math.tan(p1)) / r1) *
      ((d * d) / 2 - ((5 + 3 * t1 + 10 * c1 - 4 * c1 * c1 - 9 * EP2) * d ** 4) / 24 + ((61 + 90 * t1 + 298 * c1 + 45 * t1 * t1 - 252 * EP2 - 3 * c1 * c1) * d ** 6) / 720);
  const lon = rad(zona * 6 - 183) + (d - ((1 + 2 * t1 + c1) * d ** 3) / 6 + ((5 - 2 * c1 + 28 * t1 - 3 * c1 * c1 + 8 * EP2 + 24 * t1 * t1) * d ** 5) / 120) / Math.cos(p1);
  return [deg(lon), deg(lat)];
}

// ---- plane geometry ----------------------------------------------------------------------------

const area = (p) => Math.abs(p.reduce((s, [x, y], i) => { const [x2, y2] = p[(i + 1) % p.length]; return s + x * y2 - x2 * y; }, 0)) / 2;
const perimetro = (p) => p.reduce((s, [x, y], i) => { const [x2, y2] = p[(i + 1) % p.length]; return s + Math.hypot(x2 - x, y2 - y); }, 0);

/** Keep the part of polygon `p` where nx·x + ny·y ≤ c (Sutherland–Hodgman against one half-plane). */
function recortar(p, nx, ny, c) {
  const out = [];
  for (let i = 0; i < p.length; i++) {
    const a = p[i];
    const b = p[(i + 1) % p.length];
    const da = nx * a[0] + ny * a[1] - c;
    const db = nx * b[0] + ny * b[1] - c;
    if (da <= 0) out.push(a);
    if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
      const t = da / (da - db);
      out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
    }
  }
  return out;
}

/** The part of `p` (in u,v) between u0 and u1 and between v0 and v1. */
const caja = (p, u0, u1, v0, v1) => recortar(recortar(recortar(recortar(p, -1, 0, -u0), 1, 0, u1), 0, -1, -v0), 0, 1, v1);

/** The `x` in [lo, hi] where the increasing f(x) reaches `meta`. */
function biseccion(f, meta, lo, hi) {
  for (let i = 0; i < 60; i++) {
    const m = (lo + hi) / 2;
    if (f(m) < meta) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2;
}

function puntoMasCercano([px, py], [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return [ax + t * dx, ay + t * dy];
}

/** The closest pair of points between two polylines (or polygon rings), and their distance. */
function masCercanos(a, b, cerrarA = false) {
  let mejor = { d: Infinity, pa: null, pb: null };
  const segs = (l, cerrar) => l.slice(0, cerrar ? l.length : l.length - 1).map((p, i) => [p, l[(i + 1) % l.length]]);
  for (const [a0, a1] of segs(a, cerrarA))
    for (const [b0, b1] of segs(b, false)) {
      for (const [p, s0, s1, deA] of [[a0, b0, b1, true], [a1, b0, b1, true], [b0, a0, a1, false], [b1, a0, a1, false]]) {
        const q = puntoMasCercano(p, s0, s1);
        const d = Math.hypot(p[0] - q[0], p[1] - q[1]);
        if (d < mejor.d) mejor = { d, pa: deA ? p : q, pb: deA ? q : p };
      }
    }
  return mejor;
}

function simplificar(puntos, tol) {
  if (puntos.length < 3) return puntos;
  const [a, b] = [puntos[0], puntos[puntos.length - 1]];
  let max = 0;
  let idx = 0;
  for (let i = 1; i < puntos.length - 1; i++) {
    const q = puntoMasCercano(puntos[i], a, b);
    const d = Math.hypot(puntos[i][0] - q[0], puntos[i][1] - q[1]);
    if (d > max) { max = d; idx = i; }
  }
  if (max <= tol) return [a, b];
  return [...simplificar(puntos.slice(0, idx + 1), tol).slice(0, -1), ...simplificar(puntos.slice(idx), tol)];
}

const r1 = (n) => Math.round(n * 10) / 10;
const r0 = (n) => Math.round(n);

// ---- the polo --------------------------------------------------------------------------------

/**
 * Huamantla, from its declaratoria (DOF, 14 Aug 2025): the construction table, UTM zone 14
 * (WGS84), 37 vertices. The DOF writes four of them with a dot where the comma goes
 * (611.268.7407, 611.576.0324, 611.734.0058 and 2.140,253.4809): read as the numbers they are.
 */
const HUAMANTLA = {
  id: 'huamantla',
  zona: 14,
  vertices: [
    [611520.3155, 2140878.7087], [611407.9681, 2140677.4396], [611392.2835, 2140660.8707], [611271.1258, 2140606.3763],
    [611264.4617, 2140600.2799], [611016.91, 2140270.63], [611210.0756, 2139891.4877], [611240.4306, 2139911.8198],
    [611268.7407, 2139938.3659], [611298.6007, 2139966.3654], [611335.0045, 2139998.5297], [611378.2327, 2140032.2808],
    [611451.3762, 2140093.5007], [611502.1079, 2140134.5717], [611547.9934, 2140172.8028], [611576.0324, 2140217.169],
    [611614.6141, 2140253.4809], [611654.7593, 2140286.2428], [611685.9548, 2140325.4256], [611709.3688, 2140348.6114],
    [611734.0058, 2140374.5854], [611758.6428, 2140400.5595], [611790.8412, 2140435.3298], [611812.1742, 2140460.9125],
    [611847.4729, 2140496.2292], [611878.3531, 2140538.1897], [611903.4765, 2140569.7924], [611941.6671, 2140622.2149],
    [611973.4973, 2140652.7527], [611999.5312, 2140672.4227], [612061.0369, 2140735.2461], [612091.2057, 2140764.5918],
    [612114.7924, 2140784.417], [611554.1263, 2141048.4062], [611543.6019, 2141029.6233], [611539.7976, 2141012.8561],
    [611548.6633, 2140930.5407],
  ],
  areaDof: 530000,
  /** Vertex 1 as the DOF gives it in geographic coordinates, to check the conversion. */
  control: { lat: 19 + 21 / 60 + 31.923462 / 3600, lon: -(97 + 56 / 60 + 17.426755 / 3600) },
  /**
   * The lots the state government announced at the inauguration (Presidencia, 12 Apr 2026),
   * hectares: "Grupo Caná con… 20 mil metros, Geometrika 1000 con 15 mil, Rebelbox con 25 mil,
   * Color Link con 10 mil, Gravity con 20 hectáreas, El Charrito con 11 y Sonavox con 6.9".
   * Where each one is isn't published: the layout is the game's.
   */
  lotes: [
    { empresa: 'Gravity', ha: 20, lado: 'a' },
    { empresa: 'Sonavox', ha: 6.9, lado: 'a' },
    { empresa: 'El Charrito', ha: 11, lado: 'b' },
    { empresa: 'Rebelbox', ha: 2.5, lado: 'b' },
    { empresa: 'Grupo Caná', ha: 2, lado: 'b' },
    { empresa: 'Geometrika 1000', ha: 1.5, lado: 'b' },
    { empresa: 'Color Link', ha: 1, lado: 'b' },
  ],
  /** Business centre, dining hall and childcare (CECI): the game's estimate of its size. */
  serviciosHa: 1.2,
  /** Widths, metres: the main road (two lanes each way with a median) and the access lanes between lots. */
  anchoVialidad: 26,
  anchoAcceso: 14,
  /** The view: a box around the polo, metres. */
  caja: { x0: -3600, x1: 3600, y0: -4800, y1: 3400 },
  /** OpenStreetMap queries: the near box for streets and land use, the wide one for track, power and places. */
  cerca: '19.325,-97.975,19.385,-97.900',
  lejos: '19.30,-98.00,19.41,-97.87',
  /** The federal highway the entrance faces. */
  carretera: /136|119/,
};

/**
 * Coatzacoalcos I, from its declaratoria (DOF, 12 May 2023): a construction table in UTM zone 15
 * with the bearing and length of every side, which shows two typos and fixes them:
 * - vertex 9 is written 1,999,815.5086 north; the side from vertex 8 («S 04°57'42.44" E, 552.834
 *   m») ends at 1,998,815.5: a wrong digit;
 * - the table closes on «vertex 1» at 357,910.7404 east, but the last side («N 02°59'51.53" E,
 *   77.381 m») ends at 357,166.74, vertex 1 as the table starts it: the closing row is vertex 1
 *   repeated with a typo, and is left out.
 * With both, the area is 257.62 ha against the 257.71 declared.
 */
const COATZACOALCOS_I = {
  id: 'coatzacoalcos-i',
  zona: 15,
  vertices: [
    [357166.7404, 1999910.1451], [357336.2968, 1999820.1184], [357616.9853, 1999672.0739], [357859.6123, 1999540.3502],
    [358055.382, 1999455.055], [358150.79, 1999410.767], [358237.896, 1999381.266], [358323.482, 1999366.271],
    [358371.2974, 1998815.5086], [358386.3344, 1998813.289], [358402.6743, 1998841.6819], [358457.6249, 1998814.4615],
    [358662.038, 1999199.278], [358670.8498, 1999142.7778], [358923.1651, 1999139.9833], [358936.7159, 1999137.3362],
    [358953.3341, 1999156.8915], [358997.503, 1999160.197], [359013.48, 1999204.434], [359057.183, 1999197.857],
    [359136.1535, 1999216.8963], [359211.657, 1999107.5612], [359291.0074, 1998982.4459], [359106.319, 1998620.7407],
    [358906.4707, 1998243.9735], [358749.6326, 1998289.4991], [358700.63, 1998218.9618], [358460.217, 1997891.469],
    [358405.5016, 1997899.3817], [358376.6346, 1997903.1079], [358335.8762, 1997890.1079], [358303.6685, 1997864.8984],
    [358298.0628, 1997863.1681], [358146.39, 1997873.6891], [358138.8317, 1997873.5014], [358093.935, 1997915.859],
    [358077.4616, 1997968.1733], [358051.4731, 1998034.4339], [358024.5797, 1998046.1691], [357971.926, 1998117.788],
    [357795.9985, 1998227.2009], [357724.9726, 1998252.0504], [357596.5897, 1998241.632], [357547.0966, 1998198.5015],
    [357499.9298, 1998211.656], [357443.0177, 1998204.4419], [357372.123, 1998304.981], [357401.0191, 1998415.7157],
    [357363.4419, 1998548.8279], [357332.429, 1998666.756], [357274.0493, 1998745.5503], [357183.5165, 1998812.2498],
    [357105.984, 1998877.527], [357048.3628, 1998904.1058], [356997.2281, 1998908.6297], [356931.249, 1998937.923],
    [356944.394, 1999115.335], [356952.989, 1999202.096], [356960.558, 1999343.317], [356980.8049, 1999926.6442],
    [357162.6938, 1999832.8704],
  ],
  areaDof: 2577096.57,
  /** The DOF gives no geographic coordinates: the check is the marker the game already had (polos.json). */
  control: null,
  marcador: { lat: 18.0737, lon: -94.3418 },
  /**
   * No lots are published. The declaratoria says 76.46 % of the land is zoned industrial: 197 ha.
   * The game splits them into 12 lots of 8 to 30 ha (an estimate).
   */
  lotes: [
    { ha: 30, lado: 'a' }, { ha: 20, lado: 'a' }, { ha: 18, lado: 'a' }, { ha: 15, lado: 'a' }, { ha: 12, lado: 'a' }, { ha: 9, lado: 'a' },
    { ha: 25, lado: 'b' }, { ha: 20, lado: 'b' }, { ha: 16, lado: 'b' }, { ha: 14, lado: 'b' }, { ha: 10, lado: 'b' }, { ha: 8, lado: 'b' },
  ],
  serviciosHa: 3,
  anchoVialidad: 30,
  anchoAcceso: 16,
  caja: { x0: -4500, x1: 4500, y0: -4500, y1: 4500 },
  cerca: '18.035,-94.385,18.115,-94.295',
  lejos: '18.00,-94.42,18.15,-94.26',
  carretera: /180/,
  /** A city outskirts: its many service lanes are left out to keep the drawing light. */
  sinServicio: true,
};

// ---- OpenStreetMap ----------------------------------------------------------------------------

const CONSULTAS = (p) => ({
  caminos: `way["highway"](${p.cerca});`,
  vias: `way["railway"](${p.lejos});`,
  electricidad: `way["power"~"line|minor_line"](${p.cerca});node["power"="substation"](${p.lejos});way["power"="substation"](${p.lejos});way["man_made"="pipeline"](${p.lejos});`,
  suelo: `way["landuse"](${p.cerca});`,
  'agua-lugares': `way["waterway"](${p.cerca});node["place"](${p.lejos});`,
  edificios: `way["building"](${p.cerca});`,
});

async function osm(p) {
  const dir = join(ROOT, '.cache', 'osm', p.id);
  await mkdir(dir, { recursive: true });
  const out = {};
  for (const [k, q] of Object.entries(CONSULTAS(p))) {
    const file = join(dir, `${k}.json`);
    if (!existsSync(file)) {
      let ok = false;
      for (let intento = 1; intento <= 4 && !ok; intento++) {
        const res = await fetch('https://overpass-api.de/api/interpreter', {
          method: 'POST',
          headers: { 'User-Agent': 'ruta-logistica-juego', 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'data=' + encodeURIComponent(`[out:json][timeout:80];(${q});out geom;`),
        });
        if (res.ok) {
          await writeFile(file, await res.text());
          ok = true;
        } else {
          console.log(`Overpass ${k}: HTTP ${res.status}, intento ${intento}`);
          await new Promise((r) => setTimeout(r, 5000 * intento));
        }
      }
      if (!ok) throw new Error(`Overpass no respondió para ${k}`);
    }
    out[k] = JSON.parse(await readFile(file, 'utf8')).elements;
  }
  return out;
}

// ---- build -----------------------------------------------------------------------------------

async function construir(p) {
  // The land, in metres around its centroid (UTM grid: north is the grid's, 0.35° off true north here).
  const v = p.vertices;
  const cx = v.reduce((s, q) => s + q[0], 0) / v.length;
  const cy = v.reduce((s, q) => s + q[1], 0) / v.length;
  const poligono = v.map(([x, y]) => [x - cx, y - cy]);
  const [lon0, lat0] = deUtm(cx, cy, p.zona);
  const a = area(poligono);
  if (p.control) {
    const [clon, clat] = deUtm(v[0][0], v[0][1], p.zona);
    const errorControl = Math.hypot((clon - p.control.lon) * 104900, (clat - p.control.lat) * 110600);
    console.log(`${p.id}: área ${a.toFixed(0)} m² (DOF ${p.areaDof}) · perímetro ${perimetro(poligono).toFixed(1)} m · vértice 1 a ${errorControl.toFixed(2)} m de sus coordenadas geográficas`);
    if (errorControl > 1) throw new Error('La conversión UTM no cuadra con el vértice de control');
  } else {
    const d = Math.hypot((lon0 - p.marcador.lon) * 105700, (lat0 - p.marcador.lat) * 110600);
    console.log(`${p.id}: área ${a.toFixed(0)} m² (DOF ${p.areaDof}) · perímetro ${perimetro(poligono).toFixed(1)} m · centro a ${d.toFixed(0)} m del marcador`);
    if (d > 300) throw new Error('El polígono no cae donde el marcador del polo');
  }
  if (Math.abs(a - p.areaDof) / p.areaDof > 0.005) throw new Error('El área no cuadra con la del DOF');

  const local = (lon, lat) => { const [x, y] = aUtm(lon, lat, p.zona); return [x - cx, y - cy]; };
  const { x0, x1, y0, y1 } = p.caja;
  const dentro = ([x, y]) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
  /** A way as polylines inside the box (cut where it leaves), simplified. */
  const trazos = (geom, tol = 1.5) => {
    const partes = [];
    let actual = [];
    for (const g of geom) {
      const q = local(g.lon, g.lat);
      if (dentro(q)) actual.push(q);
      else if (actual.length) { partes.push(actual); actual = []; }
    }
    if (actual.length) partes.push(actual);
    return partes.filter((l) => l.length > 1).map((l) => simplificar(l, tol).map(([x, y]) => [r0(x), r0(y)]));
  };

  const datos = await osm(p);
  const caminos = [];
  for (const e of datos.caminos) {
    const t = e.tags ?? {};
    if (!e.geometry || ['footway', 'path', 'steps', 'cycleway', 'pedestrian', 'construction', 'proposed'].includes(t.highway)) continue;
    if (p.sinServicio && t.highway === 'service') continue;
    for (const puntos of trazos(e.geometry)) caminos.push({ tipo: t.highway, ...(t.name ? { nombre: t.name } : {}), ...(t.ref ? { ref: t.ref } : {}), puntos });
  }
  const vias = [];
  for (const e of datos.vias) {
    const t = e.tags ?? {};
    if (!e.geometry || !['rail', 'abandoned', 'disused'].includes(t.railway)) continue;
    for (const puntos of trazos(e.geometry, 2))
      vias.push({ estado: t.railway, ...(t.name ? { nombre: t.name } : {}), ...(t.operator ? { operador: t.operator } : {}), ...(t.service ? { servicio: t.service } : {}), puntos });
  }
  const lineas = [];
  const subestaciones = [];
  for (const e of datos.electricidad) {
    const t = e.tags ?? {};
    if (t.power === 'substation') {
      const g = e.geometry ?? [{ lon: e.lon, lat: e.lat }];
      const [x, y] = local(g.reduce((s, q) => s + q.lon, 0) / g.length, g.reduce((s, q) => s + q.lat, 0) / g.length);
      subestaciones.push({ nombre: t.name ?? 'Subestación', operador: t.operator ?? '', kv: t.voltage ?? '', x: r0(x), y: r0(y) });
    } else if (e.geometry && /line/.test(t.power ?? '')) {
      for (const puntos of trazos(e.geometry, 3)) lineas.push({ kv: t.voltage ?? '', puntos });
    }
  }
  const suelo = datos.suelo
    .filter((e) => e.geometry && ['industrial', 'residential', 'commercial'].includes(e.tags?.landuse))
    .map((e) => ({ uso: e.tags.landuse, ...(e.tags.name ? { nombre: e.tags.name } : {}), puntos: simplificar(e.geometry.map((g) => local(g.lon, g.lat)), 2).map(([x, y]) => [r0(x), r0(y)]) }));
  const agua = [];
  const lugares = [];
  for (const e of datos['agua-lugares']) {
    const t = e.tags ?? {};
    if (t.place && t.name) {
      const [x, y] = local(e.lon, e.lat);
      lugares.push({ nombre: t.name, tipo: t.place, x: r0(x), y: r0(y) });
    } else if (e.geometry) for (const puntos of trazos(e.geometry, 3)) agua.push({ tipo: t.waterway, puntos });
  }
  // One label per name (a plant's cooling towers come in sets), and none of the bare «building=yes» ones.
  const vistos = new Set();
  const edificios = datos.edificios
    .filter((e) => e.geometry && e.tags?.name && e.tags.building !== 'yes' && !vistos.has(e.tags.name) && vistos.add(e.tags.name))
    .map((e) => {
      const g = e.geometry;
      const [x, y] = local(g.reduce((s, q) => s + q.lon, 0) / g.length, g.reduce((s, q) => s + q.lat, 0) / g.length);
      return { nombre: e.tags.name, tipo: e.tags.building, x: r0(x), y: r0(y) };
    });

  // ---- the layout: a main road down the long axis, lots on both sides ------------------------

  // The long axis: principal direction of the boundary, sampled every 5 m.
  const muestras = [];
  poligono.forEach((q, i) => {
    const b = poligono[(i + 1) % poligono.length];
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - q[0], b[1] - q[1]) / 5));
    for (let k = 0; k < n; k++) muestras.push([q[0] + ((b[0] - q[0]) * k) / n, q[1] + ((b[1] - q[1]) * k) / n]);
  });
  const mx = muestras.reduce((s, q) => s + q[0], 0) / muestras.length;
  const my = muestras.reduce((s, q) => s + q[1], 0) / muestras.length;
  let sxx = 0, syy = 0, sxy = 0;
  for (const [x, y] of muestras) { sxx += (x - mx) ** 2; syy += (y - my) ** 2; sxy += (x - mx) * (y - my); }
  let th = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const aUV = ([x, y]) => [x * Math.cos(th) + y * Math.sin(th), -x * Math.sin(th) + y * Math.cos(th)];
  const deUV = ([u, w]) => [u * Math.cos(th) - w * Math.sin(th), u * Math.sin(th) + w * Math.cos(th)];

  // The entrance: the end of the axis nearest the federal highway.
  const carretera = caminos.filter((c) => c.ref && p.carretera.test(c.ref));
  let P = poligono.map(aUV);
  const extremo = (lado) => { const us = P.map((q) => q[0]); return lado < 0 ? Math.min(...us) : Math.max(...us); };
  const distA = (u) => Math.min(...carretera.flatMap((c) => c.puntos).map((q) => Math.hypot(...deUV([u, 0]).map((z, i) => z - q[i]))));
  if (distA(extremo(1)) < distA(extremo(-1))) { th += Math.PI; P = poligono.map(aUV); }
  const umin = Math.min(...P.map((q) => q[0])) - 1;
  const umax = Math.max(...P.map((q) => q[0])) + 1;
  const vmin = Math.min(...P.map((q) => q[1])) - 1;
  const vmax = Math.max(...P.map((q) => q[1])) + 1;
  const W = p.anchoVialidad / 2;

  const haNecesita = (lado) => p.lotes.filter((l) => l.lado === lado).reduce((s, l) => s + l.ha, 0) + (lado === 'b' ? p.serviciosHa : 0);
  const necesitaA = haNecesita('a');
  const necesitaB = haNecesita('b');
  // Place the road so each side gets its share of what's left after it.
  const ladoA = (s) => area(caja(P, umin, umax, s + W, vmax)) / 1e4;
  const ladoB = (s) => area(caja(P, umin, umax, vmin, s - W)) / 1e4;
  const s = biseccion((t) => ladoB(t) / (ladoA(t) + ladoB(t)), necesitaB / (necesitaA + necesitaB), vmin + W, vmax - W);
  const regiones = { a: [s + W, vmax], b: [vmin, s - W] };

  const lotes = [];
  for (const lado of ['b', 'a']) {
    const [w0, w1] = regiones[lado];
    const cola = lado === 'b' ? [{ servicios: true, ha: p.serviciosHa }, ...p.lotes.filter((l) => l.lado === 'b')] : p.lotes.filter((l) => l.lado === 'a').reverse();
    let u0 = umin;
    for (const l of cola) {
      const meta = l.ha * 1e4;
      const u1 = biseccion((u) => area(caja(P, u0, u, w0, w1)), meta, u0, umax);
      const forma = caja(P, u0, u1, w0, w1).map(deUV);
      lotes.push({
        tipo: l.servicios ? 'servicios' : 'empresa',
        ...(l.empresa ? { empresa: l.empresa } : {}),
        ha: l.ha,
        puntos: forma.map(([x, y]) => [r1(x), r1(y)]),
      });
      u0 = u1 + p.anchoAcceso;
    }
    const resto = caja(P, u0, umax, w0, w1);
    if (area(resto) > 500) lotes.push({ tipo: 'reserva', ha: r1(area(resto) / 1e4 * 10) / 10, puntos: resto.map(deUV).map(([x, y]) => [r1(x), r1(y)]) });
  }
  const vialidad = caja(P, umin, umax, s - W, s + W).map(deUV).map(([x, y]) => [r1(x), r1(y)]);
  const uIn = Math.min(...caja(P, umin, umax, s - W, s + W).map((q) => q[0]));
  const uOut = Math.max(...caja(P, umin, umax, s - W, s + W).map((q) => q[0]));
  const eje = [deUV([uIn, s]), deUV([uOut, s])].map(([x, y]) => [r1(x), r1(y)]);

  // Where the services lot is, the substation and the water tank go (its corner by the road).
  const serv = lotes.find((l) => l.tipo === 'servicios');
  const servUV = serv.puntos.map(aUV);
  const cerca = (u, w) => deUV([u, w]).map(r1);
  const su = Math.max(...servUV.map((q) => q[0]));
  const subestacion = cerca(su - 25, s - W - 22);
  const tanque = cerca(su - 60, s - W - 22);
  const centro = cerca((Math.min(...servUV.map((q) => q[0])) + su) / 2 - 20, s - W - 45);

  // The rail spur: from the nearest main track to the boundary.
  const principales = vias.filter((x) => x.estado === 'rail' && !['siding', 'yard', 'spur'].includes(x.servicio ?? '') && x.nombre);
  let espuela = null;
  for (const via of principales) {
    const m = masCercanos(poligono, via.puntos, true);
    if (!espuela || m.d < espuela.d) espuela = { ...m, via };
  }
  // The power connection: from the substation to the nearest high-voltage line.
  let conexion = null;
  for (const l of lineas) {
    const m = masCercanos([subestacion, subestacion], l.puntos);
    if (!conexion || m.d < conexion.d) conexion = { ...m, linea: l };
  }

  const geometria = {
    id: p.id,
    nota: 'Generado por scripts/polos/gen-interior.mjs. Metros alrededor del centro del polo (cuadrícula UTM zona ' + p.zona + ').',
    centro: { lon: Number(lon0.toFixed(6)), lat: Number(lat0.toFixed(6)) },
    caja: p.caja,
    poligono: poligono.map(([x, y]) => [r1(x), r1(y)]),
    areaM2: Math.round(a),
    perimetroM: Math.round(perimetro(poligono)),
    lotes,
    vialidad,
    eje,
    servicios: { centro, subestacion, tanque },
    espuela: { puntos: [espuela.pa, espuela.pb].map(([x, y]) => [r1(x), r1(y)]), km: Number((espuela.d / 1000).toFixed(2)), via: espuela.via.nombre ?? '', operador: espuela.via.operador ?? '' },
    conexionElectrica: { puntos: [conexion.pa, conexion.pb].map(([x, y]) => [r1(x), r1(y)]), km: Number((conexion.d / 1000).toFixed(2)), kv: conexion.linea.kv },
    /** The highway the polo faces, for its label. */
    carretera: carretera[0]?.ref ?? null,
    caminos,
    vias,
    lineas,
    subestaciones,
    suelo,
    agua,
    lugares,
    edificios,
  };
  console.log(`vialidad: ${(area(vialidad) / 1e4).toFixed(1)} ha · lotes: ${lotes.map((l) => `${l.empresa ?? l.tipo} ${(area(l.puntos) / 1e4).toFixed(2)}`).join(', ')}`);
  console.log(`espuela a la ${geometria.espuela.via} (${geometria.espuela.operador}): ${geometria.espuela.km} km · conexión a la línea de ${conexion.linea.kv} V: ${geometria.conexionElectrica.km} km`);
  console.log(`caminos ${caminos.length}, vías ${vias.length}, líneas ${lineas.length}, subestaciones ${subestaciones.length}, lugares ${lugares.length}`);
  return geometria;
}

// ---- what the game reads -----------------------------------------------------------------------

const FUENTES = {
  'dof-huamantla': {
    fuente: 'DOF, Acuerdo por el que se emite la declaratoria del Polo de Desarrollo Económico para el Bienestar Huamantla, Tlaxcala (14 de agosto de 2025): cuadro de construcción (37 vértices, UTM), 530,000 m², vocaciones productivas, propiedad del Gobierno del estado',
    url: 'https://dof.gob.mx/nota_detalle.php?codigo=5765468&fecha=14/08/2025',
  },
  'presidencia-inauguracion': {
    fuente: 'Presidencia, versión estenográfica de la inauguración del PODECOBI Huamantla (12 de abril de 2026): los lotes vendidos con su superficie y empresa, las 7.8 hectáreas añadidas, las obras del gobierno del estado (energía, vialidades, iluminación), el centro de negocios, comedor y estancia infantil, y el modelo (el estado pone el terreno, un desarrollador urbaniza y la venta de los lotes paga la urbanización)',
    url: 'https://www.gob.mx/presidencia/es/articulos/version-estenografica-inauguracion-del-polo-de-desarrollo-economico-para-el-bienestar-podecobi-huamantla?idiom=es',
  },
  'economia-ficha': {
    fuente: 'Secretaría de Economía, ficha del polo Huamantla (podecobi.economia.gob.mx): energía disponible de 8 MVA, agua con disponibilidad confirmada, gas natural con ducto a 3 km, conexión ferroviaria (KCSM y Ferrosur), superficie total de 61.8 ha',
    url: 'https://podecobi.economia.gob.mx/polos-de-desarrollo',
  },
  'economia-nota': {
    fuente: 'Secretaría de Economía, «Plan México avanza: Polo de Desarrollo Económico en Tlaxcala» (18 de diciembre de 2025): la obra concluirá el 28 de febrero de 2026, tendrá un CECI; Knipping Automotive y otras con cartas de intención',
    url: 'https://podecobi.economia.gob.mx/en/news/plan-mexico-avanza-polo-de-desarrollo-economico-en-tlaxcala/',
  },
  osm: { fuente: 'OpenStreetMap (ODbL, © colaboradores de OpenStreetMap): calles, vías, líneas eléctricas, subestaciones de la CFE, poblados y zonas industriales alrededor del polo', url: 'https://www.openstreetmap.org/copyright' },
  'dof-coatzacoalcos-i': {
    fuente: 'DOF, Acuerdo por el que se emite la declaratoria del Polo de Desarrollo para el Bienestar Coatzacoalcos I (12 de mayo de 2023): cuadro de construcción (62 renglones en UTM 15, con rumbo y distancia de cada lado), 257.71 ha, a 3.1 km de la línea Z, frente a la MEX-180, 76.46 % de uso de suelo industrial, sus vocaciones productivas y su propiedad (el Corredor Interoceánico)',
    url: 'https://dof.gob.mx/nota_detalle.php?codigo=5688608&fecha=12/05/2023',
  },
  'energia-polos': {
    fuente: 'Estimación del juego con las declaratorias y el portal de Economía: los polos sin cifra oficial de energía usan 0.0257 MW por hectárea, la razón de los cinco que sí la tienen (ver La energía)',
    url: '',
  },
  'sict-dos-bocas': { fuente: 'SICT: costo del ramal ferroviario a Dos Bocas, base del costo por km de la espuela (ver la sección de obras del Estado)', url: 'https://www.gob.mx/sct/prensa/precisa-sict-que-ramal-ferroviario-roberto-ayala-dos-bocas-tiene-un-costo-estimado-de-6-mil-54-mdp' },
  juego: { fuente: 'Estimación del juego', url: '' },
};

const HUAMANTLA_SECTORES = ['textil', 'metalicas', 'productos-metalicos', 'maquinaria', 'computacion', 'electricos', 'transporte', 'bebidas'];

function interiorHuamantla(g) {
  return {
    nombre: 'Huamantla',
    lugar: 'Huamantla, Tlaxcala',
    sectores: HUAMANTLA_SECTORES,
    fuentesLista: ['dof-huamantla', 'presidencia-inauguracion', 'economia-ficha', 'economia-nota', 'osm', 'sict-dos-bocas'],
    realNota:
      'El polo real: compromiso de obra el 28 de julio de 2025, al 20 % el 14 de octubre, inaugurado el 12 de abril de 2026. Los siete lotes vendidos llevan el nombre de su empresa; su giro no se publica. No se ha reportado una espuela.',
    frentes: [
      { id: 'vialidades', nombre: 'Vialidades e iluminación', corto: 'Vialidades', parte: 0.4 },
      { id: 'agua', nombre: 'Agua potable y drenaje', corto: 'Agua y drenaje', parte: 0.25 },
      { id: 'energia', nombre: 'Energía eléctrica', corto: 'Energía', parte: 0.25 },
      { id: 'servicios', nombre: 'Centro de negocios, comedor y CECI', corto: 'Servicios', parte: 0.1 },
    ],
    frentesDato: {
      dato:
        'Las obras del polo, como las nombró el Gobierno de Tlaxcala en la inauguración: la energía, las vialidades y la iluminación, y el centro de negocios con comedor y estancia infantil (CECI); el agua y el drenaje los da la ficha de Economía y la declaratoria. Qué parte del costo lleva cada una es estimación del juego: 40 % vialidades e iluminación, 25 % agua y drenaje, 25 % energía, 10 % servicios.',
      fuentes: ['presidencia-inauguracion', 'economia-ficha', 'economia-nota', 'juego'],
    },
    espuela: {
      km: g.espuela.km,
      via: g.espuela.via,
      operador: g.espuela.operador,
      mesesMinimos: 2,
      dato: `La espuela va de la ${g.espuela.via} (${g.espuela.operador}) al polo: ${g.espuela.km.toLocaleString('es-MX')} km en línea recta (OpenStreetMap). Cuesta por km lo que el ramal a Dos Bocas (SICT) y se hace a su paso, con un mínimo de 2 meses: estimación del juego. No se ha reportado que el polo real tenga espuela: la ficha de Economía solo dice «conexión ferroviaria».`,
      fuentes: ['osm', 'sict-dos-bocas', 'juego'],
    },
    energia: {
      mva: 8,
      fuenteCorta: 'Economía',
      kmLinea: g.conexionElectrica.km,
      dato: `Energía disponible de 8 MVA (Economía). La línea de 115 kV de la CFE más cercana queda a ${g.conexionElectrica.km.toLocaleString('es-MX')} km (OpenStreetMap).`,
      fuentes: ['economia-ficha', 'osm'],
    },
    lotes: {
      /** The company lots, in the drawing's order: «Lote 1» is the first. */
      lista: g.lotes.filter((l) => l.tipo === 'empresa').map((l, i) => ({ n: i + 1, ha: l.ha, empresa: l.empresa })),
      dato: 'Siete empresas compraron lotes (Presidencia, inauguración): Gravity 20 ha, El Charrito 11, Sonavox 6.9, Rebelbox 2.5, Grupo Caná 2, Geometrika 1000 1.5 y Color Link 1; en total 44.9 ha. Dónde queda cada lote no se publica: el acomodo es del juego. Después se añadieron 7.8 ha, también vendidas, que no están en la declaratoria.',
      fuentes: ['presidencia-inauguracion', 'juego'],
    },
    vocaciones: ['Industria textil', 'Industrias metálicas básicas', 'Fabricación de productos metálicos', 'Maquinaria y equipo', 'Equipo de computación', 'Aparatos eléctricos', 'Equipo de transporte', 'Bebidas y tabaco'],
    vocacionesDato: { dato: 'Vocaciones productivas de la declaratoria (DOF).', fuentes: ['dof-huamantla'] },
  };
}

function interiorCoatzacoalcosI(g) {
  const mw = 6.6;
  return {
    nombre: 'Coatzacoalcos I',
    lugar: 'Coatzacoalcos, Veracruz',
    sectores: ['computacion', 'semiconductores', 'transporte', 'dispositivos-medicos', 'farmaceutica', 'alimentos', 'generacion-electrica', 'maquinaria', 'metalicas', 'petroquimica'],
    fuentesLista: ['dof-coatzacoalcos-i', 'osm', 'sict-dos-bocas', 'energia-polos'],
    realNota:
      'El polo real: declarado el 12 de mayo de 2023 (DOF). En lo que el juego consultó no hay obra, licitación ni empresas reportadas; el Corredor Interoceánico reporta en 2026 cinco polos del Istmo concesionados sin decir cuáles. Sus lotes y su acomodo son del juego.',
    frentes: [
      { id: 'vialidades', nombre: 'Vialidades e iluminación', corto: 'Vialidades', parte: 0.4 },
      { id: 'agua', nombre: 'Agua potable y drenaje', corto: 'Agua y drenaje', parte: 0.25 },
      { id: 'energia', nombre: 'Energía eléctrica', corto: 'Energía', parte: 0.25 },
      { id: 'servicios', nombre: 'Centro de servicios', corto: 'Servicios', parte: 0.1 },
    ],
    frentesDato: {
      dato: 'La declaratoria no dice qué obras necesita el polo. El juego usa los mismos frentes que en Huamantla, con las mismas partes del costo: 40 % vialidades e iluminación, 25 % agua y drenaje, 25 % energía, 10 % un centro de servicios (estimación del juego).',
      fuentes: ['juego'],
    },
    espuela: {
      km: g.espuela.km,
      via: g.espuela.via,
      operador: g.espuela.operador,
      mesesMinimos: 2,
      dato: `El polo «se encuentra a 3.1 km de la vía férrea, línea Z, en su tramo Medias Aguas–Coatzacoalcos» (DOF). La espuela del juego va a la ${g.espuela.via} (${g.espuela.operador}) más cercana: ${g.espuela.km.toLocaleString('es-MX')} km en línea recta (OpenStreetMap). Cuesta por km lo que el ramal a Dos Bocas (SICT) y se hace a su paso, con un mínimo de 2 meses: estimación del juego.`,
      fuentes: ['dof-coatzacoalcos-i', 'osm', 'sict-dos-bocas', 'juego'],
    },
    energia: {
      mva: mw,
      fuenteCorta: 'estimación del juego',
      kmLinea: g.conexionElectrica.km,
      dato: `No hay cifra oficial de su energía: el juego le da 0.0257 MW por hectárea, la razón de los cinco polos que sí la tienen (${mw.toLocaleString('es-MX')} MW), y la toma como lo que da su subestación. La línea de alta tensión más cercana queda a ${g.conexionElectrica.km.toLocaleString('es-MX')} km (OpenStreetMap).`,
      fuentes: ['energia-polos', 'osm'],
    },
    lotes: {
      lista: g.lotes.filter((l) => l.tipo === 'empresa').map((l, i) => ({ n: i + 1, ha: l.ha, empresa: null })),
      dato: 'La declaratoria dice que el 76.46 % del terreno tiene uso de suelo industrial: 197 ha. El juego las parte en 12 lotes de 8 a 30 ha y les da 3 ha a los servicios, a la entrada sobre la MEX-180; lo demás es área común y reserva (estimación del juego). No hay lotes ni empresas publicados.',
      fuentes: ['dof-coatzacoalcos-i', 'juego'],
    },
    vocaciones: [
      'Eléctrica y electrónica',
      'Semiconductores',
      'Automotriz (electromovilidad), autopartes y equipo de transporte',
      'Dispositivos médicos',
      'Farmacéutica',
      'Agroindustria',
      'Equipo de generación y distribución de energía eléctrica (energías limpias)',
      'Maquinaria y equipo',
      'Tecnologías de la Información y la Comunicación',
      'Metales',
      'Petroquímica',
    ],
    vocacionesDato: {
      dato: 'Vocaciones productivas de la declaratoria (DOF). Tecnologías de la información no es manufactura: el juego no la ofrece para un lote.',
      fuentes: ['dof-coatzacoalcos-i'],
    },
  };
}

const POLOS_INTERIOR = [
  [HUAMANTLA, interiorHuamantla],
  [COATZACOALCOS_I, interiorCoatzacoalcosI],
];
await mkdir(join(ROOT, 'static', 'data', 'polos'), { recursive: true });
const polos = {};
for (const [p, interior] of POLOS_INTERIOR) {
  const g = await construir(p);
  await writeFile(join(ROOT, 'static', 'data', 'polos', `${p.id}.json`), JSON.stringify(g) + '\n');
  polos[p.id] = interior(g);
}
await writeFile(
  join(ROOT, 'src', 'lib', 'domain', 'datos', 'interiores.json'),
  JSON.stringify({ corte: '2026-11-22', nota: 'Generado por scripts/polos/gen-interior.mjs.', fuentes: FUENTES, polos }, null, 1) + '\n'
);
