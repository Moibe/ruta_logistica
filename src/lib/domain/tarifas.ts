import DATOS from './datos/tarifas.json';
import { DUEÑOS, type Red } from './red';
import type { Trayecto } from './trayecto';

/**
 * What the State's trains charge and cost (`datos/tarifas.json`, every figure with its source).
 * Each leg a train runs:
 *
 * - **charges** the tonnes it has aboard by the leg's km, at what rail freight earned on average
 *   in 2018 (ARTF);
 * - **costs** what moving a train a km cost the concessionaires in 2018, loaded or empty;
 * - **pays trackage rights** for its km on private track.
 *
 * All goes into and out of the State's till.
 */

type Fuente = { fuente: string; url: string };
type Dato = { dato: string; fuentes: string[] };
type TarifasJson = {
  fuentes: Record<string, Fuente>;
  ingreso: { pesosPorTkm: number } & Dato;
  costo: { pesosPorTrenKm: number; razonOperacion: number } & Dato;
  derechoPaso: { pesosPorTrenKm: number } & Dato;
};
export const TARIFAS = DATOS as unknown as TarifasJson;
export const PESOS_POR_TKM = TARIFAS.ingreso.pesosPorTkm;
export const COSTO_TREN_KM = TARIFAS.costo.pesosPorTrenKm;
export const PASO_TREN_KM = TARIFAS.derechoPaso.pesosPorTrenKm;

/** Km of a leg on track the State doesn't own (concessionaires'), cached per leg. */
const PRIVADOS = new WeakMap<Trayecto, number>();
export function kmPrivados(t: Trayecto, red: Red): number {
  const hay = PRIVADOS.get(t);
  if (hay !== undefined) return hay;
  let km = 0;
  if (t.vias)
    for (let i = 0; i < t.vias.length; i++) {
      const v = red.vias[t.vias[i]];
      const estatal = !v?.dueño || DUEÑOS[v.dueño]?.tipo === 'estatal';
      if (!estatal) km += t.acum[i + 1] - t.acum[i];
    }
  PRIVADOS.set(t, km);
  return km;
}

/** A year of the State's trains, millions of pesos: charged, run, trackage rights; and tonne-km and train-km. */
export type CuentaTrenes = { ingreso: number; costo: number; paso: number; tkm: number; km: number };
export const cuentaTrenesVacia = (): CuentaTrenes => ({ ingreso: 0, costo: 0, paso: 0, tkm: 0, km: 0 });
