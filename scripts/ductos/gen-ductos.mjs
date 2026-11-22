// Builds the pipelines of the board: gas, petroleum products and crude.
//
//   node scripts/ductos/gen-ductos.mjs <carpeta con las capas>
//
// The folder holds the layers downloaded once (see docs/enciclopedia.md, «Los ductos»):
//   cg-integ.geojson      CNH, ductos integrados al SISTRANGAS (2019), copia en el GeoNode de CentroGeo
//   cg-no-integ.geojson   CNH, ductos no integrados al SISTRANGAS (2019), idem
//   cg-import.geojson     CNH, ductos de importación del lado de EUA (2019), idem
//   cnh2018-todo.json     CNH, capa de 2018 (Esri JSON) con los poliductos de Pemex del centro y el golfo
//   poliductos.geojson    CNH, poliductos de Chihuahua (copia de la app de Energía Regional)
//   osm-geom.json         OpenStreetMap (Overpass), para el oleoducto Nuevo Teapa–Salina Cruz
//
// The poliductos the CNH layers lack are written here as data (SENER_2018), from the tables of SENER's
// 2018 map of petroleum infrastructure.
//
// Writes src/lib/domain/datos/ductos.json (lines, works, the peninsula's gas)
// and src/lib/domain/datos/ductos-real.json (what really happened with each
// pipeline that came, or is coming, after 2018), with every figure's source.

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { geoContains } from 'd3-geo';
import { feature, merge } from 'topojson-client';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIR = process.argv[2];
if (!DIR) throw new Error('Uso: node scripts/ductos/gen-ductos.mjs <carpeta con las capas>');
const leer = async (f) => JSON.parse(await readFile(join(DIR, f), 'utf8'));

// ---- geometry helpers ----------------------------------------------------------------------

const R = 6371;
const rad = (d) => (d * Math.PI) / 180;
function kmLinea(c) {
  let s = 0;
  for (let i = 1; i < c.length; i++) {
    const [lo1, la1] = c[i - 1];
    const [lo2, la2] = c[i];
    const h = Math.sin(rad(la2 - la1) / 2) ** 2 + Math.cos(rad(la1)) * Math.cos(rad(la2)) * Math.sin(rad(lo2 - lo1) / 2) ** 2;
    s += 2 * R * Math.asin(Math.sqrt(h));
  }
  return s;
}
/** Douglas–Peucker in degrees: enough to keep a pipeline's shape on the whole-country board. */
function simplificar(pts, tol = 0.006) {
  if (pts.length < 3) return pts;
  const dist = (p, a, b) => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = dx * dx + dy * dy;
    const t = l ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l)) : 0;
    return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
  };
  let max = 0;
  let idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = dist(pts[i], pts[0], pts[pts.length - 1]);
    if (d > max) (max = d), (idx = i);
  }
  if (max <= tol) return [pts[0], pts[pts.length - 1]];
  return [...simplificar(pts.slice(0, idx + 1), tol).slice(0, -1), ...simplificar(pts.slice(idx), tol)];
}
const redondear = (p) => [Math.round(p[0] * 1000) / 1000, Math.round(p[1] * 1000) / 1000];
const limpiar = (lineas) =>
  lineas
    .filter((l) => l.length >= 2 && kmLinea(l) > 0.2)
    .map((l) => simplificar(l).map(redondear));
const lineasDe = (g) => (!g ? [] : g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : []);

// ---- names -----------------------------------------------------------------------------------

const ACENTOS = {
  JUAREZ: 'Ciudad Juárez',
  CHIHUAUA: 'Chihuahua',
  SANN: 'San',
  POTOSI: 'Potosí',
  MINATITLAN: 'Minatitlán',
  LAZARO: 'Lázaro',
  CARDENAS: 'Cárdenas',
  MAZATLAN: 'Mazatlán',
  SASABE: 'Sásabe',
  CANCUN: 'Cancún',
  JALTIPAN: 'Jáltipan',
  PENJAMO: 'Pénjamo',
  ACAPULCO: 'Acapulco',
  MEXICO: 'México',
  CARMEN: 'Carmen',
  ALEMAN: 'Alemán',
  SECCION: 'Sección',
};
const MINUSCULAS = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'a', 'y']);
const SIGLAS = new Set(['CT', 'CPI', 'TAR', 'CAB', 'ASA', 'CFE', 'GNL']);
function bonito(s) {
  const palabras = s.trim().replace(/\s*-\s*/g, ' – ').split(/\s+/);
  const t = palabras
    .map((w, i) => {
      if (w === '–') return w;
      const u = w.toUpperCase();
      if (ACENTOS[u]) return ACENTOS[u];
      if (SIGLAS.has(u)) return u;
      const l = w.toLowerCase();
      // Lower-case particles inside a place's name, never at the start of one end of the line.
      if (i > 0 && palabras[i - 1] !== '–' && MINUSCULAS.has(l)) return l;
      return l.charAt(0).toUpperCase() + l.slice(1);
    })
    .join(' ')
    .replace(/ – /g, '–');
  return t.replace(/^A–\s*/, 'Ramal a ').replace(/^A /, 'Ramal a ').replace(/^De /, 'Ramal de ').replace(/^Ampliacion /, 'Ampliación ');
}
/** Pemex's names come in mixed case with hyphens: en dashes between the ends, accents where they're missing. */
const bonitoPemex = (s) =>
  s
    .trim()
    .replace(/Combustóleo-ducto/g, 'Combustoleoducto')
    .replace(/Turbosino-ducto/g, 'Turbosinoducto')
    .replace(/(\S)-(\S)/g, '$1–$2')
    .replace(/Refineria/g, 'Refinería');
/** The SISTRANGAS systems by the name SENER gives them (Plan de Desarrollo del Sector Eléctrico, tabla 2.5). */
const SISTEMAS = {
  'Camargo–Los Ramones': 'Los Ramones Fase I (Camargo–Los Ramones)',
  'Los Ramones–San Luis Potosí': 'Los Ramones Fase II Norte (Los Ramones–San Luis Potosí)',
  'San Luis Potosí–Apaseo el Alto': 'Los Ramones Fase II Sur (San Luis Potosí–Apaseo el Alto)',
  'Nativitas–Huexca': 'Gasoducto Morelos (Nativitas–Huexca)',
  'Reynosa–San Fernando': 'Gasoductos de Tamaulipas (Reynosa–San Fernando)',
  'G/045/TRA/1998': 'Gasoducto del Bajío (Aguascalientes–Valtierrilla)',
};
const slug = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

// ---- sources ---------------------------------------------------------------------------------

const FUENTES = {
  'cnh-2019': {
    fuente: 'CNH, capas «Ductos integrados al SISTRANGAS», «Ductos no integrados al SISTRANGAS» y «Ductos de importación» (2019), con información de SENER, CENAGAS, permisos de la CRE y licitaciones de la CFE; copia en el GeoNode de CentroGeo. Trazo aproximado.',
    url: 'https://idegeo.centrogeo.org.mx/geoserver/ows?service=wfs&version=1.0.0&request=GetCapabilities',
  },
  'cnh-2018': {
    fuente: 'CNH, capa de ductos con fecha de referencia 14 de febrero de 2018: los poliductos de Pemex del centro, el noreste y el sur-sureste. Trazo aproximado.',
    url: 'https://agsserver.sigsa.info/arcgis/rest/services/Monitoreo_de_flujo_en_tiempo_real_MIL1/MapServer/4',
  },
  'cnh-chih': {
    fuente: 'CNH, capa «Ductos Petrolíferos» (con información de SENER y CRE), en su copia para Chihuahua: poliductos y su capacidad en barriles diarios. Trazo aproximado.',
    url: 'https://services6.arcgis.com/th3TMn162i37A876/ArcGIS/rest/services/AppMote/FeatureServer/14',
  },
  osm: { fuente: 'OpenStreetMap, oleoducto Nuevo Teapa–Salina Cruz (consultado el 22 de noviembre de 2026)', url: 'https://www.openstreetmap.org/' },
  'sener-mapa-2018': {
    fuente:
      'SENER, mapa «Infraestructura Nacional de Petrolíferos, 2018» (31 de octubre de 2018), tablas de ductos de cada región: origen y destino, diámetro, km y capacidad nominal. El trazo lo dibuja el juego uniendo las terminales que dice el mapa. Copia del Internet Archive',
    url: 'http://web.archive.org/web/20220326183525/https://www.gob.mx/cms/uploads/attachment/file/416897/Mapa_log_stica_Sener_8_Reg_31-10-2018_Nueva_numeraci_n_VF.pdf',
  },
  'cfe-pn2021': {
    fuente: 'CFE, Plan de Negocios 2021–2025: red de gasoductos de la CFE con capacidad y longitud; los que entraron en 2018 y 2019 y los detenidos',
    url: 'https://www.cfe.gob.mx/finanzas/Documents/Plan%20de%20Negocios%20CFE%202021.pdf',
  },
  'cfe-ia2024-gas': {
    fuente: 'CFE, Informe Anual 2024: el gasoducto Extensión al Sureste (Puerta al Sureste) terminado, la fase I del Cuxtal II y la aportación de la CFE a la alianza con TC Energy',
    url: 'https://www.cfe.gob.mx/finanzas/reportes-financieros/Reportes%20Anuales%20Documentos/Informe%20Anual%202024.pdf',
  },
  'cfe-pd2026-gas': {
    fuente: 'CFE, Programa de Desarrollo 2026–2030, tabla 2: gasoductos en desarrollo; Puerta al Sureste en operación desde mayo de 2025',
    url: 'https://www.cfe.gob.mx/finanzas/Documents/ProgramaDesarrollo-26.pdf',
  },
  'sener-ph2026': {
    fuente: 'SENER, Plan de Desarrollo del Sector Hidrocarburos (4 de agosto de 2026): la red de 2024, los proyectos de la CFE (Cuxtal II al 43.8 %, Centauro del Norte al 7.12 %) y del CENAGAS',
    url: 'https://dof.gob.mx/nota_detalle_popup.php?codigo=5798065',
  },
  'sener-pe2025': {
    fuente: 'SENER, Plan de Desarrollo del Sector Eléctrico 2025–2039 (DOF, 14 de octubre de 2025): los sistemas del SISTRANGAS y lo que se le conectó desde 2019',
    url: 'https://dof.gob.mx/nota_detalle_popup.php?codigo=5770297',
  },
  'pm-0770': { fuente: 'Proyectos México, ficha 0770 «CFE: Gasoducto Sur de Texas–Tuxpan (Marino)»: inicio de operación el 17 de septiembre de 2019', url: 'https://www.proyectosmexico.gob.mx/proyecto_inversion/770-cfe-gasoducto-sur-de-texas-tuxpan-marino/' },
  'pm-0771': { fuente: 'Proyectos México, ficha 0771 «CFE: Gasoducto La Laguna–Aguascalientes»: inicio de operación el 22 de junio de 2019', url: 'https://www.proyectosmexico.gob.mx/proyecto_inversion/771-cfe-gasoducto-la-laguna-aguascalientes/' },
  'pm-0767': { fuente: 'Proyectos México, ficha 0767 «CFE: Gasoducto Samalayuca–Sásabe»: inicio de operación en febrero de 2021', url: 'https://www.proyectosmexico.gob.mx/proyecto_inversion/767-cfe-gasoducto-samalayuca-sasabe/' },
  'jornada-vag-2020': {
    fuente: 'La Jornada, «Opera gasoducto que provocó una controversia entre CFE y privados» (3 de octubre de 2020): el Villa de Reyes–Aguascalientes–Guadalajara entró en operación el 1 de octubre, según la CFE y Fermaca',
    url: 'https://www.jornada.com.mx/2020/10/03/economia/018n1eco',
  },
  'eia-heat': { fuente: 'EIA (gobierno de EUA), Electric Power Annual, tabla 8.2: régimen térmico promedio de los ciclos combinados de gas, 7,627 Btu/kWh en 2018, a plena carga', url: 'https://www.eia.gov/electricity/annual/html/epa_08_02.html' },
  'eia-btu': { fuente: 'EIA, «How much natural gas…»: 1,037 Btu por pie cúbico de gas natural (2025)', url: 'https://www.eia.gov/tools/faqs/faq.php?id=45&t=8' },
  'pm-pemex-2026': {
    fuente: 'Proyectos México, ciclo de inversión en hidrocarburos (junio de 2026): 73 terminales de almacenamiento, 5,777 km de oleoductos y 8,926 km de poliductos de Pemex',
    url: 'https://www.proyectosmexico.gob.mx/como-invertir-en-mexico/ciclo-inversion/ciclos-hidrocarburos/',
  },
  'pmx-ia2023-ductos': {
    fuente: 'Pemex, Informe Anual 2023: por ducto se movieron 2,082 Mbd; en buque tanque, 166 Mbd',
    url: 'https://gaceta.diputados.gob.mx/PDF/65/2024/may/Pemex-20240514.pdf',
  },
  juego: { fuente: 'Trazo aproximado del juego, por los puntos que dicen las fuentes oficiales', url: '' },
};

// ---- the pipelines that came, or are coming, after December 2018 (real record ids = pipeline ids) ----

/** CNH name → our id, the CFE's official figures (Plan de Negocios 2021, tabla 8.1) and its story. */
const CURADO = {
  'MATAMOROS - TUXPAN': {
    id: 'sur-de-texas-tuxpan',
    nombre: 'Sur de Texas–Tuxpan (marino)',
    operador: 'Infraestructura Marina del Golfo (IEnova y TC Energía), contratado por la CFE',
    km: 800,
    capacidad: 2600,
    real: { enObraAl: '2018-12-01', operacion: '2019-09-17', nota: 'Terminado a mediados de 2019, entró en operación tras un acuerdo de tarifas con la CFE. Es el primer gasoducto submarino de gran escala de México.', fuentes: ['pm-0770', 'cfe-pn2021', 'sener-pe2025'] },
  },
  'LA LAGUNA - AGUASCALIENTES': {
    id: 'la-laguna-aguascalientes',
    nombre: 'La Laguna–Aguascalientes',
    operador: 'Fermaca, contratado por la CFE',
    km: 452,
    capacidad: 1189,
    real: { enObraAl: '2018-12-01', operacion: '2019-06-22', fuentes: ['pm-0771', 'cfe-pn2021'] },
  },
  'VILLA DE REYES - GUADALAJARA': {
    id: 'villa-de-reyes-guadalajara',
    nombre: 'Villa de Reyes–Aguascalientes–Guadalajara',
    operador: 'Fermaca, contratado por la CFE',
    km: 374,
    capacidad: 886,
    real: { enObraAl: '2018-12-01', operacion: '2020-10-01', nota: 'Con él se completó el sistema Wahalajara, que trae gas de Waha, en Texas, al occidente.', fuentes: ['jornada-vag-2020', 'cfe-pn2021'] },
  },
  'SAMALAYUCA - SASABE': {
    id: 'samalayuca-sasabe',
    nombre: 'Samalayuca–Sásabe',
    operador: 'Carso Gasoducto Norte, contratado por la CFE',
    km: 614,
    capacidad: 472,
    real: { enObraAl: '2018-12-01', operacion: '2021-02', fuentes: ['pm-0767', 'cfe-pn2021'] },
  },
  'TUXPAN - TULA': {
    id: 'tuxpan-tula',
    nombre: 'Tuxpan–Tula',
    operador: 'TC Energía, contratado por la CFE',
    km: 276,
    capacidad: 886,
    real: {
      enObraAl: '2018-12-01',
      situacion: 'Sin terminar: le falta el tramo por Puebla e Hidalgo. La CFE busca una ruta alterna (276 km, en planeación) que no afecte a las comunidades.',
      fuentes: ['cfe-pn2021', 'cfe-pd2026-gas', 'sener-ph2026'],
    },
  },
  'TULA - VILLA DE REYES': {
    id: 'tula-villa-de-reyes',
    nombre: 'Tula–Villa de Reyes',
    operador: 'TC Energía, contratado por la CFE',
    km: 438,
    capacidad: 886,
    real: {
      enObraAl: '2018-12-01',
      situacion: 'Sin terminar. El Arco Tula (17.5 km) se espera en 2027 y el tramo sur está en evaluación.',
      fuentes: ['cfe-pn2021', 'cfe-pd2026-gas', 'sener-ph2026'],
    },
  },
  'GUAYMAS - EL ORO': {
    id: 'guaymas-el-oro',
    nombre: 'Guaymas–El Oro',
    operador: 'IEnova, contratado por la CFE',
    km: 331,
    capacidad: 510,
    fuera: {
      desde: '2017',
      texto: 'Fuera de operación desde 2017 por el conflicto con la comunidad yaqui de Loma de Bácum. La CFE planea rodearla con un nuevo trazo de 70 a 90 km, para 2029.',
      fuentes: ['cfe-pn2021', 'cfe-pd2026-gas'],
    },
  },
  'CIUDAD PEMEX -  VALLADOLID': { id: 'mayakan', nombre: 'Mayakan (Ciudad Pemex–Valladolid)', operador: 'Energía Mayakan, contratado por la CFE', km: 695, capacidad: 240 },
  'EL ENCINO - LA LAGUNA': { id: 'el-encino-la-laguna', nombre: 'El Encino–La Laguna', operador: 'Fermaca, contratado por la CFE', km: 420, capacidad: 1500, nota2018: 'Entró en 2018.' },
  'EL ENCINO - TOPOLOBAMPO': { id: 'el-encino-topolobampo', nombre: 'El Encino–Topolobampo', operador: 'TC Energía, contratado por la CFE', km: 551, capacidad: 670, nota2018: 'Entró en 2018.' },
};

/** Pipelines after 2019 the CNH layers don't have: drawn by the game through the places the sources name. */
const NUEVOS = [
  {
    id: 'puerta-al-sureste',
    nombre: 'Puerta al Sureste (Tuxpan–Coatzacoalcos–Paraíso, marino)',
    operador: 'TC Energía en alianza con la CFE (13 % de las acciones)',
    km: 707,
    capacidad: 1348,
    // Offshore, ~25 km off the Gulf coast: checked against the board's land below.
    trazo: [
      [-97.3, 20.99],
      [-97.05, 21.05],
      [-96.78, 20.62],
      [-96.45, 20.2],
      [-96.1, 19.78],
      [-95.85, 19.36],
      [-95.5, 19.1],
      [-95.05, 18.9],
      [-94.65, 18.62],
      [-94.42, 18.15],
      [-94.2, 18.33],
      [-93.8, 18.42],
      [-93.45, 18.5],
      [-93.19, 18.42],
    ],
    marino: [1, 12],
    real: {
      anuncio: '2022',
      enObraAl: '2024-12-31',
      operacion: '2025-05',
      nota: 'La CFE aportó 340 millones de dólares y 71 en especie, el 13.01 % de la alianza. Faltan sus ramales a Cosoleacaque (2027) y a Paraíso, que lo unirán con el sistema nacional y con el Mayakan.',
      fuentes: ['cfe-ia2024-gas', 'cfe-pd2026-gas', 'sener-ph2026'],
    },
  },
  {
    id: 'centauro-del-norte',
    nombre: 'Centauro del Norte (Sásabe–San Luis Río Colorado–Mexicali)',
    operador: 'Carso Energy en alianza con la CFE',
    km: 442,
    capacidad: 400,
    // Along the places the CFE names: Sásabe, Caborca, San Luis Río Colorado, Mexicali.
    trazo: [
      [-111.54, 31.48],
      [-111.83, 30.71],
      [-112.16, 30.72],
      [-112.86, 31.86],
      [-113.53, 31.95],
      [-114.77, 32.46],
      [-115.45, 32.63],
    ],
    real: {
      anuncio: '2023',
      avances: [{ fecha: '2026-08-04', pct: 7.12 }],
      prevista: 'la fase I (Mexicali–San Luis Río Colorado) en 2026 y la II (Sásabe–San Luis Río Colorado) en 2028',
      nota: 'Lleva gas de Sonora a Baja California «a precios competitivos» y asegura el de los ciclos combinados González Ortega y San Luis Río Colorado.',
      fuentes: ['cfe-ia2024-gas', 'cfe-pd2026-gas', 'sener-ph2026'],
    },
  },
];

// ---- build -------------------------------------------------------------------------------

const integ = await leer('cg-integ.geojson');
const noInteg = await leer('cg-no-integ.geojson');
const importacion = await leer('cg-import.geojson');
const cnh2018 = await leer('cnh2018-todo.json');
const chih = await leer('poliductos.geojson');
const osm = await leer('osm-geom.json');

const ductos = [];
const usados = new Map();
const idUnico = (base) => {
  const n = (usados.get(base) ?? 0) + 1;
  usados.set(base, n);
  return n === 1 ? base : `${base}-${n}`;
};
const real = {};

// The SISTRANGAS: the State's network (CENAGAS) and the private pipelines integrated to it.
for (const f of integ.features) {
  const p = f.properties;
  const sng = /CENAGAS/.test(p.tipo ?? '');
  const base = p.tramo ? bonito(p.tramo) : p.proyecto ? bonito(p.proyecto) : 'Gasoducto privado integrado';
  const nombre = sng ? base : (SISTEMAS[base] ?? SISTEMAS[p.permiso_cr?.trim()] ?? base);
  ductos.push({
    id: idUnico(`${sng ? 'sng' : 'sistrangas'}-${slug(nombre)}`),
    nombre,
    tipo: 'gas',
    red: sng ? 'sng' : 'sistrangas',
    operador: sng ? 'CENAGAS (Sistema Nacional de Gasoductos)' : 'Privado, integrado al SISTRANGAS',
    km: p.longitud_k ? Math.round(p.longitud_k) : null,
    permiso: p.permiso_cr?.trim() || null,
    fuente: 'cnh-2019',
    trazo: limpiar(lineasDe(f.geometry)),
  });
}

// Private pipelines outside it, and the ones under construction in 2019. Projects never built are left out.
for (const f of noInteg.features) {
  const p = f.properties;
  if (/Proyecto/.test(p.tipo ?? '')) continue;
  const c = CURADO[p.nombre];
  const nombre = c?.nombre ?? bonito(p.nombre) + (p.tramo && /ROSARITO/.test(p.nombre) ? ` (${p.tramo.trim().replace(/\s*-\s*/g, '–')})` : '');
  const id = c ? c.id : idUnico(`privado-${slug(nombre)}`);
  ductos.push({
    id,
    nombre,
    tipo: 'gas',
    red: 'privado',
    operador: c?.operador ?? (p.desarrolla ? `${p.desarrolla}${p.promotor === 'CFE' ? ', contratado por la CFE' : ''}` : 'Privado'),
    km: c?.km ?? (p.longitud_k ? Math.round(p.longitud_k) : null),
    capacidad: c?.capacidad ?? (p.capacidad_ || null),
    permiso: p.permiso_cr?.trim() || null,
    ...(c?.real ? { real: true } : {}),
    ...(c?.fuera ? { fuera: { desde: c.fuera.desde, texto: c.fuera.texto, fuentes: c.fuera.fuentes } } : {}),
    ...(c?.nota2018 ? { nota: c.nota2018 } : {}),
    fuente: 'cnh-2019',
    trazo: limpiar(lineasDe(f.geometry)),
  });
  if (c?.real) real[c.id] = c.real;
}

// The import pipelines on the US side.
for (const f of importacion.features) {
  const p = f.properties;
  ductos.push({
    id: idUnico(`importacion-${slug(p.nombre)}`),
    nombre: p.nombre.trim(),
    tipo: 'gas',
    red: 'importacion',
    operador: p.permisiona?.trim() || p.nombre.trim(),
    km: Math.round(kmLinea(lineasDe(f.geometry).flat())) || null,
    fuente: 'cnh-2019',
    trazo: limpiar(lineasDe(f.geometry)),
  });
}

// Pemex's product pipelines: centre, north-east and south-east (CNH 2018), Chihuahua (CNH).
for (const f of cnh2018.features) {
  const a = f.attributes;
  if (a.Tipo_ducto !== 'Petróleo' || !f.geometry?.paths) continue;
  const trazo = limpiar(f.geometry.paths);
  if (!trazo.length) continue;
  ductos.push({
    id: idUnico(`pemex-${slug(a.nombre)}`),
    nombre: bonitoPemex(a.nombre),
    tipo: 'petroliferos',
    red: 'pemex',
    operador: 'Pemex Logística',
    km: a.longitud_k ? Math.round(a.longitud_k) : null,
    fuente: 'cnh-2018',
    trazo,
  });
}
for (const f of chih.features) {
  const p = f.properties;
  ductos.push({
    id: idUnico(`pemex-${slug(p.ducto)}`),
    nombre: bonitoPemex(p.ducto),
    tipo: 'petroliferos',
    red: 'pemex',
    operador: 'Pemex Logística',
    km: p.longitud ? Math.round(p.longitud) : null,
    capacidad: p.capacidad_ || null,
    fuente: 'cnh-chih',
    trazo: limpiar(lineasDe(f.geometry)),
  });
}

// Crude: the Nuevo Teapa–Salina Cruz line (its 48-inch ways), from OpenStreetMap.
const teapa = osm.elements.filter((e) => e.tags?.name === 'Nuevo Teapa-Salina Cruz Oil Pipeline' && e.tags?.diameter === '48"' && e.geometry);
ductos.push({
  id: 'pemex-nuevo-teapa-salina-cruz',
  nombre: 'Oleoducto Nuevo Teapa–Salina Cruz',
  tipo: 'crudo',
  red: 'pemex',
  operador: 'Pemex Logística',
  km: Math.round(teapa.reduce((s, e) => s + kmLinea(e.geometry.map((g) => [g.lon, g.lat])), 0)),
  fuente: 'osm',
  trazo: limpiar(teapa.map((e) => e.geometry.map((g) => [g.lon, g.lat]))),
});

// Petroleum products the CNH's layers don't carry: the northwest, the northeast beyond Madero–Cadereyta,
// the west out of Salamanca, Minatitlán's lines to the isthmus, Pajaritos and Tabasco, and Progreso–Mérida.
// Their length, diameter and capacity are SENER's 2018 map's; the game draws them through the terminals
// they join and the towns between (the terminals' points are the CNH's). The map's own lines inside the
// Salina Cruz refinery (up to 12.5 km) and the ramales under 2 km are left out.
// [id, nombre, km, capacidad nominal (mbd), puntos]
const AGUASCALIENTES = [-102.2234, 21.7576];
const SANTA_CATARINA = [-100.4856, 25.7048];
const SALAMANCA = [-101.17848, 20.57981];
const MINATITLAN = [-94.52695, 17.97986];
const OJO_CALIENTE = [-101.05, 25.67];
const CASTANITO = [-93.45, 17.98];
const DEGOLLADO = [-102.155, 20.465];
const A_GOMEZ_PALACIO = [SANTA_CATARINA, [-100.75, 25.62], OJO_CALIENTE, [-101.6, 25.62], [-102.2, 25.62], [-102.8, 25.6], [-103.4682, 25.5629]];
const A_PAJARITOS = [MINATITLAN, [-94.47, 18.05], [-94.39, 18.11]];
const A_MERIDA = [[-89.6612, 21.2499], [-89.67, 21.1], [-89.6931, 20.9241]];
const SENER_2018 = [
  ['pemex-rosarito-mexicali', 'Poliducto Rosarito–Mexicali', 148.4, 31, [[-117.07, 32.3749], [-116.92, 32.47], [-116.63, 32.56], [-116.1, 32.58], [-115.6715, 32.5806]]],
  ['pemex-rosarito-ensenada', 'Poliducto Rosarito–Ensenada', 74.8, 20, [[-117.07, 32.3749], [-116.98, 32.2], [-116.8, 31.99], [-116.6825, 31.882]]],
  ['pemex-guaymas-hermosillo', 'Poliducto Guaymas–Hermosillo', 129, 31, [[-110.8658, 27.9305], [-110.82, 28.1], [-110.9, 28.55], [-110.9036, 29.0245]]],
  ['pemex-guaymas-ciudad-obregon', 'Poliducto Guaymas–Ciudad Obregón', 120.3, 24, [[-110.8658, 27.9305], [-110.7, 27.88], [-110.3, 27.68], [-109.9256, 27.5457]]],
  ['pemex-topolobampo-culiacan', 'Poliducto Topolobampo–Culiacán, con el ramal a Guamúchil', 222.3, 34, [[-109.0467, 25.6154], [-108.95, 25.7], [-108.47, 25.57], [-108.111, 25.4715], [-107.75, 25.1], [-107.4333, 24.7728]]],
  ['pemex-cadereyta-santa-catarina', 'Poliducto Cadereyta–Santa Catarina', 83.6, 148, [[-99.94148, 25.5856], [-100.15, 25.66], [-100.31, 25.67], SANTA_CATARINA]],
  ['pemex-cadereyta-reynosa-brownsville', 'Bidireccional Cadereyta–Reynosa–Brownsville', 270.9, 55, [[-99.94148, 25.5856], [-99.55, 25.72], [-99.18, 25.8], [-98.7, 25.98], [-98.2786, 26.0754], [-97.9, 25.98], [-97.5, 25.9]]],
  ['pemex-santa-catarina-gomez-palacio-10', 'Poliducto Santa Catarina–Gómez Palacio (10 pulgadas)', 321.3, 32, A_GOMEZ_PALACIO],
  ['pemex-santa-catarina-gomez-palacio-14', 'Poliducto Santa Catarina–Gómez Palacio (14 pulgadas)', 319.6, 58, A_GOMEZ_PALACIO],
  ['pemex-ojo-caliente-saltillo', 'Ramal Ojo Caliente–Saltillo', 24.9, 26, [OJO_CALIENTE, [-100.9714, 25.4892]]],
  ['pemex-santa-catarina-monclova-sabinas', 'Poliducto Santa Catarina–Monclova–Sabinas', 323.6, 20, [SANTA_CATARINA, [-100.55, 25.95], [-100.95, 26.45], [-101.43, 26.79], [-101.4258, 26.9581], [-101.3, 27.4], [-101.1343, 27.832]]],
  ['pemex-minatitlan-salina-cruz', 'Bidireccional Minatitlán–Salina Cruz', 249.4, 73, [MINATITLAN, [-94.72, 17.95], [-94.92, 17.9], [-95.0, 17.55], [-95.03, 17.1], [-95.04, 16.88], [-95.1, 16.56], [-95.12, 16.38], [-95.17692, 16.20647]]],
  ['pemex-minatitlan-pajaritos-combustoleo', 'Combustoleoducto Refinería Minatitlán–Pajaritos', 33, 72, A_PAJARITOS],
  ['pemex-minatitlan-pajaritos-bidireccional', 'Bidireccional Minatitlán–Pajaritos', 24.4, 41, A_PAJARITOS],
  ['pemex-minatitlan-pajaritos', 'Poliducto Minatitlán–Pajaritos', 27.5, 73, A_PAJARITOS],
  ['pemex-minatitlan-villahermosa', 'Poliducto Minatitlán–Villahermosa', 174.2, 55, [MINATITLAN, [-94.2, 18.05], [-93.8, 18.05], CASTANITO, [-93.2, 17.98], [-92.9953, 17.9977]]],
  ['pemex-castanito-dos-bocas', 'Ramal Castañito–Dos Bocas', 59.6, 55, [CASTANITO, [-93.3, 18.2], [-93.19561, 18.4228]]],
  ['pemex-salamanca-morelia', 'Poliducto Salamanca–Morelia', 90.7, 28, [SALAMANCA, [-101.2, 20.3], [-101.15, 19.98], [-101.1475, 19.8442]]],
  ['pemex-salamanca-irapuato', 'Ductos Salamanca–Irapuato (cinco, uno por producto: magna, premium, turbosina, diésel y combustóleo)', 19, 159, [SALAMANCA, [-101.2977, 20.6372]]],
  ['pemex-salamanca-leon', 'Poliducto Salamanca–León', 94.3, 24, [SALAMANCA, [-101.2977, 20.6372], [-101.43, 20.94], [-101.7126, 21.0991]]],
  ['pemex-salamanca-aguascalientes-zacatecas', 'Poliducto Salamanca–Aguascalientes–Zacatecas', 319.9, 28, [SALAMANCA, [-101.29, 20.66], [-101.44, 20.95], [-101.7, 21.11], [-101.93, 21.36], AGUASCALIENTES, [-102.33, 22.2], [-102.4378, 22.7497]]],
  ['pemex-salamanca-guadalajara', 'Poliducto Salamanca–Guadalajara', 345, 85, [SALAMANCA, [-101.5, 20.45], [-101.85, 20.43], DEGOLLADO, [-102.55, 20.3], [-102.77, 20.35], [-103.2266, 20.5055]]],
  ['pemex-degollado-zamora', 'Ramal Degollado–Zamora', 44.5, 26, [DEGOLLADO, [-102.2691, 20.0876]]],
  ['pemex-progreso-merida-10', 'Poliducto Progreso–Mérida (10 pulgadas)', 37.1, 36, A_MERIDA],
  ['pemex-progreso-merida-8', 'Poliducto Progreso–Mérida (8 pulgadas)', 37.2, 22, A_MERIDA],
];
for (const [id, nombre, km, mbd, puntos] of SENER_2018) {
  ductos.push({ id, nombre, tipo: 'petroliferos', red: 'pemex', operador: 'Pemex Logística', km, capacidad: mbd * 1000, aproximado: true, fuente: 'sener-mapa-2018', trazo: [puntos] });
}

// After 2019: drawn by the game. Check the sea legs of Puerta al Sureste don't touch land.
const topo = JSON.parse(await readFile(join(ROOT, 'static', 'data', 'mexico.topo.json'), 'utf8'));
const tierra = merge(topo, [...topo.objects.estados.geometries, ...topo.objects.vecinos.geometries]);
for (const n of NUEVOS) {
  if (n.marino) {
    // Landfalls (delivery points) are on land on purpose: only the stretches between them must be at sea.
    const [i0, i1] = n.marino;
    const enTierra = n.trazo.filter((p) => geoContains(tierra, p));
    const cercaDeLlegada = (p) => enTierra.some((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.12);
    for (let i = i0; i < i1; i++) {
      for (let t = 0; t <= 1; t += 0.05) {
        const p = [n.trazo[i][0] + (n.trazo[i + 1][0] - n.trazo[i][0]) * t, n.trazo[i][1] + (n.trazo[i + 1][1] - n.trazo[i][1]) * t];
        if (geoContains(tierra, p) && !cercaDeLlegada(p)) console.warn(`⚠ ${n.id}: el tramo ${i}→${i + 1} toca tierra en ${p.map((v) => v.toFixed(3)).join(', ')}`);
      }
    }
  }
  ductos.push({ id: n.id, nombre: n.nombre, tipo: 'gas', red: 'privado', operador: n.operador, km: n.km, capacidad: n.capacidad, real: true, aproximado: true, fuente: 'juego', trazo: [n.trazo] });
  real[n.id] = n.real;
}

// ---- the peninsula's gas and the State's gas work -------------------------------------------------

const BTU_KWH = 7627;
const BTU_PIE = 1037;
const MMPCD_POR_MW = Math.round(((24 * 1000 * BTU_KWH) / BTU_PIE / 1e6) * 10000) / 10000;

const gas = {
  mmpcdPorMW: MMPCD_POR_MW,
  factorDato: `Un ciclo combinado a plena carga quema ${BTU_KWH.toLocaleString('en-US')} Btu por kWh (EIA, 2018) y un pie cúbico de gas da ${BTU_PIE.toLocaleString('en-US')} Btu (EIA): cada MW pide ${MMPCD_POR_MW} millones de pies cúbicos diarios. Es un cálculo del juego con cifras del gobierno de Estados Unidos; la CFE no publica el de sus centrales.`,
  factorFuentes: ['eia-heat', 'eia-btu'],
  regiones: {
    peninsular: {
      capacidad: 240,
      obra: 'cuxtal-ii',
      capacidadConObra: 547,
      ducto: 'mayakan',
      dato: 'A la península el gas solo llega por el Mayakan: 240 millones de pies cúbicos diarios (CFE). El Cuxtal II la lleva a 547, para las centrales nuevas de Mérida y Valladolid y las que ya había (CFE, Programa de Desarrollo 2026–2030).',
      fuentes: ['cfe-pn2021', 'cfe-pd2026-gas'],
    },
  },
  obras: [
    {
      id: 'cuxtal-ii',
      nombre: 'Gasoducto Cuxtal II (ampliación del Mayakan)',
      region: 'peninsular',
      ducto: 'mayakan',
      km: 695,
      capacidad: 547,
      costoMusd: 1715,
      costo: {
        dato: 'La CFE no publica su costo. Estimación del juego: 695 km a 2.47 millones de dólares por km, el promedio de los siete gasoductos que la CNH registra en construcción en 2018 (8,657 millones de dólares en 3,507 km): unos 1,715 millones.',
        fuente: 'CNH (2019), ductos no integrados al SISTRANGAS',
        url: FUENTES['cnh-2019'].url,
      },
      mesesGobierno: 40,
      tiempo: {
        dato: 'Estimación del juego: la CFE lo formalizó en 2024, su fase I quedó en diciembre de 2024 y el resto se espera en el segundo semestre de 2027; unos 40 meses.',
        fuente: 'CFE, Informe Anual 2024 y Programa de Desarrollo 2026–2030',
        url: FUENTES['cfe-pd2026-gas'].url,
      },
      real: 'La CFE formalizó en 2024 con Energía Mayakan la ampliación del sistema. En diciembre de 2024 terminó su fase I y probó el suministro a los ciclos combinados de Mérida y Riviera Maya; en agosto de 2026 iba en 43.8 % (74.5 km). Duplicará el gas de la península, de 240 a 547 millones de pies cúbicos diarios, en el segundo semestre de 2027.',
    },
  ],
};
real['cuxtal-ii'] = {
  anuncio: '2024',
  enObraAl: '2024-12',
  parcial: { fecha: '2024-12', texto: 'su fase I, que ya da gas a los ciclos combinados de Mérida y Riviera Maya' },
  avances: [{ fecha: '2026-08-04', pct: 43.8 }],
  prevista: 'segundo semestre de 2027',
  fuentes: ['cfe-ia2024-gas', 'cfe-pd2026-gas', 'sener-ph2026'],
};

const totales = {
  gasKm2024: 21149,
  sistrangasKm2024: 9732,
  sngKm2024: 8386,
  privadosIntegradosKm2024: 1346,
  cenagasKm: 8741,
  cenagasMas45Años: 0.94,
  poliductosKm2024: 9582,
  poliductosMbd2024: 4586,
  oleoductosKmPemex: 5777,
  poliductosKmPemex: 8926,
  terminalesPemex: 73,
  porDuctoMbd2023: 2082,
  porBuqueMbd2023: 166,
  dato: 'Red de 2024: 21,149 km de gasoductos, 9,732 del SISTRANGAS (8,386 del Sistema Nacional del Estado y 1,346 privados integrados); el CENAGAS opera 8,741 km y el 94 % tiene más de 45 años. Poliductos y ductos de petrolíferos: 9,582 km con 4,586 Mbd autorizados (SENER). Pemex: 5,777 km de oleoductos, 8,926 de poliductos y 73 terminales (Proyectos México); en 2023 movió 2,082 Mbd por ducto y 166 en buque tanque (Pemex).',
  fuentes: ['sener-ph2026', 'sener-pe2025', 'pm-pemex-2026', 'pmx-ia2023-ductos'],
};

const kmPor = {};
for (const d of ductos) {
  const k = `${d.tipo}/${d.red}`;
  kmPor[k] = (kmPor[k] ?? 0) + d.trazo.reduce((s, l) => s + kmLinea(l), 0);
}
console.log('Ductos:', ductos.length, '· km trazados:', Object.fromEntries(Object.entries(kmPor).map(([k, v]) => [k, Math.round(v)])));

const corte = '2026-11-22';
await writeFile(
  join(ROOT, 'src', 'lib', 'domain', 'datos', 'ductos.json'),
  JSON.stringify(
    {
      corte,
      nota: 'Los ductos del tablero: gas (el Sistema Nacional del Estado, los privados y los de importación), petrolíferos y crudo. Trazos aproximados, como los publica la CNH; los posteriores a 2019 los traza el juego por los puntos que dicen las fuentes.',
      fuentes: FUENTES,
      totales,
      gas,
      ductos,
    },
    null,
    0
  ) + '\n'
);
await writeFile(
  join(ROOT, 'src', 'lib', 'domain', 'datos', 'ductos-real.json'),
  JSON.stringify(
    {
      corte,
      nota: 'Lo que pasó de verdad con cada gasoducto que llegó, o llega, después de diciembre de 2018.',
      fuentes: Object.fromEntries(Object.entries(FUENTES).filter(([k]) => Object.values(real).some((r) => r.fuentes.includes(k)))),
      obras: real,
    },
    null,
    2
  ) + '\n'
);
console.log('Escrito ductos.json y ductos-real.json');
