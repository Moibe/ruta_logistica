import { browser } from '$app/environment';
import { COLORES_BARCO, crearBarco, NOMBRES_BARCO, SERVICIOS_BARCO, type Barco, type ClaseBarco } from '$lib/domain/barcos';
import { construirMar, type Mar, type RutasMarJson } from '$lib/domain/mar';
import { construirRed, type Red, type RedJson } from '$lib/domain/red';
import { aplicarSaturacion, costoConUso, trenesDelJugador, usoDe, type Uso } from '$lib/domain/saturacion';
import {
  avanzarObraVia,
  medirObras,
  OBRAS_VIA,
  obraVia,
  obraViaNueva,
  personasEnObraVia,
  presupuestarVia,
  type Medida,
  type ObraViaEstado,
  type PresupuestoVia,
} from '$lib/domain/obrasVia';
import { fechaCorta, horaDelDia, horasDeHoy, mesDe } from '$lib/domain/calendario';
import { mensualidad, type Mensualidad } from '$lib/domain/presupuesto';
import {
  CAJA_CFE_MES,
  estadoEnergia,
  mwDelPolo,
  OBRAS_ENERGIA,
  obraEnergia,
  presupuestarPlanta,
  regionDelPolo,
  type EstadoRegion,
} from '$lib/domain/energia';
import { estadoReal, type EstadoReal } from '$lib/domain/realidad';
import { avanzar } from '$lib/domain/servicio';
import {
  avanzarObra,
  empleosPermanentes,
  obraNueva,
  personasTrabajando,
  presupuestar,
  type ObraPolo,
} from '$lib/domain/obras';
import { POLOS, SITIOS } from '$lib/domain/sitios';
import { COLORES_TREN, crearTren, ESPERA_TERMINAL_H, SERVICIOS, type Tren } from '$lib/domain/trenes';

/**
 * Simulated hours per real second at 1×. A freight train at 60 km/h then
 * covers 60 km a second — about 25 px on the whole-country board, slow enough
 * to follow, fast enough to see Manzanillo–CDMX done in a quarter of a minute.
 * Ships are slower and their voyages longer; 4× and 16× are there for them.
 */
const HORAS_POR_SEGUNDO = 1;

export const VELOCIDADES = [0, 0.25, 1, 4, 16] as const;

/** The game opens on 1 December 2018, the day the government took office, at six in the morning. */
const HORA_INICIAL = 6;

export type Unidad = Tren | Barco;

/**
 * Two ways to look at the same board. In **juego** the player is the State and
 * builds; in **realidad** nothing is played: the board shows what was really
 * announced, under way and open on a date (`realidad.ts`), today by default.
 */
export type Modo = 'juego' | 'realidad';

/**
 * The one clock and the one fleet. The board reads trains and ships from here
 * and draws them; nothing about a vehicle's state lives in a view.
 *
 * `trenes` and `barcos` are `$state.raw` on purpose: the step function mutates
 * them in place sixty times a second, and deep-proxying their route geometry
 * would cost more than everything else in a frame. The views that need to
 * re-render as they move also read `horas`, which changes every tick.
 *
 * The rAF loop is reference-counted (as in logistica-oceanica): the board and
 * the two world views `attach()` while they're mounted — ships sail on all
 * three — and with no viewer the clock stops.
 */
class Simulacion {
  estado = $state<'inactiva' | 'cargando' | 'lista' | 'error'>('inactiva');
  horas = $state(HORA_INICIAL);
  /** Index into VELOCIDADES; 0 is pause. */
  velocidad = $state(2);
  trenes = $state.raw<Tren[]>([]);
  barcos = $state.raw<Barco[]>([]);
  /** Id of the selected train or ship. */
  seleccion = $state<string | null>(null);

  /**
   * The State's money, millions of pesos. It comes in at the start of every
   * month (the year's federal rail budget and the concession fees, in twelfths:
   * `presupuesto.ts`) and works are paid out of it as they advance. What isn't
   * spent stays.
   */
  dinero = $state(0);
  /** The latest monthly payment, for the ledger. */
  ultimaMensualidad = $state.raw<Mensualidad | null>(null);
  /**
   * The CFE's till, millions of pesos: what it puts into its own plants each
   * month (`energia.ts`). Only its plants are paid from here.
   */
  dineroCfe = $state(0);
  /** Every CFE plant of the catalog, by id: phase, progress, payments. */
  obrasEnergia = $state.raw<Map<string, ObraViaEstado>>(new Map(OBRAS_ENERGIA.map((o) => [o.id, obraViaNueva(o.id)])));
  /**
   * Each electricity region now: demand, available capacity and reserve
   * margins at the afternoon and night peaks. Recomputed once a game day and
   * whenever a plant is finished.
   */
  energia = $state.raw<EstadoRegion[]>([]);
  #diaEnergia = -1;
  /** Months already paid in (0 is December 2018): the next one to pay. */
  #mesesCobrados = 0;
  /**
   * Every Polo del Bienestar's work and occupancy, by polo id. Mutated in place
   * by the clock like the fleet; views that show it also read `horas`.
   */
  obras = $state.raw<Map<string, ObraPolo>>(new Map(POLOS.map((p) => [p.id, obraNueva(p.id)])));
  /**
   * Every rail work of the State's catalog, by id: its phase, progress and
   * payments. Mutated in place by the clock like the polos.
   */
  obrasVia = $state.raw<Map<string, ObraViaEstado>>(new Map(OBRAS_VIA.map((o) => [o.id, obraViaNueva(o.id)])));
  /**
   * Each work measured once on the 2018 network: its km (what it costs) and its
   * lines (what the board draws for it). Set on load, before `estado` is 'lista'.
   */
  medidas: Map<string, Medida> = new Map();
  /** Bumped when the rail network is rebuilt (a finished polo got its station): the board re-bakes the track. */
  versionRed = $state(0);
  /** The camera keeps the selected vehicle centred. */
  siguiendo = $state(false);
  modo = $state<Modo>('juego');
  /** In Realidad, each rail work as it really stood on the date shown (`horas`). Empty in the game. */
  real = $state.raw<Map<string, EstadoReal>>(new Map());
  /** The game, set aside while Realidad is on. */
  #juego: {
    horas: number;
    obras: Map<string, ObraPolo>;
    obrasVia: Map<string, ObraViaEstado>;
    obrasEnergia: Map<string, ObraViaEstado>;
    trenes: Tren[];
    barcos: Barco[];
  } | null = null;
  /**
   * The player's trains a day on each rail line (by `Via.base`). Recounted
   * whenever the fleet or the network changes; the board repaints line use
   * from it.
   */
  trenesPorVia = $state.raw<Map<number, number>>(new Map());

  /** The rail network with stations, and the sea lanes. Static once loaded, so not reactive. */
  red: Red | null = null;
  #redJson: RedJson | null = null;
  mar: Mar | null = null;

  #carga: Promise<void> | null = null;
  #siguienteTren = 1;
  #siguienteBarco = 1;
  #frame = 0;
  #ultimo = 0;
  #espectadores = 0;

  get multiplicador(): number {
    return VELOCIDADES[this.velocidad];
  }

  get corriendo(): boolean {
    // Realidad shows a date; its clock doesn't run.
    return this.estado === 'lista' && this.modo === 'juego' && this.multiplicador > 0;
  }

  /** "3 mar 2019": the game opens on 1 December 2018 (`calendario.ts`). */
  get fecha(): string {
    return fechaCorta(this.horas);
  }

  get reloj(): string {
    return horaDelDia(this.horas);
  }

  get unidades(): Unidad[] {
    return [...this.trenes, ...this.barcos];
  }

  get seleccionado(): Unidad | null {
    const id = this.seleccion;
    if (!id) return null;
    return this.trenes.find((t) => t.id === id) ?? this.barcos.find((b) => b.id === id) ?? null;
  }

  /** Load the rail network and the sea lanes, and lay on the opening fleet. Idempotent. */
  cargar(): Promise<void> {
    this.#carga ??= (async () => {
      this.estado = 'cargando';
      try {
        const [redRes, marRes] = await Promise.all([fetch('/data/red-ferroviaria.json'), fetch('/data/rutas-maritimas.json')]);
        if (!redRes.ok) throw new Error(`red ferroviaria: HTTP ${redRes.status}`);
        if (!marRes.ok) throw new Error(`rutas marítimas: HTTP ${marRes.status}`);
        this.#redJson = (await redRes.json()) as RedJson;
        this.red = construirRed(this.#redJson, SITIOS);
        this.medidas = medirObras(this.red);
        this.mar = construirMar((await marRes.json()) as RutasMarJson);

        const trenes: Tren[] = [];
        SERVICIOS.forEach((paradas, i) => {
          // Spread the trains over their timetables (golden-ratio steps through
          // a day and a half), so the board opens with trains everywhere instead
          // of all of them loading at their first stop.
          const desfase = ((i * 0.618) % 1) * 36 + ESPERA_TERMINAL_H * 0.5;
          const t = this.#crearTren(paradas, desfase);
          if (t) trenes.push(t);
        });
        const barcos: Barco[] = [];
        for (const s of SERVICIOS_BARCO) {
          const b = this.#crearBarco(s.clase, s.paradas, { zarpando: true, desfase: s.desfase });
          if (b) barcos.push(b);
        }
        this.trenes = trenes;
        this.barcos = barcos;
        this.#saturar();
        this.#cobrar();
        this.#actualizarEnergia(true);
        this.estado = 'lista';
      } catch (err) {
        console.error(err);
        this.estado = 'error';
        this.#carga = null;
      }
    })();
    return this.#carga;
  }

  #crearTren(paradas: string[], desfase = 0): Tren | null {
    if (!this.red) return null;
    const n = this.#siguienteTren;
    const t = crearTren(
      this.red,
      {
        id: `T-${String(n).padStart(2, '0')}`,
        color: COLORES_TREN[(n - 1) % COLORES_TREN.length],
        paradas,
        desfase,
      },
      this.costoRuta
    );
    if (t) this.#siguienteTren++;
    return t;
  }

  #crearBarco(clase: ClaseBarco, paradas: string[], opciones: { zarpando?: boolean; desfase?: number } = {}): Barco | null {
    if (!this.mar) return null;
    const n = this.#siguienteBarco;
    const b = crearBarco(this.mar, {
      id: `B-${String(n).padStart(2, '0')}`,
      nombre: NOMBRES_BARCO[(n - 1) % NOMBRES_BARCO.length],
      color: COLORES_BARCO[(n - 1) % COLORES_BARCO.length],
      clase,
      paradas,
      ...opciones,
    });
    if (b) this.#siguienteBarco++;
    return b;
  }

  /** Put a new train in service. Null when the stops can't be joined by rail. */
  agregarTren(paradas: string[]): Tren | null {
    const t = this.#crearTren(paradas);
    if (t) {
      this.trenes = [...this.trenes, t];
      this.#saturar();
    }
    return t;
  }

  /** Put a new ship in service, loading at its first port. */
  agregarBarco(clase: ClaseBarco, paradas: string[]): Barco | null {
    const b = this.#crearBarco(clase, paradas);
    if (b) this.barcos = [...this.barcos, b];
    return b;
  }

  retirar(id: string) {
    const antes = this.trenes.length;
    this.trenes = this.trenes.filter((t) => t.id !== id);
    if (this.trenes.length !== antes) this.#saturar();
    this.barcos = this.barcos.filter((b) => b.id !== id);
    if (this.seleccion === id) this.seleccionar(null);
  }

  seleccionar(id: string | null) {
    this.seleccion = id;
    if (!id) this.siguiendo = false;
  }

  // ---- Realidad ---------------------------------------------------------------------------------

  /**
   * Set the game aside and show the real board, as of today. The game's
   * fleet, works and clock wait untouched for `salirRealidad`; the money isn't
   * touched because nothing is paid or built here.
   */
  entrarRealidad() {
    if (this.modo === 'realidad' || this.estado !== 'lista') return;
    this.#juego = { horas: this.horas, obras: this.obras, obrasVia: this.obrasVia, obrasEnergia: this.obrasEnergia, trenes: this.trenes, barcos: this.barcos };
    this.seleccionar(null);
    this.modo = 'realidad';
    // The game's trains and ships are made-up services: none of them here.
    this.trenes = [];
    this.barcos = [];
    this.obras = new Map(POLOS.map((p) => [p.id, obraNueva(p.id)]));
    this.obrasEnergia = new Map(OBRAS_ENERGIA.map((o) => [o.id, obraViaNueva(o.id)]));
    this.irA(horasDeHoy(), true);
  }

  /** In Realidad, show the board as it stood at game hour `horas` (1 December 2018 to today). */
  irA(horas: number, forzar = false) {
    if (this.modo !== 'realidad') return;
    this.horas = Math.max(0, Math.min(horas, horasDeHoy()));
    const real = new Map(OBRAS_VIA.map((o) => [o.id, estadoReal(o.id, this.horas)]));
    const enServicio = (m: Map<string, ObraViaEstado>) => [...m.values()].filter((o) => o.fase === 'en-servicio').map((o) => o.id).join();
    const antes = enServicio(this.obrasVia);
    this.obrasVia = new Map(
      OBRAS_VIA.map((o) => {
        const r = real.get(o.id)!;
        const fase = r.etapa === 'en-operacion' ? 'en-servicio' : r.etapa === 'en-obra' ? 'en-obra' : 'por-construir';
        return [o.id, { ...obraViaNueva(o.id), fase, avance: r.avance ?? 0 }];
      })
    );
    this.real = real;
    // The track itself changes only when a work opens (or, going back, un-opens).
    if (forzar || enServicio(this.obrasVia) !== antes) this.#reconstruirRed();
    this.#actualizarEnergia(true);
  }

  /** Back to the game, exactly where it was left. */
  salirRealidad() {
    const j = this.#juego;
    if (this.modo !== 'realidad' || !j) return;
    this.modo = 'juego';
    this.real = new Map();
    this.horas = j.horas;
    this.obras = j.obras;
    this.obrasVia = j.obrasVia;
    this.obrasEnergia = j.obrasEnergia;
    this.trenes = j.trenes;
    this.barcos = j.barcos;
    this.#juego = null;
    this.#reconstruirRed();
    this.#actualizarEnergia(true);
  }

  alternarPausa() {
    // Back to 1× rather than to whatever was on before: after scrubbing at
    // 16× you want to land somewhere you can watch.
    this.velocidad = this.velocidad === 0 ? 2 : 0;
  }

  // ---- the Polos del Bienestar ------------------------------------------------------------

  /** Order a polo built with `cuadrillas` crews. Paid as it advances; false if it can't start. */
  construirPolo(id: string, cuadrillas: number): boolean {
    const obra = this.obras.get(id);
    const polo = POLOS.find((p) => p.id === id);
    if (!obra || !polo || obra.fase !== 'por-construir') return false;
    obra.plan = presupuestar(polo, cuadrillas);
    obra.fase = 'en-obra';
    this.obras = new Map(this.obras);
    return true;
  }

  /** Whether a train can reach the polo: it has its station on the network. */
  conectado(id: string): boolean {
    return !!this.red?.estaciones.has(`polo:${id}`);
  }

  /** People working on polo sites and rail works right now. */
  get empleosEnObra(): number {
    let n = 0;
    for (const o of this.obras.values()) n += personasTrabajando(o);
    for (const o of this.obrasVia.values()) n += personasEnObraVia(o);
    for (const o of this.obrasEnergia.values()) n += personasEnObraVia(o);
    return n;
  }

  // ---- the State's rail works ---------------------------------------------------------------

  /** What building work `id` with `cuadrillas` crews takes. Null until the network is measured. */
  presupuestoVia(id: string, cuadrillas: number): PresupuestoVia | null {
    const o = obraVia(id);
    const m = this.medidas.get(id);
    return o && m ? presupuestarVia(o, m.km, cuadrillas) : null;
  }

  /** Order a rail work built. Paid as it advances; false if it can't start. */
  construirObraVia(id: string, cuadrillas: number): boolean {
    const estado = this.obrasVia.get(id);
    const plan = this.presupuestoVia(id, cuadrillas);
    if (!estado || !plan || estado.fase !== 'por-construir') return false;
    estado.plan = plan;
    estado.fase = 'en-obra';
    this.obrasVia = new Map(this.obrasVia);
    return true;
  }

  /** How the player's trains weigh each tramo when choosing their way: line use now, the State's track first. */
  get costoRuta() {
    return this.red ? costoConUso(this.red, this.trenesPorVia) : undefined;
  }

  /** Permanent jobs in the operating polos right now. */
  get empleosPermanentes(): number {
    let n = 0;
    for (const p of POLOS) {
      const o = this.obras.get(p.id);
      if (o) n += empleosPermanentes(o, p);
    }
    return n;
  }

  /** Pay in every month that has begun and isn't paid yet (several, after a long frame at 16×). */
  #cobrar() {
    const mes = mesDe(this.horas);
    if (this.#mesesCobrados > mes) return;
    let caja = this.dinero;
    let cajaCfe = this.dineroCfe;
    let ultima: Mensualidad | null = null;
    while (this.#mesesCobrados <= mes) {
      ultima = mensualidad(this.#mesesCobrados++);
      caja += ultima.total;
      cajaCfe += CAJA_CFE_MES;
    }
    this.dinero = caja;
    this.dineroCfe = cajaCfe;
    this.ultimaMensualidad = ultima;
  }

  // ---- electricity ----------------------------------------------------------------------------

  /** What building CFE plant `id` with `cuadrillas` crews takes. */
  presupuestoPlanta(id: string, cuadrillas: number) {
    const o = obraEnergia(id);
    return o ? presupuestarPlanta(o, cuadrillas) : null;
  }

  /** Order a CFE plant built, paid from the CFE's till as it advances. */
  construirPlanta(id: string, cuadrillas: number): boolean {
    const estado = this.obrasEnergia.get(id);
    const plan = this.presupuestoPlanta(id, cuadrillas);
    if (!estado || !plan || estado.fase !== 'por-construir') return false;
    estado.plan = plan;
    estado.fase = 'en-obra';
    this.obrasEnergia = new Map(this.obrasEnergia);
    return true;
  }

  /** The electricity region of a polo, now. */
  energiaDelPolo(id: string): EstadoRegion | null {
    const r = regionDelPolo(id);
    return this.energia.find((e) => e.region.id === r) ?? null;
  }

  /** Whether companies can still move into the polo: its region has margin at both peaks. */
  hayEnergia(id: string): boolean {
    return this.energiaDelPolo(id)?.alcanza ?? true;
  }

  /** Recompute the regions once a game day (or now, with `forzar`). */
  #actualizarEnergia(forzar = false) {
    const dia = Math.floor(this.horas / 24);
    if (!forzar && dia === this.#diaEnergia) return;
    this.#diaEnergia = dia;
    const hechas = OBRAS_ENERGIA.filter((o) => this.obrasEnergia.get(o.id)?.fase === 'en-servicio');
    const polos = new Map<string, number>();
    for (const o of this.obras.values()) if (o.fase === 'operando' && o.ocupacion > 0) polos.set(o.id, mwDelPolo(o.id) * o.ocupacion);
    this.energia = estadoEnergia(this.horas, hechas, polos);
  }

  #avanzarObras(horas: number) {
    const caja = { mdp: this.dinero };
    let terminadas = false;
    for (const o of this.obras.values()) {
      if (o.fase === 'por-construir') continue;
      // Companies come only with a train and with electricity in the region.
      if (avanzarObra(o, horas, caja, this.conectado(o.id) && this.hayEnergia(o.id))) terminadas = true;
    }
    let viasTerminadas = false;
    for (const o of this.obrasVia.values()) {
      if (o.fase !== 'en-obra') continue;
      if (avanzarObraVia(o, horas, caja, this.horas + horas)) viasTerminadas = true;
    }
    if (viasTerminadas) {
      this.obrasVia = new Map(this.obrasVia);
      terminadas = true;
    }
    if (caja.mdp !== this.dinero) this.dinero = caja.mdp;

    // CFE plants, from the CFE's own till.
    const cajaCfe = { mdp: this.dineroCfe };
    let plantasTerminadas = false;
    for (const o of this.obrasEnergia.values()) {
      if (o.fase !== 'en-obra') continue;
      if (avanzarObraVia(o, horas, cajaCfe, this.horas + horas)) plantasTerminadas = true;
    }
    if (cajaCfe.mdp !== this.dineroCfe) this.dineroCfe = cajaCfe.mdp;
    if (plantasTerminadas) {
      this.obrasEnergia = new Map(this.obrasEnergia);
      this.#actualizarEnergia(true);
    }

    if (terminadas) this.#reconstruirRed();
    this.#actualizarEnergia();
  }

  /**
   * A finished polo within reach of the track gets its spur and station; a
   * finished rail work changes the track. Rebuild the network with all of it,
   * and let every train find its way again on it.
   */
  #reconstruirRed() {
    if (!this.#redJson) return;
    const enServicio = new Set(
      [...this.obras.values()].filter((o) => o.fase === 'operando').map((o) => `polo:${o.id}`)
    );
    const hechas = OBRAS_VIA.filter((o) => this.obrasVia.get(o.id)?.fase === 'en-servicio');
    this.red = construirRed(this.#redJson, SITIOS, enServicio, hechas);
    this.#rerutear();
    this.#saturar();
    this.versionRed++;
  }

  /**
   * Every train re-plans its route on the new network, keeping its place in
   * the timetable: same leg, same share of it run, same wait.
   */
  #rerutear() {
    if (!this.red) return;
    const costo = this.costoRuta;
    this.trenes = this.trenes.map((viejo) => {
      const nuevo = crearTren(this.red!, { id: viejo.id, color: viejo.color, paradas: viejo.paradas }, costo);
      if (!nuevo || nuevo.piernas.length !== viejo.piernas.length) return viejo;
      const antes = viejo.piernas[viejo.pierna];
      const ahora = nuevo.piernas[viejo.pierna];
      nuevo.pierna = viejo.pierna;
      nuevo.estado = viejo.estado;
      nuevo.espera = viejo.espera;
      nuevo.km = antes.km > 0 ? (viejo.km / antes.km) * ahora.km : 0;
      nuevo.odometro = viejo.odometro;
      return nuevo;
    });
  }

  /** Recount the player's trains on every line and slow each train down where its lines are full. */
  #saturar() {
    if (!this.red) return;
    const porVia = trenesDelJugador(this.trenes);
    aplicarSaturacion(this.red, this.trenes, porVia);
    this.trenesPorVia = porVia;
  }

  /** How full a rail line is (by `Via.base`): private trains, the player's, and what fits. */
  uso(base: number): Uso | null {
    const v = this.red?.vias[base];
    return v ? usoDe(v, this.trenesPorVia) : null;
  }

  /** Register a viewer; returns the teardown, so call sites read `$effect(() => sim.attach())`. */
  attach(): () => void {
    if (!browser) return () => {};
    this.#espectadores++;
    if (this.#espectadores === 1) this.#arrancar();
    return () => {
      this.#espectadores--;
      if (this.#espectadores === 0) this.#detener();
    };
  }

  #arrancar() {
    this.#ultimo = performance.now();
    const tick = (now: number) => {
      // Clamp the delta: a backgrounded tab hands back a multi-second frame
      // and every vehicle would teleport down the line.
      const dt = Math.min(0.1, (now - this.#ultimo) / 1000);
      this.#ultimo = now;
      const horas = this.corriendo ? dt * HORAS_POR_SEGUNDO * this.multiplicador : 0;
      if (horas > 0) {
        for (const t of this.trenes) avanzar(t, horas);
        for (const b of this.barcos) avanzar(b, horas);
        this.#cobrar();
        this.#avanzarObras(horas);
        this.horas += horas;
      }
      this.#frame = requestAnimationFrame(tick);
    };
    this.#frame = requestAnimationFrame(tick);
  }

  #detener() {
    cancelAnimationFrame(this.#frame);
    this.#frame = 0;
  }
}

export const sim = new Simulacion();
