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
  'economia-huamantla': {
    fuente: 'Secretaría de Economía, portal de los Polos de Desarrollo: Huamantla, «Energía: 8 MW»; Presidencia, inauguración (12 de abril de 2026): «más de 5 mil empleos directos e indirectos»',
    url: 'https://podecobi.economia.gob.mx/polos-de-desarrollo',
  },
  juego: { fuente: 'Estimación del juego', url: '' },
};

/**
 * Electricity per job at the manufacturing average: Huamantla's 8 MW for its 5 thousand jobs. The
 * census says the same: 24,753 pesos of electricity per worker a year is 14 thousand kWh at about
 * 1.77 pesos the kWh, an industrial price.
 */
const KW_POR_EMPLEO = (8 * 1000) / 5000;

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
  311: [1092943, 17833.01, 4260.86],
  3251: [38098, 3203.831, 930.858],
  3252: [18532, 2789.304, 211.388],
  3253: [13902, 996.036, 514.283],
  3254: [88699, 1833.739, 542.717],
  3255: [24452, 593.639, 276.5],
  3256: [55434, 1118.523, 475.844],
  3259: [28969, 972.857, 193.374],
  326: [381838, 12281.191, 893.821],
  3344: [196205, 3259.038, 1300.765],
  3353: [74641, 1606.412, 181.077],
  3391: [172298, 1946.929, 438.187],
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
  // Food.
  jarabeMaiz: { t: 1290754, exp: 0 },
  aceiteGrasasVegetales: { t: 547553, exp: 0 },
  harinas: { t: 497624, exp: 0 },
  azucar: { t: 270406, exp: 0.1 },
  lacteos: { t: 99702, exp: 0 },
  harinaTrigo: { t: 93951, exp: 0 },
  alimentoAnimales: { t: 62247, exp: 0 },
  almidonMaiz: { t: 46543, exp: 0 },
  abarrotes: { t: 28255, exp: 0 },
  harinaGluten: { t: 13124, exp: 0 },
  mielCana: { t: 5365, exp: 0 },
  conservas: { t: 148, exp: 0 },
  // Basic chemicals and resins.
  polietileno: { t: 2325455, exp: 0 },
  quimicosIndustriales: { t: 1424899, exp: 0.3 },
  carbonatoSodio: { t: 1318937, exp: 0 },
  polipropileno: { t: 877031, exp: 0 },
  acidoSulfurico: { t: 695333, exp: 0.6 },
  acidos: { t: 560327, exp: 0 },
  cloroLiquido: { t: 278683, exp: 0 },
  cloruroVinilo: { t: 237537, exp: 0 },
  sosaCaustica: { t: 187727, exp: 0 },
  resinaAdhesivo: { t: 176246, exp: 0 },
  tereftalato: { t: 164556, exp: 0 },
  productosSodio: { t: 152194, exp: 0 },
  oxidoEtileno: { t: 100103, exp: 0 },
  plasticosGranulos: { t: 13163, exp: 0 },
  // Fertilizers and soaps.
  fertilizantes: { t: 552357, exp: 0 },
  fertilizanteAmoniaco: { t: 22861, exp: 0 },
  jabonPolvo: { t: 5136, exp: 0 },
};

/**
 * The polos' vocations (their declaratorias) as SCIAN subsectors, and the rail products that
 * are theirs. A sector with no products of its own in the yearbook ships in containers: it gets
 * the containers' tonnes per manufacturing worker (an estimate).
 */
const SECTORES = [
  // Huamantla's.
  { id: 'textil', nombre: 'Industria textil', corto: 'Textil', scian: ['313', '314'], productos: [], color: '#f9a8d4' },
  { id: 'metalicas', nombre: 'Industrias metálicas básicas', corto: 'Metálicas básicas', scian: ['331'], productos: ['laminas', 'fierroConstruccion', 'billetsAluminio', 'lingoteZinc', 'hojaAluminio', 'barrasPlomo'], color: '#fca5a5' },
  { id: 'productos-metalicos', nombre: 'Fabricación de productos metálicos', corto: 'Productos metálicos', scian: ['332'], productos: [], color: '#fdba74' },
  { id: 'maquinaria', nombre: 'Maquinaria y equipo', corto: 'Maquinaria', scian: ['333'], productos: [], color: '#fde047' },
  { id: 'computacion', nombre: 'Equipo de computación y electrónico', corto: 'Electrónica', scian: ['334'], productos: [], color: '#86efac' },
  { id: 'electricos', nombre: 'Aparatos eléctricos', corto: 'Aparatos eléctricos', scian: ['335'], productos: ['aparatosDomesticos'], contenedores: true, color: '#7dd3fc' },
  { id: 'transporte', nombre: 'Equipo de transporte', corto: 'Equipo de transporte', scian: ['336'], productos: ['vehiculos', 'ensamble', 'desarmados', 'ruedas'], color: '#a5b4fc' },
  { id: 'bebidas', nombre: 'Bebidas y tabaco', corto: 'Bebidas', scian: ['312'], productos: ['cerveza', 'vinos'], color: '#d8b4fe' },
  // Coatzacoalcos I's vocations.
  {
    id: 'alimentos',
    nombre: 'Agroindustria (industria alimentaria)',
    corto: 'Agroindustria',
    scian: ['311'],
    productos: ['jarabeMaiz', 'aceiteGrasasVegetales', 'harinas', 'azucar', 'lacteos', 'harinaTrigo', 'alimentoAnimales', 'almidonMaiz', 'abarrotes', 'harinaGluten', 'mielCana', 'conservas'],
    color: '#bef264',
  },
  {
    id: 'petroquimica',
    nombre: 'Petroquímica (química básica y resinas)',
    corto: 'Petroquímica',
    scian: ['3251', '3252'],
    productos: ['polietileno', 'quimicosIndustriales', 'carbonatoSodio', 'polipropileno', 'acidoSulfurico', 'acidos', 'cloroLiquido', 'cloruroVinilo', 'sosaCaustica', 'resinaAdhesivo', 'tereftalato', 'productosSodio', 'oxidoEtileno', 'plasticosGranulos'],
    color: '#f0a27a',
  },
  { id: 'farmaceutica', nombre: 'Farmacéutica', corto: 'Farmacéutica', scian: ['3254'], productos: [], color: '#5eead4' },
  { id: 'dispositivos-medicos', nombre: 'Dispositivos médicos', corto: 'Dispositivos médicos', scian: ['3391'], productos: [], color: '#99f6e4' },
  { id: 'semiconductores', nombre: 'Semiconductores (componentes electrónicos)', corto: 'Semiconductores', scian: ['3344'], productos: [], color: '#4ade80' },
  { id: 'generacion-electrica', nombre: 'Equipo de generación y distribución de electricidad', corto: 'Equipo eléctrico', scian: ['3353'], productos: [], color: '#38bdf8' },
  // Altamira's: the chemical industry that isn't basic chemicals, resins or pharmaceuticals.
  {
    id: 'quimica',
    nombre: 'Química (fertilizantes, pinturas, jabones y otros)',
    corto: 'Química',
    scian: ['3253', '3255', '3256', '3259'],
    productos: ['fertilizantes', 'fertilizanteAmoniaco', 'jabonPolvo'],
    color: '#e879f9',
  },
  // Topolobampo's: plastic and rubber products. The yearbook has no product of theirs (its plastic
  // granules are resins, petrochemicals): they go in containers.
  { id: 'plastico', nombre: 'Industria del plástico y del hule', corto: 'Plástico y hule', scian: ['326'], productos: [], color: '#cbd5e1' },
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
  corte: '2026-11-23',
  nota: 'Generado por scripts/polos/gen-sectores.mjs.',
  fuentes: FUENTES,
  manufactura: { personal: pMan, electricidadPorTrabajador: Math.round(elecMan * 1e6), aguaPorTrabajador: Math.round(aguaMan * 1e6), contenedoresPorTrabajador: r(contPorTrab, 2) },
  sectores,
  dato:
    'Lo que pide una empresa de cada sector, por trabajador, en 2018: su gasto en electricidad y en agua contra el promedio de la manufactura (INEGI, Censos Económicos 2019), y las toneladas que movió el tren de sus productos entre su personal ocupado, con la parte que salió del país (ARTF, anuario 2018). Los sectores sin productos propios en el anuario mandan su carga en contenedores: les toca lo que llevaron los contenedores por trabajador de la manufactura (estimación del juego).',
  fuentesDato: ['inegi-ce2019', 'artf-2018', 'juego'],
  reglas: {
    dato: `Reglas del juego: una empresa ocupa un lote y da los empleos del polo lleno repartidos por la superficie de los lotes. Cada empleo pide ${KW_POR_EMPLEO.toLocaleString('es-MX')} kW de electricidad al promedio de la manufactura (los 8 MW de Huamantla para sus 5 mil empleos; con el gasto del censo, 24,753 pesos por trabajador al año, eso es un kWh de unos 1.77 pesos), por cuánto gasta su sector contra el promedio. Su carga espera en la estación del polo hasta un mes.`,
    fuentes: ['economia-huamantla', 'inegi-ce2019', 'juego'],
    diasPatio: 30,
    kwPorEmpleo: KW_POR_EMPLEO,
  },
};

await writeFile(join(ROOT, 'src', 'lib', 'domain', 'datos', 'sectores.json'), JSON.stringify(datos, null, 1) + '\n');
for (const s of sectores) console.log(s.corto.padEnd(22), 'energía', s.energia, '· agua', s.agua, '· t/trab', s.toneladas, '· exporta', s.exportacion);
