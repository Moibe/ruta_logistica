import { distanceKm } from './geo';
import { rutaMar, VELOCIDAD_CANAL, type Mar } from './mar';
import { armarMarcha, type Marcha } from './servicio';
import { segmentoEn } from './trayecto';
import { puerta, type Puerta } from './sitios';

/**
 * Ships: a service (`servicio.ts`) run as a loop along the sea lanes, the way
 * liner services work. A stop is a port or a gateway; sailing out through a
 * gateway puts the ship on an ocean crossing off the map — to Shanghái or
 * Róterdam and back — for as long as that really takes.
 */

export type ClaseBarco = 'contenedores' | 'tanque' | 'granel' | 'roro';

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
};

export const KM_POR_MILLA = 1.852;
/** Real ocean routes run longer than the great circle between their ends. */
const RODEO = 1.1;
/** Days in port at the far end of a crossing (unload and reload). */
const ESTANCIA_LEJANA_H = 48;

export const kmhDe = (clase: ClaseBarco) => CLASES_BARCO[clase].nudos * KM_POR_MILLA;

/** Hours off the map through a gateway: across, a port call there, and back. */
export function horasFuera(p: Puerta, clase: ClaseBarco): number {
  return (2 * distanceKm(p.lonLat, p.haciaLonLat) * RODEO) / kmhDe(clase) + ESTANCIA_LEJANA_H;
}

export type Barco = Marcha & {
  tipo: 'barco';
  id: string;
  nombre: string;
  color: string;
  clase: ClaseBarco;
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
    espera: (destino) => {
      const p = puerta(destino);
      return p ? horasFuera(p, def.clase) : CLASES_BARCO[def.clase].enPuerto;
    },
    zarpando: def.zarpando,
    desfase: def.desfase,
  });
  if (!marcha) return null;
  return { ...marcha, tipo: 'barco', id: def.id, nombre: def.nombre, color: def.color, clase: def.clase };
}

/** On an ocean crossing beyond a gateway: not on the board at all. */
export function fueraDelMapa(b: Barco): boolean {
  return b.estado === 'parada' && puerta(b.destinos[b.pierna]) !== null;
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
 * Cruz and Gulf refineries; one car carrier goes coast to coast through
 * Panama — the long way round that the isthmus railway exists to shortcut.
 * All start under way, `desfase` hours out of their first stop.
 */
export const SERVICIOS_BARCO: ServicioBarco[] = [
  { clase: 'contenedores', paradas: ['puerta:asia', 'puerto:manzanillo', 'puerto:lazaro-cardenas'], desfase: 22 },
  { clase: 'contenedores', paradas: ['puerta:europa', 'puerto:veracruz', 'puerto:altamira'], desfase: 30 },
  {
    clase: 'tanque',
    paradas: ['puerto:salina-cruz', 'puerto:lazaro-cardenas', 'puerto:manzanillo', 'puerto:mazatlan', 'puerto:guaymas'],
    desfase: 10,
  },
  { clase: 'tanque', paradas: ['puerto:coatzacoalcos', 'puerto:dos-bocas', 'puerto:progreso'], desfase: 6 },
  { clase: 'roro', paradas: ['puerto:lazaro-cardenas', 'puerto:veracruz'], desfase: 70 },
  { clase: 'granel', paradas: ['puerto:guaymas', 'puerta:asia'], desfase: 18 },
];
