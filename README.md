# Ruta Logística

Juego de logística en México: mover barcos y trenes y poner sitios sobre un mapa real del
país. Dos escalas de la misma geografía:

- **Mundo**: dónde está México. Las dos vistas de [`global`](https://github.com/Moibe/global)
  (Canvas 2D y Globo 3D) con México resaltado en ámbar. Clic en México (o *Entrar a México*)
  y la cámara vuela hasta el país y entra al tablero.
- **México**: el tablero, donde se juega. Estados, red ferroviaria real, puertos y ciudades,
  en la proyección cónica de Lambert del INEGI.

Scaffold basado en `global`, que a su vez salió de
[`logistica-oceanica`](https://github.com/Moibe/logistica-oceanica): mismo stack, misma
paleta, mismas versiones mayores (Kit 2, TypeScript 6, Vite 8, three 0.185), para que el
código pase de un proyecto a otro sin migraciones.

Stack: SvelteKit 2 + Svelte 5 en modo runes + TypeScript + d3-geo / d3-zoom para los mapas
planos y Threlte 8 / three para el globo. Canvas a pantalla completa con paneles de vidrio
flotando encima.

## Arranque

```sh
npm install
npm run dev   # http://localhost:4800
```

El puerto es fijo (`strictPort`): si el 4800 está ocupado el dev server falla en vez de
saltar al siguiente libre.

| Comando         | Qué hace                                                        |
| --------------- | --------------------------------------------------------------- |
| `npm run dev`   | Servidor de desarrollo                                          |
| `npm run build` | Build de producción (`adapter-auto`, sin destino de deploy aún) |
| `npm run check` | `svelte-check` sobre todo el proyecto                           |
| `npm run datos` | Regenera la geografía de México desde Natural Earth (ver abajo) |

## Vistas

| Ruta            | Stack             | Qué hace                                                                                     |
| --------------- | ----------------- | -------------------------------------------------------------------------------------------- |
| `/mexico`       | d3-geo + Canvas2D | El tablero. `/` redirige aquí: el juego es lo principal.                                     |
| `/mundo/canvas` | d3-geo + Canvas2D | El mundo plano de `global` (tres proyecciones, mundo repetido) con México en ámbar.          |
| `/mundo/globo`  | Threlte + three   | El globo de `global`, abre mirando a México; el país va relleno de puntos ámbar. Solo cliente. |

### El tablero (`src/lib/map/MexicoMap.svelte`)

- **Proyección cónica conforme de Lambert, paralelos 17.5° y 29.5°, meridiano 102° O**: la
  del INEGI para todo el país. Conforme, así que bahías y estados se ven como en cualquier
  mapa oficial mexicano.
- Misma maquinaria que el mundo plano: la geometría se hornea en `Path2D` una sola vez y el
  zoom se aplica al contexto; pinta solo cuando algo cambia. Zoom hasta 40×.
- **El color significa algo** y las capas que vengan deben respetarlo: lo marítimo es cian
  (`--accent`), lo ferroviario es ámbar (`--warn`), las ciudades son tinta clara.
- Capas: estados (con hover y clic para acercar), frontera terrestre punteada, costa como
  línea de luz, vías férreas (troncales más gruesas que ramales; con durmientes a partir de
  4×), puertos (rombo con halo; los cuatro principales más grandes), ciudades (anillo + punto
  para capitales). Cada capa se apaga desde el panel.
- Etiquetas con colisión: cada una prueba cuatro posiciones alrededor de su punto y gana la
  de mayor prioridad (puertos > capital del país > capitales > ciudades por población >
  estados > mares y países). Una ciudad portuaria (Veracruz, Mazatlán…) se etiqueta una sola
  vez, por su puerto.
- Clic en un estado vuela a encuadrarlo; clic en un puerto o ciudad vuela hacia él.
  *Reencuadrar* regresa al país completo.

### Mundo

- **Canvas** (`CanvasMap.svelte`): México se dibuja encima del mundo con la misma geometría
  detallada del tablero. Al volar hacia él, el relleno cambia al color de tierra del tablero,
  así el aterrizaje en `/mexico` continúa la imagen en vez de cortarla.
- **Globo** (`GlobeScene.svelte`): México va como contorno ámbar más una malla de puntos
  (`dotGrid`, por barrido de líneas, no un `geoContains` por punto: dos órdenes de magnitud
  más rápido). Rellenar polígonos sobre la esfera exigiría subdividir triángulos. El clic
  sobre México (que no sea el final de un arrastre: `event.delta`) lanza el vuelo de cámara:
  la dirección hace *slerp* y la distancia baja, y al terminar navega al tablero.

## Datos

Todo es local en `static/data/` y `src/lib/domain/`: sin tiles, sin proveedor, sin API key.

| Archivo                              | Qué es                                                                         |
| ------------------------------------ | ------------------------------------------------------------------------------ |
| `static/data/land-*.json`, `countries-110m.json` | Mundo, de `world-atlas` (heredado de `global`)                     |
| `static/data/mexico.topo.json`       | Estados, vías férreas y países vecinos en un solo TopoJSON (~460 KB)           |
| `src/lib/domain/datos/ciudades.json` | 58 ciudades: capitales estatales, toda ciudad >300 mil hab. y nodos logísticos |
| `src/lib/domain/sitios.ts`           | Tipos de sitio, las ciudades tipadas y los **15 puertos, curados a mano**      |

`npm run datos` (`scripts/datos-mexico.mjs`) regenera los dos primeros desde **Natural Earth
10m**, fijado a un commit de `nvkelso/natural-earth-vector`. Baja ~85 MB una sola vez a
`.cache/ne/` (ignorado por git). La lógica de atributos (nombres en español, qué ciudades
entran) es JS simple; mapshaper solo hace geometría: disolver, recortar, simplificar (~250 m)
y codificar TopoJSON. Los archivos generados se commitean: la app nunca necesita el script.

Los puertos van a mano porque la capa de puertos de Natural Earth no trae ni Lázaro Cárdenas
ni Altamira, los más grandes del país. Coordenadas de la terminal; los puertos de río
(Altamira, Tampico, Tuxpan) están en su bocana, que es a donde llegará un barco.

La red ferroviaria son ~19,000 km y casi toda forma un solo componente conectado: es la base
para que los trenes busquen ruta por vías reales.

## Arquitectura

```
scripts/
  datos-mexico.mjs   Natural Earth → mexico.topo.json + ciudades.json
src/lib/
  domain/            TypeScript puro, sin nada de UI ni de render
    geo.ts           LonLat, distancia, interpolación por gran círculo, rumbo, lon/lat ↔ vec3
    sitios.ts        ciudades, puertos y su relación
    datos/           datos generados
  map/
    world.ts         carga del mundo (110m / 50m)
    mexico.ts        carga de México: estados, país, costa vs. frontera, vías, vecinos
    CanvasMap.svelte     mundo plano
    GlobeMap.svelte · GlobeScene.svelte · globeGeometry.ts   globo
    MexicoMap.svelte     el tablero
  ui/
    ViewNav.svelte   navegación: Mundo (Canvas · Globo) | México
```

La regla heredada: **`domain/` no conoce ningún renderer.** Un barco o un tren devolverá
`[lon, lat]`; cada vista decide cómo dibujarlo. Así el tablero, el mundo plano y el globo no
pueden discrepar sobre dónde está algo.

## Detalles que conviene no romper

Los de `global` siguen aplicando (rellenar polígonos pero trazar costas como líneas,
`optimizeDeps.include`, three fijo en 0.185, `feature()` devuelve `FeatureCollection`, la
costa del mundo solo sube de resolución). Además:

- **Los vecinos salen del mismo archivo admin-1 que los estados**, disueltos por país, no de
  un archivo de países. Así el lado estadounidense, guatemalteco y beliceño de la frontera
  tiene exactamente los vértices de México, mapshaper los convierte en arcos compartidos, y
  `mexico.ts` puede separar **costa** (arco usado por un solo polígono) de **frontera** (arco
  compartido entre un estado y un vecino). Con `world-atlas` los dos lados difieren unos
  cientos de metros, no se comparte nada y toda la frontera se dibuja como costa.
- **El recorte de vecinos (`-134…-64, 0…46`) es mucho más grande que lo que la cámara del
  tablero puede ver (`REGION`, `-127…-77, 7…37`)**. Un polígono recortado tiene un borde
  recto a lo largo de la caja, y ese borde nunca debe entrar en pantalla.
- **`merge()` de topojson-client devuelve una geometría `MultiPolygon`, no un `Feature`.**
  `geoPath` y `geoContains` tragan las dos, pero el código que toca `.geometry` truena.
- **`cssHash` en `svelte.config.js`.** En Windows, `npm` puede arrancar el dev server con
  `cwd = c:\…` mientras el pre-bundler de Vite entrega rutas `C:\…`. Svelte vuelve relativa la
  ruta con un `startsWith` sensible a mayúsculas, así que una librería pre-empaquetada
  (el `<Canvas>` de Threlte) recibía una clase CSS en el servidor y otra en el navegador: el
  globo salía aplastado arriba de la pantalla al entrar directo por URL, sin un solo error.
  El `cssHash` hashea una ruta normalizada. Además el globo es solo cliente (`ssr = false`).
- **El favicon va en `app.html`**, no en el layout: la ruta del globo es solo cliente y el
  navegador pide `/favicon.ico` antes de que exista cualquier `<link>` insertado en cliente.
- **En Windows el watcher a veces no ve archivos nuevos** (un `+page.ts` recién creado no
  entró al manifiesto de rutas). Si una ruta nueva no se comporta como dice su código:
  `npx svelte-kit sync` y reiniciar el dev server.

## Siguiente

- Reloj de simulación (traer `simulation.svelte.ts` de `logistica-oceanica`) y volver al loop
  continuo en el tablero cuando algo se mueva.
- **Trenes**: grafo a partir de las vías (los extremos ya coinciden en el TopoJSON), ruta más
  corta entre estaciones, trenes avanzando por vía real.
- **Barcos**: rutas entre puertos por mar, y de puertos del mundo a México en las vistas
  globales (Asia → Manzanillo / Lázaro Cárdenas).
- **Sitios**: que el jugador pueda colocar los suyos (bodegas, plantas, terminales).
