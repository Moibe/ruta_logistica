/**
 * The drawing of a polo's close-up (`static/data/polos/<id>.json`, from
 * `scripts/polos/gen-interior.mjs`): metres east (x) and north (y) of the
 * polo's centre. Only the view reads it, so it's fetched, not bundled.
 */

export type Pt = [number, number];
type Linea = { puntos: Pt[] };

export type Lote = { tipo: 'empresa' | 'servicios' | 'reserva'; empresa?: string; ha: number; puntos: Pt[] };

export type GeoInterior = {
  id: string;
  centro: { lon: number; lat: number };
  caja: { x0: number; x1: number; y0: number; y1: number };
  /** The land: one ring per piece of the declaratoria (named when there are several). */
  piezas: { nombre: string | null; ha: number; puntos: Pt[] }[];
  /**
   * Rights of way the declaratoria leaves out of the land (a highway, a track), that cross it (a
   * pipeline's easement) or that are part of it (an access road, a reserve without lots), and
   * parcels it doesn't explain.
   */
  franjas: { nombre: string; tipo: 'carretera' | 'via' | 'ducto' | 'linea' | 'parcela' | 'reserva'; ha: number; nota: string; puntos: Pt[] }[];
  areaM2: number;
  perimetroM: number;
  lotes: Lote[];
  /** Each piece's main road, the services' piece first: the order they're built in. */
  vialidades: Pt[][];
  ejes: [Pt, Pt][];
  servicios: { centro: Pt; subestacion: Pt; tanque: Pt };
  /** From the polo's boundary (first point) to the main track (second). */
  espuela: {
    puntos: [Pt, Pt];
    km: number;
    via: string;
    operador: string;
    /** When the track isn't in service in OpenStreetMap: 'construction', 'abandoned'. */
    estado?: string;
    /** A nearer line the spur can't go to (San Jerónimo's, across the border). */
    masCercana?: { via: string; operador: string; km: number };
  };
  /** From the substation (first point) to the high-voltage line (second). */
  conexionElectrica: { puntos: [Pt, Pt]; km: number; kv: string };
  /** The highway the polo faces (its OpenStreetMap ref), for its label. */
  carretera: string | null;
  caminos: (Linea & { tipo: string; nombre?: string; ref?: string })[];
  vias: (Linea & { estado: string; nombre?: string; operador?: string; servicio?: string })[];
  lineas: (Linea & { kv: string })[];
  subestaciones: { nombre: string; operador: string; kv: string; x: number; y: number }[];
  suelo: (Linea & { uso: string; nombre?: string })[];
  agua: (Linea & { tipo: string })[];
  lugares: { nombre: string; tipo: string; x: number; y: number }[];
  edificios: { nombre: string; tipo: string; x: number; y: number }[];
  /** The international border, for a polo by it, and the other country's name. */
  frontera?: { con: string; lineas: Pt[][]; rotulo: { texto: string; x: number; y: number } };
};

export async function cargarInterior(id: string): Promise<GeoInterior> {
  const res = await fetch(`/data/polos/${id}.json`);
  if (!res.ok) throw new Error(`polo ${id}: HTTP ${res.status}`);
  return (await res.json()) as GeoInterior;
}

/** The point a share `t` (0–1) of the way along a polyline. */
export function alongLinea(puntos: Pt[], t: number): Pt {
  const largos = puntos.slice(1).map((p, i) => Math.hypot(p[0] - puntos[i][0], p[1] - puntos[i][1]));
  let resta = Math.max(0, Math.min(1, t)) * largos.reduce((s, l) => s + l, 0);
  for (let i = 0; i < largos.length; i++) {
    if (resta <= largos[i] || i === largos.length - 1) {
      const u = largos[i] > 0 ? Math.min(1, resta / largos[i]) : 0;
      return [puntos[i][0] + u * (puntos[i + 1][0] - puntos[i][0]), puntos[i][1] + u * (puntos[i + 1][1] - puntos[i][1])];
    }
    resta -= largos[i];
  }
  return puntos[puntos.length - 1];
}

/**
 * Work that runs along several lines one after another (the roads of a polo's
 * pieces), a share `t` (0–1) done: the stretch built on each line and where
 * the work is now.
 */
export function recorrido(lineas: [Pt, Pt][], t: number): { hechos: [Pt, Pt][]; punta: Pt } {
  const largos = lineas.map(([a, b]) => Math.hypot(b[0] - a[0], b[1] - a[1]));
  let resta = Math.max(0, Math.min(1, t)) * largos.reduce((s, l) => s + l, 0);
  const hechos: [Pt, Pt][] = [];
  let punta = lineas[0][0];
  for (const [i, l] of lineas.entries()) {
    if (resta <= 0) break;
    const u = largos[i] > 0 ? Math.min(1, resta / largos[i]) : 1;
    punta = alongLinea(l, u);
    hechos.push([l[0], punta]);
    resta -= largos[i];
  }
  return { hechos, punta };
}

/** A line `d` metres to the left of the segment a→b. */
export function paralela([a, b]: [Pt, Pt], d: number): [Pt, Pt] {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l = Math.hypot(dx, dy) || 1;
  const nx = (-dy / l) * d;
  const ny = (dx / l) * d;
  return [
    [a[0] + nx, a[1] + ny],
    [b[0] + nx, b[1] + ny],
  ];
}
