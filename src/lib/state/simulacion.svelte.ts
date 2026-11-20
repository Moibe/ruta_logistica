import { browser } from '$app/environment';
import { COLORES_BARCO, crearBarco, NOMBRES_BARCO, SERVICIOS_BARCO, type Barco, type ClaseBarco } from '$lib/domain/barcos';
import { construirMar, type Mar, type RutasMarJson } from '$lib/domain/mar';
import { construirRed, type Red, type RedJson } from '$lib/domain/red';
import { aplicarSaturacion, trenesDelJugador, usoDe, type Uso } from '$lib/domain/saturacion';
import { avanzar } from '$lib/domain/servicio';
import {
  avanzarObra,
  empleosPermanentes,
  obraNueva,
  personasTrabajando,
  presupuestar,
  presupuestoInicialMdp,
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

/** The game opens on day 1 at six in the morning. */
const HORA_INICIAL = 6;

export type Unidad = Tren | Barco;

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
   * The State's money, millions of pesos. Works are paid out of it as they
   * advance; nothing pays in yet (the budget comes later).
   */
  dinero = $state(presupuestoInicialMdp());
  /**
   * Every Polo del Bienestar's work and occupancy, by polo id. Mutated in place
   * by the clock like the fleet; views that show it also read `horas`.
   */
  obras = $state.raw<Map<string, ObraPolo>>(new Map(POLOS.map((p) => [p.id, obraNueva(p.id)])));
  /** Bumped when the rail network is rebuilt (a finished polo got its station): the board re-bakes the track. */
  versionRed = $state(0);
  /** The camera keeps the selected vehicle centred. */
  siguiendo = $state(false);
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
    return this.estado === 'lista' && this.multiplicador > 0;
  }

  get dia(): number {
    return Math.floor(this.horas / 24) + 1;
  }

  get reloj(): string {
    const h = Math.floor(this.horas % 24);
    const m = Math.floor((this.horas % 1) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
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
    const t = crearTren(this.red, {
      id: `T-${String(n).padStart(2, '0')}`,
      color: COLORES_TREN[(n - 1) % COLORES_TREN.length],
      paradas,
      desfase,
    });
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

  /** People working on polo sites right now. */
  get empleosEnObra(): number {
    let n = 0;
    for (const o of this.obras.values()) n += personasTrabajando(o);
    return n;
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

  #avanzarObras(horas: number) {
    const caja = { mdp: this.dinero };
    let terminadas = false;
    for (const o of this.obras.values()) {
      if (o.fase === 'por-construir') continue;
      if (avanzarObra(o, horas, caja, this.conectado(o.id))) terminadas = true;
    }
    if (caja.mdp !== this.dinero) this.dinero = caja.mdp;
    if (terminadas) this.#reconstruirRed();
  }

  /** A finished polo within reach of the track gets its spur and station: rebuild the network with it. */
  #reconstruirRed() {
    if (!this.#redJson) return;
    const enServicio = new Set(
      [...this.obras.values()].filter((o) => o.fase === 'operando').map((o) => `polo:${o.id}`)
    );
    this.red = construirRed(this.#redJson, SITIOS, enServicio);
    this.#saturar();
    this.versionRed++;
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
