import { readFile } from 'node:fs/promises';
import { feature } from 'topojson-client';

/**
 * Ocean crossings: the lane from each gateway on the edge of the board to the
 * far port it stands for (Shanghái, Róterdam). Same method as the Mexican
 * lanes, on the whole world:
 *
 *  - the land is the one the world views draw: Natural Earth 50m, from the
 *    world-atlas copy in static/data, so a ship on the globe never sails over
 *    a coast you can see;
 *  - shortest path on a 0.1° grid that wraps round the antimeridian (the
 *    Pacific crossing goes through it), kept ~45 km off the coast where it can;
 *  - straightened into great-circle arcs — at ocean scale a ship steers the
 *    great circle, which on a flat map is a curve, not a straight line;
 *  - audited against the exact 50m coastline, polygon by polygon, not a grid.
 */

/** The routing grid: the whole width of the world, from the Southern Ocean to the Arctic coasts. */
export const MUNDO = { w: -180, e: 180, s: -60, n: 75, res: 0.1 };
/** Lanes keep this many cells (~45 km) off the coast when they can… */
const OLGURA_CELDAS = 4;
/** …and pay this much extra per cell they come closer. */
const PENALIZACION_COSTA = 0.4;
/** Sea next to a port the audit lets a lane cross: the last approach, which a 50m coast may swallow. */
export const EXENTO_KM = 30;

const D2R = Math.PI / 180;
const R_TIERRA = 6371;

// ---- spherical helpers (the same formulas as src/lib/domain/geo.ts) -----------------------

const cartesiano = ([lon, lat]) => {
  const c = Math.cos(lat * D2R);
  return [c * Math.cos(lon * D2R), c * Math.sin(lon * D2R), Math.sin(lat * D2R)];
};

/** Great-circle distance, km. */
export function kmGC(a, b) {
  const s =
    Math.sin(((b[1] - a[1]) * D2R) / 2) ** 2 +
    Math.cos(a[1] * D2R) * Math.cos(b[1] * D2R) * Math.sin(((b[0] - a[0]) * D2R) / 2) ** 2;
  return 2 * R_TIERRA * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Point at fraction `t` of the great circle from `a` to `b`. */
function interpolar(a, b, t) {
  const [ax, ay, az] = cartesiano(a);
  const [bx, by, bz] = cartesiano(b);
  const w = Math.acos(Math.max(-1, Math.min(1, ax * bx + ay * by + az * bz)));
  const s = Math.sin(w);
  if (s < 1e-9) return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const ka = Math.sin((1 - t) * w) / s;
  const kb = Math.sin(t * w) / s;
  const x = ax * ka + bx * kb;
  const y = ay * ka + by * kb;
  const z = az * ka + bz * kb;
  return [Math.atan2(y, x) / D2R, Math.atan2(z, Math.hypot(x, y)) / D2R];
}

const normalizar = (lon) => ((((lon + 180) % 360) + 360) % 360) - 180;

// ---- land ---------------------------------------------------------------------------------

/**
 * Every ring of the 50m land, unwrapped: wherever a ring jumps across the
 * antimeridian (Chukotka, Wrangel, a sliver of Fiji) its longitudes carry on
 * past ±180 instead, so the ring stays a closed shape on the plane and plain
 * even-odd tests work on it. Antarctica, the one ring round a pole, stays out
 * of the grid's latitudes.
 */
export async function tierraMundo(archivo) {
  const topo = JSON.parse(await readFile(archivo, 'utf8'));
  const land = feature(topo, topo.objects.land);
  const poligonos = [];
  for (const f of land.features) {
    const g = f.geometry;
    for (const p of g.type === 'Polygon' ? [g.coordinates] : g.coordinates) {
      const anillos = p.map((anillo) => {
        const out = [[anillo[0][0], anillo[0][1]]];
        for (let i = 1; i < anillo.length; i++) {
          let x = anillo[i][0];
          x += 360 * Math.round((out[i - 1][0] - x) / 360);
          out.push([x, anillo[i][1]]);
        }
        return out;
      });
      let x0 = Infinity;
      let x1 = -Infinity;
      let y0 = Infinity;
      let y1 = -Infinity;
      for (const [x, y] of anillos[0]) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
      poligonos.push({ anillos, x0, x1, y0, y1 });
    }
  }
  return poligonos;
}

function enAnillo(anillo, x, y) {
  let dentro = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i];
    const [xj, yj] = anillo[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

/** Exact test against the polygons (each tried at the point's longitude and one turn either side). */
export function enTierra(poligonos, [lon, lat]) {
  for (const p of poligonos) {
    if (lat < p.y0 || lat > p.y1) continue;
    for (const x of [lon, lon - 360, lon + 360]) {
      if (x < p.x0 || x > p.x1) continue;
      let dentro = false;
      for (const a of p.anillos) if (enAnillo(a, x, lat)) dentro = !dentro;
      if (dentro) return true;
    }
  }
  return false;
}

// ---- the grid -----------------------------------------------------------------------------

/**
 * Land on the wrapping grid: a cell is land when its centre is inside a
 * polygon (scanline, even-odd) or a coastline passes through it, so an island
 * narrower than a cell still blocks the way. Columns wrap: an unwrapped ring at
 * 185° fills the cells at −175°.
 */
function rasterizar(poligonos, malla) {
  const cols = Math.round((malla.e - malla.w) / malla.res);
  const filas = Math.round((malla.n - malla.s) / malla.res);
  const tierra = new Uint8Array(cols * filas);
  const col = (i) => ((i % cols) + cols) % cols;
  const bordes = [];
  for (const p of poligonos) {
    for (const a of p.anillos) {
      for (let i = 1; i < a.length; i++) {
        const [x1, y1] = a[i - 1];
        const [x2, y2] = a[i];
        if (Math.max(y1, y2) < malla.s || Math.min(y1, y2) > malla.n) continue;
        bordes.push([x1, y1, x2, y2]);
      }
    }
  }
  // Bucketed by row with a row of slack each side (see the Mexican grid for why).
  const porFila = Array.from({ length: filas }, () => []);
  for (const b of bordes) {
    const j0 = Math.max(0, Math.ceil((Math.min(b[1], b[3]) - malla.s) / malla.res - 0.5) - 1);
    const j1 = Math.min(filas - 1, Math.floor((Math.max(b[1], b[3]) - malla.s) / malla.res - 0.5) + 1);
    for (let j = j0; j <= j1; j++) porFila[j].push(b);
  }
  for (let j = 0; j < filas; j++) {
    const lat = malla.s + (j + 0.5) * malla.res;
    const xs = [];
    for (const [x1, y1, x2, y2] of porFila[j]) {
      if (y1 <= lat !== y2 <= lat) xs.push(x1 + ((lat - y1) * (x2 - x1)) / (y2 - y1));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const i0 = Math.ceil((xs[k] - malla.w) / malla.res - 0.5);
      const i1 = Math.floor((xs[k + 1] - malla.w) / malla.res - 0.5);
      for (let i = i0; i <= i1; i++) tierra[j * cols + col(i)] = 1;
    }
  }
  for (const [x1, y1, x2, y2] of bordes) {
    const pasos = Math.max(1, Math.ceil((Math.hypot(x2 - x1, y2 - y1) / malla.res) * 3));
    for (let p = 0; p <= pasos; p++) {
      const i = Math.floor((x1 + ((x2 - x1) * p) / pasos - malla.w) / malla.res);
      const j = Math.floor((y1 + ((y2 - y1) * p) / pasos - malla.s) / malla.res);
      if (j >= 0 && j < filas) tierra[j * cols + col(i)] = 1;
    }
  }
  return { tierra, cols, filas, malla, col };
}

/** Min-heap of cell ids by cost, on typed arrays. */
function monticulo(capacidad) {
  let costes = new Float64Array(capacidad);
  let ids = new Int32Array(capacidad);
  let n = 0;
  return {
    get size() {
      return n;
    },
    push(c, id) {
      if (n === costes.length) {
        const nc = new Float64Array(n * 2);
        nc.set(costes);
        costes = nc;
        const ni = new Int32Array(n * 2);
        ni.set(ids);
        ids = ni;
      }
      let i = n++;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (costes[p] <= c) break;
        costes[i] = costes[p];
        ids[i] = ids[p];
        i = p;
      }
      costes[i] = c;
      ids[i] = id;
    },
    pop() {
      const top = ids[0];
      const topCoste = costes[0];
      const c = costes[--n];
      const id = ids[n];
      let i = 0;
      for (;;) {
        let h = 2 * i + 1;
        if (h >= n) break;
        if (h + 1 < n && costes[h + 1] < costes[h]) h++;
        if (costes[h] >= c) break;
        costes[i] = costes[h];
        ids[i] = ids[h];
        i = h;
      }
      costes[i] = c;
      ids[i] = id;
      return [topCoste, top];
    },
  };
}

// ---- the crossings ------------------------------------------------------------------------

/**
 * One crossing per gateway, gateway → far port. `puertas` are the gateways as
 * in src/lib/domain/datos/puertas.json. Returns the crossings (turning points,
 * longitudes in [−180, 180]) and the audit.
 */
export function travesias(poligonos, puertas) {
  const g = rasterizar(poligonos, MUNDO);
  const { tierra, cols, filas, col } = g;
  const N = cols * filas;
  const celda = ([lon, lat]) => {
    const j = Math.floor((lat - MUNDO.s) / MUNDO.res);
    if (j < 0 || j >= filas) return -1;
    return j * cols + col(Math.floor((lon - MUNDO.w) / MUNDO.res));
  };
  const centro = (c) => [MUNDO.w + ((c % cols) + 0.5) * MUNDO.res, MUNDO.s + (Math.floor(c / cols) + 0.5) * MUNDO.res];

  /** The 8 neighbours of a cell, columns wrapping, no cutting a corner of land on a diagonal. */
  const vecinos = (c, f) => {
    const i = c % cols;
    const j = (c / cols) | 0;
    for (let dj = -1; dj <= 1; dj++) {
      const jj = j + dj;
      if (jj < 0 || jj >= filas) continue;
      for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ii = col(i + di);
        const n = jj * cols + ii;
        if (tierra[n]) continue;
        if (di && dj && (tierra[j * cols + ii] || tierra[jj * cols + i])) continue;
        f(n, di, dj, j);
      }
    }
  };

  // Distance to land in cells, capped: it feeds the coastal penalty and the clearance.
  const MAXD = OLGURA_CELDAS + 2;
  const dist = new Uint8Array(N).fill(255);
  let cola = [];
  for (let c = 0; c < N; c++) {
    if (tierra[c]) {
      dist[c] = 0;
      cola.push(c);
    }
  }
  for (let d = 1; d <= MAXD && cola.length; d++) {
    const sig = [];
    for (const c of cola) {
      const i = c % cols;
      const j = (c / cols) | 0;
      for (let dj = -1; dj <= 1; dj++) {
        const jj = j + dj;
        if (jj < 0 || jj >= filas) continue;
        for (let di = -1; di <= 1; di++) {
          const n = jj * cols + col(i + di);
          if (dist[n] === 255) {
            dist[n] = d;
            sig.push(n);
          }
        }
      }
    }
    cola = sig;
  }

  // The open ocean: water reachable from the mid-Pacific. Lakes and sealed-off
  // bays at this scale are left out, so no endpoint can land in one.
  const abierto = new Uint8Array(N);
  {
    const pila = [celda([-140, 20])];
    abierto[pila[0]] = 1;
    while (pila.length) {
      vecinos(pila.pop(), (n) => {
        if (abierto[n]) return;
        abierto[n] = 1;
        pila.push(n);
      });
    }
  }

  /** Nearest cell of open ocean to a point. */
  const entrada = (p, clave) => {
    const c0 = celda(p);
    const i0 = c0 % cols;
    const j0 = (c0 / cols) | 0;
    for (let r = 0; r < 40; r++) {
      let mejor = -1;
      let mejorD = Infinity;
      for (let j = Math.max(0, j0 - r); j <= Math.min(filas - 1, j0 + r); j++) {
        for (let di = -r; di <= r; di++) {
          const c = j * cols + col(i0 + di);
          if (!abierto[c]) continue;
          const d = kmGC(p, centro(c));
          if (d < mejorD) {
            mejorD = d;
            mejor = c;
          }
        }
      }
      if (mejor >= 0) return mejor;
    }
    throw new Error(`Sin mar abierto cerca de ${clave}`);
  };

  const cellH = MUNDO.res * 110.57;
  const cellW = new Float64Array(filas);
  for (let j = 0; j < filas; j++) cellW[j] = MUNDO.res * 111.32 * Math.cos((MUNDO.s + (j + 0.5) * MUNDO.res) * D2R);
  const factor = (c) => 1 + PENALIZACION_COSTA * Math.max(0, OLGURA_CELDAS - dist[c]);

  /**
   * Whether the great circle from `a` to `b` stays on water with `holgura`
   * cells of clearance: sampled every third of a cell along the arc.
   */
  const despejado = (a, b, holgura) => {
    const pasos = Math.max(1, Math.ceil(kmGC(a, b) / (cellH / 3)));
    for (let s = 1; s < pasos; s++) {
      const c = celda(interpolar(a, b, s / pasos));
      if (c < 0 || tierra[c] || dist[c] < holgura) return false;
    }
    return true;
  };

  const costeTotal = new Float64Array(N);
  const previo = new Int32Array(N);
  const salida = [];
  for (const p of puertas) {
    const desde = [p.lon, p.lat];
    const hasta = [p.haciaLon, p.haciaLat];
    const origen = entrada(desde, `puerta:${p.id}`);
    const destino = entrada(hasta, p.hacia);

    costeTotal.fill(Infinity);
    previo.fill(-1);
    costeTotal[origen] = 0;
    const heap = monticulo(1 << 20);
    heap.push(0, origen);
    let exploradas = 0;
    while (heap.size) {
      const [c0, c] = heap.pop();
      if (c0 > costeTotal[c]) continue;
      exploradas++;
      if (c === destino) break;
      vecinos(c, (n, di, dj, j) => {
        const nc = c0 + Math.hypot(di * cellW[j], dj * cellH) * factor(n);
        if (nc < costeTotal[n]) {
          costeTotal[n] = nc;
          previo[n] = c;
          heap.push(nc, n);
        }
      });
    }
    if (previo[destino] === -1) throw new Error(`Sin ruta por mar: puerta:${p.id} → ${p.hacia}`);

    const camino = [];
    for (let c = destino; c !== -1; c = previo[c]) camino.push(c);
    camino.reverse();
    // Cell centres with longitudes carried on continuously through the antimeridian.
    const pts = camino.map(centro);
    for (let k = 1; k < pts.length; k++) pts[k][0] += 360 * Math.round((pts[k - 1][0] - pts[k][0]) / 360);

    // Straighten: from each kept cell, the farthest cell along the path its
    // great circle still reaches with clearance (relaxed near the ends, where
    // the lane has to come in to the coast).
    const quedan = [0];
    let a = 0;
    while (a < pts.length - 1) {
      let b = a + 1;
      while (b + 1 < pts.length) {
        const holgura = Math.min(2, dist[camino[a]], dist[camino[b + 1]]);
        if (!despejado(pts[a], pts[b + 1], holgura)) break;
        b++;
      }
      quedan.push(b);
      a = b;
    }
    const coords = quedan.map((k) => pts[k]);
    // The exact ends: the gateway and the far port, at the longitude the lane
    // reached them. A point in its own entry cell replaces that cell's centre
    // instead of adding a stub a few hundred metres long.
    const juntar = (q, ref) => [q[0] + 360 * Math.round((ref[0] - q[0]) / 360), q[1]];
    if (celda(desde) === origen) coords[0] = juntar(desde, coords[0]);
    else coords.unshift(juntar(desde, coords[0]));
    if (celda(hasta) === destino) coords[coords.length - 1] = juntar(hasta, coords.at(-1));
    else coords.push(juntar(hasta, coords.at(-1)));

    let km = 0;
    for (let k = 1; k < coords.length; k++) km += kmGC(coords[k - 1], coords[k]);
    salida.push({
      puerta: `puerta:${p.id}`,
      hacia: p.hacia,
      km: Math.round(km * 10) / 10,
      coords: coords.flatMap(([lon, lat]) => [Math.round(normalizar(lon) * 1e4) / 1e4, Math.round(lat * 1e4) / 1e4]),
      exploradas,
      celdasCamino: camino.length,
    });
  }

  // ---- audit: does a crossing touch land? -------------------------------------------------
  // Every kilometre of every arc, against the exact 50m polygons. Exempt: the
  // last EXENTO_KM into the far port.
  const fallas = [];
  for (const t of salida) {
    const pts = [];
    for (let k = 0; k < t.coords.length; k += 2) pts.push([t.coords[k], t.coords[k + 1]]);
    let recorrido = 0;
    let muestras = 0;
    let donde = null;
    for (let k = 1; k < pts.length; k++) {
      const largo = kmGC(pts[k - 1], pts[k]);
      const pasos = Math.max(1, Math.ceil(largo));
      for (let s = 0; s < pasos; s++) {
        const aqui = recorrido + (largo * s) / pasos;
        if (aqui < EXENTO_KM || aqui > t.km - EXENTO_KM) continue;
        const q = interpolar(pts[k - 1], pts[k], s / pasos);
        if (enTierra(poligonos, q)) {
          muestras++;
          donde ??= q;
        }
      }
      recorrido += largo;
    }
    if (muestras) fallas.push({ ruta: `${t.puerta} → ${t.hacia}`, muestras, donde });
  }

  return { travesias: salida, reporte: { celdas: N, fallas } };
}
