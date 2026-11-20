import { kmhDe, type ClaseBarco } from '$lib/domain/barcos';
import { rutaMar } from '$lib/domain/mar';
import { ruta } from '$lib/domain/red';
import { nombreCorto, puerta } from '$lib/domain/sitios';
import type { Trayecto } from '$lib/domain/trayecto';
import { sim } from './simulacion.svelte';

export type TipoUnidad = 'tren' | 'barco';

/**
 * UI state of the board that both the map and the panels touch: laying out a
 * new train or ship, and camera requests from the panels (the roster asks,
 * the map flies). Kept apart from `sim` so the simulation stays about the
 * simulation.
 */
class Tablero {
  /** Which kind of vehicle the roster is showing, and what "＋ Nuevo" makes. */
  pestaña = $state<TipoUnidad>('tren');
  /** Picking stops on the map for a new vehicle of kind `pestaña`. */
  trazando = $state(false);
  /** The kind of ship being laid out. */
  claseBarco = $state<ClaseBarco>('contenedores');
  /** Stops picked so far, as site keys, in order. */
  paradas = $state<string[]>([]);
  /** Site under the cursor while picking, if it would be a valid next stop. */
  candidato = $state<string | null>(null);
  /** One line of feedback for the last pick ("Sin estación…"), cleared on the next. */
  aviso = $state<string | null>(null);
  /** The legs between the stops already picked. */
  elegida = $state.raw<Trayecto[]>([]);
  /** The picked legs plus the leg to the candidate. Raw: route geometry is big and immutable. */
  previa = $state.raw<Trayecto[]>([]);
  /** Bumped to ask the map to fly to a vehicle; the map watches it. */
  irA = $state<{ id: string; n: number } | null>(null);

  #n = 0;

  empezar() {
    sim.seleccionar(null);
    this.trazando = true;
    this.#limpiar();
  }

  cancelar() {
    this.trazando = false;
    this.#limpiar();
  }

  #limpiar() {
    this.paradas = [];
    this.candidato = null;
    this.aviso = null;
    this.elegida = [];
    this.previa = [];
  }

  /** Why `clave` can't be the next stop, or null if it can. */
  motivo(clave: string): string | null {
    return this.pestaña === 'tren' ? this.#motivoTren(clave) : this.#motivoBarco(clave);
  }

  #motivoTren(clave: string): string | null {
    const red = sim.red;
    if (!red) return 'La red aún no carga';
    if (clave.startsWith('puerta:')) return 'Es una salida por mar, no una estación';
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

  #motivoBarco(clave: string): string | null {
    if (!sim.mar) return 'Las rutas marítimas aún no cargan';
    if (clave.startsWith('ciudad:')) return 'Los barcos solo hacen escala en puertos';
    if (clave === this.paradas.at(-1)) return 'Es la misma escala que la anterior';
    return null;
  }

  /** Hovering a site while picking: preview the leg to it when it's a valid stop. */
  señalar(clave: string | null) {
    const valido = clave !== null && this.motivo(clave) === null;
    const next = valido ? clave : null;
    if (next === this.candidato) return;
    this.candidato = next;
    const tramo = next ? this.#leg(this.paradas.at(-1), next) : null;
    // A ship's loop closes back on its first port: show that leg too.
    const cierre = next && this.pestaña === 'barco' && this.paradas.length ? this.#leg(next, this.paradas[0]) : null;
    this.previa = [...this.elegida, ...(tramo ? [tramo] : []), ...(cierre ? [cierre] : [])];
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

  /** Changing the kind of ship re-times the legs picked so far (each class has its own speed). */
  cambiarClase(clase: ClaseBarco) {
    this.claseBarco = clase;
    const legs: Trayecto[] = [];
    for (let i = 1; i < this.paradas.length; i++) {
      const leg = this.#leg(this.paradas[i - 1], this.paradas[i]);
      if (leg) legs.push(leg);
    }
    this.elegida = legs;
    this.previa = legs;
    this.candidato = null;
  }

  quitarUltima() {
    if (!this.paradas.length) return;
    this.paradas = this.paradas.slice(0, -1);
    this.elegida = this.elegida.slice(0, Math.max(0, this.paradas.length - 1));
    this.previa = this.elegida;
    this.aviso = null;
  }

  /** Put the laid-out vehicle in service; returns its id. */
  despachar(): string | null {
    if (this.paradas.length < 2) return null;
    const unidad =
      this.pestaña === 'tren' ? sim.agregarTren(this.paradas) : sim.agregarBarco(this.claseBarco, this.paradas);
    this.cancelar();
    if (!unidad) return null;
    sim.seleccionar(unidad.id);
    return unidad.id;
  }

  volarA(id: string) {
    this.irA = { id, n: ++this.#n };
  }

  /** Totals of the preview (picked legs + the leg to the candidate). */
  get kmPrevia(): number {
    return this.previa.reduce((s, t) => s + t.km, 0);
  }

  get horasPrevia(): number {
    return this.previa.reduce((s, t) => s + t.horas, 0);
  }

  /** Totals of the picked legs, plus a ship's closing leg back to its first port. */
  get kmElegida(): number {
    return [...this.elegida, ...this.#cierre()].reduce((s, t) => s + t.km, 0);
  }

  get horasElegida(): number {
    return [...this.elegida, ...this.#cierre()].reduce((s, t) => s + t.horas, 0);
  }

  #cierre(): Trayecto[] {
    if (this.pestaña !== 'barco' || this.paradas.length < 2) return [];
    const c = this.#leg(this.paradas.at(-1), this.paradas[0]);
    return c ? [c] : [];
  }

  #leg(desde: string | undefined, hasta: string): Trayecto | null {
    if (!desde) return null;
    if (this.pestaña === 'barco') {
      return sim.mar ? rutaMar(sim.mar, desde, hasta, kmhDe(this.claseBarco)) : null;
    }
    const red = sim.red;
    if (!red) return null;
    const a = red.estaciones.get(desde);
    const b = red.estaciones.get(hasta);
    return a && b ? ruta(red, a.nodo, b.nodo) : null;
  }

  /** Readable name of a stop, for the banner. A gateway is named by where it goes. */
  nombre(clave: string): string {
    const p = puerta(clave);
    return p ? `${p.hacia} (vía ${p.nombre})` : nombreCorto(clave);
  }
}

export const tablero = new Tablero();
