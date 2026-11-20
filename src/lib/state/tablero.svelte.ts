import { ruta, type Trayecto } from '$lib/domain/red';
import { nombreCorto } from '$lib/domain/sitios';
import { sim } from './simulacion.svelte';

/**
 * UI state of the board that both the map and the panels touch: laying out a
 * new train, and camera requests from the panels (the roster asks, the map
 * flies). Kept apart from `sim` so the simulation stays about the simulation.
 */
class Tablero {
  /** Picking stations on the map for a new train. */
  trazando = $state(false);
  /** Stops picked so far, as site keys, in order. */
  paradas = $state<string[]>([]);
  /** Site under the cursor while picking, if it would be a valid next stop. */
  candidato = $state<string | null>(null);
  /** One line of feedback for the last pick ("Sin estación…"), cleared on the next. */
  aviso = $state<string | null>(null);
  /**
   * The route so far plus the leg to the candidate. Raw: route geometry is
   * big and immutable.
   */
  previa = $state.raw<Trayecto[]>([]);
  /** The legs between the stops already picked (the preview minus the candidate). */
  elegida = $state.raw<Trayecto[]>([]);
  /** Bumped to ask the map to fly to a train; the map watches it. */
  irA = $state<{ tren: string; n: number } | null>(null);

  #n = 0;

  empezar() {
    sim.seleccionar(null);
    this.trazando = true;
    this.paradas = [];
    this.candidato = null;
    this.aviso = null;
    this.elegida = [];
    this.previa = [];
  }

  cancelar() {
    this.trazando = false;
    this.paradas = [];
    this.candidato = null;
    this.aviso = null;
    this.elegida = [];
    this.previa = [];
  }

  /** Why `clave` can't be the next stop, or null if it can. */
  motivo(clave: string): string | null {
    const red = sim.red;
    if (!red) return 'La red aún no carga';
    const e = red.estaciones.get(clave);
    if (!e) {
      const km = red.sinEstacion.get(clave);
      return `Sin estación: la vía más cercana está a ${Math.round(km ?? 0)} km`;
    }
    const ultima = this.paradas.at(-1);
    if (!ultima) return null;
    const u = red.estaciones.get(ultima)!;
    if (u.nodo === e.nodo) return 'Es la misma estación que la parada anterior';
    if (red.componente[u.nodo] !== red.componente[e.nodo]) {
      return `Sin conexión por vía con ${nombreCorto(ultima)}`;
    }
    return null;
  }

  /** Hovering a site while picking: preview the leg to it when it's a valid stop. */
  señalar(clave: string | null) {
    const valido = clave !== null && this.motivo(clave) === null;
    const next = valido ? clave : null;
    if (next === this.candidato) return;
    this.candidato = next;
    const tramo = next ? this.#leg(this.paradas.at(-1), next) : null;
    this.previa = tramo ? [...this.elegida, tramo] : this.elegida;
  }

  /** Clicking a site while picking. */
  elegir(clave: string) {
    const problema = this.motivo(clave);
    if (problema) {
      this.aviso = problema;
      return;
    }
    const leg = this.#leg(this.paradas.at(-1), clave);
    if (leg) this.elegida = [...this.elegida, leg];
    this.paradas = [...this.paradas, clave];
    this.aviso = null;
    this.candidato = null;
    this.previa = this.elegida;
  }

  quitarUltima() {
    if (!this.paradas.length) return;
    this.paradas = this.paradas.slice(0, -1);
    this.elegida = this.elegida.slice(0, Math.max(0, this.paradas.length - 1));
    this.previa = this.elegida;
    this.aviso = null;
  }

  /** Put the laid-out train in service; returns its id. */
  despachar(): string | null {
    if (this.paradas.length < 2) return null;
    const tren = sim.agregar(this.paradas);
    this.cancelar();
    if (!tren) return null;
    sim.seleccionar(tren.id);
    return tren.id;
  }

  volarA(tren: string) {
    this.irA = { tren, n: ++this.#n };
  }

  /** Totals of the preview (picked legs + the leg to the candidate). */
  get kmPrevia(): number {
    return this.previa.reduce((s, t) => s + t.km, 0);
  }

  get horasPrevia(): number {
    return this.previa.reduce((s, t) => s + t.horas, 0);
  }

  /** Totals of the picked legs only. */
  get kmElegida(): number {
    return this.elegida.reduce((s, t) => s + t.km, 0);
  }

  get horasElegida(): number {
    return this.elegida.reduce((s, t) => s + t.horas, 0);
  }

  #leg(desde: string | undefined, hasta: string): Trayecto | null {
    const red = sim.red;
    if (!red || !desde) return null;
    const a = red.estaciones.get(desde);
    const b = red.estaciones.get(hasta);
    return a && b ? ruta(red, a.nodo, b.nodo) : null;
  }
}

export const tablero = new Tablero();
