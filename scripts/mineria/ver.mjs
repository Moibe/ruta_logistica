// Lists what buscar-osm.mjs found for each mine and plant: the biggest named shapes near where it's
// known to be (distance km | size km | name | kind | lat | lon | way id), to pick one in ubicar.mjs.
// Also the industrial land around the three car plants OpenStreetMap doesn't have by name.
import { readFileSync, existsSync } from 'node:fs';
import { BUSQUEDAS, TAJOS, LUGARES } from './buscar-osm.mjs';

const CALLES = ['residential', 'tertiary', 'secondary', 'primary', 'service', 'unclassified', 'trunk', 'motorway', 'track', 'living_street', 'footway', 'path'];

function filas(f, lat, lon) {
  const d = JSON.parse(readFileSync(f, 'utf8'));
  const k = Math.cos((lat * Math.PI) / 180);
  return d.elements
    .filter((e) => e.geometry?.length || e.type === 'node')
    .map((e) => {
      const g = e.geometry ?? [{ lat: e.lat, lon: e.lon }];
      const cx = g.reduce((s, p) => s + p.lon, 0) / g.length;
      const cy = g.reduce((s, p) => s + p.lat, 0) / g.length;
      const ext = Math.hypot((Math.max(...g.map((p) => p.lon)) - Math.min(...g.map((p) => p.lon))) * 111 * k, (Math.max(...g.map((p) => p.lat)) - Math.min(...g.map((p) => p.lat))) * 111);
      const t = e.tags ?? {};
      return [Math.hypot((cx - lon) * 111 * k, (cy - lat) * 111).toFixed(1), ext.toFixed(2), t.name ?? '', t.place ?? t.landuse ?? t.industrial ?? t.building ?? t.highway ?? t.man_made ?? t.railway ?? '', cy.toFixed(5), cx.toFixed(5), `${e.type === 'node' ? 'n' : ''}${e.id}`];
    })
    .filter((x) => !CALLES.includes(x[3]))
    .sort((a, b) => b[1] - a[1]);
}

for (const [id, lat, lon] of BUSQUEDAS) {
  const f = `.cache/osm/mineria/${id}.json`;
  if (!existsSync(f)) {
    console.log(id, 'SIN ARCHIVO');
    continue;
  }
  console.log('==', id);
  for (const x of filas(f, lat, lon).slice(0, 7)) console.log('  ', x.join(' | '));
}
for (const [id, lat, lon] of TAJOS) {
  const f = `.cache/osm/mineria/tajo-${id}.json`;
  if (!existsSync(f)) continue;
  console.log('== tajo', id);
  for (const x of filas(f, lat, lon).slice(0, 5)) console.log('  ', x.join(' | '));
}
for (const [id, lat, lon] of LUGARES) {
  const f = `.cache/osm/mineria/lugar-${id}.json`;
  if (!existsSync(f)) continue;
  console.log('== lugar', id);
  for (const x of filas(f, lat, lon).sort((a, b) => a[0] - b[0]).slice(0, 4)) console.log('  ', x.join(' | '));
}
for (const [id, lat, lon] of [['nissan-a1', 21.827, -102.283], ['stellantis-toluca', 19.287, -99.598], ['tmex-park', 19.725, -99.07]]) {
  const f = `.cache/osm/mineria/industrial-${id}.json`;
  if (!existsSync(f)) continue;
  console.log('== industrial', id);
  for (const x of filas(f, lat, lon).slice(0, 8)) console.log('  ', x.join(' | '));
}
