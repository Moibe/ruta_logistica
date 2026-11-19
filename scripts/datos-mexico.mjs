// Builds the geography of the Mexico board from Natural Earth 10m.
//
//   npm run datos
//
// Outputs (both committed, so the app never needs this script or the network):
//   static/data/mexico.topo.json        estados + vías férreas + países vecinos
//   src/lib/domain/datos/ciudades.json  ciudades de referencia
//
// The Natural Earth sources (~85 MB) are downloaded once into `.cache/ne/`
// (gitignored), pinned to one commit of nvkelso/natural-earth-vector so a rerun
// produces the same files. Attribute logic (Spanish names, which cities make the
// cut) lives here in plain JS; mapshaper only does geometry: dissolve, clip,
// simplify and the TopoJSON encoding.

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

function vias(railroads) {
  const [w, s, e, n] = MEXICO_BBOX;
  const touches = (g) =>
    (g.type === 'LineString' ? [g.coordinates] : g.coordinates).some((line) =>
      line.some(([lon, lat]) => lon > w && lon < e && lat > s && lat < n)
    );
  return {
    type: 'FeatureCollection',
    features: railroads.features
      .filter((f) => f.geometry && touches(f.geometry))
      .map((f) => ({
        type: 'Feature',
        // scalerank: lower = more important line. Kept to draw trunk lines
        // heavier than branches.
        properties: { rango: f.properties.scalerank, doble: f.properties.mult_track ? 1 : 0 },
        geometry: f.geometry,
      })),
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
    // Mexico as one polygon, only to clip the rail lines at the border.
    '-dissolve target=estados + name=pais',
    '-clip pais target=vias',
    '-drop target=pais',
    `-clip bbox=${w},${s},${e},${n} target=vecinos`,
    // ~250 m: below a pixel at the deepest zoom of the Mexico view.
    '-simplify interval=250 keep-shapes',
    '-filter-slivers min-area=2km2 target=vecinos',
    '-o format=topojson quantization=100000 mexico.topo.json target=estados,vias,vecinos',
  ].join(' '),
  inputs
);

await writeFile(join(ROOT, 'static', 'data', 'mexico.topo.json'), out['mexico.topo.json']);

const lista = ciudades(places);
await mkdir(join(ROOT, 'src', 'lib', 'domain', 'datos'), { recursive: true });
await writeFile(
  join(ROOT, 'src', 'lib', 'domain', 'datos', 'ciudades.json'),
  JSON.stringify(lista, null, 1) + '\n'
);

const kb = (x) => `${(Buffer.byteLength(x) / 1024).toFixed(0)} KB`;
console.log(`mexico.topo.json  ${kb(out['mexico.topo.json'])}`);
console.log(`ciudades.json     ${lista.length} ciudades`);
