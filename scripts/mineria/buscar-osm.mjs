// Asks the Geofabrik extract (scripts/polos/osm-local.py) for where each mine and each plant the
// mines feed is. Four groups of queries, all written to .cache/osm/mineria/:
//   nombres     the ways whose name matches, in a box around where it's known to be (<id>.json);
//   tajos       the open pits and salt ponds of each mine's box, named or not (tajo-<id>.json);
//   lugares     the town a mine is named after or worked from (lugar-<id>.json);
//   sin-nombre  the industrial land around three car plants OpenStreetMap doesn't have by name
//               (industrial-<id>.json).
// ver.mjs lists what came, and the pick goes into ubicar.mjs. One reading of the extract takes about
// 15 minutes whatever it carries, so ask everything at once; `--solo=grupo,grupo` asks only those.
import { mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const caja = (lat, lon, m) => `${lat - m},${lon - m},${lat + m},${lon + m}`;

/** [id, lat, lon (about), name pattern, half-box in degrees]. */
export const BUSQUEDAS = [
  ['pena-colorada', 19.37, -104.09, 'Pe[ñn]a Colorada', 0.2],
  ['pena-colorada-peletizadora', 19.07, -104.28, 'Pe[ñn]a Colorada|Peletizadora', 0.12],
  ['las-encinas-aquila', 18.6, -103.5, 'Encinas|Ternium|Mina', 0.2],
  ['las-encinas-alzada', 19.26, -103.55, 'Encinas|Ternium|Peletizadora', 0.12],
  ['las-truchas', 18.03, -102.33, 'Truchas|Mittal|Mina', 0.15],
  ['hercules', 28.03, -103.77, 'H[ée]rcules|Mina', 0.25],
  ['cerro-de-mercado', 24.05, -104.67, 'Cerro del? Mercado', 0.1],
  ['micare', 28.47, -100.68, 'MICARE|Micare|Mina|Tajo', 0.25],
  ['mimosa', 27.9, -101.42, 'MIMOSA|Mimosa|Mina', 0.25],
  ['buenavista-del-cobre', 30.96, -110.32, 'Buenavista|Cananea|Mina', 0.15],
  ['la-caridad', 30.32, -109.56, 'Caridad|Mina', 0.15],
  ['la-caridad-fundicion', 30.42, -109.62, 'Caridad|Fundici|Mexicana de Cobre|Refiner', 0.2],
  ['el-boleo', 27.35, -112.28, 'Boleo', 0.15],
  ['guerrero-negro', 27.9, -114.0, 'Exportadora de Sal|ESSA|Salin', 0.3],
  ['ahmsa', 26.88, -101.42, 'AHMSA|Altos Hornos|Sider', 0.12],
  ['arcelormittal-lazaro-cardenas', 17.93, -102.2, 'Mittal|SICARTSA|Sicartsa|Sider', 0.12],
  ['ternium-guerrero', 25.73, -100.3, 'Ternium|Hylsa', 0.1],
  ['ternium-puebla', 19.15, -98.3, 'Ternium|Hylsa', 0.15],
  ['ternium-pesqueria', 25.76, -100.02, 'Ternium', 0.12],
  ['immsa-zinc', 22.16, -101.02, 'IMMSA|Industrial Minera|Zinc', 0.12],
];
/** Open pits (landuse=quarry) and salt ponds (landuse=salt_pond): [id, lat, lon, half-box, landuse]. */
export const TAJOS = [
  ['pena-colorada', 19.37, -104.09, 0.15, 'quarry'],
  ['las-encinas-aquila', 18.6, -103.5, 0.25, 'quarry'],
  ['las-truchas', 18.05, -102.33, 0.2, 'quarry'],
  ['hercules', 28.03, -103.77, 0.3, 'quarry'],
  ['cerro-de-mercado', 24.05, -104.67, 0.05, 'quarry'],
  ['micare', 28.47, -100.68, 0.3, 'quarry'],
  ['mimosa', 27.9, -101.42, 0.3, 'quarry'],
  ['buenavista-del-cobre', 30.96, -110.32, 0.15, 'quarry'],
  ['la-caridad', 30.32, -109.56, 0.15, 'quarry'],
  ['el-boleo', 27.35, -112.28, 0.15, 'quarry'],
  ['guerrero-negro', 27.9, -114.0, 0.3, 'salt_pond'],
];
/** Towns (place=*): [id, lat, lon, name pattern, half-box]. */
export const LUGARES = [
  ['sabinas', 27.85, -101.12, '^Sabinas$', 0.15],
  ['nueva-rosita', 27.94, -101.22, 'Nueva Rosita', 0.15],
  ['hercules', 28.0, -103.75, 'H[ée]rcules', 0.5],
  ['palau', 27.88, -101.42, 'Pala[uú]', 0.25],
  ['nava', 28.42, -100.77, '^Nava$', 0.15],
  ['santa-rosalia', 27.34, -112.27, 'Santa Rosal[ií]a', 0.15],
  ['guerrero-negro', 27.96, -114.06, 'Guerrero Negro', 0.2],
];
/** Car plants without a named shape: [id, box]. */
const SIN_NOMBRE = [
  ['nissan-a1', '21.78,-102.33,21.87,-102.24'],
  ['stellantis-toluca', '19.26,-99.66,19.32,-99.54'],
  ['tmex-park', '19.69,-99.14,19.78,-99.03'],
];

// Run, not imported (industrias/ has scripts with the same names).
if (process.argv[1] && join(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = join(ROOT, '.cache', 'osm', 'mineria');
  mkdirSync(dir, { recursive: true });
  const solo = process.argv.find((a) => a.startsWith('--solo='))?.slice(7).split(',');
  const grupos = {
    nombres: BUSQUEDAS.map(([id, lat, lon, re, m]) => ({ archivo: join(dir, `${id}.json`), partes: [['way', caja(lat, lon, m), [['name', '~', re]]]] })),
    tajos: TAJOS.map(([id, lat, lon, m, uso]) => ({ archivo: join(dir, `tajo-${id}.json`), partes: [['way', caja(lat, lon, m), [['landuse', '=', uso]]]] })),
    lugares: LUGARES.map(([id, lat, lon, re, m]) => ({ archivo: join(dir, `lugar-${id}.json`), partes: [['node', caja(lat, lon, m), [['place'], ['name', '~', re]]]] })),
    'sin-nombre': SIN_NOMBRE.map(([id, c]) => ({ archivo: join(dir, `industrial-${id}.json`), partes: [['way', c, [['landuse', '=', 'industrial']]]] })),
  };
  const salidas = Object.entries(grupos).flatMap(([g, s]) => (!solo || solo.includes(g) ? s : []));
  const pedido = join(dir, solo ? `pedido-${solo.join('-')}.json` : 'pedido.json');
  writeFileSync(pedido, JSON.stringify({ pbf: join(ROOT, '.cache', 'geofabrik', 'mexico-latest.osm.pbf'), salidas }));
  const r = spawnSync('python', [join(ROOT, 'scripts', 'polos', 'osm-local.py'), pedido], { stdio: 'inherit' });
  process.exit(r.status ?? 1);
}
