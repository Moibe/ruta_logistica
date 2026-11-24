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
  import { CAPACIDAD, DUEÑOS, kmALaVia, type Dueño } from '$lib/domain/red';
  import { MINAS, NOMBRE_MINERAL, cifraMina, type Mina } from '$lib/domain/mineria';
  import { PARTE_PRIVADOS, llevanPrivados, ACERERAS, FLUJOS, NOMBRE_PRODUCTO, aceroAño, autosAño, toneladasAño } from '$lib/domain/cadenas';
  import { EMPRESAS_INDUSTRIA, INDUSTRIAS, PARCIAL_RAIAVL, añoRaiavl, plantasDe, type Industria } from '$lib/domain/industrias';
  import { obraVia } from '$lib/domain/obrasVia';
  import { clavePolo, estadoReal, fechaEnPalabras, fichaReal, TEXTO_ETAPA } from '$lib/domain/realidad';
  import {
    capacidadDucto,
    DUCTOS,
    GAS_REGIONES,
    NOMBRE_RED,
    OBRAS_GAS,
    situacionDucto,
    type Ducto,
    type SituacionDucto,
  } from '$lib/domain/ductos';
  import { ADUANA_DEL_SITIO, EXPORTACIONES, SALIDAS } from '$lib/domain/exportaciones';
  import {
    delPais,
    DIAS_EN_PATIO,
    realDelAño,
    ESTADOS_CONSUMO,
    PUERTO_DE_REFINERIA,
    PUERTOS_COMBUSTIBLE,
    REFINERIA_DEL_PUERTO,
    REPARTO,
    TERMINALES,
    ZONA,
    ZONAS_DEL_ESTADO,
    type Terminal,
  } from '$lib/domain/combustibles';
  import { ENERGIA, OBRAS_ENERGIA, obraEnergia, REGION_DEL_ESTADO, SUBREGIONES_DEL_ESTADO, UMBRALES, type NivelEnergia } from '$lib/domain/energia';
  import {
    OBRAS_DE_REFINERIA,
    obraPemex,
    obraPrincipal,
    procesoReal,
    REFINERIAS,
    refineria as refineriaPorId,
    type Refineria,
  } from '$lib/domain/petroleo';
  import { añoDe, fechaLarga as fechaDeJuego, horasDeFecha } from '$lib/domain/calendario';
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
    AEROPUERTOS,
    añoDeCarga,
    SERIE_AEROPUERTOS,
    toneladas,
    type Aeropuerto,
    type Ciudad,
    nombreCorto,
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
  import { COLOR_DUEÑO, COLOR_USO, INDUSTRIA, MINERIA, AEROPUERTO, COMBUSTIBLE, CRUDO, GAS, PLATAFORMA, POLO, PUNTOS_AVION, REFINERIA } from './simbolos';
  import { abastoDiario, BASES_ABASTO, CAYO_ARCAS, COMPLEJOS, produccionComplejo, type Complejo } from '$lib/domain/plataformas';
  import { comercioDe, NOMBRE_CARGA, TIPOS_CARGA, type TipoCarga } from '$lib/domain/comercioMar';

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

  const POLO_CLARO = '#ffe4f1';

  const COLOR_SIN_DUEÑO = '#64748b';
  /** Track out of service since before 2018: there, but dead. */
  const VIA_MUERTA = 'rgba(138, 164, 194, 0.3)';

  /** Each region painted by how much margin it has at its tighter peak. */
  /** Mexico's own fill, under every layer of the geography. */
  const COLOR_PAIS = '#0e2035';
  const COLOR_ENERGIA: Record<NivelEnergia, string> = {
    holgado: 'rgba(74, 222, 128, 0.16)',
    justo: 'rgba(251, 191, 36, 0.2)',
    critico: 'rgba(248, 113, 113, 0.28)',
  };
  const TEXTO_NIVEL: Record<NivelEnergia, string> = {
    holgado: 'Holgada · arriba de la reserva de planeación',
    justo: 'Justa · arriba del mínimo para operar',
    critico: 'Crítica · debajo del mínimo: los polos no se llenan',
  };

  /** The plane on the canvas, heading north-east, half-size `s` px. */
  function avion(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
    const c = Math.SQRT1_2;
    ctx.beginPath();
    PUNTOS_AVION.forEach(([px, py], i) => {
      const rx = (px * c - py * c) * s;
      const ry = (px * c + py * c) * s;
      if (i === 0) ctx.moveTo(x + rx, y + ry);
      else ctx.lineTo(x + rx, y + ry);
    });
    ctx.closePath();
  }
  /** Half-size of an airport's plane by the tonnes it moved: 4.5 px for the smallest, about 9 for the AIFA. */
  const tamañoAvion = (t: number) => 3.6 + Math.sqrt(t / 1000) * 0.27;

  /** The year an airport shows: 2025 in the game, the date's year in Realidad. */
  const añoAeropuerto = () => (sim.modo === 'realidad' ? añoDeCarga(añoDe(sim.horas)) : 2025);
  /** Its plane is sized by a whole year: the running one is still partial, so the one before. */
  const añoTamaño = () => {
    const a = añoAeropuerto();
    return a === SERIE_AEROPUERTOS.parcial.año ? a - 1 : a;
  };
  /** In Realidad an airport shows from its first month with cargo (the AIFA, from March 2022). */
  const aeropuertoVisible = (a: Aeropuerto) => sim.modo !== 'realidad' || sim.horas >= horasDeFecha(a.desde);
  const MESES_CARGA = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  const colorDucto = (d: Ducto) => (d.tipo === 'gas' ? GAS : d.tipo === 'crudo' ? CRUDO : REFINERIA);
  /** A pipeline on the board now: those after 2018 by their real dates, in the game as in Realidad. */
  const situacionAhora = (d: Ducto): SituacionDucto => situacionDucto(d, d.real ? estadoReal(d.id, sim.horas).etapa : null);
  /** The pipeline a State gas work widens (the Mayakan, by the Cuxtal II). */
  const OBRA_DEL_DUCTO = new Map(OBRAS_GAS.map((o) => [o.ducto, o]));
  /** A drop of oil, point up, half-size `s`. */
  function gota(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
    ctx.beginPath();
    ctx.moveTo(x, y - s * 1.15);
    ctx.bezierCurveTo(x + s * 0.35, y - s * 0.55, x + s * 0.85, y - s * 0.05, x + s * 0.85, y + s * 0.35);
    ctx.arc(x, y + s * 0.35, s * 0.85, 0, Math.PI, false);
    ctx.bezierCurveTo(x - s * 0.85, y - s * 0.05, x - s * 0.35, y - s * 0.55, x, y - s * 1.15);
    ctx.closePath();
  }
  /** Half-size of a refinery's drop by the crude it runs (Mbd): 3.4 px empty, about 9 at 250. */
  const tamañoGota = (mbd: number) => 3.4 + Math.sqrt(Math.max(0, mbd)) * 0.36;
  /** The Olmeca runs once it's built (game) or opened (Realidad); the others always run. */
  function refineriaOpera(r: Refineria): boolean {
    if (!r.nueva) return true;
    return sim.modo === 'realidad' ? sim.real.get(r.id)?.etapa === 'en-operacion' : sim.obrasPemex.get(r.id)?.fase === 'en-servicio';
  }
  /** A refinery's crude run on the board: the game's, or the real one that month or year in Realidad (null when unpublished). */
  function procesoMapa(r: Refineria): number | null {
    if (sim.modo === 'realidad') return procesoReal(r, sim.horas)?.mbd ?? null;
    return sim.refinacion?.porRefineria.get(r.id)?.proceso ?? r.proceso2018;
  }
  /** The catalog card a refinery opens on: Deer Park's purchase until it's Pemex's, else its first work. */
  const fichaDeRefineria = (r: Refineria) =>
    r.extranjera ? (sim.modo === 'juego' && sim.deerParkPropia ? 'deer-park-mejora' : 'deer-park-compra') : obraPrincipal(r.id);

  /** A plant's colour by its technology. */
  function colorTec(t: string): string {
    if (/hidro/i.test(t)) return '#60a5fa';
    if (/fotovolt|solar/i.test(t)) return '#facc15';
    if (/e.lic/i.test(t)) return '#5eead4';
    if (/nuclear/i.test(t)) return '#c084fc';
    if (/geot/i.test(t)) return '#fda4af';
    return '#fb923c';
  }
  const TECNOLOGIAS = [
    ['Térmica', '#fb923c'],
    ['Hidroeléctrica', '#60a5fa'],
    ['Solar', '#facc15'],
    ['Eólica', '#5eead4'],
    ['Nuclear', '#c084fc'],
    ['Geotérmica', '#fda4af'],
  ];

  type PlantaMapa = {
    nombre: string;
    tecnologia: string;
    mw: number;
    region: string;
    dueño: 'CFE' | 'privada';
    /** Game hour it came (or comes) into service; null for the plants of 2018. */
    desde: number | null;
    /** A CFE work of the player's. */
    obra?: string;
    /** The CFE hasn't chosen its site: the municipality the game puts it in. */
    sitioPorDefinir?: string;
  };
  const PLANTAS: PlantaMapa[] = [
    ...ENERGIA.plantas2018.map((p) => ({ nombre: p.nombre, tecnologia: p.tecnologia, mw: p.mw, region: p.region, dueño: p.dueño, desde: null })),
    ...ENERGIA.privadas.map((p) => ({
      nombre: p.nombre,
      tecnologia: p.tecnologia,
      mw: p.mw,
      region: p.region,
      dueño: 'privada' as const,
      desde: horasDeFecha(p.fecha),
    })),
    ...OBRAS_ENERGIA.map((o) => ({
      nombre: o.nombre,
      tecnologia: o.tecnologia,
      mw: o.mw,
      region: o.region,
      dueño: 'CFE' as const,
      desde: null,
      obra: o.id,
      ...(o.sitioPorDefinir ? { sitioPorDefinir: o.municipio } : {}),
    })),
  ];
  const LONLAT_PLANTAS: LonLat[] = [...ENERGIA.plantas2018, ...ENERGIA.privadas, ...OBRAS_ENERGIA].map((p) => p.lonLat);
  const radioPlanta = (mw: number) => 1.6 + Math.sqrt(mw) / 7;


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

  /** The layers live in `tablero`: the layers panel toggles them, the map draws them. */
  const layers = tablero.capas;
  /** A big private industry is on the board from the day it starts working until the day it stops. */
  const industriaVisible = (p: { desde?: string; hasta?: string }) => (!p.desde || sim.horas >= horasDeFecha(p.desde)) && (!p.hasta || sim.horas < horasDeFecha(p.hasta));
  const TIPO_INDUSTRIA: Record<Industria['tipo'], string> = {
    armadora: 'Armadora de vehículos · industria privada',
    logistica: 'Parque logístico · privado',
    acerera: 'Siderúrgica · industria privada',
    metalurgica: 'Fundición y refinería · industria privada',
  };
  /** Its company's figures at the clock's year, and whether that year is the register's partial one. */
  function cifrasIndustria(p: Industria) {
    const e = p.empresa ? EMPRESAS_INDUSTRIA[p.empresa] : null;
    if (!e) return null;
    const año = añoRaiavl(añoDe(sim.horas));
    const s = e.serie[String(año)];
    if (!s) return null;
    return { empresa: e.nombre, año, ...s, plantas: plantasDe(p.empresa!).filter(industriaVisible).length, parcial: año === PARCIAL_RAIAVL.año ? PARCIAL_RAIAVL.meses : 0 };
  }

  // ---- fuel ---------------------------------------------------------------------------------

  /**
   * Share of a state's fuel this game year that came from the country's
   * refineries (0–1). Early in a year, before a day has gone by, today's
   * pipeline flows stand in.
   */
  function parteDelPais(estado: string): number {
    const c = sim.cuentaCombustibles(añoDe(sim.horas), estado);
    if (c.consumo > 0) return delPais(c);
    const a = sim.abasto;
    const usa = a?.consumo.get(estado) ?? 0;
    return a && usa > 0 ? (a.porDucto.get(estado) ?? 0) / usa : 0;
  }

  /** A Pemex terminal in the colour of how its fuel gets there: a refinery zone's pipelines, the sea, the rail. */
  const COLOR_RED_TERMINAL: Record<Terminal['red'], string> = {
    centro: COMBUSTIBLE,
    noreste: COMBUSTIBLE,
    sur: COMBUSTIBLE,
    mar: '#67e8f9',
    tren: '#c3a6ff',
  };
  const MEDIOS: Record<string, string> = { ducto: 'ducto', buquetanque: 'buque tanque', carrotanque: 'carro tanque', autotanque: 'autotanque', refineria: 'la refinería' };

  /** How a terminal is supplied (SENER's map) and what that means in the game. */
  function textoTerminal(t: Terminal): { como: string; juego: string } {
    const medios = t.medio.split('+').map((m) => MEDIOS[m] ?? m);
    const como = `Se surte ${medios.map((m) => (m === 'la refinería' ? 'de la refinería' : `por ${m}`)).join(' y ')}${t.desde ? ` desde ${t.desde}` : ''}`;
    const juego =
      t.red === 'mar'
        ? 'Llega por mar: en el juego, en tus buques tanque o importado'
        : t.red === 'tren'
          ? 'Llega por tren: en el juego, en tus trenes o importado'
          : `Por los ductos de la zona ${ZONA.get(t.red)?.nombre}`;
    return { como, juego };
  }

  /** The fill of a state on the fuel layer: dark when it imports, amber as more of it comes from the country. */
  const colorCombustible = (parte: number) => `rgba(245, 185, 113, ${(0.05 + 0.5 * Math.max(0, Math.min(1, parte))).toFixed(3)})`;

  /** The country's fuel this year, for the fuel layer's legend: the game's so far, or the real year's. */
  const resumenCombustibles = $derived.by(() => {
    if (!layers.combustibles) return null;
    sim.horas;
    const año = añoDe(sim.horas);
    if (sim.modo === 'realidad') {
      const r = realDelAño(año);
      return r && r.hecho != null && r.importado != null
        ? `${año}${r.parcial ? ` (${r.parcial})` : ''}: Pemex hizo ${fmtMil(r.hecho)} mil b/d de gasolina, diésel y turbosina e importó ${fmtMil(r.importado)} mil; ` +
            `exportó ${fmtMil(r.exportado ?? 0)} mil b/d de crudo.`
        : null;
    }
    const c = sim.cuentaCombustibles(año);
    const dias = sim.diasContados(año);
    const mbd = (b: number) => fmtMil(b / dias / 1000);
    const crudo = sim.crudoExportado;
    return (
      `${año}: del país vino el ${Math.round(delPais(c) * 100)} % (${mbd(c.ducto)} mil b/d por ducto, ${mbd(c.tren)} en tren, ${mbd(c.barco)} en barco); ` +
      `se importan ${mbd(c.importado)} mil b/d. Crudo exportado: ${fmtMil(crudo)} mil b/d.`
    );
  });

  /** What the track's colour says (the rail legend, in the left column, picks it). */
  const modoVias = $derived(tablero.modoVias);

  type Target =
    | { kind: 'unidad'; unidad: Unidad }
    | { kind: 'puerta'; puerta: Puerta }
    | { kind: 'puerto'; puerto: Puerto }
    | { kind: 'aeropuerto'; aeropuerto: Aeropuerto }
    | { kind: 'ciudad'; ciudad: Ciudad }
    | { kind: 'polo'; polo: Polo }
    | { kind: 'via'; base: number }
    | { kind: 'planta'; indice: number }
    | { kind: 'refineria'; refineria: Refineria }
    | { kind: 'industria'; industria: Industria }
    | { kind: 'mina'; mina: Mina }
    | { kind: 'terminal'; terminal: Terminal }
    | { kind: 'complejo'; complejo: Complejo }
    | { kind: 'cayo-arcas' }
    | { kind: 'ducto'; ducto: Ducto }
    /** `region`: the pointer is over a system of its own inside the state (Mulegé), with the electricity layer on. */
    | { kind: 'estado'; estado: EstadoProps; region?: string };

  let host = $state.raw<HTMLDivElement>();
  let canvas = $state.raw<HTMLCanvasElement>();
  let transform = $state.raw<ZoomTransform>(zoomIdentity);
  let hovered = $state.raw<Target | null>(null);
  let pointer = $state({ x: 0, y: 0 });
  let innerWidth = $state(0);
  let innerHeight = $state(0);
  let status = $state<'cargando' | 'listo' | 'error'>('cargando');

  // Plain locals: read only when painting, rebuilt imperatively.
  let width = 0;
  let height = 0;
  let dpr = 1;
  let projection: GeoProjection | null = null;
  /** Bumped whenever the projection is (re)made: a camera request waiting for it can fly. */
  let proyeccionLista = $state(0);
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
    /** Electricity systems of their own inside a state (Mulegé): their area, clipped by the state when drawn, and their border. */
    subregiones: { region: string; estado: string; zona: Path2D; frontera: Path2D }[];
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
  /** Track the State's works laid (new and parallel lines): an ink-white casing under the rail, in every mode. */
  let viaDelEstado: Path2D | null = null;
  /** Each rail work's line, as measured on the 2018 network (`sim.medidas`). */
  let obraPaths = new Map<string, { path: Path2D; bounds: [[number, number], [number, number]] }>();
  /** Each pipeline, baked with the projection. */
  let ductoPaths: { d: Ducto; path: Path2D; bounds: [[number, number], [number, number]] }[] = [];
  /** The selected vehicle's route (one direction of a line, a ship's whole loop), baked on selection. */
  let rutaSel: { id: string; path: Path2D } | null = null;
  /** The Panama Canal, baked from the sea lanes' data. */
  let canalPath: Path2D | null = null;

  /** Projected (un-zoomed path space) positions, rebuilt with the projection. */
  let ciudadPts: [number, number][] = [];
  let puertoPts: [number, number][] = [];
  let aeropuertoPts: [number, number][] = [];
  let puertaPts: [number, number][] = [];
  let poloPts: [number, number][] = [];
  let plantaPts: [number, number][] = [];
  let refineriaPts: [number, number][] = [];
  let industriaPts: [number, number][] = [];
  let minaPts: [number, number][] = [];
  let terminalPts: [number, number][] = [];
  let complejoPts: [number, number][] = [];
  let cayoArcasPt: [number, number] = [NaN, NaN];
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
  /**
   * Plants on the map right now: the 2018 ones, private ones already in service,
   * the CFE works under way or done (the player's, or in Realidad the real ones,
   * where the announced ones show too).
   */
  function plantaVisible(p: PlantaMapa): 'servicio' | 'obra' | 'anunciada' | null {
    if (p.obra) {
      const fase = sim.obrasEnergia.get(p.obra)?.fase;
      if (fase === 'en-servicio') return 'servicio';
      if (fase === 'en-obra') return 'obra';
      return sim.modo === 'realidad' && sim.real.get(p.obra)?.etapa === 'anunciada' ? 'anunciada' : null;
    }
    if (p.desde !== null && p.desde > sim.horas) return null;
    return 'servicio';
  }

  /** A CFE plant's real stage on the date shown (Realidad), for its tooltip: "En obra · ≈ 62 %". */
  function etapaPlanta(id: string): string {
    const r = sim.real.get(id);
    if (!r) return '';
    const texto = TEXTO_ETAPA[r.etapa].charAt(0).toUpperCase() + TEXTO_ETAPA[r.etapa].slice(1);
    return r.etapa === 'en-obra' && r.avance !== null ? `${texto} · ${r.estimado ? '≈ ' : ''}${Math.round(r.avance * 100)} %` : texto;
  }

  const ensuciaCapa = () => {
    capaSucia = true;
    ensucia();
  };

  // ---- projection & baking -------------------------------------------------

  function rebuild() {
    if (!width || !height) return;
    projection = makeProjection();
    proyeccionLista++;
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
    aeropuertoPts = AEROPUERTOS.map((a) => projection!(a.lonLat) ?? [NaN, NaN]);
    puertaPts = PUERTAS.map((p) => projection!(p.lonLat) ?? [NaN, NaN]);
    poloPts = POLOS.map((p) => projection!(p.lonLat) ?? [NaN, NaN]);
    plantaPts = LONLAT_PLANTAS.map((p) => projection!(p) ?? [NaN, NaN]);
    refineriaPts = REFINERIAS.map((r) => projection!(r.lonLat) ?? [NaN, NaN]);
    industriaPts = INDUSTRIAS.map((r) => projection!(r.lonLat) ?? [NaN, NaN]);
    minaPts = MINAS.map((r) => projection!(r.lonLat) ?? [NaN, NaN]);
    terminalPts = TERMINALES.map((t) => projection!(t.lonLat) ?? [NaN, NaN]);
    complejoPts = COMPLEJOS.map((c) => projection!(c.lonLat) ?? [NaN, NaN]);
    cayoArcasPt = projection!(CAYO_ARCAS.lonLat) ?? [NaN, NaN];
    ductoPaths = DUCTOS.map((d) => {
      const g: MultiLineString = { type: 'MultiLineString', coordinates: d.trazo };
      return { d, path: new Path2D(path!(g) ?? ''), bounds: path!.bounds(g) };
    });
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
    // Vertex by vertex, not as GeoJSON: a hand-made ring has no winding order to get wrong.
    const trazo = (pts: LonLat[], cerrado: boolean) => {
      const q = new Path2D();
      pts.forEach((c, i) => {
        const [x, y] = projection!(c) ?? [NaN, NaN];
        if (i === 0) q.moveTo(x, y);
        else q.lineTo(x, y);
      });
      if (cerrado) q.closePath();
      return q;
    };
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
      subregiones: ENERGIA.regiones.flatMap((r) =>
        r.parteDe && r.zona && r.frontera ? [{ region: r.id, estado: r.parteDe, zona: trazo(r.zona, true), frontera: trazo(r.frontera, false) }] : []
      ),
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
    viaDelEstado = new Path2D(
      path({ type: 'MultiLineString', coordinates: red.tramos.filter((t) => red.vias[t.base].nueva).map((t) => t.puntos) }) ?? ''
    );
    const piezas = red.vias.map(() => [] as LonLat[][]);
    const primaria = red.vias.map(() => false);
    for (const t of red.tramos) {
      piezas[t.base].push(t.puntos);
      if (t.clase === 'primaria') primaria[t.base] = true;
    }
    viaPaths = red.vias.map((v, i) => {
      const g: MultiLineString = { type: 'MultiLineString', coordinates: piezas[i] };
      return { path: new Path2D(path!(g) ?? ''), bounds: path!.bounds(g), primaria: primaria[i], operando: v.operando };
    });
    obraPaths = new Map();
    for (const [id, m] of sim.medidas) {
      const g: MultiLineString = { type: 'MultiLineString', coordinates: m.piezas };
      obraPaths.set(id, { path: new Path2D(path(g) ?? ''), bounds: path.bounds(g) });
    }
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
    if (tipo === 'aeropuerto') return AEROPUERTOS.find((a) => a.id === id)?.lonLat ?? null;
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

      ctx.fillStyle = COLOR_PAIS;
      ctx.fill(b.pais);

      // Electricity: every state in its region's colour.
      if (layers.energia && sim.energia.length) {
        const nivel = new Map(sim.energia.map((e) => [e.region.id, e.nivel]));
        for (const est of b.estados) {
          const n = nivel.get(REGION_DEL_ESTADO.get(est.props.clave) ?? '');
          if (!n) continue;
          ctx.fillStyle = COLOR_ENERGIA[n];
          ctx.fill(est.path);
        }
        // A system of its own inside a state (Mulegé): its part of the state
        // in its own colour, and a dashed line where it ends.
        for (const s of b.subregiones) {
          const n = nivel.get(s.region);
          const est = b.estados.find((x) => x.props.clave === s.estado);
          if (!n || !est) continue;
          ctx.save();
          ctx.clip(est.path);
          ctx.fillStyle = COLOR_PAIS;
          ctx.fill(s.zona);
          ctx.fillStyle = COLOR_ENERGIA[n];
          ctx.fill(s.zona);
          ctx.restore();
          ctx.save();
          ctx.setLineDash([4 / k, 3 / k]);
          ctx.strokeStyle = 'rgba(226, 236, 255, 0.45)';
          ctx.lineWidth = 0.9 / k;
          ctx.stroke(s.frontera);
          ctx.restore();
        }
      }

      // Fuel: every state by how much of what it uses came from the country's refineries this year.
      if (layers.combustibles && !layers.energia && sim.modo === 'juego' && sim.abasto) {
        for (const est of b.estados) {
          if (!ESTADOS_CONSUMO.includes(est.props.clave)) continue;
          ctx.fillStyle = colorCombustible(parteDelPais(est.props.clave));
          ctx.fill(est.path);
        }
      }

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

    // Pipelines under the track: gas green, petroleum brown-gold; dashed while
    // being built, dotted and dim out of service, faint on the US side.
    if (layers.ductos) {
      const hot = hovered?.kind === 'ducto' ? hovered.ducto.id : null;
      for (const { d, path: p } of ductoPaths) {
        const s = situacionAhora(d);
        if (s === 'no') continue;
        const ancho = d.red === 'sng' ? 1.5 : d.red === 'importacion' ? 0.8 : d.tipo === 'crudo' ? 1.4 : 1.1;
        ctx.save();
        ctx.globalAlpha = d.red === 'importacion' ? 0.4 : s === 'fuera' ? 0.5 : d.tipo === 'gas' && d.red !== 'privado' ? 0.9 : 0.8;
        if (s === 'obra') ctx.setLineDash([4 / k, 3 / k]);
        else if (s === 'fuera') ctx.setLineDash([1.4 / k, 2.6 / k]);
        ctx.strokeStyle = d.id === hot ? '#ffffff' : colorDucto(d);
        ctx.lineWidth = (d.id === hot ? ancho + 1 : ancho) / k;
        ctx.stroke(p);
        ctx.restore();
      }
      // The State's gas work over the pipeline it widens: dashed ink-white while
      // it's being built, a broad green line once it's done.
      for (const { d, path: p } of ductoPaths) {
        const o = OBRA_DEL_DUCTO.get(d.id);
        const est = o ? sim.obrasEnergia.get(o.id) : null;
        if (!est || est.fase === 'por-construir') continue;
        ctx.save();
        if (est.fase === 'en-obra') {
          ctx.setLineDash([4 / k, 3 / k]);
          ctx.strokeStyle = est.detenida ? 'rgba(248, 113, 113, 0.8)' : 'rgba(244, 241, 222, 0.85)';
          ctx.lineWidth = 2.2 / k;
        } else {
          ctx.strokeStyle = GAS;
          ctx.lineWidth = 2.8 / k;
        }
        ctx.stroke(p);
        ctx.restore();
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
      // The State's own track: an ink-white casing, so a parallel line reads
      // as a second track beside the private one.
      if (viaDelEstado) {
        ctx.strokeStyle = 'rgba(244, 241, 222, 0.42)';
        ctx.lineWidth = 3.6 / k;
        ctx.stroke(viaDelEstado);
      }
      // Realidad: works announced and not begun, as a faint dotted line.
      for (const [id, r] of sim.real) {
        if (r.etapa !== 'anunciada') continue;
        const op = obraPaths.get(id);
        if (!op) continue;
        ctx.save();
        ctx.setLineDash([1.2 / k, 3.2 / k]);
        ctx.strokeStyle = 'rgba(244, 241, 222, 0.5)';
        ctx.lineWidth = 1.3 / k;
        ctx.stroke(op.path);
        ctx.restore();
      }
      // Works under way: their line dashed in ink-white.
      for (const [id, o] of sim.obrasVia) {
        if (o.fase !== 'en-obra') continue;
        const op = obraPaths.get(id);
        if (!op) continue;
        ctx.save();
        ctx.setLineDash([4 / k, 3 / k]);
        ctx.strokeStyle = o.detenida ? 'rgba(248, 113, 113, 0.75)' : 'rgba(244, 241, 222, 0.85)';
        ctx.lineWidth = 1.6 / k;
        ctx.stroke(op.path);
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
    // Without the track layer, trains (and their line) go too; ships stay.
    if (sel && !trazando && (sel.tipo === 'barco' ? layers.barcos : layers.trenes)) {
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

    // The rail work whose card is open, lit along its whole line.
    const obraAbierta = tablero.catalogo && tablero.obraSel ? obraPaths.get(tablero.obraSel) : null;
    if (obraAbierta) {
      ctx.save();
      ctx.translate(transform.x, transform.y);
      ctx.scale(k, k);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(244, 241, 222, 0.18)';
      ctx.lineWidth = 9 / k;
      ctx.stroke(obraAbierta.path);
      ctx.strokeStyle = 'rgba(255, 252, 240, 0.95)';
      ctx.lineWidth = 2.2 / k;
      ctx.setLineDash([6 / k, 4 / k]);
      ctx.stroke(obraAbierta.path);
      ctx.restore();
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
    const trazaTren = trazando && tablero.tipoNuevo === 'tren';
    const trazaBarco = trazando && tablero.tipoNuevo === 'barco';
    const atenuado = (clave: string) =>
      trazaTren ? !conEstacion(clave) : trazaBarco ? clave.startsWith('ciudad:') || clave.startsWith('aeropuerto:') : false;

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

    // Power plants, sized by their MW: the CFE's filled, the private ones as rings;
    // a CFE work under way dashed.
    if (layers.energia) {
      const abierta = tablero.catalogo && tablero.obraSel ? tablero.obraSel : null;
      ctx.save();
      PLANTAS.forEach((p, i) => {
        const vis = plantaVisible(p);
        const elegida = !!p.obra && p.obra === abierta;
        if (!vis && !elegida) return;
        const x = sx(plantaPts[i]);
        const y = sy(plantaPts[i]);
        if (!onScreen(x, y)) return;
        const r = radioPlanta(p.mw) * (k >= 3 ? 1.4 : 1);
        const c = colorTec(p.tecnologia);
        const hot = hovered?.kind === 'planta' && hovered.indice === i;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        if (vis === 'servicio' && p.dueño === 'CFE') {
          ctx.globalAlpha = 0.9;
          ctx.fillStyle = c;
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.strokeStyle = p.obra ? '#ffffff' : 'rgba(3, 9, 18, 0.9)';
          ctx.lineWidth = p.obra ? 1.4 : 1;
          ctx.stroke();
        } else {
          ctx.fillStyle = 'rgba(3, 9, 18, 0.65)';
          ctx.fill();
          ctx.strokeStyle = c;
          ctx.lineWidth = 1.5;
          // Under way: dashed. Only announced (Realidad): dotted and faint.
          if (vis === 'anunciada') {
            ctx.globalAlpha = 0.55;
            ctx.setLineDash([1, 2.5]);
          } else if (vis !== 'servicio') ctx.setLineDash([2, 2]);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;
        }
        if (hot || elegida) {
          ctx.beginPath();
          ctx.arc(x, y, r + 4, 0, Math.PI * 2);
          ctx.strokeStyle = elegida ? 'rgba(255, 252, 240, 0.95)' : 'rgba(255, 255, 255, 0.7)';
          ctx.lineWidth = 1.4;
          if (elegida && vis !== 'servicio') ctx.setLineDash([3, 3]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      });
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
        if (!poloVisible(p.id)) return;
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

    // Cargo airports: a plane, sized by the tonnes it moved in 2025. Faded
    // while laying out a route: they aren't stops.
    if (layers.aeropuertos) {
      const año = añoTamaño();
      AEROPUERTOS.forEach((a, i) => {
        if (!aeropuertoVisible(a)) return;
        const x = sx(aeropuertoPts[i]);
        const y = sy(aeropuertoPts[i]);
        if (!onScreen(x, y)) return;
        const hot = hovered?.kind === 'aeropuerto' && hovered.aeropuerto.id === a.id;
        const s = tamañoAvion(toneladas(a, año)) * (hot ? 1.15 : 1);
        // A dry port: with a station it's a train stop like a city; without, it fades back.
        const clave = `aeropuerto:${a.id}`;
        ctx.globalAlpha = atenuado(clave) ? 0.3 : 1;
        avion(ctx, x, y, s);
        ctx.fillStyle = hot ? '#eef0ff' : AEROPUERTO;
        ctx.fill();
        ctx.strokeStyle = 'rgba(3, 9, 18, 0.9)';
        ctx.lineWidth = 0.9;
        ctx.stroke();
        ctx.globalAlpha = 1;
        const R = s + 1.5;
        taken.push([x - R, y - R, x + R, y + R]);
        if (atenuado(clave)) return;
        labels.push({
          text: a.corto,
          spots: spotsAround(x, y, R),
          size: 10,
          font: `${a.t2025 > 150000 ? 700 : 600} 10px Inter, "Segoe UI", system-ui, sans-serif`,
          color: hot ? '#ffffff' : 'rgba(199, 210, 254, 0.92)',
          // Under ports; over polos and most cities.
          priority: (hot ? 1e9 : 0) + 4e7 + a.t2025,
          halo: true,
        });
      });
    }

    // The big mines: two peaks. Like the industries, they aren't stops yet.
    if (layers.mineria) {
      MINAS.forEach((m, i) => {
        if (!industriaVisible(m)) return;
        const x = sx(minaPts[i]);
        const y = sy(minaPts[i]);
        if (!onScreen(x, y)) return;
        const hot = hovered?.kind === 'mina' && hovered.mina.id === m.id;
        const s = 4.6 * (hot ? 1.15 : 1);
        ctx.globalAlpha = tablero.trazando && !(trazaTren && conEstacion(`mina:${m.id}`)) ? 0.3 : 1;
        ctx.beginPath();
        ctx.moveTo(x - s, y + s * 0.7);
        ctx.lineTo(x - s * 0.35, y - s * 0.8);
        ctx.lineTo(x + s * 0.05, y - s * 0.05);
        ctx.lineTo(x + s * 0.35, y - s * 0.45);
        ctx.lineTo(x + s, y + s * 0.7);
        ctx.closePath();
        ctx.fillStyle = hot ? '#ffffff' : MINERIA;
        ctx.fill();
        ctx.strokeStyle = 'rgba(3, 9, 18, 0.9)';
        ctx.lineWidth = 0.9;
        ctx.stroke();
        ctx.globalAlpha = 1;
        taken.push([x - s - 1, y - s - 1, x + s + 1, y + s + 1]);
        if (tablero.trazando) return;
        labels.push({
          text: m.corto,
          spots: spotsAround(x, y, s + 1.5),
          size: 9.5,
          font: '600 9.5px Inter, "Segoe UI", system-ui, sans-serif',
          color: hot ? '#ffffff' : 'rgba(214, 211, 209, 0.92)',
          priority: (hot ? 1e9 : 0) + 2.1e7,
          halo: true,
        });
      });
    }

    // The big private industries: a factory with a sawtooth roof (a warehouse for a logistics park).
    // Only the plants of a supply chain with a station are stops: the rest fade back while a route is laid out.
    if (layers.industrias) {
      INDUSTRIAS.forEach((p, i) => {
        if (!industriaVisible(p)) return;
        const x = sx(industriaPts[i]);
        const y = sy(industriaPts[i]);
        if (!onScreen(x, y)) return;
        const hot = hovered?.kind === 'industria' && hovered.industria.id === p.id;
        const s = (p.tipo === 'logistica' ? 4.6 : 4.2) * (hot ? 1.15 : 1);
        ctx.globalAlpha = tablero.trazando && !(trazaTren && conEstacion(`industria:${p.id}`)) ? 0.3 : 1;
        ctx.beginPath();
        if (p.tipo === 'logistica') {
          ctx.moveTo(x - s, y + s * 0.7);
          ctx.lineTo(x - s, y - s * 0.2);
          ctx.lineTo(x, y - s * 0.8);
          ctx.lineTo(x + s, y - s * 0.2);
          ctx.lineTo(x + s, y + s * 0.7);
        } else {
          ctx.moveTo(x - s, y + s * 0.7);
          ctx.lineTo(x - s, y - s * 0.75);
          ctx.lineTo(x - s * 0.33, y - s * 0.1);
          ctx.lineTo(x - s * 0.33, y - s * 0.75);
          ctx.lineTo(x + s * 0.33, y - s * 0.1);
          ctx.lineTo(x + s * 0.33, y - s * 0.75);
          ctx.lineTo(x + s, y - s * 0.1);
          ctx.lineTo(x + s, y + s * 0.7);
        }
        ctx.closePath();
        ctx.fillStyle = hot ? '#f7fee7' : INDUSTRIA;
        ctx.fill();
        ctx.strokeStyle = 'rgba(3, 9, 18, 0.9)';
        ctx.lineWidth = 0.9;
        ctx.stroke();
        ctx.globalAlpha = 1;
        taken.push([x - s - 1, y - s - 1, x + s + 1, y + s + 1]);
        if (tablero.trazando) return;
        labels.push({
          text: p.corto,
          spots: spotsAround(x, y, s + 1.5),
          size: 9.5,
          font: '600 9.5px Inter, "Segoe UI", system-ui, sans-serif',
          color: hot ? '#ffffff' : 'rgba(217, 249, 157, 0.9)',
          // Under airports, ports and polos: shown where there's room, always when hovered.
          priority: (hot ? 1e9 : 0) + 2e7,
          halo: true,
        });
      });
    }

    // Pemex's offshore complexes: a platform on its legs, sized by the crude it
    // produces; laying out a supply vessel they're stops, for anything else they
    // fade back. Cayo Arcas, where the buyers' ships load crude at sea: a ring.
    if (layers.plataformas) {
      const trazaAbasto = trazaBarco && tablero.claseBarco === 'abastecedor';
      COMPLEJOS.forEach((c, i) => {
        const x = sx(complejoPts[i]);
        const y = sy(complejoPts[i]);
        if (!onScreen(x, y)) return;
        const hot = hovered?.kind === 'complejo' && hovered.complejo.id === c.id;
        const mbd = sim.crudo.porComplejo.get(c.id)?.juego ?? produccionComplejo(c.id, añoDe(sim.horas));
        const s = (3.2 + Math.sqrt(Math.max(0, mbd)) * 0.22) * (hot ? 1.15 : 1);
        ctx.globalAlpha = tablero.trazando && !trazaAbasto ? 0.3 : 1;
        ctx.strokeStyle = hot ? '#fff1dc' : PLATAFORMA;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(x - s * 0.65, y + s * 0.25);
        ctx.lineTo(x - s * 0.95, y + s * 1.05);
        ctx.moveTo(x + s * 0.65, y + s * 0.25);
        ctx.lineTo(x + s * 0.95, y + s * 1.05);
        ctx.stroke();
        ctx.fillStyle = hot ? '#fff1dc' : PLATAFORMA;
        ctx.fillRect(x - s, y - s * 0.55, 2 * s, s * 0.85);
        ctx.strokeStyle = 'rgba(3, 9, 18, 0.9)';
        ctx.lineWidth = 0.9;
        ctx.strokeRect(x - s, y - s * 0.55, 2 * s, s * 0.85);
        ctx.globalAlpha = 1;
        const R = s + 2;
        taken.push([x - R, y - R, x + R, y + R]);
        if (tablero.trazando && !trazaAbasto) return;
        labels.push({
          text: c.corto,
          spots: spotsAround(x, y, R),
          size: 10,
          font: '600 10px Inter, "Segoe UI", system-ui, sans-serif',
          color: hot ? '#ffffff' : 'rgba(250, 210, 185, 0.92)',
          priority: (hot ? 1e9 : 0) + 3.4e7 + mbd,
          halo: true,
        });
      });
      const x = sx(cayoArcasPt);
      const y = sy(cayoArcasPt);
      if (onScreen(x, y) && !tablero.trazando) {
        const hot = hovered?.kind === 'cayo-arcas';
        ctx.beginPath();
        ctx.arc(x, y, hot ? 5.5 : 4.5, 0, Math.PI * 2);
        ctx.strokeStyle = hot ? '#fff1dc' : CRUDO;
        ctx.lineWidth = 2;
        ctx.stroke();
        taken.push([x - 6, y - 6, x + 6, y + 6]);
        labels.push({
          text: 'Cayo Arcas',
          spots: spotsAround(x, y, 6),
          size: 10,
          font: '500 10px Inter, "Segoe UI", system-ui, sans-serif',
          color: hot ? '#ffffff' : 'rgba(230, 175, 140, 0.85)',
          priority: (hot ? 1e9 : 0) + 3e7,
          halo: true,
        });
      }
    }

    // Pemex's fuel terminals (SENER, 2018), with the fuel layer: a dot sized by
    // its storage, in the colour of how its fuel gets there.
    if (layers.combustibles && !tablero.trazando) {
      TERMINALES.forEach((t, i) => {
        const x = sx(terminalPts[i]);
        const y = sy(terminalPts[i]);
        if (!onScreen(x, y)) return;
        const hot = hovered?.kind === 'terminal' && hovered.terminal.nombre === t.nombre;
        const r = (2.2 + Math.sqrt(t.capacidad) * 0.085) * (hot ? 1.3 : 1);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = hot ? '#ffffff' : COLOR_RED_TERMINAL[t.red];
        ctx.fill();
        ctx.strokeStyle = 'rgba(3, 9, 18, 0.9)';
        ctx.lineWidth = 0.9;
        ctx.stroke();
      });
    }

    // Refineries: a drop of oil, sized by the crude it runs. The Olmeca is
    // hollow and dashed until it runs; Deer Park is dim until it's all Pemex's.
    // Laying out a train, the ones with a station are stops (fuel loads
    // there); for a ship they fade back, their port is the stop.
    if (layers.refinerias) {
      REFINERIAS.forEach((r, i) => {
        const x = sx(refineriaPts[i]);
        const y = sy(refineriaPts[i]);
        if (!onScreen(x, y)) return;
        const hot = hovered?.kind === 'refineria' && hovered.refineria.id === r.id;
        const opera = refineriaOpera(r);
        const p = procesoMapa(r);
        const s = tamañoGota(opera ? (p ?? 150) : r.capacidad * 0.5) * (hot ? 1.15 : 1);
        const parada = trazaTren && conEstacion(`refineria:${r.id}`);
        ctx.globalAlpha = tablero.trazando && !parada ? 0.3 : r.extranjera && !sim.deerParkPropia ? 0.55 : 1;
        gota(ctx, x, y, s);
        if (opera) {
          ctx.fillStyle = hot ? '#fff1dc' : REFINERIA;
          ctx.fill();
          ctx.strokeStyle = 'rgba(3, 9, 18, 0.9)';
          ctx.lineWidth = 0.9;
          ctx.stroke();
        } else {
          ctx.fillStyle = 'rgba(224, 164, 88, 0.14)';
          ctx.fill();
          ctx.setLineDash([2, 1.6]);
          ctx.strokeStyle = hot ? '#fff1dc' : REFINERIA;
          ctx.lineWidth = 1.2;
          ctx.stroke();
          ctx.setLineDash([]);
        }
        ctx.globalAlpha = 1;
        const R = s + 1.5;
        taken.push([x - R, y - R, x + R, y + R]);
        if (tablero.trazando && !parada) return;
        labels.push({
          text: r.corto,
          spots: spotsAround(x, y, R),
          size: 10,
          font: '600 10px Inter, "Segoe UI", system-ui, sans-serif',
          color: hot ? '#ffffff' : 'rgba(240, 205, 160, 0.92)',
          // Under ports and airports; over polos and most cities.
          priority: (hot ? 1e9 : 0) + 3.5e7 + (p ?? 0),
          halo: true,
        });
      });
    }

    // Exits for exports: a small amber square at the corner of the site,
    // the customs office a train can leave the country through.
    for (const clave of SALIDAS) {
      const tipo = clave.split(':')[0];
      if (tipo === 'ciudad' ? !layers.ciudades : tipo === 'puerto' ? !layers.puertos : !layers.aeropuertos) continue;
      if (tipo === 'aeropuerto' && sim.modo === 'realidad') {
        const a = AEROPUERTOS.find((x) => `aeropuerto:${x.id}` === clave);
        if (a && !aeropuertoVisible(a)) continue;
      }
      const ll = sitioLonLat(clave);
      const p = ll && projection ? projection(ll) : null;
      if (!p) continue;
      const x = sx(p) + 6;
      const y = sy(p) - 6;
      if (!onScreen(x, y)) continue;
      ctx.globalAlpha = atenuado(clave) ? 0.3 : 1;
      ctx.fillStyle = 'rgba(3, 9, 18, 0.85)';
      ctx.fillRect(x - 2.6, y - 2.6, 5.2, 5.2);
      ctx.strokeStyle = '#fcd34d';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(x - 2.6, y - 2.6, 5.2, 5.2);
      ctx.globalAlpha = 1;
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
      if (u.tipo === 'barco') {
        if (layers.barcos) pintarBarco(ctx, u, pxKm, now);
      } else if (layers.trenes) pintarTren(ctx, u, pxKm, now);
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
    // In Realidad there's no published progress or occupancy to ring.
    if (!layers.polos || !projection || sim.modo === 'realidad') return;
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
    const mar = tablero.tipoNuevo === 'barco';
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
    // While laying out a train, a mine with a station is a stop (its chain cargo loads there).
    if (layers.mineria && (!tablero.trazando || tablero.tipoNuevo === 'tren')) {
      MINAS.forEach((m, i) => {
        if (!industriaVisible(m)) return;
        if (tablero.trazando && !sim.red?.estaciones.has(`mina:${m.id}`)) return;
        const d = Math.hypot(transform.applyX(minaPts[i][0]) - mx, transform.applyY(minaPts[i][1]) - my);
        if (d < 9 && d < bestD) {
          best = { kind: 'mina', mina: m };
          bestD = d;
        }
      });
    }
    if (layers.industrias && (!tablero.trazando || tablero.tipoNuevo === 'tren')) {
      INDUSTRIAS.forEach((p, i) => {
        if (tablero.trazando && !sim.red?.estaciones.has(`industria:${p.id}`)) return;
        if (!industriaVisible(p)) return;
        const d = Math.hypot(transform.applyX(industriaPts[i][0]) - mx, transform.applyY(industriaPts[i][1]) - my);
        if (d < 9 && d < bestD) {
          best = { kind: 'industria', industria: p };
          bestD = d;
        }
      });
    }
    // While laying out a train, an airport with a station is a stop; never for a ship.
    if (layers.aeropuertos && (!tablero.trazando || tablero.tipoNuevo === 'tren')) {
      AEROPUERTOS.forEach((a, i) => {
        if (!aeropuertoVisible(a)) return;
        if (tablero.trazando && !sim.red?.estaciones.has(`aeropuerto:${a.id}`)) return;
        const d = Math.hypot(transform.applyX(aeropuertoPts[i][0]) - mx, transform.applyY(aeropuertoPts[i][1]) - my);
        if (d < 10 && d < bestD) {
          best = { kind: 'aeropuerto', aeropuerto: a };
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
    if (layers.ciudades && !(tablero.trazando && tablero.tipoNuevo === 'barco')) {
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
        if (tablero.trazando && !(tablero.tipoNuevo === 'tren' && sim.red?.estaciones.has(`polo:${p.id}`))) return;
        if (!poloVisible(p.id)) return;
        const d = Math.hypot(transform.applyX(poloPts[i][0]) - mx, transform.applyY(poloPts[i][1]) - my);
        if (d < 9 && d < bestD) {
          best = { kind: 'polo', polo: p };
          bestD = d;
        }
      });
    }
    // While laying out a train, a refinery with a station is a stop (fuel loads there); never for a ship.
    if (layers.refinerias && (!tablero.trazando || tablero.tipoNuevo === 'tren')) {
      REFINERIAS.forEach((r, i) => {
        if (tablero.trazando && !sim.red?.estaciones.has(`refineria:${r.id}`)) return;
        const d = Math.hypot(transform.applyX(refineriaPts[i][0]) - mx, transform.applyY(refineriaPts[i][1]) - my);
        if (d < 9 && d < bestD) {
          best = { kind: 'refineria', refineria: r };
          bestD = d;
        }
      });
    }
    // Laying out a supply vessel, a complex is a stop; otherwise it only shows its card.
    if (layers.plataformas && (!tablero.trazando || (tablero.tipoNuevo === 'barco' && tablero.claseBarco === 'abastecedor'))) {
      COMPLEJOS.forEach((c, i) => {
        const d = Math.hypot(transform.applyX(complejoPts[i][0]) - mx, transform.applyY(complejoPts[i][1]) - my);
        if (d < 11 && d < bestD) {
          best = { kind: 'complejo', complejo: c };
          bestD = d;
        }
      });
      if (!tablero.trazando) {
        const d = Math.hypot(transform.applyX(cayoArcasPt[0]) - mx, transform.applyY(cayoArcasPt[1]) - my);
        if (d < 8 && d < bestD) {
          best = { kind: 'cayo-arcas' };
          bestD = d;
        }
      }
    }
    if (layers.combustibles && !tablero.trazando) {
      TERMINALES.forEach((t, i) => {
        const d = Math.hypot(transform.applyX(terminalPts[i][0]) - mx, transform.applyY(terminalPts[i][1]) - my);
        if (d < 7 && d < bestD) {
          best = { kind: 'terminal', terminal: t };
          bestD = d;
        }
      });
    }
    if (layers.energia && !tablero.trazando) {
      PLANTAS.forEach((p, i) => {
        if (!plantaVisible(p)) return;
        const d = Math.hypot(transform.applyX(plantaPts[i][0]) - mx, transform.applyY(plantaPts[i][1]) - my);
        if (d < Math.max(6, radioPlanta(p.mw) + 2) && d < bestD) {
          best = { kind: 'planta', indice: i };
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
    // A pipeline under the pointer, before the track: turning the layer on means looking for them.
    if (layers.ductos && ductoPaths.length) {
      const margen = 4 / transform.k;
      hitCtx.lineWidth = 2 * margen;
      for (let i = ductoPaths.length - 1; i >= 0; i--) {
        const dp = ductoPaths[i];
        const [[x0, y0], [x1, y1]] = dp.bounds;
        if (px < x0 - margen || px > x1 + margen || py < y0 - margen || py > y1 + margen) continue;
        if (situacionAhora(dp.d) === 'no') continue;
        if (hitCtx.isPointInStroke(dp.path, px, py)) return { kind: 'ducto', ducto: dp.d };
      }
    }
    // A rail line under the pointer (within a few screen px of it).
    if (layers.vias && viaPaths.length) {
      const margen = 5 / transform.k;
      hitCtx.lineWidth = 2 * margen;
      for (let i = viaPaths.length - 1; i >= 0; i--) {
        const [[x0, y0], [x1, y1]] = viaPaths[i].bounds;
        if (px < x0 - margen || px > x1 + margen || py < y0 - margen || py > y1 + margen) continue;
        if (hitCtx.isPointInStroke(viaPaths[i].path, px, py)) return { kind: 'via', base: i };
      }
    }
    if (!baked) return null;
    for (const e of baked.estados) {
      const [[x0, y0], [x1, y1]] = e.bounds;
      if (px < x0 || px > x1 || py < y0 || py > y1) continue;
      if (!hitCtx.isPointInPath(e.path, px, py)) continue;
      if (layers.energia)
        for (const s of baked.subregiones)
          if (s.estado === e.props.clave && hitCtx.isPointInPath(s.zona, px, py)) return { kind: 'estado', estado: e.props, region: s.region };
      return { kind: 'estado', estado: e.props };
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
          : t.kind === 'aeropuerto'
          ? `aeropuerto:${t.aeropuerto.id}`
          : t.kind === 'ciudad'
            ? `ciudad:${t.ciudad.id}`
            : t.kind === 'polo'
              ? `polo:${t.polo.id}`
              : t.kind === 'via'
                ? `via:${t.base}`
                : t.kind === 'planta'
                  ? `planta:${t.indice}`
                : t.kind === 'refineria'
                  ? `refineria:${t.refineria.id}`
                : t.kind === 'complejo'
                  ? `plataforma:${t.complejo.id}`
                : t.kind === 'cayo-arcas'
                  ? 'cayo-arcas'
                : t.kind === 'terminal'
                  ? `terminal:${t.terminal.nombre}`
                : t.kind === 'ducto'
                  ? `ducto:${t.ducto.id}`
                : t.kind === 'industria'
                  ? `industria:${t.industria.id}`
                : t.kind === 'mina'
                  ? `mina:${t.mina.id}`
                : `estado:${t.estado.clave}${t.region ? `:${t.region}` : ''}`;

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
            : t?.kind === 'aeropuerto'
              ? `aeropuerto:${t.aeropuerto.id}`
              : t?.kind === 'complejo'
                ? `plataforma:${t.complejo.id}`
              : t?.kind === 'refineria' && !t.refineria.extranjera
                ? `refineria:${t.refineria.id}`
                : null;

  function onPointerMove(event: PointerEvent) {
    if (!canvas || event.buttons) return; // no hover while dragging the map
    const rect = canvas.getBoundingClientRect();
    pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    const next = targetAt(pointer.x, pointer.y);
    if (claveDe(next) !== claveDe(hovered)) {
      // A hovered estado is lit in the geography layer; sites in the fondo;
      // vehicles only in the moving layer.
      // A hovered pipeline is lit in the same layer as the geography.
      const capaCambia = hovered?.kind === 'estado' || next?.kind === 'estado' || hovered?.kind === 'ducto' || next?.kind === 'ducto';
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
    const eraEstado = hovered.kind === 'estado' || hovered.kind === 'ducto';
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
    // A pipeline a State work widens opens that work's card; the others only show their card on hover.
    if (target.kind === 'ducto') {
      const o = OBRA_DEL_DUCTO.get(target.ducto.id);
      if (o) {
        tablero.abrirCatalogo();
        tablero.obraSel = o.id;
      }
      return;
    }
    // A refinery opens its card in the catalog of works.
    if (target.kind === 'refineria') {
      tablero.abrirCatalogo();
      tablero.obraSel = fichaDeRefineria(target.refineria);
      return;
    }
    // A rail line, a power plant or a fuel terminal only shows its card on hover.
    if (target.kind === 'via' || target.kind === 'planta' || target.kind === 'terminal' || target.kind === 'cayo-arcas') return;
    if (target.kind === 'estado') {
      const e = baked?.estados.find((x) => x.props.clave === target.estado.clave);
      if (e) flyToBounds(e.bounds);
      return;
    }
    const lonLat =
      target.kind === 'aeropuerto'
        ? target.aeropuerto.lonLat
        : target.kind === 'puerto'
        ? target.puerto.lonLat
        : target.kind === 'puerta'
          ? target.puerta.lonLat
          : target.kind === 'polo'
            ? target.polo.lonLat
            : target.kind === 'complejo'
              ? target.complejo.lonLat
              : target.kind === 'industria'
                ? target.industria.lonLat
                : target.kind === 'mina'
                  ? target.mina.lonLat
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
    // A work ordered, stopped or finished: its dashed line changes.
    sim.obrasVia;
    sim.real;
    ensuciaCapa();
  });

  $effect(() => {
    // Realidad's date moves polos in and out of the board, and resizes the airports.
    sim.real;
    sim.obras;
    sim.modo;
    ensucia();
  });


  $effect(() => {
    // A work's card opened: light its line and fly to it. A CFE plant also
    // turns the electricity layer on.
    const id = tablero.catalogo ? tablero.obraSel : null;
    ensucia();
    if (!id) return;
    untrack(() => {
      const op = obraPaths.get(id);
      if (op) flyToBounds(op.bounds);
      const planta = obraEnergia(id);
      if (planta && projection) {
        layers.energia = true;
        const p = projection(planta.lonLat);
        if (p) flyTo(p[0], p[1], Math.max(transform.k, 5));
      }
      // A Pemex work: its refinery, with the refineries layer on.
      const ref = refineriaPorId(id === 'deer-park-compra' ? 'deer-park' : (obraPemex(id)?.refineria ?? ''));
      if (ref && projection) {
        layers.refinerias = true;
        const p = projection(ref.lonLat);
        if (p) flyTo(p[0], p[1], Math.max(transform.k, 4));
      }
      // A gas work: the pipeline it widens, with the pipelines layer on.
      const og = OBRAS_GAS.find((o) => o.id === id);
      const dp = og ? ductoPaths.find((x) => x.d.id === og.ducto) : null;
      if (dp) {
        layers.ductos = true;
        flyToBounds(dp.bounds);
      }
    });
  });

  // The pipelines: on or off, works advancing, and in time each one's real
  // date. Checked once a game day; repainted only when something changed.
  const diaDelTablero = $derived(Math.floor(sim.horas / 24));
  let firmaDuctos = '';
  $effect(() => {
    layers.ductos;
    sim.obrasEnergia;
    diaDelTablero;
    untrack(() => {
      const obras = OBRAS_GAS.map((o) => {
        const e = sim.obrasEnergia.get(o.id);
        return `${e?.fase}${e?.detenida ? '!' : ''}`;
      });
      const firma = `${layers.ductos}|${DUCTOS.filter((d) => d.real).map(situacionAhora).join()}|${obras.join()}`;
      if (firma === firmaDuctos) return;
      firmaDuctos = firma;
      ensuciaCapa();
    });
  });

  // The fuel layer: each state's share from the country, checked once a game
  // day and repainted when one of them moves a 5 % step.
  let firmaCombustibles = '';
  $effect(() => {
    layers.combustibles;
    layers.energia;
    sim.modo;
    sim.abasto;
    diaDelTablero;
    untrack(() => {
      const pinta = layers.combustibles && !layers.energia && sim.modo === 'juego' && sim.abasto;
      const firma = pinta ? ESTADOS_CONSUMO.map((e) => Math.round(parteDelPais(e) * 20)).join() : 'no';
      if (firma === firmaCombustibles) return;
      firmaCombustibles = firma;
      ensuciaCapa();
    });
  });

  $effect(() => {
    // The refineries: their runs change daily as rehabilitations advance, and with the date in Realidad.
    layers.refinerias;
    layers.plataformas;
    sim.crudo;
    sim.refinacion;
    sim.deerParkPropia;
    sim.obrasPemex;
    ensucia();
  });

  $effect(() => {
    // The electricity layer: on or off, and each day's margins and plants.
    layers.energia;
    sim.energia;
    sim.obrasEnergia;
    ensuciaCapa();
  });

  $effect(() => {
    // What's drawn in the fondo over it: sites, stations, picked stops, the fuel terminals.
    layers.puertos;
    layers.aeropuertos;
    layers.industrias;
    layers.mineria;
    layers.ciudades;
    layers.polos;
    layers.combustibles;
    tablero.paradas;
    tablero.candidato;
    ensucia();
  });

  $effect(() => {
    // Anything that (re)starts motion: the clock, the fleet, following, the fleet's layers.
    sim.corriendo;
    const trenes = sim.trenes;
    const barcos = sim.barcos;
    sim.siguiendo;
    const verTrenes = layers.trenes;
    const verBarcos = layers.barcos;
    // A retired (or hidden) vehicle can't stay under the cursor.
    untrack(() => {
      if (hovered?.kind !== 'unidad') return;
      const u = hovered.unidad;
      if (!(u.tipo === 'tren' ? verTrenes && trenes.includes(u) : verBarcos && barcos.includes(u))) hovered = null;
    });
    requestDraw();
  });

  /**
   * The last camera request flown. A request left from before this board was
   * mounted isn't flown again — except coming out of a polo, which lands the
   * board on it.
   */
  let atendido = untrack(() => (tablero.irA && !tablero.irA.id.startsWith('polo-fuera:') ? tablero.irA.n : 0));

  $effect(() => {
    // Camera requests from the panels, once the projection is there. Untracked:
    // flying reads the camera transform, and tracking it would relaunch the
    // flight on every frame of the flight itself.
    const pedido = tablero.irA;
    if (!pedido || !proyeccionLista || pedido.n === atendido) return;
    untrack(() => {
      atendido = pedido.n;
      // Into a polo: all the way down onto it, on the way to its close-up. Out of one: close over it.
      const polo = POLOS.find((x) => pedido.id === `polo:${x.id}` || pedido.id === `polo-fuera:${x.id}`);
      if (polo) {
        const p = projection?.(polo.lonLat);
        if (p) flyTo(p[0], p[1], pedido.id.startsWith('polo:') ? MAX_ZOOM : 9);
        return;
      }
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
  /** Thousands of barrels, whole: "1,231". */
  const fmtMil = (n: number) => fmt.format(Math.round(n));
  /** Tonnes as millions: "3.55 Mt", "0.09 Mt". */
  const mt = (t: number) => `${(t / 1e6).toLocaleString('es-MX', { maximumFractionDigits: 2, minimumFractionDigits: t < 1e7 ? 2 : 1 })} Mt`;
  /** "469 mil t de contenedores, 105 mil t de granel": the kinds with at least a thousand tonnes. */
  const porTipos = (r: Record<TipoCarga, number>) =>
    TIPOS_CARGA.filter((t) => r[t] >= 1000)
      .map((t) => `${milT(r[t])} de ${NOMBRE_CARGA[t]}`)
      .join(', ') || 'nada';
  const sumaTipos = (r: Record<TipoCarga, number>) => TIPOS_CARGA.reduce((s, t) => s + r[t], 0);
  /** Tonnes in thousands: "469 mil t", "8.5 mil t". */
  const milT = (t: number) => `${(t / 1000).toLocaleString('es-MX', { maximumFractionDigits: t < 1e4 ? 1 : 0 })} mil t`;
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
  /** In Realidad a polo shows from its declaratoria on. */
  function poloVisible(id: string): boolean {
    return sim.modo !== 'realidad' || sim.real.get(clavePolo(id))?.etapa !== 'sin-anunciar';
  }

  function faseDelPolo(id: string): string {
    sim.horas;
    if (sim.modo === 'realidad') {
      const e = sim.real.get(clavePolo(id))?.etapa;
      return e === 'en-operacion' ? 'en operación' : e === 'en-obra' ? 'en obra' : 'declarado';
    }
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
    const barco = tablero.tipoNuevo === 'barco';
    if (!n) return barco ? 'Clic: primera escala del barco' : 'Clic: origen del tren';
    const que = barco ? 'escala' : 'parada';
    return `Clic: ${que} ${n + 1} · ${fmtKm(tablero.kmPrevia)} · ${duracion(tablero.horasPrevia)}${barco ? ' por vuelta' : ''}`;
  });

  const fmtTrenes = (n: number) => (n < 10 ? n.toFixed(1) : String(Math.round(n)));

  const kmDeVia = $derived.by(() => {
    if (sim.estado !== 'lista' || !sim.red) return 0;
    sim.versionRed;
    return Math.round(sim.red.tramos.reduce((s, t) => s + (t.operando ? t.km : 0), 0));
  });
</script>

<svelte:window bind:innerWidth bind:innerHeight />

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

<!-- A site's customs office: what it collected, and whether exports leave through it. -->
{#snippet aduana(clave: string)}
  {@const ad = ADUANA_DEL_SITIO.get(clave)}
  {@const salida = SALIDAS.has(clave)}
  {@const ferro = EXPORTACIONES.porSalida2025[clave]}
  {@const mias = sim.exportacion.porSalida[clave] ?? 0}
  {#if ad}
    <span class="tip-sub tip-aduana">
      Aduana {ad.tipo === 'maritima' ? 'marítima' : ad.tipo} {ad.nombre} · recaudó {(ad.recaudacion2025 / 1000).toLocaleString('es-MX', { maximumFractionDigits: 1 })} mil millones en 2025
    </span>
  {/if}
  {#if salida}
    <span class="tip-sub tip-aduana">
      Salida de exportación{ferro ? ` · ${ferro.toLocaleString('es-MX')} Mt por tren en 2025` : ''}{mias > 0 ? ` · tus trenes: ${Math.round(mias).toLocaleString('es-MX')} t` : ''}
    </span>
  {/if}
{/snippet}

{#if hovered && (hovered.kind !== 'estado' || !tablero.trazando)}
  <div
    class="tip panel"
    class:flip={pointer.x > innerWidth - 260}
    class:arriba={pointer.y > innerHeight * 0.55}
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
      {#if rail}<span class="tip-rail" class:mar={tablero.trazando && tablero.tipoNuevo === 'barco'}>{rail}</span>{/if}
      {@render aduana(`puerto:${hovered.puerto.id}`)}
      {@const com = comercioDe(`puerto:${hovered.puerto.id}`)}
      {#if com}
        <span class="tip-sub tip-mar">
          Por mar en 2024 (SEMAR): exportó {mt(sumaTipos(com.exp))} e importó {mt(sumaTipos(com.imp))}{com.trenImp > 0
            ? `; por tren sale ${mt(com.trenImp)} de lo importado (ATTRAPI)`
            : ''}
        </span>
        {#if sim.modo === 'juego'}
          {@const _reloj = sim.horas}
          {@const ahora = sim.puertoAhora(`puerto:${hovered.puerto.id}`)}
          {@const mios = [
            [sim.comercio.exportado.porPuerto[`puerto:${hovered.puerto.id}`] ?? 0, 'exportaron'],
            [sim.comercio.importado.porPuerto[`puerto:${hovered.puerto.id}`] ?? 0, 'importaron'],
          ] as const}
          {#if ahora}
            {#if sumaTipos(ahora.exportacion) >= 1000}
              <span class="tip-sub tip-mar">Esperando barco: {porTipos(ahora.exportacion)}</span>
            {/if}
            {#if sumaTipos(ahora.pedido) >= 1000}
              <span class="tip-sub tip-mar">Por importar: {porTipos(ahora.pedido)}</span>
            {/if}
            {#if ahora.tren >= 1000}
              <span class="tip-sub tip-mar">Importación esperando tren: {milT(ahora.tren)}</span>
            {/if}
          {/if}
          {#if mios.some(([t]) => t > 0)}
            <span class="tip-sub tip-mar">
              Tus barcos {mios
                .filter(([t]) => t > 0)
                .map(([t, verbo]) => `${verbo} ${milT(t)}`)
                .join(' e ')} aquí
            </span>
          {/if}
        {/if}
      {/if}
      {@const refDelPuerto = REFINERIA_DEL_PUERTO.get(`puerto:${hovered.puerto.id}`)}
      {#if refDelPuerto && sim.modo === 'juego'}
        {@const _reloj = sim.horas}
        <span class="tip-sub" style:color={COMBUSTIBLE}>
          Los buques tanque cargan aquí combustible de la refinería {refineriaPorId(refDelPuerto)?.corto}: {fmtMil(sim.enPatio(refDelPuerto) / 1000)} mil barriles en espera
        </span>
      {/if}
      {#if BASES_ABASTO.has(`puerto:${hovered.puerto.id}`) && layers.plataformas}
        <span class="tip-sub" style:color={PLATAFORMA}>Base de abasto costa afuera: aquí cargan los barcos abastecedores</span>
      {/if}
      {@const pet = layers.combustibles ? PUERTOS_COMBUSTIBLE[hovered.puerto.id] : null}
      {#if pet}
        {@const año = sim.modo === 'realidad' && añoDe(sim.horas) >= 2024 ? '2024' : '2018'}
        {@const [imp, exp, recibe, envia] = pet[año]}
        <span class="tip-sub">
          Petróleo y derivados en {año} (SEMAR): {[
            imp ? `importó ${mt(imp)}` : '',
            exp ? `exportó ${mt(exp)}` : '',
            recibe ? `recibió ${mt(recibe)} por cabotaje` : '',
            envia ? `mandó ${mt(envia)} por cabotaje` : '',
          ]
            .filter(Boolean)
            .join(', ') || 'nada'}
        </span>
        {#if pet.nota}<span class="tip-sub">{pet.nota}</span>{/if}
      {/if}
    {:else if hovered.kind === 'aeropuerto'}
      {@const a = hovered.aeropuerto}
      {@const año = añoAeropuerto()}
      {@const s = a.serie[String(año)]}
      {@const t = toneladas(a, año)}
      {@const antes = toneladas(a, año - 1)}
      {@const parcial = año === SERIE_AEROPUERTOS.parcial.año}
      {@const periodo = parcial ? `de enero a ${MESES_CARGA[SERIE_AEROPUERTOS.parcial.meses - 1]} de ${año}` : `en ${año}`}
      <span class="label tip-kind" style:color={AEROPUERTO}>
        Aeropuerto de carga{s?.lugar ? ` · ${s.lugar}.º del país ${parcial ? `en ${año}, hasta ${MESES_CARGA[SERIE_AEROPUERTOS.parcial.meses - 1]}` : `en ${año}`}` : ''}
      </span>
      <strong>{a.nombre} · {a.iata}</strong>
      <span class="tip-sub">{estadoNombre.get(a.estado) ?? a.estado}</span>
      {@const rail = lineaTrazado || servicio(`aeropuerto:${a.id}`)}
      {#if rail}<span class="tip-rail">Puerto seco · {rail}</span>{/if}
      {@render aduana(`aeropuerto:${a.id}`)}
      <span class="tip-rail">
        {fmt.format(Math.round(t))} toneladas {periodo} · {((t / SERIE_AEROPUERTOS.totalPais[String(año)]) * 100).toLocaleString('es-MX', { maximumFractionDigits: 1 })} % del país
      </span>
      {#if s}
        <span class="tip-sub">internacional {fmt.format(Math.round(s.internacional))} t · nacional {fmt.format(Math.round(s.nacional))} t</span>
      {/if}
      {#if parcial}
        <span class="tip-sub">{año - 1} completo: {fmt.format(Math.round(antes))} t</span>
      {:else if antes > 0 && antes < t * 0.05}
        <span class="tip-sub">{año - 1}: apenas {fmt.format(Math.round(antes))} t</span>
      {:else if antes > 0}
        <span class="tip-sub">
          {t >= antes ? '▲' : '▼'} {Math.abs((t / antes - 1) * 100).toLocaleString('es-MX', { maximumFractionDigits: 1 })} % contra {año - 1}
          ({fmt.format(Math.round(antes))} t)
        </span>
      {/if}
    {:else if hovered.kind === 'mina'}
      {@const m = hovered.mina}
      {@const c = cifraMina(m, añoDe(sim.horas))}
      {@const via = sim.red ? kmALaVia(sim.red, m.lonLat) : null}
      <span class="label tip-kind" style:color={MINERIA}>{m.mineral === 'sal' ? 'Salina' : `Mina de ${NOMBRE_MINERAL[m.mineral]}`}</span>
      <strong>{m.nombre}</strong>
      <span class="tip-sub">{m.municipio}, {estadoNombre.get(m.estado) ?? m.estado}{m.desde ? ` · desde ${m.desde.slice(0, 4)}` : ''}</span>
      <span class="tip-sub">{m.empresa}</span>
      <span class="tip-rail">{m.que}</span>
      {#if c}
        <span class="tip-rail">{fmt.format(c.toneladas)} toneladas de {m.unidad} en {c.año}</span>
      {/if}
      {#if m.destino}<span class="tip-sub">{m.destino}</span>{/if}
      {#if via !== null}
        <span class="tip-sub">{via <= 2 ? 'Junto a la vía férrea' : `Vía férrea en operación a ${Math.round(via)} km`}</span>
      {/if}
      {@const sale = FLUJOS.filter((f) => f.origen === `mina:${m.id}`)}
      {#if sale.length}
        {@const conEst = !!sim.red?.estaciones.has(`mina:${m.id}`)}
        <span class="tip-rail">
          Por tren: {sale.map((f) => `${fmt.format(Math.round(toneladasAño(f, sim.horas, añoDe(sim.horas)) / 1000))} mil t al año a ${nombreCorto(f.destino)}`).join('; ')}{sale.some(llevanPrivados) ? ` (la ${PARTE_PRIVADOS === 0.5 ? 'mitad' : 'parte'} la llevan Ferromex y CPKC; el resto espera tus trenes)` : ''}{conEst ? `; esperan ${fmt.format(Math.round(sale.reduce((x, f) => x + sim.enPatioCadena(f.id), 0)))} t` : ' (sin estación: queda lejos de la vía)'}
        </span>
      {/if}
      {#if m.nota}<span class="tip-sub">{m.nota}</span>{/if}
    {:else if hovered.kind === 'industria'}
      {@const p = hovered.industria}
      {@const c = cifrasIndustria(p)}
      {@const via = sim.red ? kmALaVia(sim.red, p.lonLat) : null}
      {@const surten = MINAS.filter((m) => industriaVisible(m) && m.destinos.includes(`industria:${p.id}`))}
      <span class="label tip-kind" style:color={INDUSTRIA}>{TIPO_INDUSTRIA[p.tipo]}</span>
      <strong>{p.nombre}</strong>
      <span class="tip-sub">{p.municipio}, {estadoNombre.get(p.estado) ?? p.estado}{p.desde ? ` · desde ${p.desde.slice(0, 4)}` : ''}</span>
      <span class="tip-rail">{p.que}</span>
      {#if c}
        <span class="tip-rail">
          {c.empresa}: {fmt.format(c.produccion)} vehículos {c.parcial ? `en los primeros ${c.parcial} meses de ${c.año}` : `en ${c.año}`}, {fmt.format(c.exportacion)} exportados (INEGI)
        </span>
        {#if c.plantas > 1}<span class="tip-sub">La cifra es de la marca, entre sus {c.plantas} plantas: el INEGI no la da por planta.</span>{/if}
      {/if}
      {#if via !== null}
        <span class="tip-sub">{via <= 2 ? 'Junto a la vía férrea' : `Vía férrea en operación a ${Math.round(via)} km`}</span>
      {/if}
      {#if surten.length}
        <span class="tip-sub">La surten: {surten.map((m) => `${m.corto} (${NOMBRE_MINERAL[m.mineral]})`).join(', ')}</span>
      {/if}
      {@const llegan = FLUJOS.filter((f) => f.destino === `industria:${p.id}` && toneladasAño(f, sim.horas, añoDe(sim.horas)) > 0)}
      {#if llegan.length}
        {@const año = añoDe(sim.horas)}
        {@const transcurrido = Math.max(1 / 365, Math.min(1, (sim.horas - horasDeFecha(`${año}-01-01`)) / (365.25 * 24)))}
        {@const espera = llegan.reduce((x, f) => x + toneladasAño(f, sim.horas, año), 0) * transcurrido}
        {@const llego = llegan.reduce((x, f) => x + (sim.cadena[f.id]?.porAño[String(año)] ?? 0), 0)}
        <span class="tip-rail">
          Abasto por tren en {año}: {fmt.format(Math.round(llego))} t de {fmt.format(Math.round(espera))} esperadas ({Math.round((100 * llego) / Math.max(1, espera))} %) · {[...new Set(llegan.map((f) => NOMBRE_PRODUCTO[f.producto]))].join(', ')}
        </span>
      {/if}
      {#if ACERERAS.some((a) => a.id === p.id) && aceroAño(p.id, sim.horas, 1) > 0}
        {@const surtido = sim.surtidoAcero(p.id)}
        <span class="tip-rail">
          Acero por tren: {fmt.format(Math.round(aceroAño(p.id, sim.horas, surtido) / 1000))} mil t al año de {fmt.format(Math.round(aceroAño(p.id, sim.horas, 1) / 1000))} posibles · surtida el último mes al {Math.round(surtido * 100)} % · {fmt.format(Math.round(sim.reservaAcero(p.id)))} t de insumos en reserva; esperan {fmt.format(Math.round(sim.enPatioAcero(p.id)))} t de acero{sim.acero[p.id] ? `; tus trenes han llevado ${fmt.format(Math.round(sim.acero[p.id]))} t` : ''}
        </span>
      {/if}
      {#if p.tipo === 'armadora' && autosAño(p, sim.horas, añoDe(sim.horas)) > 0}
        <span class="tip-rail">
          Exporta por tren: {fmt.format(Math.round(autosAño(p, sim.horas, añoDe(sim.horas)) / 1000))} mil t de vehículos al año (estimación del juego){sim.red?.estaciones.has(`industria:${p.id}`) ? `; esperan ${fmt.format(Math.round(sim.enPatioAutos(p.id)))} t` : ' (sin estación: queda lejos de la vía)'}{sim.autos[p.id] ? `; tus trenes han llevado ${fmt.format(Math.round(sim.autos[p.id]))} t` : ''}
        </span>
      {/if}
      {#if p.tren}<span class="tip-sub">{p.tren}</span>{/if}
      {#if p.nota}<span class="tip-sub">{p.nota}</span>{/if}
    {:else if hovered.kind === 'refineria'}
      {@const r = hovered.refineria}
      {@const opera = refineriaOpera(r)}
      {@const ajena = r.extranjera && !sim.deerParkPropia}
      <span class="label tip-kind" style:color={REFINERIA}>
        Refinería{r.extranjera ? (ajena ? ' · Pemex socio al 49.995 %' : ' de Pemex en Texas') : ''}{r.nueva && !opera
          ? sim.modo === 'realidad'
            ? ` · ${TEXTO_ETAPA[sim.real.get(r.id)?.etapa ?? 'sin-datos']}`
            : sim.obrasPemex.get(r.id)?.fase === 'en-obra'
              ? ` · en obra ${((sim.obrasPemex.get(r.id)?.avance ?? 0) * 100).toFixed(0)} %`
              : ' · por construir'
          : ''}
      </span>
      <strong>{r.nombre}</strong>
      <span class="tip-sub">{r.lugar} · capacidad de {fmt.format(r.capacidad)} mil barriles diarios</span>
      {#if !r.extranjera}
        {@const rail = lineaTrazado || servicio(`refineria:${r.id}`)}
        {#if rail}<span class="tip-rail">{rail}</span>{/if}
      {/if}
      {#if sim.modo === 'realidad'}
        {@const pr = procesoReal(r, sim.horas)}
        {#if pr && opera}
          <span class="tip-rail">
            Procesó {fmt.format(Math.round(pr.mbd))} mil barriles diarios en {pr.cuando} · {Math.round((pr.mbd / r.capacidad) * 100)} % de su capacidad
          </span>
        {:else if opera}
          <span class="tip-sub">Sin dato publicado por refinería para esa fecha</span>
        {/if}
      {:else}
        {@const e = sim.refinacion?.porRefineria.get(r.id)}
        {#if e && opera}
          <span class="tip-rail">Procesa {fmt.format(Math.round(e.proceso))} mil barriles diarios · {Math.round((e.proceso / r.capacidad) * 100)} % de su capacidad</span>
          {#if ajena}
            <span class="tip-sub">Lo que produce no cuenta para el país hasta comprar la parte de Shell</span>
          {:else}
            <span class="tip-sub">{fmt.format(Math.round(e.combustibles))} mil barriles diarios de gasolina, diésel y turbosina</span>
          {/if}
          {@const sobra = sim.abasto?.sobrante.get(r.id) ?? 0}
          {@const _reloj = sim.horas}
          {@const patio = sim.enPatio(r.id)}
          {#if !r.extranjera && (sobra > 0.05 || patio >= 1000)}
            {@const lleno = e.combustibles > 0 && patio >= e.combustibles * 1000 * DIAS_EN_PATIO * 0.98}
            <span class="tip-rail" class:alerta-tip={lleno}>
              Su zona no usa {fmtMil(sobra)} mil b/d: en su patio esperan {fmtMil(patio / 1000)} mil barriles
              {lleno ? '· lleno, ya no tiene salida' : `para tus trenes${PUERTO_DE_REFINERIA.has(r.id) ? ' y buques tanque' : ''}`}
            </span>
          {/if}
        {/if}
        {#each OBRAS_DE_REFINERIA.get(r.id) ?? [] as o (o.id)}
          {@const est = sim.obrasPemex.get(o.id)}
          {#if est && o.id !== r.id}
            <span class="tip-sub">
              {o.tipo === 'coquizadora' ? 'Coquizadora' : o.tipo === 'mejora' ? 'Confiabilidad' : 'Rehabilitación'}:
              {est.fase === 'en-servicio'
                ? 'terminada'
                : est.fase === 'en-obra'
                  ? `${est.detenida ? 'detenida' : 'en obra'} ${(est.avance * 100).toFixed(0)} %`
                  : 'por hacer'}
            </span>
          {/if}
        {/each}
      {/if}
      {#if !tablero.trazando}<span class="tip-sub">Clic: abrir su ficha</span>{/if}
    {:else if hovered.kind === 'complejo'}
      {@const c = hovered.complejo}
      {@const _reloj = sim.horas}
      {@const año = añoDe(sim.horas)}
      {@const e = sim.crudo.porComplejo.get(c.id)}
      <span class="label tip-kind" style:color={PLATAFORMA}>Complejo de Pemex costa afuera · bloque {c.bloque}</span>
      <strong>{c.nombre}</strong>
      <span class="tip-sub">Centro de proceso {c.centro}{c.plataformasCentro ? `, de ${c.plataformasCentro} plataformas` : ''}</span>
      {#if lineaTrazado}<span class="tip-rail mar">{lineaTrazado}</span>{/if}
      {#if sim.modo === 'realidad' || !e}
        <span class="tip-rail">Produjo {fmtMil(produccionComplejo(c.id, año))} mil barriles diarios de crudo en {año}</span>
      {:else}
        <span class="tip-rail" class:alerta-tip={e.surtido < 0.98}>
          Produce {fmtMil(e.juego)} mil barriles diarios de crudo{e.surtido < 0.98 ? ` de ${fmtMil(e.real)}: le falta abasto` : ''}
        </span>
        <span class="tip-sub">
          Necesita {fmtMil(abastoDiario(c.id, año))} toneladas de abasto al día · tiene para {sim.diasDeReserva(c.id).toLocaleString('es-MX', { maximumFractionDigits: 1 })} días ·
          surtido el {Math.round(e.surtido * 100)} % del último mes
        </span>
        <span class="tip-sub">Lo llevan tus barcos abastecedores desde Dos Bocas o Ciudad del Carmen. El crudo va a tierra por ducto submarino.</span>
      {/if}
    {:else if hovered.kind === 'cayo-arcas'}
      {@const ex = CAYO_ARCAS.exportacion}
      <span class="label tip-kind" style:color={CRUDO}>Terminal de exportación de crudo, en el mar</span>
      <strong>{CAYO_ARCAS.nombre}</strong>
      <span class="tip-sub">Aquí cargan su crudo los barcos de los compradores, que llega por ducto submarino desde los complejos.</span>
      <span class="tip-rail">Exportó {mt(ex['2018'])} de crudo en 2018 y {mt(ex['2024'])} en 2024 (SEMAR)</span>
    {:else if hovered.kind === 'terminal'}
      {@const t = hovered.terminal}
      {@const txt = textoTerminal(t)}
      <span class="label tip-kind" style:color={COLOR_RED_TERMINAL[t.red]}>Terminal de Pemex · región {t.region}</span>
      <strong>{t.nombre}</strong>
      <span class="tip-sub">{estadoNombre.get(t.estado) ?? t.estado} · {fmt.format(t.capacidad)} mil barriles de capacidad operativa</span>
      <span class="tip-rail">{txt.como}</span>
      <span class="tip-sub">{txt.juego}</span>
    {:else if hovered.kind === 'ducto'}
      {@const d = hovered.ducto}
      {@const s = situacionAhora(d)}
      {@const fr = d.real ? fichaReal(d.id) : null}
      {@const og = OBRA_DEL_DUCTO.get(d.id)}
      {@const cap = capacidadDucto(d)}
      <span class="label tip-kind" style:color={colorDucto(d)}>
        {d.tipo === 'gas' ? NOMBRE_RED[d.red] : d.tipo === 'crudo' ? 'Oleoducto de Pemex' : 'Poliducto de Pemex'}
      </span>
      <strong>{d.nombre}</strong>
      <span class="tip-sub">{d.operador}{d.km ? ` · ${fmt.format(d.km)} km` : ''}</span>
      {#if cap}<span class="tip-sub">{cap}</span>{/if}
      {#if s === 'fuera'}
        <span class="tip-rail">{d.fuera?.texto}</span>
      {:else if s === 'obra'}
        <span class="tip-rail">En obra{fr?.situacion ? ` · ${fr.situacion}` : ''}</span>
      {:else if fr?.operacion}
        <span class="tip-sub">En operación desde {fr.operacion.split('-').length === 3 ? 'el' : ''} {fechaEnPalabras(fr.operacion)}</span>
      {:else if d.nota}
        <span class="tip-sub">{d.nota}</span>
      {/if}
      {#if og}
        {@const g = GAS_REGIONES.get(og.region)}
        {@const est = sim.obrasEnergia.get(og.id)}
        {#if g}
          <span class="tip-rail">
            Es todo el gas que llega a la península:
            {est?.fase === 'en-servicio'
              ? `${fmt.format(g.capacidadConObra)} millones de pies cúbicos diarios con el Cuxtal II`
              : `${fmt.format(g.capacidad)} millones de pies cúbicos diarios; el Cuxtal II la lleva a ${fmt.format(g.capacidadConObra)}`}
          </span>
          <span class="tip-sub">
            {est?.fase === 'en-obra'
              ? `Cuxtal II en obra · ${(est.avance * 100).toFixed(0)} %`
              : est?.fase === 'en-servicio'
                ? 'Cuxtal II terminado'
                : 'Clic: abrir el Cuxtal II en el catálogo'}
          </span>
        {/if}
      {/if}
      {#if d.aproximado}
        <span class="tip-sub">Trazo aproximado: el juego lo dibuja por los puntos que dicen las fuentes.</span>
      {/if}
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
      {@render aduana(`ciudad:${hovered.ciudad.id}`)}
    {:else if hovered.kind === 'via'}
      {@const v = sim.red?.vias[hovered.base]}
      {@const u = sim.uso(hovered.base)}
      {#if v}
        {@const d = v.dueño ? DUEÑOS[v.dueño] : null}
        <span class="label tip-kind" style:color={v.dueño ? COLOR_DUEÑO[v.dueño] : COLOR_SIN_DUEÑO}>
          Vía {d ? (d.tipo === 'estatal' ? 'del Estado' : d.tipo === 'mixta' ? 'mixta' : 'concesionada') : 'sin dueño identificado'}
          {#if !v.operando}· fuera de operación{/if}
        </span>
        <strong>{v.obra ? (obraVia(v.obra)?.nombre ?? d?.nombre) : (d?.nombre ?? 'Sin dueño identificado')}</strong>
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
    {:else if hovered.kind === 'planta'}
      {@const p = PLANTAS[hovered.indice]}
      {@const vis = plantaVisible(p)}
      <span class="label tip-kind" style:color={colorTec(p.tecnologia)}>
        {p.tecnologia} · {p.dueño === 'CFE' ? (p.obra ? 'obra del Estado (CFE)' : 'CFE') : 'privada'}
      </span>
      <strong>{p.nombre}</strong>
      <span class="tip-sub">
        {fmt.format(Math.round(p.mw))} MW · región {ENERGIA.regiones.find((r) => r.id === p.region)?.nombre ?? p.region}
      </span>
      <span class="tip-sub">
        {p.obra
          ? sim.modo === 'realidad'
            ? etapaPlanta(p.obra)
            : vis === 'obra'
              ? 'En obra'
              : 'En servicio'
          : p.desde === null
            ? 'En servicio desde antes de 2019'
            : `En servicio desde el ${fechaDeJuego(p.desde)}`}
      </span>
      {#if p.sitioPorDefinir}
        <span class="tip-sub">Sitio por definir: la CFE aún lo busca; el juego la pone en {p.sitioPorDefinir}.</span>
      {/if}
    {:else if hovered.kind === 'estado' && layers.energia && sim.energia.length}
      {@const regionEstado = hovered.region ?? REGION_DEL_ESTADO.get(hovered.estado.clave)}
      {@const reg = sim.energia.find((e) => e.region.id === regionEstado)}
      {@const aparte = hovered.region ? [] : (SUBREGIONES_DEL_ESTADO.get(hovered.estado.clave) ?? [])}
      <span class="label tip-kind">Estado · {hovered.estado.clave}</span>
      <strong>{hovered.estado.nombre}</strong>
      {#if reg}
        <span class="tip-rail energia-nivel" class:critico={reg.nivel === 'critico'}>
          {reg.region.parteDe ? `Sistema aislado de ${reg.region.nombre}` : `Región ${reg.region.nombre}`}: {TEXTO_NIVEL[reg.nivel]}
        </span>
        <span class="tip-sub">
          Margen {reg.margen.tarde.toLocaleString('es-MX', { maximumFractionDigits: 1 })} % en la tarde ·
          {reg.margen.noche.toLocaleString('es-MX', { maximumFractionDigits: 1 })} % en la noche (mínimo {UMBRALES[reg.region.sistema].operativo} %)
        </span>
        <span class="tip-sub">
          Demanda máxima {fmt.format(Math.round(reg.demanda))} MW{reg.demandaPolos > 0.05
            ? `, ${reg.demandaPolos.toLocaleString('es-MX', { maximumFractionDigits: 1 })} de polos`
            : ''}
        </span>
        {#if reg.region.margenCalculado}
          <span class="tip-sub">Sin enlace con el resto del estado. El PRODESEN no publica su margen: lo calcula el juego.</span>
        {/if}
        {#if reg.gas}
          <span class="tip-sub">
            Gas: llegan {fmt.format(reg.gas.capacidad)} millones de pies cúbicos diarios y sus ciclos combinados de 2018 queman
            {fmt.format(Math.round(reg.gas.consumo2018))}{reg.gas.nuevasMW > 0
              ? `; de los ${fmt.format(Math.round(reg.gas.nuevasMW))} MW nuevos cuentan ${fmt.format(Math.round(Math.min(reg.gas.nuevasMW, reg.gas.disponiblesMW)))}`
              : ''}
          </span>
        {/if}
        {#each aparte as a (a.id)}
          <span class="tip-sub">{a.nombre}, al norte, es un sistema aislado aparte.</span>
        {/each}
      {/if}
    {:else if hovered.kind === 'estado' && layers.combustibles && sim.modo === 'juego' && sim.abasto && ESTADOS_CONSUMO.includes(hovered.estado.clave)}
      {@const clave = hovered.estado.clave}
      {@const a = sim.abasto}
      {@const _reloj = sim.horas}
      {@const año = añoDe(sim.horas)}
      {@const c = sim.cuentaCombustibles(año, clave)}
      {@const zonas = ZONAS_DEL_ESTADO.get(clave) ?? []}
      {@const r = REPARTO[clave] ?? {}}
      {@const usa = a.consumo.get(clave) ?? 0}
      {@const hueco = a.hueco.get(clave) ?? 0}
      <span class="label tip-kind" style:color={COMBUSTIBLE}>Combustibles · {clave}</span>
      <strong>{hovered.estado.nombre}</strong>
      <span class="tip-rail">
        Usa {fmtMil(usa)} mil barriles diarios · en {año}, el {Math.round(parteDelPais(clave) * 100)} % vino del país
      </span>
      <span class="tip-sub">
        Se surte {[
          ...zonas.map((z) => `${Math.round((z.estados[clave] ?? 0) * 100)} % por los ductos de ${z.nombre}`),
          ...(r.mar ? [`${Math.round(r.mar * 100)} % por mar`] : []),
          ...(r.tren ? [`${Math.round(r.tren * 100)} % por tren`] : []),
        ].join(', ')} (SENER, 2018)
      </span>
      {#if zonas.length}
        <span class="tip-sub">Hoy sus ductos le traen {fmtMil(a.porDucto.get(clave) ?? 0)} mil b/d de refinerías del país</span>
      {/if}
      {#if hueco > 0.05}
        <span class="tip-sub">Le faltan {fmtMil(hueco)} mil b/d: los traen tus trenes y buques tanque, o se importan</span>
        <span class="tip-sub">
          En sus terminales: {fmtMil(sim.enTerminales(clave) / 1000)} mil barriles que llevaste
          {#if c.tren + c.barco > 0}· en {año}, {fmtMil(c.tren / 1000)} mil en tren y {fmtMil(c.barco / 1000)} mil en barco{/if}
        </span>
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
    <span class="stat opcional"><b class="mono">{CIUDADES.length}</b> ciudades</span>
    <span class="stat opcional"><b class="mono">{POLOS.length}</b> polos</span>
    <span class="stat" title="Kilómetros de vía en servicio"><b class="mono">{fmt.format(kmDeVia)}</b> km de vía</span>
    <span class="stat"><b class="mono">{sim.trenes.length}</b> trenes</span>
    <span class="stat"><b class="mono">{sim.barcos.length}</b> barcos</span>
  {/if}
</div>

{#if layers.energia && !tablero.catalogo}
  <div class="vias panel energia">
    <span class="label">{sim.modo === 'realidad' ? 'Energía · margen estimado' : 'Energía · margen de cada región'}</span>
    <ul class="leyenda dos">
      {#each Object.entries(TEXTO_NIVEL) as [n, texto] (n)}
        <li><span class="mancha" style:background={COLOR_ENERGIA[n as NivelEnergia].replace(/[\d.]+\)$/, '0.75)')}></span>{texto.split(' · ')[0]}</li>
      {/each}
      {#each TECNOLOGIAS as [nombre, color] (nombre)}
        <li><span class="punto" style:background={color}></span>{nombre}</li>
      {/each}
      <li><span class="punto anillo"></span>Privada · <span class="punto lleno"></span>CFE</li>
      {#if sim.modo === 'realidad'}
        <li class="ancho"><span class="punto anillo punteado"></span>CFE en obra · <span class="punto anillo tenue"></span>anunciada</li>
      {/if}
    </ul>
    {#if sim.modo === 'realidad'}
      <p class="nota-leyenda">Margen estimado por el juego: los oficiales de 2019 más las centrales que entraron de verdad.</p>
    {/if}
  </div>
{:else if layers.combustibles && !tablero.catalogo}
  <div class="vias panel energia">
    <span class="label">Combustibles · {sim.modo === 'juego' ? `lo que vino del país en ${añoDe(sim.horas)}` : 'del país'}</span>
    {#if sim.modo === 'juego'}
      <div class="degradado-combustible" aria-hidden="true"></div>
      <div class="escala-combustible"><span>todo importado</span><span>todo del país</span></div>
    {/if}
    {#if resumenCombustibles}<p class="resumen-combustibles">{resumenCombustibles}</p>{/if}
    <ul class="leyenda dos">
      <li><span class="punto" style:background={COMBUSTIBLE}></span>Terminal por ducto</li>
      <li><span class="punto" style:background={COLOR_RED_TERMINAL.mar}></span>Por mar</li>
      <li><span class="punto" style:background={COLOR_RED_TERMINAL.tren}></span>Por tren</li>
    </ul>
    <p class="nota-leyenda">
      {sim.modo === 'juego' ? 'Terminales de Pemex por cómo les llega el combustible (SENER, 2018).' : 'Sin cifras por estado en Realidad. Terminales de Pemex: SENER, 2018.'}
    </p>
  </div>
{:else if layers.ductos && !tablero.catalogo}
  <div class="vias panel energia">
    <span class="label">Ductos</span>
    <ul class="leyenda dos">
      <li><span class="raya" style:background={GAS}></span>Gas</li>
      <li><span class="raya" style:background={REFINERIA}></span>Petrolíferos</li>
      <li><span class="raya tenue" style:background={GAS}></span>Gas de EUA</li>
      <li><span class="raya" style:background={CRUDO}></span>Crudo</li>
      <li><span class="raya en-obra"></span>En obra</li>
      <li><span class="raya fuera"></span>Fuera de operación</li>
    </ul>
    <p class="nota-leyenda">
      Trazos aproximados: los de la CNH y, donde faltan, los poliductos que lista el mapa de la SENER de 2018, unidos por el juego. Los
      gasoductos posteriores a 2018 llegan en su fecha real; el Cuxtal II lo construye el Estado.
    </p>
  </div>
{/if}

<div class="tools panel">
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

  /* In the lower half of the screen it opens above the cursor, so a long one isn't cut off. */
  .tip.arriba {
    transform: translate(16px, calc(-100% - 10px));
  }

  .tip.flip.arriba {
    transform: translate(calc(-100% - 16px), calc(-100% - 10px));
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

  /* ---- track colour switch and legend ------------------------------------ */

  /* Bottom left, just right of the left column (clock, layers, fleet), over
     the Pacific: on the right it would cover the peninsula, the region that
     runs short first. */
  .vias {
    position: fixed;
    left: calc(1rem + 260px + 0.75rem);
    bottom: 4.4rem;
    z-index: 30;
    width: 13.5rem;
    padding: 0.55rem 0.65rem 0.6rem;
    font-size: 0.7rem;
  }





  .vias.energia {
    width: 17rem;
  }

  .leyenda.dos {
    grid-template-columns: 1fr 1fr;
    column-gap: 0.6rem;
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


  .raya.en-obra {
    height: 0;
    background: none;
    border-top: 2px dashed rgba(244, 241, 222, 0.85);
  }



  .raya.tenue {
    opacity: 0.4;
  }

  .raya.fuera {
    height: 0;
    background: none;
    border-top: 2px dotted rgba(110, 231, 183, 0.6);
    border-radius: 0;
  }

  .mancha {
    flex: none;
    width: 14px;
    height: 10px;
    border-radius: 3px;
  }

  .punto {
    flex: none;
    display: inline-block;
    width: 9px;
    height: 9px;
    border-radius: 50%;
  }

  .punto.anillo {
    border: 1.5px solid var(--muted);
  }

  .punto.lleno {
    background: var(--muted);
    margin-left: 0.2rem;
  }

  .punto.punteado {
    border-style: dashed;
  }

  .punto.tenue {
    border-style: dotted;
    opacity: 0.55;
    margin-left: 0.2rem;
  }

  .leyenda li.ancho {
    grid-column: 1 / -1;
  }

  .nota-leyenda {
    margin: 0.45rem 0 0;
    padding: 0 0.15rem;
    font-size: 0.66rem;
    line-height: 1.35;
    color: var(--muted);
    opacity: 0.85;
  }

  .energia-nivel {
    color: #b7f5cf;
  }

  /* The fuel layer's scale: the states' own fill, from imported to the country's. */
  .degradado-combustible {
    height: 0.55rem;
    margin: 0.45rem 0.15rem 0.2rem;
    border-radius: 3px;
    background: linear-gradient(90deg, rgba(245, 185, 113, 0.05), rgba(245, 185, 113, 0.55));
    border: 1px solid var(--line);
  }

  .escala-combustible {
    display: flex;
    justify-content: space-between;
    padding: 0 0.15rem;
    font-size: 0.64rem;
    color: var(--muted);
  }

  .alerta-tip {
    color: #fca5a5;
  }

  .resumen-combustibles {
    margin: 0.4rem 0 0.1rem;
    padding: 0 0.15rem;
    font-size: 0.7rem;
    line-height: 1.35;
    color: #f5d9b4;
  }

  .tip-aduana {
    color: #fcd34d;
  }

  /* Sea trade: the sea colour. */
  .tip-mar {
    color: #7dd3fc;
  }

  .energia-nivel.critico {
    color: #fca5a5;
  }

  .tip-lento {
    color: #fca5a5;
  }

  /* The stats share the bottom edge with the legend: they give way first. */
  @media (max-width: 1600px) {
    .stat.opcional {
      display: none;
    }
  }

  @media (max-width: 1360px) {
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
