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
/** Gold and silver: the mines by name ([id, lat, lon, name pattern, half-box]), their open pits, and their towns. */
export const BUSQUEDAS_ORO = [
  ['penasquito', 24.65, -101.7, 'Pe[ñn]asquito|Newmont|Mina', 0.25],
  ['camino-rojo', 24.55, -101.4, 'Camino Rojo|Orla|Mina', 0.35],
  ['herradura', 30.9, -112.4, 'Herradura|Penmont|Mina', 0.25],
  ['noche-buena', 30.5, -112.2, 'Noche Buena|Mina', 0.25],
  ['morelos-torex', 17.95, -99.6, 'Lim[oó]n|Guajes|Media Luna|Torex|Mina', 0.25],
  ['los-filos', 17.88, -99.68, 'Filos|Bermejal|Equinox|Mina', 0.25],
  ['mulatos', 28.65, -108.75, 'Mulatos|Yaqui|Alamos|Mina', 0.35],
  ['pinos-altos', 28.27, -108.27, 'Pinos Altos|Agnico|Mina', 0.35],
  ['dolores', 28.99, -108.45, 'Dolores|Pan American|Mina', 0.45],
  ['palmarejo', 27.4, -108.4, 'Palmarejo|Coeur|Mina', 0.35],
  ['san-dimas', 24.1, -105.93, 'San Dimas|Tayoltita|First Majestic|Mina', 0.35],
  ['fresnillo', 23.18, -102.87, 'Fresnillo|Saucito|Juanicipio|Proa|Mina', 0.25],
  ['san-julian', 26.23, -106.96, 'San Juli[aá]n|Mina', 0.45],
  ['cienega', 25.0, -106.2, 'Ci[ée]nega|Mina', 0.25],
  ['cerro-los-gatos', 27.7, -106.0, 'Gatos|Mina', 0.25],
  ['la-colorada', 23.47, -103.88, 'Colorada|Pan American|Mina', 0.25],
  ['met-mex', 25.53, -103.43, 'Met-?Mex|Pe[ñn]oles|Fundidora|Fundici', 0.12],
];
export const TAJOS_ORO = BUSQUEDAS_ORO.filter((b) => b[0] !== 'met-mex').map(([id, lat, lon, , m]) => [id, lat, lon, Math.min(m, 0.15), 'quarry']);
export const LUGARES_ORO = [
  ['mazapil', 24.64, -101.55, '^Mazapil$', 0.25],
  ['caborca', 30.72, -112.16, '^(Heroica )?Caborca$', 0.25],
  ['mezcala', 17.93, -99.6, 'Mezcala|Carrizalillo|Nuevo Balsas', 0.25],
  ['mulatos', 28.65, -108.75, 'Mulatos', 0.25],
  ['ocampo', 28.19, -108.37, '^Ocampo$', 0.25],
  ['madera', 29.19, -108.14, '^Madera$', 0.25],
  ['chinipas', 27.39, -108.54, 'Ch[ií]nipas', 0.25],
  ['tayoltita', 24.1, -105.93, 'Tayoltita', 0.25],
  ['fresnillo', 23.17, -102.87, '^Fresnillo', 0.2],
  ['san-julian', 26.23, -106.96, 'San Juli[aá]n|Guadalupe y Calvo', 0.25],
  ['cienega', 25.0, -106.2, 'La Ci[ée]nega|Santiago Papasquiaro', 0.25],
  ['satevo', 27.95, -106.1, 'Satev[oó]', 0.25],
  ['chalchihuites', 23.47, -103.88, 'Chalchihuites', 0.25],
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
    'oro-nombres': BUSQUEDAS_ORO.map(([id, lat, lon, re, m]) => ({ archivo: join(dir, `${id}.json`), partes: [['way', caja(lat, lon, m), [['name', '~', re]]]] })),
    'oro-tajos': TAJOS_ORO.map(([id, lat, lon, m, uso]) => ({ archivo: join(dir, `tajo-${id}.json`), partes: [['way', caja(lat, lon, m), [['landuse', '=', uso]]]] })),
    'oro-lugares': LUGARES_ORO.map(([id, lat, lon, re, m]) => ({ archivo: join(dir, `lugar-${id}.json`), partes: [['node', caja(lat, lon, m), [['place'], ['name', '~', re]]]] })),
    'sin-nombre': SIN_NOMBRE.map(([id, c]) => ({ archivo: join(dir, `industrial-${id}.json`), partes: [['way', c, [['landuse', '=', 'industrial']]]] })),
  };
  const salidas = Object.entries(grupos).flatMap(([g, s]) => (!solo || solo.includes(g) ? s : []));
  const pedido = join(dir, solo ? `pedido-${solo.join('-')}.json` : 'pedido.json');
  writeFileSync(pedido, JSON.stringify({ pbf: join(ROOT, '.cache', 'geofabrik', 'mexico-latest.osm.pbf'), salidas }));
  const r = spawnSync('python', [join(ROOT, 'scripts', 'polos', 'osm-local.py'), pedido], { stdio: 'inherit' });
  process.exit(r.status ?? 1);
}
