// Builds what a company of each manufacturing sector asks of a polo: electricity, water and rail
// freight per worker, and what share of that freight leaves the country.
//
//   node scripts/polos/gen-sectores.mjs
//
// Self-contained: the figures were read once from INEGI's Censos Económicos 2019 (data for 2018,
// national, by SCIAN subsector: ce2019_nac.csv) and from the ARTF's rail yearbook 2018 (tables 6-1,
// 6-2 and 10), and live here as data.
//
// Writes src/lib/domain/datos/sectores.json.

import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const FUENTES = {
  'inegi-ce2019': {
    fuente:
      'INEGI, Censos Económicos 2019 (datos de 2018), datos abiertos nacionales por subsector SCIAN: personal ocupado total (H001A), gasto por consumo de energía eléctrica (K412A) y consumo de agua (K976A), en millones de pesos',
    url: 'https://www.inegi.org.mx/contenidos/programas/ce/2019/Datosabiertos/ce2019_nac_csv.zip',
  },
  'artf-2018': {
    fuente:
      'ARTF, Anuario Estadístico Ferroviario 2018: toneladas netas por producto (tablas 6-1 y 6-2) y los 20 principales productos de exportación (tabla 10)',
    url: 'https://www.gob.mx/cms/uploads/attachment/file/1099335/Anuario_2018.pdf',
  },
  'dof-huamantla': {
    fuente: 'DOF, declaratoria del Polo de Desarrollo Económico para el Bienestar Huamantla (14 de agosto de 2025): sus vocaciones productivas',
    url: 'https://dof.gob.mx/nota_detalle.php?codigo=5765468&fecha=14/08/2025',
  },
  juego: { fuente: 'Estimación del juego', url: '' },
};

/** CE 2019, national, 2018: [personal ocupado, electricity (million pesos), water (million pesos)]. */
const CENSO = {
  '31-33': [6493020, 160721.354, 44796.466],
  312: [188656, 4273.663, 3605.728],
  313: [115002, 3969.892, 301.423],
  314: [100965, 680.022, 61.711],
  331: [137249, 14691.98, 1684.697],
  332: [454118, 7329.674, 803.65],
  333: [192577, 5572.309, 691.484],
  334: [377625, 6830.559, 2061.709],
  335: [241221, 5921.874, 878.746],
  336: [1292372, 39068.277, 13368.527],
};

/** ARTF 2018, tonnes by rail (tables 6-1 and 6-2) and million tonnes exported (table 10). */
const TREN = {
  contenedores: { t: 9677852, exp: 2.9 },
  vehiculos: { t: 5429403, exp: 4.9 },
  ensamble: { t: 547942, exp: 0.5 },
  desarmados: { t: 490344, exp: 0 },
  ruedas: { t: 32882, exp: 0 },
  cerveza: { t: 3531878, exp: 3.5 },
  vinos: { t: 41745, exp: 0 },
  laminas: { t: 6468776, exp: 0.7 },
  fierroConstruccion: { t: 2646656, exp: 0.8 },
  billetsAluminio: { t: 102974, exp: 0 },
  lingoteZinc: { t: 69495, exp: 0 },
  hojaAluminio: { t: 16482, exp: 0 },
  barrasPlomo: { t: 5492, exp: 0 },
  aparatosDomesticos: { t: 101720, exp: 0.1 },
};

/**
 * The polo's vocations (Huamantla's declaratoria) as SCIAN subsectors, and the rail products that
 * are theirs. A sector with no products of its own in the yearbook ships in containers: it gets
 * the containers' tonnes per manufacturing worker (an estimate).
 */
const SECTORES = [
  { id: 'textil', nombre: 'Industria textil', corto: 'Textil', scian: ['313', '314'], productos: [], color: '#f9a8d4' },
  { id: 'metalicas', nombre: 'Industrias metálicas básicas', corto: 'Metálicas básicas', scian: ['331'], productos: ['laminas', 'fierroConstruccion', 'billetsAluminio', 'lingoteZinc', 'hojaAluminio', 'barrasPlomo'], color: '#fca5a5' },
  { id: 'productos-metalicos', nombre: 'Fabricación de productos metálicos', corto: 'Productos metálicos', scian: ['332'], productos: [], color: '#fdba74' },
  { id: 'maquinaria', nombre: 'Maquinaria y equipo', corto: 'Maquinaria', scian: ['333'], productos: [], color: '#fde047' },
  { id: 'computacion', nombre: 'Equipo de computación y electrónico', corto: 'Electrónica', scian: ['334'], productos: [], color: '#86efac' },
  { id: 'electricos', nombre: 'Aparatos eléctricos', corto: 'Aparatos eléctricos', scian: ['335'], productos: ['aparatosDomesticos'], contenedores: true, color: '#7dd3fc' },
  { id: 'transporte', nombre: 'Equipo de transporte', corto: 'Equipo de transporte', scian: ['336'], productos: ['vehiculos', 'ensamble', 'desarmados', 'ruedas'], color: '#a5b4fc' },
  { id: 'bebidas', nombre: 'Bebidas y tabaco', corto: 'Bebidas', scian: ['312'], productos: ['cerveza', 'vinos'], color: '#d8b4fe' },
];

const [pMan, eMan, aMan] = CENSO['31-33'];
const elecMan = eMan / pMan;
const aguaMan = aMan / pMan;
const contPorTrab = TREN.contenedores.t / pMan;
const contExp = (TREN.contenedores.exp * 1e6) / TREN.contenedores.t;
const r = (n, d = 3) => Number(n.toFixed(d));

const sectores = SECTORES.map((s) => {
  const [p, e, a] = s.scian.reduce((acc, c) => acc.map((v, i) => v + CENSO[c][i]), [0, 0, 0]);
  const propios = s.productos.reduce((x, k) => x + TREN[k].t, 0);
  const propiosExp = s.productos.reduce((x, k) => x + TREN[k].exp * 1e6, 0);
  const enContenedores = s.productos.length === 0 || s.contenedores;
  const t = propios / p + (enContenedores ? contPorTrab : 0);
  const tExp = propiosExp / p + (enContenedores ? contPorTrab * contExp : 0);
  return {
    id: s.id,
    nombre: s.nombre,
    corto: s.corto,
    scian: s.scian,
    color: s.color,
    personal: p,
    /** Electricity and water per worker against the manufacturing average. */
    energia: r(e / p / elecMan, 2),
    agua: r(a / p / aguaMan, 2),
    /** Tonnes by rail a year per worker, and the share exported. */
    toneladas: r(t, 2),
    exportacion: r(t > 0 ? tExp / t : 0, 2),
    enContenedores,
  };
});

const datos = {
  corte: '2026-11-22',
  nota: 'Generado por scripts/polos/gen-sectores.mjs.',
  fuentes: FUENTES,
  manufactura: { personal: pMan, electricidadPorTrabajador: Math.round(elecMan * 1e6), aguaPorTrabajador: Math.round(aguaMan * 1e6), contenedoresPorTrabajador: r(contPorTrab, 2) },
  sectores,
  dato:
    'Lo que pide una empresa de cada sector, por trabajador, en 2018: su gasto en electricidad y en agua contra el promedio de la manufactura (INEGI, Censos Económicos 2019), y las toneladas que movió el tren de sus productos entre su personal ocupado, con la parte que salió del país (ARTF, anuario 2018). Los sectores sin productos propios en el anuario mandan su carga en contenedores: les toca lo que llevaron los contenedores por trabajador de la manufactura (estimación del juego).',
  fuentesDato: ['inegi-ce2019', 'artf-2018', 'juego'],
  reglas: {
    dato:
      'Reglas del juego: una empresa ocupa un lote y da los empleos por hectárea del polo; su consumo de electricidad es la parte de su lote de la demanda del polo lleno (los 8 MW de Economía) por cuánto gasta su sector contra el promedio. Su carga espera en la estación del polo hasta un mes.',
    fuentes: ['juego'],
    diasPatio: 30,
  },
};

await writeFile(join(ROOT, 'src', 'lib', 'domain', 'datos', 'sectores.json'), JSON.stringify(datos, null, 1) + '\n');
for (const s of sectores) console.log(s.corto.padEnd(22), 'energía', s.energia, '· agua', s.agua, '· t/trab', s.toneladas, '· exporta', s.exportacion);
