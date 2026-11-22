import DATOS from './datos/sectores.json';

/**
 * Manufacturing sectors, for the companies in a polo's lots
 * (`datos/sectores.json`, from `scripts/polos/gen-sectores.mjs`, every figure
 * with its source). What a company of each one asks per worker, against the
 * manufacturing average: electricity and water (INEGI, Censos Económicos
 * 2019, data for 2018); and the tonnes the railway moved of its products per
 * worker, with the share that left the country (ARTF, yearbook 2018).
 */

type Fuente = { fuente: string; url: string };

export type Sector = {
  id: string;
  nombre: string;
  corto: string;
  scian: string[];
  color: string;
  personal: number;
  /** Electricity and water per worker, times the manufacturing average. */
  energia: number;
  agua: number;
  /** Tonnes by rail a year per worker, and the share exported. */
  toneladas: number;
  exportacion: number;
  /** Ships in containers (no products of its own in the rail yearbook). */
  enContenedores: boolean;
};

type SectoresJson = {
  corte: string;
  fuentes: Record<string, Fuente>;
  manufactura: { personal: number; electricidadPorTrabajador: number; aguaPorTrabajador: number; contenedoresPorTrabajador: number };
  sectores: Sector[];
  dato: string;
  fuentesDato: string[];
  reglas: { dato: string; fuentes: string[]; diasPatio: number };
};

const D = DATOS as unknown as SectoresJson;
export const SECTORES_DATOS = D;
export const SECTORES: Sector[] = D.sectores;
export const sector = (id: string | null | undefined) => (id ? (SECTORES.find((s) => s.id === id) ?? null) : null);
export const fuenteSector = (k: string) => D.fuentes[k];
/** A polo's freight waits at its station this many days of it. */
export const DIAS_PATIO_POLO = D.reglas.diasPatio;
