import { rutaMar, VELOCIDAD_CANAL, type Mar } from './mar';
import { armarMarcha, type Marcha } from './servicio';
import { segmentoEn } from './trayecto';
import { puerta, type Puerta } from './sitios';

/**
 * Ships: a service (`servicio.ts`) run as a loop along the sea lanes, the way
 * liner services work. A stop is a port or a gateway; a gateway stands for a
 * far port (Shanghái, Róterdam), and the leg to it runs on past the edge of the
 * board along its ocean crossing — sailed for real, at the ship's speed, and
 * shown on the world views.
 */

export type ClaseBarco = 'contenedores' | 'tanque' | 'granel' | 'roro' | 'abastecedor';

export type DatosClase = {
  nombre: string;
  /** Service speed, knots: a commercial average, not the hull's maximum. */
  nudos: number;
  /** Hours in each port. */
  enPuerto: number;
};

/**
 * Speeds follow logistica-oceanica's classes (Neopanamax 22 kn, feeder 18,
 * tanker 15, bulk 14) taken down a little to the slow-steaming averages ships
 * actually keep.
 */
export const CLASES_BARCO: Record<ClaseBarco, DatosClase> = {
  contenedores: { nombre: 'Portacontenedores', nudos: 18, enPuerto: 18 },
  tanque: { nombre: 'Buque tanque', nudos: 14, enPuerto: 24 },
  granel: { nombre: 'Granelero', nudos: 13, enPuerto: 36 },
  roro: { nombre: 'Ro-ro de autos', nudos: 18, enPuerto: 14 },
  /** Offshore supply vessel: from the supply bases to the platforms (`plataformas.ts`). */
  abastecedor: { nombre: 'Barco abastecedor', nudos: 12, enPuerto: 8 },
};

export const KM_POR_MILLA = 1.852;
/**
 * Hours at the far port of a crossing, whatever the class: unloading and
 * loading at Shanghái or Róterdam, where the cargo isn't the game's business.
 */
export const ESTANCIA_LEJANA_H = 48;

export const kmhDe = (clase: ClaseBarco) => CLASES_BARCO[clase].nudos * KM_POR_MILLA;

export type Barco = Marcha & {
  tipo: 'barco';
  id: string;
  nombre: string;
  color: string;
  clase: ClaseBarco;
  /**
   * Fuel aboard (barrels), the refinery it came from, and the barrels it has
   * delivered so far. Only tankers carry it (`combustibles.ts`).
   */
  combustible: number;
  combustibleDe: string | null;
  entregadoCombustible: number;
  /** Imported fuel aboard for the coastwise trade (barrels), the hub it was loaded at, and what it has delivered so far. */
  combustibleImp: number;
  combustibleImpDe: string | null;
  entregadoImp: number;
  /** Supplies aboard and delivered so far (tonnes): only supply vessels carry them. */
  abasto: number;
  entregadoAbasto: number;
  /**
   * Trade aboard (`comercioMar.ts`), tonnes: exports loaded at Mexican ports
   * (and the port each part came from), for the next gateway, and imports
   * loaded at a gateway, for the ports that ask for them. Container ships,
   * bulk carriers and car carriers only, each with its kind of cargo.
   */
  exportacion: number;
  exportacionDe: Record<string, number>;
  importacion: number;
  /** Tonnes it has exported (delivered at a gateway) and imported (delivered at a port) so far. */
  exportado: number;
  importado: number;
};

/** Cool tints only: cyan is the sea colour, the warm ones belong to the trains. */
export const COLORES_BARCO = ['#4cc9ff', '#2dd4bf', '#8fa8ff', '#c7f0ff', '#67e8f9', '#60a5fa', '#a5b4fc', '#99f6e4'];

/**
 * Ship names from Mexican seas and coasts. Made up for the game: none is (or
 * pretends to be) a real ship.
 */
export const NOMBRES_BARCO = [
  'Mar de Cortés',
  'Cabo Corrientes',
  'Arrecife Alacranes',
  'Isla Tiburón',
  'Bahía de Banderas',
  'Laguna de Términos',
  'Banco Chinchorro',
  'Islas Marías',
  'Revillagigedo',
  'Sonda de Campeche',
  'Cabo Catoche',
  'Golfo de Tehuantepec',
  'Isla del Carmen',
  'Punta Xicalango',
  'Laguna Mecoacán',
  'Barra de Tupilco',
  'Río Grijalva',
  'Isla Aguada',
  'Champotón',
  'Sabancuy',
];

export type NuevoBarco = {
  id: string;
  nombre: string;
  color: string;
  clase: ClaseBarco;
  paradas: string[];
  /** Start under way out of the first stop instead of loading there. */
  zarpando?: boolean;
  desfase?: number;
};

export function crearBarco(mar: Mar, def: NuevoBarco): Barco | null {
  const kmh = kmhDe(def.clase);
  const marcha = armarMarcha({
    paradas: def.paradas,
    recorrido: 'circular',
    ruta: (a, b) => rutaMar(mar, a, b, kmh),
    espera: (destino) => (puerta(destino) ? ESTANCIA_LEJANA_H : CLASES_BARCO[def.clase].enPuerto),
    zarpando: def.zarpando,
    desfase: def.desfase,
  });
  if (!marcha) return null;
  return {
    ...marcha,
    tipo: 'barco',
    id: def.id,
    nombre: def.nombre,
    color: def.color,
    clase: def.clase,
    // Every ship loads and unloads at its stops: the clock hands its arrivals to the simulation.
    llegadas: marcha.estado === 'parada' ? [marcha.pierna] : [],
    combustible: 0,
    combustibleDe: null,
    entregadoCombustible: 0,
    combustibleImp: 0,
    combustibleImpDe: null,
    entregadoImp: 0,
    abasto: 0,
    entregadoAbasto: 0,
    exportacion: 0,
    exportacionDe: {},
    importacion: 0,
    exportado: 0,
    importado: 0,
  };
}

/**
 * Beyond a gateway, off the board: crossing the ocean out (`ida`), at the far
 * port (`alla`) or crossing back (`vuelta`).
 */
export type Travesia = { puerta: Puerta; tramo: 'ida' | 'alla' | 'vuelta' };

export function enTravesia(b: Barco): Travesia | null {
  const n = b.destinos.length;
  if (b.estado === 'parada') {
    const p = puerta(b.destinos[b.pierna]);
    return p ? { puerta: p, tramo: 'alla' } : null;
  }
  const [desde, hasta] = b.piernas[b.pierna].enTablero;
  if (b.km > hasta) {
    const p = puerta(b.destinos[b.pierna]);
    return p ? { puerta: p, tramo: 'ida' } : null;
  }
  if (b.km < desde) {
    // The leg started at the gateway the previous one ended at.
    const p = puerta(b.destinos[(b.pierna - 1 + n) % n]);
    return p ? { puerta: p, tramo: 'vuelta' } : null;
  }
  return null;
}

/** Off the Mexico board, on the other side of a gateway. */
export function fueraDelMapa(b: Barco): boolean {
  return enTravesia(b) !== null;
}

/** Going through the Panama Canal right now. */
export function enElCanal(b: Barco): boolean {
  if (b.estado !== 'ruta') return false;
  const leg = b.piernas[b.pierna];
  return leg.vel[segmentoEn(leg, b.km)] === VELOCIDAD_CANAL;
}

// ---- the opening fleet ---------------------------------------------------------------------

export type ServicioBarco = { clase: ClaseBarco; paradas: string[]; desfase: number };

/**
 * Services the board starts with. The liner loops call where those trades
 * really call (Asia at Manzanillo and Lázaro Cárdenas, Europe at Veracruz and
 * Altamira); the tankers run the coastal fuel distribution out of the Salina
 * Cruz and Gulf refineries; the bulk carrier takes Sonora's minerals and grain
 * to Asia; one car carrier brings Asia's cars to both coasts, going through
 * Panama from one to the other — the long way round that the isthmus railway
 * exists to shortcut. All start under way, `desfase` hours out of their first
 * stop.
 */
export const SERVICIOS_BARCO: ServicioBarco[] = [
  { clase: 'contenedores', paradas: ['puerta:asia', 'puerto:manzanillo', 'puerto:lazaro-cardenas'], desfase: 22 },
  { clase: 'contenedores', paradas: ['puerta:europa', 'puerto:veracruz', 'puerto:altamira'], desfase: 30 },
  // Acapulco imports nothing (it got 1.23 million tonnes coastwise in 2018): the Pacific tanker calls there first.
  {
    clase: 'tanque',
    paradas: ['puerto:salina-cruz', 'puerto:acapulco', 'puerto:lazaro-cardenas', 'puerto:manzanillo', 'puerto:mazatlan', 'puerto:guaymas'],
    desfase: 10,
  },
  { clase: 'tanque', paradas: ['puerto:coatzacoalcos', 'puerto:dos-bocas', 'puerto:progreso'], desfase: 6 },
  { clase: 'roro', paradas: ['puerto:lazaro-cardenas', 'puerto:veracruz', 'puerta:asia'], desfase: 70 },
  { clase: 'granel', paradas: ['puerto:guaymas', 'puerta:asia'], desfase: 18 },
  // Supply vessels to the offshore complexes, from Dos Bocas (the big base) and Ciudad del Carmen,
  // enough for what each complex took in 2018 with some to spare (`plataformas.ts`), spread over their loop.
  ...[0, 5, 10, 15, 20, 25].map((desfase) => ({ clase: 'abastecedor' as const, paradas: ['puerto:dos-bocas', 'plataforma:ku-maloob-zaap'], desfase })),
  ...[2, 12].map((desfase) => ({ clase: 'abastecedor' as const, paradas: ['puerto:dos-bocas', 'plataforma:litoral-de-tabasco'], desfase })),
  { clase: 'abastecedor', paradas: ['puerto:ciudad-del-carmen', 'plataforma:abkatun-pol-chuc'], desfase: 4 },
  { clase: 'abastecedor', paradas: ['puerto:ciudad-del-carmen', 'plataforma:cantarell'], desfase: 9 },
];
