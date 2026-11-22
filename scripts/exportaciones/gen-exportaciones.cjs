// Builds src/lib/domain/datos/exportaciones.json and aduanas.json: where exports
// come from (INEGI, value by state), how many tonnes leave by rail and where
// (ATTRAPI's railway yearbook), the customs offices (ANAM) and which game sites
// are exits. Every figure carries its source.
//
// usage: node scripts/exportaciones/gen-exportaciones.cjs <carpeta del EEF del INEGI> <carpeta del PIBE del INEGI (conjunto_de_datos)>
const fs = require('fs');
const path = require('path');
const { CVE } = require('../energia/municipios.cjs');

const ROOT = path.join(__dirname, '..', '..');
const CARPETA = process.argv[2];
const r1 = (x) => Math.round(x * 10) / 10;
const ESTADO_DE_CVE = Object.fromEntries(Object.entries(CVE).map(([k, v]) => [v, k]));

// ---- origins: INEGI, exports by state (thousands of USD, FOB) ------------------------------------
const AÑOS = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
const lineas = fs.readFileSync(path.join(CARPETA, 'eef_estatal_anual_tr_cifra_2007_2025.csv'), 'utf8').replace(/^﻿/, '').split(/\r?\n/);
const cab = lineas[0].split(',');
const iA = cab.indexOf('ANIO');
const iE = cab.indexOf('CVE_ENT');
const iV = cab.indexOf('VAL_USD');
const iS = cab.indexOf('ESTATUS');
const porEstado = {};
const estatus = {};
for (const l of lineas.slice(1)) {
  if (!l.trim()) continue;
  const c = l.split(',');
  const año = +c[iA];
  if (!AÑOS.includes(año) || !c[iV]) continue;
  const edo = ESTADO_DE_CVE[c[iE]];
  if (!edo) continue;
  porEstado[año] ??= {};
  porEstado[año][edo] = (porEstado[año][edo] ?? 0) + +c[iV] / 1000;
  estatus[año] = c[iS];
}
for (const a of AÑOS) for (const e of Object.keys(porEstado[a])) porEstado[a][e] = r1(porEstado[a][e]);
const totalPais = Object.fromEntries(AÑOS.map((a) => [a, r1(Object.values(porEstado[a]).reduce((s, v) => s + v, 0))]));

// ---- domestic cargo: where it comes from -----------------------------------------------------------
// INEGI, PIB por Entidad Federativa: value added of the primary and secondary
// activities (farming, mining, manufacturing, construction), million pesos of
// 2018. What rail carries comes from them, not from services; less oil extraction,
// which leaves by pipeline and ship (it would put Campeche and Tabasco near the top).
const PIBE = process.argv[3];
const { estadoDe } = require('../energia/municipios.cjs');
const AÑOS_PIB = [2018, 2019, 2020, 2021, 2022, 2023];
const productivo = {};
for (const [archivo, signo] of [['conjunto_de_datos_pibe_actividad_ap2023_p.csv', 1], ['conjunto_de_datos_pibe_actividad_as2023_p.csv', 1], ['conjunto_de_datos_pibe_actividad_21p2023_p.csv', -1]]) {
  const filas = fs.readFileSync(path.join(PIBE, archivo), 'utf8').replace(/^﻿/, '').split(/\r?\n/);
  const años = filas[0].split(',').map((c) => parseInt(c, 10));
  for (const f of filas.slice(1)) {
    const c = f.split(',');
    if (!c[0].startsWith('Millones de pesos')) continue;
    const nombre = c[0].split('|')[2].replace(/<[^>]*>/g, '').trim();
    if (nombre === 'Estados Unidos Mexicanos') continue;
    const edo = estadoDe(nombre.replace(' de Zaragoza', '').replace(' de Ocampo', '').replace(' de Ignacio de la Llave', ''));
    if (!edo) throw new Error('estado sin clave: ' + nombre);
    for (const a of AÑOS_PIB) {
      productivo[a] ??= {};
      productivo[a][edo] = (productivo[a][edo] ?? 0) + signo * (+c[años.indexOf(a)] || 0);
    }
  }
}
for (const a of AÑOS_PIB) for (const e of Object.keys(productivo[a])) productivo[a][e] = Math.round(productivo[a][e]);

// ---- exits by rail: ATTRAPI, Anuario Estadístico Ferroviario 2025, tables A10, A11 and A13 (million tonnes) ----
const SERIE = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
const serie = (v) => Object.fromEntries(SERIE.map((a, i) => [a, v[i]]));
const ferrocarril = {
  exportacion: serie([18.58, 24.34, 22.27, 21.31, 22.27, 24.56, 22.91, 22.38, 23.03]),
  importacion: serie([61.2, 67.16, 66.02, 62.92, 70.34, 67.87, 71.07, 73.65, 75.36]),
  exportacionFronteras: serie([14.36, 15.72, 15.91, 15.35, 16.76, 18.97, 18.15, 19.36, 20.53]),
  exportacionPuertos: serie([4.22, 8.62, 6.36, 5.96, 5.5, 5.58, 4.76, 3.02, 2.5]),
  // Table A9: domestic ("interior") traffic and the whole system.
  nacional: serie([47.09, 36.53, 36.9, 36.16, 37.28, 36.03, 37.49, 36.75, 30.55]),
  total: serie([126.88, 128.03, 125.19, 120.38, 129.89, 128.46, 131.48, 132.78, 128.94]),
};
// 2025 by exit (table A13). The yearbook's text comes out one row shifted; these
// are lined up with its percentages and totals.
const porSalida2025 = {
  'ciudad:piedras-negras': 6.95,
  'ciudad:nuevo-laredo': 6.18,
  'ciudad:nogales': 2.62,
  'ciudad:matamoros': 2.35,
  'ciudad:mexicali': 1.32,
  'ciudad:ciudad-juarez': 1.12,
  'ciudad:tijuana': 0,
  'puerto:guaymas': 0.59,
  'puerto:mazatlan': 0.39,
  'puerto:coatzacoalcos': 0.35,
  'puerto:veracruz': 0.34,
  'puerto:tampico': 0.21,
  'puerto:lazaro-cardenas': 0.21,
  'puerto:manzanillo': 0.2,
  'puerto:altamira': 0.12,
  'puerto:topolobampo': 0.1,
};

// ---- customs: ANAM, informe mensual de diciembre de 2025 (Jan–Dec 2025, million pesos) ---------
// [name, kind, game site or null, revenue (cuadros 3–5), value of operations (cuadros 12–14)]
const A = [
  ['Nuevo Laredo', 'fronteriza', 'ciudad:nuevo-laredo', 215227.1, 6666208.8],
  ['Ciudad Juárez', 'fronteriza', 'ciudad:ciudad-juarez', 64213.7, 5711171.0],
  ['Reynosa', 'fronteriza', 'ciudad:reynosa', 32382.4, 1446820.8],
  ['Colombia', 'fronteriza', null, 31238.9, 1239275.5],
  ['Matamoros', 'fronteriza', 'ciudad:matamoros', 30000.6, 546612.2],
  ['Tijuana', 'fronteriza', 'ciudad:tijuana', 23855.6, 1976496.0],
  ['Mexicali', 'fronteriza', 'ciudad:mexicali', 15827.1, 686993.8],
  ['Nogales', 'fronteriza', 'ciudad:nogales', 15184.8, 803117.5],
  ['Piedras Negras', 'fronteriza', 'ciudad:piedras-negras', 13690.0, 1036352.1],
  ['Camargo', 'fronteriza', null, 6676.0, 45837.5],
  ['Ciudad Hidalgo', 'fronteriza', null, 2480.5, 179099.8],
  ['Ciudad Acuña', 'fronteriza', null, 1438.3, 148649.4],
  ['Ojinaga', 'fronteriza', null, 1360.2, 14314.5],
  ['Agua Prieta', 'fronteriza', null, 1298.8, 49510.7],
  ['Miguel Alemán', 'fronteriza', null, 1157.7, 22794.5],
  ['Tecate', 'fronteriza', null, 487.2, 56000.6],
  ['San Luis Río Colorado', 'fronteriza', null, 367.1, 48594.4],
  ['Naco', 'fronteriza', null, 252.0, 2033.0],
  ['Puerto Palomas', 'fronteriza', null, 236.3, 3134.1],
  ['Subteniente López', 'fronteriza', null, 32.6, 8252.6],
  ['Sonoyta', 'fronteriza', null, 15.9, 62.0],
  ['AIFA', 'interior', 'aeropuerto:aifa', 62389.1, 472469],
  ['AICM', 'interior', 'aeropuerto:aicm', 41768.7, 838894],
  ['Puebla', 'interior', 'ciudad:puebla', 34124.5, 719553],
  ['Toluca', 'interior', 'aeropuerto:toluca', 30974.2, 369375],
  ['Guadalajara', 'interior', 'aeropuerto:guadalajara', 16924.9, 2347331],
  ['México', 'interior', 'ciudad:ciudad-de-mexico', 12236.7, 53989],
  ['Aguascalientes', 'interior', 'ciudad:aguascalientes', 12110.4, 253194],
  ['Querétaro', 'interior', 'aeropuerto:queretaro', 11545.8, 438644],
  ['Monterrey', 'interior', 'aeropuerto:monterrey', 11266.4, 832734],
  ['Chihuahua', 'interior', 'ciudad:chihuahua', 1317.5, 94119],
  ['Guanajuato', 'interior', null, 976.8, 41168],
  ['Torreón', 'interior', 'ciudad:torreon', 843.7, 73588],
  ['Manzanillo', 'maritima', 'puerto:manzanillo', 185634.3, 1824374.4],
  ['Veracruz', 'maritima', 'puerto:veracruz', 140978.7, 1467633.5],
  ['Lázaro Cárdenas', 'maritima', 'puerto:lazaro-cardenas', 137665.9, 965709.2],
  ['Tuxpan', 'maritima', 'puerto:tuxpan', 94293.2, 343791.1],
  ['Altamira', 'maritima', 'puerto:altamira', 47669.0, 882185.2],
  ['Ensenada', 'maritima', 'puerto:ensenada', 38610.4, 338437.4],
  ['Mazatlán', 'maritima', 'puerto:mazatlan', 36003.0, 149151.0],
  ['Coatzacoalcos', 'maritima', 'puerto:coatzacoalcos', 25639.3, 299418.9],
  ['Guaymas', 'maritima', 'puerto:guaymas', 12277.0, 124517.6],
  ['Progreso', 'maritima', 'puerto:progreso', 12242.9, 143178.9],
  ['Dos Bocas', 'maritima', 'puerto:dos-bocas', 7952.5, 153495.8],
  ['Tampico', 'maritima', 'puerto:tampico', 6300.5, 78169.7],
  ['La Paz', 'maritima', 'puerto:la-paz', 5410.6, 30256.4],
  ['Cancún', 'maritima', null, 2336.3, 42915.7],
  ['Ciudad del Carmen', 'maritima', null, 1221.9, 141144.1],
  ['Acapulco', 'maritima', 'puerto:acapulco', 796.7, 1635.8],
  ['Salina Cruz', 'maritima', 'puerto:salina-cruz', 527.6, 49035.3],
];
const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
// Exits: the border crossings, the sea ports and the airports with their own customs office.
// An interior customs office in a city (Puebla, Aguascalientes) clears goods that still have to leave
// the country by a border or a port: it isn't an exit.
const esSalida = (tipo, sitio) => !!sitio && (tipo !== 'interior' || sitio.startsWith('aeropuerto:'));
const aduanas = A.map(([nombre, tipo, sitio, recaudacion, valor]) => ({
  id: slug(nombre),
  nombre,
  tipo,
  sitio,
  salida: esSalida(tipo, sitio),
  recaudacion2025: recaudacion,
  valorOperaciones2025: valor,
}));
// Topolobampo has no customs office of its own in the ANAM's tables, but rail exports leave by it.
const salidas = [...new Set([...aduanas.filter((a) => a.salida).map((a) => a.sitio), ...Object.keys(porSalida2025)])];

const ANAM = { fuente: 'ANAM, Informe mensual de diciembre de 2025 (enero a diciembre; cuadros 3 a 5 y 12 a 14)', url: 'https://www.anam.gob.mx/wp-content/uploads/IM_12_2025-.pdf' };
fs.writeFileSync(
  ROOT + '/src/lib/domain/datos/aduanas.json',
  JSON.stringify(
    {
      corte: '2026-11-20',
      nota: 'Las aduanas del país con su recaudación y el valor de sus operaciones (importación y exportación juntas) en 2025, en millones de pesos. Las que tienen sitio en el tablero lo dicen; las de cruces fronterizos, puertos y aeropuertos son salidas de las exportaciones.',
      fuente: ANAM,
      creacion: { fuente: 'DOF, 14 de julio de 2021: decreto por el que se crea la Agencia Nacional de Aduanas de México (opera desde el 1 de enero de 2022)', url: 'https://www.dof.gob.mx/nota_detalle.php?codigo=5623945&fecha=14/07/2021' },
      aduanas,
      salidas,
    },
    null,
    1
  ) + '\n'
);

fs.writeFileSync(
  ROOT + '/src/lib/domain/datos/exportaciones.json',
  JSON.stringify(
    {
      corte: '2026-11-20',
      nota: 'De dónde salen las exportaciones del juego: el valor que exporta cada estado (INEGI) y las toneladas que salen del país por tren cada año (ATTRAPI). Un estado genera carga de exportación al ritmo de su parte del valor del país por las toneladas que salen por tren: es una estimación del juego.',
      fuentes: {
        inegi: { fuente: 'INEGI, Exportaciones por Entidad Federativa (datos abiertos, valor FOB por estado y subsector, 2007–2025)', url: 'https://www.inegi.org.mx/programas/exporta_ef/', dato: `2025 son cifras ${estatus[2025].toLowerCase()}` },
        attrapi: { fuente: 'ATTRAPI, Anuario Estadístico Ferroviario 2025, tablas A10, A11 y A13 (carga de exportación por fronteras y puertos)', url: 'https://www.gob.mx/cms/uploads/attachment/file/1100990/Anuario_2025.pdf' },
        cargaPorTren: { fuente: 'ARTF, Sistema Nacional de Indicadores Ferroviarios 2022: carga neta promedio por tren del sistema en 2018', url: 'https://www.gob.mx/cms/uploads/attachment/file/789599/SNIF_2022.pdf' },
        nacional: { fuente: 'ATTRAPI, Anuario Estadístico Ferroviario 2025, tabla A9 (tráfico interior); INEGI, PIB por Entidad Federativa, valor agregado de las actividades primarias y secundarias, menos la extracción de petróleo, a precios de 2018 (2023 preliminar)', url: 'https://www.inegi.org.mx/programas/pibent/2018/', dato: 'Un estado genera carga nacional a su parte del valor agregado del campo y la industria del país por las toneladas de tráfico interior de ese año: estimación del juego.' },
      },
      cargaPorTren: 2436,
      /** Million pesos of 2018, primary plus secondary activities, by year and state. */
      productivo,
      porEstado,
      totalPais,
      ferrocarril,
      porSalida2025,
    },
    null,
    1
  ) + '\n'
);
console.log('estados', Object.keys(porEstado[2025]).length, '| total 2025', totalPais[2025], '| 2018', totalPais[2018]);
console.log('aduanas', aduanas.length, 'con sitio', aduanas.filter((a) => a.sitio).length, '| salidas', salidas.length, salidas.join(' '));
