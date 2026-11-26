import { CLASES_BARCO, KM_POR_MILLA } from './barcos';
import { COMBUSTIBLES, crudoPorPuerto } from './combustibles';
import { ENERGIA } from './energia';
import type { Trayecto } from './trayecto';

/**
 * The buyers' tankers (`crudoPorDestino` in `datos/combustibles.json`): the crude the country exports
 * leaves on them, from the four ports it left from in 2018, towards the gateway of its region —
 * Houston for the United States and the rest of the Americas, Róterdam for Europe, Shanghái for the
 * Far East — in the shares of 2018. They're traffic the player doesn't run, like the private
 * railroads' trains: each one sails once it has a full load waiting and is gone when it arrives.
 */

type CrudoPorDestino = {
  mbd: Record<string, Record<string, number>>;
  salidas: Record<string, string>;
  barrilesPorPetrolero: Record<string, number>;
  flete: { porBarrilUsd: Record<string, number>; dato: string; fuentes: string[] };
  dato: string;
  fuentes: string[];
};
export const CRUDO_POR_DESTINO = (COMBUSTIBLES as unknown as { crudoPorDestino: CrudoPorDestino }).crudoPorDestino;

/** Knots of a buyer's tanker: the game's tanker class. */
export const KMH_PETROLERO = CLASES_BARCO.tanque.nudos * KM_POR_MILLA;
/** Barrels a buyer's tanker loads on each route (the usual ship of each: estimate of the game). */
export const barrilesPorPetrolero = (destino: string) => CRUDO_POR_DESTINO.barrilesPorPetrolero[destino] ?? 1_000_000;

/**
 * What a player's tanker earns for each barrel of exported crude it takes to a gateway, millions of
 * pesos: the market freight to Houston, Róterdam or Shanghái (`crudoPorDestino.flete`, estimate of the game).
 */
export const fleteMdpPorBarril = (destino: string) => ((CRUDO_POR_DESTINO.flete.porBarrilUsd[destino] ?? 0) * ENERGIA.tipoCambio) / 1e6;

/** A year of the crude the player's tankers took abroad: barrels, the freight charged (millions of pesos), barrels by gateway. */
export type CuentaCrudo = { barriles: number; mdp: number; porPuerta: Record<string, number> };
export const cuentaCrudoVacia = (): CuentaCrudo => ({ barriles: 0, mdp: 0, porPuerta: {} });

/** Each gateway's share of the crude exported in 2018. */
const PARTE_DESTINO = (() => {
  const a = CRUDO_POR_DESTINO.mbd['2018'];
  const total = Object.values(a).reduce((s, x) => s + x, 0);
  const m = new Map<string, number>();
  for (const [region, x] of Object.entries(a)) {
    const puerta = CRUDO_POR_DESTINO.salidas[region];
    m.set(puerta, (m.get(puerta) ?? 0) + x / total);
  }
  return m;
})();

export type RutaPetrolera = { origen: string; destino: string; mbd: number };

/**
 * Where the crude exported now goes, Mbd, by port and gateway: each port its 2018 share
 * (`crudoPorPuerto`), each gateway its 2018 share of the total. Salina Cruz, on the Pacific, sends
 * all of its crude to Asia; the Gulf ports share the rest of Asia's, the United States' and
 * Europe's by what each exports.
 */
export function rutasPetroleras(exportado: number): RutaPetrolera[] {
  const porPuerto = crudoPorPuerto(exportado);
  const asia = 'puerta:asia';
  const pacifico = porPuerto.get('puerto:salina-cruz') ?? 0;
  const rutas: RutaPetrolera[] = [];
  if (pacifico > 0) rutas.push({ origen: 'puerto:salina-cruz', destino: asia, mbd: pacifico });
  const golfo = [...porPuerto].filter(([p]) => p !== 'puerto:salina-cruz');
  const totalGolfo = golfo.reduce((s, [, x]) => s + x, 0);
  if (totalGolfo <= 0) return rutas;
  for (const [destino, parte] of PARTE_DESTINO) {
    const mbd = destino === asia ? Math.max(0, exportado * parte - pacifico) : exportado * parte;
    for (const [origen, x] of golfo) if (mbd > 0 && x > 0) rutas.push({ origen, destino, mbd: (mbd * x) / totalGolfo });
  }
  return rutas;
}

/**
 * A tanker the player doesn't run, under way: its route, the game hour it sailed and the barrels it
 * carries. `crudo`, a buyer's with exported crude; `combustible`, Pemex's with Deer Park's fuel for
 * Mexico, from Houston to Tuxpan.
 */
export type Petrolero = {
  id: number;
  origen: string;
  destino: string;
  trayecto: Trayecto;
  salida: number;
  barriles: number;
  carga: 'crudo' | 'combustible';
};

/** Km run along a path `h` hours after setting out, at each segment's speed (the Canal is slower). */
export function kmEnHoras(t: Trayecto, h: number): number {
  if (h <= 0) return 0;
  if (h >= t.horas) return t.km;
  let lo = 0;
  let hi = t.acumH.length - 2;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (t.acumH[mid] <= h) lo = mid;
    else hi = mid - 1;
  }
  return Math.min(t.km, t.acum[lo] + (h - t.acumH[lo]) * t.vel[lo]);
}
