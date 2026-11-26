// Builds what the State's trains charge and what they cost to run: the average rail freight
// revenue per tonne-km, the concessionaires' cost per train-km, and the trackage-rights fee on
// private track. Every figure keeps its source.
//
//   node scripts/dinero/gen-tarifas.mjs
//
// Writes src/lib/domain/datos/tarifas.json.

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DATOS = join(ROOT, 'src', 'lib', 'domain', 'datos');
const fmt = (x, d = 0) => x.toLocaleString('es-MX', { minimumFractionDigits: d, maximumFractionDigits: d });

const FUENTES = {
  'artf-indicadores-2020': {
    fuente:
      'ARTF, Indicadores Ferroviarios 2020 (SNIF): ingreso por tonelada-km de carga (T-C-1), toneladas-km netas por concesionario (tabla 11), trenes-km (tabla 12) y carros por tren (tabla 10), 2016–2019',
    url: 'https://www.gob.mx/cms/uploads/attachment/file/559416/Indicadores_Ferroviarios_ARTF_2020_Final.pdf',
  },
  'gmxt-4t18': {
    fuente: 'GMXT (Ferromex y Ferrosur), reporte del cuarto trimestre de 2018 ante la BMV: ingresos de 45,431.4 millones de pesos y utilidad de operación de 12,397.0 en 2018',
    url: 'https://gmxt.mx/wp-content/uploads/2019/07/4TRIM18D-GMXT.pdf',
  },
  'kcs-4t18': {
    fuente:
      'Kansas City Southern (dueña de KCSM), resultados del cuarto trimestre de 2018: razón de operación de 63.7 % en 2018 (toda la empresa, con su parte en EUA). El documento no se leyó: se usa lo que muestra el buscador',
    url: 'https://www.sec.gov/Archives/edgar/data/54480/000005448019000012/kcs1231201810k.htm',
  },
  'cofece-2021': {
    fuente:
      'Cofece, Estudio de competencia en el servicio público de transporte ferroviario de carga (2021), nota 125: «la SCT le impuso a la empresa LCD una contraprestación de 16.5 centavos de dólar a la empresa Ferromex por carro-kilómetro» (citando a la Cámara de Diputados, 2017)',
    url: 'https://www.cofece.mx/wp-content/uploads/2021/08/FERRO_doc-2021.pdf',
  },
  'artf-2019': {
    fuente: 'ARTF, Anuario Estadístico Ferroviario 2019, tabla 4-2: ingresos de las concesionarias en 2018',
    url: 'https://www.gob.mx/cms/uploads/attachment/file/574090/Anuario_Estadi_stico_Ferroviario_2019__2_.pdf',
  },
};

const presupuesto = JSON.parse(await readFile(join(DATOS, 'presupuesto.json'), 'utf8'));
const energia = JSON.parse(await readFile(join(DATOS, 'energia.json'), 'utf8'));
const ingresos2018 = presupuesto.derecho.ingresos.find((x) => x.año === 2018);
const porEmpresa = ingresos2018.porEmpresa;

// The system's cost per peso charged: GMXT's (Ferromex and Ferrosur) and KCS's, by their 2018 revenue.
const RAZON_GMXT = 1 - 12397.043 / 45431.357;
const RAZON_KCS = 0.637;
const pesoGmxt = porEmpresa.FXE + porEmpresa.FSRR;
const pesoKcs = porEmpresa.KCSM;
const razon = (RAZON_GMXT * pesoGmxt + RAZON_KCS * pesoKcs) / (pesoGmxt + pesoKcs);
const TRENES_KM_2018 = 36.09; // millions
const costoTrenKm = (razon * ingresos2018.mdp) / TRENES_KM_2018;

const USD_CARRO_KM = 0.165;
const CARROS_POR_TREN = 37.11;
const pasoTrenKm = USD_CARRO_KM * CARROS_POR_TREN * energia.tipoCambio;
const INGRESO_TKM = 0.68;

const datos = {
  corte: '2026-11-26',
  nota: 'Lo que cobran y lo que cuestan los trenes del Estado. Generado por scripts/dinero/gen-tarifas.mjs; cada cifra con su fuente.',
  fuentes: FUENTES,
  ingreso: {
    pesosPorTkm: INGRESO_TKM,
    porEmpresa: { KCSM: 0.81, FSRR: 0.73, FXE: 0.6, LCD: 0.59, FIT: 0.35 },
    dato: `Cobran lo que cobraba en promedio el ferrocarril de carga en 2018: ${fmt(INGRESO_TKM, 2)} pesos por tonelada-km (ARTF; Kansas City de México 0.81, Ferrosur 0.73, Ferromex 0.60, el Istmo 0.35). Cada tramo cobra las toneladas que lleva a bordo por sus km.`,
    fuentes: ['artf-indicadores-2020'],
  },
  costo: {
    razonOperacion: Math.round(razon * 1000) / 1000,
    razonGmxt: Math.round(RAZON_GMXT * 1000) / 1000,
    razonKcs: RAZON_KCS,
    ingresos2018Mdp: ingresos2018.mdp,
    trenesKm2018Millones: TRENES_KM_2018,
    pesosPorTrenKm: Math.round(costoTrenKm),
    dato:
      `Cuestan lo que le costaba a las concesionarias mover un tren un km en 2018: gastaban ${fmt(razon * 100, 1)} centavos por cada peso que cobraban ` +
      `(GMXT, de Ferromex y Ferrosur, ${fmt(RAZON_GMXT * 100, 1)} %; Kansas City Southern ${fmt(RAZON_KCS * 100, 1)} %, ponderadas por sus ingresos), ` +
      `y cobraron ${fmt(ingresos2018.mdp, 1)} millones con ${fmt(TRENES_KM_2018, 2)} millones de trenes-km: ${fmt(costoTrenKm)} pesos por km de tren, ` +
      'cargado o vacío. Incluye todo: diésel, tripulación, mantenimiento, depreciación y administración (cálculo del juego).',
    fuentes: ['gmxt-4t18', 'kcs-4t18', 'artf-2019', 'artf-indicadores-2020'],
  },
  derechoPaso: {
    usdPorCarroKm: USD_CARRO_KM,
    carrosPorTren: CARROS_POR_TREN,
    pesosPorTrenKm: Math.round(pasoTrenKm * 10) / 10,
    dato:
      `En vía privada pagan derecho de paso: 16.5 centavos de dólar por carro-km, la contraprestación que la SCT le impuso a Coahuila–Durango con Ferromex ` +
      `(Cofece), por los ${fmt(CARROS_POR_TREN, 2)} carros de un tren promedio de 2018 (ARTF): ${fmt(pasoTrenKm, 1)} pesos por km de tren con el tipo de cambio del juego. ` +
      'No hay una tarifa pública vigente: es estimación del juego.',
    fuentes: ['cofece-2021', 'artf-indicadores-2020'],
  },
};

await writeFile(join(DATOS, 'tarifas.json'), JSON.stringify(datos, null, 1) + '\n');
console.log(`ingreso ${INGRESO_TKM} $/t-km · razón ${razon.toFixed(3)} · costo ${costoTrenKm.toFixed(0)} $/tren-km · paso ${pasoTrenKm.toFixed(1)} $/tren-km · equilibrio ${(costoTrenKm / INGRESO_TKM).toFixed(0)} t (vía estatal), ${((costoTrenKm + pasoTrenKm) / INGRESO_TKM).toFixed(0)} t (privada)`);
