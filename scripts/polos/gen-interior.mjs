// Builds the inside of a Polo del Bienestar for its close-up view: the land as the DOF declares
// it, what's around it (OpenStreetMap), and a layout of its lots, road, rail spur and power
// connection.
//
//   node scripts/polos/gen-interior.mjs
//
// Huamantla, Coatzacoalcos I, Texistepec and Altamira. Writes:
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
const ENERGIA = JSON.parse(await readFile(join(ROOT, 'src', 'lib', 'domain', 'datos', 'energia.json'), 'utf8'));

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

function dentroDe([x, y], anillo) {
  let dentro = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i];
    const [xj, yj] = anillo[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

/**
 * A ring from a construction table's named vertices (`p.nombres`). An item ['arco', from, to,
 * centre] is the table's curve between two vertices around the centre it gives (`p.centros`),
 * the short way round, drawn every 2°.
 */
function anilloDe(p, secuencia) {
  const out = [];
  for (const s of secuencia) {
    if (!Array.isArray(s)) {
      if (!p.nombres[s]) throw new Error(`${p.id}: no hay vértice ${s}`);
      out.push(p.nombres[s]);
      continue;
    }
    const [, de, a, c] = s;
    const [cx, cy] = p.centros[c];
    const [pa, pb] = [p.nombres[de], p.nombres[a]];
    const radio = (Math.hypot(pa[0] - cx, pa[1] - cy) + Math.hypot(pb[0] - cx, pb[1] - cy)) / 2;
    const t0 = Math.atan2(pa[1] - cy, pa[0] - cx);
    let d = Math.atan2(pb[1] - cy, pb[0] - cx) - t0;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    const n = Math.max(2, Math.ceil(Math.abs(d) / (Math.PI / 90)));
    for (let k = 1; k < n; k++) out.push([cx + radio * Math.cos(t0 + (d * k) / n), cy + radio * Math.sin(t0 + (d * k) / n)]);
  }
  return out;
}

/** The polo's land as pieces (a ring of UTM vertices each, with its lots), however its config gives it. */
function piezasDe(p) {
  if (p.vertices) return [{ nombre: null, vertices: p.vertices, lotes: p.lotes, servicios: true }];
  return p.piezas.map((q) => ({ ...q, vertices: q.vertices ?? anilloDe(p, q.anillo) }));
}

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

/**
 * Texistepec, from its declaratoria (DOF, 12 May 2023): a general polygon in UTM zone 15 (484.94
 * ha) minus the rights of way of the toll highway 145D (8.54 ha) and of the line Z (14.00 ha),
 * which cross it, leaving 462.39 ha in three pieces. The tables give every side's bearing and
 * length and every curve's centre and radius, and they show one typo: the line Z's vertex 10A is
 * written 1´982,986.5187 north, but the side from vertex 10 («S 16°32'50.56" W, 3.1184 m») ends
 * at 1,981,986.52, a wrong digit. With it and the curves, the pieces add up to 462.3944 ha
 * against the 462.3909 declared.
 */
const TEXISTEPEC = {
  id: 'texistepec',
  zona: 15,
  /** The vertices of the four tables, by the name the DOF gives them (east, north). */
  nombres: {
    1: [307646.457, 1982863.625], 2: [307568.466, 1982556.226], '2A': [307565.1523, 1982545.2905], 'C.TEX.1': [307575.7551, 1982514.651],
    'C.TEX.2': [307710.878, 1982224.203], 'C.TEX.3': [307729.7454, 1982102.917], 'C.TEX.4': [307728.501, 1982089.368], '7C': [307726.5351, 1982065.2332],
    '8B': [307723.6868, 1982040.0588], 9: [307709.324, 1982034.985], 10: [307709.279, 1981989.508], 11: [307697.325, 1981949.275],
    12: [307673.937, 1981864.997], 13: [307663.44, 1981806.2], 14: [307683.16, 1981720.928], 15: [308016.806, 1981806.941],
    16: [308043.61, 1981808.738], 17: [308102.834, 1981807.155], 18: [308553.617, 1981915.235], 19: [308769.343, 1981913.523],
    20: [308869.06, 1981921.588], 21: [309263.055, 1981925.097], 22: [309310.386, 1982159.265], 23: [310607.99, 1981956.717],
    24: [310719.764, 1982478.47], 25: [310734.43, 1982699.812], 26: [310708.618, 1982937.497], 27: [310767.567, 1982999.389],
    28: [311174.871, 1983336.743], 29: [311349.872, 1983485.512], 30: [311355.636, 1983828.797], 31: [311629.562, 1983888.1],
    32: [311628.092, 1984207.128], 33: [311627.216, 1984225.96], 34: [311378.288, 1984331.931], 35: [311362.669, 1984082.419],
    36: [311259.984, 1984083.09], 37: [311185.768, 1984114.813], 38: [311060.231, 1984123.206], 39: [310923.768, 1984353.371],
    '40A': [310781.8266, 1984532.7721], '41A': [310745.401, 1984450.831], '42A': [310578.534, 1984217.526], '44A': [309371.3269, 1983049.052],
    44: [309345.166, 1983050.06], 45: [309285.306, 1982992.177], 46: [309134.077, 1982995.387], 47: [308752.19, 1983008.185],
    48: [308498.999, 1983013.55], 49: [308431.665, 1983010.994], 50: [308237.031, 1982991.911], 51: [307900.31, 1982925.637],
    52: [307869.067, 1982828.464],
    '45A': [309311.5258, 1982991.1699], CRR1: [309543.2389, 1982982.27], CRR2: [309808.8519, 1982972.0681], '26A': [310763.7838, 1982995.4165],
    FC3: [309213.4926, 1982993.7013], FC4: [308226.055, 1982037.948], FC5: [307769.811, 1982024.993],
    '10A': [307708.3908, 1981986.5187], FC1: [307722.8292, 1981973.1017], FC2: [308275.9058, 1981988.8062],
  },
  /**
   * The curves' centres. The line Z's two edges turn around the same one (CT2): 329.82 m to the
   * inner, 399.82 m to the outer; the DOF's row for the outer curve says 477.819 m and 13°20',
   * which its own vertices and centre don't fit.
   */
  centros: { "2A'": [307848.216, 1982626.091], "2B'": [307502.295, 1982129.645], "7C'": [307205.437, 1982119.827], "41A'": [309953.0187, 1984841.2408], CT2: [307991.1745, 1982269.4885] },
  piezas: [
    {
      nombre: 'Predio al sur de la autopista',
      servicios: true,
      anillo: ['10A', 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 'CRR2', 'CRR1', '45A', 'FC2', ['arco', 'FC2', 'FC1', 'CT2'], 'FC1'],
      lotes: [
        { ha: 30, lado: 'a' }, { ha: 22, lado: 'a' }, { ha: 16, lado: 'a' }, { ha: 12, lado: 'a' },
        { ha: 25, lado: 'b' }, { ha: 20, lado: 'b' }, { ha: 14, lado: 'b' }, { ha: 8, lado: 'b' },
      ],
    },
    {
      nombre: 'Predio al norte de la autopista',
      anillo: ['26A', 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, '40A', '41A', ['arco', '41A', '42A', "41A'"], '42A', '44A'],
      lotes: [{ ha: 30, lado: 'a' }, { ha: 20, lado: 'a' }, { ha: 15, lado: 'a' }, { ha: 28, lado: 'b' }, { ha: 20, lado: 'b' }, { ha: 15, lado: 'b' }],
    },
    {
      nombre: 'Predio al oeste de la vía',
      anillo: ['FC3', 46, 47, 48, 49, 50, 51, 52, 1, 2, '2A', ['arco', '2A', 'C.TEX.1', "2A'"], 'C.TEX.1', 'C.TEX.2', ['arco', 'C.TEX.2', 'C.TEX.3', "2B'"], 'C.TEX.3', 'C.TEX.4', ['arco', 'C.TEX.4', '7C', "7C'"], '7C', 'FC5', ['arco', 'FC5', 'FC4', 'CT2'], 'FC4'],
      lotes: [{ ha: 25, lado: 'a' }, { ha: 15, lado: 'a' }, { ha: 20, lado: 'b' }, { ha: 18, lado: 'b' }],
    },
  ],
  franjas: [
    { nombre: 'Derecho de vía de la autopista 145D', tipo: 'carretera', ha: 8.5418, nota: 'Se excluye del polo (DOF)', anillo: [45, '45A', 'CRR1', 'CRR2', 26, '26A', '44A', 44] },
    {
      nombre: 'Derecho de vía de la línea Z',
      tipo: 'via',
      ha: 14.0036,
      nota: 'Se excluye del polo (DOF)',
      anillo: ['45A', 45, 'FC3', 'FC4', ['arco', 'FC4', 'FC5', 'CT2'], 'FC5', '7C', '8B', 9, 10, '10A', 'FC1', ['arco', 'FC1', 'FC2', 'CT2'], 'FC2'],
    },
  ],
  comprobar: [
    {
      nombre: 'Poligonal general',
      ha: 484.9363,
      anillo: [1, 2, '2A', ['arco', '2A', 'C.TEX.1', "2A'"], 'C.TEX.1', 'C.TEX.2', ['arco', 'C.TEX.2', 'C.TEX.3', "2B'"], 'C.TEX.3', 'C.TEX.4', ['arco', 'C.TEX.4', '7C', "7C'"], '7C', '8B', 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, '40A', '41A', ['arco', '41A', '42A', "41A'"], '42A', '44A', 44, 45, 46, 47, 48, 49, 50, 51, 52],
    },
  ],
  areaDof: 4623909.499,
  control: null,
  marcador: { lat: 17.9256, lon: -94.797 },
  /**
   * No lots are published. The game gives them about the share Coatzacoalcos I's declaratoria
   * zones industrial (76.46 %): 353 ha in 18 lots of 8 to 30 ha (an estimate).
   */
  serviciosHa: 4,
  anchoVialidad: 30,
  anchoAcceso: 16,
  carretera: /145/,
};

/**
 * Altamira, from its declaratoria (DOF, 21 Oct 2025): three polygons in UTM zone 14 (GOB 3,
 * GOB 2 and PRODET), 1,637.78 ha, and the easement of a gas pipeline that crosses GOB 3. The
 * text says the easement is subtracted, but the summary of areas doesn't: 955.16 + 644.88 +
 * 37.74 is the 1,637.78 declared. The game draws the easement and puts no lot on it.
 */
const ALTAMIRA = {
  id: 'altamira',
  zona: 14,
  piezas: [
    {
      nombre: 'GOB 3',
      servicios: true,
      vertices: [
        [615693.6679, 2488486.7341], [615484.465, 2489796.2728], [615719.5159, 2490114.1912], [615569.0375, 2491120.087],
        [615288.1466, 2491326.7988], [615140.5932, 2492703.1761], [615412.3799, 2493045.2446], [615221.9422, 2494859.6495],
        [614939.2705, 2494829.0437], [614892.8577, 2495271.2436], [616092.801, 2495259.5753], [616665.2288, 2493818.8385],
        [616823.0179, 2493752.7622], [617006.3345, 2488511.5205],
      ],
      lotes: [
        { ha: 80, lado: 'a' }, { ha: 60, lado: 'a' }, { ha: 50, lado: 'a' }, { ha: 50, lado: 'a' }, { ha: 40, lado: 'a' }, { ha: 40, lado: 'a' }, { ha: 30, lado: 'a' },
        { ha: 80, lado: 'b' }, { ha: 60, lado: 'b' }, { ha: 50, lado: 'b' }, { ha: 50, lado: 'b' }, { ha: 40, lado: 'b' }, { ha: 40, lado: 'b' }, { ha: 30, lado: 'b' },
      ],
    },
    {
      nombre: 'PRODET',
      vertices: [[615726.6371, 2488397.3402], [616622.2341, 2488414.2538], [616626.0215, 2488004.2513], [615705.9078, 2487986.8713], [615702.0423, 2488405.3234]],
      lotes: [{ ha: 14, lado: 'a' }, { ha: 14, lado: 'b' }],
    },
    {
      nombre: 'GOB 2',
      vertices: [
        [617067.8401, 2486004.0001], [617107.0488, 2485763.119], [618036.8101, 2480051.2537], [618590.1128, 2477568.6717],
        [617644.9007, 2477730.4945], [617656.317, 2479129.6397], [617487.3703, 2479148.5319], [617232.7742, 2480580.8092],
        [616208.0815, 2485983.6335],
      ],
      lotes: [
        { ha: 60, lado: 'a' }, { ha: 50, lado: 'a' }, { ha: 40, lado: 'a' }, { ha: 40, lado: 'a' }, { ha: 30, lado: 'a' }, { ha: 25, lado: 'a' },
        { ha: 60, lado: 'b' }, { ha: 50, lado: 'b' }, { ha: 40, lado: 'b' }, { ha: 40, lado: 'b' }, { ha: 30, lado: 'b' }, { ha: 25, lado: 'b' },
      ],
    },
  ],
  franjas: [
    {
      nombre: 'Servidumbre de paso de la interconexión al gasoducto Texas–Tuxpan',
      tipo: 'ducto',
      ha: 2.3420521,
      nota: 'Cruza GOB 3: el juego no pone lotes en ella',
      cruza: 'GOB 3',
      vertices: [
        [616508.052, 2494223.576], [615998.608, 2493831.008], [615815.401, 2493691.86], [615784.198, 2493673.87], [615756.54, 2493652.557],
        [615746.67, 2493647.682], [615647.986, 2493621.329], [615637.025, 2493620.696], [615568.012, 2493630.817], [615557.152, 2493633.978],
        [615476.914, 2493669.901], [615468.01, 2493676.322], [615352.204, 2493802.566], [615343.651, 2493811.311], [615347.719, 2493771.952],
        [615452.971, 2493657.213], [615463.534, 2493649.596], [615549.745, 2493610.999], [615561.928, 2493607.452], [615637.407, 2493596.383],
        [615650.405, 2493597.134], [615756.532, 2493625.474], [615768.181, 2493631.228], [615798.847, 2493654.859], [615824.195, 2493680.447],
        [616005.441, 2493822.139], [616512.347, 2494212.751],
      ],
    },
  ],
  areaDof: 16377799.12,
  control: null,
  marcador: { lat: 22.5292, lon: -97.8711 },
  serviciosHa: 6,
  anchoVialidad: 30,
  anchoAcceso: 16,
  /** No federal highway in OpenStreetMap near it: the state trunks to the port, Boulevard de los Ríos and Libramiento Colosio. */
  carretera: /113|143/,
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
      // The main server, then two mirrors, in turns: any of them can be overloaded for a while.
      const servidores = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
      for (let intento = 1; intento <= 9 && !ok; intento++) {
        const servidor = servidores[(intento - 1) % servidores.length];
        try {
          const res = await fetch(servidor, {
            method: 'POST',
            headers: { 'User-Agent': 'ruta-logistica-juego', 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'data=' + encodeURIComponent(`[out:json][timeout:80];(${q});out geom;`),
            signal: AbortSignal.timeout(100000),
          });
          const texto = res.ok ? await res.text() : '';
          if (res.ok && texto.trimStart().startsWith('{')) {
            await writeFile(file, texto);
            ok = true;
          } else console.log(`Overpass ${k} (${new URL(servidor).host}): HTTP ${res.status}, intento ${intento}`);
        } catch (e) {
          console.log(`Overpass ${k} (${new URL(servidor).host}): ${e.name}, intento ${intento}`);
        }
        if (!ok) await new Promise((r) => setTimeout(r, 4000 * intento));
      }
      if (!ok) throw new Error(`Overpass no respondió para ${k}`);
    }
    out[k] = JSON.parse(await readFile(file, 'utf8')).elements;
  }
  return out;
}

// ---- build -----------------------------------------------------------------------------------

async function construir(p) {
  // The land, in metres around the mean of its vertices (UTM grid: north is the grid's, a fraction of a degree off true north).
  const piezas = piezasDe(p);
  const franjas = (p.franjas ?? []).map((f) => ({ ...f, vertices: f.vertices ?? anilloDe(p, f.anillo) }));
  const todos = piezas.flatMap((q) => q.vertices);
  const cx = todos.reduce((s, q) => s + q[0], 0) / todos.length;
  const cy = todos.reduce((s, q) => s + q[1], 0) / todos.length;
  const aLocal = ([x, y]) => [x - cx, y - cy];
  for (const q of [...piezas, ...franjas]) q.local = q.vertices.map(aLocal);
  const [lon0, lat0] = deUtm(cx, cy, p.zona);
  const a = piezas.reduce((s, q) => s + area(q.local), 0);
  const per = piezas.reduce((s, q) => s + perimetro(q.local), 0);
  if (p.control) {
    const v0 = piezas[0].vertices[0];
    const [clon, clat] = deUtm(v0[0], v0[1], p.zona);
    const errorControl = Math.hypot((clon - p.control.lon) * 104900, (clat - p.control.lat) * 110600);
    console.log(`${p.id}: área ${a.toFixed(0)} m² (DOF ${p.areaDof}) · perímetro ${per.toFixed(1)} m · vértice 1 a ${errorControl.toFixed(2)} m de sus coordenadas geográficas`);
    if (errorControl > 1) throw new Error('La conversión UTM no cuadra con el vértice de control');
  } else {
    // The game's marker (polos.json) is near the centre, or on the land when it comes in far-apart pieces.
    const d = Math.hypot((lon0 - p.marcador.lon) * 105700, (lat0 - p.marcador.lat) * 110600);
    const enTerreno = piezas.some((q) => dentroDe(aLocal(aUtm(p.marcador.lon, p.marcador.lat, p.zona)), q.local));
    console.log(`${p.id}: área ${a.toFixed(0)} m² (DOF ${p.areaDof}) · perímetro ${per.toFixed(1)} m · centro a ${d.toFixed(0)} m del marcador${enTerreno ? ', que cae en el terreno' : ''}`);
    if (d > 300 && !enTerreno) throw new Error('El polígono no cae donde el marcador del polo');
  }
  if (Math.abs(a - p.areaDof) / p.areaDof > 0.005) throw new Error('El área no cuadra con la del DOF');
  // The other tables of the declaratoria (a general polygon, rights of way): each against its own area.
  for (const c of [...(p.comprobar ?? []).map((c) => ({ ...c, local: anilloDe(p, c.anillo) })), ...franjas.filter((f) => f.ha)]) {
    const ha = area(c.local) / 1e4;
    console.log(`  ${c.nombre}: ${ha.toFixed(4)} ha (DOF ${c.ha})`);
    if (Math.abs(ha - c.ha) / c.ha > 0.005) throw new Error(`${c.nombre}: el área no cuadra con la del DOF`);
  }
  if (piezas.length > 1) console.log(`  piezas: ${piezas.map((q) => `${q.nombre} ${(area(q.local) / 1e4).toFixed(2)} ha`).join(' · ')}`);

  // The view and the OpenStreetMap boxes, when the config doesn't give them: the land's extent with room around.
  const xs = piezas.flatMap((q) => q.local.map((z) => z[0]));
  const ys = piezas.flatMap((q) => q.local.map((z) => z[1]));
  const [ex0, ex1, ey0, ey1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const margen = p.margen ?? 1500;
  const cien = (n) => Math.round(n / 100) * 100;
  p.caja ??= { x0: cien(ex0 - margen), x1: cien(ex1 + margen), y0: cien(ey0 - margen), y1: cien(ey1 + margen) };
  const cajaGeo = (m) => {
    const esquinas = [[ex0 - m, ey0 - m], [ex1 + m, ey0 - m], [ex0 - m, ey1 + m], [ex1 + m, ey1 + m]].map(([x, y]) => deUtm(x + cx, y + cy, p.zona));
    const lons = esquinas.map((e) => e[0]);
    const lats = esquinas.map((e) => e[1]);
    return [Math.min(...lats), Math.min(...lons), Math.max(...lats), Math.max(...lons)].map((n) => n.toFixed(4)).join(',');
  };
  p.cerca ??= cajaGeo(margen + 300);
  p.lejos ??= cajaGeo(margen + 3000);

  const local = (lon, lat) => { const [x, y] = aUtm(lon, lat, p.zona); return [x - cx, y - cy]; };
  const { x0, x1, y0, y1 } = p.caja;
  /** Inside the view's box, or `m` metres around it. */
  const dentro = ([x, y], m = 0) => x >= x0 - m && x <= x1 + m && y >= y0 - m && y <= y1 + m;
  /** A way as polylines inside the box (cut where it leaves), simplified. */
  const trazos = (geom, tol = 1.5, m = 0) => {
    const partes = [];
    let actual = [];
    for (const g of geom) {
      const q = local(g.lon, g.lat);
      if (dentro(q, m)) actual.push(q);
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
      // Up to 6 km past the box: the nearest line can be farther than the box (Texistepec's is).
      for (const puntos of trazos(e.geometry, 3, 6000)) lineas.push({ kv: t.voltage ?? '', puntos });
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

  // ---- the layout: in each piece a main road down its long axis, lots on both sides -------------

  const carretera = caminos.filter((c) => c.ref && p.carretera.test(c.ref));
  const puntosCarretera = carretera.flatMap((c) => c.puntos);
  const lotes = [];
  const vialidades = [];
  const ejes = [];
  let servicios = null;
  // The piece with the services goes first: the roads are built in this order.
  for (const pieza of [...piezas].sort((x, y) => Number(!!y.servicios) - Number(!!x.servicios))) {
    // Only a strip that crosses the piece is in the way of its lots (Texistepec's are already outside the land).
    const t = trazar(p, pieza, puntosCarretera, franjas.filter((f) => f.cruza === pieza.nombre).map((f) => f.local));
    lotes.push(...t.lotes);
    vialidades.push(t.vialidad);
    ejes.push(t.eje);
    if (t.servicios) servicios = t.servicios;
  }
  const { subestacion } = servicios;

  // The rail spur: from the nearest main track to the nearest piece.
  const principales = vias.filter((x) => x.estado === 'rail' && !['siding', 'yard', 'spur'].includes(x.servicio ?? '') && x.nombre);
  let espuela = null;
  for (const pieza of piezas)
    for (const via of principales) {
      const m = masCercanos(pieza.local, via.puntos, true);
      if (!espuela || m.d < espuela.d) espuela = { ...m, via };
    }
  // The power connection: from the substation to the nearest high-voltage line.
  let conexion = null;
  for (const l of lineas) {
    const m = masCercanos([subestacion, subestacion], l.puntos);
    if (!conexion || m.d < conexion.d) conexion = { ...m, linea: l };
  }
  // The view reaches the line the polo connects to.
  const [lx, ly] = conexion.pb;
  p.caja = { x0: Math.min(x0, cien(lx - 400)), x1: Math.max(x1, cien(lx + 400)), y0: Math.min(y0, cien(ly - 400)), y1: Math.max(y1, cien(ly + 400)) };

  const anillo1 =(q) => q.map(([x, y]) => [r1(x), r1(y)]);
  const geometria = {
    id: p.id,
    nota: 'Generado por scripts/polos/gen-interior.mjs. Metros alrededor del centro del polo (cuadrícula UTM zona ' + p.zona + ').',
    centro: { lon: Number(lon0.toFixed(6)), lat: Number(lat0.toFixed(6)) },
    caja: p.caja,
    /** The land: one ring per piece of the declaratoria. */
    piezas: piezas.map((q) => ({ nombre: q.nombre, ha: Number((area(q.local) / 1e4).toFixed(2)), puntos: anillo1(q.local) })),
    /** Rights of way the declaratoria leaves out of the land, or crossing it. */
    franjas: franjas.map((f) => ({ nombre: f.nombre, tipo: f.tipo, ha: Number((area(f.local) / 1e4).toFixed(2)), nota: f.nota, puntos: anillo1(f.local) })),
    areaM2: Math.round(a),
    perimetroM: Math.round(per),
    lotes,
    vialidades,
    ejes,
    servicios,
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
  console.log(`vialidades: ${(vialidades.reduce((s, v) => s + area(v), 0) / 1e4).toFixed(1)} ha · lotes: ${lotes.map((l) => `${l.empresa ?? l.tipo} ${(area(l.puntos) / 1e4).toFixed(2)}`).join(', ')}`);
  console.log(`espuela a la ${geometria.espuela.via} (${geometria.espuela.operador}): ${geometria.espuela.km} km · conexión a la línea de ${conexion.linea.kv} V: ${geometria.conexionElectrica.km} km`);
  console.log(`caminos ${caminos.length}, vías ${vias.length}, líneas ${lineas.length}, subestaciones ${subestaciones.length}, lugares ${lugares.length}`);
  return geometria;
}

/**
 * One piece's layout: a main road down its long axis, from the end nearest the federal highway,
 * and its lots on both sides in the order given, each from the road to the boundary. The piece
 * with the services has their lot first, by the entrance, with the substation, the water tank
 * and the services centre. No lot goes where a strip crosses (a pipeline's right of way): the
 * lot that doesn't fit before it goes past it.
 */
function trazar(p, pieza, puntosCarretera, franjas) {
  const poligono = pieza.local;
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
  // Axis coordinates around the piece's own centre: u along the axis, w across it.
  const aUV = ([x, y]) => [(x - mx) * Math.cos(th) + (y - my) * Math.sin(th), -(x - mx) * Math.sin(th) + (y - my) * Math.cos(th)];
  const deUV = ([u, w]) => [mx + u * Math.cos(th) - w * Math.sin(th), my + u * Math.sin(th) + w * Math.cos(th)];

  // The entrance: the end of the axis nearest the federal highway.
  let P = poligono.map(aUV);
  const extremo = (lado) => { const us = P.map((q) => q[0]); return lado < 0 ? Math.min(...us) : Math.max(...us); };
  const distA = (u) => Math.min(...puntosCarretera.map((q) => Math.hypot(...deUV([u, 0]).map((z, i) => z - q[i]))));
  if (distA(extremo(1)) < distA(extremo(-1))) { th += Math.PI; P = poligono.map(aUV); }
  const F = franjas.map((f) => f.map(aUV));
  const umin = Math.min(...P.map((q) => q[0])) - 1;
  const umax = Math.max(...P.map((q) => q[0])) + 1;
  const vmin = Math.min(...P.map((q) => q[1])) - 1;
  const vmax = Math.max(...P.map((q) => q[1])) + 1;
  const W = p.anchoVialidad / 2;
  const serviciosHa = pieza.servicios ? p.serviciosHa : 0;

  const haNecesita = (lado) => pieza.lotes.filter((l) => l.lado === lado).reduce((s, l) => s + l.ha, 0) + (lado === 'b' ? serviciosHa : 0);
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
    const propios = pieza.lotes.filter((l) => l.lado === lado);
    const cola = lado === 'b' ? [...(pieza.servicios ? [{ servicios: true, ha: serviciosHa }] : []), ...propios] : propios.reverse();
    // The stretches of this side a strip crosses, with room for an access lane on each side of it.
    const cortes = F.map((f) => caja(f, umin, umax, w0, w1))
      .filter((q) => q.length > 2 && area(q) > 1)
      .map((q) => [Math.min(...q.map((z) => z[0])) - p.anchoAcceso, Math.max(...q.map((z) => z[0])) + p.anchoAcceso])
      .sort((x, y) => x[0] - y[0]);
    let u0 = umin;
    for (const l of cola) {
      const meta = l.ha * 1e4;
      for (const [c0, c1] of cortes) {
        if (c1 <= u0) continue;
        if (c0 <= u0 || area(caja(P, u0, c0, w0, w1)) < meta) u0 = c1;
        else break;
      }
      const u1 = biseccion((u) => area(caja(P, u0, u, w0, w1)), meta, u0, umax);
      const forma = caja(P, u0, u1, w0, w1);
      if (area(forma) < meta * 0.97) console.log(`  ⚠ ${pieza.nombre ?? p.id}: el lote de ${l.ha} ha no cabe (queda de ${(area(forma) / 1e4).toFixed(2)} ha)`);
      lotes.push({
        tipo: l.servicios ? 'servicios' : 'empresa',
        ...(l.empresa ? { empresa: l.empresa } : {}),
        ha: l.ha,
        puntos: forma.map(deUV).map(([x, y]) => [r1(x), r1(y)]),
      });
      u0 = u1 + p.anchoAcceso;
    }
    const resto = caja(P, u0, umax, w0, w1);
    const haResto = (area(resto) - F.reduce((t, f) => t + area(caja(f, u0, umax, w0, w1)), 0)) / 1e4;
    if (haResto > 0.05) lotes.push({ tipo: 'reserva', ha: r1(haResto * 10) / 10, puntos: resto.map(deUV).map(([x, y]) => [r1(x), r1(y)]) });
  }
  const calle = caja(P, umin, umax, s - W, s + W);
  const vialidad = calle.map(deUV).map(([x, y]) => [r1(x), r1(y)]);
  const uIn = Math.min(...calle.map((q) => q[0]));
  const uOut = Math.max(...calle.map((q) => q[0]));
  const eje = [deUV([uIn, s]), deUV([uOut, s])].map(([x, y]) => [r1(x), r1(y)]);
  if (!pieza.servicios) return { lotes, vialidad, eje, servicios: null };

  // Where the services lot is, the substation and the water tank go (its corner by the road).
  const servUV = lotes.find((l) => l.tipo === 'servicios').puntos.map(aUV);
  const cerca = (u, w) => deUV([u, w]).map(r1);
  const su = Math.max(...servUV.map((q) => q[0]));
  return {
    lotes,
    vialidad,
    eje,
    servicios: {
      centro: cerca((Math.min(...servUV.map((q) => q[0])) + su) / 2 - 20, s - W - 45),
      subestacion: cerca(su - 25, s - W - 22),
      tanque: cerca(su - 60, s - W - 22),
    },
  };
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
    fuente: 'Estimación del juego con las declaratorias y el portal de Economía: un polo sin cifra oficial de energía usa la mediana de los siete que sí la tienen, 8 MW (ver La energía)',
    url: '',
  },
  'sict-dos-bocas': { fuente: 'SICT: costo del ramal ferroviario a Dos Bocas, base del costo por km de la espuela (ver la sección de obras del Estado)', url: 'https://www.gob.mx/sct/prensa/precisa-sict-que-ramal-ferroviario-roberto-ayala-dos-bocas-tiene-un-costo-estimado-de-6-mil-54-mdp' },
  'cfe-cartera-2024': {
    fuente: 'CFE, Programas y Proyectos de Inversión 2024 (cierre de diciembre): cada proyecto con su descripción, sus MVA y km-c, sus fechas y su costo total, entre ellos los de subestaciones de distribución y las subestaciones Kantenah y Leona Vicario',
    url: 'https://portales-transparencia.cfe.mx/corporativo/31%20Informe%20presupuestl%20balance%20general%20y%20estado%20fi/Direcci%C3%B3n%20Corporativa%20de%20Finanzas/Gerencia%20de%20Presupuestos/2024/Cartera%20de%20CFE%20pre%20cierre%20DIC%2010012025%204o%20trim.pdf',
  },
  'presidencia-istmo-2025': {
    fuente: 'Presidencia, versión estenográfica de la conferencia del 19 de febrero de 2025: los polos de Coatzacoalcos I, Coatzacoalcos II y Salina Cruz, «licitados y concesionados a la empresa Desarrolladora Multimodal del Istmo», con 90 % de avance en sus estudios; los de Texistepec, San Juan Evangelista, Matías Romero y Santa María Mixtequilla, «concesionados a empresas nacionales que se llaman Proistmo y Profharmax»',
    url: 'https://www.gob.mx/presidencia/es/articulos/version-estenografica-conferencia-de-prensa-de-la-presidenta-claudia-sheinbaum-pardo-del-19-de-febrero-de-2025?idiom=es',
  },
  'piciit-2026': {
    fuente: 'CIIT, Informe anual de avance y resultados del PICIIT 2025–2026: cinco polos del Istmo concesionados, tras tres concesionarios que incumplieron y uno que renunció (no dice cuáles)',
    url: 'https://www.gob.mx/cms/uploads/attachment/file/1100578/Informe_anual_de_avance_y_resultados_PICIIT_2025_2026.pdf',
  },
  'dof-texistepec': {
    fuente: 'DOF, Acuerdo por el que se emite la declaratoria del Polo de Desarrollo para el Bienestar Texistepec (12 de mayo de 2023): cuadros de construcción de la poligonal general (484.94 ha) y de los derechos de vía de la carretera federal 145D (8.54 ha) y de la línea Z (14.00 ha), que se excluyen; 462.39 ha en Texistepec y Jáltipan; aledaño a la línea Z, con frente a la MEX-145D, a 37 km del puerto de Coatzacoalcos; sus vocaciones productivas y su propiedad (el Corredor Interoceánico la compró)',
    url: 'https://dof.gob.mx/nota_detalle.php?codigo=5688613&fecha=12/05/2023',
  },
  'dof-fallo-texistepec': {
    fuente: 'DOF, 28 de noviembre de 2023: aviso del fallo de la licitación del polo Texistepec (17 de noviembre), ganada por el consorcio de Profharmax y Transportadora Comexsa',
    url: 'https://dof.gob.mx/nota_detalle.php?codigo=5709825&fecha=28/11/2023',
  },
  'ciit-texistepec-predio': {
    fuente: 'CIIT, comunicado 013 del 28 de diciembre de 2020: se concreta la compra del predio del polo Texistepec',
    url: 'https://www.gob.mx/ciit/prensa/se-concreta-la-adquisicion-del-predio-destinado-al-polo-de-desarrollo-para-el-bienestar-en-texistepec-veracruz?idiom=es',
  },
  'dof-altamira': {
    fuente: 'DOF, Acuerdo por el que se emite la declaratoria del Polo de Desarrollo Económico para el Bienestar Altamira, Tamaulipas (21 de octubre de 2025): cuadros de construcción de los polígonos GOB 3, GOB 2 y PRODET y de la servidumbre de paso de la interconexión al gasoducto Texas–Tuxpan (UTM 14), 1,637.78 ha; a 7 km de la carretera federal 80, junto al puerto de Altamira (13.5 m de calado), con Ferromex y CPKC; uso de suelo industrial, sus servicios, sus vocaciones productivas y su propiedad (el Gobierno de Tamaulipas)',
    url: 'https://dof.gob.mx/nota_detalle.php?codigo=5770448&fecha=21/10/2025',
  },
  'altamira-convenio': {
    fuente: 'Gobierno municipal de Altamira, 6 de marzo de 2026: el polo está en su fase de formalización (las siguientes son la de desarrollo y la de inversión productiva) tras el convenio del 18 de febrero de 2026 entre el Gobierno de Tamaulipas y el federal, que dará paso a su fideicomiso; el predio, de 1,638 ha, es del Gobierno del estado, en el puerto de Altamira',
    url: 'https://altamira.gob.mx/2427/2026/03/06/consolidan-estrategia-del-plan-mexico-para-atraer-inversion-a-altamira/',
  },
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
  const mw = ENERGIA.polos['coatzacoalcos-i'].mw;
  return {
    nombre: 'Coatzacoalcos I',
    lugar: 'Coatzacoalcos, Veracruz',
    sectores: ['computacion', 'semiconductores', 'transporte', 'dispositivos-medicos', 'farmaceutica', 'alimentos', 'generacion-electrica', 'maquinaria', 'metalicas', 'petroquimica'],
    fuentesLista: ['dof-coatzacoalcos-i', 'presidencia-istmo-2025', 'piciit-2026', 'osm', 'sict-dos-bocas', 'energia-polos'],
    realNota:
      'El polo real: declarado el 12 de mayo de 2023 (DOF). La Presidenta dijo el 19 de febrero de 2025 que, junto con Coatzacoalcos II y Salina Cruz, ya estaba licitado y concesionado a Desarrolladora Multimodal del Istmo para distribuir vehículos y autopartes, con 90 % de avance en sus estudios; en 2026 el Corredor Interoceánico reporta solo cinco polos del Istmo concesionados, sin decir cuáles. No se ha reportado obra ni empresas: sus lotes y su acomodo son del juego.',
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
      dato: `No hay cifra oficial de su energía: el juego le da la mediana de los siete polos que sí la tienen, ${mw.toLocaleString('es-MX')} MW, y la toma como lo que da su subestación en su primera fase (estimación del juego). La línea de alta tensión más cercana queda a ${g.conexionElectrica.km.toLocaleString('es-MX')} km (OpenStreetMap).`,
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

/** The fronts every polo without its own list has, with Huamantla's shares of the cost. */
const FRENTES_COMUNES = [
  { id: 'vialidades', nombre: 'Vialidades e iluminación', corto: 'Vialidades', parte: 0.4 },
  { id: 'agua', nombre: 'Agua potable y drenaje', corto: 'Agua y drenaje', parte: 0.25 },
  { id: 'energia', nombre: 'Energía eléctrica', corto: 'Energía', parte: 0.25 },
  { id: 'servicios', nombre: 'Centro de servicios', corto: 'Servicios', parte: 0.1 },
];
const km = (n) => n.toLocaleString('es-MX');
const haLotes = (g) => g.lotes.filter((l) => l.tipo === 'empresa').reduce((s, l) => s + l.ha, 0);
const nLotes = (g) => g.lotes.filter((l) => l.tipo === 'empresa').length;
const listaLotes = (g) => g.lotes.filter((l) => l.tipo === 'empresa').map((l, i) => ({ n: i + 1, ha: l.ha, empresa: l.empresa ?? null }));
/** A polo with no official figure of its energy: the game's median, and how far its line is. */
function energiaSinCifra(id, g, linea) {
  const mw = ENERGIA.polos[id].mw;
  return {
    mva: mw,
    fuenteCorta: 'estimación del juego',
    kmLinea: g.conexionElectrica.km,
    dato: `No hay cifra oficial de su energía: el juego le da la mediana de los siete polos que sí la tienen, ${km(mw)} MW, y la toma como lo que da su subestación en su primera fase (estimación del juego). ${linea}`,
    fuentes: ['energia-polos', 'osm'],
  };
}

function interiorTexistepec(g) {
  return {
    nombre: 'Texistepec',
    lugar: 'Texistepec y Jáltipan, Veracruz',
    sectores: ['computacion', 'semiconductores', 'transporte', 'dispositivos-medicos', 'farmaceutica', 'alimentos', 'generacion-electrica', 'maquinaria', 'metalicas', 'petroquimica'],
    fuentesLista: ['dof-texistepec', 'ciit-texistepec-predio', 'dof-fallo-texistepec', 'presidencia-istmo-2025', 'piciit-2026', 'osm', 'sict-dos-bocas', 'energia-polos'],
    realNota:
      'El polo real: el Corredor Interoceánico compró el predio en diciembre de 2020 y lo declaró el 12 de mayo de 2023 (DOF); su licitación la ganó el consorcio de Profharmax y Transportadora Comexsa (fallo del 17 de noviembre de 2023) y la Presidenta lo dio por concesionado el 19 de febrero de 2025. En 2026 el Corredor reporta solo cinco polos del Istmo concesionados, sin decir cuáles. No se ha reportado obra ni empresas: sus lotes y su acomodo son del juego.',
    frentes: FRENTES_COMUNES,
    frentesDato: {
      dato: 'La declaratoria no dice qué obras necesita el polo. El juego usa los mismos frentes que en Huamantla, con las mismas partes del costo: 40 % vialidades e iluminación, 25 % agua y drenaje, 25 % energía, 10 % un centro de servicios (estimación del juego). Cada uno de sus tres predios lleva su calle; se hacen uno tras otro.',
      fuentes: ['juego'],
    },
    espuela: {
      km: g.espuela.km,
      via: g.espuela.via,
      operador: g.espuela.operador,
      mesesMinimos: 2,
      dato: `La línea Z cruza el polo: la declaratoria excluye su derecho de vía, que pasa entre sus predios. La espuela del juego es el tramo de la ${g.espuela.via} (${g.espuela.operador}) al predio más cercano, ${km(g.espuela.km)} km (OpenStreetMap), con su cambio de vía: cuesta por km lo que el ramal a Dos Bocas (SICT) y tarda por lo menos 2 meses (estimación del juego).`,
      fuentes: ['dof-texistepec', 'osm', 'sict-dos-bocas', 'juego'],
    },
    energia: energiaSinCifra('texistepec', g, `La línea de 115 kV más cercana, la que pasa al norte, queda a ${km(g.conexionElectrica.km)} km de su subestación (OpenStreetMap).`),
    lotes: {
      lista: listaLotes(g),
      dato: `La declaratoria parte el terreno en tres predios: la autopista 145D y la línea Z lo cruzan y sus derechos de vía se excluyen. No hay lotes ni empresas publicados. El juego les da a los lotes la parte del terreno que la declaratoria de Coatzacoalcos I dice de uso industrial (76.46 %): ${km(haLotes(g))} ha en ${nLotes(g)} lotes de 8 a 30 ha, y 4 ha de servicios a la entrada del predio al sur de la autopista; lo demás es área común y reserva (estimación del juego).`,
      fuentes: ['dof-texistepec', 'dof-coatzacoalcos-i', 'juego'],
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
      dato: 'Vocaciones productivas de la declaratoria (DOF), las mismas que las de Coatzacoalcos I. Tecnologías de la información no es manufactura: el juego no la ofrece para un lote.',
      fuentes: ['dof-texistepec'],
    },
  };
}

function interiorAltamira(g) {
  return {
    nombre: 'Altamira',
    lugar: 'Altamira, Tamaulipas',
    sectores: ['transporte', 'quimica', 'farmaceutica', 'petroquimica', 'computacion', 'electricos', 'productos-metalicos', 'maquinaria'],
    fuentesLista: ['dof-altamira', 'altamira-convenio', 'osm', 'sict-dos-bocas', 'energia-polos'],
    realNota:
      'El polo real: declarado el 21 de octubre de 2025 (DOF) en terrenos del Gobierno de Tamaulipas, junto al puerto de Altamira. El 18 de febrero de 2026 el estado y la federación firmaron su convenio; en marzo seguía en su fase de formalización, la primera de tres, rumbo a su fideicomiso (Gobierno municipal de Altamira). No se ha reportado obra ni empresas: sus lotes y su acomodo son del juego.',
    frentes: FRENTES_COMUNES,
    frentesDato: {
      dato: 'La declaratoria dice que el polígono ya «dispone de vialidades, energía eléctrica, agua potable, drenaje y conectividad», las del puerto industrial; para lotes de empresas hace falta llevarlas adentro. El juego usa los mismos frentes que en Huamantla, con las mismas partes del costo: 40 % vialidades e iluminación, 25 % agua y drenaje, 25 % energía, 10 % un centro de servicios (estimación del juego). Cada uno de sus tres polígonos lleva su calle; se hacen uno tras otro.',
      fuentes: ['dof-altamira', 'juego'],
    },
    espuela: {
      km: g.espuela.km,
      via: g.espuela.via,
      operador: g.espuela.operador,
      mesesMinimos: 2,
      dato: `Dos líneas dan servicio al puerto de Altamira, Ferromex y CPKC (DOF). La espuela del juego va de la ${g.espuela.via} (${g.espuela.operador}), la más cercana, a GOB 2: ${km(g.espuela.km)} km en línea recta (OpenStreetMap). Cuesta por km lo que el ramal a Dos Bocas (SICT) y tarda por lo menos 2 meses (estimación del juego).`,
      fuentes: ['dof-altamira', 'osm', 'sict-dos-bocas', 'juego'],
    },
    energia: energiaSinCifra(
      'altamira',
      g,
      `La declaratoria dice que tiene energía eléctrica, con «opciones identificadas para ampliar la disponibilidad de energía en el mediano plazo». La línea de 115 kV más cercana, la de las subestaciones del puerto, queda a ${km(g.conexionElectrica.km)} km de su subestación (OpenStreetMap).`
    ),
    lotes: {
      lista: listaLotes(g),
      dato: `Tres polígonos a lo largo de 18 km de norte a sur: GOB 3 (955 ha), PRODET (38 ha) y GOB 2 (645 ha). La declaratoria da uso de suelo industrial a todo y no publica lotes. El juego les da a los lotes la misma parte que Coatzacoalcos I (76.46 % de uso industrial): ${km(haLotes(g))} ha en ${nLotes(g)} lotes de 14 a 80 ha, del tamaño de las plantas químicas del puerto, y 6 ha de servicios a la entrada de GOB 3; lo demás es área común y reserva (estimación del juego). La servidumbre del gasoducto que cruza GOB 3 queda sin lotes.`,
      fuentes: ['dof-altamira', 'dof-coatzacoalcos-i', 'juego'],
    },
    vocaciones: ['Automotriz', 'Química', 'Farmacéutica', 'Petroquímica', 'Industria eléctrica-electrónica', 'Metalmecánica', 'Manufactura avanzada', 'Logística'],
    vocacionesDato: {
      dato: 'Vocaciones productivas de la declaratoria (DOF). En el juego, química y petroquímica son dos sectores (la petroquímica es la química básica y las resinas; la química, los fertilizantes, pinturas, jabones y lo demás); metalmecánica son los productos metálicos y la maquinaria, y la eléctrica-electrónica, el equipo electrónico y los aparatos eléctricos. Manufactura avanzada no es un sector del censo y logística no es manufactura: el juego no las ofrece para un lote.',
      fuentes: ['dof-altamira'],
    },
  };
}

// ---- enlarging a polo's substation ------------------------------------------------------------

/**
 * Distribution substation projects of the CFE's investment portfolio (Programas y Proyectos de
 * Inversión 2024, cierre de diciembre), finished, with few km of line (under 0.2 km-c per MVA):
 * [project, MVA, km-c, total cost in million pesos]. Their median cost per MVA is what a bank costs.
 */
const CARTERA_SUBESTACIONES = [
  ['0518TOQ0030', 250, 45, 343.33],
  ['0518TOQ0033', 50, 6.3, 272.15],
  ['0518TOQ0034', 60, 0, 93.61],
  ['0718TOQ0037', 160, 11, 414.78],
  ['0818TOQ0073', 160, 21, 438.72],
  ['0818TOQ0074', 342.9, 19, 564.17],
  ['1018TOQ0048', 470, 86.14, 770.42],
  ['1218TOQ0024', 255, 0, 137.95],
  ['1318TOQ0021', 330, 0, 305.48],
];
const porMva = CARTERA_SUBESTACIONES.map(([, mva, , mdp]) => mdp / mva).sort((a, b) => a - b);
const MDP_POR_MVA = Number(porMva[(porMva.length - 1) / 2].toFixed(2));
/** The two new substations of the Riviera Maya (500 MVA each), from start to service, months. */
const MESES_SUBESTACION = Math.round((16.0 + 15.7) / 2);
const MVA_BANCO = 30;

const SUBESTACION = {
  mvaBanco: MVA_BANCO,
  mdpPorMva: MDP_POR_MVA,
  mesesGobierno: MESES_SUBESTACION,
  dato: `Ampliar la subestación de un polo es obra de la CFE, pagada de su caja: un banco de transformación de ${MVA_BANCO} MVA, un tamaño común en las subestaciones de distribución de la CFE (estimación del juego). Cuesta ${MDP_POR_MVA.toLocaleString('es-MX')} millones de pesos por MVA, la mediana de los nueve proyectos de subestaciones de distribución terminados de la cartera de inversión de la CFE (pesos del año de cada proyecto, sin actualizar), y tarda ${MESES_SUBESTACION} meses con 4 cuadrillas: lo que tardaron Kantenah y Leona Vicario, las dos subestaciones nuevas de la Riviera Maya, de abril y mayo de 2024 a agosto de 2025. Cada banco suma ${MVA_BANCO} MVA a lo que el polo da a sus empresas (el juego toma un MVA por MW).`,
  fuentes: ['cfe-cartera-2024', 'juego'],
};

const POLOS_INTERIOR = [
  [HUAMANTLA, interiorHuamantla],
  [COATZACOALCOS_I, interiorCoatzacoalcosI],
  [TEXISTEPEC, interiorTexistepec],
  [ALTAMIRA, interiorAltamira],
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
  JSON.stringify({ corte: '2026-11-23', nota: 'Generado por scripts/polos/gen-interior.mjs.', fuentes: FUENTES, subestacion: SUBESTACION, polos }, null, 1) + '\n'
);
