// For the plants the Geofabrik pass didn't find as a named way: asks Overpass for anything (node,
// way or relation) whose name or operator matches, in a box around the place. Prints what it finds;
// the pick goes by hand into ELEGIDAS of ubicar.mjs.
const SERVIDORES = ['https://overpass-api.de/api/interpreter', 'https://lz4.overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
/** [id, lat, lon, pattern, half-box in degrees]. */
const FALTAN = [
  ['gm-san-luis-potosi', 22.0, -100.87, 'General Motors|GM|Motors', 0.2],
  ['nissan-a1', 21.83, -102.28, 'Nissan', 0.08],
  ['nissan-civac', 18.915, -99.175, 'Nissan', 0.05],
  ['toyota-tijuana', 32.49, -116.7, 'Toyota', 0.2],
  ['toyota-guanajuato', 20.57, -100.54, 'Toyota', 0.08],
  ['ford-cuautitlan', 19.67, -99.19, 'Ford', 0.06],
  ['stellantis-toluca', 19.29, -99.6, 'Chrysler|Stellantis|FCA|Jeep', 0.1],
  ['jac-sahagun', 19.77, -98.58, 'JAC|Giant|Sahag', 0.08],
  ['tmex-park', 19.73, -99.07, 'T-?MEX|DHL|Tmex', 0.08],
];

async function overpass(q) {
  for (const s of SERVIDORES) {
    try {
      const r = await fetch(s, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'gen-industrias' }, signal: AbortSignal.timeout(60000) });
      if (r.ok) return await r.json();
    } catch {
      // next server
    }
  }
  return null;
}

const solo = process.argv.slice(2);
for (const [id, lat, lon, re, m] of FALTAN) {
  if (solo.length && !solo.includes(id)) continue;
  const caja = `${lat - m},${lon - m},${lat + m},${lon + m}`;
  const q = `[out:json][timeout:50];(nwr["name"~"${re}",i](${caja});nwr["operator"~"${re}",i](${caja}););out center tags;`;
  const d = await overpass(q);
  console.log('==', id, d ? d.elements.length : 'sin respuesta');
  for (const e of d?.elements ?? []) {
    const t = e.tags ?? {};
    const c = e.center ?? e;
    const clase = t.landuse ?? t.man_made ?? t.building ?? t.shop ?? t.amenity ?? t.highway ?? t.power ?? t.railway ?? t.office ?? '';
    if (['car', 'car_repair', 'residential', 'tertiary', 'secondary', 'service', 'school', 'bus_stop', 'fuel', 'primary', 'unclassified', 'living_street', 'motorcycle'].includes(clase)) continue;
    console.log('  ', e.type, e.id, '|', t.name ?? '', '|', t.operator ?? '', '|', clase, '|', c.lat?.toFixed(5), c.lon?.toFixed(5));
  }
}
