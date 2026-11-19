<script lang="ts">
  import { geoConicConformal, geoGraticule, geoLength, geoPath } from 'd3-geo';
  import type { GeoPath, GeoProjection } from 'd3-geo';
  import { select } from 'd3-selection';
  import { zoom as d3zoom, zoomIdentity, type ZoomTransform } from 'd3-zoom';
  import type { MultiPoint } from 'geojson';
  import { EARTH_RADIUS_KM, type LonLat } from '$lib/domain/geo';
  import {
    CIUDAD_DEL_PUERTO,
    CIUDADES,
    PUERTO_DE_LA_CIUDAD,
    PUERTOS,
    type Ciudad,
    type Puerto,
  } from '$lib/domain/sitios';
  import { loadMexico, type EstadoProps, type MexicoGeometry } from './mexico';

  /**
   * The game board: Mexico alone, in detail. Same machinery as the world
   * canvas (geometry baked once into `Path2D` in un-zoomed projected space, the
   * d3-zoom transform applied to the context, paint on demand), with what the
   * world map doesn't need: estados, the rail network, ports, cities, hover
   * and a camera that flies to whatever you click.
   *
   * Colour carries meaning and later layers should keep it: sea things are
   * cyan (`--accent`), rail things are amber (`--warn`), cities are ink.
   */

  // ---- constants ---------------------------------------------------------

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
  /** Below this zoom estados are labelled by abbreviation. */
  const FULL_NAMES_AT = 2.4;

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
  ];

  // ---- state --------------------------------------------------------------

  type Layers = { estados: boolean; vias: boolean; puertos: boolean; ciudades: boolean };
  let layers = $state<Layers>({ estados: true, vias: true, puertos: true, ciudades: true });

  type Target =
    | { kind: 'puerto'; puerto: Puerto }
    | { kind: 'ciudad'; ciudad: Ciudad }
    | { kind: 'estado'; estado: EstadoProps };

  let host = $state.raw<HTMLDivElement>();
  let canvas = $state.raw<HTMLCanvasElement>();
  let transform = $state.raw<ZoomTransform>(zoomIdentity);
  let hovered = $state.raw<Target | null>(null);
  let pointer = $state({ x: 0, y: 0 });
  let innerWidth = $state(0);
  let status = $state<'cargando' | 'listo' | 'error'>('cargando');
  let railKm = $state(0);

  // Plain locals: read only when painting, rebuilt imperatively.
  let width = 0;
  let height = 0;
  let dpr = 1;
  let projection: GeoProjection | null = null;
  let path: GeoPath | null = null;
  let geo: MexicoGeometry | null = null;
  let zoomBehaviour: ReturnType<typeof d3zoom<HTMLCanvasElement, unknown>> | null = null;
  let frame = 0;

  type Baked = {
    graticule: Path2D;
    vecinos: Path2D;
    vecinosCosta: Path2D;
    vecinosLimites: Path2D;
    pais: Path2D;
    costa: Path2D;
    frontera: Path2D;
    limites: Path2D;
    troncales: Path2D;
    ramales: Path2D;
    estados: { props: EstadoProps; path: Path2D; bounds: [[number, number], [number, number]] }[];
  };
  let baked: Baked | null = null;
  /** The graticule alone, so the first frame isn't empty while the TopoJSON loads. */
  let graticuleOnly: Path2D | null = null;

  /** Projected (un-zoomed path space) positions, rebuilt with the projection. */
  let ciudadPts: [number, number][] = [];
  let puertoPts: [number, number][] = [];

  const estadoNombre = new Map<string, string>();

  // A detached context for `isPointInPath`, so hit-testing never touches the
  // transform or state of the one we paint with.
  let hitCtx: CanvasRenderingContext2D | null = null;

  // ---- projection & baking -------------------------------------------------

  function rebuild() {
    if (!width || !height) return;
    projection = makeProjection();
    // Room for the nav bar on top and the tool strips below.
    projection.fitExtent(
      [
        [28, 88],
        [width - 28, height - 76],
      ],
      FRAME
    );
    path = geoPath(projection);
    ciudadPts = CIUDADES.map((c) => projection!(c.lonLat) ?? [NaN, NaN]);
    puertoPts = PUERTOS.map((p) => projection!(p.lonLat) ?? [NaN, NaN]);
    applyTranslateExtent();
    bake();
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
      troncales: P(g.viasTroncales),
      ramales: P(g.viasRamales),
      estados: g.estados.features.map((f) => ({ props: f.properties, path: P(f), bounds: p.bounds(f) })),
    };
  }

  // ---- camera -------------------------------------------------------------

  function setTransform(next: ZoomTransform) {
    if (!canvas || !zoomBehaviour) return;
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

  function stepCamera(now: number) {
    if (!fly) return;
    const u = Math.min(1, (now - fly.start) / FLY_MS);
    const e = 1 - (1 - u) ** 3;
    const [fx, fy, fk] = fly.from;
    const [tx, ty, tk] = fly.to;
    // Zoom interpolates geometrically: a linear ramp from 1× to 20× spends
    // almost the whole flight already zoomed in, which reads as a lurch.
    const k = Math.exp(Math.log(fk) + (Math.log(tk) - Math.log(fk)) * e);
    const cx = fx + (tx - fx) * e;
    const cy = fy + (ty - fy) * e;
    if (u >= 1) fly = null;
    setTransform(zoomIdentity.translate(width / 2 - k * cx, height / 2 - k * cy).scale(k));
  }

  function resetView() {
    // The framing transform is the identity: `rebuild` fits Mexico at k = 1.
    if (!width) return;
    flyTo(width / 2, height / 2, 1);
  }

  // ---- drawing ------------------------------------------------------------

  function requestDraw() {
    if (frame) return;
    frame = requestAnimationFrame((now) => {
      frame = 0;
      stepCamera(now);
      draw();
      if (fly) requestDraw();
    });
  }

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

  const spotsAround = (x: number, y: number, r: number): Spot[] => [
    { x: x + r + 4, y: y + 4, align: 'left' },
    { x: x - r - 4, y: y + 4, align: 'right' },
    { x, y: y - r - 5, align: 'center' },
    { x, y: y + r + 13, align: 'center' },
  ];

  function draw() {
    const ctx = canvas?.getContext('2d');
    if (!ctx || !projection) return;

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

    // ---- geography, in zoomed path space ---------------------------------
    ctx.save();
    ctx.translate(transform.x, transform.y);
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
      if (hoveredEstado) {
        const e = b.estados.find((x) => x.props.clave === hoveredEstado);
        if (e) {
          ctx.fillStyle = 'rgba(76, 201, 255, 0.07)';
          ctx.fill(e.path);
        }
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

      if (hoveredEstado) {
        const e = b.estados.find((x) => x.props.clave === hoveredEstado);
        if (e) {
          ctx.strokeStyle = 'rgba(160, 220, 255, 0.55)';
          ctx.lineWidth = 1.1 / k;
          ctx.stroke(e.path);
        }
      }

      if (layers.vias) {
        if (k >= TIES_AT) {
          // Crossties: a wide stroke dashed into short bars, under the rail.
          ctx.save();
          ctx.lineCap = 'butt';
          ctx.strokeStyle = 'rgba(255, 209, 102, 0.32)';
          ctx.lineWidth = 3.6 / k;
          ctx.setLineDash([0.9 / k, 3.4 / k]);
          ctx.stroke(b.troncales);
          ctx.stroke(b.ramales);
          ctx.restore();
        }
        ctx.strokeStyle = 'rgba(255, 209, 102, 0.36)';
        ctx.lineWidth = 0.8 / k;
        ctx.stroke(b.ramales);
        ctx.strokeStyle = 'rgba(255, 209, 102, 0.72)';
        ctx.lineWidth = 1.15 / k;
        ctx.stroke(b.troncales);
      }
    }
    ctx.restore();

    // ---- sites & labels, in screen space (crisp at any zoom) --------------
    const sx = (p: [number, number]) => transform.applyX(p[0]);
    const sy = (p: [number, number]) => transform.applyY(p[1]);
    const onScreen = (x: number, y: number) => x > -20 && x < width + 20 && y > -20 && y < height + 20;

    const taken: Box[] = [];
    const labels: Label[] = [];

    if (layers.ciudades) {
      CIUDADES.forEach((c, i) => {
        const x = sx(ciudadPts[i]);
        const y = sy(ciudadPts[i]);
        if (!onScreen(x, y)) return;
        const r = cityRadius(c);
        const hot = hovered?.kind === 'ciudad' && hovered.ciudad.id === c.id;
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

    if (layers.puertos) {
      PUERTOS.forEach((p, i) => {
        const x = sx(puertoPts[i]);
        const y = sy(puertoPts[i]);
        if (!onScreen(x, y)) return;
        const hot = hovered?.kind === 'puerto' && hovered.puerto.id === p.id;
        const s = p.principal ? 5.2 : 3.8;
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

  // ---- hover & click ----------------------------------------------------------

  function targetAt(mx: number, my: number): Target | null {
    if (!projection) return null;
    // Sites first, nearest within a few pixels: they sit on top of estados.
    let best: Target | null = null;
    let bestD = Infinity;
    if (layers.puertos) {
      PUERTOS.forEach((p, i) => {
        const d = Math.hypot(transform.applyX(puertoPts[i][0]) - mx, transform.applyY(puertoPts[i][1]) - my);
        if (d < 10 && d < bestD) {
          best = { kind: 'puerto', puerto: p };
          bestD = d;
        }
      });
    }
    if (layers.ciudades) {
      CIUDADES.forEach((c, i) => {
        const d = Math.hypot(transform.applyX(ciudadPts[i][0]) - mx, transform.applyY(ciudadPts[i][1]) - my);
        if (d < 8 && d < bestD) {
          best = { kind: 'ciudad', ciudad: c };
          bestD = d;
        }
      });
    }
    if (best) return best;
    if (!baked) return null;
    hitCtx ??= document.createElement('canvas').getContext('2d');
    if (!hitCtx) return null;
    // Identity transform + a point in path space = test against the un-zoomed path.
    const px = transform.invertX(mx);
    const py = transform.invertY(my);
    for (const e of baked.estados) {
      const [[x0, y0], [x1, y1]] = e.bounds;
      if (px < x0 || px > x1 || py < y0 || py > y1) continue;
      if (hitCtx.isPointInPath(e.path, px, py)) return { kind: 'estado', estado: e.props };
    }
    return null;
  }

  const sameTarget = (a: Target | null, b: Target | null) =>
    a === b ||
    (!!a &&
      !!b &&
      a.kind === b.kind &&
      (a.kind === 'puerto'
        ? a.puerto.id === (b as typeof a).puerto.id
        : a.kind === 'ciudad'
          ? a.ciudad.id === (b as typeof a).ciudad.id
          : a.estado.clave === (b as typeof a).estado.clave));

  function onPointerMove(event: PointerEvent) {
    if (!canvas || event.buttons) return; // no hover while dragging the map
    const rect = canvas.getBoundingClientRect();
    pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    const next = targetAt(pointer.x, pointer.y);
    if (!sameTarget(next, hovered)) {
      hovered = next;
      requestDraw();
    }
  }

  function onPointerLeave() {
    if (hovered) {
      hovered = null;
      requestDraw();
    }
  }

  function onClick(event: MouseEvent) {
    if (!canvas || !projection) return;
    const rect = canvas.getBoundingClientRect();
    const target = targetAt(event.clientX - rect.left, event.clientY - rect.top);
    if (!target) return;
    if (target.kind === 'estado') {
      const e = baked?.estados.find((x) => x.props.clave === target.estado.clave);
      if (e) flyToBounds(e.bounds);
      return;
    }
    const lonLat = target.kind === 'puerto' ? target.puerto.lonLat : target.ciudad.lonLat;
    const p = projection(lonLat);
    if (p) flyTo(p[0], p[1], Math.max(transform.k, 9));
  }

  // ---- lifecycle --------------------------------------------------------------

  $effect(() => {
    if (!host || !canvas) return;
    const observer = new ResizeObserver(() => {
      const first = !width;
      const centre = viewCentre();
      const rect = host!.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));
      canvas!.width = Math.round(width * dpr);
      canvas!.height = Math.round(height * dpr);
      canvas!.style.width = `${width}px`;
      canvas!.style.height = `${height}px`;
      rebuild();
      if (!first) lookAt(centre, transform.k);
      draw();
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
        railKm = Math.round(
          (geoLength(g.viasTroncales) + geoLength(g.viasRamales)) * EARTH_RADIUS_KM
        );
        status = 'listo';
        bake();
        requestDraw();
      })
      .catch(() => {
        if (!cancelled) status = 'error';
      });
    return () => {
      cancelled = true;
    };
  });

  $effect(() => {
    if (!canvas) return;
    zoomBehaviour = d3zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([1, MAX_ZOOM])
      // A wheel or drag takes the camera back from any flight in progress.
      .filter((event: Event) => {
        if (event.type === 'wheel' || event.type === 'mousedown' || event.type === 'touchstart') fly = null;
        return (!(event as MouseEvent).ctrlKey || event.type === 'wheel') && !(event as MouseEvent).button;
      })
      .on('zoom', (event) => {
        transform = event.transform;
        requestDraw();
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
    // Layer toggles repaint.
    layers.estados;
    layers.vias;
    layers.puertos;
    layers.ciudades;
    requestDraw();
  });

  $effect(() => () => {
    if (frame) cancelAnimationFrame(frame);
  });

  // ---- tooltip text -------------------------------------------------------------

  const fmt = new Intl.NumberFormat('es-MX');
  function poblacion(n: number): string {
    return n >= 1e6 ? `${(n / 1e6).toLocaleString('es-MX', { maximumFractionDigits: 1 })} M hab.` : `${fmt.format(Math.round(n / 1000))} mil hab.`;
  }
</script>

<svelte:window bind:innerWidth />

<div class="host" bind:this={host}>
  <canvas
    bind:this={canvas}
    class:pointing={hovered !== null}
    onpointermove={onPointerMove}
    onpointerleave={onPointerLeave}
    onclick={onClick}
  ></canvas>
</div>

{#if hovered}
  <div
    class="tip panel"
    class:flip={pointer.x > innerWidth - 240}
    style:left="{pointer.x}px"
    style:top="{pointer.y}px"
  >
    {#if hovered.kind === 'puerto'}
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
    {:else if hovered.kind === 'ciudad'}
      <span class="label tip-kind">
        {hovered.ciudad.capital === 'pais' ? 'Capital del país' : hovered.ciudad.capital === 'estado' ? 'Capital estatal' : 'Ciudad'}
      </span>
      <strong>{hovered.ciudad.nombre}</strong>
      <span class="tip-sub">
        {estadoNombre.get(hovered.ciudad.estado) ?? hovered.ciudad.estado} · {poblacion(hovered.ciudad.poblacion)}
      </span>
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
  {:else if status === 'error'}
    <span class="mono err">no se pudo cargar la geografía</span>
  {:else}
    <span class="stat"><b class="mono">32</b> estados</span>
    <span class="stat"><b class="mono">{PUERTOS.length}</b> puertos</span>
    <span class="stat"><b class="mono">{CIUDADES.length}</b> ciudades</span>
    <span class="stat"><b class="mono">{fmt.format(railKm)}</b> km de vía</span>
  {/if}
</div>

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

  .stats {
    position: fixed;
    left: 1rem;
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

  .sep {
    width: 1px;
    align-self: stretch;
    background: var(--line);
    margin: 0 0.25rem;
  }

  @media (max-width: 1100px) {
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
