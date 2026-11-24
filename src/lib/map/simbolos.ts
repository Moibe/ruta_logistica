/**
 * The board's colours and glyphs that more than the map uses: the layers
 * panel draws each layer's button with the same mark the map draws.
 */

/** Polos del Bienestar: the programme's pink-guinda, lightened to read over the dark sea. */
export const POLO = '#f472b6';
/** Cargo airports: periwinkle, apart from ports (cyan), polos (pink) and plants. */
export const AEROPUERTO = '#a5b4fc';
/** The big private industries: a lime green, apart from the gas pipelines' pale green and the rail's amber. */
export const INDUSTRIA = '#bef264';
/** The big mines: stone grey, apart from every other mark. */
export const MINERIA = '#d6d3d1';
/** Refineries: crude's own brown-gold, apart from the plants' orange and the exits' amber. */
export const REFINERIA = '#e0a458';
/** Gas pipelines: a pale green, apart from the sea's cyan and the rail's amber. Petroleum ones in the refineries' brown-gold, crude darker. */
export const GAS = '#6ee7b7';
export const CRUDO = '#c2672a';
/** Fuel's own amber, a step lighter than the refineries' brown-gold. */
export const COMBUSTIBLE = '#f5b971';
/** Offshore complexes: a salmon orange, between crude's brown and the fuel's amber. */
export const PLATAFORMA = '#f0a27a';

/** A plane seen from above, nose up, in a unit box: right half, mirrored for the left. */
const MEDIO_AVION: [number, number][] = [
  [0, -1], [0.13, -0.8], [0.13, -0.28], [1, 0.18], [1, 0.36], [0.13, 0.12], [0.13, 0.62], [0.42, 0.84], [0.42, 1], [0, 0.9],
];
export const PUNTOS_AVION: [number, number][] = [
  ...MEDIO_AVION,
  ...MEDIO_AVION.slice(1, -1)
    .reverse()
    .map(([x, y]) => [-x, y] as [number, number]),
];
export const AVION_SVG = 'M' + PUNTOS_AVION.map(([x, y]) => `${x} ${y}`).join(' L') + ' Z';

/** A drop of oil, point up, in a unit box. */
export const GOTA_SVG = 'M0 -1.15 C0.35 -0.55 0.85 -0.05 0.85 0.35 A0.85 0.85 0 0 1 -0.85 0.35 C-0.85 -0.05 -0.35 -0.55 0 -1.15 Z';

/**
 * Track coloured by who runs it. The State's own railways are ink-white — they are the player's;
 * the concessionaires each get a hue of their own, none of them the sea's cyan or the polos' rose.
 */
export const COLOR_DUEÑO: Record<string, string> = {
  FXE: '#f59e0b',
  KCSM: '#a78bfa',
  FSRR: '#4ade80',
  LCD: '#f87171',
  FTVM: '#94a3b8',
  FIT: '#f4f1de',
  ADMICARGA: '#f4f1de',
  EST: '#ffffff',
};
/** Track coloured by use: room to spare, busy (trains slow down), over capacity. */
export const COLOR_USO = { holgada: '#4ade80', cargada: '#fbbf24', saturada: '#f87171' } as const;
