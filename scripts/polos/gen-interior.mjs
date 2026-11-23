// Builds the inside of a Polo del Bienestar for its close-up view: the land as the DOF declares
// it, what's around it (OpenStreetMap), and a layout of its lots, road, rail spur and power
// connection.
//
//   node scripts/polos/gen-interior.mjs
//
// Huamantla, Coatzacoalcos I, Texistepec, Altamira, Nezahualcóyotl, Reserva Zapotlán, San
// Jerónimo, Parque Industrial Bajío, Hermosillo, Topolobampo, Puerta Logística del Bajío,
// Durango, Salina Cruz, Arriaga, Tapachula I, Tapachula II and Teapa. Writes:
//   static/data/polos/<id>.json            the geometry, in metres around the polo (fetched by the view)
//   src/lib/domain/datos/interiores.json   the works by front and the real facts (read by the game)
//
// OpenStreetMap comes from Overpass, in small queries (the big one gets a 502), cached in
// .cache/osm/<polo>/ so it's downloaded once.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
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

/**
 * The ring of a strip `ancho` metres wide along a road's axis (a polyline), with mitred corners:
 * its area is its width times the axis's length.
 */
function franjaDeEje(eje, ancho) {
  const normal = (a, b) => {
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return [-(b[1] - a[1]) / l, (b[0] - a[0]) / l];
  };
  const borde = (s) =>
    eje.map((q, i) => {
      const n0 = normal(eje[Math.max(0, i - 1)], eje[Math.max(1, i)]);
      const n1 = normal(eje[Math.min(i, eje.length - 2)], eje[Math.min(i + 1, eje.length - 1)]);
      const l = Math.hypot(n0[0] + n1[0], n0[1] + n1[1]);
      const m = [(n0[0] + n1[0]) / l, (n0[1] + n1[1]) / l];
      const k = ancho / 2 / (m[0] * n0[0] + m[1] * n0[1]);
      return [q[0] + s * k * m[0], q[1] + s * k * m[1]];
    });
  return [...borde(1), ...borde(-1).reverse()];
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

/**
 * Nezahualcóyotl, from its declaratoria (DOF, 7 Aug 2025): four cadastral lots of the state (3-B,
 * 3-C, 7-D and 7-E) by the Bordo de Xochiaca, in UTM zone 14 (the DOF doesn't say the zone; the
 * State of Mexico is in it). The 3-B table closes with a row «R100» at 4,999,867.778 east, one 9
 * too many, that repeats R27: it's left out, and the four add up to the 683,683.11 m² declared.
 */
const NEZAHUALCOYOTL = {
  id: 'nezahualcoyotl',
  zona: 14,
  piezas: [
    {
      nombre: 'Lote 3-C',
      servicios: true,
      vertices: [
        [500085.207, 2147738.197], [500115.703, 2147789.922], [500123.966, 2147805.933], [500128.73, 2147816.97],
        [500135.85, 2147833.51], [500137.014, 2147836.301], [500142.829, 2147846.817], [500145.782, 2147852.012],
        [500160.333, 2147878.283], [500162.876, 2147883.681], [500174.707, 2147911.312], [500185.361, 2147936.216],
        [500190.707, 2147951.821], [500197.215, 2147970.73], [500214.85, 2148006.511], [500224.897, 2148023.847],
        [500234.679, 2148041.163], [500244.66, 2148058.552], [500260.261, 2148085.833], [500264.791, 2148093.103],
        [500276.367, 2148109.386], [500303.61, 2148138.596], [500335.503, 2148162.689], [500352.912, 2148172.558],
        [500371.06, 2148180.856], [500389.925, 2148187.585], [500409.276, 2148192.621], [500503.384, 2148202.349],
        [500565.581, 2148188.774], [500650.121, 2147976.179], [500032.504, 2147245.868], [499904.278, 2147316.005],
      ],
      lotes: [{ ha: 6, lado: 'a' }, { ha: 5, lado: 'a' }, { ha: 5, lado: 'b' }, { ha: 4.5, lado: 'b' }, { ha: 2, lado: 'b' }],
    },
    {
      nombre: 'Lote 3-B',
      vertices: [
        [500158.053, 2148377.014], [500159.319, 2148371.171], [500161.553, 2148359.321], [500163.527, 2148347.483],
        [500166.168, 2148329.662], [500168.006, 2148311.77], [500169.723, 2148287.799], [500170.68, 2148269.823],
        [500170.773, 2148263.791], [500170.88, 2148252.284], [500170.44, 2148230.387], [500170.121, 2148224.616],
        [500169.223, 2148206.618], [500168.712, 2148200.662], [500167.689, 2148188.666], [500165.608, 2148170.804],
        [500162.936, 2148152.981], [500158.674, 2148129.356], [500154.892, 2148111.636], [500149.79, 2148091.232],
        [500144.09, 2148071.129], [500138.723, 2148053.916], [500130.598, 2148031.334], [500126.226, 2148020.188],
        [500112.568, 2147986.863], [500085.369, 2147923.019], [500078.883, 2147904.708], [499867.778, 2147339.916],
        [499638.419, 2147465.368], [500011.131, 2148248.345], [500147.671, 2148360.155],
      ],
      lotes: [{ ha: 5, lado: 'a' }, { ha: 3.5, lado: 'a' }, { ha: 4.5, lado: 'b' }, { ha: 3, lado: 'b' }],
    },
    {
      nombre: 'Lote 7-D',
      vertices: [
        [499856.969, 2147317.333], [499840.187, 2147278.296], [499832.297, 2147259.921], [499824.433, 2147241.59],
        [499816.556, 2147223.175], [499808.685, 2147204.823], [499800.851, 2147186.426], [499785.03, 2147149.643],
        [499777.133, 2147131.287], [499769.306, 2147112.882], [499764.556, 2147101.687], [499758.985, 2147091.943],
        [499752.297, 2147084.516], [499744.247, 2147076.854], [499735.178, 2147074.383], [499725.449, 2147072.128],
        [499715.478, 2147071.812], [499705.667, 2147073.554], [499689.417, 2147076.934], [499669.944, 2147080.964],
        [499649.619, 2147086.692], [499630.402, 2147092.078], [499611.134, 2147097.456], [499591.882, 2147102.873],
        [499573.445, 2147108.016], [499552.043, 2147111.457], [499533.102, 2147114.508], [499513.327, 2147117.708],
        [499508.056, 2147118.553], [499297.691, 2147177], [499299.962, 2147182.463], [499449.843, 2147542.982],
      ],
      lotes: [{ ha: 4, lado: 'a' }, { ha: 2, lado: 'a' }, { ha: 3.5, lado: 'b' }, { ha: 2.5, lado: 'b' }],
    },
    {
      nombre: 'Lote 7-E',
      vertices: [
        [500016.482, 2147226.067], [499894.835, 2147292.048], [499854.784, 2147196.123], [499847.072, 2147177.788],
        [499839.408, 2147159.255], [499831.663, 2147140.826], [499823.954, 2147122.334], [499816.221, 2147103.814],
        [499808.548, 2147085.44], [499806.051, 2147079.328], [499804.193, 2147073.808], [499803.561, 2147063.858],
        [499805.802, 2147054.206], [499810.817, 2147045.558], [499818.23, 2147038.899], [499827.283, 2147030.653],
        [499846.052, 2147027.82], [499850.786, 2147026.35], [499861.126, 2147038.813],
      ],
      lotes: [{ ha: 1.5, lado: 'b' }],
    },
  ],
  areaDof: 683683.11,
  control: null,
  marcador: { lat: 19.4243, lon: -98.9973 },
  /** Business centre and services: the game's estimate. */
  serviciosHa: 1.5,
  /** A city's: narrower roads than an open-country polo's. */
  anchoVialidad: 22,
  anchoAcceso: 12,
  margen: 1200,
  /** The Circuito Exterior Mexiquense: the only road with a number by it. */
  carretera: /5D/,
  sinServicio: true,
};

/**
 * Reserva Zapotlán, from its declaratoria (DOF, 30 Jun 2025): one polygon of 40 vertices in UTM
 * zone 14 (the DOF doesn't say the zone; Hidalgo is in it), 9,108,169.941 m² as its table says.
 * The article that declares it says 9,222,019.79 m²; the table and its vertices give 910.82 ha.
 */
const RESERVA_ZAPOTLAN = {
  id: 'reserva-zapotlan',
  zona: 14,
  vertices: [
    [516456.4369, 2203410.9664], [516338.2167, 2203647.388], [516639.6118, 2203964.703], [516749.4705, 2203720.991],
    [518708.0479, 2206030.863], [518730.8576, 2206011.475], [519036.7478, 2206372.404], [518860.5899, 2206518.684],
    [520332.7786, 2208256.14], [518622.3825, 2208588.954], [518505.2726, 2208613.2491], [518108.9698, 2208690.573],
    [518113.8095, 2208454.643], [518316.0658, 2208414.434], [518222.0962, 2207909.34], [518140.6298, 2207927.858],
    [518072.8381, 2207837.358], [518247.1969, 2207719.675], [518171.1821, 2207625.702], [517999.188, 2207740.539],
    [517853.656, 2207558.85], [518026.9725, 2207447.255], [516250.409, 2205263.832], [516187.979, 2205298.876],
    [516046.7536, 2205112.734], [515974.4439, 2205155.935], [515786.8699, 2205040.983], [515679.7007, 2204849.847],
    [515664.8538, 2204830.649], [515327.3307, 2204234.423], [515561.8059, 2204079.466], [515391.5419, 2203800.238],
    [515167.252, 2203951.483], [515085.6354, 2203808.616], [515307.5037, 2203662.595], [515223.3664, 2203521.941],
    [515355.5587, 2203449.279], [515341.6116, 2203439.7174], [516133.9196, 2202994.0203], [516304.5457, 2203195.6604],
  ],
  areaDof: 9108169.941,
  control: null,
  marcador: { lat: 19.95, lon: -98.8316 },
  /**
   * No lots are published. The game gives them about the share Coatzacoalcos I's declaratoria
   * zones industrial (76.46 %): 680 ha in 20 lots of 15 to 60 ha (an estimate).
   */
  lotes: [
    { ha: 60, lado: 'a' }, { ha: 50, lado: 'a' }, { ha: 45, lado: 'a' }, { ha: 40, lado: 'a' }, { ha: 35, lado: 'a' },
    { ha: 30, lado: 'a' }, { ha: 25, lado: 'a' }, { ha: 20, lado: 'a' }, { ha: 20, lado: 'a' }, { ha: 15, lado: 'a' },
    { ha: 60, lado: 'b' }, { ha: 50, lado: 'b' }, { ha: 45, lado: 'b' }, { ha: 40, lado: 'b' }, { ha: 35, lado: 'b' },
    { ha: 30, lado: 'b' }, { ha: 25, lado: 'b' }, { ha: 20, lado: 'b' }, { ha: 20, lado: 'b' }, { ha: 15, lado: 'b' },
  ],
  serviciosHa: 6,
  anchoVialidad: 30,
  anchoAcceso: 16,
  carretera: /85/,
  /**
   * No power line or substation in OpenStreetMap within kilometres: the declaratoria says the
   * nearest distribution substation is 20 km away and the high-voltage connection would be
   * Tizayuca's, about 24 km. Where it is: OpenStreetMap (230/23 kV, 180 MVA).
   */
  conexion: { nombre: 'Tizayuca', lon: -98.9902, lat: 19.8248, kv: '230000' },
};

/**
 * San Jerónimo, from its declaratoria (DOF, 30 Jun 2025): fraction B-3B of fraction B, by the
 * San Jerónimo–Santa Teresa border crossing, in UTM zone 13 (the DOF doesn't say the zone;
 * Juárez is in it): eight vertices and two curves, with their centres and radii, 603,190.225 m².
 */
const SAN_JERONIMO = {
  id: 'san-jeronimo',
  zona: 13,
  /** The table's vertices by number (east, north); 3 and 6 are the centres of its two curves. */
  nombres: {
    1: [343295.657, 3517210.995], 2: [343480.182, 3517208.158], 4: [343883.039, 3517337.376], 5: [344066.593, 3517472.883],
    7: [344270.665, 3517571.725], 8: [344341.862, 3517571.776], 9: [344341.862, 3516716.581], 10: [343675.195, 3516716.606],
  },
  centros: { 3: [343490.341, 3517869.08], 6: [344432.88, 3516976.722] },
  piezas: [
    {
      nombre: 'Fracción B-3B',
      servicios: true,
      anillo: [1, 2, ['arco', 2, 4, 3], 4, 5, ['arco', 5, 7, 6], 7, 8, 9, 10],
      /**
       * No lots are published. The game gives them about the share Coatzacoalcos I's declaratoria
       * zones industrial (76.46 %): 46 ha in 8 lots of 2 to 10 ha (an estimate).
       */
      lotes: [
        { ha: 10, lado: 'a' }, { ha: 7, lado: 'a' }, { ha: 5, lado: 'a' }, { ha: 3, lado: 'a' },
        { ha: 9, lado: 'b' }, { ha: 6, lado: 'b' }, { ha: 4, lado: 'b' }, { ha: 2, lado: 'b' },
      ],
    },
  ],
  areaDof: 603190.225,
  /**
   * The table's vertices, sides and curves agree with each other (every side's bearing and length,
   * every curve's delta, length and subtangent) and enclose 56.46 ha: 6.4 % less than the 60.32 ha
   * the same table and the article declare. The game draws the table.
   */
  areaNoCuadra: 0.07,
  control: null,
  /** Where the land's centre is. The board's marker (polos.json) is 750 m south of it, on the Mexican side of the board's border. */
  marcador: { lat: 31.7786, lon: -106.648 },
  serviciosHa: 1.5,
  anchoVialidad: 26,
  anchoAcceso: 14,
  /** The road to the border crossing, by its north side: the state's CHIH 174, San Jerónimo–Anapra (no federal highway near). */
  carretera: /174/,
  /**
   * The nearest track is the Union Pacific's, 5 km north in New Mexico. The spur goes to the
   * nearest Mexican line, Ferromex's in Ciudad Juárez: the main lines of a box up to there.
   */
  viasLejos: '31.65,-106.80,31.86,-106.44',
  margenVias: 17000,
  viaDe: /Ferromex/,
  /** The border runs along its north side. */
  frontera: 'Estados Unidos',
};

/**
 * Parque Industrial Bajío, from its declaratoria (DOF, 7 Jul 2025): three polygons in UTM zone 14
 * (the DOF doesn't say the zone; Michoacán is in it), the axis of an access road (1,988.45 m long,
 * 5.9162 ha) and a parcel of 1 ha. Every side comes with its bearing and length, which show two
 * typos:
 * - vertex 328 is written 2,199,839.737 north; both of its sides put it at 2,199,837.937 (two
 *   digits swapped);
 * - vertex 200 opens its table at 2,200,214.54 north and closes it at 2,200,214.34, where the side
 *   from vertex 231 ends.
 * With them the polygons are 201.4006, 49.3417 and 85.5912 ha, as their tables say; with the road,
 * 342.25 ha against the 342.08 declared. With the parcel too they'd be 343.25: the game draws it and
 * doesn't count it. The tables don't take out where they overlap: the road crosses polygon 3, the
 * tip of polygon 2 and the parcel.
 */
const PARQUE_INDUSTRIAL_BAJIO = {
  id: 'parque-industrial-bajio',
  zona: 14,
  piezas: [
    {
      nombre: 'Polígono 1',
      servicios: true,
      vertices: [
        [294555.18, 2200498.41], [294492.95, 2200570], [294465.96, 2200595.98], [294455.07, 2200580.31],
        [294436.62, 2200603.11], [294410.37, 2200596.14], [294425.64, 2200640.3], [294617.61, 2200662.47],
        [294589.82, 2200726.02], [294521.08, 2200702.65], [294480.24, 2200695.17], [294470.42, 2200703.3],
        [294419.62, 2200702.68], [294423.66, 2200799], [294400.82, 2200849.23], [294408.4, 2200866.85],
        [294436.75, 2200866.72], [294439.32, 2200881.71], [294518.68, 2200889.63], [294462.87, 2200997.64],
        [294451.88, 2200997.16], [294453.33, 2201001.11], [294247.51, 2201066.81], [294265.54, 2201114.56],
        [294438.3, 2201054.262], [294329.42, 2201299.16], [294319.54, 2201317.28], [294136.6, 2201379.19],
        [294132.02, 2201380.21], [294129.02, 2201324.51], [294129.2, 2201255.34], [294132, 2201219.8],
        [293932.67, 2201222.04], [293933.27, 2201260.3], [293934.56, 2201329.75], [293934.89, 2201368.5],
        [293927.32, 2201367.54], [293725.29, 2201376.35], [293713.98, 2201376.91], [293708.23, 2201554.06],
        [293703.65, 2201664.86], [294072.16, 2201866.25], [294178.34, 2201793.78], [294306.9, 2201794.1],
        [294681.37, 2201360.33], [295742.63, 2201690.18], [295871.852, 2201246.81], [295826.83, 2200789.42],
        [296073.64, 2200522.7], [295765.6, 2200203.24], [295901.87, 2200102.63], [295674.75, 2200204.26],
        [295557.97, 2200256.51], [295528.68, 2200254.28], [295363.54, 2200321.58], [295178.91, 2200387.38],
        [294966.64, 2200442.29], [294706.584, 2200482.26],
      ],
      lotes: [
        { ha: 30, lado: 'a' }, { ha: 20, lado: 'a' }, { ha: 15, lado: 'a' }, { ha: 12, lado: 'a' }, { ha: 10, lado: 'a' },
        { ha: 25, lado: 'b' }, { ha: 15, lado: 'b' }, { ha: 12, lado: 'b' }, { ha: 10, lado: 'b' }, { ha: 5, lado: 'b' },
      ],
    },
    {
      nombre: 'Polígono 2',
      vertices: [
        [295467.23, 2200214.34], [294918.61, 2200258.51], [294824.12, 2200255.23], [294697.94, 2200183.23],
        [294685.53, 2200172.85], [294578.63, 2200112.72], [294526.83, 2200078.23], [294498.46, 2200060.3],
        [294473.47, 2200047.86], [294422.82, 2200019.92], [294397.04, 2200003.33], [294372.26, 2199987.71],
        [294343.85, 2199968.83], [294254.91, 2199918.58], [294212.06, 2199899.33], [294216.19, 2199884.32],
        [294170.76, 2199857.21], [294053.46, 2199784.41], [293908.19, 2199698.74], [293778.25, 2199773.51],
        [293792.02, 2199800.83], [293923.9, 2200167.24], [293964.1, 2200284.17], [293983.45, 2200334.96],
        [293999.85, 2200388.6], [294016.94, 2200438.88], [294036.82, 2200493.32], [294039.21, 2200496.55],
        [294249.6, 2200472.64], [294958.4, 2200382.57], [295162.48, 2200330.25], [295335.36, 2200268.84],
      ],
      lotes: [{ ha: 10, lado: 'a' }, { ha: 8, lado: 'a' }, { ha: 12, lado: 'b' }, { ha: 8, lado: 'b' }],
    },
    {
      nombre: 'Polígono 3',
      vertices: [
        [295219.755, 2199427.105], [295164.131, 2199412.97], [295120.595, 2199436.316], [295133.464, 2199461.996],
        [295128.905, 2199511.488], [295118.44, 2199618.375], [295049.832, 2199611.525], [295050.104, 2199626.764],
        [295064.13, 2199670.559], [295061.947, 2199712.679], [294899.713, 2199629.612], [294893.646, 2199643.914],
        [294891.499, 2199650.667], [294566.741, 2199492.538], [294508.909, 2199460.994], [294337.788, 2199418.514],
        [293969.747, 2199304.378], [293882.625, 2199271.124], [293760.955, 2199207.274], [293699.656, 2199154.584],
        [293636.185, 2199092.86], [293555.426, 2198993.902], [293506.773, 2199023.757], [293686.197, 2199516.209],
        [293720.537, 2199554.701], [293810.786, 2199612.637], [293889.721, 2199659.219], [294130.664, 2199801.337],
        [294199.498, 2199837.937], [294330.327, 2199918.27], [294494.83, 2200018.038], [294703.126, 2200144.328],
        [294832.592, 2200206.084], [295242.062, 2200190.219], [295409.437, 2200183.734], [295393.073, 2200007.753],
        [295362.587, 2200011.144], [295334.699, 2200015.818], [295338.191, 2200048.346], [295300.166, 2200050.23],
        [295298.717, 2200022.179], [295269.012, 2200027.646], [295266.817, 2199998.017], [295296.948, 2199987.476],
        [295305.156, 2199974.17], [295257.337, 2199991.801], [295248.558, 2199966.797], [295252.4, 2199936.085],
        [295162.543, 2199924.275], [295179.456, 2199804.632], [295265.043, 2199834.804], [295263.689, 2199845.585],
        [295293.923, 2199852.232], [295296.042, 2199845.792], [295364.094, 2199861.595], [295362.85, 2199840.818],
        [295362.42, 2199818.42], [295210.215, 2199777.635], [295212.503, 2199767.175], [295247.705, 2199761.966],
        [295291.752, 2199594.449], [295275.781, 2199593.308], [295247.573, 2199692.145], [295220.443, 2199713.91],
        [295191.051, 2199707.351], [295199.755, 2199687.712], [295152.513, 2199673.869], [295157.982, 2199658.51],
        [295219.414, 2199460.037],
      ],
      lotes: [{ ha: 15, lado: 'a' }, { ha: 10, lado: 'a' }, { ha: 8, lado: 'a' }, { ha: 15, lado: 'b' }, { ha: 10, lado: 'b' }, { ha: 7, lado: 'b' }],
    },
  ],
  /**
   * The road's axis by its stations (east, north) and the parcel's vertices. The table gives each
   * curve's radius, not its centre: the centre is at that radius from both ends of the curve, on
   * the side it turns to.
   */
  nombres: {
    'PST 0+000': [295554.57, 2198443.5], 'PI 0+120': [295530.41, 2198561.05], 'PC 0+467.63': [295441.44, 2198896.39],
    'PT 0+588.52': [295408.7867, 2199012.7158], 'PC 0+824.02': [295337.88, 2199235.89], 'PT 0+964.98': [295283.9871, 2199365.886],
    'PI 1+701.92': [295129.59, 2200084.44], 'PST 1+988.45': [295227.91, 2200353.58],
    P1: [295162.42, 2199925.2], P2: [295252.07, 2199938.61], P3: [295264.93, 2199835.73], P4: [295179.325, 2199805.557],
  },
  centros: { C1: [296399.728, 2199228.133], C2: [295959.996, 2199569.972], CC: [295504.326, 2199020.061] },
  franjas: [
    {
      nombre: 'Camino de acceso',
      tipo: 'carretera',
      ha: 5.916164,
      nota: 'Parte del polo según su declaratoria (DOF): un eje de 1,988 m y unos 30 m de ancho',
      delPolo: true,
      cruza: ['Polígono 3', 'Polígono 2'],
      eje: ['PST 0+000', 'PI 0+120', 'PC 0+467.63', ['arco', 'PC 0+467.63', 'PT 0+588.52', 'C1'], 'PT 0+588.52', 'PC 0+824.02', ['arco', 'PC 0+824.02', 'PT 0+964.98', 'C2'], 'PT 0+964.98', 'PI 1+701.92', 'PST 1+988.45'],
      /** Its 5.9162 ha over the 1,988.45 m of its axis. */
      ancho: 29.75,
    },
    {
      nombre: 'Parcela de 1 ha',
      tipo: 'parcela',
      ha: 1,
      nota: 'Su cuadro viene en la declaratoria (DOF), que no dice qué es; el juego no la cuenta en la superficie del polo',
      anillo: ['P1', 'P2', 'P3', ['arco', 'P3', 'P4', 'CC'], 'P4'],
    },
  ],
  areaDof: 3420807.29,
  control: null,
  marcador: { lat: 19.8949, lon: -100.9579 },
  /**
   * No lots are published. The game gives them about the share Coatzacoalcos I's declaratoria
   * zones industrial (76.46 %): 257 ha in 20 lots of 5 to 30 ha (an estimate).
   */
  serviciosHa: 4,
  anchoVialidad: 30,
  anchoAcceso: 16,
  carretera: /15D/,
};

/**
 * Bienestar e Innovación de Hermosillo, from its declaratoria (DOF, 26 Aug 2025): three sections in
 * UTM zone 12 (the DOF doesn't say the zone; Sonora is in it), Lado A (25 vertices, 298.97 ha),
 * Lado B (100 vertices, 226.86 ha) and PIAT (4 vertices, 20.63 ha), 546.46 ha. Every side's length
 * agrees with its vertices, and the PIAT fills a notch of Lado A. Lado B's column of bearings holds
 * angles that aren't its sides' bearings, and one of its rows is labelled «216 - 217» where it goes
 * from 215 to 216: neither moves a vertex.
 */
const HERMOSILLO = {
  id: 'hermosillo',
  zona: 12,
  piezas: [
    {
      nombre: 'Lado A',
      servicios: true,
      vertices: [
        [508051.7, 3229556.52], [507999.3, 3229953.08], [507469.81, 3229883.12], [507461.83, 3229918.38],
        [507441.63, 3230007.74], [508169.33, 3230102.51], [508048.13, 3231033.25], [508876.6, 3231141.13],
        [508867.06, 3230635.08], [508865.39, 3230546.54], [508864.4, 3230495.44], [508863.71, 3230457.68],
        [508839.22, 3229159.72], [508838.55, 3229124.31], [508808.11, 3227510.15], [508725.7, 3227580.62],
        [508115.19, 3228106.05], [507930.85, 3228410.65], [507895.13, 3228576.15], [507876.51, 3228663.9],
        [507766.15, 3228824.29], [507675.14, 3228958.83], [507666.36, 3229013.75], [507566.35, 3229456.09],
        [507558.38, 3229491.35],
      ],
      lotes: [
        { ha: 40, lado: 'a' }, { ha: 30, lado: 'a' }, { ha: 25, lado: 'a' }, { ha: 20, lado: 'a' }, { ha: 15, lado: 'a' },
        { ha: 35, lado: 'b' }, { ha: 25, lado: 'b' }, { ha: 20, lado: 'b' }, { ha: 15, lado: 'b' },
      ],
    },
    {
      nombre: 'Lado B',
      vertices: [
        [506358.38, 3229077.45], [506432.67, 3229187.85], [506317.87, 3229252.99], [506254.26, 3229121.16],
        [506153.51, 3229169.2], [506046.5, 3229466.36], [506177.29, 3229517.87], [506098.03, 3229656.56],
        [506049.07, 3229700.71], [505951.01, 3229789.17], [505998.57, 3229876.34], [506236.36, 3229824.83],
        [506418.67, 3229967.47], [506369.32, 3230319.41], [506359.22, 3230391.43], [506432.01, 3230462.03],
        [506435.56, 3230533.24], [506322.52, 3230577.26], [506323.5, 3230592.92], [506453.14, 3230642.15],
        [506403.22, 3230854.19], [507061.98, 3231009.29], [507149.24, 3230625.98], [507160.88, 3230583.48],
        [507136.61, 3230581.33], [507129.52, 3230580.83], [507106.42, 3230579.92], [507076.19, 3230580.39],
        [507059.55, 3230581.11], [507044.3, 3230581.67], [507009.27, 3230582.65], [507021.85, 3230464.71],
        [507023.28, 3230451.29], [507030.22, 3230386.19], [507075.48, 3230390.37], [507090.21, 3230391.38],
        [507147.61, 3230396.15], [507157.29, 3230397.22], [507202.73, 3230403.29], [507211.83, 3230364.02],
        [507152.64, 3230356.26], [507096.65, 3230351.5], [507110.02, 3230268.5], [507116.06, 3230225.17],
        [507119.03, 3230196.82], [507120.92, 3230172.84], [507122.58, 3230141.55], [507124.29, 3230121.38],
        [507128.07, 3230100.98], [507132.75, 3230084.32], [507142.43, 3230054.34], [507146.71, 3230040.9],
        [507158.63, 3230002.68], [507165.26, 3229981.06], [507169.53, 3229966.91], [507181.04, 3229929.37],
        [507192.99, 3229891.97], [507197.69, 3229877.69], [507202.65, 3229862.62], [507205.51, 3229854.36],
        [507218.89, 3229814.79], [507238.42, 3229750.5], [507241, 3229742.47], [507245.49, 3229728.39],
        [507249.74, 3229714.87], [507283.77, 3229599.33], [507293.12, 3229598.11], [507348.78, 3229596.2],
        [507375.63, 3229599.24], [507414.52, 3229607.62], [507455.07, 3229433.99], [507475.32, 3229355.67],
        [507491.39, 3229271.68], [507495.12, 3229256.66], [507498.35, 3229243.64], [507540.95, 3229075.89],
        [507546.24, 3229054.58], [507558.07, 3229000.35], [507562.15, 3228978], [507568.4, 3228929.44],
        [507589.17, 3228932.75], [507609.84, 3228803], [507625.62, 3228661.57], [507590.08, 3228568.21],
        [507578.83, 3228551.84], [507553.85, 3228520.21], [507505.16, 3228460.75], [507478.35, 3228430.56],
        [507317.64, 3228348.26], [507066.58, 3228323.15], [507058.59, 3228322.16], [507049.07, 3228417.36],
        [506986.51, 3228411.11], [506980.92, 3228434.83], [506956.4, 3228538.74], [506936.07, 3228624.9],
        [506920.76, 3228623.35], [506894.54, 3228733.74], [506845.73, 3228940.81], [506570.06, 3229017.22],
      ],
      lotes: [
        { ha: 30, lado: 'a' }, { ha: 25, lado: 'a' }, { ha: 20, lado: 'a' }, { ha: 15, lado: 'a' },
        { ha: 30, lado: 'b' }, { ha: 25, lado: 'b' }, { ha: 15, lado: 'b' }, { ha: 10, lado: 'b' },
      ],
    },
    {
      nombre: 'PIAT',
      vertices: [
        [507469.807, 3229883.119], [507999.305, 3229953.075], [508051.697, 3229556.521], [507558.382, 3229491.345],
      ],
      lotes: [{ ha: 8, lado: 'a' }, { ha: 8, lado: 'b' }],
    },
  ],
  areaDof: 5464584.948,
  control: null,
  marcador: { lat: 29.19346, lon: -110.91385 },
  /**
   * No lots are published. The game gives them about the share Coatzacoalcos I's declaratoria
   * zones industrial (76.46 %): 411 ha in 19 lots of 8 to 40 ha (an estimate).
   */
  serviciosHa: 5,
  anchoVialidad: 30,
  anchoAcceso: 16,
  carretera: /15/,
};

/**
 * Topolobampo, from the agreement that modified its declaratoria (DOF, 29 Apr 2026): two polygons
 * in UTM zone 12, 61.42 and 216.16 ha, the 277.5776 ha declared. The declaratoria of 20 Mar 2026
 * also listed a «polygon of donation to Rosendo G. Castro» (3.77 ha, by polygon 1), so its tables
 * added up to 281.35 ha; the agreement left it out. The game draws it, outside the land.
 */
const TOPOLOBAMPO = {
  id: 'topolobampo',
  zona: 12,
  piezas: [
    {
      nombre: 'Polígono 2',
      servicios: true,
      vertices: [
        [695702.16, 2836541.09], [695690.4042, 2836547.6559], [695700.844, 2836594.0909], [695667.8156, 2836628.5628],
        [695724.8958, 2836873.0865], [696024.3108, 2836845.9159], [696022.6329, 2837042.9286], [695766.7817, 2837052.5152],
        [695809.9496, 2837237.4403], [695891.96, 2837385.72], [695906.576, 2837448.5451], [695947.8466, 2837449.4102],
        [696228.0079, 2838653.6505], [696397.7055, 2838690.5856], [697042.7794, 2838347.7066], [697030.873, 2837912.6971],
        [696998.6375, 2837897.9214], [697003.9617, 2837844.9221], [696968.6558, 2837777.0582], [697013.3688, 2837728.9603],
        [697029.4122, 2837741.7547], [697024.6098, 2837373.1597], [697062.5428, 2837317.9725], [697116.9647, 2837286.9031],
        [696848.1758, 2836752.3463], [696802.6233, 2836773.0543], [696720.5403, 2836609.8108], [696161.3604, 2836311.6191],
      ],
      lotes: [
        { ha: 30, lado: 'a' }, { ha: 25, lado: 'a' }, { ha: 20, lado: 'a' }, { ha: 15, lado: 'a' },
        { ha: 25, lado: 'b' }, { ha: 20, lado: 'b' }, { ha: 15, lado: 'b' }, { ha: 10, lado: 'b' },
      ],
    },
    {
      nombre: 'Polígono 1',
      vertices: [
        [695236.054, 2838142.948], [695197.017, 2837974.883], [695176.661, 2837888.948], [695155.503, 2837799.3941],
        [695112.385, 2837616.1751], [695063.2475, 2837406.3076], [695242.6305, 2837365.3472], [695197.2179, 2837166.4661],
        [695679.886, 2837056.2533], [695847.9411, 2837774.8154], [695897.8667, 2837987.7571],
      ],
      lotes: [{ ha: 15, lado: 'a' }, { ha: 12, lado: 'a' }, { ha: 15, lado: 'b' }, { ha: 10, lado: 'b' }],
    },
  ],
  franjas: [
    {
      nombre: 'Donación a Rosendo G. Castro',
      tipo: 'parcela',
      nota: 'Venía en la declaratoria del 20 de marzo de 2026; el acuerdo del 29 de abril la dejó fuera del polo (DOF)',
      vertices: [
        [695197.22, 2837166.47], [695016.46, 2837207.74], [695021.13, 2837227.62], [695060.85, 2837396.07],
        [695063.25, 2837406.31], [695242.63, 2837365.35],
      ],
    },
  ],
  areaDof: 2775775.717,
  control: null,
  marcador: { lat: 25.64171, lon: -109.04325 },
  /**
   * No lots are published. The game gives them about the share Coatzacoalcos I's declaratoria
   * zones industrial (76.46 %): 212 ha in 12 lots of 10 to 30 ha (an estimate).
   */
  serviciosHa: 4,
  anchoVialidad: 30,
  anchoAcceso: 16,
  /** No federal highway near: the state's SIN 124, Topolobampo–Choix (OpenStreetMap). */
  carretera: /124/,
};

/**
 * Puerta Logística del Bajío, from its declaratoria (DOF, 21 Jul 2025): three polygons in UTM zone
 * 14 (the DOF doesn't say the zone; Celaya is in it), with their curves' centres and radii: I
 * (3.29 ha), II (48.83 ha) and III (0.29 ha), 52.41 ha. Every side agrees with its bearing and
 * length. A road 25 m wide curves between I and II (their curves share centres, 25 m apart), and
 * II goes round a rectangle of 1.2 ha it leaves out (its table walks into it and back along the
 * same side). III is too small for a lot: the game draws it as the polo's reserve.
 */
const PUERTA_LOGISTICA_BAJIO = {
  id: 'puerta-logistica-bajio',
  zona: 14,
  piezas: [
    {
      nombre: 'Polígono II',
      servicios: true,
      vertices: [
        [316547.078, 2264676.008], [316495.866, 2264495.107], [316494.404, 2264491.384], [316480.35, 2264447.185],
        [316479.051, 2264442.99], [316463.076, 2264381.818], [316455.275, 2264383.473], [316439.714, 2264331.146],
        [316446.745, 2264329.559], [316436.342, 2264291.39], [316407.869, 2264190.609], [316397.397, 2264190.651],
        [316395.172, 2264132.574], [316393.146, 2264075.343], [316391.138, 2264014.432], [316368.109, 2264014.973],
        [316393.61, 2263879.816], [316391.877, 2263739.858], [316392.274, 2263671.967], [316385.94, 2263602.217],
        [316379.165, 2263600.075], [316372.469, 2263597.7], [316365.858, 2263595.094], [316359.342, 2263592.261],
        [316352.928, 2263589.204], [316346.624, 2263585.926], [316340.437, 2263582.433], [316334.374, 2263578.727],
        [316328.444, 2263574.813], [316322.652, 2263570.697], [316317.007, 2263566.382], [316311.514, 2263561.875],
        [316306.181, 2263557.18], [316301.013, 2263552.303], [316296.018, 2263547.25], [316291.2, 2263542.028],
        [316286.566, 2263536.641], [316282.122, 2263531.098], [316277.872, 2263525.403], [316273.821, 2263519.565],
        [316269.976, 2263513.591], [316266.339, 2263507.486], [316262.916, 2263501.26], [316226.535, 2263432.277],
        [316223.555, 2263426.857], [316220.389, 2263421.543], [316217.04, 2263416.342], [316213.513, 2263411.26],
        [316209.812, 2263406.304], [316205.941, 2263401.479], [316201.905, 2263396.791], [316197.71, 2263392.246],
        [316193.359, 2263387.849], [316188.858, 2263383.606], [316184.212, 2263379.522], [316179.428, 2263375.601],
        [316174.511, 2263371.848], [316169.467, 2263368.268], [316164.301, 2263364.865], [316159.021, 2263361.643],
        [316153.632, 2263358.607], [316148.141, 2263355.759], [316142.554, 2263353.103], [316136.879, 2263350.642],
        [316131.121, 2263348.38], [316125.289, 2263346.319], [316119.389, 2263344.462], [316113.428, 2263342.81],
        [316107.413, 2263341.365], [316101.352, 2263340.131], [316095.252, 2263339.107], [316089.12, 2263338.295],
        [316082.963, 2263337.697], [316095.59, 2263476.123], [316105.492, 2263476.034], [316113.952, 2263483.923],
        [316113.952, 2263488.097], [316105.31, 2263497.224], [316116.169, 2263615.266], [316127.345, 2263739.56],
        [316161.284, 2264113.112], [316172.671, 2264237.652], [316183.882, 2264362.326], [316195.008, 2264486.589],
        [316206.34, 2264611.473], [316217.622, 2264736.051], [316228.959, 2264860.478], [316232.574, 2264901.045],
        [316240.06, 2264985.068], [316247.324, 2265064.503], [316251.443, 2265109.545], [316258.217, 2265185.818],
        [316262.865, 2265200.734], [316492.027, 2265213.038], [316584.606, 2265196.506], [316580.992, 2265177.879],
        [316547.22, 2265003.807], [316597.823, 2264992.818], [316595.809, 2264985.195], [316570.756, 2264992.148],
        [316494.846, 2265005.888], [316453.406, 2264856.21], [316530.215, 2264837.132], [316570.756, 2264992.148],
        [316595.809, 2264985.195], [316555.392, 2264832.213], [316553.995, 2264826.922], [316579.174, 2264821.941],
        [316572.961, 2264773.823],
      ],
      lotes: [
        { ha: 6, lado: 'a' }, { ha: 5, lado: 'a' }, { ha: 4, lado: 'a' }, { ha: 3, lado: 'a' }, { ha: 3, lado: 'a' },
        { ha: 6, lado: 'b' }, { ha: 5, lado: 'b' }, { ha: 4, lado: 'b' }, { ha: 2, lado: 'b' },
      ],
    },
    {
      nombre: 'Polígono I',
      vertices: [
        [316381.647, 2263574.441], [316354.113, 2263289.162], [316080.635, 2263312.17], [316080.663, 2263312.48],
        [316087.604, 2263313.005], [316094.523, 2263313.768], [316101.412, 2263314.767], [316108.263, 2263316.001],
        [316115.067, 2263317.469], [316121.817, 2263319.169], [316128.505, 2263321.099], [316135.123, 2263323.257],
        [316141.664, 2263325.64], [316148.119, 2263328.246], [316154.48, 2263331.071], [316160.742, 2263334.112],
        [316166.896, 2263337.365], [316172.935, 2263340.828], [316178.851, 2263344.495], [316184.639, 2263348.362],
        [316190.291, 2263352.425], [316195.801, 2263356.68], [316201.161, 2263361.12], [316206.367, 2263365.741],
        [316211.411, 2263370.538], [316216.289, 2263375.505], [316220.993, 2263380.635], [316225.519, 2263385.924],
        [316229.861, 2263391.364], [316234.015, 2263396.95], [316237.975, 2263402.675], [316241.737, 2263408.532],
        [316245.296, 2263414.514], [316248.648, 2263420.615], [316285.029, 2263489.598], [316288.046, 2263495.084],
        [316291.251, 2263500.462], [316294.641, 2263505.725], [316298.212, 2263510.868], [316301.959, 2263515.883],
        [316305.878, 2263520.765], [316309.965, 2263525.508], [316314.214, 2263530.106], [316318.62, 2263534.554],
        [316323.178, 2263538.846], [316327.882, 2263542.977], [316332.727, 2263546.942], [316337.707, 2263550.736],
        [316342.815, 2263554.355], [316348.047, 2263557.795], [316353.394, 2263561.05], [316358.852, 2263564.118],
        [316364.413, 2263566.994], [316370.07, 2263569.676], [316375.817, 2263572.159],
      ],
      lotes: [{ ha: 2, lado: 'a' }],
    },
  ],
  franjas: [
    {
      nombre: 'Polígono III',
      tipo: 'reserva',
      nota: 'Parte del polo (DOF): 0.29 ha, muy chica para un lote; el juego la deja de reserva',
      delPolo: true,
      vertices: [
        [316356.877, 2265237.176], [316412.276, 2265227.282], [316268.736, 2265219.576], [316274.294, 2265237.413],
        [316275.555, 2265243.009], [316257.333, 2265249.269], [316258.753, 2265264.785], [316280.5, 2265259.426],
      ],
    },
  ],
  areaDof: 524080.7,
  control: null,
  marcador: { lat: 20.46901, lon: -100.76097 },
  /**
   * No lots are published. The game gives them about the share Coatzacoalcos I's declaratoria
   * zones industrial (76.46 %): 40 ha in 10 lots of 2 to 6 ha, the size of logistics warehouses
   * (an estimate).
   */
  serviciosHa: 1.5,
  anchoVialidad: 26,
  anchoAcceso: 14,
  /** The only numbered road near: the state toll bypass of Celaya, GTO D (OpenStreetMap). */
  carretera: /GTO D/,
};

/**
 * Centro Logístico e Industrial de Durango, from its declaratoria (DOF, 26 Aug 2025): polygon 1
 * (272.16 ha) and four reserves north of it (1, 2, 4 and 5; there's no 3), 315.42 ha, in UTM zone
 * 13 (the DOF doesn't say the zone; Durango is in it), with European number format. Every side
 * agrees with its bearing and length. The game puts the lots in polygon 1 and leaves the reserves
 * as such.
 */
const DURANGO = {
  id: 'durango',
  zona: 13,
  piezas: [
    {
      nombre: 'Polígono 1',
      servicios: true,
      vertices: [
        [549361.769, 2674973.111], [549668.316, 2674739.17], [549671.561, 2674736.75], [550000.1, 2674469.15],
        [550003.513, 2674466.65], [550275.972, 2674242.31], [550141.097, 2674067.6], [550138.482, 2674064.6],
        [549987.796, 2673875.819], [549988.241, 2673872.93], [549860.997, 2673655.148], [549704.961, 2673447.099],
        [549702.886, 2673443.78], [549553.987, 2673256.601], [549550.803, 2673252.85], [549389.174, 2673056.05],
        [549385.884, 2673052.7], [549233.09, 2672856.829], [549231.246, 2672852.85], [549090.087, 2672650.49],
        [549087.706, 2672647.34], [548935.794, 2672460.311], [548933.482, 2672456.891], [548788.834, 2672268.94],
        [548786.28, 2672265.65], [548635.636, 2672075.8], [548312.378, 2672323.091], [548308.366, 2672326.159],
        [548000.911, 2672561.36], [548148.255, 2672751.05], [548151.763, 2672755.229], [548300.027, 2672949.049],
        [548303.106, 2672953.87], [548453.305, 2673145.46], [548456.196, 2673149.111], [548604.324, 2673339.809],
        [548607.781, 2673344.05], [548296.402, 2673590.82], [548452.529, 2673791.503], [548754.065, 2673542.53],
        [548757.761, 2673539.369], [548924.798, 2673758.98], [548927.937, 2673762.42], [549067.945, 2673945.559],
        [549070.773, 2673949.641], [549067.017, 2673952.46], [548749.892, 2674199.081], [548899.43, 2674390.08],
        [548903.364, 2674395.182], [548746.338, 2674521.271], [548900.227, 2674723.142], [549053.458, 2674598.41],
        [549057.045, 2674595.321], [549060.405, 2674599.739], [549215.255, 2674792.62], [549217.695, 2674795.73],
      ],
      lotes: [
        { ha: 30, lado: 'a' }, { ha: 25, lado: 'a' }, { ha: 20, lado: 'a' }, { ha: 15, lado: 'a' }, { ha: 12, lado: 'a' }, { ha: 10, lado: 'a' },
        { ha: 30, lado: 'b' }, { ha: 25, lado: 'b' }, { ha: 20, lado: 'b' }, { ha: 15, lado: 'b' }, { ha: 10, lado: 'b' },
      ],
    },
  ],
  franjas: [
    {
      nombre: 'Reserva 1',
      tipo: 'reserva',
      nota: 'Reserva del polo según su declaratoria (DOF); el juego no le pone lotes',
      delPolo: true,
      vertices: [
        [550296.909, 2675523.891], [550314.724, 2675507.85], [550574.976, 2675300.534], [550883.389, 2675028.342],
        [550751.52, 2674875.87], [550433.87, 2675126.82], [550347.432, 2675020.177], [550279.51, 2675075.23],
        [550069.93, 2675237.53],
      ],
    },
    {
      nombre: 'Reserva 2',
      tipo: 'reserva',
      nota: 'Reserva del polo según su declaratoria (DOF); el juego no le pone lotes',
      delPolo: true,
      vertices: [
        [549953.19, 2675826.54], [549999.459, 2675791.891], [550001.477, 2675789.906], [550244.096, 2675571.445],
        [550148.6, 2675450.56], [549856.48, 2675682.85],
      ],
    },
    {
      nombre: 'Reserva 4',
      tipo: 'reserva',
      nota: 'Reserva del polo según su declaratoria (DOF); el juego no le pone lotes',
      delPolo: true,
      vertices: [
        [549046.766, 2675898.85], [549377.513, 2675643.51], [549227.008, 2675460.28], [548894.968, 2675716.18],
      ],
    },
    {
      nombre: 'Reserva 5',
      tipo: 'reserva',
      nota: 'Reserva del polo según su declaratoria (DOF); el juego no le pone lotes',
      delPolo: true,
      vertices: [
        [548840.07, 2676248.456], [549132.732, 2676019.251], [549039.807, 2675902.906], [548743.805, 2676137.205],
      ],
    },
  ],
  areaDof: 3154162.71,
  control: null,
  marcador: { lat: 24.17403, lon: -104.51633 },
  /**
   * No lots are published. The game puts in polygon 1 about the share Coatzacoalcos I's
   * declaratoria zones industrial (76.46 % of it): 212 ha in 11 lots of 10 to 30 ha (an estimate).
   */
  serviciosHa: 4,
  anchoVialidad: 30,
  anchoAcceso: 16,
  carretera: /40/,
};

/**
 * Salina Cruz, from its declaratoria (DOF, 12 May 2023): one polygon in UTM zone 15 with three
 * curves (their centres and radii in the table), 820,864.43 m². Every side agrees with its bearing
 * and length; with the curves drawn every 2°, the area is the table's.
 */
const SALINA_CRUZ = {
  id: 'salina-cruz',
  zona: 15,
  vertices: [
    [265579.12, 1796923.55], [265615.2, 1796923.13], [265619.38, 1796923.08], [265691.76, 1796840.62],
    [265771.76, 1796840.62], [265771.76, 1796921.02], [265880.66, 1796919.39], [265967.63, 1796918.09],
    [265973.76, 1796911.8], [266046.5, 1796910.75], [266056.49, 1796909.85], [266196.46, 1796907.83],
    [266206.44, 1796906.68], [266297.29, 1796905.37], [266316.23, 1796904.45], [266326.2, 1796903.46],
    [266446.12, 1796897.61], [266456.09, 1796896.63], [266502.15, 1796894.38], [266536.77, 1796896.02],
    [266546.83, 1796895], [266604.25, 1796897.72], [266632.33, 1796932.76], [266642.83, 1796945.87],
    [266663.52, 1796970.76], [266669.03, 1796978.47], [266673.08, 1796983.82], [266680.86, 1796992.76],
    [266685.57, 1796997.97], [266696.64, 1797008.63], [266708.96, 1797015.81], [266722.44, 1797021.86],
    [266766.45, 1797035.31], [266778.05, 1797038.05], [266807.14, 1797047.03], [266824.6, 1797052.54],
    [266842.62, 1797058.27], [266882.81, 1797071.53], [266897.7, 1797075.99], [266896.22, 1797067.32],
    [266891.99, 1797041.84], [266883.37, 1797006.17], [266880.41, 1796987.97], [266875.15, 1796966.22],
    [266874.53, 1796959.8], [266873.43, 1796951.9], [266869.68, 1796932.31], [266868.86, 1796918.49],
    [266867.6, 1796903.41], [266868.44, 1796892.48], [266863.15, 1796858.81], [266869.24, 1796757.61],
    [266875.27, 1796657.67], [266875.359, 1796655.589], [266875.382, 1796653.506], [266875.336, 1796651.423],
    [266875.223, 1796649.343], [266875.041, 1796647.268], [266874.791, 1796645.2], [266874.473, 1796643.141],
    [266874.088, 1796641.094], [266873.637, 1796639.061], [266873.118, 1796637.043], [266872.534, 1796635.044],
    [266871.885, 1796633.064], [266871.171, 1796631.107], [266870.393, 1796629.175], [266869.55, 1796627.27],
    [266773.73, 1796439.31], [266637.38, 1796181.35], [266636.931, 1796180.465], [266636.513, 1796179.564],
    [266636.127, 1796178.649], [266635.772, 1796177.722], [266635.45, 1796176.782], [266635.161, 1796175.833],
    [266634.905, 1796174.873], [266634.682, 1796173.906], [266634.493, 1796172.931], [266634.338, 1796171.95],
    [266634.217, 1796170.965], [266634.131, 1796169.976], [266634.078, 1796168.984], [266634.06, 1796167.991],
    [266634.077, 1796166.999], [266634.128, 1796166.007], [266634.213, 1796165.018], [266634.332, 1796164.032],
    [266634.486, 1796163.051], [266634.674, 1796162.076], [266634.895, 1796161.108], [266635.149, 1796160.148],
    [266635.437, 1796159.198], [266635.758, 1796158.258], [266636.11, 1796157.33], [266555.17, 1796001.8],
    [266469.44, 1795829.11], [266425.21, 1795740.04], [266414.56, 1795718.62], [266400.96, 1795771.89],
    [266393.46, 1795801.25], [266391.495, 1795808.437], [266389.291, 1795815.555], [266386.851, 1795822.596],
    [266384.177, 1795829.55], [266381.272, 1795836.412], [266378.138, 1795843.172], [266374.781, 1795849.824],
    [266371.203, 1795856.36], [266367.409, 1795862.773], [266363.402, 1795869.055], [266359.188, 1795875.2],
    [266354.77, 1795881.2], [266289.73, 1795967.31], [266220.08, 1796058.7], [266113.52, 1796198.5],
    [265975.18, 1796380], [265805.95, 1796602.03], [265750.15, 1796675.23], [265588.15, 1796887.75],
    [265591.92, 1796891.05], [265575.34, 1796912.84],
  ],
  areaDof: 820864.43,
  control: null,
  marcador: { lat: 16.23821, lon: -95.18602 },
  /**
   * No lots are published. The game gives them about the share Coatzacoalcos I's declaratoria
   * zones industrial (76.46 %): 63 ha in 8 lots of 4 to 12 ha (an estimate).
   */
  lotes: [
    { ha: 12, lado: 'a' }, { ha: 10, lado: 'a' }, { ha: 8, lado: 'a' }, { ha: 5, lado: 'a' },
    { ha: 10, lado: 'b' }, { ha: 8, lado: 'b' }, { ha: 6, lado: 'b' }, { ha: 4, lado: 'b' },
  ],
  serviciosHa: 2,
  anchoVialidad: 26,
  anchoAcceso: 14,
  /** The MEX-185 is 2.5 km away: the entrance faces the Avenida Oleoducto the declaratoria names. */
  carretera: /185/,
  carreteraNombre: /Oleoducto/,
};

/**
 * Arriaga, from its declaratoria (DOF, 8 Jun 2026): one polygon of nine vertices in UTM zone 15,
 * the Finca Rústica El Cocal. Every side agrees with its bearing and length; the area is 48.76 ha
 * against the 48.83 declared (0.15 % less).
 */
const ARRIAGA = {
  id: 'arriaga',
  zona: 15,
  vertices: [
    [406533.12, 1791769.64], [406181.54, 1791805.17], [406056.19, 1791862.04], [405466.13, 1792523.3],
    [405831.53, 1792612.98], [405696.46, 1792810.83], [405765.29, 1792839.66], [406381.76, 1792125.76],
    [406660.42, 1792101.07],
  ],
  areaDof: 488280.92,
  control: null,
  marcador: { lat: 16.20859, lon: -93.87885 },
  /**
   * No lots are published. The game gives them about the share Coatzacoalcos I's declaratoria
   * zones industrial (76.46 %): 37 ha in 6 lots of 3 to 10 ha (an estimate).
   */
  lotes: [
    { ha: 10, lado: 'a' }, { ha: 6, lado: 'a' }, { ha: 3, lado: 'a' },
    { ha: 8, lado: 'b' }, { ha: 6, lado: 'b' }, { ha: 4, lado: 'b' },
  ],
  serviciosHa: 1.5,
  anchoVialidad: 26,
  anchoAcceso: 14,
  carretera: /200/,
};

/**
 * Tapachula I, from its declaratoria (DOF, 8 Apr 2025): a general polygon «A» in UTM zone 15
 * (268.73 ha) minus the rights of way of a CFE power line (1.94 ha) and of the rail branch KA
 * (3.62 ha), which cross it from side to side and leave three pieces, 263.17 ha. Every corner of
 * the strips lies on a side of the polygon. The tables show three typos:
 * - the power line's vertex J is written 565,969.702 east; its sides from I and to E put it at
 *   565,989.702 (a 6 for an 8): with it, the strip gives its 1.9434 ha;
 * - vertices 55, 56 and 57 lie about 6.7 m off where their sides from 21 and to 58 put them, and
 *   that's the 0.29 ha the polygon has too many: they're taken from the bearings;
 * - the side 61→1 says N 33°34' E; its vertices give N 38°34' (the length agrees).
 * With them, the general polygon gives 268.78 ha and the pieces 263.22 against 263.17.
 */
const TAPACHULA_I = {
  id: 'tapachula-i',
  zona: 15,
  piezas: [
    {
      nombre: 'Predio sur',
      servicios: true,
      vertices: [
        [566373.205, 1630052.35], [566531.642, 1629855.149], [567041.765, 1629368.544], [567242.342, 1629179.925],
        [567190.047, 1629106.832], [567218.219, 1629103.683], [567010.725, 1628816.013], [567022.967, 1628803.327],
        [567002.651, 1628776.155], [567057.573, 1628726.317], [566986.075, 1628628.876], [566837.523, 1628419.562],
        [566745.228, 1628509.654], [566536.493, 1628205.94], [566624.241, 1628116.137], [566620.224, 1628110.359],
        [565819.375, 1628903.021], [565951.982, 1629075.629], [566074.126, 1629246.373], [565635.941, 1629621.695],
        [565540.425, 1629700.276], [565996.298, 1630079.734],
      ],
      lotes: [
        { ha: 25, lado: 'a' }, { ha: 20, lado: 'a' }, { ha: 15, lado: 'a' }, { ha: 10, lado: 'a' }, { ha: 8, lado: 'a' },
        { ha: 20, lado: 'b' }, { ha: 15, lado: 'b' }, { ha: 10, lado: 'b' }, { ha: 5, lado: 'b' },
      ],
    },
    {
      nombre: 'Predio norte',
      vertices: [
        [565219.557, 1629964.254], [565114.716, 1630050.507], [565097.335, 1630027.514], [564830.972, 1630596.08],
        [565259.485, 1631133.277], [565439.856, 1630944.273], [565493.574, 1631042.409], [565610.132, 1630685.632],
        [565724.087, 1630597.926],
      ],
      lotes: [{ ha: 12, lado: 'a' }, { ha: 10, lado: 'a' }, { ha: 12, lado: 'b' }, { ha: 8, lado: 'b' }],
    },
    {
      nombre: 'Predio central',
      vertices: [
        [565759.451, 1630570.707], [566110.467, 1630300.547], [566292.281, 1630153.074], [566356.095, 1630073.646],
        [565989.702, 1630100.266], [565524.703, 1629713.211], [565254.018, 1629935.903],
      ],
      lotes: [{ ha: 10, lado: 'a' }, { ha: 6, lado: 'a' }, { ha: 8, lado: 'b' }, { ha: 6, lado: 'b' }],
    },
  ],
  franjas: [
    {
      nombre: 'Derecho de vía del ramal KA',
      tipo: 'via',
      ha: 3.617361,
      nota: 'Se excluye del polo (DOF)',
      vertices: [
        [565724.087, 1630597.926], [565759.451, 1630570.707], [565254.018, 1629935.903], [565219.557, 1629964.254],
      ],
    },
    {
      nombre: 'Derecho de vía de la línea eléctrica de la CFE',
      tipo: 'linea',
      ha: 1.9434078,
      nota: 'Se excluye del polo (DOF)',
      vertices: [
        [566356.095, 1630073.646], [566373.205, 1630052.35], [565996.298, 1630079.734], [565540.425, 1629700.276],
        [565524.703, 1629713.211], [565989.702, 1630100.266],
      ],
    },
  ],
  comprobar: [
    {
      nombre: 'Poligonal general',
      ha: 268.7288794,
      vertices: [
        [565259.485, 1631133.277], [565439.856, 1630944.273], [565493.574, 1631042.409], [565610.132, 1630685.632],
        [566110.467, 1630300.547], [566292.281, 1630153.074], [566531.642, 1629855.149], [567041.765, 1629368.544],
        [567242.342, 1629179.925], [567190.047, 1629106.832], [567218.219, 1629103.683], [567010.725, 1628816.013],
        [567022.967, 1628803.327], [567002.651, 1628776.155], [567057.573, 1628726.317], [566986.075, 1628628.876],
        [566837.523, 1628419.562], [566745.228, 1628509.654], [566536.493, 1628205.94], [566624.241, 1628116.137],
        [566620.224, 1628110.359], [565819.375, 1628903.021], [565951.982, 1629075.629], [566074.126, 1629246.373],
        [565635.941, 1629621.695], [565114.716, 1630050.507], [565097.335, 1630027.514], [564830.972, 1630596.08],
      ],
    },
  ],
  areaDof: 2631681.106,
  control: null,
  marcador: { lat: 14.73987, lon: -92.38628 },
  /**
   * No lots are published. The game gives each piece about the share Coatzacoalcos I's
   * declaratoria zones industrial (76.46 %): 200 ha in 17 lots of 5 to 25 ha (an estimate).
   */
  serviciosHa: 4,
  anchoVialidad: 30,
  anchoAcceso: 16,
  carretera: /225/,
};

/**
 * Tapachula II, from its declaratoria (DOF, 8 Apr 2025): polygon «C» in UTM zone 15 with two curves
 * whose centres share the row of the vertex they end at, 149.7186 ha. Every side agrees with its
 * bearing and length; with the curves, the area is the table's.
 */
const TAPACHULA_II = {
  id: 'tapachula-ii',
  zona: 15,
  vertices: [
    [565607.3, 1628446.857], [565640.063, 1628415.004], [565824.309, 1628233.719], [566077.412, 1627979.99],
    [566330.515, 1627726.262], [566260.383, 1627633.172], [565825.234, 1627017.148], [565927, 1626906.44],
    [565874.393, 1626837.838], [565565.342, 1626450.419], [565492.722, 1626519.183], [565307.615, 1626283.099],
    [565190.09, 1626394.278], [565081.413, 1626501.333], [565074.436, 1626510.338], [565067.762, 1626519.57],
    [565061.398, 1626529.019], [565055.353, 1626538.674], [565049.631, 1626548.525], [565044.241, 1626558.561],
    [565039.186, 1626568.77], [565034.474, 1626579.142], [565030.11, 1626589.664], [565026.097, 1626600.326],
    [565022.442, 1626611.115], [565019.147, 1626622.02], [565016.216, 1626633.029], [565013.653, 1626644.128],
    [565011.46, 1626655.307], [565009.64, 1626666.553], [565008.195, 1626677.852], [565007.127, 1626689.194],
    [565007.203, 1626721.993], [565008.454, 1626754.769], [565010.839, 1626787.482], [565014.319, 1626820.097],
    [565116.23, 1627815.614], [565223.774, 1627696.627], [565315.325, 1627585.66], [565428.527, 1627912.24],
    [565460.764, 1628030.388],
  ],
  areaDof: 1497185.682,
  control: null,
  marcador: { lat: 14.71913, lon: -92.39066 },
  /**
   * No lots are published. The game gives them about the share Coatzacoalcos I's declaratoria
   * zones industrial (76.46 %): 111 ha in 9 lots of 6 to 20 ha (an estimate).
   */
  lotes: [
    { ha: 20, lado: 'a' }, { ha: 15, lado: 'a' }, { ha: 12, lado: 'a' }, { ha: 10, lado: 'a' }, { ha: 8, lado: 'a' },
    { ha: 18, lado: 'b' }, { ha: 12, lado: 'b' }, { ha: 10, lado: 'b' }, { ha: 6, lado: 'b' },
  ],
  serviciosHa: 3,
  anchoVialidad: 30,
  anchoAcceso: 16,
  /**
   * At the foot of the state road to Playa Linda, 2.74 km from the MEX-225 (the DOF). No road in
   * OpenStreetMap is called Playa Linda: the one along it is the «Ramal a Escolleras», which it
   * tags MEX 225.
   */
  carretera: /225/,
};

/**
 * Teapa, from its declaratoria (DOF, 8 Jun 2026): one polygon of 171 vertices in UTM zone 15, each
 * also in latitude and longitude, 961,360.974 m². The area computed is the table's.
 */
const TEAPA = {
  id: 'teapa',
  zona: 15,
  vertices: [
    [511311.61, 1945028.67], [511268.27, 1944991.5], [511017.99, 1944734.21], [510511.34, 1944263.49],
    [510422.32, 1944176.17], [510362.54, 1944102.02], [510361.21, 1944083.74], [510370.96, 1944055.47],
    [510420.8, 1943925.16], [510425.03, 1943813.45], [510534.07, 1943662.12], [510556.52, 1943659.63],
    [510558.93, 1943660.56], [510647.82, 1943653.14], [510646.04, 1943662.66], [510653.63, 1943684.97],
    [510675.38, 1943743.11], [510683.43, 1943754.88], [510688.32, 1943757.49], [510693.51, 1943759.98],
    [510727.53, 1943765.68], [510766.84, 1943757.47], [510778.19, 1943758.27], [510795.87, 1943755.47],
    [510814.36, 1943752.57], [510834.82, 1943745.69], [510848.85, 1943739.47], [510853.41, 1943738.12],
    [510862.09, 1943735.6], [510871.09, 1943731.84], [510874.61, 1943730.39], [510877.44, 1943729.48],
    [510884.08, 1943728.73], [510895.55, 1943727.65], [510909.95, 1943725.15], [510915.81, 1943725.05],
    [510938.77, 1943712.47], [510972.75, 1943690.71], [510985.33, 1943669.39], [510989.35, 1943661.75],
    [511008.19, 1943608.95], [511009.7, 1943604.84], [511009.75, 1943601.53], [511009.54, 1943597.65],
    [511008.58, 1943596.29], [511008.63, 1943593.62], [511009.89, 1943587.57], [511014.63, 1943582.18],
    [511015.32, 1943581.57], [511019.66, 1943574.64], [511019.72, 1943574.38], [511022.11, 1943566],
    [511027.17, 1943557.43], [511031.41, 1943550.89], [511037.15, 1943547.99], [511045.15, 1943547.3],
    [511049.71, 1943547.64], [511058.74, 1943555.6], [511063.8, 1943560.99], [511074.59, 1943582.35],
    [511085.77, 1943620.01], [511088.78, 1943635.52], [511089.67, 1943647.52], [511087.75, 1943656.59],
    [511088.24, 1943666.41], [511090.47, 1943688.28], [511091.34, 1943704.61], [511084.44, 1943741.33],
    [511082.18, 1943762.3], [511088.89, 1943780.23], [511092.68, 1943784.69], [511098.56, 1943787.21],
    [511104.62, 1943790.69], [511111.86, 1943796.81], [511119.24, 1943799.53], [511123.71, 1943802.92],
    [511143.07, 1943816.09], [511149.41, 1943815.64], [511156.84, 1943819.36], [511162.57, 1943822.01],
    [511172.78, 1943823.37], [511185.53, 1943826.83], [511221.54, 1943827.31], [511227.45, 1943827.17],
    [511234.77, 1943824.97], [511242.96, 1943821.41], [511255.68, 1943816.42], [511258.37, 1943816.07],
    [511261.13, 1943815.45], [511262.31, 1943813.02], [511265.84, 1943811.84], [511269.97, 1943807.03],
    [511274.33, 1943799], [511273.9, 1943795.9], [511277, 1943789.99], [511283.49, 1943777.52],
    [511284.64, 1943771.7], [511286, 1943764.86], [511287.06, 1943759.54], [511287.08, 1943758.6],
    [511290.66, 1943741.94], [511292.16, 1943738.51], [511294.72, 1943727.76], [511291.25, 1943720.05],
    [511285.65, 1943711.81], [511270.86, 1943675.29], [511266.24, 1943671.33], [511265.01, 1943667.4],
    [511263.15, 1943663.56], [511266.13, 1943656.61], [511266.81, 1943653.69], [511266.53, 1943650.16],
    [511265.36, 1943645.22], [511265.06, 1943644.49], [511274.95, 1943639.25], [511296.9, 1943655.24],
    [511319.73, 1943675.9], [511326.12, 1943680.76], [511341.11, 1943691.98], [511386.71, 1943702.2],
    [511392.42, 1943700.27], [511405.12, 1943691.99], [511418.92, 1943685.21], [511421.99, 1943684.44],
    [511425.85, 1943672.68], [511429.09, 1943661.79], [511431.08, 1943657.59], [511432.73, 1943647.05],
    [511432.46, 1943641.6], [511430.15, 1943633.07], [511429.74, 1943625.41], [511425.44, 1943616.01],
    [511423.28, 1943611.82], [511404.42, 1943585.43], [511395.58, 1943570.95], [511389.46, 1943559.79],
    [511384.6, 1943544.91], [511384.79, 1943535.55], [511384.69, 1943528.56], [511387.29, 1943524.48],
    [511395.9, 1943519.1], [511403.73, 1943518.92], [511421.08, 1943522.66], [511433.9, 1943526.33],
    [511438.29, 1943530.41], [511442.92, 1943544.04], [511444.74, 1943549.57], [511450.37, 1943573.78],
    [511453.38, 1943594.29], [511452.27, 1943601.65], [511451.62, 1943608.22], [511456.7, 1943636.01],
    [511463.81, 1943672.55], [511463.51, 1943680.78], [511465.99, 1943694.75], [511468.73, 1943706.7],
    [511471.55, 1943720.19], [511473.77, 1943732.79], [511478.4, 1943762.6], [511476.7, 1943776.12],
    [511475.25, 1943791.73], [511472.55, 1943814.92], [511475.23, 1943831.98], [511477.09, 1943845.06],
    [511474.54, 1943852.76], [511471.41, 1943859.67], [511471.26, 1943877.67], [511476.58, 1943893.7],
    [511479.35, 1943895.88], [511191.5, 1944167.2], [511680.96, 1944680.15],
  ],
  areaDof: 961360.974,
  /** Vertex 6, where the table starts, as the DOF gives it in geographic coordinates. */
  control: { lat: 17.591806037, lon: -92.893390902 },
  /**
   * No lots are published. The game gives them about the share Coatzacoalcos I's declaratoria
   * zones industrial (76.46 %): 73 ha in 8 lots of 5 to 15 ha (an estimate).
   */
  lotes: [
    { ha: 15, lado: 'a' }, { ha: 12, lado: 'a' }, { ha: 8, lado: 'a' }, { ha: 5, lado: 'a' },
    { ha: 12, lado: 'b' }, { ha: 10, lado: 'b' }, { ha: 6, lado: 'b' }, { ha: 5, lado: 'b' },
  ],
  serviciosHa: 2,
  anchoVialidad: 26,
  anchoAcceso: 14,
  carretera: /195/,
};

// ---- OpenStreetMap ----------------------------------------------------------------------------

/**
 * What the generator asks OpenStreetMap for, as data: each query is parts [type, box, filters],
 * a filter [key] (it has it), [key, '=', value], [key, '~', regex] or [key, '!'] (it hasn't).
 * The same queries go to Overpass (`ql`) or to a Geofabrik extract (`osm-local.py`).
 */
const CONSULTAS = (p) => ({
  caminos: [['way', p.cerca, [['highway']]]],
  vias: [['way', p.lejos, [['railway']]]],
  electricidad: [
    ['way', p.cerca, [['power', '~', 'line|minor_line']]],
    ['node', p.lejos, [['power', '=', 'substation']]],
    ['way', p.lejos, [['power', '=', 'substation']]],
    ['way', p.lejos, [['man_made', '=', 'pipeline']]],
  ],
  suelo: [['way', p.cerca, [['landuse']]]],
  'agua-lugares': [['way', p.cerca, [['waterway']]], ['node', p.lejos, [['place']]]],
  edificios: [['way', p.cerca, [['building']]]],
  // The main lines of a wider box, when the track the polo can reach is farther (San Jerónimo).
  ...(p.viasLejos ? { 'vias-lejos': [['way', p.viasLejos, [['railway', '=', 'rail'], ['service', '!']]]] } : {}),
  // The international border, for a polo by it.
  ...(p.frontera ? { frontera: [['way', p.lejos, [['boundary', '=', 'administrative'], ['admin_level', '=', '2']]]] } : {}),
});

/** A query in Overpass QL. */
const ql = (partes) =>
  partes.map(([tipo, caja, filtros]) => tipo + filtros.map(([k, op, v]) => (op === '!' ? `[!"${k}"]` : op ? `["${k}"${op}"${v}"]` : `["${k}"]`)).join('') + `(${caja});`).join('');

/**
 * Geofabrik's extract of Mexico (download.geofabrik.de/north-america/mexico-latest.osm.pbf),
 * when it's there: the queries are answered from it, without Overpass. It's a day old at most.
 */
const PBF = join(ROOT, '.cache', 'geofabrik', 'mexico-latest.osm.pbf');

/** A polo's queries not in its cache yet: [file, parts]. */
function faltantes(p) {
  const dir = join(ROOT, '.cache', 'osm', p.id);
  return Object.entries(CONSULTAS(p))
    .filter(([k]) => !existsSync(join(dir, `${k}.json`)))
    .map(([k, partes]) => [join(dir, `${k}.json`), partes]);
}

/** Answers queries from the extract, all of them in one pass over the file (minutes, however many). */
async function desdeGeofabrik(salidas) {
  await mkdir(join(ROOT, '.cache', 'osm'), { recursive: true });
  for (const [archivo] of salidas) await mkdir(dirname(archivo), { recursive: true });
  const pedido = join(ROOT, '.cache', 'osm', 'pedido.json');
  await writeFile(pedido, JSON.stringify({ pbf: PBF, salidas: salidas.map(([archivo, partes]) => ({ archivo, partes })) }));
  console.log(`Geofabrik: ${salidas.length} consultas en una pasada por el extracto de México`);
  const r = spawnSync('python', [join(ROOT, 'scripts', 'polos', 'osm-local.py'), pedido], { encoding: 'utf8', stdio: ['ignore', 'inherit', 'pipe'] });
  if (r.status !== 0) throw new Error(`osm-local.py: ${r.stderr || r.error}`);
}

async function osm(p) {
  const dir = join(ROOT, '.cache', 'osm', p.id);
  await mkdir(dir, { recursive: true });
  const out = {};
  const consultas = CONSULTAS(p);
  // What's missing, from the extract when it's downloaded (the main loop asks for every polo at once first).
  const faltan = faltantes(p);
  if (faltan.length && existsSync(PBF)) await desdeGeofabrik(faltan);
  for (const [k, partes] of Object.entries(consultas)) {
    const q = ql(partes);
    const file = join(dir, `${k}.json`);
    if (!existsSync(file)) {
      let ok = false;
      // The main server, its lz4 twin and two mirrors, in turns: any of them can be overloaded for
      // a while (on 23 Nov 2026 only lz4 answered).
      const servidores = [
        'https://overpass-api.de/api/interpreter',
        'https://lz4.overpass-api.de/api/interpreter',
        'https://overpass.private.coffee/api/interpreter',
        'https://overpass.kumi.systems/api/interpreter',
      ];
      for (let intento = 1; intento <= 12 && !ok; intento++) {
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

async function construir(p, { soloCajas = false } = {}) {
  // The land, in metres around the mean of its vertices (UTM grid: north is the grid's, a fraction of a degree off true north).
  const piezas = piezasDe(p);
  // A strip comes as its ring, as named vertices, or as a road's axis and its width.
  const franjas = (p.franjas ?? []).map((f) => ({ ...f, vertices: f.vertices ?? (f.eje ? franjaDeEje(anilloDe(p, f.eje), f.ancho) : anilloDe(p, f.anillo)) }));
  const todos = piezas.flatMap((q) => q.vertices);
  const cx = todos.reduce((s, q) => s + q[0], 0) / todos.length;
  const cy = todos.reduce((s, q) => s + q[1], 0) / todos.length;
  const aLocal = ([x, y]) => [x - cx, y - cy];
  for (const q of [...piezas, ...franjas]) q.local = q.vertices.map(aLocal);
  const [lon0, lat0] = deUtm(cx, cy, p.zona);
  // The land: its pieces, and the strips that are part of it (Parque Industrial Bajío's access road).
  const a = piezas.reduce((s, q) => s + area(q.local), 0) + franjas.filter((f) => f.delPolo).reduce((s, f) => s + area(f.local), 0);
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
    if (!soloCajas) console.log(`${p.id}: área ${a.toFixed(0)} m² (DOF ${p.areaDof}) · perímetro ${per.toFixed(1)} m · centro a ${d.toFixed(0)} m del marcador${enTerreno ? ', que cae en el terreno' : ''}`);
    if (d > 300 && !enTerreno) throw new Error('El polígono no cae donde el marcador del polo');
  }
  // Within 0.5 %, or what the config says the declaratoria is off by (San Jerónimo's).
  const desvio = Math.abs(a - p.areaDof) / p.areaDof;
  if (desvio > (p.areaNoCuadra ?? 0.005)) throw new Error('El área no cuadra con la del DOF');
  if (desvio > 0.005) console.log(`  ⚠ el área queda ${(desvio * 100).toFixed(1)} % lejos de la del DOF (areaNoCuadra)`);
  // The other tables of the declaratoria (a general polygon, rights of way): each against its own area.
  for (const c of [...(p.comprobar ?? []).map((c) => ({ ...c, local: c.vertices ?? anilloDe(p, c.anillo) })), ...franjas.filter((f) => f.ha)]) {
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

  // `soloCajas`: just the boxes, to ask OpenStreetMap for several polos at once.
  if (soloCajas) return null;
  const datos = await osm(p);
  const caminos = [];
  for (const e of datos.caminos) {
    const t = e.tags ?? {};
    if (!e.geometry || ['footway', 'path', 'steps', 'cycleway', 'pedestrian', 'construction', 'proposed'].includes(t.highway)) continue;
    if (p.sinServicio && t.highway === 'service') continue;
    for (const puntos of trazos(e.geometry)) caminos.push({ tipo: t.highway, ...(t.name ? { nombre: t.name } : {}), ...(t.ref ? { ref: t.ref } : {}), puntos });
  }
  const vias = [];
  const viasVistas = new Set();
  for (const e of datos.vias) {
    const t = e.tags ?? {};
    if (!e.geometry || !['rail', 'abandoned', 'disused', 'construction'].includes(t.railway)) continue;
    viasVistas.add(e.id);
    // A main line reaches `margenVias` past the view when the config gives it.
    const m = p.margenVias && t.railway === 'rail' && !t.service ? p.margenVias : 0;
    for (const puntos of trazos(e.geometry, 2, m))
      vias.push({ estado: t.railway, ...(t.name ? { nombre: t.name } : {}), ...(t.operator ? { operador: t.operator } : {}), ...(t.service ? { servicio: t.service } : {}), puntos });
  }
  // The main lines of the wider box, as far as `margenVias` past the view.
  for (const e of datos['vias-lejos'] ?? []) {
    const t = e.tags ?? {};
    if (!e.geometry || viasVistas.has(e.id)) continue;
    for (const puntos of trazos(e.geometry, 2, p.margenVias))
      vias.push({ estado: t.railway, ...(t.name ? { nombre: t.name } : {}), ...(t.operator ? { operador: t.operator } : {}), puntos });
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
  // The border, and the other country's name 600 m past it, where it's nearest the polo.
  let frontera = null;
  if (p.frontera) {
    const lineas = (datos.frontera ?? []).filter((e) => e.geometry).flatMap((e) => trazos(e.geometry, 3, 20000));
    let cerca = null;
    for (const l of lineas) {
      const m = masCercanos([[0, 0], [0, 0]], l);
      if (!cerca || m.d < cerca.d) cerca = m;
    }
    const [bx, by] = cerca.pb;
    const [ux, uy] = [bx / cerca.d, by / cerca.d];
    frontera = { con: p.frontera, lineas, rotulo: { texto: p.frontera, x: r0(bx + ux * 600), y: r0(by + uy * 600) } };
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

  // The highway by its ref, or by its name when there is none with a number near (Salina Cruz).
  const carretera = caminos.filter((c) => (c.ref && p.carretera?.test(c.ref)) || (!c.ref && c.nombre && p.carreteraNombre?.test(c.nombre)));
  const puntosCarretera = carretera.flatMap((c) => c.puntos);
  const lotes = [];
  const vialidades = [];
  const ejes = [];
  let servicios = null;
  // The piece with the services goes first: the roads are built in this order.
  for (const pieza of [...piezas].sort((x, y) => Number(!!y.servicios) - Number(!!x.servicios))) {
    // Only a strip that crosses the piece is in the way of its lots (Texistepec's are already outside the land).
    const t = trazar(p, pieza, puntosCarretera, franjas.filter((f) => [f.cruza].flat().includes(pieza.nombre)).map((f) => f.local));
    lotes.push(...t.lotes);
    vialidades.push(t.vialidad);
    ejes.push(t.eje);
    if (t.servicios) servicios = t.servicios;
  }
  const { subestacion } = servicios;

  // The rail spur: from the nearest main track to the nearest piece. With none in service near
  // (Reserva Zapotlán), the nearest named line, abandoned or being rebuilt. Only the lines of
  // `p.viaDe` when it's given: the nearest to San Jerónimo are across the border.
  const sirve = (x) => x.nombre && !['siding', 'yard', 'spur'].includes(x.servicio ?? '') && (!p.viaDe || p.viaDe.test(`${x.operador ?? ''} ${x.nombre}`));
  let conNombre = vias.filter(sirve);
  // No named line in the view: the main lines up to 6 km past it, as with power (Hermosillo's).
  if (!conNombre.length)
    for (const e of datos.vias) {
      const t = e.tags ?? {};
      if (!e.geometry || t.railway !== 'rail' || t.service || !t.name) continue;
      for (const puntos of trazos(e.geometry, 2, 6000)) vias.push({ estado: 'rail', nombre: t.name, ...(t.operator ? { operador: t.operator } : {}), puntos });
    }
  conNombre = vias.filter(sirve);
  const enServicio = conNombre.filter((x) => x.estado === 'rail');
  let espuela = null;
  for (const pieza of piezas)
    for (const via of enServicio.length ? enServicio : conNombre) {
      const m = masCercanos(pieza.local, via.puntos, true);
      if (!espuela || m.d < espuela.d) espuela = { ...m, via };
    }
  // The nearest main line `viaDe` leaves out, to say so (San Jerónimo's, in New Mexico).
  let otra = null;
  if (p.viaDe)
    for (const pieza of piezas)
      for (const via of vias.filter((x) => x.nombre && x.estado === 'rail' && !['siding', 'yard', 'spur'].includes(x.servicio ?? ''))) {
        const m = masCercanos(pieza.local, via.puntos, true);
        if (!otra || m.d < otra.d) otra = { ...m, via };
      }
  if (otra && (otra.via === espuela.via || otra.d >= espuela.d)) otra = null;
  // The power connection: from the substation to the nearest high-voltage line, or to the
  // substation the declaratoria names when there's no line near (Reserva Zapotlán's Tizayuca).
  let conexion = null;
  if (p.conexion) {
    const pb = local(p.conexion.lon, p.conexion.lat);
    conexion = { pa: subestacion, pb, d: Math.hypot(pb[0] - subestacion[0], pb[1] - subestacion[1]), linea: { kv: p.conexion.kv } };
    if (!subestaciones.some((x) => x.nombre === p.conexion.nombre))
      subestaciones.push({ nombre: p.conexion.nombre, operador: 'CFE', kv: p.conexion.kv, x: r0(pb[0]), y: r0(pb[1]) });
  } else
    for (const l of lineas) {
      const m = masCercanos([subestacion, subestacion], l.puntos);
      if (!conexion || m.d < conexion.d) conexion = { ...m, linea: l };
    }
  // The view reaches the line the polo connects to, and the track of its spur when it's outside.
  const [lx, ly] = conexion.pb;
  p.caja = { x0: Math.min(x0, cien(lx - 400)), x1: Math.max(x1, cien(lx + 400)), y0: Math.min(y0, cien(ly - 400)), y1: Math.max(y1, cien(ly + 400)) };
  for (const [ex, ey] of [espuela.pb, ...(otra ? [otra.pb] : [])])
    if (!dentro([ex, ey]))
      p.caja = { x0: Math.min(p.caja.x0, cien(ex - 400)), x1: Math.max(p.caja.x1, cien(ex + 400)), y0: Math.min(p.caja.y0, cien(ey - 400)), y1: Math.max(p.caja.y1, cien(ey + 400)) };

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
    espuela: {
      puntos: [espuela.pa, espuela.pb].map(([x, y]) => [r1(x), r1(y)]),
      km: Number((espuela.d / 1000).toFixed(2)),
      via: espuela.via.nombre ?? '',
      operador: espuela.via.operador ?? '',
      ...(espuela.via.estado !== 'rail' ? { estado: espuela.via.estado } : {}),
      ...(otra ? { masCercana: { via: otra.via.nombre, operador: otra.via.operador ?? '', km: Number((otra.d / 1000).toFixed(2)) } } : {}),
    },
    conexionElectrica: { puntos: [conexion.pa, conexion.pb].map(([x, y]) => [r1(x), r1(y)]), km: Number((conexion.d / 1000).toFixed(2)), kv: conexion.linea.kv },
    /** The highway the polo faces, for its label. */
    carretera: carretera[0]?.ref ?? carretera[0]?.nombre ?? null,
    caminos,
    vias,
    lineas,
    subestaciones,
    suelo,
    agua,
    lugares,
    edificios,
    ...(frontera ? { frontera } : {}),
  };
  console.log(`vialidades: ${(vialidades.reduce((s, v) => s + area(v), 0) / 1e4).toFixed(1)} ha · lotes: ${lotes.map((l) => `${l.empresa ?? l.tipo} ${(area(l.puntos) / 1e4).toFixed(2)}`).join(', ')}`);
  console.log(`espuela a la ${geometria.espuela.via} (${geometria.espuela.operador}): ${geometria.espuela.km} km · conexión a la línea de ${conexion.linea.kv} V: ${geometria.conexionElectrica.km} km`);
  if (otra) console.log(`  la vía más cercana, que no sirve: ${otra.via.nombre} (${otra.via.operador ?? ''}), a ${(otra.d / 1000).toFixed(2)} km`);
  if (frontera) console.log(`  frontera con ${frontera.con}: ${frontera.lineas.length} trazos, a ${(Math.hypot(frontera.rotulo.x, frontera.rotulo.y) / 1000 - 0.6).toFixed(2)} km del centro`);
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
  'dof-nezahualcoyotl': {
    fuente: 'DOF, Acuerdo por el que se emite la declaratoria del Polo de Desarrollo Económico para el Bienestar Nezahualcóyotl, Estado de México (7 de agosto de 2025): cuadros de construcción de los lotes 3-B, 3-C, 7-D y 7-E, 683,683.11 m²; junto a la Ciudad de México y al aeropuerto; dentro del predio, gas, electricidad y red férrea; la demanda de electricidad de la Secretaría de Energía; sus vocaciones productivas y su propiedad (el Gobierno del Estado de México)',
    url: 'https://dof.gob.mx/nota_detalle.php?codigo=5764903&fecha=07/08/2025',
  },
  'neza-polo': {
    fuente: 'Gobierno de Nezahualcóyotl, comunicado de prensa 100, 26 de junio de 2025: en su primera etapa, unos 800 millones de pesos de inversión y 4,500 empleos directos',
    url: 'https://www.neza.gob.mx/prensa_2025/single.php?id=100',
  },
  'dof-zapotlan': {
    fuente: 'DOF, Acuerdo por el que se emite la declaratoria del Polo de Desarrollo Económico para el Bienestar Reserva Zapotlán, Hidalgo (30 de junio de 2025): cuadro de construcción (40 vértices, 9,108,169.941 m²); acceso a las autopistas 85D y 40, a 27 km del AIFA; «requiere obras de infraestructura… de alrededor de 5 mil millones de pesos»; la demanda de electricidad y la conexión de la Secretaría de Energía; sus vocaciones productivas y su propiedad (el Gobierno de Hidalgo)',
    url: 'https://dof.gob.mx/nota_detalle.php?codigo=5761461&fecha=30/06/2025',
  },
  'presidencia-zapotlan': {
    fuente: 'Presidencia, comunicado del 19 de agosto de 2026: DEWA invertirá 10,106 millones de pesos en el PODECOBI de Zapotlán; en su primera fase, 1,277 millones para urbanización y 2,000 millones para las dos primeras naves, con obras desde septiembre y 5,100 empleos directos e indirectos',
    url: 'https://www.gob.mx/presidencia/prensa/presidenta-destaca-inversion-de-10-mil-106-mdp-para-el-podecobi-de-zapotlan-hidalgo-que-ya-reune-147-mil-mdp-en-proyectos',
  },
  'dof-san-jeronimo': {
    fuente: 'DOF, Acuerdo por el que se emite la declaratoria del Polo de Desarrollo Económico para el Bienestar San Jerónimo, Chihuahua (30 de junio de 2025): cuadro de construcción de la fracción B-3B (ocho vértices y dos curvas, 603,190.225 m²); al pie de la frontera, junto al cruce internacional Santa Teresa–San Jerónimo, a 15 km de la red férrea y a 800 m de la zona urbana de Ciudad Juárez; uso de suelo industrial, con gas y electricidad dentro del predio; sus vocaciones productivas y su propiedad (el Gobierno de Chihuahua)',
    url: 'https://dof.gob.mx/nota_detalle.php?codigo=5761460&fecha=30/06/2025',
  },
  'economia-san-jeronimo': {
    fuente: 'Secretaría de Economía, portal de los Polos de Desarrollo, ficha de San Jerónimo: energía «Disponibilidad de hasta 20MW», gas con ducto a 25 km, red ferroviaria a 15 km, aeropuerto de Ciudad Juárez a 25 km',
    url: 'https://podecobi.economia.gob.mx/polos-de-desarrollo',
  },
  'chihuahua-polo': {
    fuente: 'Gobierno de Chihuahua, 22 de mayo de 2025, «Ciudad Juárez se incorpora al Plan México como Polo de Desarrollo Económico»: 60.32 ha en un predio del estado, con acceso a la Carretera Federal 2 y a la Pete Domenici Highway de Estados Unidos, cerca de terminales ferroviarias de Union Pacific y BNSF',
    url: 'https://chihuahua.gob.mx/prensa/ciudad-juarez-se-incorpora-al-plan-mexico-como-polo-de-desarrollo-economico',
  },
  'chihuahua-acuerdo': {
    fuente: 'Gobierno de Chihuahua, 26 de junio de 2025: la gobernadora firma en Palacio Nacional el acuerdo del polo, en una reserva de 60 hectáreas en San Jerónimo, y pide a la Presidenta apoyo para renovar el puerto fronterizo San Jerónimo–Santa Teresa, asegurar la suficiencia energética y «adaptar la infraestructura ferroviaria»',
    url: 'https://chihuahua.gob.mx/prensa/maru-campos-firma-en-palacio-nacional-acuerdo-para-consolidar-polo-de-desarrollo-para-0',
  },
  'chihuahua-informe-2026': {
    fuente: 'Gobierno de Chihuahua, 1 de marzo de 2026: en su 4.º Informe, la gobernadora anuncia 315 millones de pesos para el polo de Desarrollo de San Jerónimo',
    url: 'https://chihuahua.gob.mx/prensa/maru-campos-anuncia-inversion-historica-en-obra-publica-para-ciudad-juarez-durante',
  },
  'dof-bajio': {
    fuente: 'DOF, Acuerdo por el que se emite la declaratoria del Polo de Desarrollo Económico para el Bienestar Parque Industrial Bajío, Michoacán (7 de julio de 2025): cuadros de construcción de tres polígonos (201.40, 49.34 y 85.59 ha), del eje de un camino (1,988.45 m, 5.92 ha) y de una parcela de 1 ha, 342.08 ha; junto a la carretera federal 15 y a la autopista México–Morelia–Guadalajara, a poco más de 7 km del aeropuerto de Morelia, con acceso directo a la red férrea de Kansas City Southern de México; ya dispone de vialidades, energía eléctrica, agua potable, drenaje y conectividad; sus vocaciones productivas y su propiedad (el Gobierno de Michoacán)',
    url: 'https://dof.gob.mx/nota_detalle.php?codigo=5762147&fecha=07/07/2025',
  },
  'economia-bajio': {
    fuente: 'Secretaría de Economía, portal de los Polos de Desarrollo, ficha del Parque Industrial Bajío: energía «12.9 MW disponible (hidroeléctrica y geotérmica)», agua 1.15 millones de m³, gas natural a 19 km, aeropuerto de Morelia a 9.4 km, enlace con CPKC',
    url: 'https://podecobi.economia.gob.mx/polos-de-desarrollo',
  },
  'michoacan-citelis': {
    fuente: 'Gobierno de Michoacán, 7 de agosto de 2025: en la conferencia de la Presidenta, el gobernador anuncia la primera inversión del polo, mil millones de pesos de Citelis; sobre la autopista de Occidente, con conexión ferroviaria de CPKC al puerto de Lázaro Cárdenas',
    url: 'https://michoacan.gob.mx/noticias/anuncian-sheinbaum-y-bedolla-primera-inversion-por-mil-mdp-para-el-polo-del-bienestar-de-michoacan/',
  },
  'michoacan-areas': {
    fuente: 'Gobierno de Michoacán, 30 de enero de 2026: el gobernador entrega a Grupo Herso y a Citelis las dos primeras áreas de desarrollo del Parque Bajío, donde harán obras de infraestructura por más de 6,300 millones de pesos y atraerán inversiones; la Sedeco calcula 27 mil empleos formales dentro del parque en los próximos 10 años',
    url: 'https://michoacan.gob.mx/noticias/entrega-bedolla-a-herso-y-citelis-primeras-areas-de-desarrollo-del-parque-bajio-invertiran-6-mil-300-mdp/',
  },
  'scop-bajio': {
    fuente: 'SCOP de Michoacán, 6 de febrero de 2026: 6.1 millones de pesos en la infraestructura base del Parque Bajío: un tanque elevado de agua de 200 m³, el cerco perimetral, tubería de 8 pulgadas para sus etapas 1 y 2 y la ampliación de la línea eléctrica de media tensión, en Estación Queréndaro',
    url: 'https://scop.michoacan.gob.mx/invertidos-mas-de-6-1-mdp-para-el-arranque-del-parque-bajio-rogelio-zarazua/',
  },
  'sedeco-fideicomiso': {
    fuente: 'Sedeco de Michoacán, 20 de agosto de 2026: con la firma de su fideicomiso, el Parque Industrial Bajío entra en su etapa de ejecución; dispone de 1.15 millones de m³ de agua y 12.9 MW, con prefactibilidad de gas natural, junto a la autopista 15D México–Guadalajara y la red de CPKC',
    url: 'https://sedeco.michoacan.gob.mx/parque-bajio-entra-en-etapa-de-ejecucion-para-atraer-nuevas-inversiones/',
  },
  'presidencia-plan-michoacan': {
    fuente: 'Presidencia, 4 de noviembre de 2026, avance del Plan Michoacán por la Paz y la Justicia: «Inicia en noviembre de 2026 la obra de infraestructura y conexión con la Carretera Federal 120 para el Parque Industrial Bajío», con 9,310 millones de pesos estimados',
    url: 'https://www.gob.mx/presidencia/prensa/plan-michoacan-por-la-paz-y-la-justicia-registra-un-avance-de-67-a-un-ano-de-su-implementacion?idiom=es',
  },
  'dof-hermosillo': {
    fuente: 'DOF, Acuerdo por el que se emite la declaratoria del Polo de Desarrollo Económico para el Bienestar e Innovación de Hermosillo, Sonora (26 de agosto de 2025): cuadros de construcción del Lado A (298.97 ha), el Lado B (226.86 ha) y el PIAT (20.63 ha), 546.46 ha; a 650 m de la carretera Hermosillo–Guaymas, con acceso ferroviario a 2 km y el aeropuerto a 17 km; la demanda de electricidad y la conexión de la Secretaría de Energía, y el gas de Energas de México; uso de suelo industrial y su manifestación de impacto ambiental; sus vocaciones productivas y su propiedad (el Gobierno de Sonora)',
    url: 'https://dof.gob.mx/nota_detalle.php?codigo=5766564&fecha=26/08/2025',
  },
  'sonora-incorpora': {
    fuente: 'Gobierno de Sonora, 27 de junio de 2025: el gobernador anuncia en la conferencia matutina la incorporación de Hermosillo a los Polos de Desarrollo, con más de 100 hectáreas disponibles y conectividad por carretera, ferrocarril y aeropuerto',
    url: 'https://www.sonora.gob.mx/gobierno/acciones/gobernador/gobernador-durazo-y-presidenta-sheinbaum-fortalecen-el-plan-sonora-con-polo-de-desarrollo-en-hermosillo',
  },
  'sonora-presentacion': {
    fuente: 'Gobierno de Sonora, 5 de abril de 2026: presentación del Polo de Desarrollo para el Bienestar en Hermosillo, con la alianza Sonora–Arizona–Taiwán para atraer inversión y formar talento',
    url: 'https://www.sonora.gob.mx/gobierno/acciones/gobernador/inversion-tecnologica-con-polos-de-desarrollo-durazo-y-sheinbaum-posicionan-a-sonora-en-el-mapa-global',
  },
  'dof-topolobampo': {
    fuente: 'DOF, Acuerdo por el que se emite la declaratoria del Polo de Desarrollo Económico para el Bienestar Topolobampo, Sinaloa (20 de marzo de 2026): 277.58 ha en Ahome, cuadros de construcción de los polígonos 1 y 2 y de un polígono de donación a Rosendo G. Castro; puerto de 8 a 12 m de calado, carretera y conexión ferroviaria, gas y electricidad en el predio, con opciones para ampliar la energía; sus vocaciones productivas y su propiedad (el estado de Sinaloa)',
    url: 'https://dof.gob.mx/nota_detalle.php?codigo=5782770&fecha=20/03/2026',
  },
  'dof-topolobampo-modifica': {
    fuente: 'DOF, 29 de abril de 2026: Acuerdo por el que se modifica la declaratoria del polo Topolobampo, para «precisar las coordenadas de los polígonos»: quedan los polígonos 1 y 2, sin la donación',
    url: 'https://dof.gob.mx/nota_detalle.php?codigo=5786253&fecha=29/04/2026',
  },
  'sinaloa-polos': {
    fuente: 'Gobierno de Sinaloa, 3 de septiembre de 2025: el polo de Topolobampo tiene 275 hectáreas desarrollables y a su alrededor cuatro proyectos grandes (Pacífico Mexinol, Gas y Petroquímica de Occidente, DH2 Energy y una terminal de gas de Sempra)',
    url: 'https://sinaloa.gob.mx/topolobampo-entre-los-cinco-polos-de-desarrollo-economico-para-el-bienestar-con-mayor-inversion/',
  },
  'sinaloa-proman': {
    fuente: 'Gobierno de Sinaloa, 20 de noviembre de 2025: la planta de amoniaco de Proman-GPO en Topolobampo (800 mil toneladas al año) supera el 50 % de su obra, con 1,700 empleos directos, y producirá a finales de 2027',
    url: 'https://sinaloa.gob.mx/topolobampo-se-consolida-como-polo-de-desarrollo-y-bienestar-con-la-planta-proman-gpo/',
  },
  'dof-plb': {
    fuente: 'DOF, Acuerdo por el que se emite la declaratoria del Polo de Desarrollo Económico para el Bienestar Puerta Logística del Bajío, Guanajuato (21 de julio de 2025): cuadros de construcción de tres polígonos con sus curvas, 52.41 ha en Celaya; a 5 km de la carretera 51 y a 2 km de la 45D, con acceso directo a las vías de CPKC y Ferromex, a 15 km del aeropuerto de Celaya; ya dispone de vialidades, energía eléctrica, agua potable, drenaje y conectividad; sus vocaciones productivas y su propiedad (el Gobierno de Guanajuato)',
    url: 'https://dof.gob.mx/nota_detalle.php?codigo=5763405&fecha=21/07/2025',
  },
  'economia-plb': {
    fuente: 'Secretaría de Economía, portal de los Polos de Desarrollo, ficha de Puerta Logística del Bajío: convergencia de Ferromex y CPKC, proyecto de sección aduanera, disponibilidad eléctrica para operaciones de logística',
    url: 'https://podecobi.economia.gob.mx/polos-de-desarrollo',
  },
  'celaya-plb': {
    fuente: 'Municipio de Celaya, agosto de 2024: firma del puerto seco intermodal «Puerta Logística del Bajío» con el grupo español AZVI, CPKC y Ferromex; 51 ha cerca de la armadora Honda, al sur del municipio, con 2 mil millones de pesos en su primera etapa',
    url: 'https://www.celaya.gob.mx/likcitsci/comunicados/2024/celaya-sera-el-centro-logistico-y-comercial-mas-importante-del-pais-jmm/',
  },
  'guanajuato-carta': {
    fuente: 'Gobierno de Guanajuato, 26 de junio de 2025: la gobernadora firma en Palacio Nacional la carta de intención del polo; la primera etapa ocupa 51 ha y puede crecer a 200, y por Celaya pasa el 23 % de la carga ferroviaria del país',
    url: 'https://boletines.guanajuato.gob.mx/2025/06/26/firman-carta-de-intencion-para-impulsar-el-proyecto-de-la-puerta-logistica-del-bajio/',
  },
  'economista-plb': {
    fuente: 'El Economista, entrevista con el director de Guanajuato Puerto Interior, reproducida en el blog de GPI (11 de marzo de 2026): la Puerta Logística del Bajío empezaría su obra en 2026 y operaría en 2027, con 2,500 millones de pesos de Cointer México (Grupo AZVI), 12 km de vías, seis naves de 10,800 m² y una refrigerada, 144 mil toneladas de almacenamiento y una sección aduanal',
    url: 'https://puertointerior.guanajuato.gob.mx/blog/2026/03/11/puerta-logistica-del-bajio-sera-ancla-de-desarrollo-en-la-region/',
  },
  'dof-salina-cruz': {
    fuente: 'DOF, Acuerdo por el que se emite la declaratoria del Polo de Desarrollo para el Bienestar Salina Cruz (12 de mayo de 2023): cuadro de construcción con tres curvas, 82.09 ha; a 3 km de la línea Z, a pie de la carretera estatal a San Antonio Monterrey y de la avenida Oleoducto, a 2.5 km de la MEX-185 y a 8 km del puerto; sus vocaciones productivas y su propiedad (el INDAABIN la aportó al Corredor Interoceánico)',
    url: 'https://dof.gob.mx/nota_detalle.php?codigo=5688610&fecha=12/05/2023',
  },
  'ciit-salina-cruz': {
    fuente: 'Corredor Interoceánico, ficha del PODEBI Salina Cruz (22 de junio de 2023): 82.08 ha cerca de la avenida Oleoducto y de la refinería Antonio Dovalí',
    url: 'https://www.gob.mx/ciit/articulos/podebi-salina-cruz',
  },
  'oaxaca-salina-cruz': {
    fuente: 'Gobierno de Oaxaca (Sedeco), 19 de septiembre de 2024: avances y arranque de las obras del polo; Desarrolladora Multimodal del Istmo invertirá más de 5 mil millones en su primera etapa, y el polo queda a 2 km de la línea Z',
    url: 'https://www.oaxaca.gob.mx/sedeco/avances-del-proyecto-del-polo-de-desarrollo-para-el-bienestar-de-salina-cruz-consolidan-la-transformacion-en-oaxaca/',
  },
  'dof-arriaga': {
    fuente: 'DOF, Acuerdo por el que se emite la declaratoria del Polo de Desarrollo para el Bienestar Arriaga (8 de junio de 2026): cuadro de construcción de la Finca Rústica El Cocal, 48.83 ha; colindante con la Línea K y a 3 km de la estación Arriaga, a pie del libramiento Arriaga–Tapanatepec y a 5 km de la MEX-200; sus vocaciones productivas y su propiedad (el ayuntamiento la aportó al Corredor Interoceánico)',
    url: 'https://dof.gob.mx/nota_detalle.php?codigo=5789894&fecha=08/06/2026',
  },
  'dof-tapachula-i': {
    fuente: 'DOF, Acuerdo por el que se emite la declaratoria del Polo de Desarrollo para el Bienestar Tapachula I (8 de abril de 2025): cuadros de construcción de la poligonal general «A» (268.73 ha) y de los derechos de vía de una línea eléctrica de la CFE (1.94 ha) y del ramal ferroviario KA (3.62 ha), que se excluyen: 263.17 ha; aledaño a la línea KA, con frente a la autopista MEX-225 Tapachula–Puerto de San Benito, a 5.22 km de Puerto Chiapas; sus vocaciones productivas y su propiedad (el INDAABIN la aportó al Corredor Interoceánico)',
    url: 'https://dof.gob.mx/nota_detalle.php?codigo=5754325&fecha=08/04/2025',
  },
  'dof-tapachula-ii': {
    fuente: 'DOF, Acuerdo por el que se emite la declaratoria del Polo de Desarrollo para el Bienestar Tapachula II (8 de abril de 2025): cuadro de construcción del polígono «C» con dos curvas, 149.72 ha; a 0.75 km de la línea KA, a pie de la carretera estatal a Playa Linda, a 2.74 km de la MEX-225 y a 0.59 km de Puerto Chiapas; sus vocaciones productivas y su propiedad (el INDAABIN la aportó al Corredor Interoceánico)',
    url: 'https://dof.gob.mx/nota_detalle.php?codigo=5754326&fecha=08/04/2025',
  },
  'ciit-tapachula-i': {
    fuente: 'Corredor Interoceánico, ficha del PODEBI Tapachula I: convocatoria a su licitación pública internacional LPIBI-013AYH-PODEBI-2-2025 (DOF, 11 de junio de 2025) y segunda nota aclaratoria (17 de septiembre), que reabre el registro de interesados del 19 al 30 de septiembre',
    url: 'https://www.gob.mx/ciit/es/articulos/podebi-tapachula-i',
  },
  'ciit-tapachula-ii': {
    fuente: 'Corredor Interoceánico, ficha del PODEBI Tapachula II: convocatoria a su licitación pública internacional LPIBI-013AYH-PODEBI-3-2025 (DOF, 11 de junio de 2025) y segunda nota aclaratoria (17 de septiembre), que reabre el registro de interesados del 19 al 30 de septiembre',
    url: 'https://www.gob.mx/ciit/es/articulos/podebi-tapachula-ii',
  },
  'dof-teapa': {
    fuente: 'DOF, Acuerdo por el que se emite la declaratoria del Polo de Desarrollo para el Bienestar Teapa (8 de junio de 2026): cuadro de construcción de 171 vértices en UTM y en coordenadas geográficas, 96.14 ha; aledaño a la línea FA (y, más adelante, a 4 km de ella), a 6 km de la MEX-195 y a 8 km de Teapa; sus vocaciones productivas y su propiedad (el Gobierno de Tabasco la aportó al Corredor Interoceánico)',
    url: 'https://dof.gob.mx/nota_detalle.php?codigo=5789895&fecha=08/06/2026',
  },
  'dof-durango': {
    fuente: 'DOF, Acuerdo por el que se emite la declaratoria del Polo de Desarrollo Económico para el Bienestar Centro Logístico e Industrial de Durango (26 de agosto de 2025): cuadros de construcción del polígono 1 y de las reservas 1, 2, 4 y 5, 315.42 ha; a pie de la carretera 40D y de la vía férrea, a 780 m de la zona urbana Cinco de Mayo y a 4 km del aeropuerto; ya dispone de vialidades, energía eléctrica, agua potable, drenaje y conectividad; sus vocaciones productivas y su propiedad (el estado de Durango)',
    url: 'https://dof.gob.mx/nota_detalle.php?codigo=5766563&fecha=26/08/2025',
  },
  'congreso-durango-fermaca': {
    fuente: 'Congreso del Estado de Durango, 21 de abril de 2026: autoriza donar 50 ha del Centro Logístico Industrial de Durango a Fermaca Digital para un centro de datos, con unos 2,700 millones de dólares y por lo menos mil empleos directos',
    url: 'https://congresodurango.gob.mx/2026/04/21/autoriza-congreso-terreno-para-fermaca-digital-city/',
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

function interiorNezahualcoyotl(g) {
  return {
    nombre: 'Nezahualcóyotl',
    lugar: 'Nezahualcóyotl, Estado de México',
    sectores: ['computacion', 'textil', 'alimentos', 'farmaceutica', 'dispositivos-medicos'],
    fuentesLista: ['dof-nezahualcoyotl', 'neza-polo', 'osm', 'sict-dos-bocas'],
    realNota:
      'El polo real: declarado el 7 de agosto de 2025 (DOF) en cuatro lotes del Gobierno del Estado de México junto al Bordo de Xochiaca. El municipio anunció, para su primera etapa, unos 800 millones de pesos de inversión y 4,500 empleos directos. No se ha reportado obra ni empresas: sus lotes y su acomodo son del juego.',
    frentes: FRENTES_COMUNES,
    frentesDato: {
      dato: 'La declaratoria dice que el predio ya «cuenta con infraestructura urbana básica» y adentro tiene gas, electricidad y red férrea; para lotes de empresas hace falta llevarlas a cada uno. El juego usa los mismos frentes que en Huamantla, con las mismas partes del costo: 40 % vialidades e iluminación, 25 % agua y drenaje, 25 % energía, 10 % un centro de servicios (estimación del juego). Cada uno de sus cuatro lotes catastrales lleva su calle; se hacen uno tras otro.',
      fuentes: ['dof-nezahualcoyotl', 'juego'],
    },
    espuela: {
      km: g.espuela.km,
      via: g.espuela.via,
      operador: g.espuela.operador,
      mesesMinimos: 2,
      dato: `La declaratoria dice que el predio tiene red férrea: la ${g.espuela.via} de ${g.espuela.operador} pasa junto a él (OpenStreetMap). La espuela del juego es el tramo de esa vía al predio, ${km(g.espuela.km)} km, con su cambio de vía: cuesta por km lo que el ramal a Dos Bocas (SICT) y tarda por lo menos 2 meses (estimación del juego).`,
      fuentes: ['dof-nezahualcoyotl', 'osm', 'sict-dos-bocas', 'juego'],
    },
    energia: {
      mva: ENERGIA.polos.nezahualcoyotl.mw,
      fuenteCorta: 'Sener, en la declaratoria',
      kmLinea: g.conexionElectrica.km,
      dato: `La Secretaría de Energía, en la declaratoria: su demanda crecerá «de 5 a 7.7 MW de 2027 a 2030»; la subestación de distribución más cercana está a 1.8 km y en alta tensión se conectaría a la subestación Nezahualcóyotl, de 85 kV, con una línea de unos 0.2 km. La línea de 85 kV más cercana a la subestación del juego queda a ${km(g.conexionElectrica.km)} km (OpenStreetMap).`,
      fuentes: ['dof-nezahualcoyotl', 'osm'],
    },
    lotes: {
      lista: listaLotes(g),
      dato: `Cuatro lotes catastrales del estado: 3-C (29.2 ha), 3-B (21.0), 7-D (15.6) y 7-E (2.6). No hay lotes de empresas publicados. El juego les da la parte que Coatzacoalcos I tiene de uso industrial (76.46 %): ${km(haLotes(g))} ha en ${nLotes(g)} lotes de 1.5 a 6 ha, chicos como los de una ciudad, y 1.5 ha de servicios a la entrada del lote 3-C; lo demás es área común y reserva (estimación del juego). Sus empleos son los que anunció el municipio para su primera etapa, 4,500.`,
      fuentes: ['dof-nezahualcoyotl', 'dof-coatzacoalcos-i', 'neza-polo', 'juego'],
    },
    vocaciones: ['Logística', 'Economía digital', 'Servicios tecnológicos', 'Electrónica', 'Industria ligera', 'Farmacéutico y dispositivos médicos'],
    vocacionesDato: {
      dato: 'Vocaciones productivas de la declaratoria (DOF). En el juego, electrónica es el equipo de computación y electrónico; industria ligera, la textil y la alimentaria (estimación del juego); farmacéutico y dispositivos médicos, sus dos sectores. Logística, economía digital y servicios tecnológicos no son manufactura: el juego no los ofrece para un lote.',
      fuentes: ['dof-nezahualcoyotl'],
    },
  };
}

function interiorReservaZapotlan(g) {
  return {
    nombre: 'Reserva Zapotlán',
    lugar: 'Zapotlán de Juárez, Hidalgo',
    sectores: ['farmaceutica', 'dispositivos-medicos', 'transporte', 'productos-metalicos', 'maquinaria', 'electricos', 'computacion'],
    fuentesLista: ['dof-zapotlan', 'presidencia-zapotlan', 'osm', 'sict-dos-bocas'],
    realNota:
      'El polo real: declarado el 30 de junio de 2025 (DOF) en terrenos del Gobierno de Hidalgo, junto al parque industrial QUMA. El 19 de agosto de 2026 la Presidencia anunció que la desarrolladora DEWA invertirá 10,106 millones para urbanizarlo en cinco fases; la primera, 1,277 millones de urbanización y 2,000 millones para sus dos primeras naves, con obra desde septiembre y 5,100 empleos directos e indirectos. No se ha reportado que la obra empezara: sus lotes y su acomodo son del juego.',
    frentes: FRENTES_COMUNES,
    frentesDato: {
      dato: 'La declaratoria dice que «requiere obras de infraestructura, previamente identificadas por el estado de Hidalgo, de alrededor de 5 mil millones de pesos»: de ahí sale el costo por hectárea de todos los polos del juego. DEWA, su desarrollador, pone 1,277 millones en la urbanización de la primera fase de cinco (Presidencia). Los frentes son los de Huamantla, con las mismas partes del costo: 40 % vialidades e iluminación, 25 % agua y drenaje, 25 % energía, 10 % un centro de servicios (estimación del juego).',
      fuentes: ['dof-zapotlan', 'presidencia-zapotlan', 'juego'],
    },
    espuela: {
      km: g.espuela.km,
      via: g.espuela.via,
      operador: g.espuela.operador,
      mesesMinimos: 2,
      dato: `La declaratoria no habla de tren. Junto al polo pasa la vía México–Pachuca: en la red del juego de 2018 es de Ferrosur y está en servicio; hoy se rehace para el tren de pasajeros México–Pachuca (Presidencia), y OpenStreetMap la marca en obra. La espuela del juego va a ella: ${km(g.espuela.km)} km, con su cambio de vía. Cuesta por km lo que el ramal a Dos Bocas (SICT) y tarda por lo menos 2 meses (estimación del juego).`,
      fuentes: ['osm', 'presidencia-zapotlan', 'sict-dos-bocas', 'juego'],
    },
    energia: {
      mva: ENERGIA.polos['reserva-zapotlan'].mw,
      fuenteCorta: 'Sener, en la declaratoria',
      kmLinea: g.conexionElectrica.km,
      dato: `La declaratoria: «en su etapa madura este PODECOBI alcance una demanda de electricidad de 20 MW», de 8 a 12 MW entre 2028 y 2030; la subestación de distribución más cercana está a 20 km y en alta tensión se conectaría a la subestación Tizayuca, a unos 24 km. La línea de alta tensión más cercana a la subestación del juego queda a ${km(g.conexionElectrica.km)} km (OpenStreetMap).`,
      fuentes: ['dof-zapotlan', 'osm'],
    },
    lotes: {
      lista: listaLotes(g),
      dato: `La declaratoria da al polígono un uso logístico, industrial y de servicios y no publica lotes; DEWA anunció dos naves en su primera fase. El juego les da a los lotes la parte que Coatzacoalcos I tiene de uso industrial (76.46 %): ${km(haLotes(g))} ha en ${nLotes(g)} lotes de 15 a 60 ha, y 6 ha de servicios a la entrada, del lado de la autopista; lo demás es área común y reserva (estimación del juego).`,
      fuentes: ['dof-zapotlan', 'dof-coatzacoalcos-i', 'presidencia-zapotlan', 'juego'],
    },
    vocaciones: ['Logístico', 'Manufactura', 'Farmacéutico y dispositivos médicos', 'Automotriz', 'Aeroespacial'],
    vocacionesDato: {
      dato: 'Vocaciones productivas de la declaratoria (DOF). En el juego, automotriz y aeroespacial son el equipo de transporte; manufactura, a secas, son los productos metálicos, la maquinaria, los aparatos eléctricos y la electrónica (estimación del juego); farmacéutico y dispositivos médicos, sus dos sectores. Logístico no es manufactura: el juego no lo ofrece para un lote.',
      fuentes: ['dof-zapotlan'],
    },
  };
}

function interiorSanJeronimo(g) {
  const otra = g.espuela.masCercana;
  return {
    nombre: 'San Jerónimo',
    lugar: 'Juárez, Chihuahua',
    sectores: ['transporte', 'electricos', 'dispositivos-medicos'],
    fuentesLista: ['dof-san-jeronimo', 'chihuahua-polo', 'chihuahua-acuerdo', 'chihuahua-informe-2026', 'economia-san-jeronimo', 'osm', 'sict-dos-bocas'],
    realNota:
      'El polo real: el Gobierno de Chihuahua lo propuso en un predio suyo junto al cruce fronterizo San Jerónimo–Santa Teresa; la gobernadora firmó el acuerdo en Palacio Nacional el 26 de junio de 2025 y la declaratoria salió el 30 (DOF). En su 4.º Informe, el 1 de marzo de 2026, anunció 315 millones del estado para el polo. No se ha reportado obra ni empresas: sus lotes y su acomodo son del juego.',
    frentes: FRENTES_COMUNES,
    frentesDato: {
      dato: 'La declaratoria dice que el predio tiene uso de suelo industrial e «infraestructura urbana básica», y adentro gas y electricidad; para lotes de empresas hace falta llevarlas a cada uno. El juego usa los mismos frentes que en Huamantla, con las mismas partes del costo: 40 % vialidades e iluminación, 25 % agua y drenaje, 25 % energía, 10 % un centro de servicios (estimación del juego).',
      fuentes: ['dof-san-jeronimo', 'juego'],
    },
    espuela: {
      km: g.espuela.km,
      via: g.espuela.via,
      operador: g.espuela.operador,
      mesesMinimos: 2,
      dato: `La declaratoria lo pone «a 15 km de la red férrea». La vía más cercana es la ${otra.via} de ${otra.operador}, a ${km(otra.km)} km, del otro lado de la frontera; la espuela del juego va a la más cercana de México, la ${g.espuela.via} de ${g.espuela.operador}, en Ciudad Juárez: ${km(g.espuela.km)} km en línea recta (OpenStreetMap). Cuesta por km lo que el ramal a Dos Bocas (SICT) y tarda por lo menos 2 meses (estimación del juego). Al firmar el acuerdo del polo, la gobernadora pidió a la Presidenta apoyo para renovar el cruce San Jerónimo–Santa Teresa y «adaptar la infraestructura ferroviaria» (Gobierno de Chihuahua).`,
      fuentes: ['dof-san-jeronimo', 'osm', 'chihuahua-acuerdo', 'sict-dos-bocas', 'juego'],
    },
    energia: {
      mva: ENERGIA.polos['san-jeronimo'].mw,
      fuenteCorta: 'Economía',
      kmLinea: g.conexionElectrica.km,
      dato: `Disponibilidad «de hasta 20 MW» (portal de Economía); la declaratoria dice que el predio ya tiene electricidad. La línea de alta tensión más cercana a la subestación del juego queda a ${km(g.conexionElectrica.km)} km (OpenStreetMap).`,
      fuentes: ['economia-san-jeronimo', 'dof-san-jeronimo', 'osm'],
    },
    lotes: {
      lista: listaLotes(g),
      dato: `La declaratoria da al predio uso de suelo industrial y no publica lotes. Su cuadro encierra 56.46 ha, no las 60.32 que declara. El juego les da a los lotes la parte que Coatzacoalcos I tiene de uso industrial (76.46 % de las 60.32 ha): ${km(haLotes(g))} ha en ${nLotes(g)} lotes de 2 a 10 ha, y 1.5 ha de servicios a la entrada; lo demás es área común y reserva (estimación del juego).`,
      fuentes: ['dof-san-jeronimo', 'dof-coatzacoalcos-i', 'juego'],
    },
    vocaciones: ['Logística', 'Centro de innovación industrial', 'Automotriz', 'Electromovilidad', 'Dispositivos médicos', 'Servicios tecnológicos'],
    vocacionesDato: {
      dato: 'Vocaciones productivas de la declaratoria (DOF). En el juego, automotriz es el equipo de transporte; electromovilidad, el equipo de transporte y los aparatos eléctricos, donde están las baterías (estimación del juego); dispositivos médicos, su sector. Logística, centro de innovación industrial y servicios tecnológicos no son manufactura: el juego no los ofrece para un lote.',
      fuentes: ['dof-san-jeronimo'],
    },
  };
}

function interiorParqueIndustrialBajio(g) {
  const ha = (nombre) => km(g.piezas.find((q) => q.nombre === nombre).ha);
  return {
    nombre: 'Parque Industrial Bajío',
    lugar: 'Zinapécuaro, Michoacán',
    sectores: ['alimentos', 'transporte', 'electricos', 'maquinaria'],
    fuentesLista: ['dof-bajio', 'michoacan-citelis', 'michoacan-areas', 'scop-bajio', 'sedeco-fideicomiso', 'presidencia-plan-michoacan', 'economia-bajio', 'osm', 'sict-dos-bocas'],
    realNota:
      'El polo real: declarado el 7 de julio de 2025 (DOF) en terrenos del Gobierno de Michoacán. El 7 de agosto Citelis anunció su primera inversión, mil millones; el 30 de enero de 2026 el estado entregó sus dos primeras áreas de desarrollo a Grupo Herso y Citelis, que harán obras de infraestructura por más de 6,300 millones, y en febrero la SCOP terminó su infraestructura base: un tanque de agua de 200 m³, el cerco y la línea eléctrica. Su fideicomiso se firmó el 20 de agosto, y la Presidencia reportó el 4 de noviembre que ese mes empieza su obra de infraestructura y su conexión con la Carretera Federal 120, con 9,310 millones estimados. No se han reportado empresas instaladas: sus lotes y su acomodo son del juego.',
    frentes: FRENTES_COMUNES,
    frentesDato: {
      dato: 'La declaratoria dice que el polígono ya «dispone de vialidades, energía eléctrica, agua potable, drenaje y conectividad», y la SCOP le hizo un tanque de agua y le amplió la línea eléctrica; para lotes de empresas hace falta llevarlas adentro. El juego usa los mismos frentes que en Huamantla, con las mismas partes del costo: 40 % vialidades e iluminación, 25 % agua y drenaje, 25 % energía, 10 % un centro de servicios (estimación del juego). Cada uno de sus tres polígonos lleva su calle; se hacen uno tras otro.',
      fuentes: ['dof-bajio', 'scop-bajio', 'juego'],
    },
    espuela: {
      km: g.espuela.km,
      via: g.espuela.via,
      operador: g.espuela.operador,
      mesesMinimos: 2,
      dato:
        g.espuela.km < 0.05
          ? `La declaratoria le da «acceso directo a la red férrea a cargo de Kansas City Southern de México», hoy CPKC: su ${g.espuela.via} corre pegada al polígono 3, por Estación Queréndaro (OpenStreetMap). La espuela del juego es solo su cambio de vía: como cuesta por km lo que el ramal a Dos Bocas (SICT), no cuesta nada, y tarda por lo menos 2 meses (estimación del juego).`
          : `La declaratoria le da «acceso directo a la red férrea a cargo de Kansas City Southern de México», hoy CPKC. La espuela del juego va de la ${g.espuela.via} (${g.espuela.operador}), la más cercana, al polo: ${km(g.espuela.km)} km en línea recta (OpenStreetMap). Cuesta por km lo que el ramal a Dos Bocas (SICT) y tarda por lo menos 2 meses (estimación del juego).`,
      fuentes: ['dof-bajio', 'osm', 'sict-dos-bocas', 'juego'],
    },
    energia: {
      mva: ENERGIA.polos['parque-industrial-bajio'].mw,
      fuenteCorta: 'Economía',
      kmLinea: g.conexionElectrica.km,
      dato: `«12.9 MW disponible (hidroeléctrica y geotérmica)» (portal de Economía; la Sedeco lo repite al firmar su fideicomiso). La SCOP ya le amplió la línea de media tensión. La línea de alta tensión más cercana a la subestación del juego queda a ${km(g.conexionElectrica.km)} km (OpenStreetMap).`,
      fuentes: ['economia-bajio', 'sedeco-fideicomiso', 'scop-bajio', 'osm'],
    },
    lotes: {
      lista: listaLotes(g),
      dato: `Tres polígonos, de ${ha('Polígono 1')}, ${ha('Polígono 2')} y ${ha('Polígono 3')} ha, su camino de acceso (5.92 ha) y una parcela de 1 ha que la declaratoria no explica. No hay lotes publicados: el estado entregó sus dos primeras áreas de desarrollo a Grupo Herso y Citelis, que las urbanizan. El juego les da a los lotes la parte que Coatzacoalcos I tiene de uso industrial (76.46 %): ${km(haLotes(g))} ha en ${nLotes(g)} lotes de 5 a 30 ha, y 4 ha de servicios a la entrada del polígono 1; lo demás es área común y reserva (estimación del juego). Sus empleos son los que calcula la Sedeco para sus primeros 10 años, 27 mil.`,
      fuentes: ['dof-bajio', 'michoacan-areas', 'dof-coatzacoalcos-i', 'juego'],
    },
    vocaciones: ['Agroindustrial', 'Automotriz y autopartes', 'Electrodomésticos', 'Logístico', 'Maquinaria y equipo'],
    vocacionesDato: {
      dato: 'Vocaciones productivas de la declaratoria (DOF). En el juego, agroindustrial es la industria alimentaria; automotriz y autopartes, el equipo de transporte; electrodomésticos, los aparatos eléctricos; maquinaria y equipo, su sector. Logístico no es manufactura: el juego no lo ofrece para un lote.',
      fuentes: ['dof-bajio'],
    },
  };
}

function interiorHermosillo(g) {
  const ha = (nombre) => km(g.piezas.find((q) => q.nombre === nombre).ha);
  const h3 = g.subestaciones.find((x) => /Hermosillo 3/.test(x.nombre));
  const [sx, sy] = g.servicios.subestacion;
  const kmH3 = Number((Math.hypot(h3.x - sx, h3.y - sy) / 1000).toFixed(2));
  return {
    nombre: 'Bienestar e Innovación de Hermosillo',
    lugar: 'Hermosillo, Sonora',
    sectores: ['transporte', 'semiconductores', 'computacion', 'alimentos', 'generacion-electrica', 'dispositivos-medicos'],
    fuentesLista: ['dof-hermosillo', 'sonora-incorpora', 'sonora-presentacion', 'osm', 'sict-dos-bocas'],
    realNota:
      'El polo real: el gobernador anunció su incorporación al programa en la conferencia matutina, en junio de 2025, con «más de 100 hectáreas disponibles», y la declaratoria salió el 26 de agosto con 546 (DOF). El 5 de abril de 2026 el Gobierno de Sonora lo presentó junto con su alianza con Arizona y Taiwán para atraer inversión y formar talento en semiconductores y electromovilidad. No se ha reportado obra ni empresas: sus lotes y su acomodo son del juego.',
    frentes: FRENTES_COMUNES,
    frentesDato: {
      dato: 'La declaratoria dice que el inmueble tiene uso de suelo industrial e «infraestructura urbana básica», con su manifestación de impacto ambiental aprobada en julio de 2024; para lotes de empresas hace falta llevarla a cada uno. El juego usa los mismos frentes que en Huamantla, con las mismas partes del costo: 40 % vialidades e iluminación, 25 % agua y drenaje, 25 % energía, 10 % un centro de servicios (estimación del juego). Cada una de sus tres secciones lleva su calle; se hacen una tras otra.',
      fuentes: ['dof-hermosillo', 'juego'],
    },
    espuela: {
      km: g.espuela.km,
      via: g.espuela.via,
      operador: g.espuela.operador,
      mesesMinimos: 2,
      dato: `La declaratoria le da «acceso ferroviario (a 2 km)». La espuela del juego va de la ${g.espuela.via} (${g.espuela.operador}), la más cercana, al polo: ${km(g.espuela.km)} km en línea recta (OpenStreetMap). Cuesta por km lo que el ramal a Dos Bocas (SICT) y tarda por lo menos 2 meses (estimación del juego).`,
      fuentes: ['dof-hermosillo', 'osm', 'sict-dos-bocas', 'juego'],
    },
    energia: {
      mva: ENERGIA.polos.hermosillo.mw,
      fuenteCorta: 'Sener, en la declaratoria',
      kmLinea: g.conexionElectrica.km,
      dato: `La Secretaría de Energía, en la declaratoria: su demanda irá «de 1 MW a 7 MW de 2026 a 2030», servida desde la subestación Hermosillo Tres, de 115 kV, con una línea de unos 3.6 km, y en 2038 esa subestación tendría un segundo banco de 40 MVA; el gas, hasta 75 millones de m³ al año (Energas de México). En OpenStreetMap, la subestación Hermosillo 3 queda a ${km(kmH3)} km de la subestación del juego, y la línea de 115 kV más cercana, a ${km(g.conexionElectrica.km)} km.`,
      fuentes: ['dof-hermosillo', 'osm'],
    },
    lotes: {
      lista: listaLotes(g),
      dato: `Tres secciones: el Lado A (${ha('Lado A')} ha), el Lado B (${ha('Lado B')}) y el PIAT (${ha('PIAT')}), que llena una muesca del Lado A. No hay lotes publicados. El juego les da a los lotes la parte que Coatzacoalcos I tiene de uso industrial (76.46 %): ${km(haLotes(g))} ha en ${nLotes(g)} lotes de 8 a 40 ha, y 5 ha de servicios a la entrada del Lado A; lo demás es área común y reserva (estimación del juego).`,
      fuentes: ['dof-hermosillo', 'dof-coatzacoalcos-i', 'juego'],
    },
    vocaciones: ['Automotriz', 'Semiconductores y electrónica especializada', 'Agroindustrial', 'Energía', 'Logística', 'Dispositivos médicos y de medición'],
    vocacionesDato: {
      dato: 'Vocaciones productivas de la declaratoria (DOF). En el juego, automotriz es el equipo de transporte; semiconductores y electrónica especializada, los semiconductores y la electrónica; agroindustrial, la industria alimentaria; energía, el equipo de generación y distribución de electricidad; dispositivos médicos y de medición, los dispositivos médicos (estimación del juego). Logística no es manufactura: el juego no la ofrece para un lote.',
      fuentes: ['dof-hermosillo'],
    },
  };
}

function interiorTopolobampo(g) {
  const ha = (nombre) => km(g.piezas.find((q) => q.nombre === nombre).ha);
  return {
    nombre: 'Topolobampo',
    lugar: 'Ahome, Sinaloa',
    sectores: ['quimica', 'petroquimica', 'plastico', 'metalicas'],
    fuentesLista: ['dof-topolobampo', 'dof-topolobampo-modifica', 'sinaloa-polos', 'sinaloa-proman', 'osm', 'sict-dos-bocas', 'energia-polos'],
    realNota:
      'El polo real: declarado el 20 de marzo de 2026 (DOF) en bienes del estado de Sinaloa; el 29 de abril se modificó su declaratoria para dejar fuera la donación a Rosendo G. Castro. A sus alrededores, según el Gobierno de Sinaloa, hay cuatro proyectos grandes, entre ellos la planta de amoniaco de Proman-GPO, que pasaba del 50 % de su obra en noviembre de 2025. No se ha reportado obra ni empresas en el polo: sus lotes y su acomodo son del juego.',
    frentes: FRENTES_COMUNES,
    frentesDato: {
      dato: 'La declaratoria dice que el polígono ya «dispone de vialidades, energía eléctrica, agua potable, drenaje y conectividad»; para lotes de empresas hace falta llevarlas adentro. El juego usa los mismos frentes que en Huamantla, con las mismas partes del costo: 40 % vialidades e iluminación, 25 % agua y drenaje, 25 % energía, 10 % un centro de servicios (estimación del juego). Cada uno de sus dos polígonos lleva su calle; se hacen uno tras otro.',
      fuentes: ['dof-topolobampo', 'juego'],
    },
    espuela: {
      km: g.espuela.km,
      via: g.espuela.via,
      operador: g.espuela.operador,
      mesesMinimos: 2,
      dato: `La declaratoria le da conexión ferroviaria y el puerto de Topolobampo. La espuela del juego va de la ${g.espuela.via} (${g.espuela.operador}), la más cercana, al polo: ${km(g.espuela.km)} km en línea recta (OpenStreetMap). Cuesta por km lo que el ramal a Dos Bocas (SICT) y tarda por lo menos 2 meses (estimación del juego).`,
      fuentes: ['dof-topolobampo', 'osm', 'sict-dos-bocas', 'juego'],
    },
    energia: energiaSinCifra(
      'topolobampo',
      g,
      `La declaratoria dice que tiene energía eléctrica, con «opciones identificadas para ampliar la disponibilidad de energía en el mediano plazo». La línea de alta tensión más cercana a su subestación queda a ${km(g.conexionElectrica.km)} km (OpenStreetMap).`
    ),
    lotes: {
      lista: listaLotes(g),
      dato: `Dos polígonos: el 2 (${ha('Polígono 2')} ha) y el 1 (${ha('Polígono 1')}). No hay lotes publicados. El juego les da a los lotes la parte que Coatzacoalcos I tiene de uso industrial (76.46 %): ${km(haLotes(g))} ha en ${nLotes(g)} lotes de 10 a 30 ha, y 4 ha de servicios a la entrada del polígono 2; lo demás es área común y reserva (estimación del juego). La donación a Rosendo G. Castro, junto al polígono 1, ya no es del polo.`,
      fuentes: ['dof-topolobampo', 'dof-topolobampo-modifica', 'dof-coatzacoalcos-i', 'juego'],
    },
    vocaciones: ['Manufactura avanzada', 'Logística', 'Industria química y petroquímica (fertilizantes)', 'Industria del plástico y del hule', 'Industrias metálicas básicas'],
    vocacionesDato: {
      dato: 'Vocaciones productivas de la declaratoria (DOF). En el juego, la industria química y petroquímica son dos sectores (los fertilizantes están en la química); el plástico y el hule, y las metálicas básicas, el suyo cada una. Manufactura avanzada no es un sector del censo y logística no es manufactura: el juego no las ofrece para un lote.',
      fuentes: ['dof-topolobampo'],
    },
  };
}

function interiorPuertaLogisticaBajio(g) {
  return {
    nombre: 'Puerta Logística del Bajío',
    lugar: 'Celaya, Guanajuato',
    sectores: ['transporte', 'alimentos', 'productos-metalicos', 'maquinaria', 'electricos', 'computacion'],
    fuentesLista: ['dof-plb', 'celaya-plb', 'guanajuato-carta', 'economista-plb', 'economia-plb', 'osm', 'sict-dos-bocas', 'energia-polos'],
    realNota:
      'El polo real: el Gobierno de Guanajuato firmó el proyecto en agosto de 2024 como un puerto seco intermodal, con el grupo español AZVI y las dos ferroviarias de Celaya, CPKC y Ferromex, y 2 mil millones en su primera etapa (municipio de Celaya). El 26 de junio de 2025 la gobernadora firmó en la conferencia matutina la carta de intención que lo hizo polo, y la declaratoria salió el 21 de julio (DOF). Su primera etapa ocupa 51 ha y puede crecer a 200. En marzo de 2026 el director de Guanajuato Puerto Interior dijo a El Economista que la obra empezaría ese año y operaría en 2027, con 2,500 millones de Cointer México (Grupo AZVI), 12 km de vías y siete naves, y que el puerto seco no pide mucha energía ni agua. No se ha reportado que su obra empezara: sus lotes y su acomodo son del juego.',
    frentes: FRENTES_COMUNES,
    frentesDato: {
      dato: 'La declaratoria dice que el polígono ya «dispone de vialidades, energía eléctrica, agua potable, drenaje y conectividad»; para lotes de empresas hace falta llevarlas adentro. El juego usa los mismos frentes que en Huamantla, con las mismas partes del costo: 40 % vialidades e iluminación, 25 % agua y drenaje, 25 % energía, 10 % un centro de servicios (estimación del juego). Cada uno de sus dos polígonos grandes lleva su calle; se hacen uno tras otro.',
      fuentes: ['dof-plb', 'juego'],
    },
    espuela: {
      km: g.espuela.km,
      via: g.espuela.via,
      operador: g.espuela.operador,
      mesesMinimos: 2,
      dato: `La declaratoria le da «acceso directo a vías férreas (CPKC y Ferromex)»: Celaya es donde se cruzan, y por ahí pasa el 23 % de la carga ferroviaria del país (Gobierno de Guanajuato). Pegados a su lado oeste corren ramales sin nombre (OpenStreetMap); la espuela del juego va a la línea principal más cercana, la ${g.espuela.via} (${g.espuela.operador}): ${km(g.espuela.km)} km en línea recta. Cuesta por km lo que el ramal a Dos Bocas (SICT) y tarda por lo menos 2 meses (estimación del juego).`,
      fuentes: ['dof-plb', 'guanajuato-carta', 'osm', 'sict-dos-bocas', 'juego'],
    },
    energia: energiaSinCifra(
      'puerta-logistica-bajio',
      g,
      `El portal de Economía solo dice «disponibilidad eléctrica para operaciones de logística». La línea de alta tensión más cercana a su subestación queda a ${km(g.conexionElectrica.km)} km (OpenStreetMap).`
    ),
    lotes: {
      lista: listaLotes(g),
      dato: `Tres polígonos: el II (48.83 ha), que rodea un rectángulo de 1.2 ha que no incluye; el I (3.29 ha), al sur, del otro lado de una calle curva de 25 m, y el III (0.29 ha), en la punta norte, que el juego deja de reserva. No hay lotes publicados. El juego les da a los lotes la parte que Coatzacoalcos I tiene de uso industrial (76.46 %): ${km(haLotes(g))} ha en ${nLotes(g)} lotes de 2 a 6 ha, del tamaño de las bodegas de un puerto seco, y 1.5 ha de servicios; lo demás es área común y reserva (estimación del juego).`,
      fuentes: ['dof-plb', 'dof-coatzacoalcos-i', 'juego'],
    },
    vocaciones: ['Industria', 'Manufacturera avanzada', 'Logística y transporte', 'Agroindustria de valor agregado', 'Tecnologías de la información y servicios empresariales', 'Automotriz', 'Aeroespacial'],
    vocacionesDato: {
      dato: 'Vocaciones productivas de la declaratoria (DOF). En el juego, automotriz y aeroespacial son el equipo de transporte; agroindustria, la industria alimentaria; industria, a secas, los productos metálicos, la maquinaria, los aparatos eléctricos y la electrónica, como la manufactura de Zapotlán (estimación del juego). Manufactura avanzada no es un sector del censo, y logística y tecnologías de la información no son manufactura: el juego no las ofrece para un lote.',
      fuentes: ['dof-plb'],
    },
  };
}

function interiorDurango(g) {
  return {
    nombre: 'Centro Logístico e Industrial de Durango',
    lugar: 'Durango, Durango',
    sectores: ['transporte', 'electricos', 'computacion', 'textil', 'papel'],
    fuentesLista: ['dof-durango', 'congreso-durango-fermaca', 'osm', 'sict-dos-bocas', 'energia-polos'],
    realNota:
      'El polo real: declarado el 26 de agosto de 2025 (DOF) en terrenos públicos del estado de Durango. El 21 de abril de 2026 el Congreso de Durango autorizó donar 50 ha del Centro Logístico Industrial de Durango a Fermaca Digital, para un centro de datos de unos 2,700 millones de dólares y por lo menos mil empleos directos; la nota no dice si esas hectáreas quedan dentro del polígono del polo. Sus lotes y su acomodo son del juego.',
    frentes: FRENTES_COMUNES,
    frentesDato: {
      dato: 'La declaratoria dice que el polígono ya «dispone de vialidades, energía eléctrica, agua potable, drenaje y conectividad»; para lotes de empresas hace falta llevarlas adentro. El juego usa los mismos frentes que en Huamantla, con las mismas partes del costo: 40 % vialidades e iluminación, 25 % agua y drenaje, 25 % energía, 10 % un centro de servicios (estimación del juego).',
      fuentes: ['dof-durango', 'juego'],
    },
    espuela: {
      km: g.espuela.km,
      via: g.espuela.via,
      operador: g.espuela.operador,
      mesesMinimos: 2,
      dato: `La declaratoria lo pone «a pie de paso de la carretera 40D, así como de la vía férrea existente». La espuela del juego va de la ${g.espuela.via} (${g.espuela.operador}), la más cercana, al polo: ${km(g.espuela.km)} km en línea recta (OpenStreetMap). Cuesta por km lo que el ramal a Dos Bocas (SICT) y tarda por lo menos 2 meses (estimación del juego).`,
      fuentes: ['dof-durango', 'osm', 'sict-dos-bocas', 'juego'],
    },
    energia: energiaSinCifra(
      'durango',
      g,
      `La declaratoria dice que dispone de energía eléctrica, sin cifra. La línea de alta tensión más cercana a su subestación queda a ${km(g.conexionElectrica.km)} km (OpenStreetMap).`
    ),
    lotes: {
      lista: listaLotes(g),
      dato: `El polígono 1 (272.16 ha) y cuatro reservas al norte (21.50, 6.28, 9.93 y 5.54 ha; la declaratoria no tiene reserva 3). No hay lotes publicados. El juego pone en el polígono 1 la parte que Coatzacoalcos I tiene de uso industrial (76.46 % de él): ${km(haLotes(g))} ha en ${nLotes(g)} lotes de 10 a 30 ha, y 4 ha de servicios a la entrada; las reservas quedan de reserva (estimación del juego).`,
      fuentes: ['dof-durango', 'dof-coatzacoalcos-i', 'juego'],
    },
    vocaciones: ['Movilidad eléctrica', 'Industria cinematográfica', 'Autopartes', 'Electrónica especializada', 'Manufactura avanzada', 'Industria textil', 'Industria de papel', 'Automotriz'],
    vocacionesDato: {
      dato: 'Vocaciones productivas de la declaratoria (DOF), que repite manufactura avanzada. En el juego, movilidad eléctrica es el equipo de transporte y los aparatos eléctricos, donde están las baterías; autopartes y automotriz, el equipo de transporte; electrónica especializada, la electrónica (estimación del juego); la textil y la del papel, sus sectores. Manufactura avanzada no es un sector del censo y la industria cinematográfica no es manufactura: el juego no las ofrece para un lote.',
      fuentes: ['dof-durango'],
    },
  };
}

function interiorSalinaCruz(g) {
  return {
    nombre: 'Salina Cruz',
    lugar: 'Salina Cruz, Oaxaca',
    sectores: ['computacion', 'semiconductores', 'transporte', 'dispositivos-medicos', 'farmaceutica', 'alimentos', 'generacion-electrica', 'maquinaria', 'metalicas', 'petroquimica'],
    fuentesLista: ['dof-salina-cruz', 'ciit-salina-cruz', 'oaxaca-salina-cruz', 'presidencia-istmo-2025', 'piciit-2026', 'osm', 'sict-dos-bocas', 'energia-polos'],
    realNota:
      'El polo real: declarado el 12 de mayo de 2023 (DOF) en un terreno federal que el INDAABIN aportó al Corredor Interoceánico, junto a la refinería Antonio Dovalí. Su licitación tuvo fallo en noviembre de 2023 y la ganó Desarrolladora Multimodal del Istmo; el 19 de septiembre de 2024 el Gobierno de Oaxaca presentó sus avances con el arranque de sus obras y una inversión del consorcio de más de 5 mil millones en su primera etapa, y la Presidenta lo dio por concesionado el 19 de febrero de 2025. En 2026 el Corredor reporta solo cinco polos del Istmo concesionados, sin decir cuáles. No se han reportado empresas: sus lotes y su acomodo son del juego.',
    frentes: FRENTES_COMUNES,
    frentesDato: {
      dato: 'La declaratoria no dice qué obras necesita el polo. El juego usa los mismos frentes que en Huamantla, con las mismas partes del costo: 40 % vialidades e iluminación, 25 % agua y drenaje, 25 % energía, 10 % un centro de servicios (estimación del juego).',
      fuentes: ['juego'],
    },
    espuela: {
      km: g.espuela.km,
      via: g.espuela.via,
      operador: g.espuela.operador,
      mesesMinimos: 2,
      dato: `El polo «se encuentra a 3 km de la vía férrea correspondiente a la línea Z» (DOF). La espuela del juego va de la ${g.espuela.via} (${g.espuela.operador}), la más cercana, al polo: ${km(g.espuela.km)} km en línea recta (OpenStreetMap). Cuesta por km lo que el ramal a Dos Bocas (SICT) y tarda por lo menos 2 meses (estimación del juego).`,
      fuentes: ['dof-salina-cruz', 'osm', 'sict-dos-bocas', 'juego'],
    },
    energia: energiaSinCifra('salina-cruz', g, `La línea de alta tensión más cercana a su subestación queda a ${km(g.conexionElectrica.km)} km (OpenStreetMap).`),
    lotes: {
      lista: listaLotes(g),
      dato: `Un polígono con tres curvas. No hay lotes publicados. El juego les da a los lotes la parte que la declaratoria de Coatzacoalcos I dice de uso industrial (76.46 %): ${km(haLotes(g))} ha en ${nLotes(g)} lotes de 4 a 12 ha, y 2 ha de servicios a la entrada; lo demás es área común y reserva (estimación del juego).`,
      fuentes: ['dof-salina-cruz', 'dof-coatzacoalcos-i', 'juego'],
    },
    vocaciones: ['Eléctrica y electrónica', 'Semiconductores', 'Automotriz (electromovilidad), autopartes y equipo de transporte', 'Dispositivos médicos', 'Farmacéutica', 'Agroindustria', 'Equipo de generación y distribución de energía eléctrica (energías limpias)', 'Maquinaria y equipo', 'Tecnologías de la Información y la Comunicación', 'Metales', 'Petroquímica'],
    vocacionesDato: {
      dato: 'Vocaciones productivas de la declaratoria (DOF), las mismas que las de Coatzacoalcos I. Tecnologías de la información no es manufactura: el juego no la ofrece para un lote.',
      fuentes: ['dof-salina-cruz'],
    },
  };
}

function interiorArriaga(g) {
  return {
    nombre: 'Arriaga',
    lugar: 'Arriaga, Chiapas',
    sectores: ['alimentos', 'generacion-electrica', 'metalicas'],
    fuentesLista: ['dof-arriaga', 'osm', 'sict-dos-bocas', 'energia-polos'],
    realNota:
      'El polo real: el ayuntamiento de Arriaga aportó el terreno, la Finca Rústica El Cocal, al Corredor Interoceánico (Periódico Oficial de Chiapas, 23 de julio de 2025), y la declaratoria salió el 8 de junio de 2026 (DOF). No se ha reportado licitación ni obra: sus lotes y su acomodo son del juego.',
    frentes: FRENTES_COMUNES,
    frentesDato: {
      dato: 'La declaratoria no dice qué obras necesita el polo. El juego usa los mismos frentes que en Huamantla, con las mismas partes del costo: 40 % vialidades e iluminación, 25 % agua y drenaje, 25 % energía, 10 % un centro de servicios (estimación del juego).',
      fuentes: ['juego'],
    },
    espuela: {
      km: g.espuela.km,
      via: g.espuela.via,
      operador: g.espuela.operador,
      mesesMinimos: 2,
      dato: `El polo «es colindante con la vía de la Línea K» y queda a 3 km de la estación Arriaga (DOF). La espuela del juego es el tramo de la ${g.espuela.via} (${g.espuela.operador}) al polo, ${km(g.espuela.km)} km, con su cambio de vía: cuesta por km lo que el ramal a Dos Bocas (SICT) y tarda por lo menos 2 meses (estimación del juego).`,
      fuentes: ['dof-arriaga', 'osm', 'sict-dos-bocas', 'juego'],
    },
    energia: energiaSinCifra('arriaga', g, `La línea de alta tensión más cercana a su subestación queda a ${km(g.conexionElectrica.km)} km (OpenStreetMap).`),
    lotes: {
      lista: listaLotes(g),
      dato: `Un polígono de nueve vértices. No hay lotes publicados. El juego les da a los lotes la parte que la declaratoria de Coatzacoalcos I dice de uso industrial (76.46 %): ${km(haLotes(g))} ha en ${nLotes(g)} lotes de 3 a 10 ha, y 1.5 ha de servicios a la entrada; lo demás es área común y reserva (estimación del juego).`,
      fuentes: ['dof-arriaga', 'dof-coatzacoalcos-i', 'juego'],
    },
    vocaciones: ['Agroindustria', 'Equipo de generación y distribución de energía eléctrica', 'Metales'],
    vocacionesDato: {
      dato: 'Vocaciones productivas de la declaratoria (DOF), «enunciativas y no limitativas». En el juego, agroindustria es la industria alimentaria; el equipo eléctrico, su sector, y metales, las industrias metálicas básicas.',
      fuentes: ['dof-arriaga'],
    },
  };
}

function interiorTapachulaI(g) {
  return {
    nombre: 'Tapachula I',
    lugar: 'Tapachula, Chiapas',
    sectores: ['computacion', 'semiconductores', 'transporte', 'dispositivos-medicos', 'farmaceutica', 'alimentos', 'generacion-electrica', 'maquinaria', 'metalicas', 'petroquimica'],
    fuentesLista: ['dof-tapachula-i', 'ciit-tapachula-i', 'osm', 'sict-dos-bocas', 'energia-polos'],
    realNota: 'El polo real: el INDAABIN aportó el terreno al Corredor Interoceánico (DOF, 16 de octubre de 2024) y la declaratoria salió el 8 de abril de 2025 (DOF). El Corredor convocó a su licitación internacional el 11 de junio de 2025, para concesionarlo 30 años, y en septiembre reabrió el registro de interesados; no se ha publicado un fallo. No se ha reportado obra: sus lotes y su acomodo son del juego.',
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
      dato: `El polo queda «aledaño a la línea KA», el ramal de Puerto Chiapas, cuyo derecho de vía lo cruza y se excluye (DOF). La espuela del juego va de la ${g.espuela.via} (${g.espuela.operador}), la más cercana, al polo: ${km(g.espuela.km)} km, con su cambio de vía. Cuesta por km lo que el ramal a Dos Bocas (SICT) y tarda por lo menos 2 meses (estimación del juego).`,
      fuentes: ['dof-tapachula-i', 'osm', 'sict-dos-bocas', 'juego'],
    },
    energia: energiaSinCifra('tapachula-i', g, `La línea de alta tensión más cercana a su subestación queda a ${km(g.conexionElectrica.km)} km (OpenStreetMap).`),
    lotes: {
      lista: listaLotes(g),
      dato: `La declaratoria le quita a su poligonal general los derechos de vía del ramal KA y de una línea eléctrica de la CFE, que la cruzan de lado a lado: quedan tres predios. No hay lotes publicados. El juego les da a los lotes la parte que la declaratoria de Coatzacoalcos I dice de uso industrial (76.46 %): ${km(haLotes(g))} ha en ${nLotes(g)} lotes de 5 a 25 ha, y 4 ha de servicios a la entrada del predio sur; lo demás es área común y reserva (estimación del juego).`,
      fuentes: ['dof-tapachula-i', 'dof-coatzacoalcos-i', 'juego'],
    },
    vocaciones: ['Eléctrica y electrónica', 'Semiconductores', 'Automotriz (electromovilidad), autopartes y equipo de transporte', 'Dispositivos médicos', 'Farmacéutica', 'Agroindustria', 'Equipo de generación y distribución de energía eléctrica (energías limpias)', 'Maquinaria y equipo', 'Tecnologías de la Información y la Comunicación', 'Metales', 'Petroquímica'],
    vocacionesDato: {
      dato: 'Vocaciones productivas de la declaratoria (DOF), las mismas que las de Coatzacoalcos I. Tecnologías de la información no es manufactura: el juego no la ofrece para un lote.',
      fuentes: ['dof-tapachula-i'],
    },
  };
}

function interiorTapachulaII(g) {
  return {
    nombre: 'Tapachula II',
    lugar: 'Tapachula, Chiapas',
    sectores: ['computacion', 'semiconductores', 'transporte', 'dispositivos-medicos', 'farmaceutica', 'alimentos', 'generacion-electrica', 'maquinaria', 'metalicas', 'petroquimica'],
    fuentesLista: ['dof-tapachula-ii', 'ciit-tapachula-ii', 'osm', 'sict-dos-bocas', 'energia-polos'],
    realNota: 'El polo real: el INDAABIN aportó el terreno al Corredor Interoceánico (DOF, 16 de octubre de 2024) y la declaratoria salió el 8 de abril de 2025 (DOF). El Corredor convocó a su licitación internacional el 11 de junio de 2025, para concesionarlo 30 años, y en septiembre reabrió el registro de interesados; no se ha publicado un fallo. No se ha reportado obra: sus lotes y su acomodo son del juego.',
    frentes: FRENTES_COMUNES,
    frentesDato: {
      dato: 'La declaratoria no dice qué obras necesita el polo. El juego usa los mismos frentes que en Huamantla, con las mismas partes del costo: 40 % vialidades e iluminación, 25 % agua y drenaje, 25 % energía, 10 % un centro de servicios (estimación del juego).',
      fuentes: ['juego'],
    },
    espuela: {
      km: g.espuela.km,
      via: g.espuela.via,
      operador: g.espuela.operador,
      mesesMinimos: 2,
      dato: `El polo queda a 0.75 km de la línea KA, el ramal de Puerto Chiapas (DOF). La espuela del juego va de la ${g.espuela.via} (${g.espuela.operador}), la más cercana, al polo: ${km(g.espuela.km)} km en línea recta (OpenStreetMap). Cuesta por km lo que el ramal a Dos Bocas (SICT) y tarda por lo menos 2 meses (estimación del juego).`,
      fuentes: ['dof-tapachula-ii', 'osm', 'sict-dos-bocas', 'juego'],
    },
    energia: energiaSinCifra('tapachula-ii', g, `La línea de alta tensión más cercana a su subestación queda a ${km(g.conexionElectrica.km)} km (OpenStreetMap).`),
    lotes: {
      lista: listaLotes(g),
      dato: `Un polígono con dos curvas, a 0.59 km de Puerto Chiapas. No hay lotes publicados. El juego les da a los lotes la parte que la declaratoria de Coatzacoalcos I dice de uso industrial (76.46 %): ${km(haLotes(g))} ha en ${nLotes(g)} lotes de 6 a 20 ha, y 3 ha de servicios a la entrada, por el camino que corre a su pie (la declaratoria lo llama carretera estatal a Playa Linda; OpenStreetMap, Ramal a Escolleras, con el número de la MEX-225); lo demás es área común y reserva (estimación del juego).`,
      fuentes: ['dof-tapachula-ii', 'dof-coatzacoalcos-i', 'juego'],
    },
    vocaciones: ['Eléctrica y electrónica', 'Semiconductores', 'Automotriz (electromovilidad), autopartes y equipo de transporte', 'Dispositivos médicos', 'Farmacéutica', 'Agroindustria', 'Equipo de generación y distribución de energía eléctrica (energías limpias)', 'Maquinaria y equipo', 'Tecnologías de la Información y la Comunicación', 'Metales', 'Petroquímica'],
    vocacionesDato: {
      dato: 'Vocaciones productivas de la declaratoria (DOF), las mismas que las de Coatzacoalcos I. Tecnologías de la información no es manufactura: el juego no la ofrece para un lote.',
      fuentes: ['dof-tapachula-ii'],
    },
  };
}

function interiorTeapa(g) {
  return {
    nombre: 'Teapa',
    lugar: 'Teapa, Tabasco',
    sectores: ['alimentos', 'petroquimica'],
    fuentesLista: ['dof-teapa', 'osm', 'sict-dos-bocas', 'energia-polos'],
    realNota: 'El polo real: el Gobierno de Tabasco aportó el terreno al Corredor Interoceánico (Periódico Oficial de Tabasco, 30 de abril de 2025) y la declaratoria salió el 8 de junio de 2026 (DOF). No se ha reportado licitación ni obra: sus lotes y su acomodo son del juego.',
    frentes: FRENTES_COMUNES,
    frentesDato: {
      dato: 'La declaratoria no dice qué obras necesita el polo. El juego usa los mismos frentes que en Huamantla, con las mismas partes del costo: 40 % vialidades e iluminación, 25 % agua y drenaje, 25 % energía, 10 % un centro de servicios (estimación del juego).',
      fuentes: ['juego'],
    },
    espuela: {
      km: g.espuela.km,
      via: g.espuela.via,
      operador: g.espuela.operador,
      mesesMinimos: 2,
      dato: `La declaratoria lo pone «aledaño a la línea FA» y, un párrafo después, a 4 km de ella. La espuela del juego va de la ${g.espuela.via} (${g.espuela.operador}), la más cercana, al polo: ${km(g.espuela.km)} km en línea recta (OpenStreetMap). Cuesta por km lo que el ramal a Dos Bocas (SICT) y tarda por lo menos 2 meses (estimación del juego).`,
      fuentes: ['dof-teapa', 'osm', 'sict-dos-bocas', 'juego'],
    },
    energia: energiaSinCifra('teapa', g, `La línea de alta tensión más cercana a su subestación queda a ${km(g.conexionElectrica.km)} km (OpenStreetMap).`),
    lotes: {
      lista: listaLotes(g),
      dato: `Un polígono de 171 vértices. No hay lotes publicados. El juego les da a los lotes la parte que la declaratoria de Coatzacoalcos I dice de uso industrial (76.46 %): ${km(haLotes(g))} ha en ${nLotes(g)} lotes de 5 a 15 ha, y 2 ha de servicios a la entrada; lo demás es área común y reserva (estimación del juego).`,
      fuentes: ['dof-teapa', 'dof-coatzacoalcos-i', 'juego'],
    },
    vocaciones: ['Agroindustria', 'Petroquímica', 'Comercio y logística'],
    vocacionesDato: {
      dato: 'Vocaciones productivas de la declaratoria (DOF), «enunciativas y no limitativas». En el juego, agroindustria es la industria alimentaria y petroquímica, su sector. Comercio y logística no son manufactura: el juego no los ofrece para un lote.',
      fuentes: ['dof-teapa'],
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
  [NEZAHUALCOYOTL, interiorNezahualcoyotl],
  [RESERVA_ZAPOTLAN, interiorReservaZapotlan],
  [SAN_JERONIMO, interiorSanJeronimo],
  [PARQUE_INDUSTRIAL_BAJIO, interiorParqueIndustrialBajio],
  [HERMOSILLO, interiorHermosillo],
  [TOPOLOBAMPO, interiorTopolobampo],
  [PUERTA_LOGISTICA_BAJIO, interiorPuertaLogisticaBajio],
  [DURANGO, interiorDurango],
  [SALINA_CRUZ, interiorSalinaCruz],
  [ARRIAGA, interiorArriaga],
  [TAPACHULA_I, interiorTapachulaI],
  [TAPACHULA_II, interiorTapachulaII],
  [TEAPA, interiorTeapa],
];
// `id…`: build only those polos and keep the others as they are in interiores.json.
// `--prueba [id…]`: build those polos (or all) and print how they come out, writing nothing.
const prueba = process.argv.includes('--prueba');
const solo = process.argv.slice(2).filter((x) => !x.startsWith('--'));
const INTERIORES = join(ROOT, 'src', 'lib', 'domain', 'datos', 'interiores.json');
await mkdir(join(ROOT, 'static', 'data', 'polos'), { recursive: true });
const polos = solo.length && !prueba ? JSON.parse(await readFile(INTERIORES, 'utf8')).polos : {};
const aConstruir = POLOS_INTERIOR.filter(([p]) => !solo.length || solo.includes(p.id));
// Everything the polos to build lack, from the extract in a single pass.
if (existsSync(PBF)) {
  const salidas = [];
  for (const [p] of aConstruir) {
    await construir(p, { soloCajas: true });
    salidas.push(...faltantes(p));
  }
  if (salidas.length) await desdeGeofabrik(salidas);
}
for (const [p, interior] of aConstruir) {
  const g = await construir(p);
  if (prueba) continue;
  await writeFile(join(ROOT, 'static', 'data', 'polos', `${p.id}.json`), JSON.stringify(g) + '\n');
  polos[p.id] = interior(g);
}
if (!prueba) await writeFile(
  INTERIORES,
  JSON.stringify({ corte: '2026-11-23', nota: 'Generado por scripts/polos/gen-interior.mjs.', fuentes: FUENTES, subestacion: SUBESTACION, polos }, null, 1) + '\n'
);
