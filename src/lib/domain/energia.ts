import DATOS from './datos/energia.json';
import { añoDecimal, horasDeFecha } from './calendario';
import type { LonLat } from './geo';
import { presupuestarObra, type PresupuestoObra } from './obrasVia';
import { GAS_REGIONES, MMPCD_POR_MW, type ObraGas } from './ductos';

/**
 * Electricity for the Polos del Bienestar (`datos/energia.json`, every figure
 * with its source).
 *
 * Mexico's grid is split into regions (CENACE). Each one starts 2019 with its
 * official reserve margins: how much available capacity exceeds the peak
 * demand, at the two peaks the PRODESEN measures — the afternoon one, where
 * solar helps, and the night one, where it doesn't. From there:
 *
 * - **demand** grows at the region's real 2018–2024 rate, plus whatever the
 *   operating polos draw (their MW times how full they are);
 * - **capacity** grows with the private plants on their real dates (the CNE's
 *   permits list) and with the CFE plants the player builds; each counts at
 *   each peak by its technology (firm 90 %, wind 25 %, solar 35 % in the
 *   afternoon and nothing at night). Storage lets a plant count at night: a
 *   thermosolar plant with eleven hours of molten salt is firm, and a plant
 *   with batteries carries its own `aporte` per peak.
 *
 * A polo only fills while its region is above the operating margin (6 % on
 * the interconnected grid, 11 % on the isolated Baja California systems) at
 * both peaks. Mulegé, in the north of Baja California Sur, is a system of its
 * own, isolated from the rest of the peninsula.
 *
 * **Gas.** Where all the gas comes through one pipeline (the Yucatán
 * peninsula, through the Mayakan: `ductos.ts`), the combined cycles built
 * after 2018 only count as far as the gas left over by the 2018 ones reaches;
 * the State's gas work (the Cuxtal II) raises it.
 */

export type Escalon = 'tarde' | 'noche';
export type ClaseTec = 'firme' | 'eolica' | 'solar';
export type Sistema = 'SIN' | 'BC' | 'BCS' | 'MUL';
export type NivelEnergia = 'holgado' | 'justo' | 'critico';
type Fuente = { fuente: string; url: string; dato?: string };

export type Region = {
  id: string;
  nombre: string;
  sistema: Sistema;
  demanda2018: number;
  demanda2024: number;
  /** Yearly growth of the peak demand, 2018 to 2024. */
  crecimiento: number;
  margen2019: Record<Escalon, number>;
  /** The PRODESEN publishes no margin for it: the game works it out from its capacity. */
  margenCalculado?: boolean;
  capacidad2018: number;
  /** States coloured with this region on the map (a split state goes with its main part). */
  estados: string[];
  /** A system inside one state's municipalities (Mulegé, in BCS): its state and municipalities. */
  parteDe?: string;
  municipios?: string[];
  /** Its border with the rest of the state (INEGI), west to east… */
  frontera?: LonLat[];
  /** …and that border closed over the sea: clipped with the state's outline, it is the system's area. */
  zona?: LonLat[];
};

export type Planta = {
  nombre: string;
  tecnologia: string;
  clase: ClaseTec;
  mw: number;
  estado: string;
  municipio: string;
  region: string;
  lonLat: LonLat;
};
export type Planta2018 = Planta & { dueño: 'CFE' | 'privada' };
export type Privada = Planta & { fecha: string; enConstruccion: boolean };
export type ObraEnergia = Planta & {
  id: string;
  costoMusd: number;
  costo: Fuente & { dato: string };
  mesesGobierno: number;
  tiempo: Fuente & { dato: string };
  real: string;
  /** MW it adds at each peak when its technology's factor doesn't tell (storage). */
  aporte?: Record<Escalon, number>;
  /** Why it counts the way it does at each peak. */
  aporteDato?: string;
  /** The CFE hasn't chosen the site yet: the game puts it in `municipio`. */
  sitioPorDefinir?: boolean;
  /** Where the project was announced, when it isn't in the CFE's reports yet. */
  anuncio?: Fuente;
};

type EnergiaJson = {
  corte: string;
  nota: string;
  fuentes: Record<string, Fuente>;
  umbrales: Record<Sistema, { operativo: number; planeacion: number }>;
  factores: Record<ClaseTec, Record<Escalon, number>>;
  cajaCfeMdpAño: number;
  tipoCambio: number;
  mwPorHa: number;
  regiones: Region[];
  polos: Record<string, { region: string; mw: number; oficial: boolean; dato?: string }>;
  plantas2018: Planta2018[];
  privadas: Privada[];
  obras: ObraEnergia[];
};
export const ENERGIA = DATOS as unknown as EnergiaJson;
export const REGIONES = ENERGIA.regiones;
export const FACTORES = ENERGIA.factores;
export const UMBRALES = ENERGIA.umbrales;
export const OBRAS_ENERGIA = ENERGIA.obras;
export const obraEnergia = (id: string) => OBRAS_ENERGIA.find((o) => o.id === id) ?? null;
export const regionDe = (id: string) => REGIONES.find((r) => r.id === id) ?? null;
/** The region of each state's main part, for colouring the map. */
export const REGION_DEL_ESTADO = new Map(REGIONES.flatMap((r) => r.estados.map((e) => [e, r.id] as const)));
/** Systems of their own inside a state (Mulegé inside BCS), by state. */
export const SUBREGIONES_DEL_ESTADO = new Map<string, Region[]>();
for (const r of REGIONES) if (r.parteDe) SUBREGIONES_DEL_ESTADO.set(r.parteDe, [...(SUBREGIONES_DEL_ESTADO.get(r.parteDe) ?? []), r]);
/** What the CFE puts into its own plants each month (millions of pesos). */
export const CAJA_CFE_MES = ENERGIA.cajaCfeMdpAño / 12;

const ESCALONES: Escalon[] = ['tarde', 'noche'];
/**
 * The official 2019 margins are those of the May–August peak; the game pins
 * them to 1 July 2019, so the private plants in service by then count in them
 * already (the rest come in on their own dates).
 */
const CORTE_2019 = horasDeFecha('2019-07-01');
const PRIVADAS = ENERGIA.privadas.map((p) => ({ ...p, desde: horasDeFecha(p.fecha) }));

/** MW a plant adds to its region at one peak: its own figure if it has storage, else its technology's factor. */
export const aporte = (p: { mw: number; clase: ClaseTec; aporte?: Record<Escalon, number> }, e: Escalon) =>
  p.aporte?.[e] ?? p.mw * FACTORES[p.clase][e];

/** Peak demand of the region (without the polos) at game hour `horas`. */
export function demandaBase(r: Region, horas: number): number {
  // The 2018 peak stands for the middle of 2018.
  const años = añoDecimal(horas) - (2018 + 0.5);
  return r.demanda2018 * (1 + r.crecimiento) ** años;
}

/**
 * Available capacity at the start of the game, per region and peak: what the
 * official 2019 margin implies on the 2019 peak demand, less the private
 * plants of 2019 already counted in it (they come in on their own dates).
 */
const CAPACIDAD_INICIAL = new Map(
  REGIONES.map((r) => {
    const d2019 = demandaBase(r, CORTE_2019);
    const cd = {} as Record<Escalon, number>;
    for (const e of ESCALONES) {
      const yaContadas = PRIVADAS.filter((p) => p.region === r.id && p.desde < CORTE_2019).reduce((s, p) => s + aporte(p, e), 0);
      cd[e] = d2019 * (1 + r.margen2019[e] / 100) - yaContadas;
    }
    return [r.id, cd];
  })
);

/** Private plants in service at game hour `horas`. */
export const privadasEnServicio = (horas: number) => PRIVADAS.filter((p) => p.desde <= horas);

export type EstadoRegion = {
  region: Region;
  demanda: number;
  /** Of which, the operating polos. */
  demandaPolos: number;
  capacidad: Record<Escalon, number>;
  margen: Record<Escalon, number>;
  /** The lower of the two margins: what decides. */
  margenMinimo: number;
  nivel: NivelEnergia;
  /** Polos can take companies: above the operating margin at both peaks. */
  alcanza: boolean;
  /** MW of private plants and of the player's CFE plants in service. */
  mwPrivados: number;
  mwCfe: number;
  /** Where the gas that reaches the region limits its plants (the peninsula); null elsewhere. */
  gas: GasEstado | null;
};

export type GasEstado = {
  /** MMpcd that reach the region now. */
  capacidad: number;
  /** MMpcd the 2018 combined cycles burn at full load. */
  consumo2018: number;
  /** MW of new combined cycles in service, and how many of them the gas left reaches. */
  nuevasMW: number;
  disponiblesMW: number;
  /** Share of each new combined cycle that counts (0–1). */
  factor: number;
};

/** A plant that burns gas the region must bring it: the combined cycles. */
export const quemaGas = (p: { tecnologia: string }) => /ciclo combinado/i.test(p.tecnologia);

/** MW of combined cycle the region had in 2018 (PRODESEN). */
const CICLOS_2018 = new Map<string, number>();
for (const p of ENERGIA.plantas2018) if (quemaGas(p)) CICLOS_2018.set(p.region, (CICLOS_2018.get(p.region) ?? 0) + p.mw);

/** How the gas reaching region `id` (`capacidad`, MMpcd) stretches over its new combined cycles (`nuevasMW`). */
export function gasDeRegion(id: string, capacidad: number, nuevasMW: number): GasEstado {
  const consumo2018 = (CICLOS_2018.get(id) ?? 0) * MMPCD_POR_MW;
  const disponiblesMW = Math.max(0, (capacidad - consumo2018) / MMPCD_POR_MW);
  return { capacidad, consumo2018, nuevasMW, disponiblesMW, factor: nuevasMW > 0 ? Math.min(1, disponiblesMW / nuevasMW) : 1 };
}

/**
 * Every region at game hour `horas`, with the CFE plants already built
 * (`hechas`), each polo's current draw in MW (`polos`: polo id → MW) and the
 * gas reaching the regions it limits (`gas`: region id → MMpcd).
 */
export function estadoEnergia(
  horas: number,
  hechas: readonly ObraEnergia[],
  polos: ReadonlyMap<string, number>,
  gas: ReadonlyMap<string, number> = new Map()
): EstadoRegion[] {
  const privadas = privadasEnServicio(horas);
  return REGIONES.map((r) => {
    const umbral = UMBRALES[r.sistema];
    let demandaPolos = 0;
    for (const [id, mw] of polos) if (ENERGIA.polos[id]?.region === r.id) demandaPolos += mw;
    const demanda = demandaBase(r, horas) + demandaPolos;
    const propias = privadas.filter((p) => p.region === r.id);
    const cfe = hechas.filter((o) => o.region === r.id);
    // The new combined cycles count only as far as the gas left over reaches.
    const capGas = gas.get(r.id);
    const gasEstado = capGas === undefined ? null : gasDeRegion(r.id, capGas, cfe.filter(quemaGas).reduce((s, o) => s + o.mw, 0));
    const deGas = (o: ObraEnergia) => (gasEstado && quemaGas(o) ? gasEstado.factor : 1);
    const capacidad = {} as Record<Escalon, number>;
    const margen = {} as Record<Escalon, number>;
    for (const e of ESCALONES) {
      capacidad[e] =
        CAPACIDAD_INICIAL.get(r.id)![e] +
        propias.reduce((s, p) => s + aporte(p, e), 0) +
        cfe.reduce((s, o) => s + aporte(o, e) * deGas(o), 0);
      margen[e] = ((capacidad[e] - demanda) / demanda) * 100;
    }
    const margenMinimo = Math.min(margen.tarde, margen.noche);
    return {
      region: r,
      demanda,
      demandaPolos,
      capacidad,
      margen,
      margenMinimo,
      nivel: margenMinimo < umbral.operativo ? 'critico' : margenMinimo < umbral.planeacion ? 'justo' : 'holgado',
      alcanza: margenMinimo >= umbral.operativo,
      mwPrivados: propias.reduce((s, p) => s + p.mw, 0),
      mwCfe: cfe.reduce((s, o) => s + o.mw, 0),
      gas: gasEstado,
    };
  });
}

/** MMpcd reaching each gas-limited region, with the State's gas works done or not (`hecha`). */
export function gasDisponible(hecha: (obraId: string) => boolean): Map<string, number> {
  const m = new Map<string, number>();
  for (const [id, g] of GAS_REGIONES) m.set(id, hecha(g.obra) ? g.capacidadConObra : g.capacidad);
  return m;
}

/** Cost of a gas work at the government's pace, millions of pesos. */
export const costoGasoductoMdp = (o: ObraGas) => o.costoMusd * ENERGIA.tipoCambio;
export const presupuestarGasoducto = (o: ObraGas, cuadrillas: number): PresupuestoObra =>
  presupuestarObra(costoGasoductoMdp(o), o.mesesGobierno, cuadrillas);

/** MW a polo draws when full. */
export const mwDelPolo = (id: string) => ENERGIA.polos[id]?.mw ?? 0;
export const regionDelPolo = (id: string) => ENERGIA.polos[id]?.region ?? null;

// ---- the CFE's works ---------------------------------------------------------------------------

/** Cost of a CFE plant at the government's pace, millions of pesos. */
export const costoGobiernoMdp = (o: ObraEnergia) => o.costoMusd * ENERGIA.tipoCambio;

export function presupuestarPlanta(o: ObraEnergia, cuadrillas: number): PresupuestoObra {
  return presupuestarObra(costoGobiernoMdp(o), o.mesesGobierno, cuadrillas);
}

/**
 * Months a CFE plant really takes when the CFE's till sets the pace: like
 * `mesesAlRitmoDelDinero`, with the CFE's steady monthly payment.
 */
export function mesesConCajaCfe(costoMdp: number, meses: number, saldo: number): number {
  const porMes = costoMdp / meses;
  let falta = costoMdp;
  let caja = saldo;
  for (let t = 0; t < 1200; t++) {
    const puede = Math.min(porMes, caja);
    if (falta <= puede) return t + falta / porMes;
    caja -= puede;
    falta -= puede;
    caja += CAJA_CFE_MES;
  }
  return Infinity;
}
