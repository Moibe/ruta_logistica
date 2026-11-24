// Writes scripts/mineria/ubicaciones.json: where each mine is. From OpenStreetMap: the centre of the
// shape picked from what buscar-osm.mjs found (its open pit, its salt ponds, or a way with its
// name), or the town it's worked from when OpenStreetMap doesn't draw the mine; the card says which.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const ROOT = join(AQUI, '..', '..');
const OSM = 'OpenStreetMap';

/**
 * id → the file of .cache/osm/mineria and the element of it to take (`way` or `node`), with what to
 * say about it; or the place itself.
 */
export const ELEGIDAS = {
  'pena-colorada': { archivo: 'pena-colorada', way: 1192732548 },
  'cerro-de-mercado': { archivo: 'cerro-de-mercado', way: 1151613376 },
  'buenavista-del-cobre': { archivo: 'buenavista-del-cobre', way: 159983857 },
  'la-caridad': { archivo: 'la-caridad', way: 223041476 },
  'las-encinas': { archivo: 'las-encinas-alzada', way: 182350779 },
  'las-truchas': { archivo: 'tajo-las-truchas', way: 279301754, de: `${OSM}: el tajo más grande de la zona, sin nombre (estimación del juego)` },
  hercules: { archivo: 'tajo-hercules', way: 1262370953, de: `${OSM}: el tajo junto al pueblo de Hércules, sin nombre (estimación del juego)` },
  micare: { archivo: 'tajo-micare', way: 345567553, de: `${OSM}: el tajo grande al oriente de Nava, sin nombre (estimación del juego)` },
  mimosa: { archivo: 'lugar-palau', node: 2037552876, de: 'aproximada (estimación del juego): el pueblo de Palaú; ni AHMSA ni OpenStreetMap dan el lugar de sus minas' },
  'region-carbonifera': { archivo: 'lugar-sabinas', node: 298252745, de: `${OSM} (la ciudad de Sabinas): la ficha junta a muchos productores de la región` },
  'el-boleo': { archivo: 'lugar-santa-rosalia', node: 303082729, de: `${OSM}: Santa Rosalía, el pueblo de la mina, que no está dibujada (estimación del juego)` },
  'guerrero-negro': { archivo: 'guerrero-negro', way: 1381253171, de: `${OSM} («Exportadora de Sal - Terminal marítima», donde se cargan las barcazas)` },
};

const r5 = (x) => Math.round(x * 1e5) / 1e5;

/** The centre of an element of a cached answer: its box's middle for a way, itself for a node. */
export function centro(dir, e) {
  const d = JSON.parse(readFileSync(join(dir, `${e.archivo}.json`), 'utf8'));
  const x = d.elements.find((y) => y.id === (e.way ?? e.node) && y.type === (e.way ? 'way' : 'node'));
  if (!x) throw new Error(`${e.archivo}: ${e.way ? 'la vía' : 'el nodo'} ${e.way ?? e.node} no está`);
  if (x.type === 'node') return { lonLat: [r5(x.lon), r5(x.lat)], nombre: x.tags?.name };
  const g = x.geometry;
  const lonLat = [r5((Math.min(...g.map((p) => p.lon)) + Math.max(...g.map((p) => p.lon))) / 2), r5((Math.min(...g.map((p) => p.lat)) + Math.max(...g.map((p) => p.lat))) / 2)];
  return { lonLat, nombre: x.tags?.name };
}

// Run, not imported (industrias/ has scripts with the same names).
if (process.argv[1] && join(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = join(ROOT, '.cache', 'osm', 'mineria');
  const out = {};
  for (const [id, e] of Object.entries(ELEGIDAS)) {
    if (e.lonLat) {
      out[id] = { lonLat: e.lonLat, de: e.de };
      continue;
    }
    const c = centro(dir, e);
    out[id] = { lonLat: c.lonLat, de: e.de ?? (c.nombre ? `${OSM} («${c.nombre}»)` : OSM) };
  }
  writeFileSync(join(AQUI, 'ubicaciones.json'), JSON.stringify(out, null, 1) + '\n');
  console.log(Object.keys(out).length, 'ubicaciones');
}
