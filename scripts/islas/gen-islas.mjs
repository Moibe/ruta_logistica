// Builds src/lib/domain/datos/islas.json: the names of the islands the board draws.
//
//   node scripts/islas/gen-islas.mjs            checks every name with Nominatim and writes the file
//   node scripts/islas/gen-islas.mjs --sin-red  writes the file from the list as it is
//
// The board's islands are the polygons of mexico.topo.json (Natural Earth 10m) that are not
// their estado's mainland: 54 of them. Natural Earth names only five (Guadalupe, Clarión,
// Socorro, Cozumel and the Revillagigedo as a group), so the names come from OpenStreetMap:
// each one below was looked up with Nominatim and kept only when OSM puts that island within
// TOLERANCIA_KM of the centre of the polygon (the same tolerance `map/mexico.ts` matches with).
// The ones that failed the check, or that have no name in OSM, stay off the list and the board
// shows only their estado: the sand bars of the Mar Muerto (CHIS), Laguna de Tamiahua (VER),
// Laguna de San Andrés (TAMPS) and Laguna Ojo de Liebre (BC, the smaller one), and Isla Santa
// Cruz (BCS, 25.3° N), which Nominatim does not find at all.
//
// `estado` is the estado the island belongs to. Natural Earth puts San Esteban in Baja
// California's polygon and Montague in Sonora's; OSM's reverse geocoding (Hermosillo, Sonora;
// Mexicali, Baja California) and the INEGI catalogue say otherwise, and the list wins.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TOLERANCIA_KM = 15;

/** nombre: as the board says it; busca: what to ask Nominatim (OSM's spelling); centro: of the board's polygon. */
const ISLAS = [
  { nombre: 'Isla Tiburón', estado: 'SON', centro: [-112.372, 28.975] },
  { nombre: 'Isla Ángel de la Guarda', estado: 'BC', centro: [-113.341, 29.272] },
  { nombre: 'Isla Cozumel', estado: 'QROO', centro: [-86.874, 20.468] },
  { nombre: 'Isla de Cedros', estado: 'BC', centro: [-115.222, 28.163] },
  { nombre: 'Isla Magdalena', estado: 'BCS', centro: [-112.167, 24.806] },
  { nombre: 'Isla Guadalupe', estado: 'BC', centro: [-118.292, 29.031] },
  { nombre: 'Isla Santa Margarita', estado: 'BCS', centro: [-111.829, 24.444] },
  { nombre: 'Isla San José', busca: 'Isla San Jose', estado: 'BCS', centro: [-110.629, 24.975] },
  { nombre: 'Isla Socorro', estado: 'COL', centro: [-110.98, 18.781] },
  { nombre: 'Isla del Carmen', estado: 'BCS', centro: [-111.152, 25.953] },
  { nombre: 'Isla María Madre', estado: 'NAY', centro: [-106.575, 21.618] },
  // Cerralvo was renamed Jacques Cousteau in 2009 (DOF, 17 nov 2009); OSM carries the new name.
  { nombre: 'Isla Jacques Cousteau (Cerralvo)', busca: 'Isla Jacques Cousteau', estado: 'BCS', centro: [-109.871, 24.241] },
  { nombre: 'Isla del Carmen', estado: 'CAMP', centro: [-91.662, 18.72] },
  { nombre: 'Arrecife Alacranes', estado: 'YUC', centro: [-89.692, 22.476] },
  { nombre: 'Isla Espíritu Santo', estado: 'BCS', centro: [-110.36, 24.494] },
  { nombre: 'Isla Montague', estado: 'BC', centro: [-114.72, 31.734] },
  { nombre: 'Isla María Magdalena', estado: 'NAY', centro: [-106.421, 21.465] },
  { nombre: 'Isla San Ignacio', estado: 'SIN', centro: [-108.884, 25.418] },
  { nombre: 'Isla Santa Catalina', estado: 'BCS', centro: [-110.776, 25.657] },
  { nombre: 'Isla Mazocarit', estado: 'SON', centro: [-109.197, 26.306] },
  { nombre: 'Isla San Esteban', estado: 'SON', centro: [-112.577, 28.705] },
  { nombre: 'Isla Arena', estado: 'BC', centro: [-114.152, 28.033] },
  { nombre: 'Isla Ana', estado: 'BCS', centro: [-113.203, 26.706] },
  { nombre: 'Isla San Lorenzo', estado: 'BC', centro: [-112.815, 28.623] },
  { nombre: 'Isla San Marcos', estado: 'BCS', centro: [-112.079, 27.218] },
  { nombre: 'Isla Creciente', estado: 'BCS', centro: [-111.586, 24.364] },
  { nombre: 'Isla Santo Domingo', estado: 'BCS', centro: [-112.112, 25.382] },
  { nombre: 'Isla Clarión', estado: 'COL', centro: [-114.755, 18.341] },
  { nombre: 'Isla María Cleofas', estado: 'NAY', centro: [-106.244, 21.315] },
  { nombre: 'Isla Lobos', estado: 'SON', centro: [-110.586, 27.343] },
  { nombre: 'Isla Monserrat', busca: 'Isla Montserrat', estado: 'BCS', centro: [-111.038, 25.687] },
  { nombre: 'Isla San Benedicto', estado: 'COL', centro: [-110.818, 19.311] },
  // Natural Earth draws two pieces of the Chinchorro bank; OSM's cays are 8 and 12 km from their centres.
  { nombre: 'Banco Chinchorro (Cayo Norte)', busca: 'Cayo Norte', estado: 'QROO', centro: [-87.259, 18.688] },
  { nombre: 'Banco Chinchorro (Cayo Centro)', busca: 'Cayo Centro', estado: 'QROO', centro: [-87.341, 18.482] },
  { nombre: 'Isla San Juanito', estado: 'NAY', centro: [-106.668, 21.759] },
  { nombre: 'Isla Huivulai', estado: 'SON', centro: [-109.999, 27.065] },
  { nombre: 'Isla Tortuga', estado: 'BCS', centro: [-111.881, 27.438] },
  { nombre: 'Isla Mujeres', estado: 'QROO', centro: [-86.727, 21.24] },
  { nombre: 'Isla Natividad', estado: 'BCS', centro: [-115.19, 27.875] },
  { nombre: 'Isla Coronado (Smith)', busca: 'Isla Coronado', estado: 'BC', centro: [-113.509, 29.066] },
  { nombre: 'Isla Coronados (Loreto)', busca: 'Isla Coronado, Loreto', estado: 'BCS', centro: [-111.274, 26.12] },
  { nombre: 'Isla San Luis', busca: 'Isla San Luís', estado: 'BC', centro: [-114.41, 29.974] },
  { nombre: 'Isla San Benito Oeste', estado: 'BC', centro: [-115.587, 28.31] },
  { nombre: 'Isla San Pedro Nolasco', estado: 'SON', centro: [-111.383, 27.969] },
  { nombre: 'Isla San Francisco', estado: 'BCS', centro: [-110.573, 24.827] },
  { nombre: 'Isla Danzante', estado: 'BCS', centro: [-111.252, 25.794] },
  { nombre: 'Isla San Martín', estado: 'BC', centro: [-116.114, 30.49] },
  { nombre: 'Isla Coronado Sur', estado: 'BC', centro: [-117.247, 32.408] },
];

const D2R = Math.PI / 180;
const km = (a, b) => 6371 * Math.hypot((b[0] - a[0]) * D2R * Math.cos(((a[1] + b[1]) / 2) * D2R), (b[1] - a[1]) * D2R);
const sinRed = process.argv.includes('--sin-red');

/** Nominatim, with three tries and 20 s each: the connection drops now and then. */
async function buscar(url) {
  let ultimo;
  for (let intento = 0; intento < 3; intento++) {
    try {
      return await (await fetch(url, { headers: { 'User-Agent': 'ruta-logistica-juego/1.0' }, signal: AbortSignal.timeout(20000) })).json();
    } catch (e) {
      ultimo = e;
      await new Promise((f) => setTimeout(f, 3000));
    }
  }
  throw ultimo;
}

const islas = [];
for (const i of ISLAS) {
  let comprobada = null;
  if (!sinRed) {
    const q = i.busca ?? i.nombre;
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(q)}&countrycodes=mx&limit=8&accept-language=es`;
    const res = await buscar(url);
    for (const r of res) {
      const d = km(i.centro, [Number(r.lon), Number(r.lat)]);
      if (d <= TOLERANCIA_KM) {
        comprobada = { osm: `${r.osm_type}/${r.osm_id}`, tipo: `${r.category}/${r.type}`, km: Math.round(d * 10) / 10 };
        break;
      }
    }
    if (!comprobada) throw new Error(`${i.nombre}: Nominatim no la pone a menos de ${TOLERANCIA_KM} km de ${i.centro}`);
    await new Promise((f) => setTimeout(f, 1100));
  }
  islas.push({ nombre: i.nombre, estado: i.estado, centro: i.centro, ...(comprobada ? { osm: comprobada.osm, osmKm: comprobada.km } : {}) });
  console.log(`${i.estado.padEnd(5)} ${i.nombre.padEnd(34)} ${comprobada ? `${comprobada.tipo} a ${comprobada.km} km` : ''}`);
}

const out = {
  corte: new Date().toISOString().slice(0, 10),
  nota: 'Generado por scripts/islas/gen-islas.mjs.',
  fuente:
    'Nombres de OpenStreetMap (Nominatim), comprobados contra el centro de cada polígono de Natural Earth 10m del tablero ' +
    `(a menos de ${TOLERANCIA_KM} km). Las islas sin nombre en OSM (barras de las lagunas costeras) no están.`,
  islas,
};
writeFileSync(join(ROOT, 'src', 'lib', 'domain', 'datos', 'islas.json'), JSON.stringify(out, null, 1) + '\n');
console.log(`${islas.length} islas`);
