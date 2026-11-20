<script lang="ts">
  import { geoConicConformal, geoGraticule, geoPath } from 'd3-geo';
  import type { GeoPath, GeoProjection } from 'd3-geo';
  import { select } from 'd3-selection';
  import { zoom as d3zoom, zoomIdentity, type ZoomTransform } from 'd3-zoom';
  import type { MultiLineString, MultiPoint } from 'geojson';
  import { untrack } from 'svelte';
  import type { LonLat } from '$lib/domain/geo';
  import { CLASES_BARCO, fueraDelMapa } from '$lib/domain/barcos';
  import { kmTravesia } from '$lib/domain/mar';
  import { CAPACIDAD, DUEÑOS, type Dueño } from '$lib/domain/red';
  import { factorVelocidad, nivelUso, type NivelUso } from '$lib/domain/saturacion';
  import { esperaTotal, piernasDelRecorrido, posicionEnTablero, trayectoActual } from '$lib/domain/servicio';
  import {
    CIUDAD_DEL_PUERTO,
    CIUDADES,
    POLOS,
    PROGRAMAS_POLO,
    PUERTAS,
    PUERTO_DE_LA_CIUDAD,
    PUERTOS,
    type Ciudad,
    type Polo,
    type Puerta,
    type Puerto,
  } from '$lib/domain/sitios';
  import { seccion, tramoEnTablero, type Trayecto } from '$lib/domain/trayecto';
  import { LARGO_TREN_KM, type Tren } from '$lib/domain/trenes';
  import type { Barco } from '$lib/domain/barcos';
  import { sim, type Unidad } from '$lib/state/simulacion.svelte';
  import { tablero } from '$lib/state/tablero.svelte';
  import { duracion, estadoUnidad, km as fmtKm } from '$lib/ui/formato';
  import { loadMexico, type EstadoProps, type MexicoGeometry } from './mexico';

  /**
   * The game board: Mexico alone, in detail, with the trains and ships running
   * on it.
   *
   * Same machinery as the world canvas (geometry baked once into `Path2D` in
   * un-zoomed projected space, the d3-zoom transform applied to the context),
   * split in layers now that things move:
   *
   * - the **fondo** — geography, track, sites, labels, the selected vehicle's
   *   route — is painted into an offscreen canvas only when it changes (camera,
   *   layers, hover, selection, picking stops);
   * - every frame copies the fondo and draws the vehicles and the route
   *   preview on top. A still camera with the clock running costs one
   *   `drawImage` plus the vehicles.
   *
   * Colour carries meaning: sea things are cyan (`--accent`) — each ship gets
   * its own cool tint — rail things are amber (`--warn`) — each train its own
   * warm tint — cities are ink, and the Polos del Bienestar, still to be built
   * by the player, are rose (`POLO`) and dashed.
   */

  // ---- constants ---------------------------------------------------------

  /** The Polos del Bienestar's colour: a light guinda, the programme's own hue made to read on the dark sea. */
  const POLO = '#f472b6';
  const POLO_CLARO = '#ffe4f1';

  /**
   * Track coloured by who runs it. The State's own railways are ink-white —
   * they are the player's; the concessionaires each get a hue of their own,
   * none of them the sea's cyan or the polos' rose.
   */
  const COLOR_DUEÑO: Record<Dueño, string> = {
    FXE: '#f59e0b',
    KCSM: '#a78bfa',
    FSRR: '#4ade80',
    LCD: '#f87171',
    FTVM: '#94a3b8',
    FIT: '#f4f1de',
    ADMICARGA: '#f4f1de',
  };
  const COLOR_SIN_DUEÑO = '#64748b';
  /** Track coloured by use: room to spare, busy (trains slow down), over capacity. */
  const COLOR_USO: Record<NivelUso, string> = { holgada: '#4ade80', cargada: '#fbbf24', saturada: '#f87171' };
  /** Track out of service since before 2018: there, but dead. */
  const VIA_MUERTA = 'rgba(138, 164, 194, 0.3)';

  type ModoVias = 'clase' | 'dueño' | 'uso';
  const MODOS_VIAS: { id: ModoVias; label: string }[] = [
    { id: 'clase', label: 'Clase' },
    { id: 'dueño', label: 'Dueño' },
    { id: 'uso', label: 'Uso' },
  ];

  /**
   * INEGI's Lambert conformal conic for the whole country (standard parallels
   * 17.5° and 29.5°, central meridian 102° W). Conformal keeps local shapes
   * true, so a port's bay and a state's outline look like they do on every
   * official Mexican map.
   */
  function makeProjection(): GeoProjection {
    return geoConicConformal().parallels([17.5, 29.5]).rotate([102, 0]);
  }

  /**
   * What "the whole country" means for framing: the extremes of the mainland
   * plus Cabo San Lucas. Fixed points rather than the data, so the first frame
   * is right before the TopoJSON arrives and remote islands (Guadalupe,
   * Revillagigedo) don't push Mexico into a corner.
   */
  const FRAME: MultiPoint = {
    type: 'MultiPoint',
    coordinates: [
      [-117.12, 32.53],
      [-114.72, 32.72],
      [-97.14, 25.96],
      [-86.71, 21.14],
      [-92.21, 14.53],
      [-109.9, 22.87],
    ],
  };

  /**
   * Where the camera may roam. Kept well inside the box the neighbours were
   * clipped to in `npm run datos` (-134…-64, 0…46): a clipped polygon has a
   * straight cut along that box and it must never come into view.
   */
  const REGION = { w: -127, e: -77, s: 7, n: 37 };

  const MAX_ZOOM = 40;
  const FLY_MS = 900;
  /** From this zoom the rail lines get crossties. */
  const TIES_AT = 4;
  /** From this zoom (or while picking stops) stations show on the track. */
  const ESTACIONES_AT = 3.5;
  /** Below this zoom estados are labelled by abbreviation. */
  const FULL_NAMES_AT = 2.4;
  /**
   * Room the left column (clock + roster) takes, so the country is framed to
   * its right. Below the breakpoint the panels hide and the map uses it all.
   */
  const PANEL_IZQ = 290;
  const PANELES_DESDE = 900;
  /** A train is never drawn shorter than this, or it would be a dot at country scale. */
  const TREN_MIN_PX = 18;
  /** Glowing wake behind a moving train, in screen px so it reads at any zoom. */
  const ESTELA_PX = 46;
  /** A ship's wake: longer and fainter than a train's, it's a slower, bigger thing. */
  const ESTELA_BARCO_PX = 70;
  /** Hull drawn on screen: a fixed icon size (a real 300 m hull is a few px even at 40×). */
  const CASCO_PX = 13;
  /** How far the camera can slide before the geography layer is repainted. */
  const MARGEN = 256;

  const SEAS: { text: string; at: LonLat; size: number; along?: [LonLat, LonLat] }[] = [
    { text: 'OCÉANO PACÍFICO', at: [-107.5, 16.6], size: 13 },
    { text: 'GOLFO DE MÉXICO', at: [-92.6, 24.4], size: 13 },
    { text: 'MAR CARIBE', at: [-84.3, 18.2], size: 12 },
    // Rotated along the gulf's axis, measured in screen space at draw time.
    { text: 'GOLFO DE CALIFORNIA', at: [-110.9, 26.75], size: 9, along: [[-113.6, 30.2], [-108.6, 23.6]] },
  ];

  const COUNTRIES: { text: string; at: LonLat; minK: number }[] = [
    // In Texas, not along the top edge: up there it hides under the nav bar.
    { text: 'ESTADOS UNIDOS', at: [-100.3, 31.3], minK: 1 },
    { text: 'GUATEMALA', at: [-90.35, 15.45], minK: 1.4 },
    { text: 'BELICE', at: [-88.72, 17.15], minK: 2.6 },
    { text: 'HONDURAS', at: [-86.9, 14.85], minK: 1.4 },
    { text: 'CUBA', at: [-80.6, 22.15], minK: 1 },
    // Down the isthmus, where ships go coast to coast.
    { text: 'NICARAGUA', at: [-85.0, 12.9], minK: 1.4 },
    { text: 'COSTA RICA', at: [-84.15, 10.05], minK: 1.8 },
    { text: 'PANAMÁ', at: [-80.4, 8.45], minK: 1.4 },
    { text: 'COLOMBIA', at: [-75.6, 8.0], minK: 1.4 },
  ];

  // ---- state --------------------------------------------------------------

  type Layers = { estados: boolean; vias: boolean; puertos: boolean; ciudades: boolean; polos: boolean };
  let layers = $state<Layers>({ estados: true, vias: true, puertos: true, ciudades: true, polos: true });
  /** What the track's colour says: its class (the default), its owner, or how full it is. */
  let modoVias = $state<ModoVias>('clase');

  type Target =
    | { kind: 'unidad'; unidad: Unidad }
    | { kind: 'puerta'; puerta: Puerta }
    | { kind: 'puerto'; puerto: Puerto }
    | { kind: 'ciudad'; ciudad: Ciudad }
    | { kind: 'polo'; polo: Polo }
    | { kind: 'via'; base: number }
    | { kind: 'estado'; estado: EstadoProps };

  let host = $state.raw<HTMLDivElement>();
  let canvas = $state.raw<HTMLCanvasElement>();
  let transform = $state.raw<ZoomTransform>(zoomIdentity);
  let hovered = $state.raw<Target | null>(null);
  let pointer = $state({ x: 0, y: 0 });
  let innerWidth = $state(0);
  let status = $state<'cargando' | 'listo' | 'error'>('cargando');

  // Plain locals: read only when painting, rebuilt imperatively.
  let width = 0;
  let height = 0;
  let dpr = 1;
  let projection: GeoProjection | null = null;
  let path: GeoPath | null = null;
  let geo: MexicoGeometry | null = null;
  let zoomBehaviour: ReturnType<typeof d3zoom<HTMLCanvasElement, unknown>> | null = null;
  let frame = 0;

  /** The offscreen layer and whether it must be repainted before the next frame. */
  let fondo: HTMLCanvasElement | null = null;
  let fondoSucio = true;
  /**
   * Geography + track, painted MARGEN px beyond the view on every side, and
   * the camera it was painted for. While the zoom holds and the camera stays
   * within the margin (a drag, a followed train) the fondo reuses it, slid —
   * the coast's glow alone costs more than everything else in the fondo.
   */
  let capa: HTMLCanvasElement | null = null;
  let capaVista: { k: number; x: number; y: number } | null = null;
  let capaSucia = true;

  type Baked = {
    graticule: Path2D;
    vecinos: Path2D;
    vecinosCosta: Path2D;
    vecinosLimites: Path2D;
    pais: Path2D;
    costa: Path2D;
    frontera: Path2D;
    limites: Path2D;
    estados: { props: EstadoProps; path: Path2D; bounds: [[number, number], [number, number]] }[];
  };
  let baked: Baked | null = null;
  /** The graticule alone, so the first frame isn't empty while the TopoJSON loads. */
  let graticuleOnly: Path2D | null = null;
  /** Track, by class; baked from the simulation's network. */
  let viaPrimaria: Path2D | null = null;
  let viaSecundaria: Path2D | null = null;
  /** Each line of the network (`Via.base`), for colouring by owner or use and for hovering. */
  let viaPaths: { path: Path2D; bounds: [[number, number], [number, number]]; primaria: boolean; operando: boolean }[] = [];
  /** Track out of service, drawn dimmed in every mode. */
  let viaMuerta: Path2D | null = null;
  /** The selected vehicle's route (one direction of a line, a ship's whole loop), baked on selection. */
  let rutaSel: { id: string; path: Path2D } | null = null;
  /** The Panama Canal, baked from the sea lanes' data. */
  let canalPath: Path2D | null = null;

  /** Projected (un-zoomed path space) positions, rebuilt with the projection. */
  let ciudadPts: [number, number][] = [];
  let puertoPts: [number, number][] = [];
  let puertaPts: [number, number][] = [];
  let poloPts: [number, number][] = [];
  /** Station on the track and the site it serves, both in path space. */
  let estacionPts: { clave: string; via: [number, number]; sitio: [number, number]; km: number }[] = [];
  /** Where each vehicle's head was drawn last frame, for hit-testing. */
  let cabezas: { unidad: Unidad; x: number; y: number }[] = [];

  const estadoNombre = new Map<string, string>();

  // A detached context for `isPointInPath`, so hit-testing never touches the
  // transform or state of the ones we paint with.
  let hitCtx: CanvasRenderingContext2D | null = null;

  const ensucia = () => {
    fondoSucio = true;
    requestDraw();
  };

  /** Something in the geography layer itself changed (not just the camera). */
  const ensuciaCapa = () => {
    capaSucia = true;
    ensucia();
  };

  // ---- projection & baking -------------------------------------------------

  function rebuild() {
    if (!width || !height) return;
    projection = makeProjection();
    // Room for the nav bar on top, the tool strips below, and the clock and
    // roster on the left when they're showing.
    const izq = width >= PANELES_DESDE ? PANEL_IZQ : 28;
    projection.fitExtent(
      [
        [izq, 88],
        [width - 28, height - 76],
      ],
      FRAME
    );
    path = geoPath(projection);
    ciudadPts = CIUDADES.map((c) => projection!(c.lonLat) ?? [NaN, NaN]);
    puertoPts = PUERTOS.map((p) => projection!(p.lonLat) ?? [NaN, NaN]);
    puertaPts = PUERTAS.map((p) => projection!(p.lonLat) ?? [NaN, NaN]);
    poloPts = POLOS.map((p) => projection!(p.lonLat) ?? [NaN, NaN]);
    applyTranslateExtent();
    bake();
    bakeRed();
    rutaSel = null;
    fondoSucio = true;
    capaSucia = true;
  }

  function regionBounds(): [[number, number], [number, number]] | null {
    if (!path) return null;
    // A densified ring, as a LineString: a lon/lat box is curved in a conic
    // projection, and a line has no winding order to get wrong.
    const { w, e, s, n } = REGION;
    const ring: LonLat[] = [];
    for (let x = w; x <= e; x += 1) ring.push([x, s]);
    for (let y = s; y <= n; y += 1) ring.push([e, y]);
    for (let x = e; x >= w; x -= 1) ring.push([x, n]);
    for (let y = n; y >= s; y -= 1) ring.push([w, y]);
    return path.bounds({ type: 'LineString', coordinates: ring });
  }

  function applyTranslateExtent() {
    const b = regionBounds();
    if (zoomBehaviour && b) zoomBehaviour.translateExtent(b);
  }

  function bake() {
    if (!path) return;
    const p = path;
    const graticule = new Path2D(
      p(
        geoGraticule()
          .extent([
            [-135, 0],
            [-60, 50],
          ])
          .step([5, 5])()
      ) ?? ''
    );
    if (!geo) {
      baked = null;
      graticuleOnly = graticule;
      return;
    }
    const g = geo;
    const P = (x: Parameters<GeoPath>[0]) => new Path2D(p(x) ?? '');
    baked = {
      graticule,
      vecinos: P(g.vecinos),
      vecinosCosta: P(g.vecinosCosta),
      vecinosLimites: P(g.vecinosLimites),
      pais: P(g.pais),
      costa: P(g.costa),
      frontera: P(g.frontera),
      limites: P(g.limites),
      estados: g.estados.features.map((f) => ({ props: f.properties, path: P(f), bounds: p.bounds(f) })),
    };
  }

  function bakeRed() {
    const red = sim.red;
    if (!path || !projection || !red) return;
    const lineas = (clase: 'primaria' | 'secundaria'): MultiLineString => ({
      type: 'MultiLineString',
      coordinates: red.tramos.filter((t) => t.operando && t.clase === clase).map((t) => t.puntos),
    });
    viaPrimaria = new Path2D(path(lineas('primaria')) ?? '');
    viaSecundaria = new Path2D(path(lineas('secundaria')) ?? '');
    viaMuerta = new Path2D(
      path({ type: 'MultiLineString', coordinates: red.tramos.filter((t) => !t.operando).map((t) => t.puntos) }) ?? ''
    );
    const piezas = red.vias.map(() => [] as LonLat[][]);
    for (const t of red.tramos) piezas[t.base].push(t.puntos);
    viaPaths = red.vias.map((v, i) => {
      const g: MultiLineString = { type: 'MultiLineString', coordinates: piezas[i] };
      const primera = red.tramos[i];
      return { path: new Path2D(path!(g) ?? ''), bounds: path!.bounds(g), primaria: primera.clase === 'primaria', operando: v.operando };
    });
    estacionPts = [];
    for (const e of red.estaciones.values()) {
      const s = sitioLonLat(e.sitio);
      const v = projection(red.nodos[e.nodo]);
      const q = s ? projection(s) : null;
      if (v && q) estacionPts.push({ clave: e.sitio, via: v, sitio: q, km: e.distanciaKm });
    }
    const mar = sim.mar;
    canalPath = mar ? new Path2D(path({ type: 'LineString', coordinates: mar.canalPanama }) ?? '') : null;
  }

  function sitioLonLat(clave: string): LonLat | null {
    const [tipo, id] = clave.split(':');
    if (tipo === 'puerto') return PUERTOS.find((p) => p.id === id)?.lonLat ?? null;
    if (tipo === 'puerta') return PUERTAS.find((p) => p.id === id)?.lonLat ?? null;
    if (tipo === 'polo') return POLOS.find((p) => p.id === id)?.lonLat ?? null;
    return CIUDADES.find((c) => c.id === id)?.lonLat ?? null;
  }

  function bakeRutaSel(u: Unidad) {
    if (!path) return;
    const piernas = piernasDelRecorrido(u);
    rutaSel = {
      id: u.id,
      // The board's stretch of each leg: an ocean crossing belongs to the world views.
      path: new Path2D(path({ type: 'MultiLineString', coordinates: piernas.map(tramoEnTablero) }) ?? ''),
    };
  }

  // ---- camera -------------------------------------------------------------

  function setTransform(next: ZoomTransform) {
    if (!canvas || !zoomBehaviour) return;
    // d3 enforces scaleExtent on gestures only; a programmatic transform (a
    // flight, a followed train) is clamped here, keeping the same centre.
    const k = Math.max(1, Math.min(MAX_ZOOM, next.k));
    if (k !== next.k) {
      const cx = (width / 2 - next.x) / next.k;
      const cy = (height / 2 - next.y) / next.k;
      next = zoomIdentity.translate(width / 2 - k * cx, height / 2 - k * cy).scale(k);
    }
    next = zoomBehaviour.constrain()(
      next,
      [
        [0, 0],
        [width, height],
      ],
      zoomBehaviour.translateExtent()
    );
    select(canvas).call(zoomBehaviour.transform, next);
  }

  function viewCentre(): LonLat | null {
    if (!projection?.invert || !width) return null;
    return projection.invert([transform.invertX(width / 2), transform.invertY(height / 2)]) as LonLat | null;
  }

  function lookAt(lonLat: LonLat | null, k: number) {
    const p = lonLat && projection ? projection(lonLat) : null;
    setTransform(p ? zoomIdentity.translate(width / 2 - k * p[0], height / 2 - k * p[1]).scale(k) : transform);
  }

  type Fly = { from: [number, number, number]; to: [number, number, number]; start: number };
  let fly: Fly | null = null;

  /** Animate the camera to put path-space point (cx, cy) at the middle at zoom k. */
  function flyTo(cx: number, cy: number, k: number) {
    fly = {
      from: [transform.invertX(width / 2), transform.invertY(height / 2), transform.k],
      to: [cx, cy, Math.min(MAX_ZOOM, Math.max(1, k))],
      start: performance.now(),
    };
    requestDraw();
  }

  function flyToBounds([[x0, y0], [x1, y1]]: [[number, number], [number, number]]) {
    const k = 0.78 / Math.max((x1 - x0) / width, (y1 - y0) / (height - 160));
    flyTo((x0 + x1) / 2, (y0 + y1) / 2, k);
  }

  function flyToUnidad(u: Unidad) {
    // A ship on an ocean crossing: the gateway it went through.
    const p = projection?.(posicionEnTablero(u));
    // Ships sail open water: a train-sized close-up would show nothing but sea.
    if (p) flyTo(p[0], p[1], Math.max(transform.k, u.tipo === 'barco' ? 3 : 5));
  }

  function stepCamera(now: number) {
    if (!fly) return;
    // Clamped at 0 too: a rAF timestamp is the frame's start, which can be
    // earlier than the performance.now() the flight was stamped with. A
    // negative step, run through the geometric zoom below, zooms *out*.
    const u = Math.max(0, Math.min(1, (now - fly.start) / FLY_MS));
    const e = 1 - (1 - u) ** 3;
    const [fx, fy, fk] = fly.from;
    let [tx, ty, tk] = fly.to;
    // A train keeps moving while the camera flies to it: aim at where it is now.
    if (sim.siguiendo && sim.seleccionado) {
      const p = projection?.(posicionEnTablero(sim.seleccionado));
      if (p) [tx, ty] = p;
    }
    // Zoom interpolates geometrically: a linear ramp from 1× to 20× spends
    // almost the whole flight already zoomed in, which reads as a lurch.
    const k = Math.exp(Math.log(fk) + (Math.log(tk) - Math.log(fk)) * e);
    const cx = fx + (tx - fx) * e;
    const cy = fy + (ty - fy) * e;
    if (u >= 1) fly = null;
    setTransform(zoomIdentity.translate(width / 2 - k * cx, height / 2 - k * cy).scale(k));
  }

  /**
   * Keep the followed train or ship centred (after any flight has landed). A
   * ship that sails out through a gateway leaves the camera waiting there, and
   * comes back into it.
   */
  function follow() {
    if (fly || !sim.siguiendo) return;
    const t = sim.seleccionado;
    const p = t ? projection?.(posicionEnTablero(t)) : null;
    if (!p) return;
    const k = transform.k;
    setTransform(zoomIdentity.translate(width / 2 - k * p[0], height / 2 - k * p[1]).scale(k));
  }

  function resetView() {
    // The framing transform is the identity: `rebuild` fits Mexico at k = 1.
    if (!width) return;
    sim.siguiendo = false;
    flyTo(width / 2, height / 2, 1);
  }

  // ---- frame loop -------------------------------------------------------------

  /** Something on screen is moving and needs the next frame too. */
  const animando = () =>
    !!fly ||
    (sim.corriendo && (sim.trenes.length > 0 || sim.barcos.length > 0 || [...sim.obras.values()].some((o) => o.fase !== 'por-construir'))) ||
    tablero.trazando ||
    sim.siguiendo;

  function requestDraw() {
    if (frame) return;
    frame = requestAnimationFrame((now) => {
      frame = 0;
      stepCamera(now);
      follow();
      draw(now);
      if (animando()) requestDraw();
    });
  }

  function draw(now: number) {
    const ctx = canvas?.getContext('2d');
    if (!ctx || !projection || !fondo) return;
    if (fondoSucio) {
      const f = fondo.getContext('2d');
      if (f) pintarFondo(f);
      fondoSucio = false;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas!.width, canvas!.height);
    ctx.drawImage(fondo, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    pintarPrevia(ctx, now);
    pintarObras(ctx);
    pintarUnidades(ctx, now);
  }

  // ---- labels -------------------------------------------------------------------

  type Spot = { x: number; y: number; align: CanvasTextAlign };
  type Label = {
    text: string;
    spots: Spot[];
    size: number;
    font: string;
    color: string;
    priority: number;
    spacing?: number;
    angle?: number;
    halo?: boolean;
  };
  type Box = [number, number, number, number];

  const overlaps = (a: Box, b: Box) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];

  /**
   * Greedy collision placement (logistica-oceanica's, with candidate spots):
   * labels go in priority order, each takes the first of its spots that is on
   * screen and free, or is dropped. `taken` arrives pre-filled with the site
   * symbols so no label ever covers a dot.
   */
  function placeLabels(ctx: CanvasRenderingContext2D, labels: Label[], taken: Box[]) {
    labels.sort((a, b) => b.priority - a.priority);
    for (const label of labels) {
      ctx.font = label.font;
      ctx.letterSpacing = `${label.spacing ?? 0}px`;
      const w = ctx.measureText(label.text).width;
      const h = label.size;
      for (const spot of label.spots) {
        const x0 = spot.align === 'left' ? spot.x : spot.align === 'right' ? spot.x - w : spot.x - w / 2;
        let box: Box = [x0 - 2, spot.y - h, x0 + w + 2, spot.y + h * 0.3];
        if (label.angle) {
          // Axis-aligned bounds of the rotated text, centred on the spot.
          const c = Math.abs(Math.cos(label.angle));
          const s = Math.abs(Math.sin(label.angle));
          const hw = (w * c + h * s) / 2;
          const hh = (w * s + h * c) / 2;
          box = [spot.x - hw, spot.y - hh, spot.x + hw, spot.y + hh];
        }
        if (box[2] < 0 || box[0] > width || box[3] < 0 || box[1] > height) continue;
        if (taken.some((t) => overlaps(box, t))) continue;
        taken.push(box);
        ctx.textAlign = spot.align;
        if (label.angle) {
          ctx.save();
          ctx.translate(spot.x, spot.y);
          ctx.rotate(label.angle);
          ctx.textBaseline = 'middle';
          ctx.fillStyle = label.color;
          ctx.fillText(label.text, 0, 0);
          ctx.restore();
        } else {
          if (label.halo) {
            ctx.strokeStyle = 'rgba(3, 9, 18, 0.9)';
            ctx.lineWidth = 3;
            ctx.lineJoin = 'round';
            ctx.strokeText(label.text, spot.x, spot.y);
          }
          ctx.fillStyle = label.color;
          ctx.fillText(label.text, spot.x, spot.y);
        }
        break;
      }
    }
    ctx.letterSpacing = '0px';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  /** Screen radius of a city dot: grows with population, capped. */
  function cityRadius(c: Ciudad): number {
    if (c.capital === 'pais') return 4.2;
    return Math.min(3.6, 1.7 + Math.max(0, Math.log10(c.poblacion / 1e5)) * 1.1);
  }

  /** A flat-topped hexagon: the polos' symbol, an industrial lot rather than a town or a port. */
  function hexagono(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      const px = x + r * Math.cos(a);
      const py = y + r * Math.sin(a);
      if (i) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    }
    ctx.closePath();
  }

  const spotsAround = (x: number, y: number, r: number): Spot[] => [
    { x: x + r + 4, y: y + 4, align: 'left' },
    { x: x - r - 4, y: y + 4, align: 'right' },
    { x, y: y - r - 5, align: 'center' },
    { x, y: y + r + 13, align: 'center' },
  ];

  // ---- the fondo: everything that only changes when something happens -------------------

  /**
   * Geography and track, in zoomed path space, into the capa: an offscreen
   * canvas MARGEN px larger than the view on every side, painted transparent
   * where the sea is. The sea itself is screen-fixed and painted under it.
   */
  function pintarCapa(ctx: CanvasRenderingContext2D) {
    const k = transform.k;
    const b = baked;
    const trazando = tablero.trazando;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width + 2 * MARGEN, height + 2 * MARGEN);
    ctx.save();
    ctx.translate(transform.x + MARGEN, transform.y + MARGEN);
    ctx.scale(k, k);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    const graticule = b?.graticule ?? graticuleOnly;
    if (graticule) {
      ctx.strokeStyle = 'rgba(96, 160, 220, 0.08)';
      ctx.lineWidth = 0.5 / k;
      ctx.stroke(graticule);
    }

    if (b) {
      // Neighbours: present, but a step back from Mexico.
      ctx.fillStyle = '#0a1627';
      ctx.fill(b.vecinos);
      ctx.strokeStyle = 'rgba(120, 190, 255, 0.16)';
      ctx.lineWidth = 0.6 / k;
      ctx.stroke(b.vecinosCosta);
      ctx.strokeStyle = 'rgba(120, 190, 255, 0.07)';
      ctx.lineWidth = 0.5 / k;
      ctx.stroke(b.vecinosLimites);

      ctx.fillStyle = '#0e2035';
      ctx.fill(b.pais);

      const hoveredEstado = hovered?.kind === 'estado' ? hovered.estado.clave : null;
      const e = hoveredEstado ? b.estados.find((x) => x.props.clave === hoveredEstado) : null;
      if (e) {
        ctx.fillStyle = 'rgba(76, 201, 255, 0.07)';
        ctx.fill(e.path);
      }

      if (layers.estados) {
        ctx.strokeStyle = 'rgba(126, 190, 255, 0.2)';
        ctx.lineWidth = 0.6 / k;
        ctx.stroke(b.limites);
      }

      // International border: dashed, so it can never be mistaken for a coast.
      ctx.save();
      ctx.strokeStyle = 'rgba(233, 243, 255, 0.42)';
      ctx.lineWidth = 0.9 / k;
      ctx.setLineDash([5 / k, 3.5 / k]);
      ctx.stroke(b.frontera);
      ctx.restore();

      // Coast as a line of light: a wide faint halo, then a thin bright core,
      // both added onto what's below.
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(76, 201, 255, 0.09)';
      ctx.lineWidth = 4 / k;
      ctx.stroke(b.costa);
      ctx.strokeStyle = 'rgba(120, 205, 255, 0.62)';
      ctx.lineWidth = 0.85 / k;
      ctx.stroke(b.costa);
      ctx.restore();

      if (e) {
        ctx.strokeStyle = 'rgba(160, 220, 255, 0.55)';
        ctx.lineWidth = 1.1 / k;
        ctx.stroke(e.path);
      }
    }

    if (layers.vias && viaPrimaria && viaSecundaria) {
      if (k >= TIES_AT) {
        // Crossties: a wide stroke dashed into short bars, under the rail.
        ctx.save();
        ctx.lineCap = 'butt';
        ctx.strokeStyle = 'rgba(255, 209, 102, 0.32)';
        ctx.lineWidth = 3.6 / k;
        ctx.setLineDash([0.9 / k, 3.4 / k]);
        ctx.stroke(viaPrimaria);
        ctx.stroke(viaSecundaria);
        ctx.restore();
      }
      if (viaMuerta) {
        ctx.save();
        ctx.setLineDash([2.5 / k, 2.5 / k]);
        ctx.strokeStyle = VIA_MUERTA;
        ctx.lineWidth = 0.8 / k;
        ctx.stroke(viaMuerta);
        ctx.restore();
      }
      if (modoVias === 'clase') {
        ctx.strokeStyle = 'rgba(255, 209, 102, 0.36)';
        ctx.lineWidth = 0.8 / k;
        ctx.stroke(viaSecundaria);
        ctx.strokeStyle = 'rgba(255, 209, 102, 0.72)';
        ctx.lineWidth = 1.15 / k;
        ctx.stroke(viaPrimaria);
      } else if (sim.red) {
        // One stroke per line, in its owner's colour or its use's.
        sim.red.vias.forEach((v, i) => {
          const vp = viaPaths[i];
          if (!vp || !v.operando) return;
          ctx.strokeStyle =
            modoVias === 'dueño'
              ? v.dueño
                ? COLOR_DUEÑO[v.dueño]
                : COLOR_SIN_DUEÑO
              : COLOR_USO[nivelUso(sim.uso(i)?.uso ?? 0)];
          ctx.globalAlpha = vp.primaria ? 0.9 : 0.6;
          ctx.lineWidth = (vp.primaria ? 1.5 : 1) / k;
          ctx.stroke(vp.path);
        });
        ctx.globalAlpha = 1;
      }
    }

    // The Panama Canal: a cyan channel across the isthmus, the one place
    // where the sea crosses land.
    if (canalPath) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(76, 201, 255, 0.22)';
      ctx.lineWidth = 5 / k;
      ctx.stroke(canalPath);
      ctx.restore();
      ctx.strokeStyle = 'rgba(150, 220, 255, 0.9)';
      ctx.lineWidth = 1.3 / k;
      ctx.stroke(canalPath);
    }

    // The selected vehicle's route, in its colour: a train's line one way, a
    // ship's whole loop — dashed, sea lanes aren't track.
    const sel = sim.seleccionado;
    if (sel && !trazando) {
      if (rutaSel?.id !== sel.id) bakeRutaSel(sel);
      if (rutaSel) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = conAlfa(sel.color, 0.16);
        ctx.lineWidth = 7 / k;
        ctx.stroke(rutaSel.path);
        ctx.restore();
        ctx.save();
        if (sel.tipo === 'barco') ctx.setLineDash([6 / k, 4 / k]);
        ctx.strokeStyle = conAlfa(sel.color, 0.95);
        ctx.lineWidth = 1.8 / k;
        ctx.stroke(rutaSel.path);
        ctx.restore();
      }
    }
    ctx.restore();
    capaVista = { k, x: transform.x, y: transform.y };
    capaSucia = false;
  }

  /**
   * Repaint the capa only when it can't be reused: the zoom changed, the camera
   * slid past the margin, or something in it changed. A followed train or a
   * drag only slides the camera, so most frames reuse it.
   */
  function asegurarCapa() {
    if (!capa) return;
    const v = capaVista;
    const vale =
      !capaSucia &&
      v !== null &&
      v.k === transform.k &&
      Math.abs(transform.x - v.x) <= MARGEN &&
      Math.abs(transform.y - v.y) <= MARGEN;
    if (vale) return;
    const g = capa.getContext('2d');
    if (g) pintarCapa(g);
  }

  function pintarFondo(ctx: CanvasRenderingContext2D) {
    if (!projection) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const sea = ctx.createLinearGradient(0, 0, 0, height);
    sea.addColorStop(0, '#061225');
    sea.addColorStop(0.55, '#04101f');
    sea.addColorStop(1, '#020a14');
    ctx.fillStyle = sea;
    ctx.fillRect(0, 0, width, height);

    const k = transform.k;
    const b = baked;
    const trazando = tablero.trazando;

    // The capa, slid by however far the camera moved since it was painted.
    // Whole device pixels: a fractional offset would resample every hairline.
    asegurarCapa();
    if (capa && capaVista) {
      const dx = transform.x - capaVista.x;
      const dy = transform.y - capaVista.y;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(capa, Math.round((dx - MARGEN) * dpr), Math.round((dy - MARGEN) * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // The hovered rail line, lit along its whole length.
    if (hovered?.kind === 'via' && viaPaths[hovered.base]) {
      ctx.save();
      ctx.translate(transform.x, transform.y);
      ctx.scale(k, k);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
      ctx.lineWidth = 7 / k;
      ctx.stroke(viaPaths[hovered.base].path);
      ctx.strokeStyle = 'rgba(255, 244, 214, 0.95)';
      ctx.lineWidth = 1.8 / k;
      ctx.stroke(viaPaths[hovered.base].path);
      ctx.restore();
    }

    // ---- sites & labels, in screen space (crisp at any zoom) --------------
    const sx = (p: [number, number]) => transform.applyX(p[0]);
    const sy = (p: [number, number]) => transform.applyY(p[1]);
    const onScreen = (x: number, y: number) => x > -20 && x < width + 20 && y > -20 && y < height + 20;
    const conEstacion = (clave: string) => !!sim.red?.estaciones.has(clave);
    // Picking stops: what can't be a stop for this kind of vehicle fades back.
    const trazaTren = trazando && tablero.pestaña === 'tren';
    const trazaBarco = trazando && tablero.pestaña === 'barco';
    const atenuado = (clave: string) =>
      trazaTren ? !conEstacion(clave) : trazaBarco ? clave.startsWith('ciudad:') : false;

    // Stations: a small square on the track, tied to its site by a faint
    // dashed line when the track passes at a distance.
    if (layers.vias && sim.red && !trazaBarco && (k >= ESTACIONES_AT || trazaTren)) {
      ctx.save();
      for (const e of estacionPts) {
        const vx = sx(e.via);
        const vy = sy(e.via);
        if (!onScreen(vx, vy)) continue;
        const px = sx(e.sitio);
        const py = sy(e.sitio);
        if (Math.hypot(px - vx, py - vy) > 6) {
          ctx.setLineDash([2, 3]);
          ctx.strokeStyle = 'rgba(255, 209, 102, 0.4)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(vx, vy);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        ctx.fillStyle = '#ffd166';
        ctx.strokeStyle = 'rgba(3, 9, 18, 0.95)';
        ctx.lineWidth = 1.2;
        ctx.fillRect(vx - 2.5, vy - 2.5, 5, 5);
        ctx.strokeRect(vx - 2.5, vy - 2.5, 5, 5);
      }
      ctx.restore();
    }

    const taken: Box[] = [];
    const labels: Label[] = [];

    if (layers.ciudades) {
      CIUDADES.forEach((c, i) => {
        const x = sx(ciudadPts[i]);
        const y = sy(ciudadPts[i]);
        if (!onScreen(x, y)) return;
        const r = cityRadius(c);
        const hot = hovered?.kind === 'ciudad' && hovered.ciudad.id === c.id;
        ctx.globalAlpha = atenuado(`ciudad:${c.id}`) ? 0.3 : 1;
        if (c.capital) {
          // Capitals: a ring around a dot, the cartographic convention.
          ctx.beginPath();
          ctx.arc(x, y, r + 1.6, 0, Math.PI * 2);
          ctx.strokeStyle = hot ? '#ffffff' : 'rgba(233, 243, 255, 0.75)';
          ctx.lineWidth = c.capital === 'pais' ? 1.4 : 1;
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(x, y, c.capital ? r * 0.55 : r * 0.75, 0, Math.PI * 2);
        ctx.fillStyle = hot ? '#ffffff' : 'rgba(233, 243, 255, 0.88)';
        ctx.fill();
        ctx.globalAlpha = 1;
        const R = r + 2;
        taken.push([x - R, y - R, x + R, y + R]);
        // A port city is labelled once, by its port.
        if (layers.puertos && PUERTO_DE_LA_CIUDAD.has(c.id)) return;
        const big = c.capital === 'pais';
        labels.push({
          text: c.nombre,
          spots: spotsAround(x, y, R),
          size: big ? 12 : 11,
          font: `${big ? 700 : c.capital ? 600 : 500} ${big ? 12 : 11}px Inter, "Segoe UI", system-ui, sans-serif`,
          color: hot ? '#ffffff' : c.capital ? 'rgba(233, 243, 255, 0.92)' : 'rgba(200, 220, 240, 0.78)',
          priority: (hot ? 1e9 : 0) + (big ? 1e8 : 0) + c.poblacion / 10 + (c.capital ? 2e6 : 0),
          halo: true,
        });
      });
    }

    // Polos del Bienestar: a hexagon — dashed while it's an empty lot, solid
    // once work starts, filled once it operates (the moving layer adds the
    // progress and occupancy rings). Faded while picking stops, unless built
    // with a station and a train is being laid out.
    if (layers.polos) {
      POLOS.forEach((p, i) => {
        const x = sx(poloPts[i]);
        const y = sy(poloPts[i]);
        if (!onScreen(x, y)) return;
        const hot = (hovered?.kind === 'polo' && hovered.polo.id === p.id) || tablero.poloSel === p.id;
        const fase = sim.obras.get(p.id)?.fase ?? 'por-construir';
        const parada = trazaTren && conEstacion(`polo:${p.id}`);
        const r = hot ? 6.4 : 5.4;
        ctx.globalAlpha = trazando && !parada ? 0.3 : 1;
        hexagono(ctx, x, y, r);
        ctx.fillStyle =
          fase === 'operando'
            ? hot
              ? POLO_CLARO
              : POLO
            : hot
              ? 'rgba(244, 114, 182, 0.3)'
              : fase === 'en-obra'
                ? 'rgba(244, 114, 182, 0.22)'
                : 'rgba(244, 114, 182, 0.14)';
        ctx.fill();
        if (fase === 'por-construir') ctx.setLineDash([2.2, 1.6]);
        ctx.strokeStyle = fase === 'operando' ? 'rgba(3, 9, 18, 0.9)' : hot ? POLO_CLARO : POLO;
        ctx.lineWidth = fase === 'operando' ? 1.1 : 1.4;
        ctx.stroke();
        ctx.setLineDash([]);
        if (fase !== 'operando') {
          ctx.beginPath();
          ctx.arc(x, y, 1.5, 0, Math.PI * 2);
          ctx.fillStyle = hot ? POLO_CLARO : POLO;
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        const R = r + 2;
        taken.push([x - R, y - R, x + R, y + R]);
        if (trazando && !parada) return;
        labels.push({
          text: `Polo ${p.corto}`,
          spots: spotsAround(x, y, R),
          size: 10,
          font: '600 10px Inter, "Segoe UI", system-ui, sans-serif',
          color: hot ? '#ffffff' : 'rgba(249, 168, 212, 0.92)',
          // Under ports, capitals and big cities; over estados, seas and countries.
          priority: (hot ? 1e9 : 0) + 3e4 + p.hectareas,
          halo: true,
        });
      });
    }

    if (layers.puertos) {
      PUERTOS.forEach((p, i) => {
        const x = sx(puertoPts[i]);
        const y = sy(puertoPts[i]);
        if (!onScreen(x, y)) return;
        const hot = hovered?.kind === 'puerto' && hovered.puerto.id === p.id;
        const s = p.principal ? 5.2 : 3.8;
        ctx.globalAlpha = atenuado(`puerto:${p.id}`) ? 0.3 : 1;
        // Glow first, added on top of the coast so it blooms like a beacon.
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const glow = ctx.createRadialGradient(x, y, 0, x, y, s * 3.2);
        glow.addColorStop(0, hot ? 'rgba(76, 201, 255, 0.55)' : 'rgba(76, 201, 255, 0.32)');
        glow.addColorStop(1, 'rgba(76, 201, 255, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(x - s * 3.2, y - s * 3.2, s * 6.4, s * 6.4);
        ctx.restore();
        // A diamond: reads as "marker", not as "city".
        ctx.beginPath();
        ctx.moveTo(x, y - s);
        ctx.lineTo(x + s, y);
        ctx.lineTo(x, y + s);
        ctx.lineTo(x - s, y);
        ctx.closePath();
        ctx.fillStyle = hot ? '#d6f2ff' : '#4cc9ff';
        ctx.fill();
        ctx.strokeStyle = 'rgba(3, 9, 18, 0.9)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.globalAlpha = 1;
        const R = s + 2;
        taken.push([x - R, y - R, x + R, y + R]);
        labels.push({
          text: p.nombre,
          spots: spotsAround(x, y, R),
          size: 11,
          font: `${p.principal ? 700 : 600} 11px Inter, "Segoe UI", system-ui, sans-serif`,
          color: hot ? '#ffffff' : '#7fd8ff',
          // Ports outrank every city but the capital: on this board, a port is
          // where the action is.
          priority: (hot ? 1e9 : 0) + (p.principal ? 9e7 : 5e7),
          halo: true,
        });
      });
    }

    // Gateways to the world: a ring with an arrow pointing out of the board,
    // the way the ships leave.
    if (layers.puertos) {
      const centro = projection([-102, 23]);
      PUERTAS.forEach((p, i) => {
        const x = sx(puertaPts[i]);
        const y = sy(puertaPts[i]);
        if (!onScreen(x, y) || !centro) return;
        const hot = hovered?.kind === 'puerta' && hovered.puerta.id === p.id;
        ctx.globalAlpha = trazaTren ? 0.3 : 1;
        const ang = Math.atan2(y - transform.applyY(centro[1]), x - transform.applyX(centro[0]));
        ctx.save();
        ctx.translate(x, y);
        ctx.strokeStyle = hot ? '#ffffff' : 'rgba(127, 216, 255, 0.85)';
        ctx.lineWidth = 1.4;
        ctx.setLineDash([3, 2.5]);
        ctx.beginPath();
        ctx.arc(0, 0, 9, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.rotate(ang);
        ctx.fillStyle = hot ? '#ffffff' : '#7fd8ff';
        ctx.beginPath();
        ctx.moveTo(6, 0);
        ctx.lineTo(-3, -4.5);
        ctx.lineTo(-1, 0);
        ctx.lineTo(-3, 4.5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        ctx.globalAlpha = 1;
        taken.push([x - 11, y - 11, x + 11, y + 11]);
        labels.push({
          text: `Hacia ${p.nombre}`,
          spots: spotsAround(x, y, 11),
          size: 11,
          font: '600 11px Inter, "Segoe UI", system-ui, sans-serif',
          color: hot ? '#ffffff' : '#7fd8ff',
          priority: (hot ? 1e9 : 0) + 6e7,
          halo: true,
        });
      });
    }

    // Picking stops: the chosen ones numbered, the one under the cursor
    // ringed. A train's stop sits on the track (its station), a ship's on the
    // port itself.
    if (trazando) {
      const puntoDeParada = (clave: string): [number, number] | null => {
        if (trazaTren) {
          const e = estacionPts.find((x) => x.clave === clave);
          return e ? [sx(e.via), sy(e.via)] : null;
        }
        const ll = sitioLonLat(clave);
        const p = ll ? (projection?.(ll) ?? null) : null;
        return p ? [transform.applyX(p[0]), transform.applyY(p[1])] : null;
      };
      tablero.paradas.forEach((clave, i) => {
        const pos = puntoDeParada(clave);
        if (!pos) return;
        const [x, y] = pos;
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fillStyle = trazaBarco ? '#4cc9ff' : '#ffd166';
        ctx.fill();
        ctx.strokeStyle = 'rgba(3, 9, 18, 0.95)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = trazaBarco ? '#04121f' : '#1a1205';
        ctx.font = '700 10px Inter, "Segoe UI", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(i + 1), x, y + 0.5);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        taken.push([x - 9, y - 9, x + 9, y + 9]);
      });
      const cand = tablero.candidato ? puntoDeParada(tablero.candidato) : null;
      if (cand) {
        ctx.beginPath();
        ctx.arc(cand[0], cand[1], 9, 0, Math.PI * 2);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    // The canal's name, once the isthmus is big enough to carry it.
    if (canalPath && k >= 1.6) {
      const p = projection([-79.75, 9.15]);
      if (p) {
        labels.push({
          text: 'Canal de Panamá',
          spots: spotsAround(transform.applyX(p[0]), transform.applyY(p[1]), 6),
          size: 10,
          font: 'italic 600 10px Inter, "Segoe UI", system-ui, sans-serif',
          color: 'rgba(150, 220, 255, 0.8)',
          priority: 4e7,
          halo: true,
        });
      }
    }

    if (b && layers.estados) {
      const full = k >= FULL_NAMES_AT;
      for (const e of b.estados) {
        const p = projection([e.props.lon, e.props.lat]);
        if (!p) continue;
        const x = transform.applyX(p[0]);
        const y = transform.applyY(p[1]);
        labels.push({
          text: full ? e.props.nombre.toUpperCase() : e.props.abrev.toUpperCase(),
          spots: [{ x, y, align: 'center' }],
          size: 10,
          font: '600 10px Inter, "Segoe UI", system-ui, sans-serif',
          spacing: 1.6,
          color: 'rgba(138, 164, 194, 0.5)',
          priority: 1e3,
        });
      }
    }

    for (const sea of SEAS) {
      const p = projection(sea.at);
      if (!p) continue;
      let angle: number | undefined;
      if (sea.along) {
        const a = projection(sea.along[0]);
        const c = projection(sea.along[1]);
        if (a && c) angle = Math.atan2(c[1] - a[1], c[0] - a[0]);
      }
      labels.push({
        text: sea.text,
        spots: [{ x: transform.applyX(p[0]), y: transform.applyY(p[1]), align: 'center' }],
        size: sea.size,
        font: `italic 500 ${sea.size}px Inter, "Segoe UI", system-ui, sans-serif`,
        spacing: sea.size * 0.32,
        color: 'rgba(96, 165, 230, 0.34)',
        priority: 10,
        angle,
      });
    }

    for (const c of COUNTRIES) {
      if (k < c.minK) continue;
      const p = projection(c.at);
      if (!p) continue;
      labels.push({
        text: c.text,
        spots: [{ x: transform.applyX(p[0]), y: transform.applyY(p[1]), align: 'center' }],
        size: 11,
        font: '600 11px Inter, "Segoe UI", system-ui, sans-serif',
        spacing: 3,
        color: 'rgba(138, 164, 194, 0.32)',
        priority: 20,
      });
    }

    placeLabels(ctx, labels, taken);
  }

  // ---- the moving layer ----------------------------------------------------------------

  function aPantalla(p: LonLat): [number, number] | null {
    const q = projection?.(p);
    return q ? [transform.applyX(q[0]), transform.applyY(q[1])] : null;
  }

  function enPantalla(lonLats: LonLat[]): [number, number][] {
    const out: [number, number][] = [];
    for (const p of lonLats) {
      const q = aPantalla(p);
      if (q) out.push(q);
    }
    return out;
  }

  function trazar(ctx: CanvasRenderingContext2D, pts: [number, number][]) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  }

  /** The point `px` screen pixels back from the end of a screen polyline. */
  function atras(pts: [number, number][], px: number): [number, number] {
    let falta = px;
    for (let i = pts.length - 1; i > 0; i--) {
      const [x1, y1] = pts[i];
      const [x0, y0] = pts[i - 1];
      const d = Math.hypot(x1 - x0, y1 - y0);
      if (d >= falta && d > 0) return [x1 + ((x0 - x1) * falta) / d, y1 + ((y0 - y1) * falta) / d];
      falta -= d;
    }
    return pts[0];
  }

  function conAlfa(hex: string, a: number): string {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  }

  /** Screen px per km at the current zoom (the projection is conformal: near enough everywhere). */
  const pxPorKm = () => (transform.k * (projection?.scale() ?? 1)) / 6371;

  /**
   * Every vehicle on the board, ships first (they're under the coast's trains
   * in spirit, out at sea), the selected one last so it's on top. Records each
   * head for hit-testing; ships off the map on a crossing aren't drawn.
   */
  function pintarUnidades(ctx: CanvasRenderingContext2D, now: number) {
    cabezas = [];
    if (!projection) return;
    const pxKm = pxPorKm();
    const sel = (u: Unidad) => sim.seleccion === u.id;
    const orden = [...sim.barcos, ...sim.trenes].sort((a, b) => Number(sel(a)) - Number(sel(b)));
    for (const u of orden) {
      if (u.tipo === 'barco') pintarBarco(ctx, u, pxKm, now);
      else pintarTren(ctx, u, pxKm, now);
    }
  }

  /** The wake behind a moving vehicle: fades from nothing to its tail, added on like a light trail. */
  function pintarEstela(ctx: CanvasRenderingContext2D, u: Unidad, desdeKm: number, hastaKm: number, ancho: number, alfa: number) {
    const rastro = enPantalla(seccion(trayectoActual(u), desdeKm, hastaKm));
    if (rastro.length < 2) return;
    const [ax, ay] = rastro[0];
    const [bx, by] = rastro[rastro.length - 1];
    const g = ctx.createLinearGradient(ax, ay, bx, by);
    g.addColorStop(0, conAlfa(u.color, 0));
    g.addColorStop(1, conAlfa(u.color, alfa));
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = g;
    ctx.lineWidth = ancho;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    trazar(ctx, rastro);
    ctx.stroke();
    ctx.restore();
  }

  /** Stopped: a ring that fills up until departure. Selected: a slow pulse, findable at a glance. */
  function pintarAnillos(ctx: CanvasRenderingContext2D, u: Unidad, hx: number, hy: number, now: number, radio = 9) {
    if (u.estado === 'parada') {
      const total = esperaTotal(u);
      const hecho = total > 0 ? 1 - u.espera / total : 1;
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(hx, hy, radio, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = u.color;
      ctx.beginPath();
      ctx.arc(hx, hy, radio, -Math.PI / 2, -Math.PI / 2 + hecho * Math.PI * 2);
      ctx.stroke();
    }
    if (sim.seleccion === u.id) {
      const r = radio + 4 + Math.sin(now / 260) * 1.5;
      ctx.strokeStyle = conAlfa(u.color, 0.85);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(hx, hy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function pintarTren(ctx: CanvasRenderingContext2D, t: Tren, pxKm: number, now: number) {
    const largo = Math.max(LARGO_TREN_KM, TREN_MIN_PX / pxKm);
    const cuerpo = enPantalla(seccion(trayectoActual(t), t.km - largo, t.km));
    if (!cuerpo.length) return;
    const [hx, hy] = cuerpo[cuerpo.length - 1];
    cabezas.push({ unidad: t, x: hx, y: hy });
    if (hx < -80 || hx > width + 80 || hy < -80 || hy > height + 80) return;
    const sel = sim.seleccion === t.id;
    const hot = hovered?.kind === 'unidad' && hovered.unidad.id === t.id;
    ctx.lineJoin = 'round';

    if (t.estado === 'ruta') pintarEstela(ctx, t, t.km - largo - ESTELA_PX / pxKm, t.km - largo, 2.4, 0.55);

    // Body: a dark casing, then the cars as dashes along the track.
    if (cuerpo.length >= 2) {
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(3, 9, 18, 0.92)';
      ctx.lineWidth = sel || hot ? 7.5 : 6.5;
      trazar(ctx, cuerpo);
      ctx.stroke();
      ctx.save();
      ctx.lineCap = 'butt';
      ctx.setLineDash([4.2, 1.4]);
      ctx.strokeStyle = t.color;
      ctx.lineWidth = 3.8;
      trazar(ctx, cuerpo);
      ctx.stroke();
      ctx.restore();
      // Locomotive: the front few pixels, solid and bright.
      const [lx, ly] = atras(cuerpo, 6);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(hx, hy);
      ctx.stroke();
    }

    // Headlight.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(hx, hy, 0, hx, hy, 12);
    glow.addColorStop(0, conAlfa(t.color, sel || hot ? 0.7 : 0.45));
    glow.addColorStop(1, conAlfa(t.color, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(hx - 12, hy - 12, 24, 24);
    ctx.restore();

    pintarAnillos(ctx, t, hx, hy, now);
  }

  function pintarBarco(ctx: CanvasRenderingContext2D, b: Barco, pxKm: number, now: number) {
    if (fueraDelMapa(b)) return;
    const leg = trayectoActual(b);
    // Heading from a short stretch of lane behind the bow, measured on screen.
    const atrasKm = Math.max(0.5, 6 / pxKm);
    const tramo = enPantalla(seccion(leg, b.km - atrasKm, b.km));
    if (!tramo.length) return;
    const [hx, hy] = tramo[tramo.length - 1];
    cabezas.push({ unidad: b, x: hx, y: hy });
    if (hx < -80 || hx > width + 80 || hy < -80 || hy > height + 80) return;
    const [ax, ay] = tramo.length >= 2 ? tramo[0] : [hx - 1, hy];
    const rumbo = Math.atan2(hy - ay, hx - ax);
    const sel = sim.seleccion === b.id;
    const hot = hovered?.kind === 'unidad' && hovered.unidad.id === b.id;

    // Wake: a long, faint light trail on the water behind the stern.
    if (b.estado === 'ruta') {
      const popa = CASCO_PX / pxKm;
      pintarEstela(ctx, b, b.km - popa - ESTELA_BARCO_PX / pxKm, b.km - popa * 0.6, 3, 0.45);
    }

    // Glow on the water around the hull.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(hx, hy, 0, hx, hy, 14);
    glow.addColorStop(0, conAlfa(b.color, sel || hot ? 0.55 : 0.32));
    glow.addColorStop(1, conAlfa(b.color, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(hx - 14, hy - 14, 28, 28);
    ctx.restore();

    // Hull: pointed bow, square stern, a pale bridge block aft. The bow is the
    // vehicle's position, like a train's locomotive.
    // An icon, but one that grows a little as you zoom in (1× at country
    // scale, ~1.8× at the deepest zoom), so a followed ship isn't lost in its ring.
    const L = CASCO_PX * Math.min(1.8, 0.85 + 0.15 * Math.sqrt(transform.k)) * (sel || hot ? 1.15 : 1);
    const W = L * 0.4;
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(rumbo);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-L * 0.3, -W / 2);
    ctx.lineTo(-L, -W / 2);
    ctx.lineTo(-L, W / 2);
    ctx.lineTo(-L * 0.3, W / 2);
    ctx.closePath();
    ctx.fillStyle = b.color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(3, 9, 18, 0.92)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillRect(-L * 0.9, -W * 0.3, L * 0.18, W * 0.6);
    ctx.restore();

    pintarAnillos(ctx, b, hx - Math.cos(rumbo) * L * 0.5, hy - Math.sin(rumbo) * L * 0.5, now, Math.max(9, L * 0.62));
  }

  /**
   * The polos' living part, every frame: a ring that fills as the work
   * advances (red when it has stopped for lack of money), and, once
   * operating, one that fills with occupancy. A built polo no train reaches
   * gets a dashed grey ring: nobody moves in there yet.
   */
  function pintarObras(ctx: CanvasRenderingContext2D) {
    if (!layers.polos || !projection) return;
    POLOS.forEach((p, i) => {
      const o = sim.obras.get(p.id);
      if (!o || o.fase === 'por-construir') return;
      const x = transform.applyX(poloPts[i][0]);
      const y = transform.applyY(poloPts[i][1]);
      if (x < -20 || x > width + 20 || y < -20 || y > height + 20) return;
      const r = 9.5;
      const parte = o.fase === 'en-obra' ? o.avance : o.ocupacion;
      const aislado = o.fase === 'operando' && !sim.conectado(p.id);
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
      if (aislado) ctx.setLineDash([2, 2.5]);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      if (parte > 0) {
        ctx.strokeStyle = o.fase === 'en-obra' && o.detenida ? '#ff8a8a' : o.fase === 'en-obra' ? POLO : POLO_CLARO;
        ctx.beginPath();
        ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + parte * Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    });
  }

  /** While picking stops: the route so far, as marching dashes. */
  function pintarPrevia(ctx: CanvasRenderingContext2D, now: number) {
    if (!tablero.trazando || !tablero.previa.length) return;
    const mar = tablero.pestaña === 'barco';
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (const leg of tablero.previa as Trayecto[]) {
      const pts = enPantalla(tramoEnTablero(leg));
      if (pts.length < 2) continue;
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = mar ? 'rgba(76, 201, 255, 0.2)' : 'rgba(255, 209, 102, 0.18)';
      ctx.lineWidth = 8;
      trazar(ctx, pts);
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = mar ? '#dff6ff' : '#fff4d6';
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 6]);
      ctx.lineDashOffset = -now / 40;
      trazar(ctx, pts);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  // ---- hover & click ----------------------------------------------------------

  function targetAt(mx: number, my: number): Target | null {
    if (!projection) return null;
    let best: Target | null = null;
    let bestD = Infinity;
    // Vehicles first: they move over everything else.
    if (!tablero.trazando) {
      for (const c of cabezas) {
        const d = Math.hypot(c.x - mx, c.y - my);
        if (d < 12 && d < bestD) {
          best = { kind: 'unidad', unidad: c.unidad };
          bestD = d;
        }
      }
      if (best) return best;
    }
    // Sites next, nearest within a few pixels: they sit on top of estados.
    if (layers.puertos) {
      PUERTOS.forEach((p, i) => {
        const d = Math.hypot(transform.applyX(puertoPts[i][0]) - mx, transform.applyY(puertoPts[i][1]) - my);
        if (d < 10 && d < bestD) {
          best = { kind: 'puerto', puerto: p };
          bestD = d;
        }
      });
    }
    if (layers.puertos) {
      PUERTAS.forEach((p, i) => {
        const d = Math.hypot(transform.applyX(puertaPts[i][0]) - mx, transform.applyY(puertaPts[i][1]) - my);
        if (d < 12 && d < bestD) {
          best = { kind: 'puerta', puerta: p };
          bestD = d;
        }
      });
    }
    // Laying out a ship, cities aren't stops; skipping them also keeps a port
    // city's dot (a pixel off its port at country scale) from stealing the click.
    if (layers.ciudades && !(tablero.trazando && tablero.pestaña === 'barco')) {
      CIUDADES.forEach((c, i) => {
        const d = Math.hypot(transform.applyX(ciudadPts[i][0]) - mx, transform.applyY(ciudadPts[i][1]) - my);
        if (d < 8 && d < bestD) {
          best = { kind: 'ciudad', ciudad: c };
          bestD = d;
        }
      });
    }
    // A polo is never a stop: while picking stops it can't steal the click
    // from the port or station next to it.
    if (layers.polos) {
      POLOS.forEach((p, i) => {
        if (tablero.trazando && !(tablero.pestaña === 'tren' && sim.red?.estaciones.has(`polo:${p.id}`))) return;
        const d = Math.hypot(transform.applyX(poloPts[i][0]) - mx, transform.applyY(poloPts[i][1]) - my);
        if (d < 9 && d < bestD) {
          best = { kind: 'polo', polo: p };
          bestD = d;
        }
      });
    }
    if (best || tablero.trazando) return best;
    hitCtx ??= document.createElement('canvas').getContext('2d');
    if (!hitCtx) return null;
    // Identity transform + a point in path space = test against the un-zoomed path.
    const px = transform.invertX(mx);
    const py = transform.invertY(my);
    // A rail line under the pointer (within a few screen px of it).
    if (layers.vias && viaPaths.length) {
      const margen = 5 / transform.k;
      hitCtx.lineWidth = 2 * margen;
      for (let i = 0; i < viaPaths.length; i++) {
        const [[x0, y0], [x1, y1]] = viaPaths[i].bounds;
        if (px < x0 - margen || px > x1 + margen || py < y0 - margen || py > y1 + margen) continue;
        if (hitCtx.isPointInStroke(viaPaths[i].path, px, py)) return { kind: 'via', base: i };
      }
    }
    if (!baked) return null;
    for (const e of baked.estados) {
      const [[x0, y0], [x1, y1]] = e.bounds;
      if (px < x0 || px > x1 || py < y0 || py > y1) continue;
      if (hitCtx.isPointInPath(e.path, px, py)) return { kind: 'estado', estado: e.props };
    }
    return null;
  }

  const claveDe = (t: Target | null): string | null =>
    !t
      ? null
      : t.kind === 'unidad'
        ? `unidad:${t.unidad.id}`
        : t.kind === 'puerta'
          ? `puerta:${t.puerta.id}`
          : t.kind === 'puerto'
          ? `puerto:${t.puerto.id}`
          : t.kind === 'ciudad'
            ? `ciudad:${t.ciudad.id}`
            : t.kind === 'polo'
              ? `polo:${t.polo.id}`
              : t.kind === 'via'
                ? `via:${t.base}`
                : `estado:${t.estado.clave}`;

  /** The site key of a target, if it is a site. */
  const sitioDe = (t: Target | null): string | null =>
    t?.kind === 'puerto'
      ? `puerto:${t.puerto.id}`
      : t?.kind === 'ciudad'
        ? `ciudad:${t.ciudad.id}`
        : t?.kind === 'puerta'
          ? `puerta:${t.puerta.id}`
          : t?.kind === 'polo'
            ? `polo:${t.polo.id}`
            : null;

  function onPointerMove(event: PointerEvent) {
    if (!canvas || event.buttons) return; // no hover while dragging the map
    const rect = canvas.getBoundingClientRect();
    pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    const next = targetAt(pointer.x, pointer.y);
    if (claveDe(next) !== claveDe(hovered)) {
      // A hovered estado is lit in the geography layer; sites in the fondo;
      // vehicles only in the moving layer.
      const capaCambia = hovered?.kind === 'estado' || next?.kind === 'estado';
      const fondoCambia = hovered?.kind !== 'unidad' || next?.kind !== 'unidad';
      hovered = next;
      if (tablero.trazando) tablero.señalar(sitioDe(next));
      if (capaCambia) ensuciaCapa();
      else if (fondoCambia) ensucia();
      else requestDraw();
    }
  }

  function onPointerLeave() {
    if (!hovered) return;
    const eraEstado = hovered.kind === 'estado';
    hovered = null;
    if (tablero.trazando) tablero.señalar(null);
    if (eraEstado) ensuciaCapa();
    else ensucia();
  }

  function onClick(event: MouseEvent) {
    if (!canvas || !projection) return;
    const rect = canvas.getBoundingClientRect();
    const target = targetAt(event.clientX - rect.left, event.clientY - rect.top);

    if (tablero.trazando) {
      const clave = sitioDe(target);
      if (clave) tablero.elegir(clave);
      return;
    }
    if (!target) {
      sim.seleccionar(null);
      tablero.poloSel = null;
      return;
    }
    if (target.kind === 'unidad') {
      sim.seleccionar(target.unidad.id);
      return;
    }
    if (target.kind === 'polo') {
      sim.seleccionar(null);
      tablero.poloSel = target.polo.id;
    }
    // A rail line only shows its card on hover.
    if (target.kind === 'via') return;
    if (target.kind === 'estado') {
      const e = baked?.estados.find((x) => x.props.clave === target.estado.clave);
      if (e) flyToBounds(e.bounds);
      return;
    }
    const lonLat =
      target.kind === 'puerto'
        ? target.puerto.lonLat
        : target.kind === 'puerta'
          ? target.puerta.lonLat
          : target.kind === 'polo'
            ? target.polo.lonLat
            : target.ciudad.lonLat;
    const p = projection(lonLat);
    if (p) flyTo(p[0], p[1], Math.max(transform.k, target.kind === 'puerta' ? 3 : 9));
  }

  // ---- lifecycle --------------------------------------------------------------

  $effect(() => {
    if (!host || !canvas) return;
    fondo ??= document.createElement('canvas');
    capa ??= document.createElement('canvas');
    const observer = new ResizeObserver(() => {
      const first = !width;
      const centre = viewCentre();
      const rect = host!.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));
      for (const c of [canvas!, fondo!]) {
        c.width = Math.round(width * dpr);
        c.height = Math.round(height * dpr);
      }
      capa!.width = Math.round((width + 2 * MARGEN) * dpr);
      capa!.height = Math.round((height + 2 * MARGEN) * dpr);
      capaSucia = true;
      canvas!.style.width = `${width}px`;
      canvas!.style.height = `${height}px`;
      rebuild();
      if (!first) lookAt(centre, transform.k);
      // Paint now, inside the observer callback (before the browser paints):
      // resizing wipes the backing store, and a queued frame would flash empty.
      draw(performance.now());
    });
    observer.observe(host);
    return () => observer.disconnect();
  });

  $effect(() => {
    let cancelled = false;
    loadMexico()
      .then((g) => {
        if (cancelled) return;
        geo = g;
        for (const f of g.estados.features) estadoNombre.set(f.properties.clave, f.properties.nombre);
        status = 'listo';
        bake();
        ensuciaCapa();
      })
      .catch(() => {
        if (!cancelled) status = 'error';
      });
    return () => {
      cancelled = true;
    };
  });

  // The simulation: load the network and the opening fleet, run the clock
  // while the board is mounted.
  $effect(() => {
    sim.cargar();
  });
  $effect(() => sim.attach());

  $effect(() => {
    // Loaded, or rebuilt because a finished polo got its station.
    if (sim.estado !== 'lista') return;
    sim.versionRed;
    untrack(() => {
      bakeRed();
      ensuciaCapa();
    });
  });

  $effect(() => {
    // A work ordered, a polo's card opened or closed: the polos' symbols change.
    sim.obras;
    tablero.poloSel;
    ensucia();
  });

  $effect(() => {
    if (!canvas) return;
    zoomBehaviour = d3zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([1, MAX_ZOOM])
      // A drag takes the camera back from a flight or a followed train; the
      // wheel only cancels flights, so you can zoom in on a train you follow.
      .filter((event: Event) => {
        if (event.type === 'wheel' || event.type === 'mousedown' || event.type === 'touchstart') fly = null;
        if (event.type === 'mousedown' || event.type === 'touchstart') sim.siguiendo = false;
        return (!(event as MouseEvent).ctrlKey || event.type === 'wheel') && !(event as MouseEvent).button;
      })
      .on('zoom', (event) => {
        transform = event.transform;
        ensucia();
      });
    const selection = select(canvas);
    selection.call(zoomBehaviour);
    // Clicks fly to things; a double click would also fire two of those.
    selection.on('dblclick.zoom', null);
    applyTranslateExtent();
    return () => {
      selection.on('.zoom', null);
      zoomBehaviour = null;
    };
  });

  $effect(() => {
    // What's drawn in the geography layer: estado borders, track, the
    // selected train's route (hidden while picking stops).
    layers.estados;
    layers.vias;
    modoVias;
    sim.seleccion;
    tablero.trazando;
    ensuciaCapa();
  });

  $effect(() => {
    // The fleet changed: line use changed with it.
    sim.trenesPorVia;
    if (untrack(() => modoVias) === 'uso') ensuciaCapa();
  });

  $effect(() => {
    // What's drawn in the fondo over it: sites, stations, picked stops.
    layers.puertos;
    layers.ciudades;
    layers.polos;
    tablero.paradas;
    tablero.candidato;
    ensucia();
  });

  $effect(() => {
    // Anything that (re)starts motion: the clock, the fleet, following.
    sim.corriendo;
    const trenes = sim.trenes;
    const barcos = sim.barcos;
    sim.siguiendo;
    // A retired vehicle can't stay under the cursor.
    untrack(() => {
      if (hovered?.kind !== 'unidad') return;
      const u = hovered.unidad;
      if (!(u.tipo === 'tren' ? trenes.includes(u) : barcos.includes(u))) hovered = null;
    });
    requestDraw();
  });

  $effect(() => {
    // Camera requests from the panels. Untracked: flying reads the camera
    // transform, and tracking it would relaunch the flight on every frame of
    // the flight itself.
    const pedido = tablero.irA;
    if (!pedido) return;
    untrack(() => {
      const u = sim.unidades.find((x) => x.id === pedido.id);
      if (u) flyToUnidad(u);
    });
  });

  $effect(() => () => {
    if (frame) cancelAnimationFrame(frame);
    // Leaving the board mid-pick drops the half-built train or ship.
    tablero.cancelar();
  });

  // ---- tooltip text -------------------------------------------------------------

  const fmt = new Intl.NumberFormat('es-MX');
  function poblacion(n: number): string {
    return n >= 1e6
      ? `${(n / 1e6).toLocaleString('es-MX', { maximumFractionDigits: 1 })} M hab.`
      : `${fmt.format(Math.round(n / 1000))} mil hab.`;
  }

  /** The rail line under a site's card: whether a train can call there. */
  function servicio(clave: string): string {
    const red = sim.red;
    if (!red) return '';
    const e = red.estaciones.get(clave);
    if (e) return e.distanciaKm > 3 ? `Estación a ${Math.round(e.distanciaKm)} km` : 'Estación ferroviaria';
    const lejos = red.sinEstacion.get(clave);
    return lejos === undefined ? '' : `Sin vía férrea · a ${Math.round(lejos)} km`;
  }

  /** A polo's rail access, as its card says it: no station yet, only how far the track runs. */
  function viaDelPolo(p: Polo): string {
    const km = sim.red?.aLaVia.get(`polo:${p.id}`);
    if (km === undefined) return '';
    return km <= 2 ? 'Junto a la vía férrea' : `Vía férrea a ${Math.round(km)} km`;
  }

  /** The polo's phase as its card's kind line says it; reads the clock for the percentages. */
  function faseDelPolo(id: string): string {
    sim.horas;
    const o = sim.obras.get(id);
    if (!o || o.fase === 'por-construir') return 'por construir';
    if (o.fase === 'en-obra') return o.detenida ? `obra detenida al ${Math.round(o.avance * 100)} %` : `en obra, ${Math.round(o.avance * 100)} %`;
    return sim.conectado(id) ? `operando, ${Math.round(o.ocupacion * 100)} % ocupado` : 'construido, sin tren';
  }

  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const fechaLarga = (iso: string) => {
    const [a, m, d] = iso.split('-').map(Number);
    return `${d} de ${MESES[m - 1]} de ${a}`;
  };

  /** Live line for a hovered vehicle; reads the clock so it updates as it moves. */
  const lineaUnidad = $derived.by(() => {
    sim.horas;
    return hovered?.kind === 'unidad' ? estadoUnidad(hovered.unidad) : '';
  });

  /** While picking stops, what clicking the hovered site would do. */
  const lineaTrazado = $derived.by(() => {
    const clave = sitioDe(hovered);
    if (!tablero.trazando || !clave) return '';
    const problema = tablero.motivo(clave);
    if (problema) return problema;
    const n = tablero.paradas.length;
    const barco = tablero.pestaña === 'barco';
    if (!n) return barco ? 'Clic: primera escala del barco' : 'Clic: origen del tren';
    const que = barco ? 'escala' : 'parada';
    return `Clic: ${que} ${n + 1} · ${fmtKm(tablero.kmPrevia)} · ${duracion(tablero.horasPrevia)}${barco ? ' por vuelta' : ''}`;
  });

  const fmtTrenes = (n: number) => (n < 10 ? n.toFixed(1) : String(Math.round(n)));

  const kmDeVia = $derived.by(() => {
    if (sim.estado !== 'lista' || !sim.red) return 0;
    return Math.round(sim.red.tramos.reduce((s, t) => s + (t.operando ? t.km : 0), 0));
  });
</script>

<svelte:window bind:innerWidth />

<div class="host" bind:this={host}>
  <canvas
    bind:this={canvas}
    class:pointing={hovered !== null}
    class:picking={tablero.trazando}
    onpointermove={onPointerMove}
    onpointerleave={onPointerLeave}
    onclick={onClick}
  ></canvas>
</div>

{#if hovered && (hovered.kind !== 'estado' || !tablero.trazando)}
  <div
    class="tip panel"
    class:flip={pointer.x > innerWidth - 260}
    style:left="{pointer.x}px"
    style:top="{pointer.y}px"
  >
    {#if hovered.kind === 'unidad'}
      {@const u = hovered.unidad}
      <span class="label tip-kind" style:color={u.color}>
        {u.tipo === 'barco' ? `${CLASES_BARCO[u.clase].nombre} · ${u.id}` : `Tren · ${u.id}`}
      </span>
      <strong>{u.nombre}</strong>
      <span class="tip-sub">{lineaUnidad}</span>
    {:else if hovered.kind === 'puerta'}
      <span class="label tip-kind" style:color="var(--accent)">Salida al mundo</span>
      <strong>Hacia {hovered.puerta.nombre}</strong>
      <span class="tip-sub">
        {`Travesía a ${hovered.puerta.hacia} por el ${hovered.puerta.oceano}`}{sim.mar
          ? ` · ${fmtKm(kmTravesia(sim.mar, `puerta:${hovered.puerta.id}`))}`
          : ''}
      </span>
      {#if lineaTrazado}<span class="tip-rail mar">{lineaTrazado}</span>{/if}
    {:else if hovered.kind === 'puerto'}
      <span class="label tip-kind" style:color="var(--accent)">
        Puerto{hovered.puerto.principal ? ' principal' : ''} · {hovered.puerto.litoral === 'pacifico' ? 'Pacífico' : 'Golfo'}
      </span>
      <strong>{hovered.puerto.nombre}</strong>
      <span class="tip-sub">
        {estadoNombre.get(hovered.puerto.estado) ?? hovered.puerto.estado}
        {#if CIUDAD_DEL_PUERTO.get(hovered.puerto.id)}
          · {poblacion(CIUDAD_DEL_PUERTO.get(hovered.puerto.id)!.poblacion)}
        {/if}
      </span>
      {@const rail = lineaTrazado || servicio(`puerto:${hovered.puerto.id}`)}
      {#if rail}<span class="tip-rail" class:mar={tablero.trazando && tablero.pestaña === 'barco'}>{rail}</span>{/if}
    {:else if hovered.kind === 'polo'}
      {@const p = hovered.polo}
      <span class="label tip-kind" style:color={POLO}>Polo del Bienestar · {faseDelPolo(p.id)}</span>
      <strong>{p.nombre}</strong>
      <span class="tip-sub">{PROGRAMAS_POLO[p.programa]} · {p.municipio}, {estadoNombre.get(p.estado) ?? p.estado}</span>
      <span class="tip-sub">{fmt.format(Math.round(p.hectareas))} ha · declaratoria del {fechaLarga(p.dof)}</span>
      {@const via = lineaTrazado || viaDelPolo(p)}
      {#if via}<span class="tip-rail">{via}</span>{/if}
    {:else if hovered.kind === 'ciudad'}
      <span class="label tip-kind">
        {hovered.ciudad.capital === 'pais' ? 'Capital del país' : hovered.ciudad.capital === 'estado' ? 'Capital estatal' : 'Ciudad'}
      </span>
      <strong>{hovered.ciudad.nombre}</strong>
      <span class="tip-sub">
        {estadoNombre.get(hovered.ciudad.estado) ?? hovered.ciudad.estado} · {poblacion(hovered.ciudad.poblacion)}
      </span>
      {@const rail = lineaTrazado || servicio(`ciudad:${hovered.ciudad.id}`)}
      {#if rail}<span class="tip-rail">{rail}</span>{/if}
    {:else if hovered.kind === 'via'}
      {@const v = sim.red?.vias[hovered.base]}
      {@const u = sim.uso(hovered.base)}
      {#if v}
        {@const d = v.dueño ? DUEÑOS[v.dueño] : null}
        <span class="label tip-kind" style:color={v.dueño ? COLOR_DUEÑO[v.dueño] : COLOR_SIN_DUEÑO}>
          Vía {d ? (d.tipo === 'estatal' ? 'del Estado' : d.tipo === 'mixta' ? 'mixta' : 'concesionada') : 'sin dueño identificado'}
          {#if !v.operando}· fuera de operación{/if}
        </span>
        <strong>{d?.nombre ?? 'Sin dueño identificado'}</strong>
        <span class="tip-sub">
          {fmtKm(v.km)} · {v.doble ? 'vía doble' : v.capacidad > CAPACIDAD.sencilla ? 'vía sencilla, control centralizado' : 'vía sencilla'}
          {#if v.corredor}· corredor {v.corredor}{/if}
        </span>
        {#if !v.operando}
          <span class="tip-sub">Sin trenes desde antes de 2018. El Estado puede rehabilitarla.</span>
        {:else if u}
          <span class="tip-rail">
            {fmtTrenes(u.privados)} privados{u.jugador > 0.05 ? ` + ${fmtTrenes(u.jugador)} tuyos` : ''} de {u.capacidad} al día · {Math.round(u.uso * 100)} %
          </span>
          {#if factorVelocidad(u.uso) < 0.995}
            <span class="tip-sub tip-lento">
              {nivelUso(u.uso) === 'saturada' ? 'Saturada' : 'Cargada'}: los trenes van {Math.round((1 - factorVelocidad(u.uso)) * 100)} % más lento
            </span>
          {/if}
        {/if}
      {/if}
    {:else}
      <span class="label tip-kind">Estado · {hovered.estado.clave}</span>
      <strong>{hovered.estado.nombre}</strong>
      <span class="tip-sub">Clic para acercar</span>
    {/if}
  </div>
{/if}

<div class="stats panel">
  <span class="label">México</span>
  {#if status === 'cargando'}
    <span class="mono dim">cargando geografía…</span>
  {:else if status === 'error' || sim.estado === 'error'}
    <span class="mono err">no se pudo cargar la geografía</span>
  {:else}
    <span class="stat"><b class="mono">{PUERTOS.length}</b> puertos</span>
    <span class="stat"><b class="mono">{CIUDADES.length}</b> ciudades</span>
    <span class="stat"><b class="mono">{POLOS.length}</b> polos</span>
    <span class="stat"><b class="mono">{fmt.format(kmDeVia)}</b> km de vía en servicio</span>
    <span class="stat"><b class="mono">{sim.trenes.length}</b> trenes</span>
    <span class="stat"><b class="mono">{sim.barcos.length}</b> barcos</span>
  {/if}
</div>

{#if layers.vias}
  <div class="vias panel">
    <div class="modos" role="group" aria-label="Color de las vías">
      {#each MODOS_VIAS as m (m.id)}
        <button class="modo" aria-pressed={modoVias === m.id} onclick={() => (modoVias = m.id)}>{m.label}</button>
      {/each}
    </div>
    <ul class="leyenda">
      {#if modoVias === 'dueño'}
        {#each Object.entries(DUEÑOS) as [id, d] (id)}
          {#if id !== 'ADMICARGA'}
            <li>
              <span class="raya" style:background={COLOR_DUEÑO[id as Dueño]}></span>{id === 'FIT' ? 'Del Estado' : d.nombre}
            </li>
          {/if}
        {/each}
      {:else}
        <li><span class="raya" style:background={COLOR_USO.holgada}></span>Holgada · hasta 60 %</li>
        <li><span class="raya" style:background={COLOR_USO.cargada}></span>Cargada · los trenes frenan</li>
        <li><span class="raya" style:background={COLOR_USO.saturada}></span>Saturada · más de lo que cabe</li>
      {/if}
      <li><span class="raya muerta"></span>Fuera de operación</li>
    </ul>
  </div>
{/if}

<div class="tools panel">
  <button class="ctl" aria-pressed={layers.estados} onclick={() => (layers.estados = !layers.estados)}>
    <span class="sw sw-estados"></span>Estados
  </button>
  <button class="ctl" aria-pressed={layers.vias} onclick={() => (layers.vias = !layers.vias)}>
    <span class="sw sw-vias"></span>Vías férreas
  </button>
  <button class="ctl" aria-pressed={layers.puertos} onclick={() => (layers.puertos = !layers.puertos)}>
    <span class="sw sw-puertos"></span>Puertos
  </button>
  <button class="ctl" aria-pressed={layers.ciudades} onclick={() => (layers.ciudades = !layers.ciudades)}>
    <span class="sw sw-ciudades"></span>Ciudades
  </button>
  <button class="ctl" aria-pressed={layers.polos} onclick={() => (layers.polos = !layers.polos)}>
    <svg class="sw" width="12" height="11" viewBox="0 0 12 11" aria-hidden="true">
      <polygon
        points="11,5.5 8.5,9.8 3.5,9.8 1,5.5 3.5,1.2 8.5,1.2"
        fill="rgba(244, 114, 182, 0.16)"
        stroke={POLO}
        stroke-width="1.3"
        stroke-dasharray="2 1.4"
      />
    </svg>Polos
  </button>
  <span class="sep"></span>
  <span class="label mono">{transform.k.toFixed(1)}×</span>
  <button class="ctl" onclick={resetView}>Reencuadrar</button>
</div>

<style>
  .host {
    position: fixed;
    inset: 0;
  }

  canvas {
    display: block;
    cursor: grab;
    touch-action: none;
  }

  canvas.pointing {
    cursor: pointer;
  }

  canvas.picking {
    cursor: crosshair;
  }

  canvas.picking.pointing {
    cursor: copy;
  }

  canvas:active {
    cursor: grabbing;
  }

  .tip {
    position: fixed;
    z-index: 35;
    pointer-events: none;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    padding: 0.5rem 0.7rem;
    min-width: 9rem;
    max-width: 17rem;
    background: var(--glass-strong);
    transform: translate(16px, 14px);
  }

  /* Near the right edge the tip opens to the left of the cursor instead. */
  .tip.flip {
    transform: translate(calc(-100% - 16px), 14px);
  }

  .tip strong {
    font-size: 0.92rem;
    font-weight: 600;
  }

  .tip-sub {
    font-size: 0.72rem;
    color: var(--muted);
  }

  .tip-rail {
    font-size: 0.7rem;
    color: #ffe2a3;
  }

  .tip-rail.mar {
    color: #bfeaff;
  }

  .stats {
    position: fixed;
    left: calc(1rem + var(--vistas) + 0.5rem);
    min-height: var(--vistas-alto);
    bottom: 1rem;
    z-index: 30;
    display: flex;
    align-items: center;
    gap: 0.9rem;
    padding: 0.55rem 0.85rem;
    font-size: 0.74rem;
    color: var(--muted);
  }

  .stat b {
    color: var(--ink);
    font-weight: 600;
    margin-right: 0.2rem;
  }

  .dim {
    color: var(--dim);
  }

  .err {
    color: var(--warn);
  }

  .tools {
    position: fixed;
    right: 1rem;
    bottom: 1rem;
    z-index: 30;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 0.4rem;
    padding: 0.45rem 0.6rem;
  }

  .tools .ctl {
    padding: 0.3rem 0.6rem;
    font-size: 0.72rem;
  }

  .tools .ctl[aria-pressed='false'] {
    color: var(--dim);
  }

  .tools .ctl[aria-pressed='false'] .sw {
    opacity: 0.3;
  }

  .sw {
    flex: none;
    display: inline-block;
  }

  .sw-estados {
    width: 11px;
    height: 9px;
    border: 1px solid rgba(126, 190, 255, 0.55);
    background: #0e2035;
    border-radius: 2px;
  }

  .sw-vias {
    width: 14px;
    height: 2px;
    background: var(--warn);
    box-shadow: 0 0 0 1px rgba(255, 209, 102, 0.18);
  }

  .sw-puertos {
    width: 7px;
    height: 7px;
    background: var(--accent);
    transform: rotate(45deg);
    box-shadow: 0 0 8px var(--accent);
  }

  .sw-ciudades {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--ink);
  }

  /* ---- track colour switch and legend, above the tools ------------------ */

  .vias {
    position: fixed;
    right: 1rem;
    bottom: 4.4rem;
    z-index: 30;
    width: 13.5rem;
    padding: 0.55rem 0.65rem 0.6rem;
    font-size: 0.7rem;
  }

  .modos {
    display: flex;
    gap: 0.25rem;
    padding: 0.2rem;
    border-radius: 9px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--line);
  }

  .modo {
    flex: 1;
    padding: 0.25rem 0;
    border: 0;
    border-radius: 7px;
    background: none;
    font-size: 0.68rem;
    color: var(--muted);
    cursor: pointer;
  }

  .modo:hover {
    color: var(--ink);
  }

  .modo[aria-pressed='true'] {
    background: rgba(255, 209, 102, 0.14);
    color: #fff1cc;
  }

  .leyenda {
    list-style: none;
    margin: 0.5rem 0 0;
    padding: 0 0.15rem;
    display: grid;
    gap: 0.28rem;
    color: var(--muted);
  }

  .leyenda li {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .raya {
    flex: none;
    width: 16px;
    height: 3px;
    border-radius: 2px;
  }

  .raya.muerta {
    height: 0;
    border-top: 2px dashed rgba(138, 164, 194, 0.55);
    border-radius: 0;
  }

  .tip-lento {
    color: #fca5a5;
  }

  .sep {
    width: 1px;
    align-self: stretch;
    background: var(--line);
    margin: 0 0.25rem;
  }

  @media (max-width: 1240px) {
    .stats {
      display: none;
    }
  }

  @media (max-width: 720px) {
    .tools {
      left: 1rem;
      justify-content: center;
    }
  }
</style>
