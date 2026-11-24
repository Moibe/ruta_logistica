// The big private industries of the board, by hand, each fact with its source (official first:
// the company, a government, the INEGI; the press only where it says so). Coordinates aren't here:
// no official source gives them, so they come from OpenStreetMap (ubicar.mjs → ubicaciones.json).

export const FUENTES = {
  raiavl: {
    fuente: 'INEGI, Registro Administrativo de la Industria Automotriz de Vehículos Ligeros (RAIAVL): producción y exportación mensual por marca',
    url: 'https://www.inegi.org.mx/datosprimarios/iavl/',
  },
  osm: { fuente: 'OpenStreetMap (ODbL, © colaboradores de OpenStreetMap): ubicación de cada planta', url: 'https://www.openstreetmap.org/copyright' },
  vw: { fuente: 'Volkswagen de México, historia: el primer Sedán de Puebla, el 23 de octubre de 1967', url: 'https://www.vw.com.mx/es/experiencia/cultura/historia-volkswagen-mexico.html' },
  audi: { fuente: 'Audi México: planta de San José Chiapa, inaugurada el 30 de septiembre de 2016; produce el Q5', url: 'https://www.audi.com.mx/es/audi-en-mexico/media-center/notas/210930_futuro-actitud-audi-mexico-quinto-aniversario-produciendo/' },
  'gm-silao': { fuente: 'Gobierno de Guanajuato, 15 de julio de 2026: el complejo Silao de GM (pickups)', url: 'https://boletines.guanajuato.gob.mx/2026/07/15/inaugura-gobernadora-la-nueva-instalacion-de-paneles-solares-en-gm-complejo-silao/' },
  'gm-ramos': { fuente: 'Secretaría de Economía: participación del secretario y del director de General Motors de México (Ramos Arizpe, 45 años; SUV eléctricas)', url: 'https://www.gob.mx/se/prensa/participacion-del-secretario-de-economia-marcelo-ebrard-y-del-presidente-y-director-general-de-general-motors-de-mexico' },
  'gm-slp': { fuente: 'Secretaría de Economía, ficha automotriz de San Luis Potosí: la planta de GM, desde 2008', url: 'https://www.gob.mx/cms/uploads/attachment/file/77151/San_Luis_Potosi_Automotriz.pdf' },
  nissan: { fuente: 'Nissan Mexicana, «Nosotros»: CIVAC desde 1966 y Aguascalientes desde 1982', url: 'https://www.nissan.com.mx/corporate/nosotros.html' },
  'nissan-a2': { fuente: 'Nissan, 12 de noviembre de 2013: inaugura su planta Aguascalientes A2', url: 'https://mexico.nissannews.com/es-MX/releases/nissan-inaugurates-all-new-aguascalientes-mexico-plant-building-on-a-reputation-for-quality-and-efficiency' },
  'nissan-civac': { fuente: 'Nissan: integrará la producción de CIVAC al complejo de Aguascalientes, al cierre de su año fiscal 2025 (marzo de 2026)', url: 'https://mexico.nissannews.com/es-MX/releases/nissan-integrara-la-produccion-de-vehiculos-de-la-planta-civac-al-complejo-de-aguascalientes-en-mexico' },
  compas: { fuente: 'La Jornada, 23 de octubre de 2025 (prensa): COMPAS, de Nissan y Mercedes-Benz, cerrará en mayo de 2026', url: 'https://www.jornada.com.mx/noticia/2025/10/23/economia/complejo-manufacturero-de-infiniti-y-mercedesbenz-en-aguascalientes-cerrara-en-mayo-de-2026' },
  kia: { fuente: 'Secretaría de Economía: demostración del Kia EV3 en Pesquería (4 de agosto de 2026)', url: 'https://www.gob.mx/se/prensa/participacion-del-secretario-de-economia-marcelo-ebrard-durante-la-demostracion-de-la-unidad-kia-sub-ev3' },
  toyota: { fuente: 'Toyota, plantas en Norteamérica: Tijuana (TMMBC, Tacoma desde 2004) y Guanajuato (TMMGT, desde diciembre de 2019)', url: 'https://global.toyota/en/company/profile/facilities/manufacturing-worldwide/north_america.html' },
  'toyota-gto': { fuente: 'Secretaría de Economía: Toyota inaugura su segunda planta en México (Apaseo el Grande, 6 de febrero de 2020)', url: 'https://www.gob.mx/se/es/articulos/inaugura-la-compania-automotriz-toyota-segunda-planta-en-mexico' },
  bmw: { fuente: 'BMW Group, planta San Luis Potosí: producción en serie desde abril de 2019, apertura el 6 de junio de 2019', url: 'https://www.bmwgroup-werke.com/san-luis-potosi/es/linea-del-tiempo.html' },
  mazda: { fuente: 'Mazda de México, planta Salamanca: primer Mazda3 el 6 de enero de 2014', url: 'https://www.mazda.mx/por-que-mazda/acerca-de-nosotros/planta-salamanca' },
  'mazda-tren': { fuente: 'Congreso de Guanajuato, expediente 7319: la espuela ferroviaria de la planta de Mazda en Salamanca', url: 'https://www.congresogto.gob.mx/expedientes_legislativos_digitales/iniciativas/7319' },
  honda: { fuente: 'Honda de México, «Cuatro décadas de compromiso»: El Salto (autos desde 1995) y Celaya (2014)', url: 'https://rp.honda.mx/wp-content/documentos/556_HDM_cuatro_decadas_de_compromiso.pdf' },
  'honda-salto': { fuente: 'Honda, 7 de septiembre de 2019: la producción de autos de El Salto pasa a Celaya a principios de 2020', url: 'https://global.honda/en/newsroom/news/2019/c190907eng.html' },
  ford: { fuente: 'Ford, plantas en el mundo: Hermosillo y Cuautitlán', url: 'https://corporate.ford.com/operations/locations/global-plants/' },
  stellantis: { fuente: 'Stellantis Norteamérica, fichas de sus plantas de Saltillo (camiones, 1995; vans, 2013) y Toluca (1968)', url: 'https://media.stellantisnorthamerica.com/newsrelease.do?id=319' },
  jac: { fuente: 'Secretaría de Economía: Giant Motors Latinoamérica anuncia su planta en Hidalgo (Ciudad Sahagún, 2017)', url: 'https://www.gob.mx/se/articulos/giant-motors-latinoamerica-anuncia-inversion-de-planta-automotriz-en-el-estado-de-hidalgo' },
  'tmex-fidepar': { fuente: 'FIDEPAR (Gobierno del Estado de México), listado de parques industriales, septiembre de 2026: T-MEX Park, Nextlalpan, carretera Teoloyucan–Jaltocan', url: 'https://fidepar.edomex.gob.mx/' },
  'tmex-dhl': { fuente: 'DHL Supply Chain México (dicho de la empresa), 2026: inaugura la nave 3 de su campus en T-MEX Park y llega a 160,000 m²; primeras naves en agosto de 2025', url: 'https://www.dhl.com/mx-es/home/prensa/archivo-de-prensa/2026/dhl-supply-chain-mexico-inaugura-la-nave-3-de-su-mega-campus-tmex-y-alcanza-los-160-000-m2-de-infraestructura-logistica.html' },
  'tmex-anuncio': { fuente: 'Gobierno de México, segundo paquete de proyectos de infraestructura con el sector privado (30 de noviembre de 2020): «T-MEC Park», 13,020 millones de pesos, logística', url: 'https://www.gob.mx/cms/uploads/attachment/file/730917/002_SEGUNDO_ANUNCIO_30_NOVIEMBRE_2020.pdf' },
};

/** Carmakers and their brands in the RAIAVL. */
export const EMPRESAS = {
  gm: { nombre: 'General Motors de México', marcas: ['General Motors'], fuentes: ['raiavl'] },
  nissan: { nombre: 'Nissan Mexicana', marcas: ['Nissan'], fuentes: ['raiavl'] },
  stellantis: { nombre: 'Stellantis México (antes FCA, Chrysler)', marcas: ['Chrysler', 'Fiat'], fuentes: ['raiavl'] },
  ford: { nombre: 'Ford de México', marcas: ['Ford Motor'], fuentes: ['raiavl'] },
  vw: { nombre: 'Volkswagen de México', marcas: ['Volkswagen'], fuentes: ['raiavl'] },
  toyota: { nombre: 'Toyota', marcas: ['Toyota'], fuentes: ['raiavl'] },
  kia: { nombre: 'Kia México', marcas: ['KIA'], fuentes: ['raiavl'] },
  mazda: { nombre: 'Mazda', marcas: ['Mazda'], fuentes: ['raiavl'] },
  honda: { nombre: 'Honda de México', marcas: ['Honda', 'Acura'], fuentes: ['raiavl'] },
  audi: { nombre: 'Audi México', marcas: ['Audi'], fuentes: ['raiavl'] },
  bmw: { nombre: 'BMW Group', marcas: ['BMW Group'], fuentes: ['raiavl'] },
  mercedes: { nombre: 'Mercedes-Benz (en COMPAS)', marcas: ['Mercedes Benz_Prod_Expo'], fuentes: ['raiavl'] },
  jac: { nombre: 'JAC (Giant Motors Latinoamérica)', marcas: ['JAC'], fuentes: ['raiavl'] },
};

const a = (id, corto, nombre, empresa, municipio, estado, que, desde, fuentes, extra = {}) => ({ id, corto, nombre, tipo: 'armadora', empresa, municipio, estado, que, desde, ...extra, fuentes: [...fuentes, 'raiavl', 'osm'] });

export const PLANTAS = [
  a('vw-puebla', 'VW Puebla', 'Volkswagen de México, planta Puebla', 'vw', 'Cuautlancingo', 'PUE', 'Autos y SUV (Jetta, Taos, Tiguan)', '1967', ['vw']),
  a('audi-san-jose-chiapa', 'Audi', 'Audi México, San José Chiapa', 'audi', 'San José Chiapa', 'PUE', 'La SUV Q5', '2016-09-30', ['audi']),
  a('gm-silao', 'GM Silao', 'General Motors, complejo Silao', 'gm', 'Silao', 'GTO', 'Pickups (Silverado, Cheyenne, Sierra)', '1995', ['gm-silao']),
  a('gm-ramos-arizpe', 'GM Ramos Arizpe', 'General Motors, complejo Ramos Arizpe', 'gm', 'Ramos Arizpe', 'COAH', 'SUV, hoy eléctricas (Blazer EV, Equinox EV)', '1981', ['gm-ramos']),
  a('gm-san-luis-potosi', 'GM San Luis Potosí', 'General Motors, complejo San Luis Potosí', 'gm', 'Villa de Reyes', 'SLP', 'SUV (Equinox, Terrain)', '2008', ['gm-slp']),
  a('nissan-a1', 'Nissan A1', 'Nissan Mexicana, Aguascalientes A1', 'nissan', 'Aguascalientes', 'AGS', 'Autos y pickups', '1982', ['nissan']),
  a('nissan-a2', 'Nissan A2', 'Nissan Mexicana, Aguascalientes A2', 'nissan', 'Aguascalientes', 'AGS', 'Autos (Sentra)', '2013-11-12', ['nissan-a2']),
  a('nissan-civac', 'Nissan CIVAC', 'Nissan Mexicana, planta CIVAC', 'nissan', 'Jiutepec', 'MOR', 'Autos y pickups (Versa, NP300, Frontier)', '1966', ['nissan', 'nissan-civac'], {
    hasta: '2026-03',
    nota: 'La primera planta de Nissan fuera de Japón. Nissan pasó su producción a Aguascalientes al cierre de su año fiscal 2025.',
  }),
  a('compas', 'COMPAS', 'COMPAS (Nissan y Mercedes-Benz), Aguascalientes', 'mercedes', 'Aguascalientes', 'AGS', 'SUV de lujo (Infiniti QX50 y QX55, Mercedes-Benz GLB)', '2017', ['compas'], {
    hasta: '2026-05-31',
    nota: 'Sociedad a partes iguales de Nissan y Daimler. Su arranque en 2017 y su cierre solo tienen fuente de prensa; el INEGI ya no registra producción de Mercedes-Benz desde agosto de 2026. Sus cifras son las de Mercedes-Benz: los Infiniti cuentan en Nissan.',
  }),
  a('kia-pesqueria', 'Kia', 'Kia México, Pesquería', 'kia', 'Pesquería', 'NL', 'Autos (K3, K4) y el eléctrico EV3', '2016', ['kia']),
  a('toyota-tijuana', 'Toyota Tijuana', 'Toyota Motor Manufacturing de Baja California', 'toyota', 'Tijuana', 'BC', 'La pickup Tacoma', '2004', ['toyota']),
  a('toyota-guanajuato', 'Toyota Guanajuato', 'Toyota Motor Manufacturing de Guanajuato', 'toyota', 'Apaseo el Grande', 'GTO', 'La pickup Tacoma', '2019-12', ['toyota', 'toyota-gto']),
  a('bmw-san-luis-potosi', 'BMW', 'BMW Group, planta San Luis Potosí', 'bmw', 'Villa de Reyes', 'SLP', 'Autos (Serie 3, Serie 2 Coupé, M2)', '2019-04', ['bmw']),
  a('mazda-salamanca', 'Mazda', 'Mazda de México Vehicle Operation, Salamanca', 'mazda', 'Salamanca', 'GTO', 'Autos y SUV (Mazda2, Mazda3, CX-3, CX-30)', '2014-01', ['mazda', 'mazda-tren'], {
    tren: 'Tiene espuela propia para exportar por tren (Congreso de Guanajuato).',
  }),
  a('honda-celaya', 'Honda Celaya', 'Honda de México, planta Celaya', 'honda', 'Celaya', 'GTO', 'SUV (HR-V, Acura ADX)', '2014', ['honda']),
  a('honda-el-salto', 'Honda El Salto', 'Honda de México, planta El Salto', 'honda', 'El Salto', 'JAL', 'Autos y SUV hasta 2020; hoy solo motocicletas', '1995', ['honda', 'honda-salto'], {
    hasta: '2020-01',
    nota: 'Sus autos pasaron a Celaya a principios de 2020; la planta sigue, con motocicletas.',
  }),
  a('ford-hermosillo', 'Ford Hermosillo', 'Ford, planta de estampado y ensamble de Hermosillo', 'ford', 'Hermosillo', 'SON', 'Bronco Sport y la pickup Maverick', '1986', ['ford']),
  a('ford-cuautitlan', 'Ford Cuautitlán', 'Ford, planta Cuautitlán', 'ford', 'Cuautitlán Izcalli', 'MEX', 'El eléctrico Mustang Mach-E (desde noviembre de 2020; antes, el Fiesta)', '1964', ['ford']),
  a('stellantis-saltillo', 'Stellantis Saltillo', 'Stellantis, plantas de camiones y de vans de Saltillo', 'stellantis', 'Saltillo', 'COAH', 'Pickups Ram y vans Ram ProMaster', '1995', ['stellantis']),
  a('stellantis-toluca', 'Stellantis Toluca', 'Stellantis, planta Toluca', 'stellantis', 'Toluca', 'MEX', 'SUV de Jeep (Compass, Wagoneer S, Cherokee)', '1968', ['stellantis']),
  a('jac-sahagun', 'JAC', 'Giant Motors Latinoamérica (JAC), Ciudad Sahagún', 'jac', 'Tepeapulco', 'HGO', 'SUV y pickups JAC, armados con kits', '2017', ['jac']),
  {
    id: 'tmex-park',
    corto: 'T-MEX Park',
    nombre: 'T-MEX Park',
    tipo: 'logistica',
    municipio: 'Nextlalpan',
    estado: 'MEX',
    que: 'Parque logístico privado junto al AIFA; su primer inquilino en operación es DHL Supply Chain (160,000 m² en 2026)',
    desde: '2025-08',
    tren: 'El desarrollador planea espuelas y una zona intermodal con Ferrovalle; no hay evidencia de que operen.',
    nota: 'De Grupo El-Mann. El gobierno federal lo anunció en 2020 como «T-MEC Park» entre los proyectos con el sector privado; no tiene dinero público ni es un Polo del Bienestar. Su superficie (4 a 6 millones de m²) y sus empleos son cifras del desarrollador. Su enlace de carga con el AIFA es un dicho del desarrollador: el aeropuerto no lo menciona.',
    fuentes: ['tmex-fidepar', 'tmex-dhl', 'tmex-anuncio', 'osm'],
  },
];
