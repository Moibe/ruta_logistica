import { browser } from '$app/environment';
import { construirRed, type Red, type RedJson } from '$lib/domain/red';
import { SITIOS } from '$lib/domain/sitios';
import { avanzar, COLORES_TREN, crearTren, ESPERA_TERMINAL_H, SERVICIOS, type Tren } from '$lib/domain/trenes';

/**
 * Simulated hours per real second at 1×. A freight train at 60 km/h then
 * covers 60 km a second — about 25 px on the whole-country board, slow enough
 * to follow, fast enough to see Manzanillo–CDMX done in a quarter of a minute.
 */
const HORAS_POR_SEGUNDO = 1;

export const VELOCIDADES = [0, 0.25, 1, 4, 16] as const;

/** The game opens on day 1 at six in the morning. */
const HORA_INICIAL = 6;

/**
 * The one clock and the one fleet. The board reads trains from here and draws
 * them; nothing about a train's state lives in a view.
 *
 * `trenes` is `$state.raw` on purpose: the step function mutates trains in
 * place sixty times a second, and deep-proxying their route geometry would
 * cost more than everything else in a frame. The views that need to re-render
 * as trains move also read `horas`, which changes every tick.
 *
 * The rAF loop is reference-counted (as in logistica-oceanica): the board
 * `attach()`es while it's mounted, and with no viewer the clock stops — the
 * world views don't show trains, so leaving the board pauses the game.
 */
class Simulacion {
  estado = $state<'inactiva' | 'cargando' | 'lista' | 'error'>('inactiva');
  horas = $state(HORA_INICIAL);
  /** Index into VELOCIDADES; 0 is pause. */
  velocidad = $state(2);
  trenes = $state.raw<Tren[]>([]);
  seleccion = $state<string | null>(null);
  /** The camera keeps the selected train centred. */
  siguiendo = $state(false);

  /** The network with stations. Static once loaded, so not reactive. */
  red: Red | null = null;

  #carga: Promise<void> | null = null;
  #siguiente = 1;
  #color = 0;
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

  get seleccionado(): Tren | null {
    return this.trenes.find((t) => t.id === this.seleccion) ?? null;
  }

  /** Load the network and lay on the opening timetable. Idempotent. */
  cargar(): Promise<void> {
    this.#carga ??= (async () => {
      this.estado = 'cargando';
      try {
        const res = await fetch('/data/red-ferroviaria.json');
        if (!res.ok) throw new Error(`red ferroviaria: HTTP ${res.status}`);
        this.red = construirRed((await res.json()) as RedJson, SITIOS);
        const flota: Tren[] = [];
        SERVICIOS.forEach((paradas, i) => {
          // Spread the fleet over its timetable (golden-ratio steps through a
          // day and a half), so the board opens with trains everywhere instead
          // of all of them loading at their first stop.
          const desfase = ((i * 0.618) % 1) * 36 + ESPERA_TERMINAL_H * 0.5;
          const t = this.#crear(paradas, desfase);
          if (t) flota.push(t);
        });
        this.trenes = flota;
        this.estado = 'lista';
      } catch (err) {
        console.error(err);
        this.estado = 'error';
        this.#carga = null;
      }
    })();
    return this.#carga;
  }

  #crear(paradas: string[], desfase = 0): Tren | null {
    if (!this.red) return null;
    const t = crearTren(this.red, {
      id: `T-${String(this.#siguiente).padStart(2, '0')}`,
      color: COLORES_TREN[this.#color % COLORES_TREN.length],
      paradas,
      desfase,
    });
    if (t) {
      this.#siguiente++;
      this.#color++;
    }
    return t;
  }

  /** Put a new train in service. Null when the stops can't be joined by rail. */
  agregar(paradas: string[]): Tren | null {
    const t = this.#crear(paradas);
    if (t) this.trenes = [...this.trenes, t];
    return t;
  }

  retirar(id: string) {
    this.trenes = this.trenes.filter((t) => t.id !== id);
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
      // and every train would teleport down the line.
      const dt = Math.min(0.1, (now - this.#ultimo) / 1000);
      this.#ultimo = now;
      const horas = this.corriendo ? dt * HORAS_POR_SEGUNDO * this.multiplicador : 0;
      if (horas > 0) {
        for (const t of this.trenes) avanzar(t, horas);
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
