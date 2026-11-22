// Builds the sea trade of the board's ports: what each one exports and imports by sea, by kind of
// cargo, how much of it moves by rail, and what each class of ship carries per call.
//
//   node scripts/comercio/gen-comercio-mar.mjs
//
// Self-contained: the figures were read once from SEMAR's port yearbook 2024 (one PDF per port,
// «Serie histórica del movimiento de carga» and «Resumen anual de carga operada») and ATTRAPI's rail
// yearbook 2025 (tables A12 and A13), and live here as data.
//
// Writes src/lib/domain/datos/comercio-mar.json.

import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const FUENTES = {
  'semar-puertos-2024': {
    fuente:
      'SEMAR, Anuario Estadístico de los Puertos de México 2024: lo que cada puerto importó y exportó en 2024 por tipo de carga (contenerizada, granel agrícola y mineral, general suelta) y en cuántos barcos',
    url: 'https://www.gob.mx/asuntosmaritimosyportuarios/documentos/anuario-estadistico-de-los-puertos-de-mexico-2024',
  },
  'attrapi-2025': {
    fuente: 'ATTRAPI, Anuario Estadístico Ferroviario 2025, tablas A12 y A13: carga de importación y de exportación por tren en cada puerto',
    url: 'https://www.gob.mx/cms/uploads/attachment/file/1100990/Anuario_2025.pdf',
  },
  juego: { fuente: 'Estimación del juego', url: '' },
};

/** SEMAR 2024, tonnes by sea: contenedores = general contenerizada; granel = agrícola + mineral; general = general suelta (autos and the rest). */
const PUERTOS = {
  ensenada: { exp: { contenedores: 523238, granel: 0, general: 4432 }, imp: { contenedores: 1616419, granel: 20000, general: 521324 } },
  guaymas: { exp: { contenedores: 67333, granel: 2385999, general: 0 }, imp: { contenedores: 53892, granel: 275038, general: 23842 } },
  topolobampo: { exp: { contenedores: 0, granel: 0, general: 0 }, imp: { contenedores: 0, granel: 756261, general: 97934 } },
  mazatlan: { exp: { contenedores: 220446, granel: 0, general: 44967 }, imp: { contenedores: 201437, granel: 0, general: 885065 } },
  manzanillo: { exp: { contenedores: 6273187, granel: 1445493, general: 826 }, imp: { contenedores: 17307022, granel: 2961628, general: 2070873 } },
  'lazaro-cardenas': { exp: { contenedores: 4124989, granel: 1240820, general: 1374946 }, imp: { contenedores: 9995257, granel: 7893973, general: 1494959 } },
  'salina-cruz': { exp: { contenedores: 0, granel: 21802, general: 0 }, imp: { contenedores: 0, granel: 13215, general: 69494 } },
  'puerto-chiapas': { exp: { contenedores: 90573, granel: 27000, general: 0 }, imp: { contenedores: 7642, granel: 0, general: 0 } },
  altamira: { exp: { contenedores: 3265380, granel: 869460, general: 996163 }, imp: { contenedores: 3885900, granel: 3724801, general: 4537623 } },
  tampico: { exp: { contenedores: 141953, granel: 436138, general: 99846 }, imp: { contenedores: 30686, granel: 344597, general: 1105782 } },
  tuxpan: { exp: { contenedores: 211863, granel: 0, general: 147125 }, imp: { contenedores: 67205, granel: 1931398, general: 146863 } },
  veracruz: { exp: { contenedores: 3118294, granel: 68832, general: 1352032 }, imp: { contenedores: 7442534, granel: 12259757, general: 1670271 } },
  coatzacoalcos: { exp: { contenedores: 89897, granel: 149083, general: 267215 }, imp: { contenedores: 14227, granel: 2355887, general: 354913 } },
  'dos-bocas': { exp: { contenedores: 0, granel: 216283, general: 101 }, imp: { contenedores: 0, granel: 12000, general: 1857 } },
  progreso: { exp: { contenedores: 328277, granel: 17678, general: 31993 }, imp: { contenedores: 290174, granel: 3626721, general: 85787 } },
};

/** ATTRAPI 2025, millions of tonnes that left or entered the country by rail through each port. */
const TREN = {
  exp: { guaymas: 0.59, mazatlan: 0.39, coatzacoalcos: 0.35, veracruz: 0.34, tampico: 0.21, 'lazaro-cardenas': 0.21, manzanillo: 0.2, altamira: 0.12, topolobampo: 0.1 },
  imp: { veracruz: 8.25, manzanillo: 4.89, 'lazaro-cardenas': 1.73, altamira: 1.5, coatzacoalcos: 1.07, tampico: 0.46, guaymas: 0.15, mazatlan: 0.15, topolobampo: 0.12 },
};

const suma = (o) => Object.values(o).reduce((s, v) => s + v, 0);
const puertos = Object.fromEntries(
  Object.entries(PUERTOS).map(([id, p]) => {
    const exp = suma(p.exp);
    const imp = suma(p.imp);
    const trenExp = (TREN.exp[id] ?? 0) * 1e6;
    const trenImp = (TREN.imp[id] ?? 0) * 1e6;
    // What reaches the port for export by rail comes on the player's trains; the rest by road, on its own.
    const kinds = Object.keys(p.exp);
    const principal = kinds.reduce((a, b) => (p.exp[b] > p.exp[a] ? b : a), kinds[0]);
    return [
      id,
      {
        exp: p.exp,
        imp: p.imp,
        trenExp,
        trenImp,
        /** The kind a train's export cargo becomes at this port: the one it exports most. */
        deTren: exp > 0 ? principal : 'granel',
        /** Share of its exports that comes by road (the rest, by rail). */
        caminoExp: exp > 0 ? Number(Math.max(0, 1 - trenExp / exp).toFixed(4)) : 0,
        /** Share of its imports that leaves by rail. */
        trenImpParte: imp > 0 ? Number(Math.min(1, trenImp / imp).toFixed(4)) : 0,
      },
    ];
  })
);

const datos = {
  corte: '2026-11-22',
  nota: 'Generado por scripts/comercio/gen-comercio-mar.mjs.',
  fuentes: FUENTES,
  puertos,
  puertosDato: {
    dato:
      'Lo que cada puerto exportó e importó por mar en 2024, en toneladas: contenedores (carga contenerizada), granel (agrícola y mineral) y carga general (suelta: los autos y lo demás). Qué parte entra o sale por tren: la de la ATTRAPI de 2025 entre la de la SEMAR de 2024 (estimación del juego).',
    fuentes: ['semar-puertos-2024', 'attrapi-2025'],
  },
  barcos: {
    contenedores: { carga: 'contenedores', toneladas: 13972 },
    granel: { carga: 'granel', toneladas: 29920 },
    roro: { carga: 'general', toneladas: 8000 },
    dato:
      'Lo que lleva un barco por escala: el promedio de 2024 en los puertos de altura, 13,972 toneladas por portacontenedores (59.4 millones en 4,249 barcos) y 29,920 por granelero (43.1 millones en 1,439). Para los ro-ro de autos la SEMAR no da barcos: 8,000 toneladas, unos 6,000 autos, es estimación del juego.',
    fuentes: ['semar-puertos-2024', 'juego'],
  },
  reglas: {
    diasPatio: 30,
    diasInicio: 7,
    dato: 'Reglas del juego: en un puerto espera hasta un mes de su exportación y de su importación por tren; la partida abre con una semana.',
    fuentes: ['juego'],
  },
};

await writeFile(join(ROOT, 'src', 'lib', 'domain', 'datos', 'comercio-mar.json'), JSON.stringify(datos, null, 1) + '\n');
for (const [id, p] of Object.entries(puertos)) console.log(id.padEnd(16), 'camión exp', p.caminoExp, '· tren imp', p.trenImpParte, '· de tren →', p.deTren);
