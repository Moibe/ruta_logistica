<script lang="ts">
  import {
    geoContains,
    geoEquirectangular,
    geoMercator,
    geoNaturalEarth1,
    geoPath,
    geoGraticule10,
  } from 'd3-geo';
  import type { GeoProjection, GeoPath } from 'd3-geo';
  import { select } from 'd3-selection';
  import { zoom as d3zoom, zoomIdentity, type ZoomTransform } from 'd3-zoom';
  import { untrack } from 'svelte';
  import { goto } from '$app/navigation';
  import { CLASES_BARCO, type Barco } from '$lib/domain/barcos';
  import type { LonLat } from '$lib/domain/geo';
  import { esperaTotal, piernasDelRecorrido, posicion, trayectoActual } from '$lib/domain/servicio';
  import { CENTRO_MEXICO, PUERTAS } from '$lib/domain/sitios';
  import { puntoEn, seccion } from '$lib/domain/trayecto';
  import { kmEnHoras } from '$lib/domain/petroleros';
  import { sim } from '$lib/state/simulacion.svelte';
  import { tablero } from '$lib/state/tablero.svelte';
  import { estadoUnidad } from '$lib/ui/formato';
  import { loadWorld, type Resolution, type WorldGeometry } from './world';
  import { loadMexico, type MexicoGeometry } from './mexico';

  /**
   * The crisp view. Everything is drawn as vectors at device pixel ratio, so
   * there is no raster to go soft — you can zoom to 48× and the coastline is
   * still a hairline.
   *
   * The static geometry (land, borders, graticule) is baked into `Path2D`
   * objects **once** in un-zoomed projected space, and the d3-zoom transform is
   * applied to the canvas context rather than to the projection. So a frame is
   * a handful of `fill`/`stroke` calls on cached paths, and panning never
   * re-runs the projection over 25k coastline vertices.
   *
   * The ships sail here too — the whole of every service, Shanghái and
   * Róterdam included — so while the game clock runs there's a frame loop, and
   * with the clock paused a frame is painted only when something changes
   * (zoom, resize, projection, data): an idle map costs nothing. Each ship's
   * loop is baked into a `Path2D` like the coast; only the hulls and their
   * wakes are drawn per frame, in screen space.
   *
   * Mexico is drawn on top in amber — the board's colour — from the same
   * detailed geometry the board uses. Hovering it lights it up; clicking it
   * flies the camera in and hands over to `/mexico`.
   */
  const PROJECTIONS = {
    // `wraps` marks the cylindrical projections — the ones whose left and right
    // edges are the same meridian, so tiling copies of the world side by side
    // produces a seamless, endless map. Natural Earth's rim is a curve; a copy
    // next to it would just look like a second, detached planet.
    equirect: { label: 'Equirect.', make: geoEquirectangular, wraps: true },
    natural: { label: 'Natural', make: geoNaturalEarth1, wraps: false },
    mercator: { label: 'Mercator', make: geoMercator, wraps: true },
  } as const;

  type ProjectionKey = keyof typeof PROJECTIONS;

  /** Above this zoom the 110m coastline starts showing its polygons; swap up. */
  const HI_RES_AT = 3;
  /** Hard cap on tiled world copies, so a pathological transform can't hang a frame. */
  const MAX_COPIES = 4;

  let host = $state.raw<HTMLDivElement>();
  let canvas = $state.raw<HTMLCanvasElement>();
  let projectionKey = $state<ProjectionKey>('equirect');
  let transform = $state.raw<ZoomTransform>(zoomIdentity);
  let resolution = $state<Resolution>('110m');

  // Plain locals, not runes: these are read only when painting and rebuilt
  // imperatively. Making them reactive would re-run effects for no gain.
  let width = 0;
  let height = 0;
  let dpr = 1;
  let projection: GeoProjection | null = null;
  let path: GeoPath | null = null;
  let world: WorldGeometry | null = null;
  let landPath: Path2D | null = null;
  let coastPath: Path2D | null = null;
  let bordersPath: Path2D | null = null;
  let graticulePath: Path2D | null = null;
  let mexico: MexicoGeometry | null = null;
  let mexicoFill: Path2D | null = null;
  let mexicoOutline: Path2D | null = null;
  /** Each ship's whole loop, in un-zoomed path space like the coast. */
  let rutasBarcos: { id: string; color: string; path: Path2D }[] = [];
  /** Where each ship was drawn this frame (every copy of the world), for hit-testing. */
  let cabezas: { barco: Barco; x: number; y: number }[] = [];
  let hoverBarco = $state.raw<Barco | null>(null);
  let pointer = $state({ x: 0, y: 0 });
  let innerWidth = $state(0);
  let hoverMexico = $state(false);
  /** Set while the camera flies in; the page changes when it lands. */
  let entering = $state(false);
  // Projected extent of one whole world, in un-zoomed path space. `worldWidth`
  // is the tiling step for the repeated world.
  let worldX0 = 0;
  let worldWidth = 0;
  let worldY0 = 0;
  let worldY1 = 0;
  // Kept so `resetView` can drive the *same* behaviour instance — recreating one
  // just to call `.transform` would leave the live behaviour's internal state
  // stale and the next wheel tick would snap back to the old zoom.
  let zoomBehaviour: ReturnType<typeof d3zoom<HTMLCanvasElement, unknown>> | null = null;
  /** Id of the queued paint, 0 when none is pending. */
  let frame = 0;

  const wraps = $derived(PROJECTIONS[projectionKey].wraps);

  /**
   * The map's central meridian: the eastern Pacific, not Greenwich. Mexico sits
   * just right of the middle with Asia to its left and Europe to its right, so
   * both ocean crossings run whole instead of being cut at the map's edge —
   * and far enough west that Shanghái clears the fleet panel on the left.
   */
  const MERIDIANO_CENTRAL = -130;

  /** Rebuild the projection for the current size and re-bake every static path. */
  function rebuild() {
    if (!width || !height) return;
    projection = PROJECTIONS[projectionKey].make().rotate([-MERIDIANO_CENTRAL, 0]);
    projection.fitExtent(
      [
        [12, 12],
        [width - 12, height - 12],
      ],
      { type: 'Sphere' }
    );
    path = geoPath(projection);

    // The world's extent from the sphere's outline: with the projection
    // rotated, ±180° is no longer the edge of the map.
    const bounds = path.bounds({ type: 'Sphere' });
    worldX0 = bounds[0][0];
    worldWidth = bounds[1][0] - bounds[0][0] || width;
    worldY0 = bounds[0][1];
    worldY1 = bounds[1][1];

    applyTranslateExtent();
    bakeStatic();
  }

  /**
   * Fence the camera to the world. Vertically always — dragging the planet off
   * into empty space is never useful. Horizontally only when the projection
   * doesn't wrap; the tiled ones are meant to pan forever.
   */
  function applyTranslateExtent() {
    if (!zoomBehaviour) return;
    const extent: [[number, number], [number, number]] = wraps
      ? [
          [-Infinity, worldY0],
          [Infinity, worldY1],
        ]
      : [
          [worldX0, worldY0],
          [worldX0 + worldWidth, worldY1],
        ];
    zoomBehaviour.translateExtent(extent);
  }

  function bakeStatic() {
    if (!path) return;
    graticulePath = new Path2D(path(geoGraticule10()) ?? '');
    if (world) {
      // Land is filled from its polygons but stroked from `coastline`: see
      // `WorldGeometry.coastline` for the seams that stroking polygons draws.
      landPath = new Path2D(path(world.land) ?? '');
      coastPath = new Path2D(path(world.coastline) ?? '');
      bordersPath = new Path2D(path(world.borders) ?? '');
    }
    bakeRutas();
    if (mexico) {
      mexicoFill = new Path2D(path(mexico.pais) ?? '');
      mexicoOutline = new Path2D(
        path({
          type: 'MultiLineString',
          coordinates: [...mexico.costa.coordinates, ...mexico.frontera.coordinates],
        }) ?? ''
      );
    }
  }

  /** The ships' loops. d3 follows each leg's great circles and cuts them at the antimeridian. */
  function bakeRutas() {
    if (!path) return;
    rutasBarcos = sim.barcos.map((b) => ({
      id: b.id,
      color: b.color,
      path: new Path2D(path!({ type: 'MultiLineString', coordinates: piernasDelRecorrido(b).map((p) => p.puntos) }) ?? ''),
    }));
  }

  // ---- camera -------------------------------------------------------------

  /**
   * The lon/lat under the middle of the screen, or null when that spot is off
   * the planet (Natural Earth's corners invert to *some* lon/lat that doesn't
   * project back to where it came from). Copies of a tiled world project back
   * whole world widths away, which still counts as the same place.
   */
  function viewCentre(): [number, number] | null {
    if (!projection?.invert || !width || !height) return null;
    const x = transform.invertX(width / 2);
    const y = transform.invertY(height / 2);
    const p = projection.invert([x, y]);
    const q = p ? projection(p) : null;
    if (!p || !q) return null;
    let dx = q[0] - x;
    if (worldWidth > 0) dx -= Math.round(dx / worldWidth) * worldWidth;
    return Math.hypot(dx, q[1] - y) < 0.5 ? p : null;
  }

  /**
   * Put a lon/lat at the middle of the screen at zoom `k`, run through the same
   * constraint a drag obeys (`zoom.transform` skips it, it only guards
   * gestures). With no point it just re-fences the current view.
   *
   * Used after anything that changes what a pan offset means — a new
   * projection, a new canvas size. Reusing the old offset in the new space
   * shows a different place, or none: pan the Equirect. map and pick Natural,
   * and the planet would sit half off-screen.
   */
  function lookAt(lonLat: [number, number] | null, k: number) {
    if (!canvas || !zoomBehaviour || !projection) return;
    const p = lonLat ? projection(lonLat) : null;
    let next = p
      ? zoomIdentity.translate(width / 2 - k * p[0], height / 2 - k * p[1]).scale(k)
      : transform;
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

  /**
   * The horizontal offsets, in un-zoomed path units, at which a copy of the
   * world is currently on screen. The static paths are drawn once per entry,
   * which is what makes the cylindrical projections feel endless. Anything a
   * future layer draws (and hit-tests) must iterate over this same list.
   */
  function worldOffsets(): number[] {
    if (!wraps || worldWidth <= 0) return [0];
    const xMin = transform.invertX(0);
    const xMax = transform.invertX(width);
    const first = Math.ceil((xMin - (worldX0 + worldWidth)) / worldWidth);
    const last = Math.floor((xMax - worldX0) / worldWidth);
    const out: number[] = [];
    for (let n = Math.max(first, -MAX_COPIES); n <= Math.min(last, MAX_COPIES); n++) {
      out.push(n * worldWidth);
    }
    return out.length ? out : [0];
  }

  // ---- Mexico ---------------------------------------------------------------

  /**
   * The lon/lat under a screen point, folding a tiled copy of the world back
   * onto the original first, or null off the planet.
   */
  function lonLatAt(mx: number, my: number): LonLat | null {
    if (!projection?.invert) return null;
    let x = transform.invertX(mx);
    const y = transform.invertY(my);
    if (wraps && worldWidth > 0) {
      x -= Math.round((x - (worldX0 + worldWidth / 2)) / worldWidth) * worldWidth;
    }
    const p = projection.invert([x, y]) as LonLat | null;
    const q = p ? projection(p) : null;
    return p && q && Math.hypot(q[0] - x, q[1] - y) < 0.5 ? p : null;
  }

  function isMexico(mx: number, my: number): boolean {
    const p = lonLatAt(mx, my);
    return !!p && !!mexico && geoContains(mexico.pais, p);
  }

  type Fly = {
    from: [number, number, number];
    to: [number, number, number];
    start: number;
    /** What landing does: switch to the board, or nothing. */
    alLlegar: (() => void) | null;
  };
  let fly: Fly | null = null;
  const FLY_MS = 1100;

  /**
   * Fly the camera onto Mexico, then switch to the board. The board opens
   * framed on the whole country, so landing on roughly that framing makes the
   * cut read as a continuation rather than a jump.
   */
  function enterMexico() {
    if (!projection || !path || entering) return;
    const centre = projection(CENTRO_MEXICO);
    if (!centre) return;
    let k = 6;
    if (mexico) {
      const [[x0, y0], [x1, y1]] = path.bounds(mexico.pais);
      k = Math.min(48, 0.8 / Math.max((x1 - x0) / width, (y1 - y0) / height));
    }
    // Nearest copy of Mexico on a tiled map, so the camera doesn't rewind
    // across the whole planet to reach the original.
    let cx = centre[0];
    if (wraps && worldWidth > 0) {
      const here = transform.invertX(width / 2);
      cx += Math.round((here - cx) / worldWidth) * worldWidth;
    }
    entering = true;
    // The board opens on the country, not chasing a ship out at sea.
    sim.siguiendo = false;
    fly = {
      from: [transform.invertX(width / 2), transform.invertY(height / 2), transform.k],
      to: [cx, centre[1], k],
      start: performance.now(),
      alLlegar: () => goto('/mexico'),
    };
    requestDraw();
  }

  /** The copy of a projected point nearest the middle of the screen, on a tiled map. */
  function copiaCercana(p: [number, number]): [number, number] {
    if (!wraps || worldWidth <= 0) return p;
    const here = transform.invertX(width / 2);
    return [p[0] + Math.round((here - p[0]) / worldWidth) * worldWidth, p[1]];
  }

  /** The selected unit, if it's a ship: the world views show ships only. */
  function barcoSeleccionado(): Barco | null {
    const u = sim.seleccionado;
    return u?.tipo === 'barco' ? u : null;
  }

  /** Fly to a ship: close enough to see its lane, and never out from where you already are. */
  function volarABarco(b: Barco) {
    const p = projection?.(posicion(b));
    if (!p || entering) return;
    const [cx, cy] = copiaCercana(p);
    fly = {
      from: [transform.invertX(width / 2), transform.invertY(height / 2), transform.k],
      to: [cx, cy, Math.min(48, Math.max(transform.k, 2.4))],
      start: performance.now(),
      alLlegar: null,
    };
    requestDraw();
  }

  /** Keep the followed ship in the middle, at whatever zoom you've set. */
  function follow() {
    if (fly || !sim.siguiendo || !canvas || !zoomBehaviour) return;
    const b = barcoSeleccionado();
    const p = b ? projection?.(posicion(b)) : null;
    if (!p) return;
    const [cx, cy] = copiaCercana(p);
    const k = transform.k;
    select(canvas).call(zoomBehaviour.transform, zoomIdentity.translate(width / 2 - k * cx, height / 2 - k * cy).scale(k));
  }

  function stepCamera(now: number) {
    if (!fly || !canvas || !zoomBehaviour) return;
    // Clamped at 0 too: a rAF timestamp can predate the flight's start stamp.
    const u = Math.max(0, Math.min(1, (now - fly.start) / FLY_MS));
    const e = u < 0.5 ? 4 * u ** 3 : 1 - (-2 * u + 2) ** 3 / 2;
    const [fx, fy, fk] = fly.from;
    let [tx, ty, tk] = fly.to;
    // A ship keeps sailing while the camera flies to it: aim at where it is now.
    const b = !fly.alLlegar && sim.siguiendo ? barcoSeleccionado() : null;
    const ahora = b ? projection?.(posicion(b)) : null;
    if (ahora) [tx, ty] = copiaCercana(ahora);
    // Geometric zoom: linear k would spend the whole flight already zoomed in.
    const k = Math.exp(Math.log(fk) + (Math.log(tk) - Math.log(fk)) * e);
    const next = zoomIdentity
      .translate(width / 2 - k * (fx + (tx - fx) * e), height / 2 - k * (fy + (ty - fy) * e))
      .scale(k);
    select(canvas).call(zoomBehaviour.transform, next);
    if (u >= 1) {
      const alLlegar = fly.alLlegar;
      fly = null;
      alLlegar?.();
    }
  }

  // ---- drawing ------------------------------------------------------------

  /** Something on screen moves by itself and needs the next frame too. */
  const animando = () =>
    !!fly || (sim.corriendo && sim.barcos.length > 0) || (sim.siguiendo && barcoSeleccionado() !== null) || !!hoverBarco;

  /** Queue one paint for the next frame; any number of calls before it coalesce. */
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

  function draw(now = performance.now()) {
    const ctx = canvas?.getContext('2d');
    if (!ctx || !projection) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    // ---- ocean ----------------------------------------------------------
    const sea = ctx.createLinearGradient(0, 0, 0, height);
    sea.addColorStop(0, '#061225');
    sea.addColorStop(0.55, '#04101f');
    sea.addColorStop(1, '#020a14');
    ctx.fillStyle = sea;
    ctx.fillRect(0, 0, width, height);

    const k = transform.k;

    ctx.save();
    ctx.translate(transform.x, transform.y);
    ctx.scale(k, k);
    ctx.lineJoin = 'round';

    for (const ox of worldOffsets()) {
      ctx.save();
      ctx.translate(ox, 0);

      // Line widths are divided by `k` so strokes keep a constant on-screen
      // thickness at any zoom — the context is scaled, the hairline isn't.

      // ---- graticule ----------------------------------------------------
      if (graticulePath) {
        ctx.strokeStyle = 'rgba(96, 160, 220, 0.10)';
        ctx.lineWidth = 0.5 / k;
        ctx.stroke(graticulePath);
      }

      // ---- land ---------------------------------------------------------
      if (landPath) {
        ctx.fillStyle = '#0c1a2b';
        ctx.fill(landPath);
      }
      if (coastPath) {
        ctx.strokeStyle = 'rgba(120, 190, 255, 0.34)';
        ctx.lineWidth = 0.7 / k;
        ctx.stroke(coastPath);
      }
      if (bordersPath) {
        ctx.strokeStyle = 'rgba(120, 190, 255, 0.10)';
        ctx.lineWidth = 0.5 / k;
        ctx.stroke(bordersPath);
      }

      // ---- Mexico -------------------------------------------------------
      if (mexicoFill && mexicoOutline) {
        const hot = hoverMexico || entering;
        // In flight the fill turns into the board's land colour, so landing on
        // /mexico continues the picture instead of swapping it. (Amber over
        // this blue goes olive and muddy at close range anyway.)
        ctx.fillStyle = entering
          ? '#0e2035'
          : hoverMexico
            ? 'rgba(255, 209, 102, 0.18)'
            : 'rgba(255, 209, 102, 0.1)';
        ctx.fill(mexicoFill);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = hot ? 'rgba(255, 209, 102, 0.22)' : 'rgba(255, 209, 102, 0.12)';
        ctx.lineWidth = 4 / k;
        ctx.stroke(mexicoOutline);
        ctx.strokeStyle = hot ? 'rgba(255, 228, 160, 0.95)' : 'rgba(255, 220, 140, 0.7)';
        ctx.lineWidth = 0.9 / k;
        ctx.stroke(mexicoOutline);
        ctx.restore();
      }

      // ---- the ships' loops ----------------------------------------------
      // Faint in each ship's colour; the selected (or hovered) one lit up.
      if (rutasBarcos.length) {
        const foco = hoverBarco?.id ?? sim.seleccion;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        for (const r of rutasBarcos) {
          const lit = r.id === foco;
          ctx.strokeStyle = conAlfa(r.color, lit ? 0.75 : foco ? 0.12 : 0.22);
          ctx.lineWidth = (lit ? 1.6 : 0.9) / k;
          ctx.stroke(r.path);
        }
        ctx.restore();
      }

      ctx.restore();
    }

    ctx.restore();

    pintarPuertosLejanos(ctx);

    // The name sits under Mexico in screen space, so it stays the same size
    // while you zoom; on every copy of the world that's on screen.
    const at = projection(CENTRO_MEXICO);
    if (at && mexicoFill) {
      ctx.font = '600 11px Inter, "Segoe UI", system-ui, sans-serif';
      ctx.letterSpacing = '4px';
      ctx.textAlign = 'center';
      ctx.lineJoin = 'round';
      for (const ox of worldOffsets()) {
        const x = transform.applyX(at[0] + ox);
        const y = transform.applyY(at[1]);
        ctx.strokeStyle = 'rgba(3, 9, 18, 0.85)';
        ctx.lineWidth = 3;
        ctx.strokeText('MÉXICO', x, y);
        ctx.fillStyle = hoverMexico || entering ? '#fff1cc' : 'rgba(255, 220, 140, 0.85)';
        ctx.fillText('MÉXICO', x, y);
      }
      ctx.letterSpacing = '0px';
      ctx.textAlign = 'left';
    }

    pintarPetroleros(ctx);
    pintarBarcos(ctx, now);
  }

  // ---- ships ------------------------------------------------------------------

  /** The buyers' tankers (`petroleros.ts`): small hulls in a light crude tone, under the player's ships, all the way to their far port. */
  const PETROLERO = '#e3935a';
  const COMBUSTIBLE_PEMEX = '#f5b971';
  function pintarPetroleros(ctx: CanvasRenderingContext2D) {
    if (!projection) return;
    const pxKm = pxPorKm();
    for (const p of sim.petroleros) {
      const km = kmEnHoras(p.trayecto, sim.horas - p.salida);
      const head = projection(puntoEn(p.trayecto, km));
      const back = projection(puntoEn(p.trayecto, Math.max(0, km - Math.max(1, 8 / pxKm))));
      if (!head) continue;
      let rumbo = 0;
      if (back) {
        let dx = head[0] - back[0];
        if (Math.abs(dx) > worldWidth / 2) dx -= Math.sign(dx) * worldWidth;
        rumbo = Math.atan2(head[1] - back[1], dx);
      }
      for (const ox of worldOffsets()) {
        const hx = transform.applyX(head[0] + ox);
        const hy = transform.applyY(head[1]);
        if (hx < -30 || hx > width + 30 || hy < -30 || hy > height + 30) continue;
        // Crude's tone for the buyers', fuel's for Pemex's from Deer Park.
        const color = p.carga === 'combustible' ? COMBUSTIBLE_PEMEX : PETROLERO;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const glow = ctx.createRadialGradient(hx, hy, 0, hx, hy, 9);
        glow.addColorStop(0, conAlfa(color, 0.3));
        glow.addColorStop(1, conAlfa(color, 0));
        ctx.fillStyle = glow;
        ctx.fillRect(hx - 9, hy - 9, 18, 18);
        ctx.restore();
        const L = CASCO_PX * 0.8 * Math.min(1.6, 0.9 + 0.12 * Math.sqrt(transform.k));
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
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = 'rgba(10, 14, 22, 0.8)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  /** Screen length of a ship's hull at world scale, px. */
  const CASCO_PX = 9;
  /** Screen length of the wake behind it, px. */
  const ESTELA_PX = 46;

  function conAlfa(hex: string, a: number): string {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  }

  /** Screen px per km at the current zoom (true at the equator; enough for sizes and headings). */
  const pxPorKm = () => (transform.k * (projection?.scale() ?? 1)) / 6371;

  /** Shanghái and Róterdam: where the crossings end. On every copy of the world. */
  function pintarPuertosLejanos(ctx: CanvasRenderingContext2D) {
    if (!projection) return;
    ctx.save();
    ctx.font = '600 10px Inter, "Segoe UI", system-ui, sans-serif';
    ctx.letterSpacing = '1px';
    ctx.lineJoin = 'round';
    for (const p of PUERTAS) {
      const q = projection(p.haciaLonLat);
      if (!q) continue;
      for (const ox of worldOffsets()) {
        const x = transform.applyX(q[0] + ox);
        const y = transform.applyY(q[1]);
        if (x < -60 || x > width + 60 || y < -20 || y > height + 20) continue;
        ctx.fillStyle = '#04101f';
        ctx.strokeStyle = 'rgba(76, 201, 255, 0.9)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = 'rgba(3, 9, 18, 0.85)';
        ctx.lineWidth = 3;
        ctx.strokeText(p.hacia, x + 8, y + 3.5);
        ctx.fillStyle = '#cfeaff';
        ctx.fillText(p.hacia, x + 8, y + 3.5);
      }
    }
    ctx.restore();
  }

  /** A polyline in path space, split wherever it jumps across the map's seam. */
  function tramos(lonLats: LonLat[]): [number, number][][] {
    const out: [number, number][][] = [];
    let run: [number, number][] = [];
    for (const ll of lonLats) {
      const q = projection?.(ll);
      if (!q) continue;
      const prev = run[run.length - 1];
      if (prev && Math.abs(q[0] - prev[0]) > worldWidth / 2) {
        if (run.length > 1) out.push(run);
        run = [];
      }
      run.push(q);
    }
    if (run.length > 1) out.push(run);
    return out;
  }

  /**
   * Every ship, the selected one last so it's on top: a fading wake along its
   * lane, a glow, and a hull pointing where it's headed. In port, a ring that
   * fills up until it sails. Records each drawn hull for hit-testing.
   */
  function pintarBarcos(ctx: CanvasRenderingContext2D, now: number) {
    cabezas = [];
    if (!projection) return;
    const pxKm = pxPorKm();
    const orden = [...sim.barcos].sort((a, b) => Number(a.id === sim.seleccion) - Number(b.id === sim.seleccion));
    for (const b of orden) {
      const leg = trayectoActual(b);
      const head = projection(posicion(b));
      if (!head) continue;
      // Heading from a short stretch behind the bow (ahead of it, right out of port).
      const d = Math.max(1, 8 / pxKm);
      const back = projection(b.km > d ? puntoEn(leg, b.km - d) : posicion(b));
      const fwd = projection(b.km > d ? posicion(b) : puntoEn(leg, b.km + d));
      let rumbo = 0;
      if (back && fwd) {
        let dx = fwd[0] - back[0];
        if (Math.abs(dx) > worldWidth / 2) dx -= Math.sign(dx) * worldWidth;
        rumbo = Math.atan2(fwd[1] - back[1], dx);
      }
      const estela = b.estado === 'ruta' ? tramos(seccion(leg, b.km - ESTELA_PX / pxKm, b.km)) : [];
      const sel = sim.seleccion === b.id;
      const hot = hoverBarco?.id === b.id;

      for (const ox of worldOffsets()) {
        const hx = transform.applyX(head[0] + ox);
        const hy = transform.applyY(head[1]);
        if (hx < -60 || hx > width + 60 || hy < -60 || hy > height + 60) continue;
        cabezas.push({ barco: b, x: hx, y: hy });

        // Wake: from nothing to the stern, added on like a light trail.
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (const run of estela) {
          const [ax, ay] = run[0];
          const g = ctx.createLinearGradient(transform.applyX(ax + ox), transform.applyY(ay), hx, hy);
          g.addColorStop(0, conAlfa(b.color, 0));
          g.addColorStop(1, conAlfa(b.color, 0.5));
          ctx.strokeStyle = g;
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          run.forEach(([x, y], i) => {
            const sx = transform.applyX(x + ox);
            const sy = transform.applyY(y);
            if (i) ctx.lineTo(sx, sy);
            else ctx.moveTo(sx, sy);
          });
          ctx.stroke();
        }

        const glow = ctx.createRadialGradient(hx, hy, 0, hx, hy, 13);
        glow.addColorStop(0, conAlfa(b.color, sel || hot ? 0.6 : 0.35));
        glow.addColorStop(1, conAlfa(b.color, 0));
        ctx.fillStyle = glow;
        ctx.fillRect(hx - 13, hy - 13, 26, 26);
        ctx.restore();

        // Hull: pointed bow at the ship's position, square stern, a pale bridge aft.
        const L = CASCO_PX * Math.min(1.7, 0.9 + 0.12 * Math.sqrt(transform.k)) * (sel || hot ? 1.2 : 1);
        const W = L * 0.42;
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
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillRect(-L * 0.9, -W * 0.3, L * 0.18, W * 0.6);
        ctx.restore();

        const cx = hx - Math.cos(rumbo) * L * 0.5;
        const cy = hy - Math.sin(rumbo) * L * 0.5;
        const radio = Math.max(8, L * 0.7);
        if (b.estado === 'parada') {
          const total = esperaTotal(b);
          const hecho = total > 0 ? 1 - b.espera / total : 1;
          ctx.lineCap = 'round';
          ctx.lineWidth = 2;
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
          ctx.beginPath();
          ctx.arc(cx, cy, radio, 0, Math.PI * 2);
          ctx.stroke();
          ctx.strokeStyle = b.color;
          ctx.beginPath();
          ctx.arc(cx, cy, radio, -Math.PI / 2, -Math.PI / 2 + hecho * Math.PI * 2);
          ctx.stroke();
        }
        if (sel) {
          ctx.strokeStyle = conAlfa(b.color, 0.85);
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(cx, cy, radio + 4 + Math.sin(now / 260) * 1.5, 0, Math.PI * 2);
          ctx.stroke();
          // Its name, so the one you picked reads at a glance among the rest.
          ctx.font = '600 10px Inter, "Segoe UI", system-ui, sans-serif';
          ctx.lineJoin = 'round';
          ctx.strokeStyle = 'rgba(3, 9, 18, 0.85)';
          ctx.lineWidth = 3;
          ctx.strokeText(b.nombre, cx + radio + 9, cy + 3.5);
          ctx.fillStyle = conAlfa(b.color, 1);
          ctx.fillText(b.nombre, cx + radio + 9, cy + 3.5);
        }
      }
    }
  }

  /** The ship drawn under a screen point, if any (the nearest within reach). */
  function barcoEn(mx: number, my: number): Barco | null {
    let mejor: Barco | null = null;
    let mejorD = 12;
    for (const c of cabezas) {
      const d = Math.hypot(c.x - mx, c.y - my);
      if (d < mejorD) {
        mejorD = d;
        mejor = c.barco;
      }
    }
    return mejor;
  }

  function onPointerMove(event: PointerEvent) {
    if (!canvas || event.buttons) return;
    const rect = canvas.getBoundingClientRect();
    const mx = event.clientX - rect.left;
    const my = event.clientY - rect.top;
    pointer = { x: event.clientX, y: event.clientY };
    // A ship off Mexico's coast is a ship, not a way into the board.
    const barco = barcoEn(mx, my);
    const hit = !barco && isMexico(mx, my);
    if (barco !== hoverBarco || hit !== hoverMexico) {
      hoverBarco = barco;
      hoverMexico = hit;
      requestDraw();
    }
  }

  function onPointerLeave() {
    if (!hoverMexico && !hoverBarco) return;
    hoverMexico = false;
    hoverBarco = null;
    requestDraw();
  }

  function onClick(event: MouseEvent) {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = event.clientX - rect.left;
    const my = event.clientY - rect.top;
    const barco = barcoEn(mx, my);
    if (barco) {
      sim.seleccionar(barco.id);
      requestDraw();
    } else if (isMexico(mx, my)) enterMexico();
  }

  // ---- lifecycle --------------------------------------------------------

  $effect(() => {
    // Size tracking. The canvas backing store is kept at devicePixelRatio so
    // hairlines land on real device pixels instead of being resampled.
    if (!host || !canvas) return;
    const observer = new ResizeObserver(() => {
      // Read before the size changes: it needs the old projection and size.
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
      lookAt(centre, transform.k);
      // Resizing the backing store wipes it. Paint now, inside the observer
      // callback (before the browser paints), instead of queueing a frame —
      // otherwise every resize flashes one empty frame.
      draw();
    });
    observer.observe(host);
    return () => observer.disconnect();
  });

  $effect(() => {
    // Rebake when the projection choice changes, and keep looking at the same
    // place. `projectionKey` is the only dependency: the rest is untracked
    // because `lookAt` writes `transform`, which this effect reads.
    projectionKey;
    untrack(() => {
      const centre = viewCentre(); // still the old projection here
      rebuild();
      lookAt(centre, transform.k);
      requestDraw();
    });
  });

  $effect(() => {
    // Coastline resolution follows the zoom level; each file is fetched once.
    let cancelled = false;
    loadWorld(resolution).then((w) => {
      if (cancelled) return;
      world = w;
      bakeStatic();
      requestDraw();
    });
    return () => {
      cancelled = true;
    };
  });

  $effect(() => {
    // Mexico's detailed outline: the same file the board loads, so it's
    // already cached when you go in.
    let cancelled = false;
    loadMexico().then((m) => {
      if (cancelled) return;
      mexico = m;
      bakeStatic();
      requestDraw();
    });
    return () => {
      cancelled = true;
    };
  });

  $effect(() => {
    if (!canvas) return;
    zoomBehaviour = d3zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([1, 48])
      // d3's default filter, plus: hands off the map while the camera flies in.
      // A drag takes the camera back from a flight to a ship or a followed one.
      .filter((event: MouseEvent) => {
        if (entering) return false;
        if (event.type === 'mousedown' || event.type === 'touchstart') {
          fly = null;
          sim.siguiendo = false;
        }
        return (!event.ctrlKey || event.type === 'wheel') && !event.button;
      })
      .on('zoom', (event) => {
        transform = event.transform;
        // Only ever step up in detail — dropping back to 110m on zoom-out would
        // pop the coastline every time you scrub the wheel.
        if (transform.k >= HI_RES_AT && resolution === '110m') resolution = '50m';
        requestDraw();
      });
    const selection = select(canvas);
    selection.call(zoomBehaviour);
    // Untracked: `applyTranslateExtent` reads `wraps`, and the projection
    // effect already re-fences on a projection change. Tracking it here would
    // tear down and rebuild the whole zoom behaviour every time.
    untrack(applyTranslateExtent);
    return () => {
      selection.on('.zoom', null);
      zoomBehaviour = null;
    };
  });

  // ---- the game -------------------------------------------------------------

  // The clock runs while a world view is open: ships are out there sailing.
  $effect(() => {
    sim.cargar();
  });
  $effect(() => sim.attach());

  $effect(() => {
    // A ship put in service or retired: re-bake the loops.
    sim.barcos;
    untrack(() => {
      bakeRutas();
      if (hoverBarco && !sim.barcos.includes(hoverBarco)) hoverBarco = null;
      requestDraw();
    });
  });

  $effect(() => {
    // Anything that (re)starts motion, or changes what's lit.
    sim.corriendo;
    sim.seleccion;
    sim.siguiendo;
    requestDraw();
  });

  $effect(() => {
    // Camera requests from the fleet panel. Untracked: flying reads the camera.
    const pedido = tablero.irA;
    if (!pedido) return;
    untrack(() => {
      const b = sim.barcos.find((x) => x.id === pedido.id);
      if (b) volarABarco(b);
    });
  });

  // Arriving already following a ship (from the board's "Ver en el globo", say):
  // fly to it once the map has a size and the fleet is loaded.
  let llegada = true;
  $effect(() => {
    if (!llegada || sim.estado !== 'lista') return;
    untrack(() => {
      if (!projection) return;
      llegada = false;
      const b = sim.siguiendo ? barcoSeleccionado() : null;
      if (b) volarABarco(b);
    });
  });

  $effect(() => () => {
    if (frame) cancelAnimationFrame(frame);
  });

  // Live line for the hovered ship; reads the clock so it updates as it sails.
  const lineaBarco = $derived.by(() => {
    sim.horas;
    return hoverBarco ? estadoUnidad(hoverBarco) : '';
  });

  function resetView() {
    if (!canvas || !zoomBehaviour) return;
    select(canvas).call(zoomBehaviour.transform, zoomIdentity);
  }
</script>

<svelte:window bind:innerWidth />

<div class="host" bind:this={host}>
  <canvas
    bind:this={canvas}
    class:pointing={hoverMexico || hoverBarco !== null}
    onpointermove={onPointerMove}
    onpointerleave={onPointerLeave}
    onclick={onClick}
  ></canvas>
</div>

{#if hoverBarco}
  <div
    class="tip panel"
    class:flip={pointer.x > innerWidth - 260}
    style:left="{pointer.x}px"
    style:top="{pointer.y}px"
  >
    <span class="label tip-kind" style:color={hoverBarco.color}>
      {CLASES_BARCO[hoverBarco.clase].nombre} · {hoverBarco.id}
    </span>
    <strong>{hoverBarco.nombre}</strong>
    <span class="tip-sub">{lineaBarco}</span>
  </div>
{/if}

<div class="tools panel">
  <button class="ctl enter" onclick={enterMexico} disabled={entering}>Entrar a México ›</button>
  <span class="sep"></span>
  {#each Object.entries(PROJECTIONS) as [key, p] (key)}
    <button
      class="ctl"
      aria-pressed={projectionKey === key}
      onclick={() => (projectionKey = key as ProjectionKey)}
    >
      {p.label}
    </button>
  {/each}
  <span class="sep"></span>
  <span class="label mono">{transform.k.toFixed(1)}× · {resolution}</span>
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

  /* The hovered ship's card, by the cursor: the board's tooltip. */
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

  canvas:active {
    cursor: grabbing;
  }

  /* The way into the board: amber, like Mexico on the map. */
  .tools .enter {
    border-color: rgba(255, 209, 102, 0.45);
    color: #fff1cc;
    background: rgba(255, 209, 102, 0.08);
  }

  .tools .enter:hover {
    background: rgba(255, 209, 102, 0.16);
    border-color: rgba(255, 209, 102, 0.6);
  }

  .tools .enter:disabled {
    opacity: 0.6;
    cursor: default;
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

  .sep {
    width: 1px;
    align-self: stretch;
    background: var(--line);
    margin: 0 0.25rem;
  }

  @media (max-width: 900px) {
    .tools {
      display: none;
    }
  }
</style>
