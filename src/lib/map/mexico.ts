import { feature, merge, mesh } from 'topojson-client';
import type { FeatureCollection, MultiLineString, MultiPolygon, Polygon } from 'geojson';
import type { GeometryCollection, Topology } from 'topojson-specification';
import ISLAS from '$lib/domain/datos/islas.json';

/**
 * The geography of the board, built by `npm run datos` from Natural Earth 10m
 * into one TopoJSON (`static/data/mexico.topo.json`). Estados and the
 * neighbouring countries share arcs, so a border is one line no matter how many
 * layers touch it — that is what lets the meshes below tell a coast from a land
 * border. (The rail network is not here: it's a graph, loaded by the
 * simulation from `red-ferroviaria.json`.)
 *
 * Same rule as the world map: polygons are for filling, the `MultiLineString`
 * meshes are for stroking.
 */

export type EstadoProps = {
  clave: string;
  nombre: string;
  abrev: string;
  /** Label point from Natural Earth: inside the state even when it's oddly shaped. */
  lon: number;
  lat: number;
};

/** `pais` is the ISO 3166-1 alpha-3 code (USA, GTM, BLZ…). */
export type VecinoProps = { pais: string; nombre: string };

/**
 * A named island: one of the polygons of an estado that is not its mainland,
 * matched by its centre to the list in `datos/islas.json` (names from
 * OpenStreetMap, checked against these polygons by `scripts/islas/gen-islas.mjs`).
 * `estado` is the estado the island belongs to, which is not always the one
 * whose polygon Natural Earth put it in (San Esteban is Sonora's, Montague is
 * Baja California's).
 */
export type IslaProps = { nombre: string; estado: string; km2: number };

export type MexicoGeometry = {
  estados: FeatureCollection<Polygon | MultiPolygon, EstadoProps>;
  /** The named islands, each as its own polygon, for the tooltip. */
  islas: FeatureCollection<Polygon, IslaProps>;
  /** The whole country as one shape: highlight in the world views, hit-test for "is this Mexico". */
  pais: MultiPolygon;
  /** Mexico's sea coast only (no land borders). */
  costa: MultiLineString;
  /** Mexico's land borders with the US, Guatemala and Belize. */
  frontera: MultiLineString;
  /** Borders between estados (each drawn once). */
  limites: MultiLineString;
  vecinos: FeatureCollection<Polygon | MultiPolygon, VecinoProps>;
  /** Coasts of the neighbours (their land borders with Mexico excluded). */
  vecinosCosta: MultiLineString;
  /** Borders between two neighbours. */
  vecinosLimites: MultiLineString;
};

const D2R = Math.PI / 180;
const kmEntre = (a: [number, number], b: [number, number]) =>
  6371 * Math.hypot((b[0] - a[0]) * D2R * Math.cos(((a[1] + b[1]) / 2) * D2R), (b[1] - a[1]) * D2R);

/** Planar area in km² and mean vertex of a ring: enough to tell the mainland from the islands and to match centres. */
function medir(ring: number[][]): { km2: number; centro: [number, number] } {
  let s = 0;
  for (let i = 0; i < ring.length - 1; i++) s += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  const lon = ring.reduce((a, p) => a + p[0], 0) / ring.length;
  const lat = ring.reduce((a, p) => a + p[1], 0) / ring.length;
  return { km2: Math.abs(s / 2) * 111.32 * 110.57 * Math.cos(lat * D2R), centro: [lon, lat] };
}

/** A named island's centre must sit this close to its polygon's: the list was checked at this tolerance. */
const TOLERANCIA_KM = 15;

/**
 * Every polygon of an estado but its biggest is an island; those whose centre
 * the list knows get its name. Each island takes the closest name within the
 * tolerance; a name is used once.
 */
function islasDe(estados: MexicoGeometry['estados']): MexicoGeometry['islas'] {
  const libres = new Set(ISLAS.islas);
  const features: MexicoGeometry['islas']['features'] = [];
  for (const f of estados.features) {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    const medidos = polys.map((p) => ({ p, ...medir(p[0]) })).sort((a, b) => b.km2 - a.km2);
    for (const m of medidos.slice(1)) {
      let mejor: (typeof ISLAS.islas)[number] | null = null;
      let mejorKm = TOLERANCIA_KM;
      for (const i of libres) {
        const d = kmEntre(m.centro, i.centro as [number, number]);
        if (d < mejorKm) (mejor = i), (mejorKm = d);
      }
      if (!mejor) continue;
      libres.delete(mejor);
      features.push({
        type: 'Feature',
        properties: { nombre: mejor.nombre, estado: mejor.estado, km2: Math.round(m.km2) },
        geometry: { type: 'Polygon', coordinates: m.p },
      });
    }
  }
  return { type: 'FeatureCollection', features };
}

let cache: Promise<MexicoGeometry> | null = null;

export function loadMexico(): Promise<MexicoGeometry> {
  if (cache) return cache;
  const pending = (async (): Promise<MexicoGeometry> => {
    const res = await fetch('/data/mexico.topo.json');
    if (!res.ok) throw new Error(`No se pudo cargar la geografía de México: ${res.status}`);
    const topo = (await res.json()) as Topology;

    const estadosObj = topo.objects.estados as GeometryCollection<EstadoProps>;
    const vecinosObj = topo.objects.vecinos as GeometryCollection<VecinoProps>;

    // One collection holding both estados and neighbours: an arc used by a
    // single geometry of it is a coast; an arc shared by an estado and a
    // neighbour is an international border.
    const isEstado = new Set(estadosObj.geometries);
    const todo = {
      type: 'GeometryCollection',
      geometries: [...estadosObj.geometries, ...vecinosObj.geometries],
    } as GeometryCollection;

    const estados = feature(topo, estadosObj) as unknown as MexicoGeometry['estados'];
    return {
      estados,
      islas: islasDe(estados),
      pais: merge(topo, estadosObj.geometries as never),
      costa: mesh(topo, todo, (a, b) => a === b && isEstado.has(a as never)),
      frontera: mesh(topo, todo, (a, b) => isEstado.has(a as never) !== isEstado.has(b as never)),
      limites: mesh(topo, estadosObj, (a, b) => a !== b),
      vecinos: feature(topo, vecinosObj) as unknown as MexicoGeometry['vecinos'],
      vecinosCosta: mesh(topo, todo, (a, b) => a === b && !isEstado.has(a as never)),
      vecinosLimites: mesh(topo, vecinosObj, (a, b) => a !== b),
    };
  })();
  pending.catch(() => {
    cache = null;
  });
  cache = pending;
  return pending;
}
