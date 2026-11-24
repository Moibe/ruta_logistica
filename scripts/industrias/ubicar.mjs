// Writes scripts/industrias/ubicaciones.json: where each plant is. From OpenStreetMap when it has
// the plant: the centre of its shape in the Geofabrik extract (buscar-osm.mjs), or the point
// Overpass gave (buscar-overpass.mjs). Four it doesn't have by name are placed approximately, and
// their cards say so. The steel mills and the smelter come from the mining search (scripts/mineria).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { centro } from '../mineria/ubicar.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const ROOT = join(AQUI, '..', '..');
const OSM = 'OpenStreetMap';
const APROX = 'aproximada (estimación del juego): OpenStreetMap no la tiene con su nombre';

/** id → the way of the extract to take (`archivo`: from another search's answers), or the place itself. */
const ELEGIDAS = {
  'vw-puebla': { way: 22901189 },
  'audi-san-jose-chiapa': { way: 351862753 },
  'gm-silao': { way: 180816050 },
  'gm-ramos-arizpe': { way: 100345950 },
  'gm-san-luis-potosi': { lonLat: [-100.87545, 21.98729], de: `${OSM} (sus accesos «GM San Luis Potosí»)` },
  'nissan-a1': { lonLat: [-102.283, 21.827], de: APROX },
  'nissan-a2': { way: 435905156 },
  'nissan-civac': { lonLat: [-99.17292, 18.90801], de: `${OSM} («Fabrica NISSAN Mexicana»)` },
  compas: { way: 627033706 },
  'kia-pesqueria': { way: 538912829 },
  'toyota-tijuana': { lonLat: [-116.72009, 32.50061], de: OSM },
  'toyota-guanajuato': { lonLat: [-100.53933, 20.57355], de: `${OSM} (la subestación «Planta Toyota», junto a la planta)` },
  'bmw-san-luis-potosi': { way: 553644102 },
  'mazda-salamanca': { way: 486365904 },
  'honda-celaya': { way: 486362192 },
  'honda-el-salto': { way: 475201563 },
  'ford-hermosillo': { way: 265741918 },
  'ford-cuautitlan': { lonLat: [-99.19193, 19.64342], de: `${OSM} («Armadora Ford Motor Company»)` },
  'stellantis-saltillo': { way: 605392567 },
  'stellantis-toluca': { lonLat: [-99.598, 19.287], de: APROX },
  'jac-sahagun': { lonLat: [-98.58028, 19.77139], de: `${OSM}: Ciudad Sahagún, la localidad (la planta no está con su nombre)` },
  ahmsa: { archivo: 'mineria/ahmsa', way: 551945160 },
  'arcelormittal-lazaro-cardenas': { archivo: 'mineria/arcelormittal-lazaro-cardenas', way: 314801836 },
  'ternium-guerrero': { archivo: 'mineria/ternium-guerrero', way: 162887171 },
  'ternium-puebla': { archivo: 'mineria/ternium-puebla', way: 97343931 },
  'la-caridad-fundicion': { archivo: 'mineria/la-caridad-fundicion', way: 193506161 },
  'met-mex': { archivo: 'mineria/met-mex', way: 116771096 },
  'tmex-park': { lonLat: [-99.07, 19.725], de: 'aproximada (estimación del juego): en Nextlalpan, al poniente del AIFA, como lo describe el desarrollador' },
};

const r5 = (x) => Math.round(x * 1e5) / 1e5;
const out = {};
for (const [id, e] of Object.entries(ELEGIDAS)) {
  if (e.lonLat) {
    out[id] = { lonLat: e.lonLat, de: e.de };
    continue;
  }
  if (e.archivo) {
    const c = centro(join(ROOT, '.cache', 'osm'), e);
    out[id] = { lonLat: c.lonLat, de: e.de ?? `${OSM} («${c.nombre}»)` };
    continue;
  }
  const d = JSON.parse(readFileSync(join(ROOT, '.cache', 'osm', 'industrias', `${id}.json`), 'utf8'));
  const w = d.elements.find((x) => x.id === e.way);
  if (!w) throw new Error(`${id}: la vía ${e.way} no está en el extracto`);
  const g = w.geometry;
  out[id] = { lonLat: [r5((Math.min(...g.map((p) => p.lon)) + Math.max(...g.map((p) => p.lon))) / 2), r5((Math.min(...g.map((p) => p.lat)) + Math.max(...g.map((p) => p.lat))) / 2)], de: `${OSM} («${w.tags.name}»)` };
}
writeFileSync(join(AQUI, 'ubicaciones.json'), JSON.stringify(out, null, 1) + '\n');
console.log(Object.keys(out).length, 'ubicaciones');
