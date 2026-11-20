/**
 * The game's calendar. Play opens on 1 December 2018, the day the 2018–2024
 * government took office: the network is the one Mexico had in 2018, and
 * everything after is the player's to build. The Realidad timeline starts the
 * same day. Game time is kept as hours since that midnight (`sim.horas`); this
 * turns it into dates and back. The year is what the budget runs on
 * (`presupuesto.ts`).
 */

/** 1 December 2018 (`mes` counts from 0, as in `Date`). */
export const INICIO = { año: 2018, mes: 11, dia: 1 } as const;
const INICIO_MS = Date.UTC(INICIO.año, INICIO.mes, INICIO.dia);
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

/** Game hours of a date as precise as given ("2024", "2024-03", "2024-03-15"): a year or a month count from their first day. */
export function horasDeFecha(fecha: string): number {
  const [a, m = '01', d = '01'] = fecha.split('-');
  return (Date.UTC(+a, +m - 1, +d) - INICIO_MS) / MS_POR_HORA;
}

/** Right now, in game hours. */
export const horasDeHoy = () => (Date.now() - INICIO_MS) / MS_POR_HORA;

/** The moment as a decimal year: 2019.5 is about 2 July 2019. */
export function añoDecimal(horas: number): number {
  const f = fechaDe(horas);
  const a = f.getUTCFullYear();
  const desde = Date.UTC(a, 0, 1);
  return a + (f.getTime() - desde) / (Date.UTC(a + 1, 0, 1) - desde);
}

/** Months since the start: 0 is December 2018. Changes exactly when a month turns. */
export function mesDe(horas: number): number {
  const f = fechaDe(horas);
  return (f.getUTCFullYear() - INICIO.año) * 12 + f.getUTCMonth() - INICIO.mes;
}

/** The calendar year and month (from 0) of month `mes` of the game. */
export function mesCalendario(mes: number): { año: number; mes: number } {
  const t = INICIO.mes + mes;
  return { año: INICIO.año + Math.floor(t / 12), mes: t % 12 };
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

/** "marzo de 2019", for a month of the game from `mesDe`. */
export function nombreMes(mes: number): string {
  const c = mesCalendario(mes);
  return `${MESES_LARGOS[c.mes]} de ${c.año}`;
}
