import { browser } from '$app/environment';
import { COLORES_BARCO, crearBarco, NOMBRES_BARCO, SERVICIOS_BARCO, type Barco, type ClaseBarco } from '$lib/domain/barcos';
import { construirMar, type Mar, type RutasMarJson } from '$lib/domain/mar';
import { construirRed, type Red, type RedJson } from '$lib/domain/red';
import { aplicarSaturacion, costoConUso, trenesDelJugador, usoDe, type Uso } from '$lib/domain/saturacion';
import {
  avanzarObraVia,
  medirObras,
  OBRAS_VIA,
  obraVia,
  obraViaNueva,
  personasEnObraVia,
  presupuestarVia,
  type Medida,
  type ObraViaEstado,
  type PresupuestoVia,
} from '$lib/domain/obrasVia';
import { añoDe, fechaCorta, horaDelDia, horasDeFecha, horasDeHoy, mesDe } from '$lib/domain/calendario';
import { mensualidad, type Mensualidad } from '$lib/domain/presupuesto';
import {
  CAJA_CFE_MES,
  estadoEnergia,
  gasDisponible,
  mwDelPolo,
  OBRAS_ENERGIA,
  obraEnergia,
  presupuestarGasoducto,
  presupuestarPlanta,
  regionDelPolo,
  type EstadoRegion,
} from '$lib/domain/energia';
import { OBRAS_GAS, obraGas } from '$lib/domain/ductos';
import { clavePolo, estadoReal, type EstadoReal } from '$lib/domain/realidad';
import {
  cajaPemexDelMes,
  COMPRA_DEER_PARK,
  HORAS_COMPRA_DEER_PARK,
  OBRAS_PEMEX,
  obraPemex,
  presupuestarObraPemex,
  refinacionJuego,
  type Refinacion,
} from '$lib/domain/petroleo';
import { avanzar } from '$lib/domain/servicio';
import {
  abastoJuego,
  barrilesEn,
  BARRILES_POR_PIPA,
  BARRILES_POR_TANQUE,
  CONCENTRADORES,
  concentradorDe,
  costaDe,
  cuentaVacia,
  DIAS_EN_PATIO,
  DIAS_POR_SURTIR,
  DESABASTO,
  EN_PIPAS,
  estadosQueSurte,
  llegadaPipas,
  MDP_POR_PIPA,
  PESOS_POR_BARRIL_PIPA,
  PARTE_RENTADOS,
  POR_TIERRA,
  PUERTA_MAR,
  PUERTAS_ZONA,
  REFINERIA_DEL_PUERTO,
  REFINERIAS_DE_COSTA,
  T_POR_BARRIL,
  topeImportacion,
  UMBRAL_DESABASTO,
  type Abasto,
  type Cuenta,
} from '$lib/domain/combustibles';
import {
  abastoDiario,
  BASES_ABASTO,
  COMPLEJOS,
  DIAS_MEMORIA,
  DIAS_RESERVA,
  produccionComplejo,
  produccionFuera,
  produccionJuego,
  TONELADAS_ABASTECEDOR,
} from '$lib/domain/plataformas';
import {
  CARGA_POR_TREN,
  DIAS_EN_ESPERA,
  ESTADOS_EXPORTADORES,
  ESTADOS_PRODUCTIVOS,
  flujoDelEstado,
  flujoNacional,
  SALIDAS,
} from '$lib/domain/exportaciones';
import {
  avanzarObra,
  empleosPermanentes,
  personasTrabajando,
  presupuestar,
  type ObraPolo,
} from '$lib/domain/obras';
import {
  cargaDeClase,
  comercioDe,
  DIAS_INICIO,
  DIAS_PATIO,
  flujoExportacion,
  flujoImportacion,
  flujoImportacionTren,
  PUERTOS_COMERCIO,
  TIPOS_CARGA,
  topeExportacion,
  toneladasDeClase,
  type TipoCarga,
} from '$lib/domain/comercioMar';
import { POLOS, puerta, SITIOS } from '$lib/domain/sitios';
import {
  avanzarInterior,
  cargaDelPolo,
  conEspuela,
  ESPUELA,
  SUBESTACION,
  fijarCuadrillas,
  mwEnUso,
  obraDelPolo,
  ocuparLotes,
  promoverLote,
  resumir,
} from '$lib/domain/interior';
import { DIAS_PATIO_POLO } from '$lib/domain/sectores';
import {
  CENTRALES_CO,
  combustoleoJuego,
  cuentaCoVacia,
  DIAS_PATIO_CO,
  DIAS_RESERVA_CO,
  ENTREGAS_CO,
  mbdCentralCo,
  mwSinCombustoleo,
  PARTE_AUTOMATICA_CO,
  porDuctoCo,
  T_POR_BARRIL_CO,
  type Central,
  type CuentaCo,
} from '$lib/domain/combustoleo';
import { PARTE_ARMADORAS, PLANTAS_INSUMO, PLANTA_INSUMO, parteAutomatica, MEMORIA_DIAS, RESERVA_DIAS, salidaPlanta, insumosAño, ARMADORAS, DIAS_EN_PATIO as DIAS_PATIO_CADENA, FLUJO, FLUJOS, FLUJOS_DEL_ESTADO, autosAño, toneladasAño } from '$lib/domain/cadenas';

const SITIOS_POR_CLAVE = new Map(SITIOS.map((s) => [s.clave, s]));

/** Tonnes moved, in all, by year, by port and by kind of cargo. */
export type Registro = { total: number; porAño: Record<string, number>; porPuerto: Record<string, number>; porTipo: Record<string, number> };
const registroVacio = (): Registro => ({ total: 0, porAño: {}, porPuerto: {}, porTipo: {} });
/** A new record with `ton` more, that year, of that kind, shared out among the ports in `puertos`. */
function sumar(r: Registro, ton: number, año: string, puertos: Record<string, number>, tipo: string): Registro {
  const porPuerto = { ...r.porPuerto };
  for (const [p, t] of Object.entries(puertos)) porPuerto[p] = (porPuerto[p] ?? 0) + t;
  return {
    total: r.total + ton,
    porAño: { ...r.porAño, [año]: (r.porAño[año] ?? 0) + ton },
    porPuerto,
    porTipo: { ...r.porTipo, [tipo]: (r.porTipo[tipo] ?? 0) + ton },
  };
}
const porTipo = (f: (t: TipoCarga) => number) => Object.fromEntries(TIPOS_CARGA.map((t) => [t, f(t)])) as Record<TipoCarga, number>;
import { COLORES_TREN, crearTren, ESPERA_TERMINAL_H, SERVICIOS, type Tren } from '$lib/domain/trenes';

/**
 * Simulated hours per real second at 1×. A freight train at 60 km/h then
 * covers 60 km a second — about 25 px on the whole-country board, slow enough
 * to follow, fast enough to see Manzanillo–CDMX done in a quarter of a minute.
 * Ships are slower and their voyages longer; 4× and 16× are there for them.
 */
const HORAS_POR_SEGUNDO = 1;

export const VELOCIDADES = [0, 0.25, 1, 4, 16] as const;

/** The game opens on 1 December 2018, the day the government took office, at six in the morning. */
const HORA_INICIAL = 6;

export type Unidad = Tren | Barco;

/**
 * Two ways to look at the same board. In **juego** the player is the State and
 * builds; in **realidad** nothing is played: the board shows what was really
 * announced, under way and open on a date (`realidad.ts`), today by default.
 */
export type Modo = 'juego' | 'realidad';

/**
 * The one clock and the one fleet. The board reads trains and ships from here
 * and draws them; nothing about a vehicle's state lives in a view.
 *
 * `trenes` and `barcos` are `$state.raw` on purpose: the step function mutates
 * them in place sixty times a second, and deep-proxying their route geometry
 * would cost more than everything else in a frame. The views that need to
 * re-render as they move also read `horas`, which changes every tick.
 *
 * The rAF loop is reference-counted (as in logistica-oceanica): the board and
 * the two world views `attach()` while they're mounted — ships sail on all
 * three — and with no viewer the clock stops.
 */
class Simulacion {
  estado = $state<'inactiva' | 'cargando' | 'lista' | 'error'>('inactiva');
  horas = $state(HORA_INICIAL);
  /** Index into VELOCIDADES; 0 is pause. */
  velocidad = $state(2);
  trenes = $state.raw<Tren[]>([]);
  barcos = $state.raw<Barco[]>([]);
  /** Id of the selected train or ship. */
  seleccion = $state<string | null>(null);

  /**
   * The State's money, millions of pesos. It comes in at the start of every
   * month (the year's federal rail budget and the concession fees, in twelfths:
   * `presupuesto.ts`) and works are paid out of it as they advance. What isn't
   * spent stays.
   */
  dinero = $state(0);
  /** The latest monthly payment, for the ledger. */
  ultimaMensualidad = $state.raw<Mensualidad | null>(null);
  /**
   * The CFE's till, millions of pesos: what it puts into its own plants each
   * month (`energia.ts`). Only its plants are paid from here.
   */
  dineroCfe = $state(0);
  /** Every CFE work of the catalog, by id — its plants and its gas pipeline (the Cuxtal II): phase, progress, payments. */
  obrasEnergia = $state.raw<Map<string, ObraViaEstado>>(new Map([...OBRAS_ENERGIA, ...OBRAS_GAS].map((o) => [o.id, obraViaNueva(o.id)])));
  /**
   * Each electricity region now: demand, available capacity and reserve
   * margins at the afternoon and night peaks. Recomputed once a game day and
   * whenever a plant is finished.
   */
  energia = $state.raw<EstadoRegion[]>([]);
  #diaEnergia = -1;
  /**
   * Pemex's till, millions of pesos: what the federal government puts into
   * refining each month (`petroleo.ts`). Only Pemex's works are paid from here.
   */
  dineroPemex = $state(0);
  /** This month's payment into Pemex's till, for the ledger. */
  cajaPemexMes = $state(0);
  /** Every Pemex work of the catalog, by id: phase, progress, payments. */
  obrasPemex = $state.raw<Map<string, ObraViaEstado>>(new Map(OBRAS_PEMEX.map((o) => [o.id, obraViaNueva(o.id)])));
  /** Deer Park is all Pemex's (Shell's half bought): what it makes counts for the country. */
  deerParkPropia = $state(false);
  /** What the refineries run and make with the works as they stand. Recomputed once a game day and when a work ends. */
  refinacion = $state.raw<Refinacion | null>(null);
  /** Months already paid in (0 is December 2018): the next one to pay. */
  #mesesCobrados = 0;
  /**
   * Every Polo del Bienestar's work and occupancy, by polo id. Mutated in place
   * by the clock like the fleet; views that show it also read `horas`.
   */
  obras = $state.raw<Map<string, ObraPolo>>(new Map(POLOS.map((p) => [p.id, obraDelPolo(p.id)])));
  /**
   * Every rail work of the State's catalog, by id: its phase, progress and
   * payments. Mutated in place by the clock like the polos.
   */
  obrasVia = $state.raw<Map<string, ObraViaEstado>>(new Map(OBRAS_VIA.map((o) => [o.id, obraViaNueva(o.id)])));
  /**
   * Each work measured once on the 2018 network: its km (what it costs) and its
   * lines (what the board draws for it). Set on load, before `estado` is 'lista'.
   */
  medidas: Map<string, Medida> = new Map();
  /** Bumped when the rail network is rebuilt (a finished polo got its station): the board re-bakes the track. */
  versionRed = $state(0);
  /** The camera keeps the selected vehicle centred. */
  siguiendo = $state(false);
  /**
   * What the player's trains have exported (`exportaciones.ts`): tonnes in all,
   * by year, by exit and by the state it came from. Replaced on every delivery.
   */
  exportacion = $state.raw<{ total: number; porAño: Record<string, number>; porSalida: Record<string, number>; porEstado: Record<string, number> }>({
    total: 0,
    porAño: {},
    porSalida: {},
    porEstado: {},
  });
  /** Export cargo waiting at each state's stations, tonnes. */
  #bodegas = new Map<string, number>();
  /**
   * The domestic cargo the player's trains have delivered: tonnes and
   * tonne-km, in all and by year. Replaced on every delivery.
   */
  cargaNacional = $state.raw<{ total: number; porAño: Record<string, number>; tkm: number; tkmPorAño: Record<string, number> }>({
    total: 0,
    porAño: {},
    tkm: 0,
    tkmPorAño: {},
  });
  /** Domestic cargo waiting at each state's stations, tonnes. */
  #bodegasNacional = new Map<string, number>();
  /** Each supply-chain flow's cargo waiting at its origin's station, tonnes (`cadenas.ts`). Mutated by the clock. */
  #patiosCadena = new Map<string, number>();
  /** Vehicles for export waiting at each carmaker's station, tonnes. */
  #patiosAutos = new Map<string, number>();
  /**
   * Chain inputs each plant that depends on them has in store, tonnes, and how it was supplied in
   * the last month (0 to 1), by site key (`cadenas.ts`, `PLANTAS_INSUMO`).
   */
  #reservasInsumo = new Map<string, number>();
  #surtidoInsumo = new Map<string, number>(PLANTAS_INSUMO.map((p) => [p.clave, 1]));
  /** Steel waiting at each mill's station for a train (what isn't bound for a carmaker), tonnes, and what the player's trains have taken. */
  #patiosAcero = new Map<string, number>();
  acero = $state.raw<Record<string, number>>({});
  /** Vehicles the player's trains have taken from each carmaker to an exit, tonnes. */
  autos = $state.raw<Record<string, number>>({});
  /** What the player's trains have delivered of each flow: tonnes and tonne-km, in all and by year. */
  cadena = $state.raw<Record<string, { t: number; tkm: number; porAño: Record<string, number> }>>({});
  /**
   * How fuel gets around now (`combustibles.ts`): each state's use, what its
   * pipelines bring, what it still lacks, what each refinery has left over.
   * Recomputed with the refineries, once a game day.
   */
  abasto = $state.raw<Abasto | null>(null);
  /** Fuel each refinery has waiting for a train or a tanker, barrels. Mutated by the clock. */
  #patios = new Map<string, number>();
  /**
   * Fuel in each state's terminals that came by train or tanker, barrels: it
   * covers what the pipelines don't, and when it runs out the state imports.
   */
  #inventarios = new Map<string, number>();
  /**
   * Fuel the player's tankers and trains left for what has to come to a state
   * coastwise, barrels: the country's, and imported. Kept for that: it covers
   * only what the state's ports can't import.
   */
  #inventariosCab = new Map<string, number>();
  #inventariosImp = new Map<string, number>();
  /**
   * Imported fuel waiting at each hub for the player's tankers and trains: the
   * half of the coastwise trade Pemex's rented tankers don't carry, barrels.
   */
  #patiosImp = new Map<string, number>();
  /**
   * What happened with fuel each year, the country's and each state's
   * (barrels), what had no way out of the refineries, the game hour the year
   * started being counted (the game opens on 1 December 2018), where its
   * imports came in (barrels by port, or `tierra`), and what of that each hub
   * imported for the coastwise trade.
   */
  #cuentas = new Map<
    string,
    {
      pais: Cuenta;
      estados: Map<string, Cuenta>;
      sinSalida: number;
      desde: number;
      porPuerta: Record<string, number>;
      cabotaje: Record<string, number>;
    }
  >();
  /**
   * A shortage's consequences (`combustibles.ts`, `DESABASTO`): the share of its fuel each state got
   * over the last week (its cargo goes with it), the share it lacked yesterday (its polos take no
   * companies while it lacks), its days in a row short, and what's being counted today.
   */
  #surtidoComb = new Map<string, number>();
  #faltaAyer = new Map<string, number>();
  #diasFalta = new Map<string, number>();
  #diaComb = new Map<string, { usa: number; falta: number; pipas: number; horas: number }>();
  /** What running the trucks has cost the State's till (millions of pesos), by state and by year. */
  #operacionPipas = new Map<string, number>();
  #operacionPipasAño = new Map<string, number>();
  #diaDesabasto = -1;
  /** The State's emergency tanker trucks, by state: how many, what they cost (millions of pesos) and each purchase. */
  pipas = $state.raw<Record<string, { n: number; mdp: number; compras: { horas: number; n: number; mdp: number }[] }>>({});
  /** Fuel oil each Mexican refinery makes now, Mbd (`combustoleo.ts`). Recomputed with the refineries. */
  combustoleo = $state.raw<Map<string, number>>(new Map());
  /** Fuel oil waiting in each refinery's yard, barrels. Mutated by the clock. */
  #patiosCo = new Map<string, number>();
  /** Fuel oil the player's trains and tankers left at each plant, barrels, and how each plant was supplied in the last month (0–1). */
  #reservasCo = new Map<string, number>();
  #surtidoCo = new Map<string, number>(CENTRALES_CO.map((c) => [c.id, 1]));
  /** What happened with fuel oil each year (barrels), and the game hour the year started being counted. */
  #cuentasCo = new Map<string, CuentaCo & { desde: number }>();
  /**
   * Sea trade (`comercioMar.ts`). What the player's ships have exported
   * (delivered at a gateway, by the port it was loaded at) and imported
   * (delivered at a port), replaced on every call.
   */
  comercio = $state.raw<{ exportado: Registro; importado: Registro }>({ exportado: registroVacio(), importado: registroVacio() });
  /** The imports the player's trains have taken inland from the ports: tonnes and tonne-km, by year and by port. */
  importacionTren = $state.raw<Registro & { tkm: number; tkmPorAño: Record<string, number> }>({ ...registroVacio(), tkm: 0, tkmPorAño: {} });
  /** Each port's exports waiting for a ship, by kind, tonnes. Mutated by the clock. */
  #patiosPuerto = new Map<string, Record<TipoCarga, number>>();
  /** Each port's imports asked for and not yet brought, by kind, tonnes. */
  #pedidos = new Map<string, Record<TipoCarga, number>>();
  /** Each port's imports waiting for a train, tonnes. */
  #patiosImportacion = new Map<string, number>();
  /** Each polo's freight from its companies waiting at its station for a train, tonnes. Mutated by the clock. */
  #patiosPolo = new Map<string, { exportacion: number; nacional: number }>();
  /** What the player's trains have taken from each polo's station: tonnes for export and for the country. */
  cargaPolos = $state.raw<Record<string, { exportacion: number; nacional: number }>>({});
  /** Lots are filled in the order they're promoted. */
  #ordenLotes = 0;
  /** Supplies stored at each offshore complex, tonnes (`plataformas.ts`). Mutated by the clock. */
  #reservas = new Map<string, number>(COMPLEJOS.map((c) => [c.id, abastoDiario(c.id, 2018) * DIAS_RESERVA * 0.5]));
  /** How well each complex has been supplied over the last month (0–1). Mutated by the clock. */
  #surtido = new Map<string, number>(COMPLEJOS.map((c) => [c.id, 1]));
  /**
   * Crude now: what each offshore complex produces (its real crude, less what
   * it loses for want of supplies), and Pemex's whole production with the
   * rest of its fields. Recomputed once a game day.
   */
  crudo = $state.raw<{ produccion: number; porComplejo: Map<string, { real: number; juego: number; surtido: number }> }>({
    produccion: 0,
    porComplejo: new Map(),
  });
  modo = $state<Modo>('juego');
  /** In Realidad, each rail work as it really stood on the date shown (`horas`). Empty in the game. */
  real = $state.raw<Map<string, EstadoReal>>(new Map());
  /** The game, set aside while Realidad is on. */
  #juego: {
    horas: number;
    obras: Map<string, ObraPolo>;
    obrasVia: Map<string, ObraViaEstado>;
    obrasEnergia: Map<string, ObraViaEstado>;
    obrasPemex: Map<string, ObraViaEstado>;
    deerParkPropia: boolean;
    trenes: Tren[];
    barcos: Barco[];
  } | null = null;
  /**
   * The player's trains a day on each rail line (by `Via.base`). Recounted
   * whenever the fleet or the network changes; the board repaints line use
   * from it.
   */
  trenesPorVia = $state.raw<Map<number, number>>(new Map());

  /** The rail network with stations, and the sea lanes. Static once loaded, so not reactive. */
  red: Red | null = null;
  #redJson: RedJson | null = null;
  mar: Mar | null = null;

  #carga: Promise<void> | null = null;
  #siguienteTren = 1;
  #siguienteBarco = 1;
  #frame = 0;
  #ultimo = 0;
  #espectadores = 0;

  get multiplicador(): number {
    return VELOCIDADES[this.velocidad];
  }

  get corriendo(): boolean {
    // Realidad shows a date; its clock doesn't run.
    return this.estado === 'lista' && this.modo === 'juego' && this.multiplicador > 0;
  }

  /** "3 mar 2019": the game opens on 1 December 2018 (`calendario.ts`). */
  get fecha(): string {
    return fechaCorta(this.horas);
  }

  get reloj(): string {
    return horaDelDia(this.horas);
  }

  get unidades(): Unidad[] {
    return [...this.trenes, ...this.barcos];
  }

  get seleccionado(): Unidad | null {
    const id = this.seleccion;
    if (!id) return null;
    return this.trenes.find((t) => t.id === id) ?? this.barcos.find((b) => b.id === id) ?? null;
  }

  /** Load the rail network and the sea lanes, and lay on the opening fleet. Idempotent. */
  cargar(): Promise<void> {
    this.#carga ??= (async () => {
      this.estado = 'cargando';
      try {
        const [redRes, marRes] = await Promise.all([fetch('/data/red-ferroviaria.json'), fetch('/data/rutas-maritimas.json')]);
        if (!redRes.ok) throw new Error(`red ferroviaria: HTTP ${redRes.status}`);
        if (!marRes.ok) throw new Error(`rutas marítimas: HTTP ${marRes.status}`);
        this.#redJson = (await redRes.json()) as RedJson;
        this.red = construirRed(this.#redJson, SITIOS);
        this.medidas = medirObras(this.red);
        this.mar = construirMar((await marRes.json()) as RutasMarJson);

        const trenes: Tren[] = [];
        SERVICIOS.forEach((paradas, i) => {
          // Spread the trains over their timetables (golden-ratio steps through
          // a day and a half), so the board opens with trains everywhere instead
          // of all of them loading at their first stop.
          const desfase = ((i * 0.618) % 1) * 36 + ESPERA_TERMINAL_H * 0.5;
          const t = this.#crearTren(paradas, desfase);
          if (t) trenes.push(t);
        });
        const barcos: Barco[] = [];
        for (const s of SERVICIOS_BARCO) {
          const b = this.#crearBarco(s.clase, s.paradas, { zarpando: true, desfase: s.desfase });
          if (b) barcos.push(b);
        }
        this.trenes = trenes;
        this.barcos = barcos;
        for (const e of ESTADOS_EXPORTADORES) this.#bodegas.set(e, flujoDelEstado(e, añoDe(this.horas)) * 24 * 7);
        for (const e of ESTADOS_PRODUCTIVOS) this.#bodegasNacional.set(e, flujoNacional(e, añoDe(this.horas)) * 24 * 7);
        for (const p of PLANTAS_INSUMO) {
          const h = this.horas;
          this.#reservasInsumo.set(p.clave, (insumosAño(p.clave, h, añoDe(h)) / 365.25) * RESERVA_DIAS * 0.5);
          if (p.sale === 'acero') this.#patiosAcero.set(p.id, ((salidaPlanta(p, h, 1) * (1 - PARTE_ARMADORAS)) / 365.25) * 7);
        }
        for (const p of ARMADORAS) this.#patiosAutos.set(p.id, (autosAño(p, this.horas, añoDe(this.horas)) / 365.25) * 7);
        for (const f of FLUJOS) this.#patiosCadena.set(f.id, ((toneladasAño(f, this.horas, añoDe(this.horas)) * (1 - parteAutomatica(f))) / 365.25) * 7);
        // The ports open with a week of their trade waiting.
        const h = 24 * DIAS_INICIO;
        for (const clave of PUERTOS_COMERCIO) {
          const p = comercioDe(clave)!;
          this.#patiosPuerto.set(clave, porTipo((t) => Math.min(flujoExportacion(p, t) * h, topeExportacion(p, t))));
          this.#pedidos.set(clave, porTipo((t) => flujoImportacion(p, t) * h));
          this.#patiosImportacion.set(clave, flujoImportacionTren(p) * h);
        }
        this.#saturar();
        this.#cobrar();
        this.#actualizarEnergia(true);
        // The refineries open with a week of what their zones can't take in the yard, and a
        // tanker that has just left a refinery's port sails loaded.
        for (const [id, mbd] of this.abasto?.sobrante ?? []) this.#patios.set(id, barrilesEn(mbd, 24 * 7));
        // A week of imported fuel at the hubs, and the terminals it reaches coastwise stocked as if the
        // trade were running (a tanker takes up to two weeks to come round).
        for (const [hub, mbd] of this.abasto?.porConcentrador ?? []) this.#patiosImp.set(hub, barrilesEn(mbd * (1 - PARTE_RENTADOS), 24 * 7));
        const cuenta = this.#cuentaDe(String(añoDe(this.horas)));
        for (const [e, mbd] of this.abasto?.cabotaje ?? []) {
          // Imported fuel already in the terminals counts as imported, through its hub.
          const b = barrilesEn(mbd * (1 - PARTE_RENTADOS), 24 * DIAS_POR_SURTIR);
          const hub = this.#concentradorDelEstado(e);
          this.#inventariosImp.set(e, b);
          this.#cuentaEstado(cuenta, e).importado += b;
          cuenta.pais.importado += b;
          if (hub) {
            cuenta.porPuerta[hub] = (cuenta.porPuerta[hub] ?? 0) + b;
            cuenta.cabotaje[hub] = (cuenta.cabotaje[hub] ?? 0) + b;
          }
        }
        // The refineries' fuel-oil yards full (what doesn't fit is being exported), and the plants with
        // all they keep of the half the player brings.
        for (const id of this.combustoleo.keys()) this.#patiosCo.set(id, this.#topePatioCo(id));
        for (const c of CENTRALES_CO) this.#reservasCo.set(c.id, this.#topeReservaCo(c));
        // Its first stop is where its run ends (`destinos`' last).
        for (const b of barcos) if (b.clase === 'tanque') this.#cargarLiquidos(b, b.paradas[0], b.destinos.length - 1);
        // Half the complexes' storage full, and a supply vessel that has just left its base sails loaded.
        for (const b of barcos) if (b.clase === 'abastecedor' && BASES_ABASTO.has(b.paradas[0])) b.abasto = TONELADAS_ABASTECEDOR;
        // A cargo ship sails with what it loaded at its first stop.
        for (const b of barcos) this.#comerciar(b, b.paradas[0], false);
        this.estado = 'lista';
      } catch (err) {
        console.error(err);
        this.estado = 'error';
        this.#carga = null;
      }
    })();
    return this.#carga;
  }

  #crearTren(paradas: string[], desfase = 0): Tren | null {
    if (!this.red) return null;
    const n = this.#siguienteTren;
    const t = crearTren(
      this.red,
      {
        id: `T-${String(n).padStart(2, '0')}`,
        color: COLORES_TREN[(n - 1) % COLORES_TREN.length],
        paradas,
        desfase,
      },
      this.costoRuta
    );
    if (t) this.#siguienteTren++;
    return t;
  }

  #crearBarco(clase: ClaseBarco, paradas: string[], opciones: { zarpando?: boolean; desfase?: number } = {}): Barco | null {
    if (!this.mar) return null;
    const n = this.#siguienteBarco;
    const b = crearBarco(this.mar, {
      id: `B-${String(n).padStart(2, '0')}`,
      nombre: NOMBRES_BARCO[(n - 1) % NOMBRES_BARCO.length],
      color: COLORES_BARCO[(n - 1) % COLORES_BARCO.length],
      clase,
      paradas,
      ...opciones,
    });
    if (b) this.#siguienteBarco++;
    return b;
  }

  /** Put a new train in service. Null when the stops can't be joined by rail. */
  agregarTren(paradas: string[]): Tren | null {
    const t = this.#crearTren(paradas);
    if (t) {
      this.trenes = [...this.trenes, t];
      this.#saturar();
    }
    return t;
  }

  /** Put a new ship in service, loading at its first port. */
  agregarBarco(clase: ClaseBarco, paradas: string[]): Barco | null {
    const b = this.#crearBarco(clase, paradas);
    if (b) this.barcos = [...this.barcos, b];
    return b;
  }

  retirar(id: string) {
    const antes = this.trenes.length;
    this.trenes = this.trenes.filter((t) => t.id !== id);
    if (this.trenes.length !== antes) this.#saturar();
    this.barcos = this.barcos.filter((b) => b.id !== id);
    if (this.seleccion === id) this.seleccionar(null);
  }

  seleccionar(id: string | null) {
    this.seleccion = id;
    if (!id) this.siguiendo = false;
  }

  // ---- Realidad ---------------------------------------------------------------------------------

  /**
   * Set the game aside and show the real board, as of today. The game's
   * fleet, works and clock wait untouched for `salirRealidad`; the money isn't
   * touched because nothing is paid or built here.
   */
  entrarRealidad() {
    if (this.modo === 'realidad' || this.estado !== 'lista') return;
    this.#juego = {
      horas: this.horas,
      obras: this.obras,
      obrasVia: this.obrasVia,
      obrasEnergia: this.obrasEnergia,
      obrasPemex: this.obrasPemex,
      deerParkPropia: this.deerParkPropia,
      trenes: this.trenes,
      barcos: this.barcos,
    };
    this.seleccionar(null);
    this.modo = 'realidad';
    // The game's trains and ships are made-up services: none of them here.
    this.trenes = [];
    this.barcos = [];
    this.obras = new Map(POLOS.map((p) => [p.id, obraDelPolo(p.id)]));
    this.irA(horasDeHoy(), true);
  }

  /** In Realidad, show the board as it stood at game hour `horas` (1 December 2018 to today). */
  irA(horas: number, forzar = false) {
    if (this.modo !== 'realidad') return;
    this.horas = Math.max(0, Math.min(horas, horasDeHoy()));
    const ids = [
      ...[...OBRAS_VIA, ...OBRAS_ENERGIA, ...OBRAS_GAS, ...OBRAS_PEMEX].map((o) => o.id),
      'deer-park-compra',
      ...POLOS.map((p) => clavePolo(p.id)),
    ];
    const real = new Map(ids.map((id) => [id, estadoReal(id, this.horas)]));
    const fase = (id: string) => {
      const e = real.get(id)!.etapa;
      return e === 'en-operacion' ? 'en-servicio' : e === 'en-obra' ? 'en-obra' : 'por-construir';
    };
    const enServicio = (m: Map<string, ObraViaEstado>) => [...m.values()].filter((o) => o.fase === 'en-servicio').map((o) => o.id).join();
    const antes = enServicio(this.obrasVia);
    this.obrasVia = new Map(OBRAS_VIA.map((o) => [o.id, { ...obraViaNueva(o.id), fase: fase(o.id), avance: real.get(o.id)!.avance ?? 0 }]));
    // The CFE's plants as they really stood: the map draws them and the regions count the ones in service.
    this.obrasEnergia = new Map(
      [...OBRAS_ENERGIA, ...OBRAS_GAS].map((o) => [o.id, { ...obraViaNueva(o.id), fase: fase(o.id), avance: real.get(o.id)!.avance ?? 0 }])
    );
    // Pemex's works too; the map and the bar read the refineries' real runs from `petroleo.ts`.
    this.obrasPemex = new Map(OBRAS_PEMEX.map((o) => [o.id, { ...obraViaNueva(o.id), fase: fase(o.id), avance: real.get(o.id)!.avance ?? 0 }]));
    this.deerParkPropia = this.horas >= HORAS_COMPRA_DEER_PARK;
    // The polos too: built or not. How full they are isn't published, so they stay at 0 % (no demand, no jobs counted).
    // One built by fronts shows them at the real progress; a rail spur to it hasn't been reported.
    this.obras = new Map(
      POLOS.map((p) => {
        const f = fase(clavePolo(p.id));
        const o: ObraPolo = { ...obraDelPolo(p.id), fase: f === 'en-servicio' ? 'operando' : f };
        if (o.frentes) {
          const avance = f === 'en-servicio' ? 1 : f === 'en-obra' ? (real.get(clavePolo(p.id))!.avance ?? 0) : 0;
          for (const [id, e] of Object.entries(o.frentes)) e.avance = id === ESPUELA || id === SUBESTACION ? 0 : avance;
          resumir(o, p);
        }
        return [p.id, o];
      })
    );
    this.real = real;
    // The track itself changes only when a work opens (or, going back, un-opens).
    if (forzar || enServicio(this.obrasVia) !== antes) this.#reconstruirRed();
    this.#actualizarEnergia(true);
  }

  /** Back to the game, exactly where it was left. */
  salirRealidad() {
    const j = this.#juego;
    if (this.modo !== 'realidad' || !j) return;
    this.modo = 'juego';
    this.real = new Map();
    this.horas = j.horas;
    this.obras = j.obras;
    this.obrasVia = j.obrasVia;
    this.obrasEnergia = j.obrasEnergia;
    this.obrasPemex = j.obrasPemex;
    this.deerParkPropia = j.deerParkPropia;
    this.trenes = j.trenes;
    this.barcos = j.barcos;
    this.#juego = null;
    this.#reconstruirRed();
    this.#actualizarEnergia(true);
  }

  alternarPausa() {
    // Back to 1× rather than to whatever was on before: after scrubbing at
    // 16× you want to land somewhere you can watch.
    this.velocidad = this.velocidad === 0 ? 2 : 0;
  }

  // ---- the Polos del Bienestar ------------------------------------------------------------

  /** Order a polo built with `cuadrillas` crews. Paid as it advances; false if it can't start. */
  construirPolo(id: string, cuadrillas: number): boolean {
    const obra = this.obras.get(id);
    const polo = POLOS.find((p) => p.id === id);
    // A polo with its close-up is built front by front, from inside it.
    if (!obra || !polo || obra.fase !== 'por-construir' || obra.frentes) return false;
    obra.plan = presupuestar(polo, cuadrillas);
    obra.fase = 'en-obra';
    this.obras = new Map(this.obras);
    return true;
  }

  /**
   * Inside a polo: put `n` crews (0–4) on one of its fronts. The first crew
   * starts the work; paid as it advances, like any other.
   */
  cuadrillasEnFrente(id: string, frente: string, n: number): boolean {
    const obra = this.obras.get(id);
    const polo = POLOS.find((p) => p.id === id);
    if (!obra?.frentes || !polo || this.modo !== 'juego') return false;
    fijarCuadrillas(obra, polo, frente, n, presupuestar(polo, 1).empleosLleno);
    this.obras = new Map(this.obras);
    return true;
  }

  /**
   * Inside a polo: promote company lot `n` (its index) for a sector, or take
   * it off (null). Only a lot whose company hasn't come yet.
   */
  promoverLote(id: string, n: number, sector: string | null): boolean {
    const obra = this.obras.get(id);
    if (!obra?.lotes || this.modo !== 'juego') return false;
    promoverLote(obra, n, sector, ++this.#ordenLotes);
    this.obras = new Map(this.obras);
    return true;
  }

  /** A polo's freight waiting at its station, tonnes. */
  enPatioPolo(id: string): { exportacion: number; nacional: number } {
    return this.#patiosPolo.get(id) ?? { exportacion: 0, nacional: 0 };
  }

  /** Whether a train can reach the polo: it has its station on the network. */
  conectado(id: string): boolean {
    return !!this.red?.estaciones.has(`polo:${id}`);
  }

  /** People working on polo sites and rail works right now. */
  get empleosEnObra(): number {
    let n = 0;
    for (const o of this.obras.values()) n += personasTrabajando(o);
    for (const o of this.obrasVia.values()) n += personasEnObraVia(o);
    for (const o of this.obrasEnergia.values()) n += personasEnObraVia(o);
    for (const o of this.obrasPemex.values()) n += personasEnObraVia(o);
    return n;
  }

  // ---- the State's rail works ---------------------------------------------------------------

  /** What building work `id` with `cuadrillas` crews takes. Null until the network is measured. */
  presupuestoVia(id: string, cuadrillas: number): PresupuestoVia | null {
    const o = obraVia(id);
    const m = this.medidas.get(id);
    return o && m ? presupuestarVia(o, m.km, cuadrillas) : null;
  }

  /** Order a rail work built. Paid as it advances; false if it can't start. */
  construirObraVia(id: string, cuadrillas: number): boolean {
    const estado = this.obrasVia.get(id);
    const plan = this.presupuestoVia(id, cuadrillas);
    if (!estado || !plan || estado.fase !== 'por-construir') return false;
    estado.plan = plan;
    estado.fase = 'en-obra';
    this.obrasVia = new Map(this.obrasVia);
    return true;
  }

  /** How the player's trains weigh each tramo when choosing their way: line use now, the State's track first. */
  get costoRuta() {
    return this.red ? costoConUso(this.red, this.trenesPorVia) : undefined;
  }

  /** Permanent jobs in the operating polos right now. */
  get empleosPermanentes(): number {
    let n = 0;
    for (const p of POLOS) {
      const o = this.obras.get(p.id);
      if (o) n += empleosPermanentes(o, p);
    }
    return n;
  }

  /** Pay in every month that has begun and isn't paid yet (several, after a long frame at 16×). */
  #cobrar() {
    const mes = mesDe(this.horas);
    if (this.#mesesCobrados > mes) return;
    let caja = this.dinero;
    let cajaCfe = this.dineroCfe;
    let cajaPemex = this.dineroPemex;
    let pemexMes = 0;
    let ultima: Mensualidad | null = null;
    while (this.#mesesCobrados <= mes) {
      pemexMes = cajaPemexDelMes(this.#mesesCobrados);
      ultima = mensualidad(this.#mesesCobrados++);
      caja += ultima.total;
      cajaCfe += CAJA_CFE_MES;
      cajaPemex += pemexMes;
    }
    this.dinero = caja;
    this.dineroCfe = cajaCfe;
    this.dineroPemex = cajaPemex;
    this.cajaPemexMes = pemexMes;
    this.ultimaMensualidad = ultima;
  }

  // ---- electricity ----------------------------------------------------------------------------

  /** What building CFE plant `id` with `cuadrillas` crews takes. */
  presupuestoPlanta(id: string, cuadrillas: number) {
    const o = obraEnergia(id);
    return o ? presupuestarPlanta(o, cuadrillas) : null;
  }

  /** Order a CFE plant built, paid from the CFE's till as it advances. */
  construirPlanta(id: string, cuadrillas: number): boolean {
    const estado = this.obrasEnergia.get(id);
    const plan = this.presupuestoPlanta(id, cuadrillas);
    if (!estado || !plan || estado.fase !== 'por-construir') return false;
    estado.plan = plan;
    estado.fase = 'en-obra';
    this.obrasEnergia = new Map(this.obrasEnergia);
    return true;
  }

  /** What building the CFE's gas work `id` takes. */
  presupuestoGasoducto(id: string, cuadrillas: number) {
    const o = obraGas(id);
    return o ? presupuestarGasoducto(o, cuadrillas) : null;
  }

  /** Order a CFE gas pipeline built, paid from the CFE's till as it advances. */
  construirGasoducto(id: string, cuadrillas: number): boolean {
    const estado = this.obrasEnergia.get(id);
    const plan = this.presupuestoGasoducto(id, cuadrillas);
    if (!estado || !plan || estado.fase !== 'por-construir' || this.modo !== 'juego') return false;
    estado.plan = plan;
    estado.fase = 'en-obra';
    this.obrasEnergia = new Map(this.obrasEnergia);
    return true;
  }

  /** The electricity region of a polo, now. */
  energiaDelPolo(id: string): EstadoRegion | null {
    const r = regionDelPolo(id);
    return this.energia.find((e) => e.region.id === r) ?? null;
  }

  /** Whether the polo's state has its fuel: companies don't move in while it lacks. */
  poloConCombustible(id: string): boolean {
    const e = POLOS.find((p) => p.id === id)?.estado;
    return !e || this.hayCombustible(e);
  }

  /** Whether companies can still move into the polo: its region has margin at both peaks. */
  hayEnergia(id: string): boolean {
    return this.energiaDelPolo(id)?.alcanza ?? true;
  }

  /** Recompute the regions and the refineries once a game day (or now, with `forzar`). */
  #actualizarEnergia(forzar = false) {
    const dia = Math.floor(this.horas / 24);
    if (!forzar && dia === this.#diaEnergia) return;
    this.#diaEnergia = dia;
    const hechas = OBRAS_ENERGIA.filter((o) => this.obrasEnergia.get(o.id)?.fase === 'en-servicio');
    const polos = new Map<string, number>();
    for (const o of this.obras.values()) {
      if (o.fase !== 'operando' || o.ocupacion <= 0) continue;
      // A polo with its lots: what its companies use, by their sector.
      const polo = o.lotes ? POLOS.find((p) => p.id === o.id) : null;
      polos.set(o.id, polo ? mwEnUso(o, polo) : mwDelPolo(o.id) * o.ocupacion);
    }
    const gas = gasDisponible((id) => this.obrasEnergia.get(id)?.fase === 'en-servicio');
    // A power plant short of its chain's fuel gives fewer MW to its region (Nava, without coal; the fuel-oil plants).
    const sinInsumo = new Map<string, number>();
    for (const p of PLANTAS_INSUMO) {
      if (p.sale !== 'electricidad' || !p.region || salidaPlanta(p, this.horas, 1) <= 0) continue;
      const faltan = p.plena - salidaPlanta(p, this.horas, this.surtido(p.clave));
      sinInsumo.set(p.region, (sinInsumo.get(p.region) ?? 0) + faltan);
    }
    for (const c of CENTRALES_CO) sinInsumo.set(c.region, (sinInsumo.get(c.region) ?? 0) + mwSinCombustoleo(c, this.surtidoCo(c.id)));
    this.energia = estadoEnergia(this.horas, hechas, polos, gas, sinInsumo);
    const pemex = {
      avance: (id: string) => {
        const o = this.obrasPemex.get(id);
        return !o ? 0 : o.fase === 'en-servicio' ? 1 : o.avance;
      },
      deerParkPropia: this.deerParkPropia,
    };
    this.refinacion = refinacionJuego(pemex);
    this.abasto = abastoJuego(this.refinacion);
    this.combustoleo = combustoleoJuego(this.refinacion, pemex);
    // Offshore crude: in Realidad, the real one; in the game, each complex's as it's been supplied.
    const año = añoDe(this.horas);
    const porComplejo = new Map(
      COMPLEJOS.map((c) => {
        const surtido = this.modo === 'realidad' ? 1 : (this.#surtido.get(c.id) ?? 1);
        return [c.id, { real: produccionComplejo(c.id, año), juego: produccionJuego(c.id, this.horas, surtido), surtido }] as const;
      })
    );
    this.crudo = { produccion: produccionFuera(año) + [...porComplejo.values()].reduce((s, c) => s + c.juego, 0), porComplejo };
  }

  /** Crude exported now: what Pemex produces and the Mexican refineries don't run, Mbd. */
  get crudoExportado(): number {
    return Math.max(0, this.crudo.produccion - (this.refinacion?.proceso ?? 0));
  }

  /** Supplies stored at a complex, in days of what it takes. */
  diasDeReserva(id: string): number {
    const diario = abastoDiario(id, añoDe(this.horas));
    return diario > 0 ? (this.#reservas.get(id) ?? 0) / diario : 0;
  }

  // ---- oil ----------------------------------------------------------------------------------------

  /** What Pemex work `id` takes with `cuadrillas` crews. */
  presupuestoObraPemex(id: string, cuadrillas: number) {
    const o = obraPemex(id);
    return o ? presupuestarObraPemex(o, cuadrillas) : null;
  }

  /** Order a Pemex work, paid from Pemex's till as it advances. Deer Park's needs Deer Park bought first. */
  construirObraPemex(id: string, cuadrillas: number): boolean {
    const estado = this.obrasPemex.get(id);
    const plan = this.presupuestoObraPemex(id, cuadrillas);
    if (!estado || !plan || estado.fase !== 'por-construir' || this.modo !== 'juego') return false;
    if (obraPemex(id)?.refineria === 'deer-park' && !this.deerParkPropia) return false;
    estado.plan = plan;
    estado.fase = 'en-obra';
    this.obrasPemex = new Map(this.obrasPemex);
    return true;
  }

  /** Buy Shell's half of Deer Park, paid at once from Pemex's till. False if there isn't the money. */
  comprarDeerPark(): boolean {
    if (this.deerParkPropia || this.modo !== 'juego' || this.dineroPemex < COMPRA_DEER_PARK.costoMdp) return false;
    this.dineroPemex -= COMPRA_DEER_PARK.costoMdp;
    this.deerParkPropia = true;
    this.#actualizarEnergia(true);
    return true;
  }

  #avanzarObras(horas: number) {
    const caja = { mdp: this.dinero };
    // The CFE's till: its plants and, inside the polos, their substations.
    const cajaCfe = { mdp: this.dineroCfe };
    let terminadas = false;
    for (const o of this.obras.values()) {
      // A polo built by fronts: each front with crews advances (urbanized, or its spur done, changes the network).
      if (o.frentes && avanzarInterior(o, horas, caja, cajaCfe)) terminadas = true;
      if (o.fase === 'por-construir') continue;
      // Companies come only with a train, with electricity in the region and with fuel in the state.
      if (avanzarObra(o, horas, caja, this.conectado(o.id) && this.hayEnergia(o.id) && this.poloConCombustible(o.id))) terminadas = true;
      // Companies take the promoted lots.
      if (o.lotes) {
        const polo = POLOS.find((p) => p.id === o.id);
        if (polo) ocuparLotes(o, polo);
      }
    }
    let viasTerminadas = false;
    for (const o of this.obrasVia.values()) {
      if (o.fase !== 'en-obra') continue;
      if (avanzarObraVia(o, horas, caja, this.horas + horas)) viasTerminadas = true;
    }
    if (viasTerminadas) {
      this.obrasVia = new Map(this.obrasVia);
      terminadas = true;
    }
    if (caja.mdp !== this.dinero) this.dinero = caja.mdp;

    // CFE plants, from the CFE's own till.
    let plantasTerminadas = false;
    for (const o of this.obrasEnergia.values()) {
      if (o.fase !== 'en-obra') continue;
      if (avanzarObraVia(o, horas, cajaCfe, this.horas + horas)) plantasTerminadas = true;
    }
    if (cajaCfe.mdp !== this.dineroCfe) this.dineroCfe = cajaCfe.mdp;
    if (plantasTerminadas) {
      this.obrasEnergia = new Map(this.obrasEnergia);
      this.#actualizarEnergia(true);
    }

    // Pemex's works, from Pemex's own till.
    const cajaPemex = { mdp: this.dineroPemex };
    let pemexTerminadas = false;
    for (const o of this.obrasPemex.values()) {
      if (o.fase !== 'en-obra') continue;
      if (avanzarObraVia(o, horas, cajaPemex, this.horas + horas)) pemexTerminadas = true;
    }
    if (cajaPemex.mdp !== this.dineroPemex) this.dineroPemex = cajaPemex.mdp;
    if (pemexTerminadas) {
      this.obrasPemex = new Map(this.obrasPemex);
      this.#actualizarEnergia(true);
    }

    if (terminadas) this.#reconstruirRed();
    this.#actualizarEnergia();
  }

  /**
   * A finished polo within reach of the track gets its spur and station; a
   * finished rail work changes the track. Rebuild the network with all of it,
   * and let every train find its way again on it.
   */
  #reconstruirRed() {
    if (!this.#redJson) return;
    // In Realidad a polo gets no spur: whether a real one has rail isn't in the data.
    const enServicio = new Set(
      this.modo === 'realidad'
        ? []
        : [...this.obras.values()].filter((o) => o.fase === 'operando' && (!o.frentes || conEspuela(o))).map((o) => `polo:${o.id}`)
    );
    const hechas = OBRAS_VIA.filter((o) => this.obrasVia.get(o.id)?.fase === 'en-servicio');
    this.red = construirRed(this.#redJson, SITIOS, enServicio, hechas);
    this.#rerutear();
    this.#saturar();
    this.versionRed++;
  }

  /**
   * Every train re-plans its route on the new network, keeping its place in
   * the timetable: same leg, same share of it run, same wait.
   */
  #rerutear() {
    if (!this.red) return;
    const costo = this.costoRuta;
    this.trenes = this.trenes.map((viejo) => {
      const nuevo = crearTren(this.red!, { id: viejo.id, color: viejo.color, paradas: viejo.paradas }, costo);
      if (!nuevo || nuevo.piernas.length !== viejo.piernas.length) return viejo;
      const antes = viejo.piernas[viejo.pierna];
      const ahora = nuevo.piernas[viejo.pierna];
      nuevo.pierna = viejo.pierna;
      nuevo.estado = viejo.estado;
      nuevo.espera = viejo.espera;
      nuevo.km = antes.km > 0 ? (viejo.km / antes.km) * ahora.km : 0;
      nuevo.odometro = viejo.odometro;
      nuevo.llegadas = [];
      nuevo.carga = viejo.carga;
      nuevo.cargaDe = viejo.cargaDe;
      nuevo.exportado = viejo.exportado;
      nuevo.cargaNacional = viejo.cargaNacional;
      nuevo.movidoNacional = viejo.movidoNacional;
      nuevo.cadena = viejo.cadena;
      nuevo.entregadoCadena = viejo.entregadoCadena;
      nuevo.combustible = viejo.combustible;
      nuevo.combustibleDe = viejo.combustibleDe;
      nuevo.entregadoCombustible = viejo.entregadoCombustible;
      nuevo.combustibleImp = viejo.combustibleImp;
      nuevo.combustibleImpDe = viejo.combustibleImpDe;
      nuevo.entregadoImp = viejo.entregadoImp;
      nuevo.combustoleo = viejo.combustoleo;
      nuevo.combustoleoDe = viejo.combustoleoDe;
      nuevo.entregadoCombustoleo = viejo.entregadoCombustoleo;
      nuevo.importacion = viejo.importacion;
      nuevo.importacionDe = viejo.importacionDe;
      nuevo.importado = viejo.importado;
      return nuevo;
    });
  }

  // ---- exports ---------------------------------------------------------------------------------

  /** Each state's export cargo piles up at its stations, up to a month of it. */
  #producir(horas: number) {
    const año = añoDe(this.horas);
    const autosEstado = new Map<string, number>();
    for (const p of ARMADORAS) {
      const h = autosAño(p, this.horas, año) / (365.25 * 24);
      autosEstado.set(p.estado, (autosEstado.get(p.estado) ?? 0) + h);
      this.#patiosAutos.set(p.id, Math.min((this.#patiosAutos.get(p.id) ?? 0) + h * horas, h * 24 * DIAS_PATIO_CADENA));
    }
    for (const e of ESTADOS_EXPORTADORES) {
      // The cars leave from their plants: they come out of the state's generic export cargo.
      // A state short of fuel makes that much less cargo (`DESABASTO`).
      const f = Math.max(0, flujoDelEstado(e, año) - (autosEstado.get(e) ?? 0)) * this.surtidoCombustible(e);
      this.#bodegas.set(e, Math.min((this.#bodegas.get(e) ?? 0) + f * horas, f * 24 * DIAS_EN_ESPERA));
    }
    const surtidoDe = (clave: string) => this.surtido(clave);
    for (const f of FLUJOS) {
      const ta = toneladasAño(f, this.horas, año, surtidoDe);
      // What gets there without the player (a belt, the private railroads' share) goes straight to its destination: a plant stores it.
      const auto = parteAutomatica(f);
      if (auto > 0 && PLANTA_INSUMO.has(f.destino)) this.#guardarInsumo(f.destino, ((ta * auto) / (365.25 * 24)) * horas, año);
      const h = (ta * (1 - auto)) / (365.25 * 24);
      this.#patiosCadena.set(f.id, Math.min((this.#patiosCadena.get(f.id) ?? 0) + h * horas, h * 24 * DIAS_PATIO_CADENA));
    }
    // The plants that depend on their chain use up their inputs; how they were supplied sets what they make.
    const aceroEstado = new Map<string, number>();
    for (const p of PLANTAS_INSUMO) {
      const pide = (insumosAño(p.clave, this.horas, año) / (365.25 * 24)) * horas;
      const hay = this.#reservasInsumo.get(p.clave) ?? 0;
      const cubierto = pide > 0 ? Math.min(1, hay / pide) : 1;
      this.#reservasInsumo.set(p.clave, Math.max(0, hay - pide));
      const s = this.#surtidoInsumo.get(p.clave) ?? 1;
      const peso = Math.min(1, horas / (24 * MEMORIA_DIAS));
      const surtido = this.modo === 'realidad' ? 1 : s + (cubierto - s) * peso;
      this.#surtidoInsumo.set(p.clave, surtido);
      if (p.sale !== 'acero') continue;
      // A mill's steel: the carmakers' share leaves as their flows; the rest waits as domestic cargo.
      const h = (salidaPlanta(p, this.horas, surtido) * (1 - PARTE_ARMADORAS)) / (365.25 * 24);
      const estado = SITIOS_POR_CLAVE.get(p.clave)?.estado ?? '';
      aceroEstado.set(estado, (aceroEstado.get(estado) ?? 0) + salidaPlanta(p, this.horas, 1) / (365.25 * 24));
      this.#patiosAcero.set(p.id, Math.min((this.#patiosAcero.get(p.id) ?? 0) + h * horas, h * 24 * DIAS_PATIO_CADENA));
    }
    for (const e of ESTADOS_PRODUCTIVOS) {
      // The chains' domestic flows and the mills' steel come out of the state's generic cargo: the yearbook's total stays.
      const enCadena = (FLUJOS_DEL_ESTADO.get(e) ?? []).reduce((s, x) => s + toneladasAño(x, this.horas, año), 0) / (365.25 * 24) + (aceroEstado.get(e) ?? 0);
      const f = Math.max(0, flujoNacional(e, año) - enCadena) * this.surtidoCombustible(e);
      this.#bodegasNacional.set(e, Math.min((this.#bodegasNacional.get(e) ?? 0) + f * horas, f * 24 * DIAS_EN_ESPERA));
    }
    // The ports: exports come by road to the yard, imports are asked for, and what leaves by rail waits for a train.
    for (const clave of PUERTOS_COMERCIO) {
      const p = comercioDe(clave)!;
      const patio = this.#patiosPuerto.get(clave);
      const pedido = this.#pedidos.get(clave);
      if (!patio || !pedido) continue;
      for (const t of TIPOS_CARGA) {
        patio[t] = Math.min(patio[t] + flujoExportacion(p, t) * horas, topeExportacion(p, t));
        const f = flujoImportacion(p, t);
        pedido[t] = Math.min(pedido[t] + f * horas, f * 24 * DIAS_PATIO);
      }
      const ft = flujoImportacionTren(p);
      this.#patiosImportacion.set(clave, Math.min((this.#patiosImportacion.get(clave) ?? 0) + ft * horas, ft * 24 * DIAS_PATIO));
    }
    // The polos' companies: their freight waits at the polo's station, up to a month of it.
    for (const o of this.obras.values()) {
      if (!o.lotes || o.ocupacion <= 0) continue;
      const polo = POLOS.find((p) => p.id === o.id);
      if (!polo) continue;
      const año = cargaDelPolo(o, polo);
      const h = 365.25 * 24;
      const patio = this.#patiosPolo.get(o.id) ?? { exportacion: 0, nacional: 0 };
      patio.exportacion = Math.min(patio.exportacion + (año.exportacion / h) * horas, (año.exportacion / 365.25) * DIAS_PATIO_POLO);
      patio.nacional = Math.min(patio.nacional + (año.nacional / h) * horas, (año.nacional / 365.25) * DIAS_PATIO_POLO);
      this.#patiosPolo.set(o.id, patio);
    }
  }

  /** At a polo's station, a train takes the polo's own freight first (`cual`: export or domestic). */
  #cargarDelPolo(t: Tren, destino: string, cual: 'exportacion' | 'nacional'): number {
    if (!destino.startsWith('polo:')) return 0;
    const id = destino.slice('polo:'.length);
    const patio = this.#patiosPolo.get(id);
    if (!patio || patio[cual] < 1) return 0;
    const sube = Math.min(this.#espacioTren(t), patio[cual]);
    if (sube <= 0) return 0;
    patio[cual] -= sube;
    const c = this.cargaPolos[id] ?? { exportacion: 0, nacional: 0 };
    this.cargaPolos = { ...this.cargaPolos, [id]: { ...c, [cual]: c[cual] + sube } };
    return sube;
  }

  /** Export cargo waiting in a state, tonnes. */
  enEspera(estado: string): number {
    return this.#bodegas.get(estado) ?? 0;
  }

  /**
   * A train got to a stop. It delivers the domestic cargo and the imports it
   * brought from the last one (counted in tonnes and tonne-km). At an exit it
   * unloads its export cargo (that's an export; at a port it waits there for a
   * ship); anywhere else it loads the exports its state has waiting. Then
   * fuel: it leaves what it carries where the state lacks it and, at a
   * refinery, loads what is waiting in the yard. At a port it loads the
   * imports waiting for a train. Domestic cargo fills the room left, for its
   * next stop.
   */
  #atenderLlegadas(t: Tren) {
    const llegadas = t.llegadas!;
    while (llegadas.length) {
      const pierna = llegadas.shift()!;
      const destino = t.destinos[pierna];
      this.#entregarNacional(t, t.piernas[pierna].km);
      this.#entregarImportacion(t, t.piernas[pierna].km);
      this.#moverCadena(t, destino, t.piernas[pierna].km);
      this.#exportar(t, destino);
      this.#descargarCombustible(t, destino, pierna);
      this.#descargarCombustoleo(t, destino);
      this.#cargarLiquidos(t, destino, pierna);
      this.#cargarImportacion(t, destino);
      this.#cargarNacional(t, destino);
    }
  }

  /** Tonnes a train still has room for: exports, imports, fuel and domestic cargo share its net load. */
  #espacioTren(t: Tren): number {
    const cadena = Object.values(t.cadena).reduce((s, x) => s + x, 0);
    return Math.max(0, CARGA_POR_TREN - t.carga - t.importacion - t.cargaNacional - cadena - (t.combustible + t.combustibleImp) * T_POR_BARRIL - t.combustoleo * T_POR_BARRIL_CO);
  }

  /**
   * Supply chains at a stop: the flows aboard ran the leg (tonne-km), those bound here are
   * delivered, and the flows that start here board if the train will stop at their destination.
   */
  #moverCadena(t: Tren, destino: string, km: number) {
    const año = String(añoDe(this.horas));
    let cuenta = this.cadena;
    for (const [id, ton] of Object.entries(t.cadena)) {
      if (ton <= 0) continue;
      const c = cuenta[id] ?? { t: 0, tkm: 0, porAño: {} };
      const llega = FLUJO.get(id)?.destino === destino;
      cuenta = {
        ...cuenta,
        [id]: { t: c.t + (llega ? ton : 0), tkm: c.tkm + ton * km, porAño: llega ? { ...c.porAño, [año]: (c.porAño[año] ?? 0) + ton } : c.porAño },
      };
      if (llega) {
        if (PLANTA_INSUMO.has(destino)) this.#guardarInsumo(destino, ton, añoDe(this.horas));
        t.entregadoCadena += ton;
        delete t.cadena[id];
      }
    }
    this.cadena = cuenta;
    for (const f of FLUJOS) {
      if (f.origen !== destino || !t.destinos.includes(f.destino) || f.destino === destino) continue;
      const hay = this.#patiosCadena.get(f.id) ?? 0;
      const sube = Math.min(this.#espacioTren(t), hay);
      if (sube < 1) continue;
      this.#patiosCadena.set(f.id, hay - sube);
      t.cadena[f.id] = (t.cadena[f.id] ?? 0) + sube;
    }
  }

  /** A plant stores the inputs that reach it, up to `RESERVA_DIAS` of them. */
  #guardarInsumo(clave: string, ton: number, año: number) {
    const tope = (insumosAño(clave, this.horas, año) / 365.25) * RESERVA_DIAS;
    this.#reservasInsumo.set(clave, Math.min(tope, (this.#reservasInsumo.get(clave) ?? 0) + ton));
  }

  /** How a plant that depends on its chain was supplied in the last month (0 to 1), and its inputs in store (tonnes), by site key. */
  surtido(clave: string): number {
    return this.modo === 'realidad' ? 1 : (this.#surtidoInsumo.get(clave) ?? 1);
  }
  reservaInsumo(clave: string): number {
    return this.#reservasInsumo.get(clave) ?? 0;
  }
  /** Steel waiting at a mill's station (the part not bound for a carmaker), tonnes. */
  enPatioAcero(id: string): number {
    return this.#patiosAcero.get(id) ?? 0;
  }

  /** Vehicles waiting at a carmaker's station, tonnes. */
  enPatioAutos(id: string): number {
    return this.#patiosAutos.get(id) ?? 0;
  }

  /** A flow's cargo waiting at its origin, tonnes. */
  enPatioCadena(id: string): number {
    return this.#patiosCadena.get(id) ?? 0;
  }

  #entregarImportacion(t: Tren, km: number) {
    if (t.importacion <= 0) return;
    const r = this.importacionTren;
    const año = String(añoDe(this.horas));
    const ton = t.importacion;
    this.importacionTren = {
      ...sumar(r, ton, año, t.importacionDe ? { [t.importacionDe]: ton } : {}, 'tren'),
      tkm: r.tkm + ton * km,
      tkmPorAño: { ...r.tkmPorAño, [año]: (r.tkmPorAño[año] ?? 0) + ton * km },
    };
    t.importado += ton;
    t.importacion = 0;
    t.importacionDe = null;
  }

  /** At a port, load the imports waiting for a train, for the next stop. */
  #cargarImportacion(t: Tren, destino: string) {
    const hay = this.#patiosImportacion.get(destino) ?? 0;
    const sube = Math.min(this.#espacioTren(t), hay);
    if (sube < 1) return;
    this.#patiosImportacion.set(destino, hay - sube);
    t.importacion += sube;
    t.importacionDe = destino;
  }

  /**
   * A tanker got to a port: it leaves its fuel where the state lacks it and
   * its fuel oil at the power plants that get it there, then loads at a
   * refinery's port. A supply vessel loads at a supply base and
   * unloads at the offshore complexes.
   */
  #atenderEscalas(b: Barco) {
    const llegadas = b.llegadas!;
    while (llegadas.length) {
      const pierna = llegadas.shift()!;
      const destino = b.destinos[pierna];
      if (b.clase === 'abastecedor') {
        this.#abastecerEscala(b, destino);
        continue;
      }
      if (b.clase === 'tanque') {
        this.#descargarCombustible(b, destino, pierna);
        this.#descargarCombustoleo(b, destino);
        this.#cargarLiquidos(b, destino, pierna);
        continue;
      }
      this.#comerciar(b, destino);
    }
  }

  // ---- sea trade ---------------------------------------------------------------------------------

  /**
   * A container ship, bulk carrier or car carrier at a stop. At a gateway it
   * delivers the exports aboard (that's an export by sea) and loads imports
   * for the ports of its loop. At a port it unloads the imports asked for
   * there, then loads exports of its kind — only if its loop leads to a
   * gateway: between Mexican ports it would be cabotage, which isn't counted
   * yet. `contar` false only loads (the opening fleet).
   */
  #comerciar(b: Barco, destino: string, contar = true) {
    const tipo = cargaDeClase(b.clase);
    if (!tipo) return;
    const cabe = toneladasDeClase(b.clase);
    const año = String(añoDe(this.horas));
    if (puerta(destino)) {
      if (b.exportacion > 0 && contar) {
        this.comercio = { ...this.comercio, exportado: sumar(this.comercio.exportado, b.exportacion, año, b.exportacionDe, tipo) };
        b.exportado += b.exportacion;
      }
      b.exportacion = 0;
      b.exportacionDe = {};
      if (b.paradas.some((p) => (comercioDe(p)?.imp[tipo] ?? 0) > 0)) b.importacion = Math.max(b.importacion, cabe);
      return;
    }
    const pedido = this.#pedidos.get(destino);
    const patio = this.#patiosPuerto.get(destino);
    if (!pedido || !patio) return;
    const baja = Math.min(b.importacion, pedido[tipo]);
    if (baja >= 1) {
      pedido[tipo] -= baja;
      b.importacion -= baja;
      b.importado += baja;
      this.comercio = { ...this.comercio, importado: sumar(this.comercio.importado, baja, año, { [destino]: baja }, tipo) };
    }
    if (!b.paradas.some((p) => puerta(p))) return;
    const sube = Math.min(patio[tipo], cabe - b.importacion - b.exportacion);
    if (sube < 1) return;
    patio[tipo] -= sube;
    b.exportacion += sube;
    b.exportacionDe[destino] = (b.exportacionDe[destino] ?? 0) + sube;
  }

  /** A port's trade now (tonnes): exports waiting for a ship and imports asked for, by kind, and imports waiting for a train. */
  puertoAhora(clave: string): { exportacion: Record<TipoCarga, number>; pedido: Record<TipoCarga, number>; tren: number } | null {
    const exportacion = this.#patiosPuerto.get(clave);
    const pedido = this.#pedidos.get(clave);
    return exportacion && pedido ? { exportacion, pedido, tren: this.#patiosImportacion.get(clave) ?? 0 } : null;
  }

  // ---- offshore supplies ------------------------------------------------------------------------

  #abastecerEscala(b: Barco, destino: string) {
    if (BASES_ABASTO.has(destino)) {
      b.abasto = TONELADAS_ABASTECEDOR;
      return;
    }
    if (!destino.startsWith('plataforma:') || b.abasto <= 0) return;
    const id = destino.slice('plataforma:'.length);
    const tope = abastoDiario(id, añoDe(this.horas)) * DIAS_RESERVA;
    const hay = this.#reservas.get(id) ?? 0;
    const baja = Math.min(b.abasto, Math.max(0, tope - hay));
    if (baja <= 0) return;
    this.#reservas.set(id, hay + baja);
    b.abasto -= baja;
    b.entregadoAbasto += baja;
  }

  /**
   * An hour on the platforms: each complex uses its supplies; when they run
   * short, how well it has been supplied (remembered over a month) drops, and
   * its crude with it.
   */
  #consumirAbasto(horas: number) {
    const año = añoDe(this.horas);
    const peso = Math.min(1, horas / (24 * DIAS_MEMORIA));
    for (const c of COMPLEJOS) {
      const usa = (abastoDiario(c.id, año) * horas) / 24;
      const hay = this.#reservas.get(c.id) ?? 0;
      const cubierto = usa > 0 ? Math.min(1, hay / usa) : 1;
      this.#reservas.set(c.id, Math.max(0, hay - usa));
      const s = this.#surtido.get(c.id) ?? 1;
      this.#surtido.set(c.id, s + (cubierto - s) * peso);
    }
  }

  // ---- fuel ------------------------------------------------------------------------------------

  #cuentaDe(año: string) {
    let c = this.#cuentas.get(año);
    if (!c) {
      c = { pais: cuentaVacia(), estados: new Map(), sinSalida: 0, desde: this.horas, porPuerta: {}, cabotaje: {} };
      this.#cuentas.set(año, c);
    }
    return c;
  }

  #cuentaEstado(c: { estados: Map<string, Cuenta> }, estado: string): Cuenta {
    let e = c.estados.get(estado);
    if (!e) {
      e = cuentaVacia();
      c.estados.set(estado, e);
    }
    return e;
  }

  /**
   * An hour of fuel. Every state uses its share, and what its pipelines bring
   * counts as the country's. Pemex's rented tankers bring their half of what
   * has to come to it coastwise: what the refineries of its coast have left
   * over, or else imported at the hub. Then goes the country's fuel the
   * player's trains and tankers left in its terminals. The rest is imported:
   * what its zones lack, through the ports at the head of their pipelines up to
   * their room and by land past that; what comes by rail, by land; what comes
   * by sea, through its own ports up to their room and, past that, what the
   * player brought from a hub. What's still lacking is counted as missing.
   * What the zones can't take piles up in the refineries' yards (past their
   * room it has no way out), and what the rented tankers don't carry waits at
   * the hubs for the player's.
   */
  #abastecer(horas: number) {
    const a = this.abasto;
    if (!a || this.modo === 'realidad') return;
    const cuenta = this.#cuentaDe(String(añoDe(this.horas)));
    const pais = cuenta.pais;
    const entra = (puerta: string, b: number) => {
      if (b > 0) cuenta.porPuerta[puerta] = (cuenta.porPuerta[puerta] ?? 0) + b;
    };
    const importar = (c: Cuenta, b: number) => {
      c.importado += b;
      pais.importado += b;
    };
    const porZona = new Map<string, number>();
    const porMar = new Map<string, number>();
    const faltaEstado = new Map<string, number>();
    const pipasEstado = new Map<string, number>();
    for (const [estado, mbd] of a.consumo) {
      const c = this.#cuentaEstado(cuenta, estado);
      const usa = barrilesEn(mbd, horas);
      const ducto = barrilesEn(a.porDucto.get(estado) ?? 0, horas);
      c.consumo += usa;
      c.ducto += ducto;
      pais.consumo += usa;
      pais.ducto += ducto;
      let mar = barrilesEn(a.porMar.get(estado) ?? 0, horas);
      let tren = barrilesEn(a.porTren.get(estado) ?? 0, horas);
      const zonas = [...(a.faltaZona.get(estado) ?? [])].map(([z, mbdZ]) => [z, barrilesEn(mbdZ, horas)] as [string, number]);
      // Pemex's rented tankers: their half of what has to come coastwise.
      const rentado = Math.min(mar, barrilesEn((a.cabotaje.get(estado) ?? 0) * PARTE_RENTADOS, horas));
      if (rentado > 0) {
        const hub = this.#concentradorDelEstado(estado);
        const propio = this.#tomarDeRefinerias(hub, rentado);
        c.rentados += propio;
        pais.rentados += propio;
        importar(c, rentado - propio);
        if (hub && rentado - propio > 0) {
          entra(hub, rentado - propio);
          cuenta.cabotaje[hub] = (cuenta.cabotaje[hub] ?? 0) + rentado - propio;
        }
        mar -= rentado;
      }
      // The country's fuel the player left in its terminals goes first: by sea, by rail, then what its zones lack.
      let hay = this.#inventarios.get(estado) ?? 0;
      const cubrir = (b: number) => {
        const u = Math.min(hay, b);
        hay -= u;
        return b - u;
      };
      mar = cubrir(mar);
      tren = cubrir(tren);
      for (const z of zonas) z[1] = cubrir(z[1]);
      this.#inventarios.set(estado, hay);
      // The rest is imported: by rail, it comes by land; a zone's, through its ports; by sea, through the state's own.
      importar(c, tren);
      entra(POR_TIERRA, tren);
      for (const [z, b] of zonas) {
        importar(c, b);
        porZona.set(z, (porZona.get(z) ?? 0) + b);
      }
      if (mar > 0) porMar.set(estado, mar);
    }
    // A zone's imports come through its ports, up to their room this hour (a hub keeps
    // what its coast needs coastwise), and by land past that.
    const libre = (p: string) => barrilesEn(Math.max(0, topeImportacion(p) - (a.porConcentrador.get(p) ?? 0)), horas);
    for (const [z, b] of porZona) {
      const puertas = PUERTAS_ZONA.get(z) ?? [];
      const cabe = puertas.reduce((s, p) => s + libre(p), 0);
      const porPuertos = Math.min(b, cabe);
      for (const p of puertas) entra(p, cabe > 0 ? (porPuertos * libre(p)) / cabe : 0);
      entra(POR_TIERRA, b - porPuertos);
    }
    // By sea, each port imports up to its room this hour, shared by the states it supplies...
    const pide = new Map<string, number>();
    for (const [estado, b] of porMar) for (const [p, f] of PUERTA_MAR.get(estado) ?? []) pide.set(p, (pide.get(p) ?? 0) + b * f);
    for (const [estado, b] of porMar) {
      const c = this.#cuentaEstado(cuenta, estado);
      let directo = 0;
      for (const [p, f] of PUERTA_MAR.get(estado) ?? []) {
        const total = pide.get(p) ?? 0;
        const x = total > 0 ? b * f * Math.min(1, barrilesEn(topeImportacion(p), horas) / total) : 0;
        directo += x;
        entra(p, x);
      }
      importar(c, directo);
      // ...and past that goes what the player left for the coastwise trade, the country's first and then imported
      // (counted when it was delivered); the rest is missing.
      let falta = b - directo;
      for (const inv of [this.#inventariosCab, this.#inventariosImp]) {
        const hayAqui = inv.get(estado) ?? 0;
        const u = Math.min(hayAqui, falta);
        inv.set(estado, hayAqui - u);
        falta -= u;
      }
      // The State's emergency tanker trucks in service in this state bring what they can (imported), as far as
      // its till pays their running.
      const pipas = this.pipasEnServicio(estado);
      if (pipas > 0 && falta > 0 && this.dinero > 0) {
        const u = Math.min(falta, barrilesEn((pipas * BARRILES_POR_PIPA) / 1000, horas), (this.dinero * 1e6) / PESOS_POR_BARRIL_PIPA);
        falta -= u;
        c.pipas += u;
        pais.pipas += u;
        importar(c, u);
        entra(EN_PIPAS, u);
        pipasEstado.set(estado, u);
        const mdp = (u * PESOS_POR_BARRIL_PIPA) / 1e6;
        this.dinero -= mdp;
        this.#operacionPipas.set(estado, (this.#operacionPipas.get(estado) ?? 0) + mdp);
        const año = String(añoDe(this.horas));
        this.#operacionPipasAño.set(año, (this.#operacionPipasAño.get(año) ?? 0) + mdp);
      }
      if (falta > 1e-6) {
        c.faltante += falta;
        pais.faltante += falta;
        faltaEstado.set(estado, falta);
      }
    }
    // What the rented tankers don't carry waits at the hubs for the player's, up to some days of it.
    for (const [hub, mbd] of a.porConcentrador) {
      const h = mbd * (1 - PARTE_RENTADOS);
      this.#patiosImp.set(hub, Math.min(barrilesEn(h, 24 * DIAS_EN_PATIO), (this.#patiosImp.get(hub) ?? 0) + barrilesEn(h, horas)));
    }
    for (const [id, mbd] of a.sobrante) {
      const r = this.refinacion?.porRefineria.get(id);
      const tope = barrilesEn(r?.combustibles ?? 0, 24 * DIAS_EN_PATIO);
      let p = (this.#patios.get(id) ?? 0) + barrilesEn(mbd, horas);
      if (p > tope) {
        cuenta.sinSalida += p - tope;
        p = tope;
      }
      this.#patios.set(id, p);
    }
    this.#contarDesabasto(a, faltaEstado, pipasEstado, horas);
  }

  /**
   * What a state lacked this hour: a week's memory of it slows its cargo, and each new day settles
   * the one before (`#cerrarDiaDesabasto`).
   */
  #contarDesabasto(a: Abasto, faltaEstado: ReadonlyMap<string, number>, pipasEstado: ReadonlyMap<string, number>, horas: number) {
    const dia = Math.floor(this.horas / 24);
    if (dia !== this.#diaDesabasto) {
      if (this.#diaDesabasto >= 0) this.#cerrarDiaDesabasto();
      this.#diaDesabasto = dia;
    }
    const peso = Math.min(1, horas / (24 * DESABASTO.memoriaDias));
    for (const [estado, mbd] of a.consumo) {
      const usa = barrilesEn(mbd, horas);
      const falta = faltaEstado.get(estado) ?? 0;
      const s = this.#surtidoComb.get(estado) ?? 1;
      this.#surtidoComb.set(estado, s + ((usa > 0 ? 1 - falta / usa : 1) - s) * peso);
      const d = this.#diaComb.get(estado) ?? { usa: 0, falta: 0, pipas: 0, horas: 0 };
      d.usa += usa;
      d.falta += falta;
      d.pipas += pipasEstado.get(estado) ?? 0;
      d.horas += horas;
      this.#diaComb.set(estado, d);
    }
  }

  /**
   * A day of fuel is over. A state short of it that day (past `UMBRAL_DESABASTO`) adds a day in a
   * row; after `DESABASTO.diasParaPipas` of them the State buys the tanker trucks that cover what
   * it lacks, besides the ones it has (on their way too), as many as its till can pay, and the
   * count starts again.
   */
  #cerrarDiaDesabasto() {
    for (const [estado, d] of this.#diaComb) {
      const parte = d.usa > 0 ? d.falta / d.usa : 0;
      this.#faltaAyer.set(estado, parte);
      const dias = parte > UMBRAL_DESABASTO ? (this.#diasFalta.get(estado) ?? 0) + 1 : 0;
      this.#diasFalta.set(estado, dias);
      if (dias < DESABASTO.diasParaPipas) continue;
      this.#diasFalta.set(estado, 0);
      // What it would lack without trucks, a day: the trucks it needs, less the ones it has.
      const porDia = d.horas > 0 ? ((d.falta + d.pipas) * 24) / d.horas : 0;
      const n = Math.min(Math.ceil(porDia / BARRILES_POR_PIPA) - (this.pipas[estado]?.n ?? 0), Math.floor(this.dinero / MDP_POR_PIPA));
      if (n <= 0) continue;
      const mdp = n * MDP_POR_PIPA;
      this.dinero -= mdp;
      const p = this.pipas[estado] ?? { n: 0, mdp: 0, compras: [] };
      this.pipas = { ...this.pipas, [estado]: { n: p.n + n, mdp: p.mdp + mdp, compras: [...p.compras, { horas: this.horas, n, mdp }] } };
    }
    this.#diaComb.clear();
  }

  /** Share of its fuel a state got over the last week (0-1): its cargo goes with it. Whole in Realidad. */
  surtidoCombustible(estado: string): number {
    return this.modo === 'realidad' ? 1 : (this.#surtidoComb.get(estado) ?? 1);
  }
  /** Share of its fuel a state lacked yesterday, and whether that left it short: then its polos take no companies. */
  faltaAyer(estado: string): number {
    return this.modo === 'realidad' ? 0 : (this.#faltaAyer.get(estado) ?? 0);
  }
  hayCombustible(estado: string): boolean {
    return this.faltaAyer(estado) <= UMBRAL_DESABASTO;
  }
  /** A state's trucks already in service: each purchase's come in over the months after it (`llegadaPipas`). */
  pipasEnServicio(estado: string): number {
    const p = this.pipas[estado];
    if (!p) return 0;
    return p.compras.reduce((s, c) => s + c.n * llegadaPipas((this.horas - c.horas) / 24), 0);
  }
  /** What running the trucks has cost the State's till, millions of pesos: in a state, or all of them in a year. */
  operacionPipas(estado: string): number {
    return this.#operacionPipas.get(estado) ?? 0;
  }
  operacionPipasDelAño(año: number): number {
    return this.#operacionPipasAño.get(String(año)) ?? 0;
  }

  /** Days in a row a state has been short of fuel (the State buys tanker trucks at `DESABASTO.diasParaPipas`). */
  diasSinCombustible(estado: string): number {
    return this.modo === 'realidad' ? 0 : (this.#diasFalta.get(estado) ?? 0);
  }

  /** Fuel the player left in a state's terminals for the coastwise trade, the country's and imported, barrels. */
  #paraCabotaje(estado: string): number {
    return (this.#inventariosCab.get(estado) ?? 0) + (this.#inventariosImp.get(estado) ?? 0);
  }

  /** Barrels a state's terminals can still take: some days of what its pipelines and Pemex's rented tankers don't bring. */
  #cabeEn(estado: string): number {
    const a = this.abasto;
    const falta = (a?.hueco.get(estado) ?? 0) - (a?.cabotaje.get(estado) ?? 0) * PARTE_RENTADOS;
    return Math.max(0, barrilesEn(falta, 24 * DIAS_POR_SURTIR) - (this.#inventarios.get(estado) ?? 0) - this.#paraCabotaje(estado));
  }

  /** Barrels a state's terminals can still take of what has to come to it coastwise and the rented tankers don't bring. */
  #cabeCabotaje(estado: string): number {
    const c = (this.abasto?.cabotaje.get(estado) ?? 0) * (1 - PARTE_RENTADOS);
    return c > 0 ? Math.max(0, barrilesEn(c, 24 * DIAS_POR_SURTIR) - this.#paraCabotaje(estado)) : 0;
  }

  /** The hub a sea-fed state's coastwise fuel comes from (the one of its main port's coast). */
  #concentradorDelEstado(estado: string): string | null {
    const p = PUERTA_MAR.get(estado)?.[0]?.[0];
    return p ? concentradorDe(p) : null;
  }

  /** Pemex's rented tankers take the country's fuel first, from the yards of the refineries of the hub's coast: what they got, barrels. */
  #tomarDeRefinerias(hub: string | null, barriles: number): number {
    const costa = hub ? costaDe(hub) : null;
    const ids = costa ? (REFINERIAS_DE_COSTA.get(costa) ?? []) : [];
    const hay = ids.reduce((s, id) => s + (this.#patios.get(id) ?? 0), 0);
    const toma = Math.min(barriles, hay);
    if (toma <= 0) return 0;
    for (const id of ids) {
      const x = this.#patios.get(id) ?? 0;
      this.#patios.set(id, x - (toma * x) / hay);
    }
    return toma;
  }

  /** Spread `cuanto` barrels over states by the room each has (none past it); returns what came off. */
  #repartir(cabe: readonly (readonly [string, number])[], cuanto: number, dejar: (estado: string, barriles: number) => void): number {
    const total = cabe.reduce((s, [, c]) => s + c, 0);
    const baja = Math.min(cuanto, total);
    if (baja < 1) return 0;
    for (const [estado, c] of cabe) if (c > 0) dejar(estado, (baja * c) / total);
    return baja;
  }

  /**
   * Room for coastwise fuel at the rest of a vehicle's run, after the stop at
   * leg `pierna` and before it gets back to where its fuel came from, as it
   * will be when the vehicle gets to each stop: the country's fuel keeps that
   * much aboard for them.
   */
  #cabotajeAdelante(u: Tren | Barco, pierna: number, origen: string | null): number {
    const n = u.destinos.length;
    const aqui = SITIOS_POR_CLAVE.get(u.destinos[pierna])?.estado;
    const vistos = new Set(aqui ? estadosQueSurte(u.destinos[pierna], aqui) : []);
    let suma = 0;
    let horas = u.esperas[pierna] ?? 0;
    for (let k = 1; k < n; k++) {
      const j = (pierna + k) % n;
      horas += u.piernas[j]?.horas ?? 0;
      const parada = u.destinos[j];
      if (origen && (parada === `refineria:${origen}` || REFINERIA_DEL_PUERTO.get(parada) === origen)) break;
      const propio = SITIOS_POR_CLAVE.get(parada)?.estado;
      for (const e of propio ? estadosQueSurte(parada, propio) : []) {
        if (vistos.has(e)) continue;
        vistos.add(e);
        const ritmo = (this.abasto?.cabotaje.get(e) ?? 0) * (1 - PARTE_RENTADOS);
        if (ritmo > 0) suma += Math.min(barrilesEn(ritmo, 24 * DIAS_POR_SURTIR), this.#cabeCabotaje(e) + barrilesEn(ritmo, horas));
      }
      horas += u.esperas[j] ?? 0;
    }
    return suma;
  }

  /** Whether a vehicle's run calls somewhere fuel has to come coastwise, other than `hub`. */
  #llevaCabotaje(u: Tren | Barco, hub: string): boolean {
    return u.paradas.some((p) => {
      const propio = p !== hub ? SITIOS_POR_CLAVE.get(p)?.estado : undefined;
      return !!propio && estadosQueSurte(p, propio).some((e) => (this.abasto?.cabotaje.get(e) ?? 0) > 0);
    });
  }

  /**
   * Leave fuel where it's lacking, at the stop of leg `pierna`. Imported fuel
   * only where it has to come coastwise. The country's goes there first and,
   * past what the rest of the run needs that way, anywhere it saves an import
   * (never back at the refinery it came from). A port that also supplies its
   * neighbours (Progreso the peninsula, Mazatlán Nayarit) shares what comes
   * off by the room each one has.
   */
  #descargarCombustible(u: Tren | Barco, destino: string, pierna: number) {
    if (u.combustible <= 0 && u.combustibleImp <= 0) return;
    const propio = SITIOS_POR_CLAVE.get(destino)?.estado;
    if (!propio) return;
    const estados = estadosQueSurte(destino, propio);
    const cuenta = this.#cuentaDe(String(añoDe(this.horas)));
    if (u.combustibleImp > 0) {
      const hub = u.combustibleImpDe;
      const baja = this.#repartir(
        estados.map((e) => [e, this.#cabeCabotaje(e)] as const),
        u.combustibleImp,
        (e, x) => {
          this.#inventariosImp.set(e, (this.#inventariosImp.get(e) ?? 0) + x);
          this.#cuentaEstado(cuenta, e).importado += x;
        }
      );
      if (baja > 0) {
        cuenta.pais.importado += baja;
        if (hub) {
          cuenta.porPuerta[hub] = (cuenta.porPuerta[hub] ?? 0) + baja;
          cuenta.cabotaje[hub] = (cuenta.cabotaje[hub] ?? 0) + baja;
        }
        u.entregadoImp += baja;
        u.combustibleImp -= baja;
        if (u.combustibleImp < 1) {
          u.combustibleImp = 0;
          u.combustibleImpDe = null;
        }
      }
    }
    const origen = u.combustibleDe;
    if (u.combustible <= 0 || (origen && (destino === `refineria:${origen}` || REFINERIA_DEL_PUERTO.get(destino) === origen))) return;
    const modo = u.tipo === 'tren' ? 'tren' : 'barco';
    const dejarEn = (inv: Map<string, number>) => (e: string, x: number) => {
      inv.set(e, (inv.get(e) ?? 0) + x);
      this.#cuentaEstado(cuenta, e)[modo] += x;
    };
    let baja = this.#repartir(estados.map((e) => [e, this.#cabeCabotaje(e)] as const), u.combustible, dejarEn(this.#inventariosCab));
    const sobra = u.combustible - baja - this.#cabotajeAdelante(u, pierna, origen);
    if (sobra >= 1) baja += this.#repartir(estados.map((e) => [e, this.#cabeEn(e)] as const), sobra, dejarEn(this.#inventarios));
    if (baja <= 0) return;
    cuenta.pais[modo] += baja;
    u.entregadoCombustible += baja;
    u.combustible -= baja;
    if (u.combustible < 1) {
      u.combustible = 0;
      u.combustibleDe = null;
    }
  }

  /**
   * Load at a stop the liquids a vehicle carries: first the fuel the rest of
   * the run needs coastwise, then the fuel oil its power plants can take,
   * then fuel to save imports with the room left (`#cargarCombustible`
   * keeps the fuel oil's room for it).
   */
  #cargarLiquidos(u: Tren | Barco, destino: string, pierna: number) {
    if (u.tipo === 'barco' && u.clase !== 'tanque') return;
    const quiere = this.#combustoleoQuiere(u, destino, pierna);
    // The fuel oil's room in barrels of fuel: a tanker's are barrels, a train's tonnes.
    const reservar = u.tipo === 'tren' ? (quiere * T_POR_BARRIL_CO) / T_POR_BARRIL : quiere;
    const cabe = u.tipo === 'tren' ? u.combustible + u.combustibleImp + this.#espacioTren(u) / T_POR_BARRIL : BARRILES_POR_TANQUE - u.combustoleo;
    this.#cargarCombustible(u, destino, cabe, pierna, reservar);
    this.#cargarCombustoleo(u, destino, quiere);
  }

  /**
   * Load fuel, up to `cabe` barrels of fuel aboard in all. At a refinery (a
   * train at its station or at its port, the coastal ones'; a tanker at its
   * port), what waits in its yard: one refinery's fuel at a time, keeping
   * `reservar` barrels of room for fuel oil unless the run needs it for what
   * has to come coastwise. Then at a hub, imported fuel for the coastwise
   * trade, if the run calls where it has to come that way.
   */
  #cargarCombustible(u: Tren | Barco, destino: string, cabe: number, pierna: number, reservar = 0) {
    if (u.tipo === 'barco' && u.clase !== 'tanque') return;
    const id = destino.startsWith('refineria:') ? destino.slice('refineria:'.length) : REFINERIA_DEL_PUERTO.get(destino);
    if (id && !(u.combustibleDe && u.combustibleDe !== id && u.combustible > 0)) {
      const hay = this.#patios.get(id) ?? 0;
      const libre = cabe - u.combustible - u.combustibleImp;
      const cabotaje = reservar > 0 ? Math.max(0, this.#cabotajeAdelante(u, pierna, id) - u.combustible) : 0;
      const sube = Math.min(hay, Math.max(Math.min(cabotaje, libre), libre - reservar));
      if (sube >= 1) {
        this.#patios.set(id, hay - sube);
        u.combustible += sube;
        u.combustibleDe = id;
      }
    }
    if (!CONCENTRADORES.has(destino) || !this.#llevaCabotaje(u, destino)) return;
    if (u.combustibleImpDe && u.combustibleImpDe !== destino && u.combustibleImp > 0) return;
    const hay = this.#patiosImp.get(destino) ?? 0;
    // No more than the rest of the run can leave coastwise: what it couldn't would ride along and take another vehicle's.
    const pide = Math.max(0, this.#cabotajeAdelante(u, pierna, null) - u.combustible - u.combustibleImp);
    const sube = Math.min(hay, cabe - u.combustible - u.combustibleImp, pide);
    if (sube < 1) return;
    this.#patiosImp.set(destino, hay - sube);
    u.combustibleImp += sube;
    u.combustibleImpDe = destino;
  }

  // ---- fuel oil ----------------------------------------------------------------------------------

  #cuentaCoDe(año: string) {
    let c = this.#cuentasCo.get(año);
    if (!c) {
      c = { ...cuentaCoVacia(), desde: this.horas };
      this.#cuentasCo.set(año, c);
    }
    return c;
  }

  /** Thousand barrels a day of a plant's fuel oil that wait for the player's trains and tankers: half of what its pipeline doesn't bring. */
  ritmoJugadorCo(c: Central): number {
    const año = añoDe(this.horas);
    return (mbdCentralCo(c, año) - porDuctoCo(c, this.combustoleo, año)) * (1 - PARTE_AUTOMATICA_CO);
  }

  /** The most a plant keeps of what the player brings, barrels. */
  #topeReservaCo(c: Central): number {
    return barrilesEn(this.ritmoJugadorCo(c), 24 * DIAS_RESERVA_CO);
  }

  /** The most a refinery keeps in its yard: some days of what it makes and its pipelines don't take, barrels. */
  #topePatioCo(id: string): number {
    const año = añoDe(this.horas);
    const ducto = CENTRALES_CO.reduce((s, c) => s + (c.ducto === id ? porDuctoCo(c, this.combustoleo, año) : 0), 0);
    return barrilesEn(Math.max(0, (this.combustoleo.get(id) ?? 0) - ducto), 24 * DIAS_PATIO_CO);
  }

  /**
   * An hour of fuel oil. The refineries make it, and the plants next to one
   * take theirs by pipeline. Of the rest each plant burns, half comes on its
   * own — Pemex's rented tankers or the private railroads take it from the
   * refineries' yards, the nearest first, or import it when they're empty —
   * and half from what the player's trains and tankers left at the plant;
   * what isn't there is missing. How a plant was supplied over the last
   * month sets its MW. What doesn't fit in a refinery's yard is exported.
   */
  #abastecerCombustoleo(horas: number) {
    if (this.modo === 'realidad') return;
    const cuenta = this.#cuentaCoDe(String(añoDe(this.horas)));
    const hecho = new Map<string, number>();
    for (const [id, mbd] of this.combustoleo) {
      const b = barrilesEn(mbd, horas);
      hecho.set(id, b);
      cuenta.producido += b;
    }
    const año = añoDe(this.horas);
    const porDucto = new Map<string, number>();
    for (const c of CENTRALES_CO) {
      if (!c.ducto) continue;
      const d = Math.min(barrilesEn(mbdCentralCo(c, año), horas), hecho.get(c.ducto) ?? 0);
      hecho.set(c.ducto, (hecho.get(c.ducto) ?? 0) - d);
      porDucto.set(c.id, d);
    }
    for (const [id, b] of hecho) this.#patiosCo.set(id, (this.#patiosCo.get(id) ?? 0) + b);
    const tomar = (c: Central, b: number) => {
      let falta = b;
      for (const id of c.fuentes) {
        const hay = this.#patiosCo.get(id) ?? 0;
        const u = Math.min(hay, falta);
        this.#patiosCo.set(id, hay - u);
        falta -= u;
        if (falta <= 0) break;
      }
      return b - falta;
    };
    const peso = Math.min(1, horas / (24 * MEMORIA_DIAS));
    for (const c of CENTRALES_CO) {
      const pide = barrilesEn(mbdCentralCo(c, año), horas);
      const ducto = porDucto.get(c.id) ?? 0;
      const resto = pide - ducto;
      const auto = resto * PARTE_AUTOMATICA_CO;
      const propio = tomar(c, auto);
      const jugador = resto - auto;
      const hay = this.#reservasCo.get(c.id) ?? 0;
      const usa = Math.min(hay, jugador);
      this.#reservasCo.set(c.id, hay - usa);
      const falta = jugador - usa > 1e-6 ? jugador - usa : 0;
      cuenta.ducto += ducto;
      cuenta[c.llega === 'barco' ? 'rentados' : 'privados'] += propio;
      cuenta.importado += auto - propio;
      cuenta.faltante += falta;
      cuenta.quemado += pide - falta;
      const k = (cuenta.centrales[c.id] ??= { pide: 0, quema: 0 });
      k.pide += pide;
      k.quema += pide - falta;
      const cubierto = pide > 0 ? (pide - falta) / pide : 1;
      const s = this.#surtidoCo.get(c.id) ?? 1;
      this.#surtidoCo.set(c.id, s + (cubierto - s) * peso);
    }
    for (const id of this.combustoleo.keys()) {
      const tope = this.#topePatioCo(id);
      const hay = this.#patiosCo.get(id) ?? 0;
      if (hay <= tope) continue;
      cuenta.exportado += hay - tope;
      cuenta.exportadoDe[id] = (cuenta.exportadoDe[id] ?? 0) + hay - tope;
      this.#patiosCo.set(id, tope);
    }
  }

  /**
   * Fuel oil the rest of a vehicle's run can leave at power plants, after the
   * stop of leg `pierna` and before it gets back to the refinery `origen`, as
   * their stores will be when it gets to each one, barrels.
   */
  #combustoleoAdelante(u: Tren | Barco, pierna: number, origen: string): number {
    const n = u.destinos.length;
    const vistas = new Set<string>();
    let suma = 0;
    let horas = u.esperas[pierna] ?? 0;
    for (let k = 1; k < n; k++) {
      const j = (pierna + k) % n;
      horas += u.piernas[j]?.horas ?? 0;
      const parada = u.destinos[j];
      if (parada === `refineria:${origen}` || REFINERIA_DEL_PUERTO.get(parada) === origen) break;
      for (const c of ENTREGAS_CO.get(parada) ?? []) {
        if (vistas.has(c.id)) continue;
        vistas.add(c.id);
        const ritmo = this.ritmoJugadorCo(c);
        const tope = this.#topeReservaCo(c);
        if (ritmo > 0) suma += Math.min(tope, tope - (this.#reservasCo.get(c.id) ?? 0) + barrilesEn(ritmo, horas));
      }
      horas += u.esperas[j] ?? 0;
    }
    return suma;
  }

  /** The refinery whose yard a stop loads from: its station, or a coastal one's port. */
  #refineriaDe(destino: string): string | undefined {
    return destino.startsWith('refineria:') ? destino.slice('refineria:'.length) : REFINERIA_DEL_PUERTO.get(destino);
  }

  /** Fuel oil a vehicle should load at this stop for the plants on its run, barrels: one refinery's at a time. */
  #combustoleoQuiere(u: Tren | Barco, destino: string, pierna: number): number {
    const id = this.#refineriaDe(destino);
    const hay = id ? (this.#patiosCo.get(id) ?? 0) : 0;
    if (!id || hay < 1 || (u.combustoleoDe && u.combustoleoDe !== id && u.combustoleo > 0)) return 0;
    return Math.max(0, Math.min(hay, this.#combustoleoAdelante(u, pierna, id) - u.combustoleo));
  }

  #cargarCombustoleo(u: Tren | Barco, destino: string, quiere: number) {
    const id = this.#refineriaDe(destino);
    if (!id || quiere < 1) return;
    const libre = u.tipo === 'tren' ? this.#espacioTren(u) / T_POR_BARRIL_CO : BARRILES_POR_TANQUE - u.combustible - u.combustibleImp - u.combustoleo;
    const sube = Math.min(quiere, this.#patiosCo.get(id) ?? 0, libre);
    if (sube < 1) return;
    this.#patiosCo.set(id, (this.#patiosCo.get(id) ?? 0) - sube);
    u.combustoleo += sube;
    u.combustoleoDe = id;
  }

  /** Leave fuel oil for the power plants that get it at this stop, by the room each has (never back at its refinery). */
  #descargarCombustoleo(u: Tren | Barco, destino: string) {
    if (u.combustoleo < 1) return;
    const centrales = ENTREGAS_CO.get(destino);
    const origen = u.combustoleoDe;
    if (!centrales || (origen && this.#refineriaDe(destino) === origen)) return;
    const cabe = centrales.map((c) => [c, Math.max(0, this.#topeReservaCo(c) - (this.#reservasCo.get(c.id) ?? 0))] as const);
    const total = cabe.reduce((s, [, x]) => s + x, 0);
    const baja = Math.min(u.combustoleo, total);
    if (baja < 1) return;
    for (const [c, x] of cabe) if (x > 0) this.#reservasCo.set(c.id, (this.#reservasCo.get(c.id) ?? 0) + (baja * x) / total);
    this.#cuentaCoDe(String(añoDe(this.horas)))[u.tipo === 'tren' ? 'tren' : 'barco'] += baja;
    u.entregadoCombustoleo += baja;
    u.combustoleo -= baja;
    if (u.combustoleo < 1) {
      u.combustoleo = 0;
      u.combustoleoDe = null;
    }
  }

  /** Fuel oil in a refinery's yard, and what a plant keeps of what the player brought, barrels. */
  enPatioCo(id: string): number {
    return this.#patiosCo.get(id) ?? 0;
  }
  reservaCo(id: string): number {
    return this.#reservasCo.get(id) ?? 0;
  }

  /** How a fuel-oil plant was supplied in the last month (0–1); whole in Realidad. */
  surtidoCo(id: string): number {
    return this.modo === 'realidad' ? 1 : (this.#surtidoCo.get(id) ?? 1);
  }

  /** A year of fuel oil (barrels). Read it with `horas` for it to move. */
  cuentaCombustoleo(año: number): CuentaCo {
    return this.#cuentasCo.get(String(año)) ?? cuentaCoVacia();
  }

  /** Days of that year the fuel oil has been counted so far (never less than an hour). */
  diasContadosCo(año: number): number {
    const c = this.#cuentasCo.get(String(año));
    if (!c) return 1 / 24;
    const fin = añoDe(this.horas) === año ? this.horas : horasDeFecha(`${año + 1}-01-01`);
    return Math.max(1 / 24, (fin - c.desde) / 24);
  }

  /** Fuel waiting in a refinery's yard, barrels. */
  enPatio(id: string): number {
    return this.#patios.get(id) ?? 0;
  }

  /** Fuel in a state's terminals that came by train or tanker, barrels: the country's, and imported (brought coastwise). */
  enTerminales(estado: string): number {
    return (this.#inventarios.get(estado) ?? 0) + (this.#inventariosCab.get(estado) ?? 0);
  }
  enTerminalesImp(estado: string): number {
    return this.#inventariosImp.get(estado) ?? 0;
  }

  /** Imported fuel waiting at a hub for the player's tankers and trains, barrels. */
  enPatioImp(hub: string): number {
    return this.#patiosImp.get(hub) ?? 0;
  }

  /** Where a year's fuel imports came in, barrels by port key (and `tierra`). Read it with `horas` for it to move. */
  importadoPorPuerta(año: number): Record<string, number> {
    return this.#cuentas.get(String(año))?.porPuerta ?? {};
  }
  /** What of that each hub imported for the coastwise trade, barrels. */
  importadoParaCabotaje(año: number): Record<string, number> {
    return this.#cuentas.get(String(año))?.cabotaje ?? {};
  }

  /** A year of fuel, the country's or one state's (barrels). Read it with `horas` for it to move. */
  cuentaCombustibles(año: number, estado?: string): Cuenta {
    const c = this.#cuentas.get(String(año));
    if (!c) return cuentaVacia();
    return estado ? (c.estados.get(estado) ?? cuentaVacia()) : c.pais;
  }

  /** Barrels the refineries made that year and had no way out. */
  sinSalida(año: number): number {
    return this.#cuentas.get(String(año))?.sinSalida ?? 0;
  }

  /** Days of that year the fuel has been counted so far (never less than an hour), for its daily averages. */
  diasContados(año: number): number {
    const c = this.#cuentas.get(String(año));
    if (!c) return 1 / 24;
    const fin = añoDe(this.horas) === año ? this.horas : horasDeFecha(`${año + 1}-01-01`);
    return Math.max(1 / 24, (fin - c.desde) / 24);
  }

  #entregarNacional(t: Tren, km: number) {
    if (t.cargaNacional <= 0) return;
    const c = this.cargaNacional;
    const año = String(añoDe(this.horas));
    const ton = t.cargaNacional;
    this.cargaNacional = {
      total: c.total + ton,
      porAño: { ...c.porAño, [año]: (c.porAño[año] ?? 0) + ton },
      tkm: c.tkm + ton * km,
      tkmPorAño: { ...c.tkmPorAño, [año]: (c.tkmPorAño[año] ?? 0) + ton * km },
    };
    t.movidoNacional += ton;
    t.cargaNacional = 0;
  }

  #cargarNacional(t: Tren, destino: string) {
    const estado = SITIOS_POR_CLAVE.get(destino)?.estado;
    if (!estado) return;
    t.cargaNacional += this.#cargarDelPolo(t, destino, 'nacional');
    // A steel mill's steel boards first: it's domestic cargo, delivered at the next stop.
    if (destino.startsWith('industria:')) {
      const id = destino.slice('industria:'.length);
      const hayAcero = this.#patiosAcero.get(id) ?? 0;
      const subeAcero = Math.min(this.#espacioTren(t), hayAcero);
      if (subeAcero >= 1) {
        this.#patiosAcero.set(id, hayAcero - subeAcero);
        t.cargaNacional += subeAcero;
        this.acero = { ...this.acero, [id]: (this.acero[id] ?? 0) + subeAcero };
      }
    }
    const hay = this.#bodegasNacional.get(estado) ?? 0;
    const sube = Math.min(this.#espacioTren(t), hay);
    if (sube <= 0) return;
    this.#bodegasNacional.set(estado, hay - sube);
    t.cargaNacional += sube;
  }

  /** Export cargo at a stop: unloaded at an exit, loaded anywhere else. */
  #exportar(t: Tren, destino: string) {
    if (SALIDAS.has(destino)) {
      if (t.carga <= 0) return;
      const e = this.exportacion;
      const año = String(añoDe(this.horas));
      const porEstado = { ...e.porEstado };
      for (const [edo, ton] of Object.entries(t.cargaDe)) porEstado[edo] = (porEstado[edo] ?? 0) + ton;
      this.exportacion = {
        total: e.total + t.carga,
        porAño: { ...e.porAño, [año]: (e.porAño[año] ?? 0) + t.carga },
        porSalida: { ...e.porSalida, [destino]: (e.porSalida[destino] ?? 0) + t.carga },
        porEstado,
      };
      t.exportado += t.carga;
      // At a port it waits in the yard for a ship, as the kind the port exports most.
      const p = comercioDe(destino);
      const patio = this.#patiosPuerto.get(destino);
      if (p && patio) patio[p.deTren] = Math.min(patio[p.deTren] + t.carga, topeExportacion(p, p.deTren));
      t.carga = 0;
      t.cargaDe = {};
      return;
    }
    const estado = SITIOS_POR_CLAVE.get(destino)?.estado;
    // Exports only board a train whose run reaches an exit: otherwise they'd ride along for good.
    if (!estado || !t.paradas.some((p) => SALIDAS.has(p))) return;
    // A carmaker's vehicles first.
    if (destino.startsWith('industria:')) {
      const id = destino.slice('industria:'.length);
      const hay = this.#patiosAutos.get(id) ?? 0;
      const sube = Math.min(this.#espacioTren(t), hay);
      if (sube >= 1) {
        this.#patiosAutos.set(id, hay - sube);
        t.carga += sube;
        t.cargaDe[estado] = (t.cargaDe[estado] ?? 0) + sube;
        this.autos = { ...this.autos, [id]: (this.autos[id] ?? 0) + sube };
      }
    }
    // A polo's companies' exports first.
    const delPolo = this.#cargarDelPolo(t, destino, 'exportacion');
    if (delPolo > 0) {
      t.carga += delPolo;
      t.cargaDe[estado] = (t.cargaDe[estado] ?? 0) + delPolo;
    }
    const hay = this.#bodegas.get(estado) ?? 0;
    // Domestic cargo was delivered on arrival; fuel still aboard keeps its room.
    const sube = Math.min(this.#espacioTren(t), hay);
    if (sube <= 0) return;
    this.#bodegas.set(estado, hay - sube);
    t.carga += sube;
    t.cargaDe[estado] = (t.cargaDe[estado] ?? 0) + sube;
  }

  /** Recount the player's trains on every line and slow each train down where its lines are full. */
  #saturar() {
    if (!this.red) return;
    const porVia = trenesDelJugador(this.trenes);
    aplicarSaturacion(this.red, this.trenes, porVia);
    this.trenesPorVia = porVia;
  }

  /** How full a rail line is (by `Via.base`): private trains, the player's, and what fits. */
  uso(base: number): Uso | null {
    const v = this.red?.vias[base];
    return v ? usoDe(v, this.trenesPorVia) : null;
  }

  /** Register a viewer; returns the teardown, so call sites read `$effect(() => sim.attach())`. */
  attach(): () => void {
    if (!browser) return () => {};
    this.#espectadores++;
    if (this.#espectadores === 1) this.#arrancar();
    return () => {
      this.#espectadores--;
      if (this.#espectadores === 0) this.#detener();
    };
  }

  #arrancar() {
    this.#ultimo = performance.now();
    const tick = (now: number) => {
      // Clamp the delta: a backgrounded tab hands back a multi-second frame
      // and every vehicle would teleport down the line.
      const dt = Math.min(0.1, (now - this.#ultimo) / 1000);
      this.#ultimo = now;
      const horas = this.corriendo ? dt * HORAS_POR_SEGUNDO * this.multiplicador : 0;
      if (horas > 0) {
        this.#producir(horas);
        this.#abastecer(horas);
        this.#abastecerCombustoleo(horas);
        this.#consumirAbasto(horas);
        for (const t of this.trenes) {
          avanzar(t, horas);
          if (t.llegadas?.length) this.#atenderLlegadas(t);
        }
        for (const b of this.barcos) {
          avanzar(b, horas);
          if (b.llegadas?.length) this.#atenderEscalas(b);
        }
        this.#cobrar();
        this.#avanzarObras(horas);
        this.horas += horas;
      }
      this.#frame = requestAnimationFrame(tick);
    };
    this.#frame = requestAnimationFrame(tick);
  }

  #detener() {
    cancelAnimationFrame(this.#frame);
    this.#frame = 0;
  }
}

export const sim = new Simulacion();
