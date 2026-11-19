import { feature, merge, mesh } from 'topojson-client';
import type { FeatureCollection, MultiLineString, MultiPolygon, Polygon, Position } from 'geojson';
import type { GeometryCollection, Topology } from 'topojson-specification';

/**
 * The geography of the board, built by `npm run datos` from Natural Earth 10m
 * into one TopoJSON (`static/data/mexico.topo.json`). Estados, vías and the
 * neighbouring countries share arcs, so a border is one line no matter how many
 * layers touch it — that is what lets the meshes below tell a coast from a land
 * border.
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

export type ViaProps = {
  /** Natural Earth scalerank: lower is a more important line. */
  rango: number;
  doble: 0 | 1;
};

/** `pais` is the ISO 3166-1 alpha-3 code (USA, GTM, BLZ…). */
export type VecinoProps = { pais: string; nombre: string };

export type MexicoGeometry = {
  estados: FeatureCollection<Polygon | MultiPolygon, EstadoProps>;
  /** The whole country as one shape: highlight in the world views, hit-test for "is this Mexico". */
  pais: MultiPolygon;
  /** Mexico's sea coast only (no land borders). */
  costa: MultiLineString;
  /** Mexico's land borders with the US, Guatemala and Belize. */
  frontera: MultiLineString;
  /** Borders between estados (each drawn once). */
  limites: MultiLineString;
  /** Trunk lines (Natural Earth scalerank ≤ 6) and the rest, so they can be weighted differently. */
  viasTroncales: MultiLineString;
  viasRamales: MultiLineString;
  vecinos: FeatureCollection<Polygon | MultiPolygon, VecinoProps>;
  /** Coasts of the neighbours (their land borders with Mexico excluded). */
  vecinosCosta: MultiLineString;
  /** Borders between two neighbours. */
  vecinosLimites: MultiLineString;
};

const TRONCAL_MAX_RANGO = 6;

let cache: Promise<MexicoGeometry> | null = null;

export function loadMexico(): Promise<MexicoGeometry> {
  if (cache) return cache;
  const pending = (async (): Promise<MexicoGeometry> => {
    const res = await fetch('/data/mexico.topo.json');
    if (!res.ok) throw new Error(`No se pudo cargar la geografía de México: ${res.status}`);
    const topo = (await res.json()) as Topology;

    const estadosObj = topo.objects.estados as GeometryCollection<EstadoProps>;
    const viasObj = topo.objects.vias as GeometryCollection<ViaProps>;
    const vecinosObj = topo.objects.vecinos as GeometryCollection<VecinoProps>;

    // One collection holding both estados and neighbours: an arc used by a
    // single geometry of it is a coast; an arc shared by an estado and a
    // neighbour is an international border.
    const isEstado = new Set(estadosObj.geometries);
    const todo = {
      type: 'GeometryCollection',
      geometries: [...estadosObj.geometries, ...vecinosObj.geometries],
    } as GeometryCollection;

    const rango = (g: (typeof viasObj.geometries)[number]) => (g.properties as ViaProps).rango;
    const troncales = { ...viasObj, geometries: viasObj.geometries.filter((g) => rango(g) <= TRONCAL_MAX_RANGO) };
    const ramales = { ...viasObj, geometries: viasObj.geometries.filter((g) => rango(g) > TRONCAL_MAX_RANGO) };

    return {
      estados: feature(topo, estadosObj) as unknown as MexicoGeometry['estados'],
      pais: merge(topo, estadosObj.geometries as never),
      costa: mesh(topo, todo, (a, b) => a === b && isEstado.has(a as never)),
      frontera: mesh(topo, todo, (a, b) => isEstado.has(a as never) !== isEstado.has(b as never)),
      limites: mesh(topo, estadosObj, (a, b) => a !== b),
      viasTroncales: lines(mesh(topo, troncales as GeometryCollection)),
      viasRamales: lines(mesh(topo, ramales as GeometryCollection)),
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

/** `mesh()` of an empty collection comes back with no coordinates; normalise to a stroke-able value. */
function lines(m: MultiLineString): MultiLineString {
  return { type: 'MultiLineString', coordinates: (m.coordinates ?? []) as Position[][] };
}
