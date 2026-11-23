/**
 * Whether a side panel is folded, remembered in this browser only: a viewer's convenience, so it
 * may come back empty (private window, cleared data) and the panel then starts open. The board is
 * rendered on the server, where it's always open; `recordar` reads the browser after mounting.
 */
export class Plegable {
  plegado = $state(false);
  #clave: string;

  constructor(clave: string) {
    this.#clave = `ruta-logistica:${clave}`;
  }

  recordar() {
    try {
      this.plegado = localStorage.getItem(this.#clave) === '1';
    } catch {
      // No storage: it stays open.
    }
  }

  alternar() {
    this.plegado = !this.plegado;
    try {
      localStorage.setItem(this.#clave, this.plegado ? '1' : '0');
    } catch {
      // No storage: it folds for this visit only.
    }
  }
}
