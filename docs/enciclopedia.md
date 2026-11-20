# Enciclopedia de Ruta Logística

Referencia de lo que hay en el juego: qué contiene, de dónde sale cada dato, qué se corrigió a
mano y por qué, y con qué reglas se mueve. Por ahora es un documento; más adelante será una
página web del juego.

> **Cifras al 19 de noviembre de 2026** (commit `ed8076a`). No están escritas de memoria: se
> calcularon ejecutando el mismo código del juego que usa el tablero (`domain/red.ts`,
> `domain/trenes.ts`, `domain/sitios.ts`). Si cambian los datos, se recalculan.

**Contenido**

1. [Fuentes](#1-fuentes)
2. [Geografía](#2-geografía)
3. [Puertos](#3-puertos)
4. [Ciudades](#4-ciudades)
5. [Red ferroviaria](#5-red-ferroviaria)
6. [Servicios de tren](#6-servicios-de-tren)
7. [Reglas de la simulación](#7-reglas-de-la-simulación)
8. [Decisiones de diseño](#8-decisiones-de-diseño)
9. [Bitácora de correcciones a los datos](#9-bitácora-de-correcciones-a-los-datos)
10. [Glosario](#10-glosario)

---

## 1. Fuentes

| Fuente | Qué aporta al juego | Versión | Licencia |
| --- | --- | --- | --- |
| [Natural Earth](https://www.naturalearthdata.com/) 1:10m | Estados, países vecinos, vías férreas y ciudades del tablero de México | Repositorio `nvkelso/natural-earth-vector`, commit `ca96624` del 2 de junio de 2022 (versión 5.2.0-pre) | Dominio público |
| Atlas Ambiental de América del Norte, de la CCA (Comisión para la Cooperación Ambiental de México, Estados Unidos y Canadá) | Origen de las vías férreas de Norteamérica que trae Natural Earth (así lo registra la bitácora de cambios de Natural Earth); reúne cartografía de INEGI, USGS y Natural Resources Canada | Red de alrededor de 2010 | A través de Natural Earth |
| [world-atlas](https://github.com/topojson/world-atlas) | Contornos del mundo para las vistas globales (tierra a 110m y 50m, países a 110m) | 2.0.2, que redistribuye Natural Earth 4.1.0 en TopoJSON | ISC (los datos, dominio público) |
| Curaduría propia | Los 15 puertos, dos tramos de vía, nombres en español, abreviaturas de estados y varias correcciones (ver la [bitácora](#9-bitácora-de-correcciones-a-los-datos)) | — | Del proyecto |
| INEGI (convención cartográfica) | Parámetros de la proyección del tablero: cónica conforme de Lambert, paralelos 17.5° y 29.5°, meridiano central 102° O | — | — |

Herramientas que procesan los datos (no aportan datos): mapshaper 0.7.101 (MPL-2.0) para
disolver, recortar y simplificar la geometría; d3-geo 3.1.2 y topojson-client 3.1.0 (ISC)
para proyectar y decodificar; three 0.185.1 y Threlte 8.7.0 (MIT) para el globo.

**Cómo se generan.** `npm run datos` (`scripts/datos-mexico.mjs`) descarga las capas de
Natural Earth una sola vez a `.cache/ne/`, fijadas al commit de arriba, y produce:

| Archivo | Contenido |
| --- | --- |
| `static/data/mexico.topo.json` | Estados y países vecinos, en un solo TopoJSON que comparte arcos |
| `static/data/red-ferroviaria.json` | La red ferroviaria como grafo: nodos y tramos |
| `src/lib/domain/datos/ciudades.json` | Las 58 ciudades |

Los puertos no salen del script: viven a mano en `src/lib/domain/sitios.ts`.

Capas de Natural Earth que se usan: `ne_10m_admin_1_states_provinces` (estados y vecinos),
`ne_10m_railroads` (vías) y `ne_10m_populated_places_simple` (ciudades). Se consultó
también `ne_10m_ports`, pero se descartó: no trae ni Lázaro Cárdenas ni Altamira.

---

## 2. Geografía

### Proyección

El tablero usa la **cónica conforme de Lambert** con paralelos estándar 17.5° y 29.5° y
meridiano central 102° O, la convención del INEGI para mapas de todo el país. Al ser
conforme, conserva las formas locales: bahías, costas y estados se ven como en cualquier mapa
oficial mexicano. Las vistas del mundo usan otras proyecciones (equirrectangular, Natural
Earth, Mercator) y el globo no usa ninguna.

### Cifras del contorno

Medidas sobre los datos del juego (escala 1:10m simplificada a ~250 m), no son cifras
oficiales:

| | km |
| --- | ---: |
| Costa (incluye islas) | 15,537 |
| Frontera terrestre (EUA, Guatemala, Belice) | 3,689 |
| Límites entre estados | 16,008 |

### Estados (32)

| Clave | Estado | Abreviatura |
| --- | --- | --- |
| AGS | Aguascalientes | Ags. |
| BC | Baja California | B.C. |
| BCS | Baja California Sur | B.C.S. |
| CAMP | Campeche | Camp. |
| CHIS | Chiapas | Chis. |
| CHIH | Chihuahua | Chih. |
| CDMX | Ciudad de México | CDMX |
| COAH | Coahuila | Coah. |
| COL | Colima | Col. |
| DGO | Durango | Dgo. |
| MEX | Estado de México | Méx. |
| GTO | Guanajuato | Gto. |
| GRO | Guerrero | Gro. |
| HGO | Hidalgo | Hgo. |
| JAL | Jalisco | Jal. |
| MICH | Michoacán | Mich. |
| MOR | Morelos | Mor. |
| NAY | Nayarit | Nay. |
| NL | Nuevo León | N.L. |
| OAX | Oaxaca | Oax. |
| PUE | Puebla | Pue. |
| QRO | Querétaro | Qro. |
| QROO | Quintana Roo | Q. Roo |
| SLP | San Luis Potosí | S.L.P. |
| SIN | Sinaloa | Sin. |
| SON | Sonora | Son. |
| TAB | Tabasco | Tab. |
| TAMPS | Tamaulipas | Tamps. |
| TLAX | Tlaxcala | Tlax. |
| VER | Veracruz | Ver. |
| YUC | Yucatán | Yuc. |
| ZAC | Zacatecas | Zac. |

### Países vecinos

Se dibujan de fondo, un paso atrás de México: Estados Unidos, Guatemala y Belice (con
frontera terrestre) y, en el horizonte, Honduras, El Salvador, Cuba y el resto del Caribe y
Centroamérica. Vienen del mismo archivo que los estados (ver la
[bitácora](#9-bitácora-de-correcciones-a-los-datos)) y se recortan a una caja de
-134° a -64° de longitud y 0° a 46° de latitud, mucho más grande de lo que la cámara del
tablero puede ver, para que el borde del recorte nunca aparezca en pantalla.

---

## 3. Puertos

Los **15 puertos se curaron a mano**: la capa de puertos de Natural Earth no trae Lázaro
Cárdenas (el segundo del país en contenedores) ni Altamira (el cuarto). Las coordenadas son las de
la terminal; en los puertos de río (Altamira, Tampico, Tuxpan) el marcador va en la bocana,
que es a donde llegará un barco.

★ = principal: los cuatro puertos que mueven la mayor parte de los contenedores del país
(Manzanillo, Lázaro Cárdenas, Veracruz, Altamira). En el mapa llevan un rombo más grande.

| Puerto | Estado | Litoral | Lat, lon | Tren |
| --- | --- | --- | --- | --- |
| Ensenada | Baja California | Pacífico | 31.855, -116.625 | Sin vía (a 68 km) |
| Guaymas | Sonora | Pacífico | 27.915, -110.860 | Estación |
| Topolobampo | Sinaloa | Pacífico | 25.600, -109.050 | Estación |
| Mazatlán | Sinaloa | Pacífico | 23.195, -106.405 | Estación a 4.2 km |
| Manzanillo ★ | Colima | Pacífico | 19.065, -104.305 | Estación |
| Lázaro Cárdenas ★ | Michoacán | Pacífico | 17.945, -102.175 | Estación |
| Salina Cruz | Oaxaca | Pacífico | 16.165, -95.195 | Estación |
| Puerto Chiapas | Chiapas | Pacífico | 14.705, -92.405 | Estación a 12.5 km |
| Altamira ★ | Tamaulipas | Golfo | 22.480, -97.840 | Estación |
| Tampico | Tamaulipas | Golfo | 22.258, -97.780 | Estación a 6.4 km |
| Tuxpan | Veracruz | Golfo | 20.955, -97.280 | Sin vía (a 99 km) |
| Veracruz ★ | Veracruz | Golfo | 19.205, -96.135 | Estación |
| Coatzacoalcos | Veracruz | Golfo | 18.140, -94.410 | Estación |
| Dos Bocas | Tabasco | Golfo | 18.430, -93.180 | Sin vía (a 89 km) |
| Progreso | Yucatán | Golfo | 21.285, -89.665 | Estación |

"Estación" sin distancia significa que la vía pasa a 3 km o menos.

### Notas por puerto

- **Ensenada** — Puerto de Baja California. La única vía de la península en los datos
  (Tijuana–Tecate) no llega aquí ni conecta con la red nacional.
- **Guaymas** — Llega el tren por Empalme, cruzando la bahía. Ese cruce se había perdido al
  recortar las vías con la costa y se recuperó (ver bitácora).
- **Topolobampo** — Extremo del Pacífico de la línea Chihuahua al Pacífico.
- **Mazatlán** — Sobre la línea del Pacífico (Guadalajara–Nogales).
- **Manzanillo ★** — El puerto de contenedores más grande de México. La fuente dejaba su vía
  a 34 km del puerto; el tramo Cuyutlán–Manzanillo se trazó a mano (ver bitácora).
- **Lázaro Cárdenas ★** — El segundo en contenedores. Arranque del corredor hacia Nuevo
  Laredo.
- **Salina Cruz** — Extremo del Pacífico del Istmo de Tehuantepec.
- **Puerto Chiapas** — La estación más lejana de su sitio: la vía de la costa de Chiapas pasa
  a 12.5 km, tierra adentro.
- **Altamira ★** — Puerto industrial, cuarto en contenedores. El ramal ferroviario a la
  dársena se trazó a mano (ver bitácora).
- **Tampico** — Puerto de río, sobre el Pánuco; el marcador está en la desembocadura.
- **Tuxpan** — Puerto de río; el marcador está en la barra. Sin vía en los datos.
- **Veracruz ★** — El tercero en contenedores y el puerto más antiguo del país.
- **Coatzacoalcos** — Extremo del Golfo del Istmo de Tehuantepec y arranque de la línea hacia
  la península de Yucatán.
- **Dos Bocas** — Puerto petrolero de Tabasco. Sin vía en los datos.
- **Progreso** — El puerto de Mérida, a 36 km por vía.

**Ciudades portuarias.** Ocho puertos comparten nombre con una ciudad del juego (Ensenada,
Guaymas, Mazatlán, Manzanillo, Lázaro Cárdenas, Salina Cruz, Tampico, Veracruz). En el mapa
son un solo lugar: la etiqueta es la del puerto y su ficha muestra la población de la ciudad.

---

## 4. Ciudades

**58 ciudades**, elegidas así desde Natural Earth:

- las **32 capitales** estatales (incluida la del país);
- toda ciudad de más de **300 mil habitantes** (15 más);
- **nodos logísticos** que entran aunque sean más chicos: cruces fronterizos y ciudades
  portuarias (11 más: Ensenada, Los Mochis, Tapachula, Puerto Vallarta, Nogales, Lázaro
  Cárdenas, Ciudad del Carmen, Piedras Negras, Manzanillo, Guaymas, Salina Cruz);
- y se descarta toda ciudad que no sea capital a menos de 35 km de una más grande, porque
  es la misma zona metropolitana (así salen Nezahualcóyotl o Gómez Palacio).

La **población** es el campo `pop_max` de Natural Earth: una estimación de la zona urbana, no
una cifra del censo del INEGI. Sirve para ordenar y dimensionar, no como dato demográfico.

| Ciudad | Estado | Población (NE) | Capital | Tren |
| --- | --- | ---: | --- | --- |
| Ciudad de México | Ciudad de México | 19,028,000 | Del país | Estación |
| Guadalajara | Jalisco | 4,198,000 | Estatal | Estación a 4.5 km |
| Monterrey | Nuevo León | 3,712,000 | Estatal | Estación |
| Puebla | Puebla | 2,195,000 | Estatal | Estación |
| Tijuana | Baja California | 1,553,000 | | Estación (línea Tijuana–Tecate, sin conexión con la red nacional) |
| Toluca | Estado de México | 1,531,000 | Estatal | Estación |
| León | Guanajuato | 1,488,000 | | Estación a 5 km |
| Ciudad Juárez | Chihuahua | 1,343,000 | | Estación a 3.4 km |
| Torreón | Coahuila | 1,144,000 | | Estación a 4.2 km |
| San Luis Potosí | San Luis Potosí | 992,000 | Estatal | Estación a 3.8 km |
| Mérida | Yucatán | 965,000 | Estatal | Estación |
| Querétaro | Querétaro | 961,000 | Estatal | Estación a 3.8 km |
| Mexicali | Baja California | 885,000 | Estatal | Estación |
| Aguascalientes | Aguascalientes | 869,000 | Estatal | Estación |
| Tampico | Tamaulipas | 859,419 | | Estación |
| Cuernavaca | Morelos | 834,001 | Estatal | Estación a 4.5 km |
| Culiacán | Sinaloa | 809,000 | Estatal | Estación a 4.9 km |
| Chihuahua | Chihuahua | 793,000 | Estatal | Estación |
| Saltillo | Coahuila | 754,000 | Estatal | Estación |
| Acapulco | Guerrero | 715,584 | | Sin vía (a 128 km) |
| Morelia | Michoacán | 644,306 | Estatal | Estación |
| Hermosillo | Sonora | 595,811 | Estatal | Estación |
| Veracruz | Veracruz | 578,963 | | Estación |
| Cancún | Quintana Roo | 542,043 | | Sin vía (a 136 km) |
| Matamoros | Tamaulipas | 538,785 | | Estación |
| Oaxaca | Oaxaca | 530,728 | Estatal | Estación a 3.9 km |
| Tlaxcala | Tlaxcala | 503,878 | Estatal | Estación a 3.7 km |
| Reynosa | Tamaulipas | 498,654 | | Estación |
| Tuxtla Gutiérrez | Chiapas | 481,128 | Estatal | Sin vía (a 88 km) |
| Durango | Durango | 457,140 | Estatal | Estación |
| Xalapa | Veracruz | 452,186 | Estatal | Estación |
| Villahermosa | Tabasco | 428,564 | Estatal | Sin vía (a 46 km) |
| Celaya | Guanajuato | 383,697 | | Estación |
| Mazatlán | Sinaloa | 368,204 | | Estación |
| Orizaba | Veracruz | 355,333 | | Estación |
| Nuevo Laredo | Tamaulipas | 349,550 | | Estación |
| Irapuato | Guanajuato | 339,554 | | Estación a 6.7 km |
| Pachuca | Hidalgo | 319,581 | Estatal | Estación a 7.7 km |
| Tepic | Nayarit | 318,781 | Estatal | Estación |
| Ciudad Victoria | Tamaulipas | 274,900 | Estatal | Estación |
| Ensenada | Baja California | 256,565 | | Sin vía (a 66 km) |
| Los Mochis | Sinaloa | 249,047 | | Estación a 4.9 km |
| Zacatecas | Zacatecas | 234,481 | Estatal | Estación |
| Colima | Colima | 223,287 | Estatal | Estación |
| Tapachula | Chiapas | 221,521 | | Estación |
| Campeche | Campeche | 205,212 | Estatal | Estación |
| La Paz | Baja California Sur | 189,767 | Estatal | Sin vía (a 208 km) |
| Puerto Vallarta | Jalisco | 187,134 | | Sin vía (a 64 km) |
| Chilpancingo | Guerrero | 182,387 | Estatal | Sin vía (a 57 km) |
| Nogales | Sonora | 178,097 | | Estación |
| Lázaro Cárdenas | Michoacán | 160,087 | | Estación |
| Ciudad del Carmen | Campeche | 156,195 | | Sin vía (a 94 km) |
| Chetumal | Quintana Roo | 154,517 | Estatal | Sin vía (a 192 km) |
| Piedras Negras | Coahuila | 139,619 | | Estación a 4.3 km |
| Guanajuato | Guanajuato | 112,200 | Estatal | Estación |
| Manzanillo | Colima | 110,735 | | Estación |
| Guaymas | Sonora | 103,449 | | Estación |
| Salina Cruz | Oaxaca | 81,063 | | Estación |

---

## 5. Red ferroviaria

### Origen

Las vías son las de Norteamérica de Natural Earth, que provienen del Atlas Ambiental de
América del Norte de la CCA ([Fuentes](#1-fuentes)). Es una red de **alrededor de 2010**: no
incluye obras recientes como el Tren Maya. Eso es deliberado en el juego: ver
[Decisiones de diseño](#8-decisiones-de-diseño).

### Vías primarias y secundarias

Natural Earth le da a cada línea un `scalerank`: la escala más pequeña a la que esa línea
todavía merece dibujarse. Es una **clasificación cartográfica de Natural Earth, no la de los
operadores ferroviarios**, pero sigue de cerca los corredores troncales. El juego la usa así:

| Clase | `scalerank` | En el mapa | Velocidad de un tren | km en la red |
| --- | --- | --- | --- | ---: |
| Primaria | 6 o menos | Ámbar intenso y más gruesa | 60 km/h | 10,139 |
| Secundaria | más de 6 | Ámbar tenue y delgada | 40 km/h | 9,075 |

### Cifras

| | |
| --- | --- |
| Longitud total | 19,214 km |
| Nodos y tramos del archivo | 198 nodos, 231 tramos |
| Nodos y tramos con estaciones | 252 nodos, 285 tramos (cada estación puede partir un tramo) |
| Sitios con estación | 60 de 73 (ciudades y puertos) |
| Piezas conectadas | 4 |

Las cuatro piezas:

| Pieza | km | Conexión |
| --- | ---: | --- |
| Red nacional | 18,874 | La que usan todos los servicios |
| Tramo fronterizo de Sonora: une Cananea con la frontera en Naco y en las afueras de Nogales | 168 | Solo con EUA |
| Agua Prieta–Nacozari | 111 | Solo con EUA |
| Tijuana–Tecate | 60 | Solo con EUA |

Las tres pequeñas llegan a la frontera y en la realidad se conectan con la red de Estados
Unidos, no con la mexicana. Por eso desde Tijuana no se puede llegar en tren a ninguna otra
ciudad del juego.

### Estaciones

Todo sitio a **15 km o menos** de una vía tiene estación, en el punto de la vía más cercano.
Si la vía pasa lejos (más de 5 km), el mapa une el sitio y su estación con una línea
punteada. Las estaciones más alejadas de su sitio: Puerto Chiapas (12.5 km), Pachuca
(7.7 km), Tijuana (7.3 km), Irapuato (6.7 km) y el puerto de Tampico (6.4 km).

**Sin vía** (13 sitios): Acapulco, Cancún, Chetumal, Chilpancingo, Ciudad del Carmen, Dos
Bocas, Ensenada (ciudad y puerto), La Paz, Puerto Vallarta, Tuxpan, Tuxtla Gutiérrez y
Villahermosa.

---

## 6. Servicios de tren

El tablero arranca con **8 servicios de carga** sobre corredores reales. Solo se definen las
paradas: el camino entre ellas lo calcula el juego (la ruta más rápida por la red).
"Marcha" es el tiempo en movimiento por sentido; la vuelta completa suma ida, regreso y las
esperas de carga en cada parada.

| Servicio | Paradas | km por sentido | Marcha por sentido | Vuelta completa | Corredor |
| --- | --- | ---: | ---: | ---: | --- |
| Manzanillo ⇄ CDMX | Manzanillo → Guadalajara → Ciudad de México | 907 | 15.1 h | 38.2 h | Del Pacífico al centro |
| Lázaro Cárdenas ⇄ Nuevo Laredo | Lázaro Cárdenas → San Luis Potosí → Monterrey → Nuevo Laredo | 1,449 | 25.3 h | 60.6 h | Del Pacífico a la frontera con Texas |
| Veracruz ⇄ CDMX | Veracruz → Puebla → Ciudad de México | 452 | 8.0 h | 24.0 h | Del Golfo al centro |
| CDMX ⇄ Ciudad Juárez | Ciudad de México → Querétaro → Torreón → Chihuahua → Ciudad Juárez | 1,910 | 31.8 h | 75.6 h | Corredor central, hacia El Paso |
| Guadalajara ⇄ Nogales | Guadalajara → Mazatlán → Hermosillo → Nogales | 1,702 | 28.4 h | 66.8 h | Línea del Pacífico, hacia Arizona |
| Altamira ⇄ Monterrey | Altamira → Monterrey | 507 | 12.6 h | 31.2 h | Del puerto industrial del Golfo a Monterrey |
| Coatzacoalcos ⇄ Salina Cruz | Coatzacoalcos → Salina Cruz | 274 | 4.6 h | 15.2 h | El Istmo de Tehuantepec, de océano a océano |
| Coatzacoalcos ⇄ Progreso | Coatzacoalcos → Mérida → Progreso | 909 | 15.1 h | 38.2 h | Del Istmo a la península de Yucatán |

Detalle por tramo (ida):

- **Manzanillo ⇄ CDMX**: Manzanillo–Guadalajara 332 km (5.5 h) · Guadalajara–CDMX 575 km
  (9.6 h).
- **Lázaro Cárdenas ⇄ Nuevo Laredo**: Lázaro Cárdenas–San Luis Potosí 703 km (12.9 h) · San
  Luis Potosí–Monterrey 477 km (8.0 h) · Monterrey–Nuevo Laredo 269 km (4.5 h).
- **Veracruz ⇄ CDMX**: Veracruz–Puebla 270 km (5.0 h) · Puebla–CDMX 182 km (3.0 h).
- **CDMX ⇄ Ciudad Juárez**: CDMX–Querétaro 215 km (3.6 h) · Querétaro–Torreón 863 km
  (14.4 h) · Torreón–Chihuahua 478 km (8.0 h) · Chihuahua–Ciudad Juárez 355 km (5.9 h).
- **Guadalajara ⇄ Nogales**: Guadalajara–Mazatlán 534 km (8.9 h) · Mazatlán–Hermosillo
  897 km (14.9 h) · Hermosillo–Nogales 270 km (4.5 h).
- **Altamira ⇄ Monterrey**: 507 km (12.6 h), toda por vía secundaria.
- **Coatzacoalcos ⇄ Salina Cruz**: 274 km (4.6 h).
- **Coatzacoalcos ⇄ Progreso**: Coatzacoalcos–Mérida 873 km (14.6 h) · Mérida–Progreso
  36 km (0.6 h).

Además, el jugador puede crear trenes nuevos eligiendo estaciones en el mapa (*＋ Nuevo
tren*). Los servicios no llevan nombre de empresa: los corredores son reales, los
operadores no aparecen en el juego.

---

## 7. Reglas de la simulación

| Regla | Valor |
| --- | --- |
| Inicio de la partida | Día 1, 06:00 |
| Reloj | 1× = 1 hora de juego por segundo; velocidades: pausa, ¼×, 1×, 4×, 16×; la barra espaciadora pausa |
| Cuándo corre | Solo con el tablero de México abierto; en las vistas del mundo el juego se pausa |
| Velocidad en vía primaria | 60 km/h |
| Velocidad en vía secundaria | 40 km/h |
| Espera en terminales | 3 h (carga y descarga completa) |
| Espera en paradas intermedias | 1 h |
| Largo de un tren | 1.8 km (unos 100 carros); en pantalla nunca menos de 18 px |
| Cómo se elige la ruta | La más rápida en tiempo, no la más corta (algoritmo de Dijkstra) |
| Servicio | Ida y vuelta entre sus paradas, sin fin: A → B → C → B → A… |
| Velocidad comercial resultante | ~44 km/h promedio contando las esperas (medida en 500 h simuladas con los 8 servicios) |

Las velocidades son promedios de marcha de un tren de carga, no velocidades máximas. Elegir
la ruta por tiempo hace que un tren prefiera una vía primaria aunque un ramal sea más corto,
como lo haría un despachador.

---

## 8. Decisiones de diseño

- **La red base es la anterior a 2018; lo posterior lo construye el jugador.** *(19 nov
  2026.)* Las vías hechas de 2018 en adelante no están en el mapa a propósito: construirlas
  será parte del juego. Ejemplos: el Tren Maya y las líneas nuevas del Corredor
  Interoceánico. Por eso Cancún y Chetumal, hoy sin vía, son candidatas naturales. Los
  trazos, fechas y longitudes de esas obras se documentarán aquí cuando se diseñe la mecánica
  de construcción. Los dos tramos trazados a mano (Cuyutlán–Manzanillo y el ramal de
  Altamira) son anteriores a 2018, así que respetan la regla.
- **Puertos en la terminal o en la bocana**, no en el centro de la ciudad: es a donde llegan
  los barcos.
- **Rutas calculadas, no dibujadas.** Un servicio solo define sus paradas; el camino lo da
  la red. Si la red cambia (por ejemplo, porque el jugador construye una vía), las rutas
  cambian solas.
- **Sin nombres de empresas.** Los corredores son reales; los operadores no aparecen.
- **El color significa algo.** Lo marítimo es cian, lo ferroviario es ámbar (cada tren tiene
  su propio tono cálido) y las ciudades son tinta clara.
- **Las estaciones llegan hasta 15 km.** Más lejos, el sitio no tiene servicio de tren y su
  ficha dice a cuántos km queda la vía.

---

## 9. Bitácora de correcciones a los datos

Todo lo que se cambió respecto a las fuentes, y por qué.

### 19 de noviembre de 2026

**Estados**

- El "estado" sin nombre `MX-X01~` de Natural Earth es el **Arrecife Alacranes**; se
  incorporó a Yucatán, al que pertenece.
- "Distrito Federal" se renombró **Ciudad de México** (clave CDMX) y "México", **Estado de
  México**.

**Países vecinos**

- Se toman del **mismo archivo que los estados**, disueltos por país, y no de un archivo de
  países. Así el lado de Estados Unidos, Guatemala y Belice de la frontera tiene exactamente
  los mismos vértices que México, y el juego puede distinguir la **costa** (un solo
  polígono) de la **frontera terrestre** (compartida entre un estado y un vecino). Con el
  archivo de países los dos lados diferían unos cientos de metros y toda la frontera salía
  dibujada como costa.

**Ciudades**

- Se eliminó un **"Mazatlán, Sonora"** fantasma (500 mil habitantes) que Natural Earth trae
  junto al Mazatlán real de Sinaloa.
- Nombres corregidos: *Mexico City* → Ciudad de México, *Ciudad Obregon* → Ciudad Obregón,
  *Tehuacan* → Tehuacán, *Nezahualcoyotl* → Nezahualcóyotl.

**Puertos**

- Lista hecha a mano (15 puertos), porque la capa de Natural Earth no trae ni Lázaro
  Cárdenas ni Altamira.
- Tres puertos de río se movieron a su bocana para que un barco pueda llegar: **Altamira**
  (estaba 6.3 km tierra adentro), **Tampico** (8.9 km, sobre el Pánuco) y **Tuxpan** (8.2 km).

**Vías férreas**

- **Recorte en la frontera terrestre, no en la costa.** Recortar las vías con el contorno
  costero de 10m tiraba puentes y calzadas sobre el agua; así se había perdido el cruce
  **Guaymas–Empalme**. Ahora el recorte es México crecido 3 km mar adentro, menos los
  vecinos.
- **Tramo agregado a mano: Cuyutlán–Manzanillo** (unos 34 km). La vía Guadalajara–Colima de
  la fuente termina cerca de Cuyutlán y dejaba sin tren al puerto de contenedores más grande
  del país. La vía real corre por la barra entre la Laguna de Cuyutlán y el mar; se trazó
  ~1.3 km tierra adentro de la costa de 10m, como los últimos kilómetros de la propia fuente,
  y luego al norte hasta el puerto.
- **Tramo agregado a mano: ramal del puerto de Altamira** (unos 13 km). La fuente pasa por
  Altamira, pero no entra al puerto industrial. Sale de la línea Tampico–Ciudad Mante, al
  noroeste de Tampico, y termina en la dársena.
- **Soldadura**: toda punta suelta a 1.6 km o menos de otra vía es un hueco de la fuente, no
  una terminal, y se une. Hubo una: **cerca de Mérida**, de 1.49 km.
- **Pedazos descartados**: tres fragmentos de menos de 10 km que dejó el recorte en la
  frontera (4.9 km en Baja California, al este de Tecate, y dos de menos de un kilómetro en
  Coahuila, junto al río Bravo).

---

## 10. Glosario

- **Nodo**: punto de la red donde algo cambia: un entronque, el final de una línea o el
  punto donde una vía pasa de primaria a secundaria.
- **Tramo**: la vía entre dos nodos.
- **Estación**: el punto de la vía que da servicio a un sitio; puede partir un tramo en dos.
- **Sitio**: una ciudad o un puerto. Cada uno tiene una clave única, como `puerto:veracruz`
  o `ciudad:veracruz`.
- **Servicio**: la lista de paradas que recorre un tren, de ida y de vuelta.
- **Pieza conectada**: un conjunto de vías unidas entre sí; un tren no puede pasar de una
  pieza a otra.
- **Marcha**: el tiempo que un tren pasa en movimiento, sin contar las esperas.
- **Vuelta completa**: ida, regreso y todas las esperas de un servicio.
