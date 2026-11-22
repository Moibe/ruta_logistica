// Builds the fuel data of the game: what each state uses, the zones the
// pipelines reach, how much a train and a tanker carry, and the real series
// for Realidad. Every figure keeps its source.
//
//   node scripts/combustibles/gen-combustibles.mjs
//
// Self-contained: the figures were read once from their sources (see each
// entry of FUENTES and docs/enciclopedia.md, «Los combustibles») and are
// written here as data.
//
// Writes src/lib/domain/datos/combustibles.json.

import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const FUENTES = {
  'cne-expendio': {
    fuente:
      'Comisión Nacional de Energía (antes CRE), datos abiertos «Volúmenes de venta de expendio al público»: litros de gasolina regular y premium y de diésel (automotriz, agrícola y marino) vendidos en las estaciones de servicio de cada estado, abril a diciembre de 2018',
    url: 'https://www.gob.mx/cne/articulos/consulta-de-datos-abiertos',
  },
  'cne-aerodromos': {
    fuente:
      'Comisión Nacional de Energía, datos abiertos «Volúmenes entregados de expendio en aeródromos»: litros de turbosina entregados en cada estado, abril a diciembre de 2018 (la serie empieza en abril de 2018)',
    url: 'https://www.gob.mx/cne/articulos/consulta-de-datos-abiertos',
  },
  'sener-ph2026': {
    fuente:
      'SENER, Plan de Desarrollo del Sector Hidrocarburos (4 de agosto de 2026): tabla 2.24, demanda nacional de petrolíferos 2010–2024 (2018: gasolinas 787, diésel 387 y turbosina 86 Mbd); en 2024 Pemex movió el 69.7 % de sus combustibles por ducto y el 15.3 % en autotanque',
    url: 'https://dof.gob.mx/nota_detalle_popup.php?codigo=5798065',
  },
  'ig2-2026': {
    fuente:
      'Segundo Informe de Gobierno 2025–2026, anexo estadístico (SENER y Pemex): «Producción, importación y exportación de productos petrolíferos de PEMEX», «Precios y exportaciones de petróleo crudo» y «Producción de petróleo crudo por activos de PEMEX»; 2026, de enero a junio',
    url: 'https://gaceta.diputados.gob.mx/PDF/66/2026/sep/segundo-informe-de-gobierno.pdf',
  },
  'pmx-ia2023': {
    fuente:
      'Pemex, Informe Anual 2023: en 2023 movió 2,082 Mbd por ducto, 451 por autotanque y carro tanque y 166 en buque tanque (crudo, petrolíferos y petroquímicos); tiene 16 buques tanque, 1,800 autotanques y 525 carros tanque',
    url: 'https://gaceta.diputados.gob.mx/PDF/65/2024/may/Pemex-20240514.pdf',
  },
  'attrapi-2018': {
    fuente: 'ATTRAPI, Anuario Estadístico Ferroviario 2018, tabla 6-4: carga transportada por producto (diésel, combustóleo y gasolina)',
    url: 'https://www.gob.mx/cms/uploads/attachment/file/1099335/Anuario_2018.pdf',
  },
  'attrapi-2025': {
    fuente: 'ATTRAPI, Anuario Estadístico Ferroviario 2025, carga transportada por producto (p. 72): gasolina, diésel y combustóleo',
    url: 'https://www.gob.mx/cms/uploads/attachment/file/1100990/Anuario_2025.pdf',
  },
  'eia-unidades': {
    fuente:
      'EIA (gobierno de EUA), International Energy Statistics, unidades: barriles por tonelada métrica de gasolina (8.53), destilados o diésel (7.46) y turbosina (7.93)',
    url: 'https://www.eia.gov/cfapps/ipdbproject/docs/unitswithpetro.php',
  },
  'pmx-buques': {
    fuente:
      'Pemex, boletines regionales de Tampico 2019-004 (el buque tanque Rarámuri, uno de los 16 de su flota, carga 320 mil barriles) y 2024-005 (el Miguel Hidalgo II, de 50 mil toneladas de peso muerto, unos 320 mil barriles). El sitio de Pemex no deja leerlos automáticamente: la cifra es la que muestra el buscador',
    url: 'https://www.pemex.com/saladeprensa/boletines_regionales/Paginas/2024-005_tampico.aspx',
  },
  'sener-mapa-2018': {
    fuente:
      'SENER, mapa «Infraestructura Nacional de Petrolíferos, 2018» (31 de octubre de 2018): las 73 terminales de almacenamiento y las 5 ' +
      'terminales marítimas de Pemex, con su capacidad y su medio de suministro, y los poliductos por región. Ya no está en gob.mx: copia del ' +
      'Internet Archive del 26 de marzo de 2022',
    url: 'http://web.archive.org/web/20220326183525/https://www.gob.mx/cms/uploads/attachment/file/416897/Mapa_log_stica_Sener_8_Reg_31-10-2018_Nueva_numeraci_n_VF.pdf',
  },
  'cnh-tar': {
    fuente: 'CNH, capa «Terminal de almacenamiento Pemex» (73 terminales), copia en el servidor de la SEMARNAT: la ubicación de cada terminal',
    url: 'https://geomaticasig1.semarnat.gob.mx/arcgis/rest/services/Hosted/Terminal_de_almacenamiento_Pemex/FeatureServer/1',
  },
  'asf-2018-0474': {
    fuente:
      'ASF, auditoría 474-DE «Desempeño de Pemex Logística», Cuenta Pública 2018: en 2018 movió 1,743.4 Mbd por ducto, 340.8 en autotanque, ' +
      '77.0 en carro tanque y 182.8 en buque tanque (crudo y petrolíferos); sus buques tanque podían mover 294.4 Mbd',
    url: 'https://www.asf.gob.mx/Trans/Informes/IR2018c/Documentos/Auditorias/2018_0474_a.pdf',
  },
  'asf-2018-0476': {
    fuente: 'ASF, auditoría 476 «Utilización de la infraestructura de Pemex Logística», Cuenta Pública 2018: al cierre de 2018 tenía 16 buques tanque (2 propios), 1,485 autotanques y 511 carros tanque',
    url: 'https://www.asf.gob.mx/Trans/Informes/IR2018c/Documentos/Auditorias/2018_0476_a.pdf',
  },
  'semar-puertos-2024': {
    fuente:
      'SEMAR, Anuario Estadístico de los Puertos de México 2024, serie histórica del movimiento de carga de cada puerto (2017–2024): petróleo y derivados de importación, exportación y cabotaje',
    url: 'https://www.gob.mx/asuntosmaritimosyportuarios/documentos/anuario-estadistico-de-los-puertos-de-mexico-2024',
  },
};

// ---- what each state uses ------------------------------------------------------------------------

/** SENER, tabla 2.24: the country's use in 2018, Mbd. */
const DEMANDA_2018 = { gasolina: 787, diesel: 387, turbosina: 86 };

/** CNE, April–December 2018: each state's share of what was sold (%, each column adds up to 100). */
const VENTAS_2018 = {
  gasolina: { AGS: 1.325, BC: 4.68, BCS: 1.148, CAMP: 0.674, COAH: 2.963, COL: 0.74, CHIS: 2.665, CHIH: 4.311, CDMX: 7.51, DGO: 1.351, GTO: 4.337, GRO: 1.89, HGO: 1.821, JAL: 7.209, MEX: 11.859, MICH: 3.565, MOR: 1.633, NAY: 1.047, NL: 5.725, OAX: 2.16, PUE: 3.817, QRO: 2.592, QROO: 2.067, SLP: 2.469, SIN: 3.201, SON: 3.418, TAB: 1.536, TAMPS: 3.533, TLAX: 0.68, VER: 4.564, YUC: 2.047, ZAC: 1.462 },
  diesel: { AGS: 1.709, BC: 3.257, BCS: 0.859, CAMP: 0.95, COAH: 3.027, COL: 1.458, CHIS: 1.929, CHIH: 4.652, CDMX: 2.795, DGO: 2.133, GTO: 5.129, GRO: 1.385, HGO: 2.85, JAL: 8.479, MEX: 10.216, MICH: 4.033, MOR: 1.03, NAY: 1.067, NL: 4.16, OAX: 2.087, PUE: 3.336, QRO: 3.224, QROO: 1.409, SLP: 3.215, SIN: 4.158, SON: 4.235, TAB: 1.493, TAMPS: 4.188, TLAX: 0.673, VER: 7.143, YUC: 1.582, ZAC: 2.138 },
  turbosina: { AGS: 0.539, BC: 5.64, BCS: 3.249, CAMP: 0.266, COAH: 0.46, COL: 0.177, CHIS: 0.825, CHIH: 1.656, CDMX: 39.42, DGO: 0.255, GTO: 1.485, GRO: 0.55, HGO: 0.006, JAL: 10.2, MEX: 1.28, MICH: 0.271, MOR: 0.01, NAY: 0.082, NL: 4.582, OAX: 0.919, PUE: 0.44, QRO: 1.197, QROO: 20.024, SLP: 0.434, SIN: 1.731, SON: 1.266, TAB: 0.533, TAMPS: 0.553, TLAX: 0, VER: 0.283, YUC: 1.438, ZAC: 0.231 },
};

const ESTADOS = Object.keys(VENTAS_2018.gasolina);
const totalDemanda = Object.values(DEMANDA_2018).reduce((s, v) => s + v, 0);
const bruta = Object.fromEntries(
  ESTADOS.map((e) => [e, Object.entries(DEMANDA_2018).reduce((s, [p, mbd]) => s + (mbd * VENTAS_2018[p][e]) / 100, 0) / totalDemanda])
);
// The published shares are rounded: normalised so the country's use is whole.
const sumaBruta = Object.values(bruta).reduce((s, v) => s + v, 0);
const parte = Object.fromEntries(ESTADOS.map((e) => [e, Number((bruta[e] / sumaBruta).toFixed(5))]));

// ---- tonnes per barrel -------------------------------------------------------------------------------

const BARRILES_POR_T = { gasolina: 8.53, diesel: 7.46, turbosina: 7.93 };
const tPorBarril = Number(
  (Object.entries(DEMANDA_2018).reduce((s, [p, mbd]) => s + mbd / BARRILES_POR_T[p], 0) / totalDemanda).toFixed(4)
);

// ---- the zones the pipelines reach ----------------------------------------------------------------

/**
 * SENER, «Infraestructura Nacional de Petrolíferos, 2018»: Pemex's 78 terminals (73 storage and
 * distribution terminals and 5 marine terminals), each with its operating capacity (thousand
 * barrels) and how it is supplied. The map's four private terminals are left out.
 * [nombre, estado, región del mapa, medio de suministro, capacidad operativa (mb), lon, lat]
 * Coordinates: the CNH's layer of Pemex terminals (SEMARNAT's copy); T.M. Pajaritos and T.M. Tuxpan
 * at their port, Tapachula II with Tapachula.
 */
const TERMINALES = [
  ['Ciudad Obregón', 'SON', 'Noroeste', 'ducto', 112, -109.9256, 27.5457],
  ['Culiacán', 'SIN', 'Noroeste', 'ducto', 85, -107.4333, 24.7728],
  ['Ensenada', 'BC', 'Noroeste', 'ducto', 100, -116.6825, 31.882],
  ['Guamúchil', 'SIN', 'Noroeste', 'ducto', 74, -108.111, 25.4715],
  ['Hermosillo', 'SON', 'Noroeste', 'ducto', 86, -110.9036, 29.0245],
  ['La Paz', 'BCS', 'Noroeste', 'buquetanque', 162, -110.3104, 24.2209],
  ['Magdalena', 'SON', 'Noroeste', 'autotanque', 27, -110.9646, 30.6382],
  ['Mazatlán', 'SIN', 'Noroeste', 'buquetanque', 468, -106.3958, 23.2395],
  ['Mexicali', 'BC', 'Noroeste', 'ducto', 118, -115.6715, 32.5806],
  ['Navojoa', 'SON', 'Noroeste', 'autotanque', 25, -109.4337, 27.0309],
  ['Nogales', 'SON', 'Noroeste', 'autotanque', 35, -110.9378, 31.2795],
  ['Rosarito', 'BC', 'Noroeste', 'buquetanque', 1020, -117.07, 32.3749],
  ['Tepic', 'NAY', 'Noroeste', 'autotanque', 66, -104.8415, 21.4827],
  ['Topolobampo', 'SIN', 'Noroeste', 'buquetanque', 539, -109.0467, 25.6154],
  ['T.M. Guaymas', 'SON', 'Noroeste', 'buquetanque', 534, -110.8658, 27.9305],
  ['Chihuahua', 'CHIH', 'Norte', 'ducto', 336, -105.985, 28.5979],
  ['Ciudad Juárez', 'CHIH', 'Norte', 'ducto+autotanque', 185, -106.479, 31.6052],
  ['Durango', 'DGO', 'Norte', 'carrotanque', 52, -104.6267, 24.033],
  ['Gómez Palacio', 'DGO', 'Norte', 'ducto', 340, -103.4682, 25.5629],
  ['Parral', 'CHIH', 'Norte', 'autotanque', 40, -105.6624, 26.9828],
  ['Cadereyta', 'NL', 'Noreste', 'refineria+ducto', 75, -99.9477, 25.5917],
  ['Ciudad Mante', 'TAMPS', 'Noreste', 'autotanque', 15, -98.9812, 22.7115],
  ['Ciudad Valles', 'SLP', 'Noreste', 'carrotanque', 55, -99.0382, 22.0064],
  ['Ciudad Victoria', 'TAMPS', 'Noreste', 'ducto', 147, -99.0944, 23.6916],
  ['Matehuala', 'SLP', 'Noreste', 'autotanque', 25, -100.644, 23.6664],
  ['Monclova', 'COAH', 'Noreste', 'ducto', 182, -101.4258, 26.9581],
  ['Nuevo Laredo', 'TAMPS', 'Noreste', 'autotanque', 59, -99.5682, 27.4738],
  ['Reynosa', 'TAMPS', 'Noreste', 'ducto+autotanque', 15, -98.2786, 26.0754],
  ['Sabinas', 'COAH', 'Noreste', 'ducto', 73, -101.1343, 27.832],
  ['Saltillo', 'COAH', 'Noreste', 'ducto', 118, -100.9714, 25.4892],
  ['San Luis Potosí', 'SLP', 'Noreste', 'ducto', 69, -100.9541, 22.1374],
  ['Santa Catarina', 'NL', 'Noreste', 'ducto', 587, -100.4856, 25.7048],
  ['T.M. Madero', 'TAMPS', 'Noreste', 'refineria', 364, -97.8351, 22.238],
  ['Escamela', 'VER', 'Golfo', 'ducto', 70, -97.0598, 18.8597],
  ['Minatitlán', 'VER', 'Golfo', 'refineria', 6, -94.5328, 17.9782],
  ['Perote', 'VER', 'Golfo', 'autotanque', 19, -97.2519, 19.5708],
  ['Poza Rica', 'VER', 'Golfo', 'ducto', 39, -97.4671, 20.5238],
  ['Tierra Blanca', 'VER', 'Golfo', 'ducto', 49, -96.3434, 18.4435],
  ['Veracruz', 'VER', 'Golfo', 'ducto+buquetanque', 352, -96.1466, 19.2051],
  ['Villahermosa', 'TAB', 'Golfo', 'ducto+autotanque', 237, -92.9953, 17.9977],
  ['Xalapa', 'VER', 'Golfo', 'autotanque', 27, -96.9271, 19.5716],
  ['T.M. Pajaritos', 'VER', 'Golfo', 'refineria+buquetanque', 4370, -94.41, 18.14],
  ['T.M. Tuxpan', 'VER', 'Golfo', 'buquetanque', 2201, -97.28, 20.955],
  ['Añil', 'CDMX', 'Centro', 'ducto', 158, -99.104, 19.4046],
  ['Azcapotzalco', 'CDMX', 'Centro', 'ducto+autotanque', 1108, -99.2038, 19.4661],
  ['Barranca del Muerto', 'CDMX', 'Centro', 'ducto', 92, -99.2143, 19.3657],
  ['Cuautla', 'MOR', 'Centro', 'autotanque', 45, -98.905, 18.754],
  ['Cuernavaca', 'MOR', 'Centro', 'ducto', 102, -99.1918, 18.9208],
  ['Pachuca', 'HGO', 'Centro', 'ducto', 120, -98.7473, 20.0971],
  ['Puebla', 'PUE', 'Centro', 'ducto', 302, -98.1595, 19.0737],
  ['San Juan Ixhuatepec', 'MEX', 'Centro', 'ducto', 139, -99.1142, 19.5286],
  ['Tehuacán', 'PUE', 'Centro', 'autotanque', 32, -97.4319, 18.5409],
  ['Toluca', 'MEX', 'Centro', 'ducto', 135, -99.6029, 19.289],
  ['Querétaro', 'QRO', 'Centro', 'ducto', 166, -100.4331, 20.6209],
  ['Aguascalientes', 'AGS', 'Occidente', 'ducto', 68, -102.2234, 21.7576],
  ['Celaya', 'GTO', 'Occidente', 'ducto', 130, -100.8532, 20.521],
  ['Colima', 'COL', 'Occidente', 'autotanque', 44, -103.7657, 19.2342],
  ['El Castillo', 'JAL', 'Occidente', 'ducto', 221, -103.2266, 20.5055],
  ['Irapuato', 'GTO', 'Occidente', 'ducto', 314, -101.2977, 20.6372],
  ['Lázaro Cárdenas', 'MICH', 'Occidente', 'buquetanque', 609, -102.1663, 17.9403],
  ['León', 'GTO', 'Occidente', 'ducto', 80, -101.7126, 21.0991],
  ['Manzanillo', 'COL', 'Occidente', 'buquetanque', 328, -104.2799, 19.0771],
  ['Morelia', 'MICH', 'Occidente', 'ducto', 98, -101.1475, 19.8442],
  ['Uruapan', 'MICH', 'Occidente', 'autotanque', 102, -102.0016, 19.4215],
  ['Zacatecas', 'ZAC', 'Occidente', 'ducto', 58, -102.4378, 22.7497],
  ['Zamora', 'MICH', 'Occidente', 'ducto', 64, -102.2691, 20.0876],
  ['Zapopan', 'JAL', 'Occidente', 'ducto', 281, -103.4612, 20.7112],
  ['Acapulco', 'GRO', 'Sur', 'buquetanque', 145, -99.8469, 16.8404],
  ['Iguala', 'GRO', 'Sur', 'autotanque', 42, -99.5377, 18.3592],
  ['Oaxaca', 'OAX', 'Sur', 'autotanque', 84, -96.6129, 17.0332],
  ['Salina Cruz', 'OAX', 'Sur', 'refineria', 154, -95.1841, 16.2059],
  ['Tapachula', 'CHIS', 'Sur', 'autotanque', 15, -92.397, 14.7266],
  ['Tapachula II', 'CHIS', 'Sur', 'autotanque', 51, -92.397, 14.7266],
  ['Tuxtla Gutiérrez', 'CHIS', 'Sur', 'autotanque', 75, -93.193, 16.7659],
  ['T.M. Salina Cruz', 'OAX', 'Sur', 'refineria+buquetanque', 1120, -95.1841, 16.2059],
  ['Campeche', 'CAMP', 'Sureste', 'buquetanque', 208, -90.5876, 19.8143],
  ['Mérida', 'YUC', 'Sureste', 'ducto', 115, -89.6931, 20.9241],
  ['Progreso', 'YUC', 'Sureste', 'buquetanque', 198, -89.6612, 21.2499],
];

/**
 * Where the pipeline of each pipeline-fed terminal comes from, after the map's pipeline tables:
 * - `centro`: Tula, Salamanca and Minatitlán, joined by their poliductos (Tula–Salamanca,
 *   Minatitlán–México, Minatitlán–Puebla), with the import terminal of Tuxpan at the head of the
 *   Tuxpan–Azcapotzalco and Tuxpan–Tula lines;
 * - `noreste`: Cadereyta and Madero (Madero–Cadereyta), and by Santa Catarina–Gómez Palacio and
 *   Gómez Palacio–Chihuahua the Laguna and Chihuahua;
 * - `sur`: Salina Cruz;
 * - `mar`: the lines out of a marine terminal that is itself supplied by tanker (Rosarito–Mexicali
 *   and Rosarito–Ensenada, Guaymas–Hermosillo and Guaymas–Ciudad Obregón, Topolobampo–Culiacán with
 *   Guamúchil, Progreso–Mérida).
 */
const RED_DE_DUCTO = {
  'Ciudad Obregón': 'mar', Culiacán: 'mar', Ensenada: 'mar', Guamúchil: 'mar', Hermosillo: 'mar', Mexicali: 'mar', Mérida: 'mar',
  Chihuahua: 'noreste', 'Ciudad Juárez': 'noreste', 'Gómez Palacio': 'noreste', Cadereyta: 'noreste', 'Ciudad Victoria': 'noreste',
  Monclova: 'noreste', Reynosa: 'noreste', Sabinas: 'noreste', Saltillo: 'noreste', 'Santa Catarina': 'noreste', 'T.M. Madero': 'noreste',
  'San Luis Potosí': 'centro', Escamela: 'centro', Minatitlán: 'centro', 'Poza Rica': 'centro', 'Tierra Blanca': 'centro',
  Veracruz: 'centro', Villahermosa: 'centro', 'T.M. Pajaritos': 'centro', 'T.M. Tuxpan': 'centro', Añil: 'centro',
  Azcapotzalco: 'centro', 'Barranca del Muerto': 'centro', Cuernavaca: 'centro', Pachuca: 'centro', Puebla: 'centro',
  'San Juan Ixhuatepec': 'centro', Toluca: 'centro', Querétaro: 'centro', Aguascalientes: 'centro', Celaya: 'centro',
  'El Castillo': 'centro', Irapuato: 'centro', León: 'centro', Morelia: 'centro', Zacatecas: 'centro', Zamora: 'centro',
  Zapopan: 'centro', 'Salina Cruz': 'sur', 'T.M. Salina Cruz': 'sur',
};

/** The marine terminal each sea-fed pipeline starts at. */
const DUCTO_DESDE = {
  Mexicali: 'Rosarito',
  Ensenada: 'Rosarito',
  Hermosillo: 'T.M. Guaymas',
  'Ciudad Obregón': 'T.M. Guaymas',
  Culiacán: 'Topolobampo',
  Guamúchil: 'Topolobampo',
  Mérida: 'Progreso',
};

/** States without a Pemex terminal on the map: supplied from a neighbour's. */
const SIN_TERMINAL = { TLAX: 'Puebla', QROO: 'Mérida' };

const R_TIERRA = 6371;
const radianes = (d) => (d * Math.PI) / 180;
function kmEntre([lo1, la1], [lo2, la2]) {
  const h = Math.sin(radianes(la2 - la1) / 2) ** 2 + Math.cos(radianes(la1)) * Math.cos(radianes(la2)) * Math.sin(radianes(lo2 - lo1) / 2) ** 2;
  return 2 * R_TIERRA * Math.asin(Math.sqrt(h));
}

const terminales = TERMINALES.map(([nombre, estado, region, medio, capacidad, lon, lat]) => ({ nombre, estado, region, medio, capacidad, lonLat: [lon, lat] }));
for (const t of terminales) {
  if (DUCTO_DESDE[t.nombre]) t.desde = DUCTO_DESDE[t.nombre];
  if (RED_DE_DUCTO[t.nombre]) t.red = RED_DE_DUCTO[t.nombre];
  else if (t.medio === 'buquetanque') t.red = 'mar';
  else if (t.medio === 'carrotanque') t.red = 'tren';
}
// A terminal supplied by truck is supplied from the nearest terminal of its region that isn't.
for (const t of terminales.filter((x) => x.medio === 'autotanque')) {
  const desde = terminales
    .filter((x) => x.region === t.region && x.medio !== 'autotanque')
    .sort((a, b) => kmEntre(a.lonLat, t.lonLat) - kmEntre(b.lonLat, t.lonLat))[0];
  t.red = desde.red;
  t.desde = desde.nombre;
}
for (const t of terminales) if (!t.red) throw new Error(`Terminal sin red: ${t.nombre}`);

/** Each state's use split by how its terminals are supplied, weighted by their operating capacity. */
const repartoDe = (estado) => {
  const propias = terminales.filter((t) => t.estado === estado);
  const lista = propias.length ? propias : terminales.filter((t) => t.nombre === SIN_TERMINAL[estado]);
  if (!lista.length) throw new Error(`Sin terminal para ${estado}`);
  const total = lista.reduce((s, t) => s + t.capacidad, 0);
  const r = {};
  for (const t of lista) r[t.red] = (r[t.red] ?? 0) + t.capacidad / total;
  return r;
};
const REPARTO = Object.fromEntries(ESTADOS.map((e) => [e, repartoDe(e)]));

const ZONAS = [
  {
    id: 'centro',
    nombre: 'Centro, Golfo y Occidente',
    refinerias: ['tula', 'salamanca', 'minatitlan', 'deer-park'],
    dato:
      'Tula, Salamanca y Minatitlán están unidas por sus poliductos, que llegan del Golfo a Jalisco y Michoacán; Tuxpan, la terminal ' +
      'de importación, entra a la misma red. Lo que hace Deer Park entra al país por esa terminal (estimación del juego).',
  },
  {
    id: 'noreste',
    nombre: 'Noreste y Norte',
    refinerias: ['cadereyta', 'madero'],
    dato: 'Cadereyta y Madero, unidas por su bidireccional; por Santa Catarina–Gómez Palacio y Gómez Palacio–Chihuahua llegan a la Laguna y a Chihuahua.',
  },
  {
    id: 'sur',
    nombre: 'Salina Cruz',
    refinerias: ['salina-cruz'],
    dato: 'Salina Cruz surte por carretera a Oaxaca y Chiapas; lo demás sale en buque tanque al Pacífico, como dibuja el mapa de la SENER.',
  },
].map((z) => ({
  ...z,
  estados: Object.fromEntries(
    ESTADOS.filter((e) => REPARTO[e][z.id]).map((e) => [e, Number(REPARTO[e][z.id].toFixed(3))])
  ),
  fuentes: ['sener-mapa-2018'],
}));

/** States reached through a port of a neighbour: the peninsula through Progreso, Nayarit through Mazatlán. */
const SURTE = { 'puerto:progreso': ['CAMP', 'QROO'], 'puerto:mazatlan': ['NAY'] };

// ---- petroleum through each port -------------------------------------------------------------------

/**
 * SEMAR, port yearbook 2024 (historical series): tonnes of petroleum and products imported,
 * exported, received and sent coastwise, in 2018 and 2024. Coatzacoalcos includes Pajaritos and
 * Tampico includes Madero, as the yearbook counts them.
 */
const PUERTOS = {
  ensenada: { 2018: [0, 0, 0, 0], 2024: [0, 0, 0, 0], nota: 'El combustible de Baja California entra por la terminal de Pemex en Rosarito: 2.49 millones de toneladas importadas en 2018. En el juego, Ensenada la representa.' },
  guaymas: { 2018: [1743841, 0, 606235, 0], 2024: [1081450, 0, 583890, 64689] },
  topolobampo: { 2018: [1602486, 0, 325920, 53651], 2024: [833927, 0, 239020, 54084] },
  'la-paz': { 2018: [700012, 0, 453408, 0], 2024: [730346, 0, 574412, 0] },
  mazatlan: { 2018: [1977130, 0, 433032, 0], 2024: [726623, 0, 856379, 0] },
  manzanillo: { 2018: [2601164, 24390, 555203, 46704], 2024: [1196654, 280972, 512863, 100658] },
  'lazaro-cardenas': { 2018: [530442, 961795, 673827, 390215], 2024: [331164, 1098120, 682322, 366093] },
  acapulco: { 2018: [0, 0, 1229407, 0], 2024: [11056, 0, 454624, 0] },
  'salina-cruz': { 2018: [30705, 4481608, 11645, 3550180], 2024: [0, 7080819, 0, 3720381] },
  'puerto-chiapas': { 2018: [0, 0, 0, 0], 2024: [0, 0, 0, 0] },
  tampico: { 2018: [3463792, 1384872, 154147, 87298], 2024: [891128, 3283707, 7809, 651086] },
  altamira: { 2018: [0, 0, 0, 0], 2024: [0, 0, 0, 0] },
  tuxpan: { 2018: [10134291, 0, 37675, 0], 2024: [9255794, 0, 1521098, 0] },
  veracruz: { 2018: [1812737, 0, 63653, 0], 2024: [5426535, 0, 291419, 0] },
  coatzacoalcos: { 2018: [11269162, 8310717, 0, 3734040], 2024: [5019843, 13469879, 0, 3362942] },
  'dos-bocas': { 2018: [105102, 30623149, 347522, 608564], 2024: [446515, 14345560, 709003, 471406] },
  progreso: { 2018: [609303, 0, 2510362, 0], 2024: [2764219, 0, 864381, 0] },
};

// ---- real series ---------------------------------------------------------------------------------------

/** Segundo Informe de Gobierno, anexo: Pemex's crude production (por activos, total) and crude exports, Mbd. */
const CRUDO = {
  produccion: { 2018: 1833.3, 2019: 1700.7, 2020: 1705.4, 2021: 1756.4, 2022: 1784.6, 2023: 1875.4, 2024: 1759.0, 2025: 1635.5, 2026: 1655.4 },
  exportacion: { 2018: 1184.1, 2019: 1103.3, 2020: 1119.9, 2021: 1018.3, 2022: 953.2, 2023: 1032.8, 2024: 806.1, 2025: 580.6, 2026: 452.6 },
};

/** Same annex: gasoline, diesel and querosenos (jet fuel) Pemex made and imported, Mbd. */
const PETROLIFEROS = {
  gasolinas: {
    produccion: { 2018: 207.1, 2019: 203.5, 2020: 185.6, 2021: 232.9, 2022: 271.0, 2023: 252.4, 2024: 290.3, 2025: 356.2, 2026: 378.2 },
    importacion: { 2018: 581.5, 2019: 515.9, 2020: 374.6, 2021: 325.8, 2022: 401.2, 2023: 386.3, 2024: 366.1, 2025: 301.8, 2026: 271.4 },
  },
  diesel: {
    produccion: { 2018: 116.8, 2019: 130.3, 2020: 113.6, 2021: 117.7, 2022: 146.4, 2023: 134.8, 2024: 180.0, 2025: 227.8, 2026: 270.2 },
    importacion: { 2018: 240.6, 2019: 178.4, 2020: 114.3, 2021: 101.7, 2022: 175.1, 2023: 173.6, 2024: 137.5, 2025: 81.2, 2026: 77.1 },
  },
  querosenos: {
    produccion: { 2018: 34.7, 2019: 29.0, 2020: 17.5, 2021: 28.4, 2022: 33.1, 2023: 36.3, 2024: 33.5, 2025: 43.2, 2026: 48.5 },
    importacion: { 2018: 55.2, 2019: 54.6, 2020: 21.8, 2021: 34.3, 2022: 54.4, 2023: 55.8, 2024: 59.2, 2025: 52.1, 2026: 51.2 },
  },
};
const sumar = (k) =>
  Object.fromEntries(
    Object.keys(PETROLIFEROS.gasolinas[k]).map((a) => [a, Number(Object.values(PETROLIFEROS).reduce((s, p) => s + p[k][a], 0).toFixed(1))])
  );

const datos = {
  corte: '2026-11-22',
  nota: 'Generado por scripts/combustibles/gen-combustibles.mjs. Lo que se calcula aquí son estimaciones del juego con cifras oficiales; cada dato dice de dónde sale.',
  fuentes: FUENTES,
  densidad: {
    tPorBarril,
    dato:
      `Toneladas por barril de la mezcla que usaba el país en 2018 (${DEMANDA_2018.gasolina} Mbd de gasolina, ${DEMANDA_2018.diesel} de diésel y ` +
      `${DEMANDA_2018.turbosina} de turbosina), con los barriles por tonelada de la EIA: 8.53, 7.46 y 7.93. Un tren de 2,436 toneladas lleva así unos ` +
      `${Math.round(2436 / tPorBarril).toLocaleString('en-US')} barriles. Cálculo del juego.`,
    fuentes: ['eia-unidades', 'sener-ph2026'],
  },
  tanque: {
    barriles: 320000,
    dato: 'Lo que carga un buque tanque de la flota de Pemex: 320 mil barriles.',
    fuentes: ['pmx-buques'],
  },
  consumo: {
    año: 2018,
    parte,
    dato:
      'Lo que usa cada estado: su parte de lo que se vendió de gasolina, diésel y turbosina de abril a diciembre de 2018 (CNE), ponderada con lo que el país ' +
      'usó de cada uno ese año (SENER). Del diésel solo se cuenta el de las gasolineras (el 60 % del total); el de la industria, la minería y el campo ' +
      'comprado fuera de ellas no está por estado. Enero a marzo de 2018 se deja fuera porque al registro le faltan reportes del norte. Cálculo del juego.',
    fuentes: ['cne-expendio', 'cne-aerodromos', 'sener-ph2026'],
  },
  zonas: ZONAS,
  reparto: {
    porEstado: Object.fromEntries(ESTADOS.map((e) => [e, Object.fromEntries(Object.entries(REPARTO[e]).map(([k, v]) => [k, Number(v.toFixed(3))]))])),
    dato:
      'Cómo se surte cada estado: la parte de su consumo que llega por los ductos de una zona de refinerías, por mar o por tren. Pesa cada ' +
      'terminal de Pemex del estado por su capacidad operativa (el mapa no da sus ventas); la que se surte por carretera toma el medio de la ' +
      'terminal más cercana de su región que no se surte así; Tlaxcala, sin terminal, se surte de Puebla, y Quintana Roo de Mérida. Estimación del juego.',
    fuentes: ['sener-mapa-2018', 'cnh-tar'],
  },
  terminales: terminales.map(({ nombre, estado, region, medio, capacidad, lonLat, red, desde }) => ({
    nombre,
    estado,
    region,
    medio,
    capacidad,
    lonLat,
    red,
    ...(desde ? { desde } : {}),
  })),
  surte: SURTE,
  puertos: {
    porPuerto: PUERTOS,
    dato: 'Petróleo y derivados por puerto, en toneladas: importación, exportación, cabotaje recibido y cabotaje enviado.',
    fuentes: ['semar-puertos-2024'],
  },
  puertoDeRefineria: {
    'salina-cruz': 'puerto:salina-cruz',
    minatitlan: 'puerto:coatzacoalcos',
    madero: 'puerto:tampico',
    olmeca: 'puerto:dos-bocas',
  },
  dias: {
    patio: 15,
    porSurtir: 15,
    dato:
      'Reglas del juego: una refinería guarda hasta 15 días de lo que produce esperando tren o barco, y un estado recibe de una vez hasta 15 días de lo ' +
      'que sus ductos no le traen.',
    fuentes: [],
  },
  real: {
    crudo: {
      ...CRUDO,
      parcial: { 2026: 'enero a junio' },
      dato: 'Producción de petróleo crudo de Pemex (total por activos) y exportación de crudo, en miles de barriles diarios.',
      fuentes: ['ig2-2026'],
    },
    combustibles: {
      produccion: sumar('produccion'),
      importacion: sumar('importacion'),
      porProducto: PETROLIFEROS,
      parcial: { 2026: 'enero a junio' },
      dato:
        'Gasolinas, diésel y querosenos (la turbosina) que Pemex produjo e importó, en miles de barriles diarios. No incluye lo que importan los privados: en 2024 eran cerca del 15 % de lo que se vende (SENER).',
      fuentes: ['ig2-2026', 'sener-ph2026'],
    },
    tren: {
      porAño: {
        2018: { gasolina: 1.608, diesel: 3.188, combustoleo: 1.639 },
        2025: { gasolina: 4.779, diesel: 3.04, combustoleo: 3.234 },
      },
      dato: 'Millones de toneladas que movió el tren: gasolina, diésel y combustóleo.',
      fuentes: ['attrapi-2018', 'attrapi-2025'],
    },
    modos: {
      año: 2018,
      ducto: 1743.4,
      autotanque: 340.8,
      carrotanque: 77,
      buquetanque: 182.8,
      dato:
        'Lo que movió Pemex en 2018, en miles de barriles diarios, crudo y petrolíferos juntos. En buque tanque fueron 95.6 de gasolina, 62.9 de ' +
        'destilados y 20.8 de combustóleo; en carro tanque, 35.6 de diésel, 31.0 de combustóleo y 10.4 de gasolina. Su flota de 16 buques tanque ' +
        'podía mover 294.4. En 2023 movió 2,082 por ducto, 451 por tierra y 166 por mar.',
      fuentes: ['asf-2018-0474', 'asf-2018-0476', 'pmx-ia2023'],
    },
  },
};

const sumaParte = Object.values(parte).reduce((s, v) => s + v, 0);
if (Math.abs(sumaParte - 1) > 0.002) throw new Error(`Las partes suman ${sumaParte}`);
// Every source an entry cites must be listed.
const citadas = new Set();
(function recorrer(o) {
  if (Array.isArray(o)) o.forEach(recorrer);
  else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) k === 'fuentes' && Array.isArray(v) ? v.forEach((f) => citadas.add(f)) : recorrer(v);
})(datos);
for (const f of citadas) if (!FUENTES[f]) throw new Error(`Fuente sin registrar: ${f}`);
for (const e of ESTADOS) console.log(e.padEnd(6), JSON.stringify(REPARTO[e]));

const OUT = join(ROOT, 'src', 'lib', 'domain', 'datos', 'combustibles.json');
await writeFile(OUT, JSON.stringify(datos, null, 1) + '\n');
console.log(`combustibles.json: ${ESTADOS.length} estados, ${ZONAS.length} zonas, ${tPorBarril} t por barril`);
