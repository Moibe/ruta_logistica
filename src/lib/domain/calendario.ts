/**
 * The game's calendar. Play opens on 1 January 2019: the network is the one
 * Mexico had in 2018, and everything after is the player's to build. Game
 * time is kept as hours since that midnight (`sim.horas`); this turns it into
 * dates. The year is what the budget runs on (`presupuesto.ts`).
 */

export const AÑO_INICIAL = 2019;
const INICIO_MS = Date.UTC(AÑO_INICIAL, 0, 1);
const MS_POR_HORA = 3_600_000;

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES_LARGOS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/** The game moment `horas` as a UTC date (the calendar has no time zones). */
export const fechaDe = (horas: number) => new Date(INICIO_MS + horas * MS_POR_HORA);

export const añoDe = (horas: number) => fechaDe(horas).getUTCFullYear();

/** Months since the start: 0 is January 2019. Changes exactly when a month turns. */
export function mesDe(horas: number): number {
  const f = fechaDe(horas);
  return (f.getUTCFullYear() - AÑO_INICIAL) * 12 + f.getUTCMonth();
}

/** "3 mar 2019". */
export function fechaCorta(horas: number): string {
  const f = fechaDe(horas);
  return `${f.getUTCDate()} ${MESES[f.getUTCMonth()]} ${f.getUTCFullYear()}`;
}

/** "3 de marzo de 2019". */
export function fechaLarga(horas: number): string {
  const f = fechaDe(horas);
  return `${f.getUTCDate()} de ${MESES_LARGOS[f.getUTCMonth()]} de ${f.getUTCFullYear()}`;
}

/** "14:05". */
export function horaDelDia(horas: number): string {
  const f = fechaDe(horas);
  return `${String(f.getUTCHours()).padStart(2, '0')}:${String(f.getUTCMinutes()).padStart(2, '0')}`;
}

/** "marzo de 2019", for a month index from `mesDe`. */
export function nombreMes(mes: number): string {
  return `${MESES_LARGOS[mes % 12]} de ${AÑO_INICIAL + Math.floor(mes / 12)}`;
}
