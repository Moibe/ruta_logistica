// Keeps the game's real-world data current.
//
//   npm run al-dia
//
// 1. Searches the Diario Oficial de la Federación, from the cut-off date in
//    src/lib/domain/datos/calibracion.json up to today, for every act about
//    the Polos del Bienestar ("Polo de Desarrollo … Bienestar"), and lists the
//    ones the game hasn't reviewed yet: new declaratorias (a polo to add to
//    datos/polos.json), modifications, clarifying notes, abrogations.
// 2. Lists every calibrated figure (costs, times, jobs) with its official
//    source, flagging the ones not checked in more than six months.
//
// It changes nothing: it says what to review. After reviewing, record it:
// new polos go to datos/polos.json (with the method in docs/enciclopedia.md,
// §5), reviewed acts to `dofRevisados`, re-checked figures get a new
// `consultado` date, and `corte` moves to the day of the review.
//
// The DOF's search shows ten results per page and its paging doesn't work
// without a browser session, so a date range with more than ten results is
// split in half until each piece fits.

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATOS = join(ROOT, 'src', 'lib', 'domain', 'datos');
const MESES_VIGENCIA = 6;

const calibracion = JSON.parse(await readFile(join(DATOS, 'calibracion.json'), 'utf8'));
const polos = JSON.parse(await readFile(join(DATOS, 'polos.json'), 'utf8'));

const conocidos = new Set([
  ...polos.map((p) => p.codigo),
  ...polos.filter((p) => p.poligono).map((p) => p.poligono),
  ...calibracion.dofRevisados,
]);

const dma = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
const dia = 24 * 3600 * 1000;

const entidades = (s) =>
  s
    .replace(/&oacute;/g, 'ó').replace(/&aacute;/g, 'á').replace(/&eacute;/g, 'é').replace(/&iacute;/g, 'í').replace(/&uacute;/g, 'ú')
    .replace(/&Oacute;/g, 'Ó').replace(/&Aacute;/g, 'Á').replace(/&Eacute;/g, 'É').replace(/&Iacute;/g, 'Í').replace(/&Uacute;/g, 'Ú')
    .replace(/&ntilde;/g, 'ñ').replace(/&Ntilde;/g, 'Ñ').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ');

/** One page of the DOF's search for a date range: the total it reports and the acts it lists. */
async function buscar(desde, hasta) {
  const cuerpo = new URLSearchParams({
    vienede: 'avanzada',
    BUSCAR_EN: 'T',
    textobusqueda: 'Polo de Desarrollo Bienestar',
    TIPO_TEXTO: 'Y',
    dfecha: dma(desde),
    hfecha: dma(hasta),
    organismos: 'Tjs=',
  });
  const res = await fetch('https://dof.gob.mx/website/busqueda_detalle.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0 (compatible; al-dia)' },
    body: cuerpo,
  });
  if (!res.ok) throw new Error(`DOF: HTTP ${res.status}`);
  const html = await res.text();
  const total = Number((html.match(/cantidadTotalResultados" value="(\d+)/) || [])[1] ?? 0);
  const actos = [];
  const re = /<a[^>]*href=["']?([^"' >]*nota_detalle\.php\?codigo=(\d+)[^"' >]*)[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const codigo = Number(m[2]);
    if (actos.some((a) => a.codigo === codigo)) continue;
    const fecha = ((m[1].match(/fecha=([0-9/%F]+)/) || [])[1] ?? '').replace(/%2F/g, '/');
    const titulo = entidades(m[3].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
    actos.push({ codigo, fecha, titulo });
  }
  return { total, actos };
}

/** Every act in [desde, hasta], splitting the range while it has more than a page of results. */
async function todos(desde, hasta) {
  const { total, actos } = await buscar(desde, hasta);
  if (total <= 10 || hasta - desde < 2 * dia) return actos;
  const mitad = new Date(desde.getTime() + Math.floor((hasta - desde) / 2 / dia) * dia);
  const despues = new Date(mitad.getTime() + dia);
  return [...(await todos(desde, mitad)), ...(await todos(despues, hasta))];
}

const clase = (t) =>
  /abroga/i.test(t)
    ? 'ABROGACIÓN'
    : /modifica/i.test(t)
      ? 'MODIFICACIÓN'
      : /aclaratoria/i.test(t)
        ? 'NOTA ACLARATORIA'
        : /Declaratoria del Polo/i.test(t)
          ? 'DECLARATORIA NUEVA'
          : 'OTRO ACTO';

// `--desde aaaa-mm-dd` reviews from another date (to re-check a past period).
const iDesde = process.argv.indexOf('--desde');
const corte = new Date(`${iDesde > 0 ? process.argv[iDesde + 1] : calibracion.corte}T00:00:00`);
const hoy = new Date();
console.log(`Revisión del DOF del ${dma(corte)} al ${dma(hoy)} ("Polo de Desarrollo … Bienestar")\n`);
let actos = [];
try {
  actos = await todos(corte, hoy);
} catch (err) {
  console.log(`  No se pudo consultar el DOF: ${err.message}. Vuelve a intentarlo más tarde.\n`);
}
const nuevos = actos.filter((a) => !conocidos.has(a.codigo));
if (!actos.length) console.log('  El DOF no reporta actos en el periodo.');
else if (!nuevos.length) console.log(`  ${actos.length} actos en el periodo, todos ya revisados.`);
else {
  console.log(`  ${nuevos.length} acto(s) sin revisar:`);
  for (const a of nuevos) {
    console.log(`  · [${clase(a.titulo)}] ${a.fecha} — ${a.titulo}`);
    console.log(`    https://dof.gob.mx/nota_detalle.php?codigo=${a.codigo}&fecha=${a.fecha}`);
  }
}

console.log(`\nCifras de calibración (calibracion.json), vigencia de ${MESES_VIGENCIA} meses:\n`);
for (const [clave, c] of Object.entries(calibracion.cifras)) {
  const edad = (hoy - new Date(`${c.consultado}T00:00:00`)) / (30.44 * dia);
  const vencida = edad > MESES_VIGENCIA;
  console.log(`  ${vencida ? '⚠ REVISAR' : '✓ al día '}  ${clave}: ${c.valor} ${c.unidad}`);
  console.log(`              ${c.fuente} · consultado ${c.consultado}${c.url ? `\n              ${c.url}` : ''}`);
}

console.log(`
Qué hacer con lo que salga:
  · Declaratoria nueva: ubicar el polo con su cuadro de construcción y agregarlo a datos/polos.json
    (método en docs/enciclopedia.md, §5) y a la tabla de la enciclopedia.
  · Modificación, nota aclaratoria o abrogación: revisarla contra el polo que toca y anotar su código en
    "dofRevisados" de calibracion.json (con la corrección en la bitácora de la enciclopedia).
  · Cifra por revisar: buscar el dato oficial más reciente; actualizar "valor" y "consultado".
  · Al terminar: mover "corte" a la fecha de hoy.`);
