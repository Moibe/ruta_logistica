# Ruta Logística

Juego de logística en México: mover barcos y trenes y poner sitios sobre un mapa real del
país. Dos escalas de la misma geografía:

- **Mundo**: dónde está México. Las dos vistas de [`global`](https://github.com/Moibe/global)
  (Canvas 2D y Globo 3D) con México resaltado en ámbar. Clic en México (o *Entrar a México*)
  y la cámara vuela hasta el país y entra al tablero.
- **México**: el tablero, donde se juega. Estados, red ferroviaria real, puertos y ciudades,
  en la proyección cónica de Lambert del INEGI, con **trenes de carga** corriendo por las
  vías reales bajo un reloj de juego.

**[Enciclopedia del juego](docs/enciclopedia.md)**: qué puertos, ciudades, vías y servicios
hay, de qué fuente sale cada dato, qué se corrigió a mano y las reglas de la simulación. Se
actualiza con cada cosa que entra al juego; más adelante será una página web.

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
| `npm run datos` | Regenera la geografía y la red ferroviaria desde Natural Earth  |

## Vistas

| Ruta            | Stack             | Qué hace                                                                                     |
| --------------- | ----------------- | -------------------------------------------------------------------------------------------- |
| `/mexico`       | d3-geo + Canvas2D | El tablero con los trenes. `/` redirige aquí: el juego es lo principal.                      |
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
  línea de luz, vías férreas (primarias más intensas y gruesas que secundarias; con
  durmientes a partir de 4×; estaciones sobre la vía a partir de 3.5×), puertos (rombo con halo; los cuatro principales más grandes), ciudades (anillo + punto
  para capitales). Cada capa se apaga desde el panel.
- Etiquetas con colisión: cada una prueba cuatro posiciones alrededor de su punto y gana la
  de mayor prioridad (puertos > capital del país > capitales > ciudades por población >
  estados > mares y países). Una ciudad portuaria (Veracruz, Mazatlán…) se etiqueta una sola
  vez, por su puerto.
- Clic en un estado vuela a encuadrarlo; clic en un puerto o ciudad vuela hacia él.
  *Reencuadrar* regresa al país completo.
- **Tres capas de pintado**, porque ahora hay cosas que se mueven:
  - **capa**: geografía y vías, en un lienzo fuera de pantalla 256 px más grande que la vista
    por cada lado. Mientras el zoom no cambie y la cámara no se salga del margen (arrastrar,
    seguir un tren) se reutiliza desplazada; el brillo de la costa cuesta más que todo lo
    demás junto.
  - **fondo**: mar (fijo a la pantalla), la capa desplazada, sitios, estaciones y etiquetas.
    Se repinta solo cuando algo cambia.
  - **movimiento**: cada cuadro copia el fondo y dibuja encima los trenes y la vista previa de
    ruta. Con la cámara quieta y el reloj corriendo, un cuadro es un `drawImage` y los trenes.

  Medido con GPU en Chrome a 1600×900: 60 fps quieto, arrastrando y siguiendo un tren.

### Trenes

- **La red es un grafo** (`domain/red.ts`): nodos en entronques, puntas y cambios de clase;
  tramos entre ellos. Al cargar, cada sitio a ≤ 15 km de una vía recibe **estación** en el
  punto más cercano de la vía (partiendo el tramo si hace falta). 60 de los 73 sitios tienen
  estación; los demás muestran a cuántos km queda la vía (Acapulco, Cancún, La Paz…).
- **Dos clases de vía**: primaria (`scalerank` ≤ 6 de Natural Earth, 60 km/h) y secundaria
  (40 km/h). La ruta es la **más rápida**, no la más corta (Dijkstra por tiempo): un tren toma
  la troncal aunque un ramal sea más directo, como lo haría un despachador.
- **Un tren** (`domain/trenes.ts`) corre un servicio de ida y vuelta entre sus paradas
  (A → B → C → B → A…), con 3 h de carga en las terminales y 1 h en paradas intermedias. La
  función de avance es pura y va tramo por tramo, porque la velocidad cambia con la clase de
  vía. Mide 1.8 km (~100 carros); en pantalla nunca menos de 18 px.
- **El reloj** (`state/simulacion.svelte.ts`): 1× = 1 h de juego por segundo; pausa, ¼×, 1×,
  4× y 16×; la barra espaciadora pausa. Corre solo mientras el tablero está montado.
- **8 servicios iniciales** sobre corredores reales: Manzanillo–Guadalajara–CDMX, Lázaro
  Cárdenas–SLP–Monterrey–Nuevo Laredo, Veracruz–Puebla–CDMX, CDMX–Querétaro–Torreón–
  Chihuahua–Cd. Juárez, Guadalajara–Mazatlán–Hermosillo–Nogales, Altamira–Monterrey, el Istmo
  (Coatzacoalcos–Salina Cruz) y Coatzacoalcos–Mérida–Progreso.
- **Interfaz**: lista de trenes a la izquierda (clic para volar al tren), ficha a la derecha
  (próxima parada, hora de llegada, velocidad, recorrido; *Seguir* con la cámara; *Retirar*
  con confirmación en la misma ficha) y **＋ Nuevo tren**: clic en estaciones del mapa, en
  orden; la ruta se dibuja mientras eliges y *Despachar* (o Enter) lo pone a correr.
  Retroceso quita la última parada, Esc cancela.

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
| `static/data/mexico.topo.json`       | Estados y países vecinos en un solo TopoJSON (~350 KB)                         |
| `static/data/red-ferroviaria.json`   | La red como grafo: 198 nodos, 231 tramos, ~19,200 km (~210 KB)                 |
| `src/lib/domain/datos/ciudades.json` | 58 ciudades: capitales estatales, toda ciudad >300 mil hab. y nodos logísticos |
| `src/lib/domain/sitios.ts`           | Tipos de sitio, las ciudades tipadas y los **15 puertos, curados a mano**      |

`npm run datos` (`scripts/datos-mexico.mjs`) regenera los tres primeros desde **Natural Earth
10m**, fijado a un commit de `nvkelso/natural-earth-vector`. Baja ~85 MB una sola vez a
`.cache/ne/` (ignorado por git). La lógica de atributos (nombres en español, qué ciudades
entran) es JS simple; mapshaper solo hace geometría: disolver, recortar, simplificar (~250 m)
y codificar TopoJSON. Los archivos generados se commitean: la app nunca necesita el script.

Los puertos van a mano porque la capa de puertos de Natural Earth no trae ni Lázaro Cárdenas
ni Altamira, los más grandes del país. Coordenadas de la terminal; los puertos de río
(Altamira, Tampico, Tuxpan) están en su bocana, que es a donde llegará un barco.

**La red ferroviaria** viene de la capa de Norteamérica de Natural Earth, que a su vez sale del
*Atlas Ambiental de América del Norte* de la CEC (Comisión para la Cooperación Ambiental de
México, EUA y Canadá). El `scalerank` es una clasificación cartográfica de Natural Earth (a qué
escala merece dibujarse una línea), no la de los operadores, pero sigue de cerca los
corredores troncales. Es de alrededor de 2010: no trae el Tren Maya ni otras obras recientes.
El script:

- **Recorta en la frontera terrestre, no en la costa**: la máscara es México crecido 3 km
  mar adentro menos los vecinos. Recortar con el contorno costero de 10m tiraba puentes y
  calzadas sobre agua (así se perdió el cruce Guaymas–Empalme).
- **Agrega a mano dos tramos que la fuente omite** (`VIAS_A_MANO`, cada uno documentado):
  Cuyutlán–Manzanillo, por la barra de la Laguna de Cuyutlán (la fuente deja al puerto de
  contenedores más grande del país a 34 km de la vía), y el ramal del puerto de Altamira.
- **Suelda puntas sueltas** a ≤ 1.6 km de otra vía (huecos de la fuente: uno, en Mérida),
  descarta pedazos de menos de 10 km y reporta los componentes: la red nacional (18,874 km)
  y tres líneas que en la realidad solo conectan con EUA (Tijuana–Tecate, Agua Prieta–
  Nacozari, Naco–Cananea).

## Arquitectura

```
scripts/
  datos-mexico.mjs   Natural Earth → mexico.topo.json + red-ferroviaria.json + ciudades.json
src/lib/
  domain/            TypeScript puro, sin nada de UI ni de render
    geo.ts           LonLat, distancia, interpolación por gran círculo, rumbo, lon/lat ↔ vec3
    sitios.ts        ciudades, puertos y un registro común por clave (`puerto:veracruz`)
    red.ts           grafo ferroviario, estaciones, ruta más rápida, avanzar sobre una ruta
    trenes.ts        tren, paso de simulación, servicios iniciales
    datos/           datos generados
  state/             estado reactivo compartido (runas)
    simulacion.svelte.ts   reloj, flota, selección
    tablero.svelte.ts      modo "nuevo tren" y pedidos de cámara de los paneles al mapa
  map/
    world.ts         carga del mundo (110m / 50m)
    mexico.ts        carga de México: estados, país, costa vs. frontera, vías, vecinos
    CanvasMap.svelte     mundo plano
    GlobeMap.svelte · GlobeScene.svelte · globeGeometry.ts   globo
    MexicoMap.svelte     el tablero
  ui/
    ViewNav.svelte   navegación: Mundo (Canvas · Globo) | México
    Reloj.svelte · Flota.svelte · Trazado.svelte · formato.ts   paneles del tablero
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
- **Los trenes son `$state.raw` y se mutan en su lugar**: el paso de simulación corre 60 veces
  por segundo y hacer proxies profundos de sus rutas costaría más que todo el cuadro. Lo que
  deba re-renderizarse al moverse un tren lee además `sim.horas`, que cambia en cada tick.
- **Un `$effect` que mueve la cámara debe usar `untrack`.** Volar lee `transform`; si el
  efecto lo rastrea, cada cuadro del vuelo relanza el vuelo. Junto con un timestamp de rAF
  anterior al inicio del vuelo (avance negativo, que la interpolación geométrica del zoom
  convierte en *alejarse*), seguir un tren desplomaba el zoom hasta 10⁻¹⁰. Por eso el avance
  del vuelo se acota a [0, 1] y `setTransform` acota el zoom: d3 solo lo limita en gestos.
- **El mar no va en la capa**: es un degradado fijo a la pantalla, y en una capa que se desliza
  "brincaría" cada vez que la capa se repinta.
- **En Windows el watcher a veces no ve archivos nuevos** (un `+page.ts` recién creado no
  entró al manifiesto de rutas). Si una ruta nueva no se comporta como dice su código:
  `npx svelte-kit sync` y reiniciar el dev server.

## Siguiente

- **Construir vías.** La red base es la anterior a 2018 a propósito: lo que se construyó de
  2018 en adelante (el Tren Maya, las líneas nuevas del Corredor Interoceánico…) lo
  construye el jugador. Las rutas ya se calculan sobre la red, así que una vía nueva las
  cambia sola.
- **Carga**: qué lleva cada tren (contenedores, granel, autos), cuánto cabe y quién lo
  demanda; hoy los trenes corren su servicio sin carga.
- **Barcos**: rutas entre puertos por mar, y de puertos del mundo a México en las vistas
  globales (Asia → Manzanillo / Lázaro Cárdenas).
- **Sitios**: que el jugador pueda colocar los suyos (bodegas, plantas, terminales).
