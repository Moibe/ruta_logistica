// Builds src/lib/domain/datos/mineria.json from minas.mjs (the mines, by hand, with their sources)
// and ubicaciones.json (their places, from OpenStreetMap: ubicar.mjs).
//
// usage: node scripts/mineria/gen-mineria.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FUENTES, MINAS, NACIONAL } from './minas.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const ROOT = join(AQUI, '..', '..');
const ubicaciones = JSON.parse(readFileSync(join(AQUI, 'ubicaciones.json'), 'utf8'));

const minas = MINAS.map((m) => {
  const u = ubicaciones[m.id];
  if (!u) throw new Error(`${m.id}: sin ubicación en ubicaciones.json`);
  for (const f of m.fuentes) if (!FUENTES[f]) throw new Error(`${m.id}: fuente desconocida ${f}`);
  return { ...m, lonLat: u.lonLat, ubicacion: u.de, fuentes: [...m.fuentes, 'osm'] };
});
const out = { corte: new Date().toISOString().slice(0, 10), nota: 'Generado por scripts/mineria/gen-mineria.mjs.', fuentes: FUENTES, nacional: NACIONAL, minas };
writeFileSync(join(ROOT, 'src', 'lib', 'domain', 'datos', 'mineria.json'), JSON.stringify(out, null, 1) + '\n');
console.log(`${minas.length} minas`);
