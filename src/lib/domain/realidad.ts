import DATOS from './datos/obras-via-real.json';
import { horasDeFecha } from './calendario';

/**
 * What really happened with each rail work of the catalog
 * (`datos/obras-via-real.json`, every date with its source): the Realidad
 * mode shows the board as it stood on any date since 1 December 2018, the day
 * the government took office (the game's own start), instead of what
 * the player builds.
 *
 * A work is announced, then under way, then in operation. Official progress
 * figures are points in time; between two of them (the start counts as 0 %,
 * the opening as 100 %) the progress is interpolated, and says so.
 */

type Fuente = { fuente: string; url: string };
type ObraRealJson = {
  /** "2024", "2024-03" or "2024-03-15": as precise as the source is. */
  anuncio?: string;
  inicio?: string;
  operacion?: string;
  /** A part of it opened before the whole. */
  parcial?: { fecha: string; texto: string };
  /** Official progress figures, oldest first. */
  avances?: { fecha: string; pct: number }[];
  /** When the government expects it open, in its own words. */
  prevista?: string;
  /** Where it stands at the data's cut-off, when it isn't a date. */
  situacion?: string;
  nota?: string;
  fuentes: string[];
};
type RealJson = { corte: string; nota: string; fuentes: Record<string, Fuente>; obras: Record<string, ObraRealJson> };
const REAL = DATOS as unknown as RealJson;

export const CORTE_REAL = REAL.corte;

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** "15 de diciembre de 2023", "marzo de 2023" or "2020": no more precise than the data. */
export function fechaEnPalabras(fecha: string): string {
  const [a, m, d] = fecha.split('-');
  return d ? `${+d} de ${MESES[+m - 1]} de ${a}` : m ? `${MESES[+m - 1]} de ${a}` : a;
}

export const HORAS_DEL_CORTE = horasDeFecha(REAL.corte) + 24;

export type EtapaReal = 'sin-proyecto' | 'sin-anunciar' | 'anunciada' | 'en-obra' | 'en-operacion';

export const TEXTO_ETAPA: Record<EtapaReal, string> = {
  'sin-proyecto': 'sin proyecto oficial',
  'sin-anunciar': 'aún sin anunciar',
  anunciada: 'anunciada',
  'en-obra': 'en obra',
  'en-operacion': 'en operación',
};

export type EstadoReal = {
  etapa: EtapaReal;
  /** 0–1 while under way, when there's any figure to go by; null when there's none. */
  avance: number | null;
  /** The progress is interpolated between two official figures. */
  estimado: boolean;
  /** A part already open on that date. */
  parcial: string | null;
};

export type FichaReal = ObraRealJson & { fuentesCitadas: Fuente[] };

/** The real record of a work, with its sources spelled out; null when it has no official project. */
export function fichaReal(id: string): FichaReal | null {
  const o = REAL.obras[id];
  return o ? { ...o, fuentesCitadas: o.fuentes.map((f) => REAL.fuentes[f]).filter(Boolean) } : null;
}

/** Where work `id` really stood at game hour `horas`. */
export function estadoReal(id: string, horas: number): EstadoReal {
  const o = REAL.obras[id];
  const nada = { avance: null, estimado: false, parcial: null };
  if (!o) return { etapa: 'sin-proyecto', ...nada };
  if (o.operacion && horas >= horasDeFecha(o.operacion)) return { etapa: 'en-operacion', avance: 1, estimado: false, parcial: null };
  if (o.inicio && horas >= horasDeFecha(o.inicio)) {
    // Known points: the start, each official figure, the opening.
    const puntos: [number, number][] = [[horasDeFecha(o.inicio), 0]];
    for (const a of o.avances ?? []) puntos.push([horasDeFecha(a.fecha), a.pct / 100]);
    if (o.operacion) puntos.push([horasDeFecha(o.operacion), 1]);
    let avance: number | null = null;
    let estimado = false;
    if (puntos.length > 1) {
      const i = puntos.findIndex(([h]) => h > horas);
      if (i < 0) avance = puntos[puntos.length - 1][1];
      else {
        const [h0, p0] = puntos[i - 1];
        const [h1, p1] = puntos[i];
        avance = p0 + ((p1 - p0) * (horas - h0)) / (h1 - h0);
        estimado = true;
      }
    }
    return { etapa: 'en-obra', avance, estimado, parcial: o.parcial && horas >= horasDeFecha(o.parcial.fecha) ? o.parcial.texto : null };
  }
  if (o.anuncio && horas >= horasDeFecha(o.anuncio)) return { etapa: 'anunciada', ...nada };
  return { etapa: 'sin-anunciar', ...nada };
}
