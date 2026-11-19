import { BufferAttribute, BufferGeometry, CanvasTexture } from 'three';
import { toVector3, type LonLat } from '$lib/domain/geo';
import type { MultiLineString, MultiPolygon, Polygon, Position } from 'geojson';

/**
 * GeoJSON → sphere-surface line geometry. The globe view needs no projection at
 * all: a [lon, lat] is just a point on a sphere, so the same coastline data the
 * canvas map projects flat is lifted verbatim onto the mesh, and the two views
 * cannot disagree about where a coast is.
 *
 * Everything comes back as `LineSegments` (disjoint pairs) rather than a
 * `Line`, because a coastline is many disconnected rings and a single strip
 * would draw a stray chord from the end of one ring to the start of the next.
 */
export function ringsToSegments(rings: Position[][], radius: number): BufferGeometry {
  const positions: number[] = [];
  for (const ring of rings) {
    for (let i = 0; i < ring.length - 1; i++) {
      positions.push(...toVector3(ring[i] as LonLat, radius));
      positions.push(...toVector3(ring[i + 1] as LonLat, radius));
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  return geometry;
}

/** A coastline or border mesh (`WorldGeometry.coastline` / `.borders`) on the sphere. */
export function lineOutlines(geometry: MultiLineString, radius: number): BufferGeometry {
  return ringsToSegments(geometry.coordinates, radius);
}

/**
 * A dot-matrix fill of a (multi)polygon on the sphere: one point every `step`
 * degrees of arc, rows offset by half a step so the dots sit in a hex pattern.
 *
 * Filling a polygon with triangles on a sphere needs subdividing them (a
 * triangle spanning a country cuts a chord deep below the surface and the
 * ocean hides it); dots sidestep that and read as a highlight in the clean
 * style. Built by scanline — each row intersects the rings once and fills
 * between crossings (even-odd) — instead of a point-in-polygon test per dot,
 * which on a 10m outline is two orders of magnitude slower. Planar in lon/lat,
 * fine for a country that doesn't straddle the antimeridian.
 */
export function dotGrid(shape: Polygon | MultiPolygon, step: number, radius: number): BufferGeometry {
  const rings: Position[][] = shape.type === 'Polygon' ? shape.coordinates : shape.coordinates.flat();
  let south = Infinity;
  let north = -Infinity;
  for (const ring of rings) {
    for (const [, lat] of ring) {
      south = Math.min(south, lat);
      north = Math.max(north, lat);
    }
  }

  const positions: number[] = [];
  let row = 0;
  for (let lat = Math.ceil(south / step) * step; lat <= north; lat += step, row++) {
    const crossings: number[] = [];
    for (const ring of rings) {
      for (let i = 0; i < ring.length - 1; i++) {
        const [ax, ay] = ring[i];
        const [bx, by] = ring[i + 1];
        if (ay <= lat !== by <= lat) crossings.push(ax + ((lat - ay) * (bx - ax)) / (by - ay));
      }
    }
    crossings.sort((a, b) => a - b);
    // Keep the arc between dots constant: a degree of longitude shrinks with cos(lat).
    const lonStep = step / Math.cos((lat * Math.PI) / 180);
    const shift = row % 2 ? lonStep / 2 : 0;
    for (let i = 0; i + 1 < crossings.length; i += 2) {
      const from = Math.ceil((crossings[i] - shift) / lonStep) * lonStep + shift;
      for (let lon = from; lon <= crossings[i + 1]; lon += lonStep) {
        positions.push(...toVector3([lon, lat], radius));
      }
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  return geometry;
}

/**
 * A white disc for `PointsMaterial.map`: three draws points as squares, which
 * shows as soon as the camera gets close enough for a dot to be a few pixels.
 * Browser-only (it needs a canvas); the globe route doesn't server-render.
 */
export function roundDot(size = 64): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  return new CanvasTexture(canvas);
}

/** A field of background stars on a large shell, as a point cloud. */
export function starField(count: number, radius: number): BufferGeometry {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    // Uniform on the sphere: z uniform in [-1,1], angle uniform in [0, 2π).
    const z = Math.random() * 2 - 1;
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(1 - z * z);
    const d = radius * (0.85 + Math.random() * 0.3);
    positions[i * 3] = d * r * Math.cos(a);
    positions[i * 3 + 1] = d * z;
    positions[i * 3 + 2] = d * r * Math.sin(a);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  return geometry;
}
