// Builds the fuel-oil data of the game: what each refinery makes, what each
// CFE power plant burns and how it gets there, the game's rules for it and
// the real series. Every figure keeps its source.
//
//   node scripts/combustibles/gen-combustoleo.mjs
//
// The official figures were read once from their sources (see FUENTES and
// docs/enciclopedia.md, «El combustóleo») and are written here as data; the
// crude runs come from the oil data of the game.
//
// Writes src/lib/domain/datos/combustoleo.json.

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DATOS = join(ROOT, 'src', 'lib', 'domain', 'datos');

const FUENTES = {
  'asf-2020-0430': {
    fuente:
      'ASF, auditoría 2020-6-90T9M-19-0430-2021 «Erogaciones por Mantenimiento en Refinerías» (Pemex Transformación Industrial, Cuenta Pública 2020): tabla «Producción de petrolíferos 2019-2020 del SNR», combustóleo de cada refinería en miles de barriles diarios',
    url: 'https://www.asf.gob.mx/Trans/Informes/IR2020c/Documentos/Auditorias/2020_0430_a.pdf',
  },
  'cfe-ia2018': {
    fuente:
      'CFE, Informe Anual 2018 (Gaceta de la Cámara de Diputados, 21 de mayo de 2019): «Utilización de fuentes primarias de energía» y «Escenario tecnológico» de cada empresa de generación',
    url: 'https://gaceta.diputados.gob.mx/Gaceta/64/2019/may/CFE_IA-20190521.pdf',
  },
  'prodesen-2019': {
    fuente: 'SENER, PRODESEN 2019–2033, capítulo V, tabla 5.2: centrales principales a diciembre de 2018, con su tecnología, su combustible y su capacidad',
    url: 'https://www.gob.mx/cms/uploads/attachment/file/475497/PRODESEN_V.pdf',
  },
  'ig2-2026': {
    fuente:
      'Segundo Informe de Gobierno 2025–2026, anexo estadístico (SENER y Pemex): «Producción, importación y exportación de productos petrolíferos de PEMEX», combustóleo; 2026, de enero a junio',
    url: 'https://gaceta.diputados.gob.mx/PDF/66/2026/sep/segundo-informe-de-gobierno.pdf',
  },
  'pmx-ia2023': {
    fuente: 'Pemex, Informe Anual 2023: la Olmeca busca «maximizar el aprovechamiento de la materia prima para la producción de gasolina y diésel, sin producción de asfalto ni combustóleo»',
    url: 'https://gaceta.diputados.gob.mx/PDF/65/2024/may/Pemex-20240514.pdf',
  },
  'cpm-2024': {
    fuente: 'Presidencia de la República, presentación de resultados de Pemex (3 de mayo de 2024): la coquizadora de Tula «reduce la producción de combustóleo de las refinerías Tula y Salamanca» y la de Salina Cruz «reduce la producción de combustóleo»',
    url: 'https://www.gob.mx/cms/uploads/attachment/file/913864/CPM_Pemex_resultados_03may24.pdf',
  },
  'pmx-c38-2022': {
    fuente: 'Pemex, comunicado 38/2022 (1 de julio de 2022): con la coquizadora de Salina Cruz «se dejará de producir combustóleo»',
    url: 'https://www.bmv.com.mx/docs-pub/eventemi/eventemi_1202976_1.pdf',
  },
  'bne-2019': {
    fuente: 'SENER, Balance Nacional de Energía 2019, cuadro 29: poder calorífico neto del combustóleo, 6,397 MJ por barril en 2018',
    url: 'https://www.gob.mx/cms/uploads/attachment/file/618408/20210218_BNE.pdf',
  },
  'eia-unidades': {
    fuente: 'EIA (gobierno de EUA), International Energy Statistics, unidades: 6.66 barriles por tonelada métrica de combustóleo (residual fuel oil)',
    url: 'https://www.eia.gov/cfapps/ipdbproject/docs/unitswithpetro.php',
  },
  'asf-2017-0522': {
    fuente:
      'ASF, auditoría 2017-6-90TVV-15-0522-2018 «Ingresos por Comercialización de Gas Natural, Combustóleo y Diésel» (CFEnergía, Cuenta Pública 2017): el combustóleo que CFEnergía compró en Estados Unidos «se entregó en buque tanques que descargaron en el puerto de Tuxpan, Veracruz»',
    url: 'https://www.asf.gob.mx/Trans/Informes/IR2017c/Documentos/Auditorias/2017_0522_d.pdf',
  },
  'cfe-ia2024': {
    fuente: 'CFE, Informe Anual 2024: «se incrementó en 23 % la capacidad de transporte de combustóleo» a las centrales de Lerma, Mérida II y Valladolid',
    url: 'https://www.cfe.gob.mx/finanzas/reportes-financieros/Reportes%20Anuales%20Documentos/Informe%20Anual%202024.pdf',
  },
  'cnh-2018': {
    fuente: 'CNH, capa de ductos con fecha de referencia 14 de febrero de 2018: Combustoleoducto Refinería Madero–CFE Altamira, 29 km',
    url: 'https://agsserver.sigsa.info/arcgis/rest/services/Monitoreo_de_flujo_en_tiempo_real_MIL1/MapServer/4',
  },
  'asf-2018-0474': {
    fuente:
      'ASF, auditoría 474-DE «Desempeño de Pemex Logística», Cuenta Pública 2018: en 2018 movió 20.8 Mbd de combustóleo en buque tanque y 31.0 en carro tanque',
    url: 'https://www.asf.gob.mx/Trans/Informes/IR2018c/Documentos/Auditorias/2018_0474_a.pdf',
  },
  'attrapi-2018': {
    fuente: 'ATTRAPI, Anuario Estadístico Ferroviario 2018, tabla 6-4: 1.639 millones de toneladas de combustóleo por tren',
    url: 'https://www.gob.mx/cms/uploads/attachment/file/1099335/Anuario_2018.pdf',
  },
};

const BARRILES_POR_M3 = 6.28981;
const BARRILES_POR_T = 6.66;
const MJ_POR_BARRIL = 6397;
const MJ_POR_TCAL = 4186.8;
const r1 = (x) => Math.round(x * 10) / 10;
const r2 = (x) => Math.round(x * 100) / 100;
const r3 = (x) => Math.round(x * 1000) / 1000;
const fmt = (x, d = 0) => x.toLocaleString('es-MX', { minimumFractionDigits: d, maximumFractionDigits: d });

// ---- what each refinery makes ------------------------------------------------------------------

/** Fuel oil each refinery made in 2019 and 2020, Mbd (ASF 2020-0430). */
const COMBUSTOLEO_ASF = {
  madero: [10, 22],
  cadereyta: [12, 19],
  minatitlan: [7, 17],
  salamanca: [25, 29],
  'salina-cruz': [47, 51],
  tula: [48, 38],
};
/** The country's fuel oil, Mbd (Segundo Informe, anexo): production, imports, exports. */
const REAL = {
  2018: [185.1, 16.5, 89.8],
  2019: [149.8, 11.8, 69.3],
  2020: [176.0, 4.3, 109.6],
  2021: [244.3, 0.0, 157.5],
  2022: [258.3, 0.0, 174.5],
  2023: [260.3, 0.5, 170.7],
  2024: [271.4, 0.6, 203.1],
  2025: [208.2, 4.1, 133.3],
  2026: [175.8, 4.8, 93.0],
};

const petroleo = JSON.parse(await readFile(join(DATOS, 'petroleo.json'), 'utf8'));
const refinerias = {};
let calculado2018 = 0;
for (const [id, [c19, c20]] of Object.entries(COMBUSTOLEO_ASF)) {
  const r = petroleo.refinerias.find((x) => x.id === id);
  const p19 = r.anual['2019'];
  const p20 = r.anual['2020'];
  const rendimiento = r3((c19 + c20) / (p19 + p20));
  calculado2018 += rendimiento * r.proceso2018;
  refinerias[id] = {
    rendimiento,
    dato: `Hizo ${c19} y ${c20} mil barriles diarios de combustóleo en 2019 y 2020 (ASF) al procesar ${fmt(p19, 1)} y ${fmt(p20, 1)} de crudo: ${fmt(rendimiento, 3)} barriles de combustóleo por barril de crudo`,
    fuentes: ['asf-2020-0430'],
  };
}
refinerias.olmeca = {
  rendimiento: 0,
  dato: 'Está hecha para sacar gasolina y diésel «sin producción de asfalto ni combustóleo» (Pemex, Informe Anual 2023)',
  fuentes: ['pmx-ia2023'],
};

// ---- what each CFE plant burns -----------------------------------------------------------------

/**
 * Fuel oil each generation company of the CFE burned in 2018 (Informe Anual 2018), and the plants
 * the game gives it to. Generación IV gives it in «Gcal» next to its coal and gas in Tcal: by its
 * size the game reads it as Tcal.
 */
const EMPRESAS = [
  {
    id: 'I',
    m3: 2458462,
    dato: 'Sus 4 centrales de vapor y combustión interna, que el Informe marca con gas y combustóleo o combustóleo y diésel',
  },
  {
    id: 'II',
    m3: 620466.85,
    dato: 'Altamira, que quemó combustóleo por la falta de gas (Informe Anual 2018), Lerdo y San Carlos; Valle de México queda fuera porque solo quema gas (PRODESEN)',
  },
  {
    id: 'III',
    m3: 1152246,
    dato: 'Mazatlán II y Topolobampo II, las suyas que el PRODESEN marca solo con combustóleo; sus centrales duales (Puerto Libertad, Presidente Juárez, Río Bravo, Manzanillo I) tenían gas y quedan fuera (estimación del juego)',
  },
  {
    id: 'IV',
    tcal: 3922.8,
    dato: 'Punta Prieta, la única suya solo de combustóleo, no alcanzaría a quemarlo todo: entra también Manzanillo II, su central de vapor más grande con combustóleo según el PRODESEN (estimación del juego). El Informe la da en «Gcal» junto a su carbón (40,988) y su gas (13,839) en Tcal: por su tamaño el juego la lee como Tcal y la pasa a barriles con el poder calorífico neto del combustóleo (6,397 MJ por barril)',
  },
  {
    id: 'VI',
    m3: 1667000,
    dato: 'Tuxpan y Guaymas II, solo de combustóleo (PRODESEN), y Mérida II y Valladolid, a las que la CFE lleva combustóleo (Informe Anual 2024); Lerma no está entre las centrales del PRODESEN que tiene el juego y su parte se reparte entre las demás',
  },
];

/**
 * The plants: the name in the game's energy data, its company, the MW of its steam and internal
 * combustion units (what its fuel oil feeds), its fuel in the PRODESEN, and how its fuel oil gets
 * there: by pipeline from a refinery next to it (`ducto`), and where trains and tankers deliver the
 * rest (`entrega`).
 */
const CENTRALES = [
  { id: 'tula', planta: 'Tula (Francisco Pérez Ríos)', empresa: 'I', mw: 1605.6, mwDato: 'su termoeléctrica (Informe Anual 2018)', combustible: 'combustóleo y gas', ducto: 'tula', entrega: 'refineria:tula' },
  { id: 'villa-de-reyes', planta: 'Villa de Reyes', empresa: 'I', mw: 700, combustible: 'combustóleo', entrega: 'central:villa-de-reyes' },
  { id: 'salamanca', planta: 'Salamanca TC y Cogeneración', empresa: 'I', mw: 550, mwDato: 'su termoeléctrica, sin la cogeneración (Informe Anual 2018)', combustible: 'combustóleo y gas', ducto: 'salamanca', entrega: 'refineria:salamanca' },
  { id: 'bcs-i', planta: 'Baja California Sur I', empresa: 'I', mw: 209.766, combustible: 'combustóleo y diésel', entrega: 'puerto:la-paz' },
  { id: 'altamira', planta: 'Altamira', empresa: 'II', mw: 465, combustible: 'combustóleo y gas', ducto: 'madero', entrega: 'puerto:altamira' },
  { id: 'lerdo', planta: 'Lerdo (Guadalupe Victoria)', empresa: 'II', mw: 320, combustible: 'combustóleo', entrega: 'central:lerdo' },
  {
    id: 'san-carlos',
    planta: 'San Carlos (Agustín Olachea A.)',
    empresa: 'II',
    mw: 104.125,
    combustible: 'combustóleo y diésel',
    entrega: 'puerto:la-paz',
    entregaDato: 'Su combustóleo llega por Puerto San Carlos, que no está en el juego: lo recibe en La Paz',
  },
  { id: 'mazatlan-ii', planta: 'Mazatlán II (José Aceves Pozos)', empresa: 'III', mw: 616, combustible: 'combustóleo', entrega: 'puerto:mazatlan' },
  { id: 'topolobampo-ii', planta: 'Topolobampo II (Juan de Dios Bátiz)', empresa: 'III', mw: 320, combustible: 'combustóleo', entrega: 'puerto:topolobampo' },
  {
    id: 'manzanillo',
    planta: 'Manzanillo',
    empresa: 'IV',
    mw: 700,
    mwDato: 'Manzanillo II: lo que queda de los 1,131 MW de vapor de CFE Generación IV (el 12 % de sus 9,422) sin Samalayuca, 316, ni Punta Prieta, 113 (cálculo del juego)',
    combustible: 'combustóleo y gas',
    entrega: 'puerto:manzanillo',
  },
  { id: 'punta-prieta', planta: 'Punta Prieta', empresa: 'IV', mw: 113, combustible: 'combustóleo', entrega: 'puerto:la-paz' },
  { id: 'tuxpan', planta: 'Tuxpan (Adolfo López Mateos)', empresa: 'VI', mw: 1750, combustible: 'combustóleo', entrega: 'puerto:tuxpan' },
  { id: 'guaymas-ii', planta: 'Guaymas II (Carlos Rodríguez Rivero)', empresa: 'VI', mw: 484, combustible: 'combustóleo', entrega: 'puerto:guaymas' },
  { id: 'merida-ii', planta: 'Mérida II', empresa: 'VI', mw: 198, combustible: 'combustóleo y gas', entrega: 'puerto:progreso' },
  { id: 'valladolid', planta: 'Valladolid (Felipe Carrillo Puerto)', empresa: 'VI', mw: 295, combustible: 'combustóleo y gas', entrega: 'puerto:progreso' },
];

const energia = JSON.parse(await readFile(join(DATOS, 'energia.json'), 'utf8'));
const mbdEmpresa = (e) => (e.m3 !== undefined ? (e.m3 * BARRILES_POR_M3) / 365 / 1000 : (e.tcal * MJ_POR_TCAL) / MJ_POR_BARRIL / 365);
const empresas = EMPRESAS.map((e) => {
  const centrales = CENTRALES.filter((c) => c.empresa === e.id);
  const mw = centrales.reduce((s, c) => s + c.mw, 0);
  const mbd = mbdEmpresa(e);
  for (const c of centrales) c.mbd = r2((mbd * c.mw) / mw);
  return {
    id: e.id,
    nombre: `CFE Generación ${e.id}`,
    ...(e.m3 !== undefined ? { m3: e.m3 } : { tcal: e.tcal }),
    mbd: r2(mbd),
    centrales: centrales.map((c) => c.id),
    dato: `Quemó ${e.m3 !== undefined ? `${fmt(e.m3)} m³` : `${fmt(e.tcal, 1)} Tcal`} de combustóleo en 2018, ${fmt(mbd, 1)} mil barriles diarios. Se reparte por MW entre ${e.dato}`,
  };
});
for (const c of CENTRALES) {
  const p = energia.plantas2018.find((x) => x.nombre === c.planta);
  if (!p) throw new Error(`No está en energia.json: ${c.planta}`);
  c.region = p.region;
}

const mbdCfe = empresas.reduce((s, e) => s + e.mbd, 0);

const datos = {
  corte: '2026-11-26',
  nota: 'Combustóleo: lo que hace cada refinería, lo que quema cada central de la CFE y cómo le llega. Generado por scripts/combustibles/gen-combustoleo.mjs; cada cifra con su fuente.',
  fuentes: FUENTES,
  unidades: {
    barrilesPorM3: BARRILES_POR_M3,
    barrilesPorTonelada: BARRILES_POR_T,
    mjPorBarril: MJ_POR_BARRIL,
    dato: `Un metro cúbico son ${BARRILES_POR_M3} barriles; una tonelada de combustóleo, ${BARRILES_POR_T} barriles (EIA); un barril da ${fmt(MJ_POR_BARRIL)} MJ (Balance Nacional de Energía, 2018).`,
    fuentes: ['eia-unidades', 'bne-2019'],
  },
  refinerias,
  produccion: {
    calculado2018: r1(calculado2018),
    real2018: REAL[2018][0],
    dato: `Cada refinería hace combustóleo en proporción a su crudo, con su rendimiento de 2019 y 2020 (ASF). Con el crudo de 2018 da ${fmt(calculado2018, 1)} mil barriles diarios; el país hizo ${fmt(REAL[2018][0], 1)} (Segundo Informe).`,
    fuentes: ['asf-2020-0430', 'ig2-2026'],
  },
  coquizadoras: {
    'coquizadora-tula': {
      refinerias: ['tula', 'salamanca'],
      dato: 'Reduce el combustóleo de Tula y Salamanca (Presidencia); el juego les quita tantos barriles de combustóleo como barriles de gasolina y diésel agrega la coquizadora, primero a Tula (estimación del juego)',
      fuentes: ['cpm-2024'],
    },
    'coquizadora-salina-cruz': {
      refinerias: ['salina-cruz'],
      dato: 'Con ella Salina Cruz «dejará de producir combustóleo» (Pemex): el juego le quita tantos barriles de combustóleo como barriles de gasolina y diésel agrega la coquizadora (estimación del juego)',
      fuentes: ['pmx-c38-2022', 'cpm-2024'],
    },
  },
  empresas,
  centrales: CENTRALES.map(({ empresa, ...c }) => ({ ...c, empresa })),
  cfe: {
    mbd: r2(mbdCfe),
    dato: `La CFE quemó ${fmt(mbdCfe, 1)} mil barriles diarios de combustóleo en 2018 (suma de sus empresas de generación); el país usó ${fmt(REAL[2018][0] + REAL[2018][1] - REAL[2018][2], 1)} (lo que hizo más lo que importó menos lo que exportó). Cuánto quema cada central es estimación del juego: el PRODESEN dice cuáles queman combustóleo y el juego reparte lo de cada empresa por los MW de sus centrales de vapor y combustión interna.`,
    fuentes: ['cfe-ia2018', 'prodesen-2019', 'ig2-2026'],
  },
  reglas: {
    parteAutomatica: 0.5,
    piso: 0.5,
    diasReserva: 15,
    diasPatio: 15,
    dato: 'Reglas del juego: lo que no llega por ducto, la mitad lo llevan solos los buques que renta Pemex (a las centrales que lo reciben en un puerto) o Ferromex y CPKC (a las que lo reciben en tren), primero de lo que hay en las refinerías (las de su costa, o la más cercana) y si no, importado; la otra mitad espera los trenes y buques del jugador. Una central guarda hasta 15 días de esa mitad; sin nada de su combustóleo da la mitad de sus MW, como Nava sin carbón. Una refinería guarda hasta 15 días de su combustóleo; lo que no cabe se exporta.',
    fuentes: [],
  },
  importacionCfe: {
    puerto: 'puerto:tuxpan',
    dato: 'El combustóleo que CFEnergía compraba en Estados Unidos llegaba en buque tanque al puerto de Tuxpan (ASF, Cuenta Pública 2017).',
    fuentes: ['asf-2017-0522'],
  },
  modos2018: {
    buque: 20.8,
    carrotanque: 31.0,
    trenToneladas: 1639000,
    dato: `En 2018 Pemex movió 20.8 mil barriles diarios de combustóleo en buque tanque y 31.0 en carro tanque (ASF); el tren llevó 1.639 millones de toneladas, unos ${fmt((1639000 * BARRILES_POR_T) / 365 / 1000, 1)} mil barriles diarios (ATTRAPI).`,
    fuentes: ['asf-2018-0474', 'attrapi-2018'],
  },
  real: {
    produccion: Object.fromEntries(Object.entries(REAL).map(([a, v]) => [a, v[0]])),
    importacion: Object.fromEntries(Object.entries(REAL).map(([a, v]) => [a, v[1]])),
    exportacion: Object.fromEntries(Object.entries(REAL).map(([a, v]) => [a, v[2]])),
    parcial: { 2026: 'enero a junio' },
    dato: 'Lo que Pemex hizo, importó y exportó de combustóleo, miles de barriles diarios.',
    fuentes: ['ig2-2026'],
  },
};

await writeFile(join(DATOS, 'combustoleo.json'), JSON.stringify(datos, null, 1) + '\n');
console.log('refinerías', Object.entries(refinerias).map(([id, r]) => `${id} ${r.rendimiento}`).join(', '));
console.log('2018 calculado', r1(calculado2018), 'real', REAL[2018][0]);
for (const e of empresas) console.log(e.nombre, e.mbd, 'Mbd →', e.centrales.map((id) => `${id} ${CENTRALES.find((c) => c.id === id).mbd}`).join(', '));
console.log('CFE', r2(mbdCfe), 'Mbd');
