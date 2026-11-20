# Ruta Logística

Juego de logística en México: mover barcos y trenes y poner sitios sobre un mapa real del
país. Dos escalas de la misma geografía:

- **Mundo**: dónde está México. Las dos vistas de [`global`](https://github.com/Moibe/global)
  (Canvas 2D y Globo 3D) con México resaltado en ámbar y **los barcos navegando**, también en
  sus travesías a Shanghái y Róterdam. Clic en México (o *Entrar a México*) y la cámara vuela
  hasta el país y entra al tablero.
- **México**: el tablero, donde se juega. Estados, red ferroviaria real, puertos y ciudades,
  en la proyección cónica de Lambert del INEGI, con **trenes de carga** corriendo por las
  vías reales y **barcos** navegando rutas marítimas calculadas (por el Canal de Panamá de
  costa a costa, y hacia Asia y Europa por dos salidas al mundo), bajo un reloj de juego.
  Encima, los **32 Polos del Bienestar** declarados en el DOF, donde dicen sus declaratorias,
  esperando a que el jugador los construya.

**[Enciclopedia del juego](docs/enciclopedia.md)**: qué puertos, ciudades, vías, rutas y
servicios hay, de qué fuente sale cada dato, qué se corrigió a mano y las reglas de la simulación. Se
actualiza con cada cosa que entra al juego. También vive dentro del juego en `/enciclopedia` (el librito de
la esquina superior derecha, `ui/Libro.svelte`): `src/lib/enciclopedia.ts` importa el mismo archivo con `?raw` y lo
convierte con `marked`, así que basta editar el `.md`.

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
| `npm run datos` | Regenera geografía, red ferroviaria y rutas marítimas (~15 s)   |
| `npm run al-dia` | Revisa el DOF y la vigencia de las cifras reales (ver abajo)  |

## Vistas

| Ruta            | Stack             | Qué hace                                                                                     |
| --------------- | ----------------- | -------------------------------------------------------------------------------------------- |
| `/mexico`       | d3-geo + Canvas2D | El tablero con trenes y barcos. `/` redirige aquí: el juego es lo principal.                 |
| `/mundo/canvas` | d3-geo + Canvas2D | El mundo plano de `global` (tres proyecciones, mundo repetido, centrado en 130° O) con México en ámbar y los barcos. |
| `/mundo/globo`  | Threlte + three   | El globo de `global`, abre mirando a México; el país va relleno de puntos ámbar; los barcos. Solo cliente. |

### El tablero (`src/lib/map/MexicoMap.svelte`)

- **Proyección cónica conforme de Lambert, paralelos 17.5° y 29.5°, meridiano 102° O**: la
  del INEGI para todo el país. Conforme, así que bahías y estados se ven como en cualquier
  mapa oficial mexicano.
- Misma maquinaria que el mundo plano: la geometría se hornea en `Path2D` una sola vez y el
  zoom se aplica al contexto; pinta solo cuando algo cambia. Zoom hasta 40×.
- **El color significa algo** y las capas que vengan deben respetarlo: lo marítimo es cian
  (`--accent`), lo ferroviario es ámbar (`--warn`), las ciudades son tinta clara y los Polos
  del Bienestar rosa guinda (`POLO`), punteados mientras estén por construir.
- Capas: estados (con hover y clic para acercar), frontera terrestre punteada, costa como
  línea de luz, vías férreas (primarias más intensas y gruesas que secundarias; con
  durmientes a partir de 4×; estaciones sobre la vía a partir de 3.5×), puertos (rombo con halo; los cuatro principales más grandes), ciudades (anillo + punto
  para capitales), polos (hexágono punteado). Cada capa se apaga desde el panel.
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
  - **movimiento**: cada cuadro copia el fondo y dibuja encima los trenes, los barcos y la
    vista previa de ruta. Con la cámara quieta y el reloj corriendo, un cuadro es un
    `drawImage` y los vehículos.

  Medido con GPU en Chrome a 1600×900: 60 fps quieto, arrastrando y siguiendo un tren, con
  8 trenes y 6 barcos (en una prueba A/B, con y sin barcos, la diferencia es ruido).

### Trenes

- **La red es un grafo** (`domain/red.ts`): nodos en entronques, puntas y cambios de clase;
  tramos entre ellos. Al cargar, cada sitio a ≤ 15 km de una vía recibe **estación** en el
  punto más cercano de la vía en servicio (partiendo el tramo si hace falta). 59 de los 73
  sitios tienen estación; los demás muestran a cuántos km queda la vía (Acapulco, Cancún, La
  Paz…).
- **Cada vía tiene dueño, tráfico y capacidad** (`Red.vias`, de `datos/vias.json`): la
  concesionaria de 2018 o el Estado (de OpenStreetMap, corregido a 2018 y cotejado con el
  anuario de la ARTF), si estaba en servicio (3,590 km no: se ven punteados y no llevan trenes
  ni estaciones), los trenes privados al día (el promedio de su empresa o el de su corredor) y
  los que caben (16 en vía sencilla, 30 con control centralizado, 75 en doble). Las cifras y
  sus fuentes están en la [enciclopedia](docs/enciclopedia.md#dueños).
- **Saturación** (`domain/saturacion.ts`): los trenes del jugador se cuentan por su horario
  (`sim.trenesPorVia`); el uso de cada vía es privados + del jugador entre capacidad, y
  pasado el 60 % los trenes que la usan van más lento (60 % de su velocidad al 100 % de uso).
  Se recalcula al agregar o retirar un tren y al reconstruirse la red; la ruta de cada pierna
  guarda su vía por segmento (`Trayecto.vias`) y su velocidad libre (`velLibre`). El
  tablero pinta la red por clase, dueño o uso, y una vía al pasar el cursor dice todo eso.
- **Obras del Estado** (`domain/obrasVia.ts`, `datos/obras-via.json`, panel `CatalogoObras`):
  41 obras reales con trazo oficial, sin trazo libre. Vía nueva (los 8 tramos del Tren Maya y
  Dos Bocas, trazo de OpenStreetMap), doble vía paralela del Estado (las 13 líneas de
  pasajeros), modernización (Interoceánico Z, FA y K) y rehabilitación (16 líneas muertas). Se
  construyen como los polos (1 a 4 cuadrillas; 4 = costo y tiempo oficiales, con su fuente).
  Al terminarse, `construirRed(json, sitios, polos, hechas)` las pone en la red, nacen
  estaciones y `sim` rehace la ruta de cada tren (`#rerutear`) con `costoConUso`: el tiempo
  con el uso actual de cada vía, prefiriendo la del Estado. Cada obra se mide una vez sobre la
  red de 2018 (`sim.medidas`): sus km y las líneas que dibuja el tablero.
- **Dos clases de vía**: primaria (`scalerank` ≤ 6 de Natural Earth, 60 km/h) y secundaria
  (40 km/h). La ruta es la **más rápida**, no la más corta (Dijkstra por tiempo): un tren toma
  la troncal aunque un ramal sea más directo, como lo haría un despachador.
- **Un tren** (`domain/trenes.ts`) corre un servicio de ida y vuelta entre sus paradas
  (A → B → C → B → A…), con 3 h de carga en las terminales y 1 h en paradas intermedias. La
  función de avance es pura y va tramo por tramo, porque la velocidad cambia con la clase de
  vía. Mide 1.8 km (~100 carros); en pantalla nunca menos de 18 px.
- **El reloj** (`state/simulacion.svelte.ts`): 1× = 1 h de juego por segundo; pausa, ¼×, 1×,
  4× y 16×; la barra espaciadora pausa. Corre mientras haya una vista del juego montada (el
  tablero o cualquiera de las dos del mundo).
- **8 servicios iniciales** sobre corredores reales: Manzanillo–Guadalajara–CDMX, Lázaro
  Cárdenas–SLP–Monterrey–Nuevo Laredo, Veracruz–Puebla–CDMX, CDMX–Querétaro–Torreón–
  Chihuahua–Cd. Juárez, Guadalajara–Mazatlán–Hermosillo–Nogales, Altamira–Monterrey, el Istmo
  (Coatzacoalcos–Salina Cruz) y Coatzacoalcos–Mérida–Progreso.
- **Interfaz**: lista de trenes a la izquierda (clic para volar al tren), ficha a la derecha
  (próxima parada, hora de llegada, velocidad, recorrido; *Seguir* con la cámara; *Retirar*
  con confirmación en la misma ficha) y **＋ Nuevo tren**: clic en estaciones del mapa, en
  orden; la ruta se dibuja mientras eliges y *Despachar* (o Enter) lo pone a correr.
  Retroceso quita la última parada, Esc cancela.

### Barcos

- **Rutas marítimas calculadas** (`domain/mar.ts`), una por cada par de puertos y salidas:
  ver [Datos](#datos). Por mar de Salina Cruz a Coatzacoalcos hay 4,825 km (por Panamá);
  por tren, 274: el Istmo en números, tal como es.
- **Cuatro clases** (`domain/barcos.ts`): portacontenedores y ro-ro a 18 nudos, buque tanque
  a 14, granelero a 13; cada una con su tiempo en puerto. En el Canal, 9 km/h.
- **Servicios circulares** (A → B → C → A), como las líneas de navieras. Una **salida al
  mundo** (Asia, Europa) es, como escala, su **puerto lejano** (Shanghái-Yangshan, Róterdam):
  la pierna sigue de la salida por la **travesía oceánica** calculada, el barco la navega a su
  velocidad y hace 48 h de escala allá. Cada pierna sabe qué parte cae en el tablero
  (`Trayecto.enTablero`); el tablero dibuja solo esa parte y deja de ver al barco al pasar la
  salida (`enTravesia()`, `posicionEnTablero()`).
- **6 barcos iniciales**: Shanghái–Manzanillo–Lázaro Cárdenas, Róterdam–Veracruz–Altamira,
  los combustibles del Pacífico desde Salina Cruz y los del Golfo, autos de costa a costa por
  Panamá y graneles de Guaymas a Shanghái. Nombres inventados de la geografía de México.
- **Un motor de servicios común** (`domain/servicio.ts`) para trenes y barcos: cambia cómo se
  traza cada pierna y cuánto se espera, el paso de simulación es el mismo.
- **En el tablero**: casco con proa orientado al rumbo y estela; el Canal de Panamá trazado en
  cian; las dos salidas como un anillo con flecha. La lista tiene pestañas Trenes / Barcos, y
  *＋ Nuevo* en la pestaña Barcos pide la clase y las escalas (puertos o salidas). Con un barco
  elegido que pasa la salida, la cámara que lo seguía se queda esperándolo ahí y su ficha
  ofrece **Ver en el globo**.

### Mundo

- **Canvas** (`CanvasMap.svelte`): México se dibuja encima del mundo con la misma geometría
  detallada del tablero. Al volar hacia él, el relleno cambia al color de tierra del tablero,
  así el aterrizaje en `/mexico` continúa la imagen en vez de cortarla. Las tres
  proyecciones van **rotadas a 130° O**: México al centro, Asia a la izquierda, Europa a la
  derecha, y las dos travesías enteras (Shanghái queda libre del panel de barcos).
- **Globo** (`GlobeScene.svelte`): México va como contorno ámbar más una malla de puntos
  (`dotGrid`, por barrido de líneas, no un `geoContains` por punto: dos órdenes de magnitud
  más rápido). Rellenar polígonos sobre la esfera exigiría subdividir triángulos. El clic
  sobre México (que no sea el final de un arrastre: `event.delta`) lanza el vuelo de cámara:
  la dirección hace *slerp* y la distancia baja, y al terminar navega al tablero. La costa
  sube a 50m cuando la cámara baja de 2 radios (la tierra contra la que se auditan las
  travesías).
- **Barcos en las dos vistas**: el circuito de cada barco como línea tenue de su color (el
  elegido se ilumina), casco orientado al rumbo con brillo y estela, Shanghái y Róterdam
  marcados. Reloj y lista de barcos (`<Flota vista="mundo">`) como en el tablero: clic en un
  barco (mapa o lista) lo elige y vuela hasta él, *Seguir* lo mantiene al centro. En el globo
  la capa vive en `GlobeBarcos.svelte`: objetos de three armados a mano y movidos en su lugar
  cada cuadro, tamaño constante en pantalla (escala = unidades por píxel a la altura de la
  cámara), selección por distancia en pantalla como en los mapas planos y etiquetas con el
  `<HTML>` de Threlte ocultas tras el océano.

## Datos

Todo es local en `static/data/` y `src/lib/domain/`: sin tiles, sin proveedor, sin API key.

| Archivo                              | Qué es                                                                         |
| ------------------------------------ | ------------------------------------------------------------------------------ |
| `static/data/land-*.json`, `countries-110m.json` | Mundo, de `world-atlas` (heredado de `global`)                     |
| `static/data/mexico.topo.json`       | Estados y países vecinos en un solo TopoJSON (~350 KB)                         |
| `static/data/red-ferroviaria.json`   | La red como grafo: 198 nodos, 231 tramos, ~19,200 km (~210 KB)                 |
| `static/data/rutas-maritimas.json`   | 136 rutas por mar entre puertos y salidas, el trazo del Canal y las 2 travesías oceánicas (~51 KB) |
| `src/lib/domain/datos/ciudades.json` | 58 ciudades: capitales estatales, toda ciudad >300 mil hab. y nodos logísticos |
| `src/lib/domain/datos/puertos.json`  | Los **15 puertos, curados a mano**                                             |
| `src/lib/domain/datos/puertas.json`  | Las **2 salidas al mundo** (Asia, Europa) con su puerto lejano y océano, a mano |
| `src/lib/domain/datos/polos.json`    | Los **32 Polos del Bienestar**, sacados una vez de sus declaratorias en el DOF  |
| `src/lib/domain/datos/obras-via.json` | **Catálogo de obras del Estado**: trazos, paradas o líneas, costo por km y tiempo oficiales, con fuentes |
| `src/lib/domain/datos/energia.json`  | **Electricidad**: regiones (CENACE) con demanda y márgenes oficiales, centrales de 2018, privadas con su fecha (permisos de la CNE), centrales de la CFE para construir, MW de los polos; con fuentes |
| `src/lib/domain/datos/presupuesto.json` | **Presupuesto del Estado**: lo federal para ferrocarriles por año (2019–2027) y los ingresos de las concesionarias, con fuentes |
| `src/lib/domain/datos/vias.json`     | **Dueño y estado de cada tramo**, trenes privados por empresa y por corredor, capacidades; con fuentes |

`npm run datos` (`scripts/datos-mexico.mjs`) regenera los cuatro primeros desde **Natural
Earth 10m**, fijado a un commit de `nvkelso/natural-earth-vector`. Baja ~85 MB una sola vez a
`.cache/ne/` (ignorado por git). La lógica de atributos (nombres en español, qué ciudades
entran) es JS simple; mapshaper solo hace geometría: disolver, recortar, simplificar (~250 m)
y codificar TopoJSON. Los archivos generados se commitean: la app nunca necesita el script.

Los puertos van a mano porque la capa de puertos de Natural Earth no trae ni Lázaro Cárdenas
ni Altamira. Coordenadas de la terminal; los puertos de río (Altamira, Tampico, Tuxpan) y
Topolobampo, al fondo de una bahía, están en su bocana, que es a donde llega un barco. Están
en JSON (no en TS) porque el script los lee para calcular las rutas marítimas.

**Los Polos del Bienestar** (`polos.json`) no los genera `npm run datos`: se sacaron una vez
de sus declaratorias en el DOF (los tres programas: Corredor Interoceánico, Plan México y
economía circular, todos los declarados al 19 de noviembre de 2026). Cada declaratoria trae el
cuadro de construcción del terreno; se leyó con un programa, se cerró cada polígono y el polo
va en el centroide del mayor, comprobando el área contra la declarada y que caiga en su
estado. Las excepciones (dos en coordenadas TME sin meridiano, uno con el cuadro en imagen, uno
al pie de la frontera, dos erratas del DOF) y la tabla completa están en la
[enciclopedia](docs/enciclopedia.md#5-polos-del-bienestar). En el juego son sitios
(`polo:<id>`) que el jugador **construye**.

**El presupuesto del Estado** (`domain/presupuesto.ts`, `datos/presupuesto.json`): la partida
empieza el 1 de diciembre de 2018, el día en que empezó el sexenio (`domain/calendario.ts`), y
cada mes llega a `sim.dinero` una
doceava parte del presupuesto federal real para ferrocarriles de ese año (lo ejercido según la
Cuenta Pública de 2018 a 2025, lo aprobado en 2026, el proyecto de 2027, que se repite después)
más el derecho de las concesionarias (1.25 % de sus ingresos, 3 % desde 2027). Lo que no se
gasta se acumula; polos y vías salen de la misma caja. `sim.#cobrar` paga cada mes que empieza
y el panel `Erario` muestra lo que llegó. Las fichas avisan cuánto tardaría de verdad una obra
al paso del dinero (`mesesAlRitmoDelDinero`, con el calendario real de mensualidades). La
tabla por año y el método, en la [enciclopedia](docs/enciclopedia.md#el-presupuesto-del-estado).

**Dos modos** (`sim.modo`): *Juego* y *Realidad*, con el interruptor del reloj. En Realidad
(`domain/realidad.ts`, `datos/obras-via-real.json`, `datos/centrales-real.json`,
`datos/polos-real.json`) el tablero muestra cómo estaba de verdad cada obra de vía, cada central
de la CFE y cada polo (anunciada o declarado, en obra con su avance, en operación) hoy o en cualquier fecha desde el 1 de diciembre de 2018:
`sim.entrarRealidad()` guarda la partida, `sim.irA(horas)` pone la fecha, rehace la red cuando
cambia lo que está en operación y pone las centrales en su etapa real, y `sim.salirRealidad()`
devuelve la partida intacta. El reloj no corre, no hay flota y nada se paga. La capa de energía
pinta el margen de cada región con el modelo del juego y las centrales reales: es una
estimación y la leyenda lo dice. Los polos salen desde su declaratoria; de su
ocupación no hay datos, así que no piden energía ni tienen ramal. Los datos tienen fecha de corte (`corte`), que
el reloj muestra.

**La energía** (`domain/energia.ts`, `datos/energia.json`): el país en sus 9 regiones del
sistema eléctrico, más Mulegé, el sistema aislado del norte de Baja California Sur. Cada una
arranca el 1 de julio de 2019 con sus márgenes de reserva oficiales de la tarde y de la noche
(el de Mulegé lo calcula el juego); su demanda crece al ritmo real de 2018–2024 más lo que
piden los polos operando; su capacidad crece con las centrales privadas en su fecha real (lista
de permisos de la CNE) y con las centrales de la CFE que construye el jugador, cada tecnología
contada a su modo en cada pico (la solar no cuenta de noche, salvo con almacenamiento: la obra
puede traer su propio `aporte` por pico). `sim.energia` se recalcula una vez al día; si el
menor de los dos márgenes cae debajo del mínimo (6 %, 11 % en los sistemas aislados), los polos
de la región dejan de llenarse (`sim.hayEnergia`). Las centrales de la CFE están en el catálogo
de obras y se pagan de `sim.dineroCfe`, la caja de la CFE (26.4 mil millones al año en
mensualidades); las que no tienen costo oficial (las termosolares y el Proyecto Oasis de Baja
California Sur, Chicoasén II) lo llevan estimado, y la ficha lo dice. El tablero tiene la capa
*Energía*: estados por nivel de su región (Mulegé aparte, recortado con el contorno del estado) y
centrales por tecnología. Detalle en la [enciclopedia](docs/enciclopedia.md#la-energía).
Los datos se arman con `scripts/energia/gen-energia.cjs`, que lee la lista de permisos de la CNE
(resumida con `permisos_resumen.py`) y la tabla de centrales del PRODESEN transcrita, ubica cada
central en la cabecera de su municipio con el servicio del INEGI y toma de ahí mismo el límite
de Mulegé con Comondú y Loreto.

**Construir polos** (`domain/obras.ts`, estado en `sim.obras`): el jugador es el Estado y paga
con su presupuesto (`sim.dinero`, en millones de pesos). Desde la ficha de un polo (`FichaPolo`)
elige de 1 a 4 cuadrillas y confirma en un cuadro propio; la obra se paga conforme avanza
(`avanzarObra`, en el tick del reloj) y se detiene si se acaba el dinero. Al terminarse, si
hay vía a ≤ 15 km, la red se reconstruye con el polo en servicio (`construirRed(json, sitios,
polosEnServicio)`) y nace su estación (`sim.versionRed` avisa al tablero que re-hornee la
vía). Ya operando y con tren, se llena de empresas en tres años; los empleos (en obra y
permanentes) van al panel `Erario`. Las cifras salen de fuentes oficiales y viven en
`datos/calibracion.json`; la tabla y sus fuentes, en la
[enciclopedia](docs/enciclopedia.md#construirlos).

**Mantener el juego al día**: `npm run al-dia` (`scripts/al-dia.mjs`) busca en el DOF, desde la
fecha de corte de `calibracion.json` hasta hoy, los acuerdos sobre Polos del Bienestar que el
juego aún no revisó (partiendo el rango de fechas cuando hay más de diez resultados, porque la
paginación del buscador del DOF no funciona sin sesión de navegador), y marca las cifras de
calibración con más de seis meses sin revisarse y los años del presupuesto que ya deberían
tener una cifra mejor (Cuenta Pública, PEF o proyecto nuevos). `--desde aaaa-mm-dd` revisa otro
periodo. No cambia nada: dice qué revisar.

**Las rutas marítimas** se calculan sobre la misma tierra del tablero: malla de 0.05° (~5.5
km) donde una celda es tierra si su centro cae en tierra o si la toca una costa; el **Canal de
Panamá** se abre a mano sobre su trazo real; ruta más corta (Dijkstra) sin cortar esquinas
de tierra y con sobrecosto a menos de ~22 km de la costa; luego se **endereza** en tramos
rectos con un recorrido exacto de celdas, por corridas de mar y de canal que nunca se
mezclan. Una **auditoría** en una malla 5 veces más fina confirma que ninguna de las 136
rutas pisa tierra fuera de la entrada a cada puerto y del Canal.

**Las travesías oceánicas** (`scripts/travesias.mjs`, ~4 s) usan el mismo método sobre el
mundo: la tierra **50m** de `static/data/land-50m.json` (la que dibujan las vistas del mundo),
malla de 0.1° de 60° S a 75° N **que da la vuelta** en el antimeridiano (la travesía a Asia lo
cruza; los anillos que lo saltan se "desenvuelven" para que sigan cerrados en el plano), ruta
más corta lejos de la costa, enderezada en **arcos de círculo máximo** y auditada kilómetro a
kilómetro contra los polígonos 50m exactos. Asia → Shanghái: 11,407 km (6,159 mn); Europa →
Róterdam, por el Canal de la Mancha: 7,108 km (3,838 mn). El JSON guarda solo los vértices;
`mar.ts` densifica cada arco cada 50 km al cargar y continúa las longitudes más allá de ±180°
para que distancias e interpolación sigan siendo locales.

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
  datos-mexico.mjs   Natural Earth → mexico.topo.json + red-ferroviaria.json
                     + rutas-maritimas.json + ciudades.json
  travesias.mjs      las travesías oceánicas de cada salida, sobre la malla mundial
src/lib/
  domain/            TypeScript puro, sin nada de UI ni de render
    geo.ts           LonLat, distancia, interpolación por gran círculo, rumbo, lon/lat ↔ vec3
    sitios.ts        ciudades, puertos, salidas al mundo, polos y un registro común por clave
    obras.ts         construir polos: presupuesto, cuadrillas, avance, ocupación y empleos
    trayecto.ts      un recorrido como polilínea con velocidad por segmento; avanzar sobre él
    servicio.ts      el motor común: un vehículo recorriendo sus paradas (ida y vuelta o circuito)
    red.ts           grafo ferroviario, dueños y estado de cada vía, estaciones, ruta más rápida
    saturacion.ts    uso de cada vía (privados + trenes del jugador) y cuánto frena a los trenes
    obrasVia.ts      catálogo de obras del Estado: medirlas, presupuestarlas, avanzarlas
    calendario.ts    fechas del juego (desde el 1 de diciembre de 2018) y el mes de cada momento
    presupuesto.ts   el dinero del Estado: mensualidades por año y cuánto tarda una obra al paso del dinero
    energia.ts       regiones eléctricas: demanda, capacidad y márgenes; centrales de la CFE
    mar.ts           rutas marítimas, Canal de Panamá, travesías; compone la pierna completa
    trenes.ts        trenes y servicios iniciales
    barcos.ts        clases de barco, travesías, barcos y servicios iniciales
    datos/           datos (generados y curados)
  state/             estado reactivo compartido (runas)
    simulacion.svelte.ts   reloj, flota (trenes y barcos), selección
    tablero.svelte.ts      pestaña, modo "nuevo tren / nuevo barco" y pedidos de cámara
  map/
    world.ts         carga del mundo (110m / 50m)
    mexico.ts        carga de México: estados, país, costa vs. frontera, vías, vecinos
    CanvasMap.svelte     mundo plano (con los barcos)
    GlobeMap.svelte · GlobeScene.svelte · globeGeometry.ts   globo
    GlobeBarcos.svelte   los barcos sobre el globo
    MexicoMap.svelte     el tablero
  ui/
    ViewNav.svelte   las vistas, plegadas abajo a la izquierda: Mundo (Canvas · Globo) | México
    Reloj.svelte · Flota.svelte · Trazado.svelte · formato.ts   paneles (Reloj y Flota también en el mundo)
    Erario.svelte · FichaPolo.svelte   presupuesto y empleos; la ficha del polo y su construcción
    CatalogoObras.svelte   el catálogo de obras ferroviarias del Estado y la ficha de cada obra
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
- **Trenes y barcos son `$state.raw` y se mutan en su lugar**: el paso de simulación corre 60
  veces por segundo y hacer proxies profundos de sus rutas costaría más que todo el cuadro. Lo
  que deba re-renderizarse al moverse un vehículo lee además `sim.horas`, que cambia en cada
  tick.
- **Un `$effect` que mueve la cámara debe usar `untrack`.** Volar lee `transform`; si el
  efecto lo rastrea, cada cuadro del vuelo relanza el vuelo. Junto con un timestamp de rAF
  anterior al inicio del vuelo (avance negativo, que la interpolación geométrica del zoom
  convierte en *alejarse*), seguir un tren desplomaba el zoom hasta 10⁻¹⁰. Por eso el avance
  del vuelo se acota a [0, 1] y `setTransform` acota el zoom: d3 solo lo limita en gestos.
- **El mar no va en la capa**: es un degradado fijo a la pantalla, y en una capa que se desliza
  "brincaría" cada vez que la capa se repinta.
- **Rasterizar con un margen de fila.** Las coordenadas vienen redondeadas a 1e-5 y muchos
  vértices caen justo en el centro de una fila de la malla; repartidos por fila sin holgura,
  el error de punto flotante sacaba bordes de su fila, se perdía un cruce, la paridad se
  invertía y aparecía una franja falsa de "tierra" en el mar (la auditoría la marcaba en las
  Bahamas). Se reparte con una fila de margen y decide la prueba exacta de cruce.
- **La línea de vista recorre celdas, no muestrea.** Muestrear la recta saltaba la esquina de
  una celda de tierra; el recorrido exacto (Amanatides–Woo) con la malla conservadora
  garantiza que una recta no cruza tierra.
- **Cada puerto entra al mar abierto**, no a la celda de agua más cercana: una bahía de boca
  angosta queda sellada a esta escala y su agua no conecta con nada.
- **Longitudes más allá de ±180° en las travesías.** La de Asia llega a −238° (Shanghái):
  `kmEntre` y `lerp` restan longitudes directamente, así que la polilínea tiene que ser
  continua. d3-geo normaliza al proyectar y `toVector3` es periódica, así que dibujarlas no
  necesita nada; lo que sí: partir la estela en el mapa plano donde salta de borde a borde.
- **El mapa plano está rotado**: `projection([-180, 0])` ya no es el borde del mundo. El
  ancho del mundo repetido sale de `path.bounds({ type: 'Sphere' })`.
- **En el globo, las tareas del escenario corren en cada cuadro; solo el render es bajo
  demanda.** La tarea de barcos no se auto-invalida: pide cuadro (`invalidate()`) solo
  mientras el reloj corre, así un globo en pausa no dibuja a 60 fps.
- **Seguir en el globo se suelta arrastrando, no con la rueda**: el evento `start` de
  OrbitControls también salta con la rueda, así que `GlobeMap` mira el arrastre en el DOM.
- **En Windows el watcher a veces no ve archivos nuevos** (un `+page.ts` recién creado no
  entró al manifiesto de rutas). Si una ruta nueva no se comporta como dice su código:
  `npx svelte-kit sync` y reiniciar el dev server.

## Siguiente

- **Construir.** La red base es la anterior a 2018 a propósito: lo que se construyó de
  2018 en adelante (el Tren Maya, las líneas nuevas del Corredor Interoceánico…) lo
  construye el jugador. Las rutas ya se calculan sobre la red, así que una vía nueva las
  cambia sola. Construir vía es lo que llena los polos que no la tienen (Chetumal, Cancún,
  Tuxpan…). Ya están el catálogo de obras del Estado y su presupuesto real.
- **Energía, segunda capa**: las refinerías (las seis del sistema nacional y la Olmeca) como
  origen de carga, junto con la carga. Y el Plan de Expansión de la CFE 2026–2030 (52 proyectos)
  en el catálogo, cuando se publique la lista por central: sin él, de 2028 en adelante varias
  regiones se quedan sin margen.
- **Más dinero del Estado**, con la carga: lo que cobran los trenes del Estado, lo que pagan
  sus trenes por pasar por vía privada y los impuestos de las concesionarias.
- **Carga**: qué lleva cada tren y cada barco (contenedores, granel, autos, combustibles),
  cuánto cabe y quién lo demanda; hoy corren sus servicios sin carga. El puerto es donde
  barco y tren se pasan la carga.
- **Sitios**: que el jugador pueda colocar los suyos (bodegas, plantas, terminales), además de
  los polos.
