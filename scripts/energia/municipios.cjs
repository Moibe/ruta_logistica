// INEGI geostatistical service: municipalities of a state and the coordinates of
// each one's seat (cabecera). Cached in <cache dir>, so it runs once.
const fs = require('fs');
const path = require('path');

const CVE = {
  AGS: '01', BC: '02', BCS: '03', CAMP: '04', COAH: '05', COL: '06', CHIS: '07', CHIH: '08', CDMX: '09', DGO: '10',
  GTO: '11', GRO: '12', HGO: '13', JAL: '14', MEX: '15', MICH: '16', MOR: '17', NAY: '18', NL: '19', OAX: '20',
  PUE: '21', QRO: '22', QROO: '23', SLP: '24', SIN: '25', SON: '26', TAB: '27', TAMPS: '28', TLAX: '29', VER: '30',
  YUC: '31', ZAC: '32',
};
const NOMBRE_ESTADO = {
  aguascalientes: 'AGS', 'baja california': 'BC', 'baja california sur': 'BCS', campeche: 'CAMP', coahuila: 'COAH',
  'coahuila de zaragoza': 'COAH', colima: 'COL', chiapas: 'CHIS', chihuahua: 'CHIH', 'ciudad de mexico': 'CDMX',
  'distrito federal': 'CDMX', durango: 'DGO', guanajuato: 'GTO', guerrero: 'GRO', hidalgo: 'HGO', jalisco: 'JAL',
  mexico: 'MEX', 'estado de mexico': 'MEX', michoacan: 'MICH', 'michoacan de ocampo': 'MICH', morelos: 'MOR',
  nayarit: 'NAY', 'nuevo leon': 'NL', oaxaca: 'OAX', puebla: 'PUE', queretaro: 'QRO', 'queretaro de arteaga': 'QRO',
  'quintana roo': 'QROO', 'san luis potosi': 'SLP', sinaloa: 'SIN', sonora: 'SON', tabasco: 'TAB', tamaulipas: 'TAMPS',
  tlaxcala: 'TLAX', veracruz: 'VER', 'veracruz de ignacio de la llave': 'VER', yucatan: 'YUC', zacatecas: 'ZAC',
};

const norm = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const estadoDe = (s) => {
  const n = norm(s);
  if (CVE[String(s).toUpperCase()]) return String(s).toUpperCase();
  return NOMBRE_ESTADO[n] ?? null;
};

async function json(url, archivo) {
  if (fs.existsSync(archivo)) return JSON.parse(fs.readFileSync(archivo, 'utf8'));
  for (let intento = 0; intento < 3; intento++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      fs.writeFileSync(archivo, JSON.stringify(j));
      await new Promise((ok) => setTimeout(ok, 150));
      return j;
    } catch (e) {
      if (intento === 2) throw e;
      await new Promise((ok) => setTimeout(ok, 1000));
    }
  }
}

function crear(cacheDir) {
  fs.mkdirSync(cacheDir, { recursive: true });
  const listas = {};

  async function municipiosDe(edo) {
    listas[edo] ??= (await json(`https://gaia.inegi.org.mx/wscatgeo/v2/mgem/${CVE[edo]}`, path.join(cacheDir, `mgem_${edo}.json`))).datos;
    return listas[edo];
  }

  /** The municipality whose name matches, in the given state: exact, then contains, then first words. */
  async function buscar(edo, municipio) {
    const lista = await municipiosDe(edo);
    const n = norm(municipio).replace(/^(heroica|h )/, '');
    let m = lista.find((x) => norm(x.nomgeo) === n);
    m ??= lista.find((x) => norm(x.nomgeo).includes(n) || n.includes(norm(x.nomgeo)));
    m ??= lista.find((x) => norm(x.nomgeo).split(' ')[0] === n.split(' ')[0] && n.length > 3);
    return m ?? null;
  }

  /** Coordinates of the seat of `municipio` in state `edo` ([lon, lat]), or null. */
  async function cabecera(edo, municipio) {
    const m = await buscar(edo, municipio);
    if (!m) return null;
    const j = await json(`https://gaia.inegi.org.mx/wscatgeo/v2/localidades/${m.cvegeo}${m.cve_cab}`, path.join(cacheDir, `loc_${m.cvegeo}.json`));
    const l = j.datos?.[0];
    return l ? { lonLat: [Math.round(+l.longitud * 1e4) / 1e4, Math.round(+l.latitud * 1e4) / 1e4], nombre: m.nomgeo } : null;
  }

  return { cabecera, buscar, municipiosDe };
}

module.exports = { crear, estadoDe, norm, CVE };
