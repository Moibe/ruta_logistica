// Builds src/lib/domain/datos/energia.json: the electricity regions, the plants
// of 2018, the private plants that came (or will come) into service, the CFE's
// works and the polos' demand. Every figure carries its source.
//
// usage: node scripts/energia/gen-energia.cjs <carpeta de trabajo>
//
// The work folder needs cre/permisos.json (the CNE's permits list, summarised
// by permisos_resumen.py) and keeps the INEGI cache. The PRODESEN's table 5.2,
// transcribed, sits next to this script (prodesen-centrales-2018.txt).
const fs = require('fs');
const path = require('path');
const { crear, estadoDe, norm } = require('./municipios.cjs');

const E = process.argv[2];
const ROOT = path.join(__dirname, '..', '..');
const geo = crear(path.join(E, 'inegi'));
const r1 = (x) => Math.round(x * 10) / 10;

// ---- regions: CENACE's territorial circumscription (DOF, 15 May 2018) -----------------------
const lista = (s) => s.split(',').map((x) => norm(x)).filter(Boolean);
const MUNICIPIOS = {
  central: {
    HGO: lista('Acatlán, Acaxochitlán, Actopan, Ajacuba, Almoloya, Apan, Atitalaquia, Atotonilco de Tula, Atotonilco el Grande, Chapantongo, Chilcuautla, Cuautepec de Hinojosa, El Arenal, Emiliano Zapata, Epazoyucan, Francisco I. Madero, Huasca de Ocampo, Metepec, Mineral de la Reforma, Mineral del Chico, Mineral del Monte, Mixquiahuala de Juárez, Omitlán de Juárez, Pachuca de Soto, Progreso de Obregón, San Agustín Tlaxiaca, San Salvador, Santiago de Anaya, Santiago Tulantepec de Lugo Guerrero, Singuilucan, Tepeapulco, Tepeji del Río de Ocampo, Tepetitlán, Tetepango, Tezontepec de Aldama, Tizayuca, Tlahuelilpan, Tlanalapa, Tlaxcoapan, Tolcayuca, Tula de Allende, Tulancingo de Bravo, Villa de Tezontepec, Zapotlán de Juárez, Zempoala'),
    GRO: lista('Ajuchitlán del Progreso, Arcelia, Apaxtla de Castrejón, Coyuca de Catalán, Cuetzala del Progreso, Cutzamala de Pinzón, General Canuto A. Neri, Ixcateopan de Cuauhtémoc, Pilcaya, Pedro Ascencio Alquisiras, Pungarabato, San Miguel Totolapan, Tlalchapa, Teloloapan, Tetipac, Zirándaro'),
    MICH: lista('Arteaga, Contepec, Huetamo, Lázaro Cárdenas, San Lucas, Tiquicheo de Nicolás Romero, Tlalpujahua'),
    MOR: lista('Cuernavaca, Huitzilac'),
    PUE: lista('Ahuazotepec, Huauchinango, Juan Galindo'),
  },
  noreste: {
    HGO: lista('Agua Blanca de Iturbide, Atlapexco, Calnali, Huautla, Huazalingo, Huehuetla, Huejutla de Reyes, Jaltocán, Juárez Hidalgo, Lolotla, Metztitlán, Molango de Escamilla, San Agustín Metzquititlán, San Bartolo Tutotepec, San Felipe Orizatlán, Tenango de Doria, Tianguistengo, Tlanchinol, Xochiatipan, Xochicoatlán, Yahualica, Zacualtipán de Ángeles'),
    SLP: lista('Alaquines, Aquismón, Axtla de Terrazas, Cárdenas, Cerritos, Ciudad del Maíz, Ciudad Fernández, Ciudad Valles, Coxcatlán, Ébano, El Naranjo, Huehuetlán, Lagunillas, Matlapa, Rayón, Rioverde, San Antonio, San Ciro de Acosta, San Martín Chalchicuautla, San Vicente Tancuayalab, Santa Catarina, Tamasopo, Tamazunchale, Tampacán, Tampamolón Corona, Tamuín, Tancanhuitz, Tanlajás, Tanquián de Escobedo, Villa Juárez, Xilitla'),
    VER: lista('El Higo, Naranjos Amatlán, Citlaltépetl, Chalma, Chiconamel, Chinampa de Gorostiza, Chontla, Huayacocotla, Ilamatlán, Ozuluama de Mascareñas, Pánuco, Platón Sánchez, Pueblo Viejo, Tamalín, Tamiahua, Tampico Alto, Tancoco, Tantima, Tantoyuca, Tempoal, Texcatepec, Tlachichilco, Zacualpan, Zontecomatlán de López y Fuentes'),
  },
  norte: {
    COAH: lista('Francisco I. Madero, Matamoros, Parras, San Pedro, Torreón, Sierra Mojada, Ocampo, Cuatro Ciénegas, General Cepeda, Viesca'),
    ZAC: lista('Sombrerete, Chalchihuites'),
  },
  occidental: {
    HGO: lista('Alfajayucan, Cardonal, Chapulhuacán, Eloxochitlán, Huichapan, Ixmiquilpan, Jacala de Ledezma, La Misión, Nicolás Flores, Nopala de Villagrán, Pacula, Pisaflores, Tasquillo, Tecozautla, Tepehuacán de Guerrero, Tlahuiltepa, Zimapán'),
    SLP: lista('Ahualulco, Armadillo de los Infante, Catorce, Cedral, Cerro de San Pedro, Charcas, Guadalcázar, Matehuala, Mexquitic de Carmona, Moctezuma, Salinas, San Luis Potosí, San Nicolás Tolentino, Santa María del Río, Santo Domingo, Soledad de Graciano Sánchez, Tierra Nueva, Vanegas, Venado, Villa de Arista, Villa de Arriaga, Villa de Guadalupe, Villa de la Paz, Villa de Ramos, Villa de Reyes, Villa Hidalgo, Zaragoza'),
  },
  'baja-california': { SON: lista('San Luis Río Colorado') },
  mulege: { BCS: lista('Mulegé') },
};
/** The region a whole state goes to when its municipality isn't listed (and its colour on the map). */
const ESTADO = {
  CDMX: 'central', MEX: 'central', HGO: 'central',
  NL: 'noreste', TAMPS: 'noreste', COAH: 'noreste',
  CHIH: 'norte', DGO: 'norte',
  AGS: 'occidental', COL: 'occidental', GTO: 'occidental', JAL: 'occidental', MICH: 'occidental', NAY: 'occidental', QRO: 'occidental', ZAC: 'occidental', SLP: 'occidental',
  CHIS: 'oriental', GRO: 'oriental', MOR: 'oriental', OAX: 'oriental', PUE: 'oriental', TAB: 'oriental', TLAX: 'oriental', VER: 'oriental',
  SIN: 'noroeste', SON: 'noroeste',
  BC: 'baja-california', BCS: 'baja-california-sur',
  CAMP: 'peninsular', QROO: 'peninsular', YUC: 'peninsular',
};
function regionDe(edo, municipio) {
  const n = norm(municipio);
  for (const [reg, porEdo] of Object.entries(MUNICIPIOS)) {
    const l = porEdo[edo];
    if (l && n && l.some((m) => m === n || (n.length > 4 && (m.startsWith(n) || n.startsWith(m))))) return reg;
  }
  return ESTADO[edo];
}

const PRODESEN = 'https://www.gob.mx/cms/uploads/attachment/file/';
const REGIONES = [
  // id, nombre, sistema, demanda 2018 (MW), 2024, margen 2019 tarde, noche, capacidad 2018 (MW)
  ['central', 'Central', 'SIN', 8805, 8848, 14.3, 14.6, 8449],
  ['oriental', 'Oriental', 'SIN', 7594, 9034, 41.0, 27.3, 17390],
  ['occidental', 'Occidental', 'SIN', 10373, 11834, 15.9, 15.9, 11277],
  ['noroeste', 'Noroeste', 'SIN', 4759, 5909, 24.3, 22.7, 4940],
  ['norte', 'Norte', 'SIN', 4639, 5540, 19.3, 15.1, 5450],
  ['noreste', 'Noreste', 'SIN', 9202, 11109, 25.4, 26.6, 16463],
  ['peninsular', 'Peninsular', 'SIN', 2061, 2969, 35.8, 23.7, 2336],
  ['baja-california', 'Baja California', 'BC', 2863, 3635, -4.5, -4.5, 2910],
  ['baja-california-sur', 'Baja California Sur', 'BCS', 500, 689, 35.4, 32.6, 739],
  // Mulegé: its own isolated system, not tied to the rest of Baja California Sur.
  // The PRODESEN publishes no margin for it: it's worked out from its capacity,
  // nearly all of it firm (combustion and the Tres Vírgenes geothermal plant),
  // against its 2019 peak.
  ['mulege', 'Mulegé', 'MUL', 29, 34, null, null, 98],
].map(([id, nombre, sistema, d18, d24, mt, mn, cap]) => {
  const crecimiento = Math.round(((d24 / d18) ** (1 / 6) - 1) * 10000) / 10000;
  const calculado = mt === null;
  const m = calculado ? r1(((cap * 0.9) / (d18 * (1 + crecimiento)) - 1) * 100) : null;
  return {
    id,
    nombre,
    sistema,
    demanda2018: d18,
    demanda2024: d24,
    crecimiento,
    margen2019: calculado ? { tarde: m, noche: m } : { tarde: mt, noche: mn },
    ...(calculado ? { margenCalculado: true } : {}),
    capacidad2018: cap,
    estados: Object.entries(ESTADO).filter(([, r]) => r === id).map(([e]) => e),
    ...(id === 'mulege' ? { parteDe: 'BCS', municipios: ['Mulegé'] } : {}),
  };
});
const UMBRALES = {
  SIN: { operativo: 6, planeacion: 21.3 },
  BC: { operativo: 11, planeacion: 20.9 },
  BCS: { operativo: 11, planeacion: 35 },
  MUL: { operativo: 11, planeacion: 35 },
};

// ---- technology classes and how much each counts at each peak ---------------------------------
const clase = (t) => (/fotovolt|solar|termosolar/i.test(t) && !/combusti/i.test(t) ? 'solar' : /e.lica/i.test(t) ? 'eolica' : 'firme');
const FACTORES = {
  firme: { tarde: 0.9, noche: 0.9 },
  eolica: { tarde: 0.25, noche: 0.25 },
  solar: { tarde: 0.35, noche: 0 },
};

(async () => {
  const faltan = [];
  const capitales = Object.fromEntries(
    require(ROOT + '/src/lib/domain/datos/ciudades.json')
      .filter((c) => c.capital)
      .map((c) => [c.estado, [c.lon, c.lat]])
  );
  async function ubicar(edo, municipio, quien) {
    const c = await geo.cabecera(edo, municipio);
    if (c) return c.lonLat;
    faltan.push(`${quien}: ${municipio}, ${edo}`);
    return capitales[edo];
  }

  // ---- Mulegé on the map ------------------------------------------------------------------------
  // Its border with Comondú and Loreto: the vertices of its outline (INEGI) that
  // those two share. `zona` closes that line to the north over the sea; the map
  // clips it with Baja California Sur's own outline, so the coast is the map's.
  {
    const clave = (v) => v[0].toFixed(6) + ',' + v[1].toFixed(6);
    const area = (r) => Math.abs(r.reduce((s, v, i) => s + (r.at(i - 1)[0] + v[0]) * (r.at(i - 1)[1] - v[1]), 0) / 2);
    const anillo = (await geo.contorno('03002')).map((p) => p[0]).sort((a, b) => area(b) - area(a))[0];
    const vecinos = new Set();
    for (const c of ['03001', '03009']) for (const p of await geo.contorno(c)) for (const r of p) for (const v of r) vecinos.add(clave(v));
    // The longest run of shared vertices, walking the ring from a vertex that isn't shared.
    const n = anillo.length;
    const desde = anillo.findIndex((v) => !vecinos.has(clave(v)));
    let tramo = [];
    for (let t = 0, actual = []; t <= n; t++) {
      const v = anillo[(desde + t) % n];
      if (t < n && vecinos.has(clave(v))) actual.push(v);
      else {
        if (actual.length > tramo.length) tramo = actual;
        actual = [];
      }
    }
    const frontera = tramo.map(([x, y]) => [Math.round(x * 1e4) / 1e4, Math.round(y * 1e4) / 1e4]);
    if (frontera[0][0] > frontera.at(-1)[0]) frontera.reverse(); // west to east
    const [oeste, este] = [frontera[0], frontera.at(-1)];
    const mul = REGIONES.find((r) => r.id === 'mulege');
    mul.frontera = frontera;
    mul.zona = [...frontera, [-109.5, este[1]], [-109.5, 29.5], [-116, 29.5], [-116, oeste[1]]];
    console.log('Mulegé: frontera de', frontera.length, 'puntos, de', JSON.stringify(oeste), 'a', JSON.stringify(este));
  }

  // ---- the main plants of December 2018 (PRODESEN 2019–2033, table 5.2) ----------------------
  const ARREGLOS = {
    'Río Escondido [sic; municipio Nava]': 'Nava', 'V. Carranza': 'Venustiano Carranza', 'P. Escobedo': 'Pedro Escobedo',
    'S. Luis de la Paz': 'San Luis de la Paz', 'S. N. Garza': 'San Nicolás de los Garza', 'Cd. Hidalgo': 'Hidalgo',
    'Cd. Juárez': 'Juárez', 'San Carlos': 'Comondú', 'San Miguel': 'San Miguel Soyaltepec', Varios: 'Cuauhtémoc',
  };
  const TEC = { HID: 'Hidroeléctrica', TC: 'Termoeléctrica', CC: 'Ciclo combinado', CAR: 'Carboeléctrica', NUC: 'Nuclear', GEO: 'Geotérmica', TG: 'Turbogás', EO: 'Eólica', CI: 'Combustión interna' };
  const notas = fs.readFileSync(path.join(__dirname, 'prodesen-centrales-2018.txt'), 'utf8').split('\n');
  const plantas2018 = [];
  for (const l of notas) {
    const m = /^(\d+) (.+?)\|(.+?)\|(.+?)\|(.+?)\|(.+?)\|(.*?)\|(\d+)\|(\d+)\|([\d,]+)$/.exec(l.trim());
    if (!m || +m[1] > 71) continue;
    let [, , nombre, , estado, municipio, tec] = m;
    if (nombre.startsWith('La Yesca')) estado = 'Nayarit';
    if (estado === 'México y DF') estado = 'Ciudad de México';
    const edo = estadoDe(estado.replace(/"|\[.*\]/g, '').trim());
    municipio = ARREGLOS[municipio] ?? municipio;
    const t = TEC[tec.split(',')[0]] ?? tec;
    plantas2018.push({
      nombre: nombre.replace(/ \(PIE\)/, ''),
      tecnologia: t,
      clase: clase(t),
      mw: +m[10].replace(/,/g, ''),
      dueño: /\(PIE\)/.test(nombre) ? 'privada' : 'CFE',
      estado: edo,
      municipio,
      region: regionDe(edo, municipio),
      lonLat: await ubicar(edo, municipio, nombre),
    });
  }

  // ---- private plants from 2019 on (CNE permits list, 31 Oct 2026) --------------------------------
  const permisos = JSON.parse(fs.readFileSync(path.join(E, 'cre', 'permisos.json'), 'utf8'));
  const privadas = [];
  for (const p of permisos) {
    if (p.cfe || !p.operacion || p.mw <= 0) continue;
    const opera = (p.estado === 'En operación' || p.estado === 'En operación parcial') && p.operacion >= '2019-01-01';
    const viene = p.estado === 'En construcción' && p.operacion >= '2025-01-01' && p.operacion <= '2031-12-31';
    if (!opera && !viene) continue;
    let edo = estadoDe(p.entidad);
    if (!edo) {
      faltan.push(`estado: ${p.entidad}`);
      continue;
    }
    // Los Cabos and La Paz appear under "Baja California" in some rows.
    if (edo === 'BC' && /cabos|la paz|cabo san lucas|comond|loreto|muleg/i.test(p.municipio)) edo = 'BCS';
    const municipio = p.municipio.replace(/cabo san lucas/i, 'Los Cabos');
    privadas.push({
      nombre: p.permisionario.replace(/,?\s*S\.?\s*(A|de R)\.?.*$/i, '').trim(),
      tecnologia: p.tecnologia,
      clase: clase(p.tecnologia),
      mw: r1(p.mw),
      fecha: p.operacion,
      enConstruccion: viene,
      estado: edo,
      municipio,
      region: regionDe(edo, municipio),
      lonLat: await ubicar(edo, municipio, p.permisionario),
    });
  }
  privadas.sort((a, b) => a.fecha.localeCompare(b.fecha));

  // ---- the CFE's own works (State works, paid from the CFE's till) ---------------------------------
  const CFE_INF = { fuente: 'CFE, Informe Anual 2024, tabla 4 (proyectos prioritarios del Fideicomiso Maestro de Inversión)', url: 'https://www.cfe.gob.mx/finanzas/reportes-financieros/Reportes%20Anuales%20Documentos/Informe%20Anual%202024.pdf' };
  const PERMISO = { fuente: 'CNE, lista de permisos de generación al 31 de octubre de 2026 (inversión estimada del permiso)', url: 'https://www.gob.mx/cms/uploads/attachment/file/1115484/E4_Tabla_p_blica_Oct26.xlsx' };
  const PORKW = { fuente: 'SENER, Plan de Desarrollo del Sector Eléctrico 2025–2039, tabla 3.1 (costo de inversión promedio por kW)', url: 'https://dof.gob.mx/nota_detalle_popup.php?codigo=5770297' };
  const PROG = { fuente: 'CFE, Programa de Desarrollo 2026–2030, tabla 1', url: 'https://www.cfe.gob.mx/finanzas/Documents/ProgramaDesarrollo-26.pdf' };
  const USD_KW = { 'Ciclo combinado': 843, Fotovoltaica: 1017, Turbogás: 727, 'Turbogás aeroderivada': 1093, 'Combustión interna': 1265, Hidroeléctrica: 3406 };
  const MESES = { 'Ciclo combinado': 36, Fotovoltaica: 12, Turbogás: 12, 'Turbogás aeroderivada': 12, 'Combustión interna': 12 };
  const obra = (id, nombre, tecnologia, mw, edo, municipio, costoMusd, costo, real) => ({
    id,
    nombre,
    tecnologia: tecnologia.replace(' aeroderivada', ''),
    clase: clase(tecnologia),
    mw,
    estado: edo,
    municipio,
    costoMusd: costoMusd ?? Math.round(mw * USD_KW[tecnologia]) / 1000,
    costo: costoMusd ? costo : { ...PORKW, dato: `Sin costo oficial de la central: ${USD_KW[tecnologia]} dólares por kW de su tecnología, por ${mw} MW.` },
    mesesGobierno: MESES[tecnologia],
    real,
  });
  const obrasCfe = [
    obra('cc-tula', 'Ciclo combinado Tula (paquetes 1 y 2)', 'Ciclo combinado', 567, 'HGO', 'Tula de Allende', 312.25, { ...PERMISO, dato: '567 MW, 312.25 millones de dólares de inversión estimada.' }, 'Proyecto de la administración anterior (contrato de 2014), sin terminar en 2018; en operación comercial desde el 28 de noviembre de 2020.'),
    obra('cc-salamanca', 'Ciclo combinado Salamanca', 'Ciclo combinado', 958.2, 'GTO', 'Salamanca', 614.12, { ...PERMISO, dato: 'Inversión estimada del permiso: 614.12 millones de dólares. La CFE la reporta con 958.18 MW.' }, 'Obra desde el 30 de septiembre de 2021; en operación desde el 14 de febrero de 2025.'),
    obra('cc-sauz-ii', 'Ciclo combinado El Sauz II', 'Ciclo combinado', 269, 'QRO', 'Pedro Escobedo', null, null, 'Obra desde el 30 de septiembre de 2021; en operación desde el 12 de septiembre de 2025, con 268.97 MW.'),
    obra('cc-san-luis-potosi', 'Ciclo combinado San Luis Potosí (Villa de Reyes)', 'Ciclo combinado', 448.7, 'SLP', 'Villa de Reyes', null, null, 'Obra desde el 30 de septiembre de 2021; en operación desde el 5 de julio de 2025.'),
    obra('cc-manzanillo-iii', 'Ciclo combinado Manzanillo III', 'Ciclo combinado', 346, 'COL', 'Manzanillo', null, null, 'Obra desde el 8 de marzo de 2022; en operación comercial desde el 17 de abril de 2026, con 346 MW.'),
    obra('cc-gonzalez-ortega', 'Ciclo combinado González Ortega (Mexicali)', 'Ciclo combinado', 641.4, 'BC', 'Mexicali', 853.5, { ...CFE_INF, dato: '641.4 MW, 853.5 millones de dólares (más 150.2 de su turbogás).' }, 'Obra desde el 26 de enero de 2022; en operación desde el 15 de mayo de 2026.'),
    obra('cc-merida', 'Ciclo combinado Mérida (Elvia Carrillo Puerto)', 'Ciclo combinado', 499, 'YUC', 'Mérida', 545.8, { ...CFE_INF, dato: '499 MW, 545.8 millones de dólares.' }, 'Obra desde el 18 de enero de 2022; en operación comercial desde el 12 de mayo de 2026.'),
    obra('cc-tuxpan-i', 'Ciclo combinado Tuxpan, fase I', 'Ciclo combinado', 1056.6, 'VER', 'Tuxpan', 903.5, { ...CFE_INF, dato: '1,056.6 MW, 903.5 millones de dólares.' }, 'Obra desde el 17 de febrero de 2022, 84.8 % al cierre de 2024; la CFE la espera entre 2026 y 2028.'),
    obra('cc-riviera-maya', 'Ciclo combinado Riviera Maya (Valladolid IV)', 'Ciclo combinado', 1020, 'YUC', 'Valladolid', 912.9, { ...CFE_INF, dato: '1,020 MW, 912.9 millones de dólares.' }, 'Obra desde el 20 de enero de 2022, 92.3 % al cierre de 2024; la CFE la espera entre 2026 y 2028.'),
    obra('cc-san-luis-rio-colorado', 'Ciclo combinado San Luis Río Colorado', 'Ciclo combinado', 647.9, 'SON', 'San Luis Río Colorado', 788.5, { ...CFE_INF, dato: '647.9 MW, 788.5 millones de dólares.' }, 'Obra desde el 26 de enero de 2022, 89.9 % al cierre de 2024; su permiso la espera a finales de 2027.'),
    obra('cc-lerdo', 'Ciclo combinado Lerdo', 'Ciclo combinado', 350, 'DGO', 'Lerdo', null, null, 'Obra desde el 29 de abril de 2022, 89 % al cierre de 2024; la CFE la espera entre 2026 y 2028.'),
    obra('fv-puerto-penasco-i-ii', 'Parque solar Puerto Peñasco, etapas I y II', 'Fotovoltaica', 457, 'SON', 'Puerto Peñasco', 815.62, { ...PERMISO, dato: '457 MW, 815.62 millones de dólares de inversión estimada.' }, 'Primera etapa (120 MW) en operación desde el 17 de febrero de 2023; la segunda (300 MW), empezada en septiembre de 2022, desde el 11 de septiembre de 2024.'),
    obra('fv-puerto-penasco-iii-iv', 'Parque solar Puerto Peñasco, etapas III y IV', 'Fotovoltaica', 580, 'SON', 'Puerto Peñasco', null, null, 'Programada para 2028.'),
    obra('ci-baja-california', 'Unidades de combustión interna y turbogás en Mexicali y San Luis Río Colorado', 'Combustión interna', 735, 'BC', 'Mexicali', 685.7, { ...PERMISO, dato: 'Combustión interna San Luis Río Colorado 206 MW (187.72 millones de dólares), Mexicali 436 MW (406.41) y tres turbogás de 31 MW en Mexicali (30.53 cada uno).' }, 'Mexicali Oriente ya operaba en julio de 2024; la CNE registra las unidades en operación de marzo a junio de 2025.'),
    obra('tg-los-cabos', 'Turbogás de emergencia en Los Cabos', 'Turbogás', 154, 'BCS', 'Los Cabos', 152.65, { ...PERMISO, dato: 'Cinco unidades de unos 31 MW, 30.53 millones de dólares cada una.' }, 'En operación desde el 12 de junio de 2025.'),
    obra('tg-riviera-maya', 'Turbogás aeroderivadas Riviera Maya', 'Turbogás aeroderivada', 100, 'QROO', 'Benito Juárez', null, null, 'La primera, Nizuc (36.9 MW, Cancún), en operación desde el 14 de octubre de 2026; Cancún 1 y 2 y Chankanaab (Cozumel), en obra.'),
  ];

  // ---- clean works for the isolated peninsula, and Chicoasén II: no official cost yet ----------
  const TERMO = 'https://www.gob.mx/presidencia/prensa/mexico-a-la-vanguardia-cfe-construira-2-centrales-termosolares-en-baja-california-sur-para-beneficiar-hasta-200-mil-hogares?idiom=es';
  const BOLETIN_095 = { fuente: 'CFE, boletín de prensa 095/26 (1 de junio de 2026)', url: 'https://www.cfe.gob.mx/cdn/2019/Archivos/Boletines/260601%20-%20gen%20energias%20limpias%20y%20renovables.pdf' };
  const BOLETIN_179 = { fuente: 'CFE, boletín de prensa 179/26 (10 de septiembre de 2026)', url: 'https://www.cfe.gob.mx/cdn/2019/Archivos/Boletines/179hidrogenoverdevf.pdf' };
  const IRENA_CSP = { fuente: 'Estimación del juego con IRENA, Renewable Power Generation Costs in 2024 (costo total instalado promedio mundial de la termosolar en 2024: 3,677 dólares por kW)', url: 'https://www.irena.org/Publications/2025/Jun/Renewable-Power-Generation-Costs-in-2024' };
  // The CFE is still choosing the sites: the game puts them in the system's two
  // load centres, La Paz and Los Cabos.
  const termosolar = (id, nombre, mw, municipio, real) => ({
    id,
    nombre,
    tecnologia: 'Termosolar',
    // Eleven hours of molten-salt storage: it generates at night too, so it counts as firm.
    clase: 'firme',
    mw,
    estado: 'BCS',
    municipio,
    sitioPorDefinir: true,
    costoMusd: Math.round(mw * 3677) / 1000,
    costo: { ...IRENA_CSP, dato: `La CFE no ha publicado su costo: ${mw} MW a 3,677 dólares por kW, el promedio mundial de la termosolar en 2024 (IRENA).` },
    mesesGobierno: 42,
    tiempo: { fuente: 'Presidencia de la República, 26 de agosto de 2025', url: TERMO, dato: 'Su construcción «tardará entre 36 y 48 meses»: el juego usa 42.' },
    aporteDato: 'Con 11 horas de almacenamiento en sales fundidas genera también de noche: cuenta como central firme.',
    anuncio: { fuente: 'Presidencia de la República, 26 de agosto de 2025', url: TERMO },
    real,
  });
  obrasCfe.push(
    termosolar(
      'termosolar-bcs-i',
      'Termosolares de Baja California Sur, primera etapa (2 de 50 MW)',
      100,
      'La Paz',
      'Anunciadas el 26 de agosto de 2025: dos centrales de torre central con almacenamiento térmico, 100 MW y 11 horas de operación continua. Primeras de su tipo en México; la CFE aún busca los sitios y las quiere operando al cierre del sexenio.'
    ),
    termosolar(
      'termosolar-bcs-ii',
      'Termosolar de Baja California Sur, segunda etapa (50 MW)',
      50,
      'Los Cabos',
      'Anunciada el 26 de agosto de 2025 como segunda etapa: «una más de 50 megawatts» para descarbonizar el sistema de Baja California Sur.'
    ),
    {
      id: 'oasis-mulege',
      nombre: 'Proyecto Oasis: solar, baterías e hidrógeno verde en Mulegé',
      tecnologia: 'Solar con almacenamiento',
      clase: 'solar',
      mw: 60,
      estado: 'BCS',
      municipio: 'Mulegé',
      // 60 MW solar (35 % in the afternoon) plus 20 MW of storage, which also covers the night.
      aporte: { tarde: 41, noche: 20 },
      aporteDato: 'Sus 60 MW solares cuentan 35 % en la tarde; sus 20 MW de almacenamiento (baterías, y el hidrógeno de respaldo) cuentan en los dos picos: 41 MW en la tarde y 20 en la noche.',
      costoMusd: 130,
      costo: {
        fuente: 'Estimación del juego con SENER, Plan de Desarrollo del Sector Eléctrico 2025–2039 (tabla 3.1 y A2.2) e IRENA, Green hydrogen cost reduction (2020)',
        url: 'https://dof.gob.mx/nota_detalle_popup.php?codigo=5770297',
        dato: 'La CFE no ha publicado su costo. Solar: 60 MW a 1,017 dólares por kW (61 millones); baterías de 4 horas: 20 MW a 1,449 (29 millones), del plan oficial; hidrógeno: un electrolizador de 20 MW a unos 1,000 dólares por kW (IRENA) y celdas de combustible supuestas del mismo costo (40 millones). Total: unos 130 millones de dólares.',
      },
      mesesGobierno: 24,
      tiempo: { fuente: 'Estimación del juego', url: '', dato: 'Sin fecha oficial: 24 meses con 4 cuadrillas, el doble de un parque solar, por las baterías y el hidrógeno.' },
      anuncio: BOLETIN_179,
      real: 'Anunciado por la CFE el 10 de septiembre de 2026: el primer proyecto en México que combina solar, baterías e hidrógeno verde en un sistema eléctrico aislado. Abastecerá 40 mil hogares, evitará 23 mil m³ de diésel y combustóleo y 93 mil toneladas de CO₂ al año. En evaluación.',
    },
    {
      id: 'chicoasen-ii',
      nombre: 'Hidroeléctrica Chicoasén II',
      tecnologia: 'Hidroeléctrica',
      clase: 'firme',
      mw: 240,
      estado: 'CHIS',
      municipio: 'Chicoasén',
      costoMusd: Math.round(240 * 3406) / 1000,
      costo: { ...PORKW, dato: 'Sin costo oficial publicado: 240 MW a 3,406 dólares por kW, el promedio de la hidroeléctrica en el plan oficial.' },
      mesesGobierno: 48,
      tiempo: { fuente: 'Estimación del juego', url: '', dato: 'La CFE la espera a finales de 2028, sin fecha de inicio publicada: 48 meses con 4 cuadrillas.' },
      anuncio: BOLETIN_095,
      real: 'En construcción; la CFE la espera a finales de 2028. Turbinas de tipo bulbo: la de mayor capacidad con esa tecnología en Latinoamérica.',
    }
  );

  for (const o of obrasCfe) {
    o.region = regionDe(o.estado, o.municipio);
    o.lonLat = await ubicar(o.estado, o.municipio, o.nombre);
    o.tiempo ??= { fuente: 'Estimación del juego', url: '', dato: `No hay fecha oficial de inicio y fin comparable: ${o.mesesGobierno} meses para ${o.tecnologia.toLowerCase()} con 4 cuadrillas.` };
  }

  // ---- the polos' electricity demand ------------------------------------------------------------
  const polos = require(ROOT + '/src/lib/domain/datos/polos.json');
  const OFICIAL = {
    'reserva-zapotlan': [20, 'Declaratoria (DOF): «en su etapa madura… una demanda de electricidad de 20 MW».'],
    nezahualcoyotl: [7.7, 'Declaratoria (DOF): «crecimiento en su demanda de electricidad de 5 a 7.7 MW de 2027 a 2030».'],
    tuxpan: [4, 'Declaratoria (DOF): «en su etapa madura… una demanda de electricidad de 4 MW».'],
    hermosillo: [7, 'Declaratoria (DOF): «una demanda de electricidad de 1 MW a 7 MW de 2026 a 2030».'],
    huamantla: [8, 'Portal de los Polos de Desarrollo, Secretaría de Economía: «Energía: 8 MW».'],
  };
  const totalMw = Object.values(OFICIAL).reduce((s, [m]) => s + m, 0);
  const totalHa = Object.keys(OFICIAL).reduce((s, id) => s + polos.find((p) => p.id === id).ha, 0);
  const MW_POR_HA = Math.round((totalMw / totalHa) * 10000) / 10000;
  const polosEnergia = {};
  for (const p of polos) {
    const municipio = p.municipio.split(/ y |,/)[0];
    const o = OFICIAL[p.id];
    polosEnergia[p.id] = { region: regionDe(p.estado, municipio), mw: o ? o[0] : r1(p.ha * MW_POR_HA), oficial: !!o, ...(o ? { dato: o[1] } : {}) };
  }

  const out = {
    corte: '2026-11-20',
    nota: 'Electricidad para los Polos del Bienestar. Cada región del sistema eléctrico arranca con su demanda y sus márgenes de reserva oficiales de 2019 (de la tarde y de la noche); la demanda crece al ritmo real de 2018 a 2024; las centrales privadas entran en su fecha real; las de la CFE las construye el jugador. Un polo solo se llena si su región tiene margen en los dos picos.',
    fuentes: {
      regiones: { fuente: 'CENACE, acuerdo de circunscripción territorial de las Gerencias de Control Regional (DOF, 15 de mayo de 2018)', url: 'https://www.cenace.gob.mx/Docs/16_MARCOREGULATORIO/CENACEOrganizacion/(DOF%202018-05-15%20CENACE)%20Circunscripci%C3%B3n%20territorial%20GCR.pdf' },
      capacidad: { fuente: 'SENER, PRODESEN 2019–2033, capítulo V, tablas 5.1 y 5.2 (capacidad y centrales a diciembre de 2018)', url: PRODESEN + '475497/PRODESEN_V.pdf' },
      demanda: { fuente: 'SENER, Plan de Desarrollo del Sector Eléctrico 2025–2039, tabla A1.6 (demanda máxima integrada 2018 y 2024)', url: 'https://dof.gob.mx/nota_detalle_popup.php?codigo=5770297' },
      margenes: { fuente: 'SENER, PRODESEN 2019–2033, capítulo VII, tablas 7.6 y 7.7 (margen de reserva 2019, escalones de la tarde y de la noche)', url: PRODESEN + '475498/PRODESEN_VII.pdf' },
      umbrales: { fuente: 'SENER, Plan de Desarrollo del Sector Eléctrico 2025–2039, §3.8: margen operativo de 6 % en el sistema interconectado y 11 % en los aislados; reserva de planeación de 21.3 %, 20.9 % (BC) y 35 % (BCS)', url: 'https://dof.gob.mx/nota_detalle_popup.php?codigo=5770297' },
      privadas: { fuente: 'CNE, lista de permisos de generación vigentes al 31 de octubre de 2026', url: 'https://www.gob.mx/cms/uploads/attachment/file/1115484/E4_Tabla_p_blica_Oct26.xlsx' },
      ubicaciones: { fuente: 'INEGI, servicio web del Catálogo Único de Claves Geoestadísticas (cabecera de cada municipio)', url: 'https://gaia.inegi.org.mx/wscatgeo/v2/' },
      factores: { fuente: 'Estimación del juego', url: '', dato: 'La metodología oficial cuenta la solar y la eólica con su disponibilidad horaria de cinco años, sin publicar un porcentaje fijo. El juego usa: centrales firmes (térmicas, hidroeléctricas, nuclear, geotérmicas) 90 % en los dos picos; eólica 25 %; solar 35 % en la tarde y 0 % en la noche. El 35 % sale de la diferencia entre el margen de la tarde (23.4 %) y el de la noche (20.6 %) del sistema interconectado en 2019, unos 1,300 MW, entre los ~3,600 MW solares de ese año.' },
      cajaCfe: { ...PROG, dato: 'La CFE paga sus centrales con recursos propios (su Fideicomiso Maestro de Inversión), no con el presupuesto federal. Su Programa de Desarrollo 2026–2030 destina 132 mil millones de pesos en cinco años a proyectos propios de generación: 26.4 mil millones al año. Para 2019–2025 no hay una cifra anual oficial comparable y se usa la misma.' },
      tipoCambio: { fuente: 'SHCP, Cuenta Pública 2024, panorama económico (con datos de Banxico): tipo de cambio promedio de 2024', url: 'https://www.cuentapublica.hacienda.gob.mx/work/models/CP/2024/tomo/I/I50.06.PEF.pdf' },
      polos: { fuente: 'Declaratorias de los polos (DOF) y portal de los Polos de Desarrollo de la Secretaría de Economía', url: 'https://podecobi.economia.gob.mx/polos-de-desarrollo', dato: `Solo cinco polos tienen cifra oficial; los demás usan la razón de esos cinco: ${totalMw} MW entre ${Math.round(totalHa)} ha, ${MW_POR_HA} MW por hectárea.` },
      mulege: {
        fuente: 'SENER, PRODESEN 2019–2033 (tablas 5.1 y 6.5) y Plan de Desarrollo del Sector Eléctrico 2025–2039 (tabla A1.6); su límite, INEGI, Marco Geoestadístico de diciembre de 2025',
        url: PRODESEN + '475497/PRODESEN_V.pdf',
        dato: `Mulegé es un sistema aislado aparte, sin enlace con el resto de Baja California Sur: demanda máxima de 29 MW en 2018 y 34 MW en 2024; capacidad de 98 MW en 2018, casi toda firme. El PRODESEN no publica su margen de reserva: el juego lo calcula con su capacidad al 90 % contra su demanda de 2019, ${REGIONES.find((r) => r.id === 'mulege').margen2019.tarde} %. Para la reserva usa los mínimos de Baja California Sur.`,
      },
      almacenamiento: {
        fuente: 'Estimación del juego',
        url: '',
        dato: 'El almacenamiento deja que una central cuente de noche: una termosolar con 11 horas de sales fundidas cuenta como firme (90 % en los dos picos), y las baterías cuentan sus MW en los dos picos.',
      },
    },
    umbrales: UMBRALES,
    factores: FACTORES,
    cajaCfeMdpAño: 26400,
    tipoCambio: 18.33,
    mwPorHa: MW_POR_HA,
    regiones: REGIONES,
    polos: polosEnergia,
    plantas2018,
    privadas,
    obras: obrasCfe,
  };
  fs.writeFileSync(ROOT + '/src/lib/domain/datos/energia.json', JSON.stringify(out, null, 1) + '\n');
  console.log('plantas 2018', plantas2018.length, '| privadas', privadas.length, Math.round(privadas.reduce((s, p) => s + p.mw, 0)), 'MW | obras CFE', obrasCfe.length, '| MW/ha', MW_POR_HA);
  console.log('por región, privadas:', JSON.stringify(privadas.reduce((a, p) => ((a[p.region] = Math.round((a[p.region] ?? 0) + p.mw)), a), {})));
  console.log('polos por región:', JSON.stringify(Object.entries(polosEnergia).reduce((a, [, p]) => ((a[p.region] = (a[p.region] ?? 0) + 1), a), {})));
  console.log('sin ubicar (' + faltan.length + '):', faltan.slice(0, 30).join(' | '));
  console.log('crecimiento:', REGIONES.map((r) => r.id + ' ' + (r.crecimiento * 100).toFixed(2) + '%').join(', '));
})();
