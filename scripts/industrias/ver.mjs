import { readFileSync, existsSync } from 'node:fs';
import { BUSQUEDAS } from './buscar-osm.mjs';
for (const [id, lat, lon] of BUSQUEDAS) {
  const f = `.cache/osm/industrias/${id}.json`;
  if (!existsSync(f)) { console.log(id, 'SIN ARCHIVO'); continue; }
  const d = JSON.parse(readFileSync(f, 'utf8'));
  const k = Math.cos((lat * Math.PI) / 180);
  const filas = d.elements.filter((e) => e.geometry?.length).map((e) => {
    const g = e.geometry;
    const cx = g.reduce((s, p) => s + p.lon, 0) / g.length, cy = g.reduce((s, p) => s + p.lat, 0) / g.length;
    const ext = Math.hypot((Math.max(...g.map((p) => p.lon)) - Math.min(...g.map((p) => p.lon))) * 111 * k, (Math.max(...g.map((p) => p.lat)) - Math.min(...g.map((p) => p.lat))) * 111);
    const t = e.tags;
    return [Math.hypot((cx - lon) * 111 * k, (cy - lat) * 111).toFixed(1), ext.toFixed(2), t.name, t.landuse ?? t.building ?? t.highway ?? t.man_made ?? '', cy.toFixed(5), cx.toFixed(5), e.id];
  }).filter((f) => !['residential', 'tertiary', 'secondary', 'primary', 'service', 'unclassified', 'trunk', 'motorway', 'track', 'living_street', 'footway', 'path'].includes(f[3])).sort((a, b) => b[1] - a[1]);
  console.log('==', id); for (const f of filas.slice(0, 5)) console.log('  ', f.join(' | '));
}
