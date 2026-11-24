// Builds src/lib/domain/datos/industrias.json: the big private industries of the board (the light
// vehicle assembly plants and the logistics parks), each with its place, its dates and its sources,
// and the yearly production and exports of each carmaker from the INEGI's administrative register
// of the light vehicle industry (RAIAVL), read from its PxWeb API.
//
// usage: node scripts/industrias/gen-industrias.mjs
// (the plants' coordinates come from OpenStreetMap: scripts/industrias/ubicar.mjs writes them to
// scripts/industrias/ubicaciones.json, which this script reads.)
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EMPRESAS, PLANTAS, FUENTES } from './plantas.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const ROOT = join(AQUI, '..', '..');
const API = 'https://www.inegi.org.mx/app/tabulados/pxwebv2/api/v1/es/RAIAVL/';
const DESDE = 2018;

async function pedir(tabla, cuerpo) {
  const r = await fetch(API + tabla, {
    method: cuerpo ? 'POST' : 'GET',
    headers: { 'User-Agent': 'Mozilla/5.0', 'Content-Type': 'application/json' },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  if (!r.ok) throw new Error(`INEGI ${tabla}: HTTP ${r.status}`);
  return r.json();
}

/**
 * Units of `unidad` per brand and year (the months summed), and how many months the last year has.
 * Production comes from table 8_9, which mixes sales; only the rows made in Mexico count.
 */
async function serie(tabla, unidad, filtro) {
  const meta = await pedir(tabla);
  const v = Object.fromEntries(meta.variables.map((x) => [x.code, x]));
  const clave = Object.keys(v).find((c) => c.startsWith('Marca'));
  const texto = Object.fromEntries(v[clave].values.map((x, i) => [x, v[clave].valueTexts[i]]));
  const filas = v[clave].values.filter((x) => filtro(texto[x]));
  const uni = v['Unidades vehiculares'].values.filter((x, i) => v['Unidades vehiculares'].valueTexts[i] === unidad);
  const años = v['Año'].values.filter((x, i) => Number(v['Año'].valueTexts[i]) >= DESDE);
  const añoDe = Object.fromEntries(v['Año'].values.map((x, i) => [x, v['Año'].valueTexts[i]]));
  const out = {};
  let meses = 0;
  for (const a of años) {
    const d = await pedir(tabla, {
      query: [
        { code: 'Año', selection: { filter: 'item', values: [a] } },
        { code: 'Mes', selection: { filter: 'all', values: ['*'] } },
        { code: clave, selection: { filter: 'item', values: filas } },
        { code: 'Unidades vehiculares', selection: { filter: 'item', values: uni } },
      ],
      response: { format: 'json' },
    });
    const conDatos = new Set();
    for (const f of d.data) {
      const n = Number(f.values[0]);
      if (!Number.isFinite(n)) continue;
      const marca = texto[f.key[2]].split(' - ')[0].trim();
      out[marca] ??= {};
      out[marca][añoDe[a]] = (out[marca][añoDe[a]] ?? 0) + n;
      if (n) conDatos.add(f.key[1]);
    }
    meses = conDatos.size;
    console.log(`${tabla} ${añoDe[a]}: ${conDatos.size} meses`);
  }
  return { porMarca: out, meses };
}

const prod = await serie('RAIAVL_8_9.px', 'Producción', (t) => t.includes(' - Nacional - México'));
const expo = await serie('RAIAVL_10.px', 'Exportación', () => true);
const ultimo = String(Math.max(...Object.values(prod.porMarca).flatMap((s) => Object.keys(s).map(Number))));

const empresas = {};
for (const [id, e] of Object.entries(EMPRESAS)) {
  const serieE = {};
  for (const marca of e.marcas) {
    for (const [año, n] of Object.entries(prod.porMarca[marca] ?? {})) (serieE[año] ??= { produccion: 0, exportacion: 0 }).produccion += n;
    for (const [año, n] of Object.entries(expo.porMarca[marca] ?? {})) (serieE[año] ??= { produccion: 0, exportacion: 0 }).exportacion += n;
  }
  empresas[id] = { ...e, serie: serieE };
}

const ubicaciones = JSON.parse(readFileSync(join(AQUI, 'ubicaciones.json'), 'utf8'));
const plantas = PLANTAS.map((p) => {
  const u = ubicaciones[p.id];
  if (!u) throw new Error(`${p.id}: sin ubicación en ubicaciones.json`);
  return { ...p, lonLat: u.lonLat, ubicacion: u.de };
});

const out = {
  corte: new Date().toISOString().slice(0, 10),
  nota: 'Generado por scripts/industrias/gen-industrias.mjs.',
  fuentes: FUENTES,
  parcial: { año: Number(ultimo), meses: prod.meses },
  empresas,
  plantas,
};
writeFileSync(join(ROOT, 'src', 'lib', 'domain', 'datos', 'industrias.json'), JSON.stringify(out, null, 1) + '\n');
console.log(`${plantas.length} plantas de ${Object.keys(empresas).length} empresas; ${ultimo} hasta el mes ${prod.meses}`);
