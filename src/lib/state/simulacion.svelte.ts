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
  BARRILES_POR_TANQUE,
  cuentaVacia,
  DIAS_EN_PATIO,
  DIAS_POR_SURTIR,
  estadosQueSurte,
  REFINERIA_DEL_PUERTO,
  T_POR_BARRIL,
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
import { avanzarInterior, conEspuela, ESPUELA, fijarCuadrillas, obraDelPolo, resumir } from '$lib/domain/interior';

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
   * What happened with fuel each year, the country's and each state's
   * (barrels), what had no way out of the refineries, and the game hour the
   * year started being counted (the game opens on 1 December 2018).
   */
  #cuentas = new Map<string, { pais: Cuenta; estados: Map<string, Cuenta>; sinSalida: number; desde: number }>();
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
        for (const b of barcos) if (b.clase === 'tanque') this.#cargarCombustible(b, b.paradas[0], BARRILES_POR_TANQUE);
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
          for (const [id, e] of Object.entries(o.frentes)) e.avance = id === ESPUELA ? 0 : avance;
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
    for (const o of this.obras.values()) if (o.fase === 'operando' && o.ocupacion > 0) polos.set(o.id, mwDelPolo(o.id) * o.ocupacion);
    const gas = gasDisponible((id) => this.obrasEnergia.get(id)?.fase === 'en-servicio');
    this.energia = estadoEnergia(this.horas, hechas, polos, gas);
    this.refinacion = refinacionJuego({
      avance: (id) => {
        const o = this.obrasPemex.get(id);
        return !o ? 0 : o.fase === 'en-servicio' ? 1 : o.avance;
      },
      deerParkPropia: this.deerParkPropia,
    });
    this.abasto = abastoJuego(this.refinacion);
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
    let terminadas = false;
    for (const o of this.obras.values()) {
      // A polo built by fronts: each front with crews advances (urbanized, or its spur done, changes the network).
      if (o.frentes && avanzarInterior(o, horas, caja)) terminadas = true;
      if (o.fase === 'por-construir') continue;
      // Companies come only with a train and with electricity in the region.
      if (avanzarObra(o, horas, caja, this.conectado(o.id) && this.hayEnergia(o.id))) terminadas = true;
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
    const cajaCfe = { mdp: this.dineroCfe };
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
      nuevo.combustible = viejo.combustible;
      nuevo.combustibleDe = viejo.combustibleDe;
      nuevo.entregadoCombustible = viejo.entregadoCombustible;
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
    for (const e of ESTADOS_EXPORTADORES) {
      const f = flujoDelEstado(e, año);
      this.#bodegas.set(e, Math.min((this.#bodegas.get(e) ?? 0) + f * horas, f * 24 * DIAS_EN_ESPERA));
    }
    for (const e of ESTADOS_PRODUCTIVOS) {
      const f = flujoNacional(e, año);
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
      this.#exportar(t, destino);
      this.#descargarCombustible(t, destino);
      this.#cargarCombustible(t, destino, t.combustible + this.#espacioTren(t) / T_POR_BARRIL);
      this.#cargarImportacion(t, destino);
      this.#cargarNacional(t, destino);
    }
  }

  /** Tonnes a train still has room for: exports, imports, fuel and domestic cargo share its net load. */
  #espacioTren(t: Tren): number {
    return Math.max(0, CARGA_POR_TREN - t.carga - t.importacion - t.cargaNacional - t.combustible * T_POR_BARRIL);
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
   * A tanker got to a port: it leaves its fuel where the state lacks it, then
   * loads at a refinery's port. A supply vessel loads at a supply base and
   * unloads at the offshore complexes.
   */
  #atenderEscalas(b: Barco) {
    const llegadas = b.llegadas!;
    while (llegadas.length) {
      const destino = b.destinos[llegadas.shift()!];
      if (b.clase === 'abastecedor') {
        this.#abastecerEscala(b, destino);
        continue;
      }
      if (b.clase === 'tanque') {
        this.#descargarCombustible(b, destino);
        this.#cargarCombustible(b, destino, BARRILES_POR_TANQUE);
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
      c = { pais: cuentaVacia(), estados: new Map(), sinSalida: 0, desde: this.horas };
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
   * An hour of fuel: every state uses its share; what its pipelines bring
   * counts as the country's; the rest comes out of what trains and tankers left
   * in its terminals, and when that runs out it's imported. What the zones
   * can't take piles up in the refineries' yards; past their room it has no
   * way out.
   */
  #abastecer(horas: number) {
    const a = this.abasto;
    if (!a) return;
    const cuenta = this.#cuentaDe(String(añoDe(this.horas)));
    const pais = cuenta.pais;
    for (const [estado, mbd] of a.consumo) {
      const c = this.#cuentaEstado(cuenta, estado);
      const usa = barrilesEn(mbd, horas);
      const ducto = barrilesEn(a.porDucto.get(estado) ?? 0, horas);
      c.consumo += usa;
      c.ducto += ducto;
      pais.consumo += usa;
      pais.ducto += ducto;
      const falta = usa - ducto;
      if (falta <= 0) continue;
      const hay = this.#inventarios.get(estado) ?? 0;
      if (hay >= falta) {
        this.#inventarios.set(estado, hay - falta);
      } else {
        this.#inventarios.set(estado, 0);
        c.importado += falta - hay;
        pais.importado += falta - hay;
      }
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
  }

  /** Barrels a state's terminals can still take: some days of what its pipelines don't bring. */
  #cabeEn(estado: string): number {
    const hueco = this.abasto?.hueco.get(estado) ?? 0;
    return Math.max(0, barrilesEn(hueco, 24 * DIAS_POR_SURTIR) - (this.#inventarios.get(estado) ?? 0));
  }

  /**
   * Leave fuel where it's lacking (never back at the refinery it came from).
   * A port that also supplies its neighbours (Progreso the peninsula,
   * Mazatlán Nayarit) shares what comes off by the room each one has.
   */
  #descargarCombustible(u: Tren | Barco, destino: string) {
    if (u.combustible <= 0) return;
    const propio = SITIOS_POR_CLAVE.get(destino)?.estado;
    if (!propio) return;
    const origen = u.combustibleDe;
    if (origen && (destino === `refineria:${origen}` || REFINERIA_DEL_PUERTO.get(destino) === origen)) return;
    const cabe = estadosQueSurte(destino, propio).map((e) => [e, this.#cabeEn(e)] as const);
    const total = cabe.reduce((s, [, c]) => s + c, 0);
    const baja = Math.min(u.combustible, total);
    if (baja < 1) return;
    const cuenta = this.#cuentaDe(String(añoDe(this.horas)));
    const modo = u.tipo === 'tren' ? 'tren' : 'barco';
    for (const [estado, c] of cabe) {
      const parte = (baja * c) / total;
      if (parte <= 0) continue;
      this.#inventarios.set(estado, (this.#inventarios.get(estado) ?? 0) + parte);
      this.#cuentaEstado(cuenta, estado)[modo] += parte;
    }
    cuenta.pais[modo] += baja;
    u.entregadoCombustible += baja;
    u.combustible -= baja;
    if (u.combustible < 1) {
      u.combustible = 0;
      u.combustibleDe = null;
    }
  }

  /**
   * Load fuel at a refinery: a train at its station or at its port (the
   * coastal ones'), a tanker at its port, up to `tope` barrels aboard. A
   * vehicle carries one refinery's fuel at a time.
   */
  #cargarCombustible(u: Tren | Barco, destino: string, tope: number) {
    const id = destino.startsWith('refineria:') ? destino.slice('refineria:'.length) : REFINERIA_DEL_PUERTO.get(destino);
    if (!id || (u.tipo === 'barco' && u.clase !== 'tanque')) return;
    if (u.combustibleDe && u.combustibleDe !== id && u.combustible > 0) return;
    const hay = this.#patios.get(id) ?? 0;
    const sube = Math.min(hay, tope - u.combustible);
    if (sube < 1) return;
    this.#patios.set(id, hay - sube);
    u.combustible += sube;
    u.combustibleDe = id;
  }

  /** Fuel waiting in a refinery's yard, barrels. */
  enPatio(id: string): number {
    return this.#patios.get(id) ?? 0;
  }

  /** Fuel in a state's terminals that came by train or tanker, barrels. */
  enTerminales(estado: string): number {
    return this.#inventarios.get(estado) ?? 0;
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
    if (!estado) return;
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
