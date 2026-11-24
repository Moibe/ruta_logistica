// Asks the Geofabrik extract (scripts/polos/osm-local.py) for each plant's shape in OpenStreetMap:
// the ways whose name matches, in a box around where the plant is known to be. Writes
// .cache/osm/industrias/<id>.json; ubicar.mjs picks each plant's place from them.
import { mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
/** [id, lat, lon (about), name pattern]. */
export const BUSQUEDAS = [
  ['vw-puebla', 19.118, -98.249, 'Volkswagen'],
  ['audi-san-jose-chiapa', 19.2, -97.745, 'Audi'],
  ['gm-silao', 20.917, -101.39, 'General Motors|GM '],
  ['gm-ramos-arizpe', 25.53, -100.93, 'General Motors|GM '],
  ['gm-san-luis-potosi', 21.97, -100.86, 'General Motors|GM '],
  ['nissan-a1', 21.82, -102.285, 'Nissan'],
  ['nissan-a2', 21.74, -102.27, 'Nissan'],
  ['nissan-civac', 18.915, -99.175, 'Nissan'],
  ['compas', 21.72, -102.28, 'COMPAS|Compas'],
  ['kia-pesqueria', 25.72, -99.98, 'KIA|Kia'],
  ['toyota-tijuana', 32.49, -116.68, 'Toyota'],
  ['toyota-guanajuato', 20.52, -100.63, 'Toyota'],
  ['bmw-san-luis-potosi', 21.93, -100.87, 'BMW'],
  ['mazda-salamanca', 20.6, -101.13, 'Mazda'],
  ['honda-celaya', 20.56, -100.9, 'Honda'],
  ['honda-el-salto', 20.53, -103.2, 'Honda'],
  ['ford-hermosillo', 29.02, -110.92, 'Ford'],
  ['ford-cuautitlan', 19.67, -99.19, 'Ford'],
  ['stellantis-saltillo', 25.27, -101.11, 'Chrysler|Stellantis|FCA|Ram'],
  ['stellantis-toluca', 19.29, -99.61, 'Chrysler|Stellantis|FCA'],
  ['jac-sahagun', 19.77, -98.58, 'JAC|Giant'],
  ['tmex-park', 19.72, -99.08, 'T-?MEX|TMex|T-Mex|DHL'],
];
if (process.argv[1]?.endsWith('buscar-osm.mjs')) {
  const dir = join(ROOT, '.cache', 'osm', 'industrias');
  mkdirSync(dir, { recursive: true });
  const M = 0.15;
  const salidas = BUSQUEDAS.map(([id, lat, lon, re]) => ({
    archivo: join(dir, `${id}.json`),
    partes: [['way', `${lat - M},${lon - M},${lat + M},${lon + M}`, [['name', '~', re]]]],
  }));
  const pedido = join(dir, 'pedido.json');
  writeFileSync(pedido, JSON.stringify({ pbf: join(ROOT, '.cache', 'geofabrik', 'mexico-latest.osm.pbf'), salidas }));
  const r = spawnSync('python', [join(ROOT, 'scripts', 'polos', 'osm-local.py'), pedido], { stdio: 'inherit' });
  process.exit(r.status ?? 1);
}
