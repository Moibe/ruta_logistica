# Enciclopedia de Ruta Logística

Referencia de lo que hay en el juego: qué contiene, de dónde sale cada dato, qué se corrigió a
mano y por qué, y con qué reglas se mueve. Vive también dentro del juego: el librito de la esquina
superior derecha, junto al presupuesto, abre esta misma página (`/enciclopedia`), que se arma con este archivo.

> **Cifras al 20 de noviembre de 2026, con trenes, barcos, travesías oceánicas, los Polos del
> Bienestar, los dueños, el tráfico y la capacidad de cada vía, las obras del Estado, su
> presupuesto y la electricidad.** No están escritas de memoria: se calcularon ejecutando el mismo código del juego
> que usa el tablero (`domain/red.ts`, `domain/mar.ts`, `domain/trenes.ts`,
> `domain/barcos.ts`, `domain/sitios.ts`). Si cambian los datos, se recalculan.

**Contenido**

1. [Fuentes](#1-fuentes)
2. [Geografía](#2-geografía)
3. [Puertos](#3-puertos)
4. [Ciudades](#4-ciudades)
5. [Polos del Bienestar](#5-polos-del-bienestar)
6. [Red ferroviaria](#6-red-ferroviaria)
7. [Servicios de tren](#7-servicios-de-tren)
8. [Rutas marítimas](#8-rutas-marítimas)
9. [Barcos](#9-barcos)
10. [Reglas de la simulación](#10-reglas-de-la-simulación)
11. [Decisiones de diseño](#11-decisiones-de-diseño)
12. [Bitácora de correcciones a los datos](#12-bitácora-de-correcciones-a-los-datos)
13. [Glosario](#13-glosario)

---

## 1. Fuentes

| Fuente | Qué aporta al juego | Versión | Licencia |
| --- | --- | --- | --- |
| [Natural Earth](https://www.naturalearthdata.com/) 1:10m | Estados, países vecinos, vías férreas y ciudades del tablero de México | Repositorio `nvkelso/natural-earth-vector`, commit `ca96624` del 2 de junio de 2022 (versión 5.2.0-pre) | Dominio público |
| Atlas Ambiental de América del Norte, de la CCA (Comisión para la Cooperación Ambiental de México, Estados Unidos y Canadá) | Origen de las vías férreas de Norteamérica que trae Natural Earth (así lo registra la bitácora de cambios de Natural Earth); reúne cartografía de INEGI, USGS y Natural Resources Canada | Red de alrededor de 2010 | A través de Natural Earth |
| [world-atlas](https://github.com/topojson/world-atlas) | Contornos del mundo para las vistas globales (tierra a 110m y 50m, países a 110m), y la tierra 50m sobre la que se calculan las travesías oceánicas | 2.0.2, que redistribuye Natural Earth 4.1.0 en TopoJSON | ISC (los datos, dominio público) |
| Curaduría propia | Los 15 puertos, las 2 salidas al mundo y sus puertos lejanos (Shanghái y Róterdam), dos tramos de vía, el trazo del Canal de Panamá, nombres en español, abreviaturas de estados y varias correcciones (ver la [bitácora](#12-bitácora-de-correcciones-a-los-datos)) | — | Del proyecto |
| Cálculo propio sobre Natural Earth | Las 136 rutas marítimas entre puertos y salidas, y las 2 travesías oceánicas de las salidas a sus puertos lejanos (ver [Rutas marítimas](#8-rutas-marítimas)) | Tierra 1:10m del tablero para las rutas; 1:50m del mundo para las travesías | Del proyecto |
| `logistica-oceanica` (proyecto hermano) | Velocidades de referencia de las clases de barco | — | Del proyecto |
| [Diario Oficial de la Federación](https://dof.gob.mx) | Las declaratorias de los 32 Polos del Bienestar vigentes: polígono, superficie, municipio y fecha de cada uno (ver [Polos del Bienestar](#5-polos-del-bienestar)) | Declaratorias del 12 de mayo de 2023 al 7 de agosto de 2026, con sus notas aclaratorias y modificaciones; consultadas el 19 de noviembre de 2026 | Documento oficial público |
| Secretaría de Economía | Lámina "Polos de Desarrollo Económico para el Bienestar" (22 de mayo de 2025): los polos anunciados por etapa | — | Documento oficial público |
| [OpenStreetMap](https://www.openstreetmap.org/copyright) | El trazo de la autopista MEX-185D, para ubicar dos polos cuyas coordenadas no traen meridiano (ver la nota ¹ de los polos); el operador y el estado (en uso, en desuso, abandonada) de cada vía, para saber de quién es cada tramo de la red | Consultado el 19 y el 20 de noviembre de 2026 | ODbL, © colaboradores de OpenStreetMap |
| [ARTF, Anuario Estadístico Ferroviario 2018](https://www.gob.mx/cms/uploads/attachment/file/1099335/Anuario_2018.pdf) | Los km de vía de cada empresa en 2018, para comprobar el reparto de dueños | 2019 | Documento oficial público |
| [ARTF, Anuario Estadístico Ferroviario 2019](https://www.gob.mx/cms/uploads/attachment/file/574090/Anuario_Estadi_stico_Ferroviario_2019__2_.pdf) | Los ingresos de cada concesionaria en 2018 (tabla 4-2), para el derecho de diciembre de 2018 | 2020 | Documento oficial público |
| [ARTF, Sistema Nacional de Indicadores Ferroviarios 2022](https://www.gob.mx/cms/uploads/attachment/file/789599/SNIF_2022.pdf) | Densidad de tráfico y carga por tren de cada empresa (2018–2021): de ahí salen los trenes privados al día | 2022 | Documento oficial público |
| [ARTF, Pulso de Interconexión, 1er semestre 2024](https://www.gob.mx/cms/uploads/attachment/file/947545/Pulso_Interconexion_VF7.pdf) | La tabla de derechos de paso obligatorios: quién es dueño de cada línea y kilómetro, donde OpenStreetMap no lo dice | 2024 | Documento oficial público |
| [ATTRAPI, Anuario Estadístico Ferroviario 2025](https://www.gob.mx/cms/uploads/attachment/file/1100990/Anuario_2025.pdf) | Toneladas por par origen–destino, para estimar cuántos trenes de Nuevo Laredo siguen al sur de Monterrey; los ingresos de cada concesionaria de 2019 a 2025 (tabla A36), sobre los que pagan su derecho | 2026 | Documento oficial público |
| [SHCP, Transparencia Presupuestaria, datos abiertos](https://www.transparenciapresupuestaria.gob.mx/Datos-Abiertos) | El presupuesto federal para ferrocarriles de cada año: lo ejercido de 2018 a 2025 (Cuenta Pública), lo aprobado en 2026 (PEF) y el proyecto 2027 (PPEF), por clave presupuestaria | Bases consultadas el 20 de noviembre de 2026 | Datos abiertos del gobierno federal |
| [SENER, PRODESEN 2019–2033](https://www.gob.mx/cms/uploads/attachment/file/475497/PRODESEN_V.pdf) | Capacidad por región y centrales principales a diciembre de 2018 (cap. V); márgenes de reserva de 2019 en el pico de la tarde y de la noche (cap. VII, tablas 7.6 y 7.7) | 2019 | Documento oficial público |
| [SENER, Plan de Desarrollo del Sector Eléctrico 2025–2039](https://dof.gob.mx/nota_detalle_popup.php?codigo=5770297) | Demanda máxima por región de 2018 a 2024; cómo se mide el margen de reserva y sus mínimos; costo de inversión por kW de cada tecnología | DOF, 14 de octubre de 2025 | Documento oficial público |
| [SICT, AFAC, Estadística Operacional de Aeropuertos, diciembre de 2025](https://www.gob.mx/cms/uploads/attachment/file/1051974/producto-aeropuertos-es-dic-25-27012026.pdf) | Toneladas de carga de 2024 y 2025 de los diez aeropuertos que más mueven; doméstica e internacional de los primeros | Enero de 2026 | Documento oficial público |
| [AFAC, Estadística operativa de aeropuertos 2006–2026](https://www.gob.mx/cms/uploads/attachment/file/1112825/producto-aeropuertos-2006-2026-sep-27102026.xlsx) | Carga nacional e internacional de cada aeropuerto, mes por mes, de 2006 a septiembre de 2026: la serie del modo Realidad | Octubre de 2026 | Dato oficial público |
| [INEGI, Exportaciones por Entidad Federativa](https://www.inegi.org.mx/programas/exporta_ef/) | Valor de lo que exporta cada estado, por subsector, de 2007 a 2025 (datos abiertos) | 2026 | Dato oficial público |
| [ANAM, informe mensual de diciembre de 2025](https://www.anam.gob.mx/wp-content/uploads/IM_12_2025-.pdf) y [decreto de creación (DOF, 14 de julio de 2021)](https://www.dof.gob.mx/nota_detalle.php?codigo=5623945&fecha=14/07/2021) | Recaudación, operaciones y valor de las operaciones de cada aduana en 2025; la creación de la ANAM | 2021 y 2026 | Documento oficial público |
| [ATTRAPI, Anuario Estadístico Ferroviario 2025, tablas A10 a A13](https://www.gob.mx/cms/uploads/attachment/file/1100990/Anuario_2025.pdf) | Toneladas que salen del país por tren cada año (2017–2025), por frontera y por puerto | 2026 | Documento oficial público |
| [CENACE, circunscripción de las regiones](https://www.cenace.gob.mx/Docs/16_MARCOREGULATORIO/CENACEOrganizacion/(DOF%202018-05-15%20CENACE)%20Circunscripci%C3%B3n%20territorial%20GCR.pdf) | Qué estados y municipios forman cada región del sistema eléctrico | DOF, 15 de mayo de 2018 | Documento oficial público |
| [CNE, lista de permisos de generación](https://www.gob.mx/cms/uploads/attachment/file/1115484/E4_Tabla_p_blica_Oct26.xlsx) | Las centrales privadas que entraron (o entrarán) desde 2019: capacidad, tecnología, fecha y municipio; inversión estimada de varias de la CFE | Al 31 de octubre de 2026 | Documento oficial público |
| [CFE, Informe Anual 2024](https://www.cfe.gob.mx/finanzas/reportes-financieros/Reportes%20Anuales%20Documentos/Informe%20Anual%202024.pdf) y [Programa de Desarrollo 2026–2030](https://www.cfe.gob.mx/finanzas/Documents/ProgramaDesarrollo-26.pdf) | Costo de las centrales de la CFE, inicio de obra y avance físico de cada una al cierre de 2024; lo que la CFE invierte al año en centrales propias y cuándo entraron Salamanca, El Sauz II y Villa de Reyes | 2025 y 2026 | Documento oficial público |
| [CFE, boletines de Manzanillo III](https://app.cfe.mx/Aplicaciones/OTROS/Boletines/boletin?i=10527), [Elvia Carrillo Puerto](https://app.cfe.mx/Aplicaciones/OTROS/Boletines/boletin?i=10576) y [Puerto Peñasco](https://app.cfe.mx/Aplicaciones/OTROS/Boletines/boletin?i=3788) | Fecha y MW de entrada en operación de esas centrales | 2023 y 2026 | Documento oficial público |
| [CFE, Informe de la Gestión Gubernamental 2018–2024, EPS Generación I](https://www.cfe.gob.mx/nuestraempresa/Informe%20de%20gestion%201824/EPS%20Generaci%C3%B3n%20I.pdf) | El ciclo combinado Tula: contrato de 2014, sin terminar en 2018, en operación en 2020 | Septiembre de 2024 | Documento oficial público |
| [Presidencia, «Cumplimos con el rescate de CFE»](https://www.gob.mx/amlo/prensa/cumplimos-con-el-rescate-de-cfe-presidente-amlo) y [La Jornada, «CFE construye planta de energía en Mexicali»](https://www.jornada.com.mx/notas/2022/04/10/estados/cfe-construye-planta-de-energia-en-mexicali-ante-riesgo-de-escasez/) | Las unidades de emergencia de Mexicali: en obra en abril de 2022, en operación en julio de 2024; avance de San Luis Río Colorado | 2022 y 2024 | Comunicado oficial; prensa |
| [Presidencia, inauguración del polo de Huamantla](https://www.gob.mx/presidencia/prensa/plan-mexico-presidenta-inaugura-primer-polo-de-desarrollo-economico-para-el-bienestar-en-huamantla-tlaxcala-con-inversion-de-540-mdd) y [La Jornada, 13 de abril de 2026](https://www.jornada.com.mx/2026/04/13/politica/003n1pol) | El primer polo en operación: Huamantla, inaugurado el 12 de abril de 2026 y terminado a finales de febrero | 2026 | Comunicado oficial; prensa |
| DOF, avisos de fallo de las licitaciones de los polos [Salina Cruz](https://sidof.segob.gob.mx/notas/5709738), [Texistepec](https://sidof.segob.gob.mx/notas/5709825), [San Juan Evangelista](https://sidofqa.segob.gob.mx/notas/5729079), [Asunción Ixtaltepec](https://sidof.segob.gob.mx/notas/5738700) y [San Blas Atempa](https://sidof.segob.gob.mx/notas/5763741) | Cuándo se adjudicó cada uno a un desarrollador | 2023–2025 | Documento oficial público |
| [INEGI, servicio del Catálogo Único de Claves Geoestadísticas](https://gaia.inegi.org.mx/wscatgeo/v2/) | Ubicación de cada central: la cabecera de su municipio; el límite de Mulegé con Comondú y Loreto (Marco Geoestadístico, diciembre de 2025) | Consultado el 20 de noviembre de 2026 | Dato oficial público |
| [Presidencia, «CFE construirá 2 centrales termosolares en Baja California Sur»](https://www.gob.mx/presidencia/prensa/mexico-a-la-vanguardia-cfe-construira-2-centrales-termosolares-en-baja-california-sur-para-beneficiar-hasta-200-mil-hogares?idiom=es) | Las termosolares de Baja California Sur: dos de 50 MW y una segunda etapa de 50 MW, con 11 horas de almacenamiento y de 36 a 48 meses de obra | 26 de agosto de 2025 | Documento oficial público |
| [CFE, boletín de prensa 095/26](https://www.cfe.gob.mx/cdn/2019/Archivos/Boletines/260601%20-%20gen%20energias%20limpias%20y%20renovables.pdf) | Chicoasén II (240 MW, para finales de 2028) y el Proyecto Oasis, en evaluación | 1 de junio de 2026 | Documento oficial público |
| [CFE, boletín de prensa 179/26](https://www.cfe.gob.mx/cdn/2019/Archivos/Boletines/179hidrogenoverdevf.pdf) | El Proyecto Oasis de Mulegé: 60 MW solares, 20 MW de almacenamiento e hidrógeno verde | 10 de septiembre de 2026 | Documento oficial público |
| [IRENA, Renewable Power Generation Costs in 2024](https://www.irena.org/Publications/2025/Jun/Renewable-Power-Generation-Costs-in-2024) y [Green hydrogen cost reduction](https://www.irena.org/-/media/Files/IRENA/Agency/Publication/2020/Dec/IRENA_Green_hydrogen_cost_2020.pdf) | Costo por kW de la termosolar (3,677 dólares, promedio mundial de 2024) y de un electrolizador (unos 1,000): base de las estimaciones del juego donde la CFE no ha publicado costo | 2025 y 2020 | Organismo intergubernamental, documento público |
| [Ley Federal de Derechos, art. 232-B](https://www.diputados.gob.mx/LeyesBiblio/pdf/LFD.pdf) y [su reforma (DOF, 13 de noviembre de 2026)](https://dof.gob.mx/nota_detalle.php?codigo=5803759&fecha=13/11/2026) | El derecho que pagan las concesionarias por usar la vía: 1.25 % de sus ingresos, y 3 % desde 2027 | Vigente al 20 de noviembre de 2026 | Documento oficial público |
| [Bureau of Transportation Statistics (EUA), Border Crossing Entry Data](https://data.bts.gov/resource/keg4-3bc2.json) | Trenes que cruzan a Estados Unidos por cada puerto fronterizo: el tráfico de los corredores de Nuevo Laredo, Piedras Negras y Ciudad Juárez | Datos 2018 y 2025 | Dato oficial público (gobierno de EUA) |
| AAR / Cambridge Systematics, *National Rail Freight Infrastructure Capacity and Investment Study* (2007), citado por el TRB | Cuántos trenes al día caben en vía sencilla, con control centralizado y en vía doble. Es referencia de Estados Unidos: no hay cifra oficial mexicana | 2007 | Estudio público |
| [Auditoría Superior de la Federación](https://www.asf.gob.mx/) | Costo por km del Tren Maya: sobre el derecho de vía viejo, vía nueva a nivel y viaducto | Cuenta Pública 2021 (auditoría 114) y 2024 (auditoría 126) | Documento oficial público |
| [Presidencia de la República](https://www.gob.mx/presidencia/prensa/se-construiran-2-mil-400-km-de-trenes-con-inversion-de-750-mil-mdp-en-2027-se-dara-banderazo-al-aifa-pachuca-y-cdmx-queretaro-presidenta) | Costo, km, fechas y avance de los trenes de pasajeros y del Tren Maya | Comunicados del 22 de marzo de 2025 al 31 de octubre de 2026 | Documento oficial público |
| [SICT](https://www.gob.mx/sct/prensa/precisa-sict-que-ramal-ferroviario-roberto-ayala-dos-bocas-tiene-un-costo-estimado-de-6-mil-54-mdp) | Costo del ramal a Dos Bocas; plan de 13 rutas de pasajeros en 4 fases | 8 de noviembre de 2022; 28 de noviembre de 2024 | Documento oficial público |
| [Corredor Interoceánico, informe 2025-2026](https://www.gob.mx/cms/uploads/attachment/file/1100578/Informe_anual_de_avance_y_resultados_PICIIT_2025_2026.pdf) | Fechas y avance de las líneas Z, FA y K; costo de su rehabilitación (con la Cuenta Pública 2025) | Corte al 30 de junio de 2026 | Documento oficial público |
| [OpenStreetMap, Tren Maya](https://www.openstreetmap.org/relation/13196595) | El trazo de los 8 tramos del Tren Maya y del ramal a Dos Bocas | Consultado el 19 de noviembre de 2026 | ODbL, © colaboradores de OpenStreetMap |
| [Reforma a la Ley Reglamentaria del Servicio Ferroviario](https://dof.gob.mx/nota_detalle.php?codigo=5763165&fecha=16/07/2025) | El derecho de paso: quien usa la vía de otro le paga una contraprestación | DOF, 16 de julio de 2025 | Documento oficial público |
| INEGI (convención cartográfica) | Parámetros de la proyección del tablero: cónica conforme de Lambert, paralelos 17.5° y 29.5°, meridiano central 102° O | — | — |
| [INEGI, Censos Económicos 2024](https://www.inegi.org.mx/contenidos/programas/ce/2024/doc/mver_ce24.pdf) | Empleos que da la obra por cada millón de pesos (construcción en Veracruz, 2023) | Resultados definitivos, 2025 | Documento oficial público |
| Presidencia de la República y Gobierno de Tlaxcala | Tiempos y empleos del polo de Huamantla, el único terminado: su ritmo de obra y su proyección de empleos | Comunicados del 14 oct 2025 al 12 abr 2026 | Documento oficial público |

**Regla de fuentes.** Las cifras del juego salen de fuentes oficiales (DOF, Presidencia,
dependencias, INEGI, gobiernos estatales). La prensa solo entra como complemento, y solo de
medios no corporativos (La Jornada, La Base América Latina, noticieros ciudadanos).

**Mantener el juego al día.** Las cifras que vienen del mundo real viven, cada una con su fuente
y la fecha en que se consultó, en `src/lib/domain/datos/calibracion.json`. `npm run al-dia`
(`scripts/al-dia.mjs`) revisa el DOF desde la fecha de corte hasta hoy buscando acuerdos sobre
los Polos del Bienestar que el juego no haya revisado (declaratorias nuevas, modificaciones,
notas aclaratorias, abrogaciones) y marca las cifras que llevan más de seis meses sin revisarse.
No cambia nada por sí mismo: dice qué revisar. Al terminar la revisión se mueve la fecha de corte.

Herramientas que procesan los datos (no aportan datos): mapshaper 0.7.101 (MPL-2.0) para
disolver, recortar y simplificar la geometría; d3-geo 3.1.2 y topojson-client 3.1.0 (ISC)
para proyectar y decodificar; three 0.185.1 y Threlte 8.7.0 (MIT) para el globo.

**Cómo se generan.** `npm run datos` (`scripts/datos-mexico.mjs`) descarga las capas de
Natural Earth una sola vez a `.cache/ne/`, fijadas al commit de arriba, y produce:

| Archivo | Contenido |
| --- | --- |
| `static/data/mexico.topo.json` | Estados y países vecinos, en un solo TopoJSON que comparte arcos |
| `static/data/red-ferroviaria.json` | La red ferroviaria como grafo: nodos y tramos |
| `static/data/rutas-maritimas.json` | Las rutas por mar entre cada par de puertos y salidas, el trazo del Canal y las travesías oceánicas (estas las calcula `scripts/travesias.mjs`) |
| `src/lib/domain/datos/ciudades.json` | Las 58 ciudades |

Los puertos y las salidas al mundo no salen del script: viven a mano en
`src/lib/domain/datos/puertos.json` y `puertas.json`. Están en JSON para que el script los
pueda leer y calcular las rutas marítimas entre ellos. Los Polos del Bienestar también son un
archivo curado, `src/lib/domain/datos/polos.json`, sacado una vez de sus declaratorias (ver su
sección).

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
[bitácora](#12-bitácora-de-correcciones-a-los-datos)) y se recortan a una caja de
-134° a -64° de longitud y 0° a 46° de latitud, mucho más grande de lo que la cámara del
tablero puede ver, para que el borde del recorte nunca aparezca en pantalla.

---

## 3. Puertos

Los **15 puertos se curaron a mano**: la capa de puertos de Natural Earth no trae Lázaro
Cárdenas (el segundo del país en contenedores) ni Altamira (el cuarto). Las coordenadas son las de
la terminal; en los puertos de río (Altamira, Tampico, Tuxpan) y en Topolobampo, al fondo de
una bahía, el marcador va en la bocana, que es a donde llega un barco.

★ = principal: los cuatro puertos que mueven la mayor parte de los contenedores del país
(Manzanillo, Lázaro Cárdenas, Veracruz, Altamira). En el mapa llevan un rombo más grande.

| Puerto | Estado | Litoral | Lat, lon | Tren |
| --- | --- | --- | --- | --- |
| Ensenada | Baja California | Pacífico | 31.855, -116.625 | Sin vía (a 68 km) |
| Guaymas | Sonora | Pacífico | 27.915, -110.860 | Estación |
| Topolobampo | Sinaloa | Pacífico | 25.555, -109.105 | Estación a 8.7 km |
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
- **Topolobampo** — Extremo del Pacífico de la línea Chihuahua al Pacífico. El marcador está en
  la boca de la bahía, unos 6 km al suroeste del muelle (ver bitácora).
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

### Aeropuertos de carga

No todos los aeropuertos son de carga: casi todos llevan algo en la bodega de los aviones de
pasajeros, pero la carga se concentra en pocos. Los cinco primeros mueven el 80 % del país. El
tablero tiene los diez que más movieron en 2025, con su capa propia (*Aeropuertos*): un avión del
tamaño de sus toneladas, y su ficha al pasar el cursor.

**Puertos secos.** Un aeropuerto a 15 km o menos de una vía en servicio tiene estación, como una
ciudad, y un tren puede hacer parada en él: es donde la carga pasará del avión al tren. Con la red
de 2018, nueve de los diez la tienen:

| Aeropuerto | Vía más cercana |
| --- | ---: |
| Mérida | 0.4 km |
| AIFA | 0.9 km |
| Querétaro | 1.2 km |
| Monterrey | 1.3 km |
| AICM | 2.2 km |
| Tijuana | 3.0 km |
| San Luis Potosí | 3.8 km |
| Toluca | 4.2 km |
| Guadalajara | 5.6 km |
| Cancún | 132 km: sin estación |

Cancún recibe estación cuando el jugador construye el Tren Maya hasta ahí, porque la red se rehace
al terminarse una obra. Qué carga mueve cada puerto seco viene con el diseño de la carga.

Toneladas de 2025 (AFAC; el país movió 1,232,808). La doméstica y la internacional solo están
cuando la AFAC pone al aeropuerto entre los diez primeros de cada tipo, y el total de un
aeropuerto no siempre es la suma de las dos:

| # | Aeropuerto | Toneladas 2025 | Del país | Contra 2024 | Internacional | Doméstica |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | Aeropuerto Internacional Felipe Ángeles (NLU) | 406,193 | 32.9 % | −9.2 % | 396,591 | — |
| 2 | Aeropuerto Internacional de la Ciudad de México (MEX) | 252,556 | 20.5 % | +5.2 % | 190,477 | 62,078 |
| 3 | Aeropuerto Internacional de Guadalajara (GDL) | 183,410 | 14.9 % | +5.6 % | 140,190 | 43,220 |
| 4 | Aeropuerto Internacional de Monterrey (MTY) | 76,282 | 6.2 % | −4.0 % | 41,182 | 35,100 |
| 5 | Aeropuerto Intercontinental de Querétaro (QRO) | 76,025 | 6.2 % | −1.8 % | — | 54,612 |
| 6 | Aeropuerto Internacional de Tijuana (TIJ) | 37,894 | 3.1 % | −1.8 % | — | 34,884 |
| 7 | Aeropuerto Internacional de Cancún (CUN) | 36,207 | 2.9 % | +0.1 % | 24,205 | 12,002 |
| 8 | Aeropuerto Internacional de Toluca (TLC) | 30,399 | 2.5 % | −22.3 % | — | — |
| 9 | Aeropuerto Internacional de San Luis Potosí (SLP) | 26,620 | 2.2 % | −3.2 % | — | 25,984 |
| 10 | Aeropuerto Internacional de Mérida (MID) | 25,439 | 2.1 % | −2.9 % | — | 18,925 |

El AIFA es el de carga del país: mueve casi la mitad de la carga internacional (46.7 %). Querétaro es el segundo en carga doméstica. La
ubicación de cada aeropuerto es su punto de referencia, aproximado a un kilómetro.

**Año por año, en el modo Realidad.** La AFAC publica la carga de cada aeropuerto mes por mes
desde 2006. En Realidad, cada avión tiene el tamaño de lo que movió en el año de la fecha elegida
(el año en curso, todavía incompleto, usa el anterior), y su ficha dice sus toneladas, su lugar
en el país ese año y cuánto fue nacional e internacional. El AIFA aparece en marzo de 2022, cuando
abrió. Toneladas de cada año (y su lugar en el país; * de enero a septiembre):

| Aeropuerto | 2018 | 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026* |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| AIFA | — | — | — | — | 5 (49.º) | 185,733 (2.º) | 447,341 (1.º) | 406,193 (1.º) | 313,861 (1.º) |
| AICM | 581,675 (1.º) | 556,142 (1.º) | 469,714 (1.º) | 567,779 (1.º) | 570,808 (1.º) | 447,887 (1.º) | 240,035 (2.º) | 252,556 (2.º) | 188,419 (2.º) |
| Guadalajara | 164,242 (2.º) | 161,109 (2.º) | 161,593 (2.º) | 197,219 (2.º) | 176,779 (2.º) | 165,006 (3.º) | 173,711 (3.º) | 183,410 (3.º) | 151,595 (3.º) |
| Monterrey | 56,282 (3.º) | 51,983 (3.º) | 49,038 (3.º) | 67,627 (3.º) | 77,764 (3.º) | 74,970 (5.º) | 79,425 (4.º) | 76,282 (4.º) | 62,298 (4.º) |
| Querétaro | 53,290 (4.º) | 50,813 (4.º) | 45,145 (4.º) | 64,888 (4.º) | 72,847 (4.º) | 79,824 (4.º) | 77,391 (5.º) | 76,025 (5.º) | 61,723 (5.º) |
| Tijuana | 27,171 (7.º) | 30,707 (7.º) | 28,332 (6.º) | 35,449 (6.º) | 37,427 (7.º) | 35,265 (8.º) | 38,570 (7.º) | 37,894 (6.º) | 25,515 (6.º) |
| Cancún | 32,858 (6.º) | 31,476 (6.º) | 17,715 (9.º) | 30,867 (7.º) | 45,868 (5.º) | 38,822 (6.º) | 36,166 (8.º) | 36,207 (7.º) | 22,214 (7.º) |
| Toluca | 36,491 (5.º) | 35,779 (5.º) | 44,833 (5.º) | 54,943 (5.º) | 43,205 (6.º) | 37,694 (7.º) | 39,109 (6.º) | 30,399 (8.º) | 18,680 (8.º) |
| San Luis Potosí | 24,760 (8.º) | 24,169 (8.º) | 22,004 (7.º) | 26,718 (8.º) | 28,790 (8.º) | 28,737 (9.º) | 27,500 (9.º) | 26,620 (9.º) | 17,181 (10.º) |
| Mérida | 20,648 (9.º) | 22,445 (9.º) | 20,074 (8.º) | 22,458 (9.º) | 22,646 (9.º) | 26,027 (10.º) | 26,201 (10.º) | 25,439 (10.º) | 18,553 (9.º) |
| **País** | 1,055,429 | 1,025,465 | 910,656 | 1,136,661 | 1,149,878 | 1,196,088 | 1,263,586 | 1,232,809 | 946,610 |

Se ve el cambio: el AICM fue el primero del país hasta 2023 y en 2024 bajó a la mitad, el mismo
año en que el AIFA pasó al primer lugar. En 2022 el AIFA apenas movió 5 toneladas. Las cifras de
la serie pueden diferir un poco de las del informe de diciembre en la carga nacional e
internacional de cada aeropuerto, no en su total.

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

## 5. Polos del Bienestar

Parques industriales que el gobierno federal ha declarado en el Diario Oficial desde 2023.
**En el juego empiezan por construir**: el tablero los muestra donde estarán, como hexágonos
rosas punteados (capa *Polos*), y **construirlos es cosa del jugador**, como todo lo hecho de
2018 en adelante (ver [Construirlos](#construirlos)). Hasta que se construyen no reciben trenes
ni tienen estación; su ficha dice a cuántos kilómetros pasa la vía.

### Tres programas

| Programa | Nombre oficial | Polos vigentes | Primer y último declarado |
| --- | --- | ---: | --- |
| Corredor Interoceánico | Polos de Desarrollo para el Bienestar, del organismo Corredor Interoceánico del Istmo de Tehuantepec | 14 | 12 may 2023 · 8 jun 2026 |
| Plan México | Polos de Desarrollo Económico para el Bienestar (PODECOBI), de la Secretaría de Economía | 15 | 30 jun 2025 · 7 ago 2026 |
| Economía circular | Polos de Desarrollo de Economía Circular para el Bienestar, de la Semarnat | 3 | 2 mar 2026 · 27 jul 2026 |

Se tomaron **todos los declarados en el DOF hasta el 19 de noviembre de 2026**, buscando en el
propio Diario Oficial "Polo de Desarrollo … Bienestar": 33 declaratorias, de las que una (el
polo de economía circular Parque Hidalgo) fue abrogada. Un polo anunciado sin declaratoria no
tiene todavía terreno ni ubicación, así que no entra (ver al final de la sección).

### Cómo se ubicaron

Cada declaratoria trae un **cuadro de construcción**: la lista de vértices del polígono del
terreno, con sus coordenadas. Se leyeron con un programa —no a mano— desde la página de cada
nota en el DOF, se cerró cada polígono y se calcularon su área y su centroide:

1. **El punto del polo es el centroide de su polígono más grande.** Un polo puede ser varios
   terrenos (Altamira son cuatro en 18 km); el centroide de todos juntos podría caer en un
   terreno ajeno.
2. **Sistemas de coordenadas**: casi todas en UTM (WGS84), con la zona que dice el texto o, si
   no la dice, la que pone el punto en el estado declarado. La de Cancún viene en la cónica
   conforme de Lambert del INEGI, la misma proyección del tablero.
3. **Comprobación**: el área calculada del polígono contra la superficie que declara el
   documento. Coinciden dentro de ±5 % en 27 de los 29 cuadros leídos, muchas al centésimo de
   hectárea (Tuxpan 235.10 ha, Reserva Zapotlán 910.82, Chetumal 87.80). Las dos excepciones
   no afectan la ubicación: Texistepec da 9 % de más porque el DOF le descuenta 14 ha de derecho
   de vía del tren, y del de Puebla se leyó el 79 % de sus cinco polígonos. Además, **los 32 caen
   dentro de su estado** en el tablero.
4. **Erratas del DOF**: un vértice a kilómetros de sus dos vecinos, que están cerca entre sí, es
   un dígito equivocado en el documento y se descarta. Hubo dos: el vértice 81 de Ciudad Ixtepec
   (20 km fuera) y el cierre de Matías Romero, donde el vértice 1A se repite 57 km al sur de donde
   empezó la tabla.

Notas de la tabla:

- ¹ **Santa María Mixtequilla y Ciudad Ixtepec** traen sus coordenadas en el sistema **TME
  (Transversal Modificado Ejidal)** del Registro Agrario, cuyo meridiano central es el de cada
  ejido y no se publica. La latitud sí es exacta. La longitud se fijó poniendo el vértice sur
  de cada polígono sobre la autopista MEX-185D (trazo de OpenStreetMap), que es donde lo muestran
  los croquis de las declaratorias. Comprobación: en Ixtepec, alinear en cambio el polígono con
  el entronque MEX-185D / OAX 49 del croquis da un punto a 160 m de este.
- ² **Economía Circular Quintana Roo** publica su cuadro como imagen: se transcribieron sus
  vértices (UTM zona 16) y el área calculada, 39.90 ha, es exactamente la de la imagen.
- ³ **San Jerónimo** está al pie de la frontera, que ahí corre por el paralelo 31°47′ N. La
  frontera de Natural Earth que dibuja el tablero va ~1 km más al sur en ese tramo, así que el
  centroide (al sur de la línea real) quedaba del lado de Estados Unidos del dibujo: el
  marcador se bajó 750 m.

**Corredor Interoceánico**

| Polo | Municipio, estado | Superficie | Declaratoria (DOF) | Vía férrea más cercana |
| --- | --- | ---: | --- | ---: |
| Coatzacoalcos I | Coatzacoalcos, Veracruz | 258 ha | [12 may 2023](https://dof.gob.mx/nota_detalle.php?codigo=5688608&fecha=12/05/2023) | 1 km |
| Coatzacoalcos II | Coatzacoalcos, Veracruz | 132 ha | [12 may 2023](https://dof.gob.mx/nota_detalle.php?codigo=5688609&fecha=12/05/2023) | < 1 km |
| Salina Cruz | Salina Cruz, Oaxaca | 82.1 ha | [12 may 2023](https://dof.gob.mx/nota_detalle.php?codigo=5688610&fecha=12/05/2023) | 1 km |
| San Blas Atempa | San Blas Atempa, Oaxaca | 332 ha | [12 may 2023](https://dof.gob.mx/nota_detalle.php?codigo=5688611&fecha=12/05/2023) | 3 km |
| San Juan Evangelista | San Juan Evangelista, Veracruz | 360 ha | [12 may 2023](https://dof.gob.mx/nota_detalle.php?codigo=5688612&fecha=12/05/2023) | < 1 km |
| Texistepec | Texistepec y Jáltipan de Morelos, Veracruz | 462 ha | [12 may 2023](https://dof.gob.mx/nota_detalle.php?codigo=5688613&fecha=12/05/2023) | 2 km |
| Matías Romero Avendaño | Matías Romero Avendaño, Oaxaca | 179 ha | [11 oct 2023](https://dof.gob.mx/nota_detalle.php?codigo=5704695&fecha=11/10/2023) | 1 km |
| Santa María Mixtequilla ¹ | Santa María Mixtequilla, Oaxaca | 502 ha | [11 oct 2023](https://dof.gob.mx/nota_detalle.php?codigo=5704696&fecha=11/10/2023) | 7 km |
| Ciudad Ixtepec ¹ | Ciudad Ixtepec, Oaxaca | 413 ha | [11 oct 2023](https://dof.gob.mx/nota_detalle.php?codigo=5704697&fecha=11/10/2023) | 6 km |
| Asunción Ixtaltepec | Asunción Ixtaltepec, Oaxaca | 246 ha | [16 oct 2023](https://dof.gob.mx/nota_detalle.php?codigo=5705269&fecha=16/10/2023) | 3 km |
| Tapachula I | Tapachula, Chiapas | 263 ha | [8 abr 2025](https://dof.gob.mx/nota_detalle.php?codigo=5754325&fecha=08/04/2025) | 8 km |
| Tapachula II | Tapachula, Chiapas | 150 ha | [8 abr 2025](https://dof.gob.mx/nota_detalle.php?codigo=5754326&fecha=08/04/2025) | 10 km |
| Arriaga | Arriaga, Chiapas | 48.8 ha | [8 jun 2026](https://dof.gob.mx/nota_detalle.php?codigo=5789894&fecha=08/06/2026) | < 1 km |
| Teapa | Teapa, Tabasco | 96.1 ha | [8 jun 2026](https://dof.gob.mx/nota_detalle.php?codigo=5789895&fecha=08/06/2026) | 1 km |

**Plan México**

| Polo | Municipio, estado | Superficie | Declaratoria (DOF) | Vía férrea más cercana |
| --- | --- | ---: | --- | ---: |
| Seybaplaya I | Seybaplaya, Campeche | 100 ha | [30 jun 2025](https://dof.gob.mx/nota_detalle.php?codigo=5761459&fecha=30/06/2025) | 22 km |
| San Jerónimo ³ | Juárez, Chihuahua | 60.3 ha | [30 jun 2025](https://dof.gob.mx/nota_detalle.php?codigo=5761460&fecha=30/06/2025) | 10 km |
| Reserva Zapotlán | Zapotlán de Juárez, Hidalgo | 911 ha | [30 jun 2025](https://dof.gob.mx/nota_detalle.php?codigo=5761461&fecha=30/06/2025) | 1 km |
| Capital de la Tecnología y la Sostenibilidad | San José Chiapa y Nopalucan, Puebla | 275 ha | [1 jul 2025](https://dof.gob.mx/nota_detalle.php?codigo=5761567&fecha=01/07/2025) | 2 km |
| Chetumal | Othón P. Blanco, Quintana Roo | 87.8 ha | [1 jul 2025](https://dof.gob.mx/nota_detalle.php?codigo=5761568&fecha=01/07/2025) | 191 km |
| Parque Industrial Bajío | Zinapécuaro, Michoacán | 342 ha | [7 jul 2025](https://dof.gob.mx/nota_detalle.php?codigo=5762147&fecha=07/07/2025) | 2 km |
| Puerta Logística del Bajío | Celaya, Guanajuato | 52.4 ha | [21 jul 2025](https://dof.gob.mx/nota_detalle.php?codigo=5763405&fecha=21/07/2025) | 4 km |
| Nezahualcóyotl | Nezahualcóyotl, Estado de México | 68.4 ha | [7 ago 2025](https://dof.gob.mx/nota_detalle.php?codigo=5764903&fecha=07/08/2025) | 6 km |
| Huamantla | Huamantla, Tlaxcala | 53 ha | [14 ago 2025](https://dof.gob.mx/nota_detalle.php?codigo=5765468&fecha=14/08/2025) | < 1 km |
| Tuxpan | Tuxpan, Veracruz | 235 ha | [26 ago 2025](https://dof.gob.mx/nota_detalle.php?codigo=5766562&fecha=26/08/2025) | 93 km |
| Centro Logístico e Industrial de Durango | Durango, Durango | 315 ha | [26 ago 2025](https://dof.gob.mx/nota_detalle.php?codigo=5766563&fecha=26/08/2025) | 2 km |
| Bienestar e Innovación de Hermosillo | Hermosillo, Sonora | 546 ha | [26 ago 2025](https://dof.gob.mx/nota_detalle.php?codigo=5766564&fecha=26/08/2025) | 3 km |
| Altamira | Altamira, Tamaulipas | 1,638 ha | [21 oct 2025](https://dof.gob.mx/nota_detalle.php?codigo=5770448&fecha=21/10/2025) | 5 km |
| Topolobampo | Ahome, Sinaloa | 278 ha | [20 mar 2026](https://dof.gob.mx/nota_detalle.php?codigo=5782770&fecha=20/03/2026) | < 1 km |
| Distrito Financiero y Tecnológico de Cancún | Benito Juárez, Quintana Roo | 60.8 ha | [7 ago 2026](https://dof.gob.mx/nota_detalle.php?codigo=5795731&fecha=07/08/2026) | 128 km |

**Economía circular**

| Polo | Municipio, estado | Superficie | Declaratoria (DOF) | Vía férrea más cercana |
| --- | --- | ---: | --- | ---: |
| Economía Circular Puebla | San José Chiapa, Puebla | 40.4 ha | [2 mar 2026](https://dof.gob.mx/nota_detalle.php?codigo=5781224&fecha=02/03/2026) | < 1 km |
| Economía Circular Tlaxcala | Atlangatepec, Tlaxcala | 20 ha | [8 jun 2026](https://dof.gob.mx/nota_detalle.php?codigo=5789881&fecha=08/06/2026) | 1 km |
| Economía Circular Quintana Roo ² | Puerto Morelos, Quintana Roo | 39.9 ha | [27 jul 2026](https://dof.gob.mx/nota_detalle.php?codigo=5794759&fecha=27/07/2026) | 128 km |

Total: 32 polos, 8,647 ha.

Los enlaces llevan a cada declaratoria en el DOF. Topolobampo usa el polígono del acuerdo que la
modificó el 29 de abril de 2026; Reserva Zapotlán y Capital de la Tecnología tienen notas
aclaratorias (ver la [bitácora](#12-bitácora-de-correcciones-a-los-datos)).

### Lo que dicen

- **Casi todos están junto al tren**: 27 de los 32 quedan a 15 km o menos de una vía (el
  alcance de una estación en el juego) y 15 a 2 km o menos. Los del Istmo están literalmente
  sobre la Línea Z.
- **Los que no tienen vía**: Chetumal (191 km), Cancún (128) y Economía Circular Quintana Roo
  (128) esperan al Tren Maya, que es posterior a 2018 y por lo tanto le toca al jugador; Tuxpan
  (93 km) y Seybaplaya (22 km) no tienen vía en la red base.
- **Nueve quedan a 25 km o menos de un puerto del juego**: los dos de Coatzacoalcos, Salina
  Cruz, San Blas Atempa, los dos de Tapachula (junto a Puerto Chiapas), Tuxpan, Altamira y
  Topolobampo.

### Anunciados sin declaratoria

La lámina de la Secretaría de Economía del 22 de mayo de 2025 mostraba polos que no tienen
declaratoria al 19 de noviembre de 2026 y por eso no están en el tablero: Tula (Hidalgo),
zona metropolitana de Mérida, Lázaro Cárdenas–La Unión (Guerrero), Zona Carbonífera (Coahuila)
y una tercera etapa por estados. Otros sí se declararon, pero con otro nombre o en otro
municipio: "Juárez" es San Jerónimo, "AIFA" es Reserva Zapotlán, "Ciudad Modelo" es Capital de
la Tecnología (San José Chiapa), "Celaya" es Puerta Logística del Bajío y "Morelia" es el Parque
Industrial Bajío, en Zinapécuaro. El de Cancún no estaba en esa lámina.

### Construirlos

El jugador es **el Estado**: tiene un presupuesto y lo usa para construir polos. Cada polo pasa
por tres fases:

1. **Por construir.** Su ficha (clic en el polo) deja elegir de 1 a 4 **cuadrillas** y muestra
   el costo, la duración, la gente que trabajará en la obra y los empleos que dará lleno.
   *Construir* pide confirmación.
2. **En obra.** Se paga conforme avanza, como la obra pública. Si el presupuesto se acaba, la
   obra **se detiene** donde va. Un anillo alrededor del polo muestra el avance (rojo si está
   detenida).
3. **Operando.** Si hay vía a 15 km o menos, al terminarse le nace su **estación** y recibe
   trenes. Las empresas llegan **solo si hay tren**: la ocupación crece en una curva lenta al
   principio, rápida a la mitad y lenta al final, y llena el polo en tres años. Un polo construido
   sin vía cercana queda vacío hasta que el jugador lleve el tren.

**Cómo se calculan** (`domain/obras.ts`, con las cifras de `datos/calibracion.json`):

| Qué | Fórmula | De dónde sale |
| --- | --- | --- |
| Costo | 5.49 millones de pesos por hectárea, +15 % por cada cuadrilla extra | Reserva Zapotlán: «alrededor de 5 mil millones de pesos» en obras de infraestructura para 910.82 ha (su declaratoria, DOF 30 jun 2025) |
| Duración, 1 cuadrilla | 24 meses × (hectáreas ÷ 53)^0.3 | Un parque industrial «en promedio toma 2 años, cuando menos» (inauguración de Huamantla, 12 abr 2026). El exponente 0.3 hace que los polos grandes tarden más pero no en proporción, porque se construyen por frentes y fases a la vez |
| Duración, n cuadrillas | la de una ÷ n^0.75 | El exponente sale de pedir que 4 cuadrillas igualen el récord de Huamantla: 53 ha en 8.5 meses (compromiso del 28 jul 2025, 20 % el 14 oct 2025, inaugurado el 12 abr 2026) |
| Gente trabajando en la obra | 1.187 empleos-año por millón de pesos, repartidos en lo que dura | Construcción en Veracruz, 2023: 26,482 personas ocupadas con 22,308 millones de pesos de producción (INEGI, Censos Económicos 2024) |
| Empleos permanentes | 94.3 por hectárea × ocupación | Huamantla «generará más de 5 mil empleos directos e indirectos» en 53 ha (Presidencia, 12 abr 2026) |
| Ocupación | de 0 a 100 % en 3 años, solo con tren | Supuesto del juego: no hay cifra oficial de cuánto tarda un polo en llenarse |
| Dinero para construir | El presupuesto del Estado: llega cada mes (ver [El presupuesto del Estado](#el-presupuesto-del-estado)) | Presupuesto federal real para ferrocarriles y derecho de las concesionarias |

Ejemplos (calculados con el código del juego):

| Polo | Superficie | Cuadrillas | Costo | Duración | Gente en la obra | Empleos lleno |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Huamantla | 53 ha | 1 | 291 millones | 24 meses | 173 | 4,998 |
| Huamantla | 53 ha | 4 | 422 millones | 8.5 meses | 707 | 4,998 |
| Tuxpan | 235 ha | 1 | 1,291 millones | 37.5 meses | 490 | 22,170 |
| Tuxpan | 235 ha | 4 | 1,872 millones | 13.3 meses | 2,006 | 22,170 |
| Reserva Zapotlán | 911 ha | 1 | 5,000 millones | 56.3 meses | 1,264 | 85,890 |
| Reserva Zapotlán | 911 ha | 4 | 7,251 millones | 20 meses | 5,177 | 85,890 |
| Altamira | 1,638 ha | 1 | 8,991 millones | 67.2 meses | 1,907 | 154,443 |
| Altamira | 1,638 ha | 4 | 13,038 millones | 23.8 meses | 7,806 | 154,443 |

**Lo que se sabe y lo que no.** El costo sale de un solo polo (Zapotlán) y los empleos
permanentes de otro (Huamantla); estos últimos son una proyección e incluyen indirectos. La
razón de empleos de obra es la de la construcción en Veracruz, no la nacional. Cuando el
gobierno publique más polos terminados, se recalibra (ver *Mantener el juego al día* en
[Fuentes](#1-fuentes)). Dato de contexto del informe 2025–2026 del Corredor Interoceánico: sus
polos se concesionan a desarrolladores privados, y de nueve concesionados en 2025 quedaron cinco
en 2026 (tres concesionarios incumplieron y uno renunció).

---

## 6. Red ferroviaria

### Origen

Las vías son las de Norteamérica de Natural Earth, que provienen del Atlas Ambiental de
América del Norte de la CCA ([Fuentes](#1-fuentes)). Es una red de **alrededor de 2010**: no
incluye obras recientes como el Tren Maya. Eso es deliberado en el juego: ver
[Decisiones de diseño](#11-decisiones-de-diseño).

### Vías primarias y secundarias

Natural Earth le da a cada línea un `scalerank`: la escala más pequeña a la que esa línea
todavía merece dibujarse. Es una **clasificación cartográfica de Natural Earth, no la de los
operadores ferroviarios**, pero sigue de cerca los corredores troncales. El juego la usa así:

| Clase | `scalerank` | En el mapa | Velocidad de un tren | km en la red |
| --- | --- | --- | --- | ---: |
| Primaria | 6 o menos | Ámbar intenso y más gruesa | 60 km/h | 10,139 |
| Secundaria | más de 6 | Ámbar tenue y delgada | 40 km/h | 9,075 |

### Dueños

Cada tramo tiene dueño: la empresa que tenía su concesión en 2018, o el Estado. Las vías
concesionadas siguen siendo privadas en el juego; las que el jugador construya serán del
Estado (ver [Decisiones de diseño](#11-decisiones-de-diseño)).

| Dueño | Tipo | km en servicio | km fuera de operación | Trenes privados al día (promedio) |
| --- | --- | ---: | ---: | ---: |
| Ferromex | Privada | 7,625 | 1,165 | 5.9 |
| Kansas City Southern de México (hoy CPKC) | Privada | 3,306 | 925 | 8.3 |
| Ferrosur | Privada | 1,186 | 372 | 5.7 |
| Línea Coahuila–Durango | Privada | 897 | 432 | 2.5 |
| Ferrovalle (Valle de México) | Mixta: 25 % de cada troncal y 25 % del gobierno federal | 165 | — | 5.6 ¹ |
| **Ferrocarril del Istmo de Tehuantepec** (Istmo, Chiapas–Mayab y Oaxaca) | **Estatal** | **2,384** | 91 | 0.8 |
| Tijuana–Tecate (Gobierno de Baja California) | Estatal | 60 | — | 0.4 |
| Sin dueño identificado | — | — | 606 | — |

¹ Ferrovalle no tiene dato propio: se usa el promedio del sistema.

**Cómo se supo.** OpenStreetMap trae el operador de casi toda la red en uso. Donde no lo
trae, se usó la letra de la línea (A, B, M…) con la tabla oficial de derechos de paso
obligatorios de la ARTF, que dice qué empresa tiene cada línea y kilómetro. OpenStreetMap
describe 2026, así que se corrigió a 2018 donde el dueño cambió (ver la
[bitácora](#12-bitácora-de-correcciones-a-los-datos)). Los km por empresa cuadran con los
del Anuario 2018. El reparto se hizo tramo por tramo, por mayoría de km: un tramo largo que
cruza de una empresa a otra queda entero con la que tiene más.

**Fuera de operación.** 3,590 km de la red del juego ya no tenían trenes en 2018: Ciudad
Juárez–Casas Grandes, Saltillo–Torreón, San Luis Potosí–San Miguel de Allende–Celaya,
México–Cuernavaca–Iguala, Durango–Tepehuanes, Tepic–Ameca y varios ramales del Bajío, de
Hidalgo, de Veracruz y de Oaxaca. Se ven punteadas y apagadas: no pasan trenes, no anclan
estaciones y la ruta más rápida no las usa. **Rehabilitarlas será una obra del Estado.**

**Trenes privados al día.** Es el tráfico de cada empresa en 2018, en promedio por km de su
red y contando los dos sentidos: su densidad de tráfico (toneladas-km por km de vía) entre lo
que lleva un tren (toneladas netas por tren-km), entre 365 días (SNIF 2022). Esos trenes no
los controla el jugador, pero ocupan la vía.

### Tráfico y capacidad

Una vía aguanta un número de trenes al día. En vía sencilla, dos trenes en sentido contrario
no pueden pasar a la vez: uno espera en un escape (un tramo corto de vía paralela). Por eso
una vía sencilla aguanta pocos trenes, y cuando se llena, los trenes pasan más tiempo
esperando que avanzando.

| Cómo se opera la vía | Trenes al día que caben | km en la red |
| --- | ---: | ---: |
| Sencilla, con autorización de tramos (casi toda la red mexicana) | 16 | 14,726 |
| Sencilla, con control de tráfico centralizado | 30 | 689 |
| Doble (Monterrey–Saltillo y Querétaro) | 75 | 208 |

Las capacidades vienen de un estudio de Estados Unidos (AAR, 2007); no hay cifra oficial
mexicana. Ferromex reporta 6,206 km con autorización de tramos y solo 661 km con control
centralizado.

**Los corredores fuertes** llevan más que el promedio de su empresa:

| Corredor | Trenes privados al día | Capacidad | De dónde sale |
| --- | ---: | --- | --- |
| Nuevo Laredo–Monterrey | 23 | Control centralizado (30) | 4,251 trenes cruzaron a EUA por Nuevo Laredo en 2018: 11.6 al día hacia el norte, unos 23 contando los dos sentidos |
| Piedras Negras–Saltillo | 21 | Control centralizado (30) | 3,762 trenes cruzaron por Piedras Negras en 2025 |
| Ciudad Juárez–Chihuahua | 7 | Sencilla (16) | 1,356 trenes cruzaron por Ciudad Juárez en 2025 |
| Monterrey–San Luis Potosí–Querétaro–Ciudad de México | 14 | Sencilla (16) | Estimación del juego: seis de cada diez toneladas que cruzan por Nuevo Laredo siguen al sur de Monterrey (pares origen–destino de 2025) |

Un corredor que mueve más de 16 trenes al día tiene que tener control centralizado, porque
si no, no le cabrían: por eso los dos primeros tienen capacidad de 30.

**Uso y velocidad.** El uso de una vía es la suma de los trenes privados y los del jugador,
entre lo que cabe. Los del jugador se cuentan por su horario: cuántas veces al día pasa cada
tren por esa vía, en los dos sentidos. Pasado el 60 % (el techo diario que recomienda el
método internacional de capacidad UIC 406, que adoptó la ARTF), los trenes empiezan a
esperarse y su velocidad promedio baja:

| Uso de la vía | Velocidad de los trenes | En el mapa (modo *Uso*) |
| --- | ---: | --- |
| Hasta 60 % | 100 % | Verde: holgada |
| 80 % | 80 % | Ámbar: cargada |
| 100 % | 60 % | Ámbar: cargada |
| 125 % | 40 % | Rojo: saturada |
| 150 % o más | 30 % (nunca menos de 25 %) | Rojo: saturada |

Afecta a todos los trenes del jugador que pasan por esa vía, incluso los que ya van en
camino. Al arrancar la partida, con los 8 servicios iniciales, 1,654 km quedan cargados
(casi toda la troncal México–Querétaro–San Luis Potosí–Monterrey y Nuevo Laredo–Monterrey) y
5 km saturados (un tramo de Ferrovalle en la Ciudad de México).

**En el mapa.** El panel de vías, sobre los botones de capas, cambia el color de la red:
**Clase** (troncal o secundaria, como siempre), **Dueño** o **Uso**. Al pasar el cursor por
una vía, su ficha dice de quién es, cómo se opera, cuántos trenes lleva (privados y del
jugador) de cuántos caben, y cuánto más lento van los trenes si está cargada o saturada.

### Cifras

| | |
| --- | --- |
| Longitud total | 19,214 km: 15,623 en servicio y 3,590 fuera de operación |
| Nodos y tramos del archivo | 198 nodos, 231 tramos |
| Nodos y tramos con estaciones | 249 nodos, 282 tramos (cada estación puede partir un tramo) |
| Sitios con estación | 59 de 73 (ciudades y puertos) |
| Piezas conectadas | 4, contando solo la vía en servicio |

Las cuatro piezas:

| Pieza | km en servicio | Conexión |
| --- | ---: | --- |
| Red nacional | 15,284 | La que usan todos los servicios |
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

Solo la vía en servicio da estación: una vía fuera de operación junto a un sitio no le
sirve.

**Sin vía** (14 sitios): Acapulco, Cancún, Chetumal, Chilpancingo, Ciudad del Carmen,
Cuernavaca (su vía a la capital está fuera de operación), Dos Bocas, Ensenada (ciudad y
puerto), La Paz, Puerto Vallarta, Tuxpan, Tuxtla Gutiérrez y Villahermosa.

**Cancún** es la excepción: su estación se busca en Cancún Aeropuerto, la del Tren Maya, a unos
16 km del centro. Sin vía no cambia nada; con el Tren Maya construido, Cancún tiene estación.

### Obras del Estado

El jugador construye vía desde el catálogo de **Obras del Estado** (en el panel del
presupuesto, *Obras del Estado →*). No hay trazo libre: cada obra es real (construida, en
obra o anunciada desde 2018) y va por su trazo oficial. El jugador decide **cuáles y cuándo**.
Toda vía que construye es **del Estado**. Hay cuatro clases de obra:

| Clase | Qué hace | Capacidad |
| --- | --- | ---: |
| **Vía nueva** | Vía donde no había, por el trazo oficial (OpenStreetMap). Sus puntas se unen a la vía en servicio si pasa a 6 km o menos | La de la obra |
| **Doble vía paralela** | Las líneas de pasajeros: una doble vía del Estado junto a la de carga, entre las paradas de la línea. Los trenes privados siguen en la suya; los del jugador pasan a la del Estado | 75 |
| **Modernización** | Las líneas del propio Estado (el Interoceánico) se reconstruyen: pasan a troncal (60 km/h) y a control centralizado | 30 |
| **Rehabilitación** | Una vía fuera de operación vuelve al servicio y pasa al Estado | 16 |

**Cómo se construye.** Igual que un polo: de 1 a 4 cuadrillas, se paga conforme avanza y se
detiene si se acaba el dinero. **Cuatro cuadrillas son el ritmo y el costo del gobierno**: el
costo oficial por km y el tiempo oficial. Con menos, la obra sale más barata y tarda más, con
las mismas reglas de los polos (cada cuadrilla extra encarece 15 %; el tiempo se divide entre
las cuadrillas a la 0.75). La gente en la obra sale de la misma razón del INEGI: 1.187
empleos-año por millón de pesos.

**Al terminarse**, la red se reconstruye con la obra: los sitios cercanos ganan estación (un
polo construido junto a la vía nueva empieza a llenarse), y todos los trenes del jugador
vuelven a buscar su camino, sin perder su lugar en el horario. Para elegir camino, un tren
pesa cada vía por el tiempo que le toma **con su uso actual**: rodea una vía saturada si hay
otra, y a igual tiempo prefiere la vía del Estado (no paga por pasar).

**De dónde salen las cifras:**

| Obra | Costo por km | Tiempo con 4 cuadrillas |
| --- | --- | --- |
| Tren Maya, tramos 1 a 3 (sobre el derecho de vía viejo) | 169.8 millones (ASF) | 42 meses: obra de junio de 2020 a diciembre de 2023 |
| Tren Maya, tramos 4, 5 Norte, 6 y 7 (vía nueva a nivel) | 257.9 millones (ASF) | Tramo 4: 42 meses. Los demás: 26 meses, el ritmo de la Defensa (553 km en 788 días) |
| Tren Maya, tramo 5 Sur (viaducto) | 1,175 millones (ASF) | 26 meses |
| Dos Bocas | 65.8 millones (SICT: 6,054.4 millones para 92 km, estimado de 2022) | 17 meses: octubre de 2025 a marzo de 2027 |
| Interoceánico, líneas Z, FA y K | 139 millones, promedio de su rehabilitación (Cuenta Pública 2025) | Z y K: 42 meses; FA: 20 meses |
| Trenes de pasajeros con costo oficial | El de Presidencia entre sus km: AIFA–Pachuca 837.3; México–Querétaro 634.7; Querétaro–Irapuato 435.2; Saltillo–Nuevo Laredo 353.5 | Pachuca y Querétaro: inauguración en 2027 (se toma diciembre). Querétaro–Irapuato: 54 meses, al ritmo de su avance. Saltillo–Nuevo Laredo: estimado |
| Trenes de pasajeros sin costo oficial | 480.5 millones, el promedio de los cuatro anteriores (estimación del juego) | Estimado: el ritmo de México–Querétaro (32 meses para 226 km), creciendo con el largo a la 0.3 |
| El Insurgente | 1,733 millones (Presidencia: unos 100 mil millones para 57.7 km; casi todo viaducto y túnel) | Estimado como los de pasajeros (la obra real duró de 2014 a 2026) |
| Rehabilitaciones | 139 millones, como el Interoceánico | Estimado: el ritmo de la Línea K (447 km en 42 meses), creciendo con el largo a la 0.3 |

El costo por km se multiplica por los km **del juego**: los del trazo oficial en las vías
nuevas, y los de la ruta por la red de 2018 en las paralelas y modernizaciones, que pueden
diferir de los oficiales (México–Pachuca mide 93 km en el juego porque sale del centro de la
Ciudad de México; la línea real sale del AIFA y mide 57).

**El catálogo** (calculado con el código del juego):

**Tren Maya.** Vía nueva por la península, en los tramos en que se licitó y construyó.

| Obra | km | 4 cuadrillas (ritmo del gobierno) | 1 cuadrilla | En la realidad |
| --- | ---: | --- | --- | --- |
| Tren Maya, tramo 1: Palenque–Escárcega | 225 | 38.3 mil millones · 3.5 años · 12,980 personas | 26.4 mil millones · 9.9 años | Inaugurado el 15 de diciembre de 2023. |
| Tren Maya, tramo 2: Escárcega–Calkiní | 241 | 40.9 mil millones · 3.5 años · 13,873 personas | 28.2 mil millones · 9.9 años | Inaugurado el 15 de diciembre de 2023. |
| Tren Maya, tramo 3: Calkiní–Izamal | 147 | 25 mil millones · 3.5 años · 8,488 personas | 17.3 mil millones · 9.9 años | Inaugurado el 15 de diciembre de 2023. |
| Tren Maya, tramo 4: Izamal–Cancún | 241 | 62.1 mil millones · 3.5 años · 21,070 personas | 42.8 mil millones · 9.9 años | Inaugurado el 15 de diciembre de 2023. |
| Tren Maya, tramo 5 Norte: Cancún–Playa del Carmen | 51 | 13.1 mil millones · 2.2 años · 7,178 personas | 9 mil millones · 6.1 años | Inaugurado el 29 de febrero de 2024. |
| Tren Maya, tramo 5 Sur: Playa del Carmen–Tulum (viaducto) | 65 | 76.7 mil millones · 2.2 años · 42,035 personas | 52.9 mil millones · 6.1 años | En servicio desde 2024. |
| Tren Maya, tramo 6: Tulum–Chetumal | 250 | 64.5 mil millones · 2.2 años · 35,351 personas | 44.5 mil millones · 6.1 años | Inaugurado el 15 de diciembre de 2024. |
| Tren Maya, tramo 7: Chetumal–Escárcega | 272 | 70 mil millones · 2.2 años · 38,374 personas | 48.3 mil millones · 6.1 años | Inaugurado el 15 de diciembre de 2024. |

**Carga.** Ramales nuevos de carga.

| Obra | km | 4 cuadrillas (ritmo del gobierno) | 1 cuadrilla | En la realidad |
| --- | ---: | --- | --- | --- |
| Ramal Roberto Ayala–Dos Bocas | 96 | 6.3 mil millones · 1.4 años · 5,293 personas | 4.4 mil millones · 4.0 años | En obra desde octubre de 2025; unos 38 km construidos en septiembre de 2026. |

**Corredor Interoceánico.** Modernizar las líneas del propio Estado: más velocidad y más capacidad.

| Obra | km | 4 cuadrillas (ritmo del gobierno) | 1 cuadrilla | En la realidad |
| --- | ---: | --- | --- | --- |
| Interoceánico, Línea Z: Coatzacoalcos–Salina Cruz | 274 | 38.1 mil millones · 3.5 años · 12,913 personas | 26.3 mil millones · 9.9 años | Rehabilitada; pasajeros desde diciembre de 2023 (solo carga desde el descarrilamiento del 28 de diciembre de 2025). |
| Interoceánico, Línea FA: Coatzacoalcos–Palenque | 314 | 43.6 mil millones · 1.7 años · 31,087 personas | 30.1 mil millones · 4.7 años | En operación desde el 13 de septiembre de 2024. |
| Interoceánico, Línea K: Ixtepec–Ciudad Hidalgo | 451 | 62.6 mil millones · 3.5 años · 21,242 personas | 43.2 mil millones · 9.9 años | Tramo Ixtepec–Tonalá abierto el 21 de noviembre de 2025; el resto, en obra. |

**Trenes de pasajeros.** Doble vía del Estado junto a la vía de carga concesionada.

| Obra | km | 4 cuadrillas (ritmo del gobierno) | 1 cuadrilla | En la realidad |
| --- | ---: | --- | --- | --- |
| Tren México–Pachuca (AIFA–Pachuca) | 93 | 78.2 mil millones · 2.8 años · 33,759 personas | 53.9 mil millones · 7.8 años | En obra: 45 % al 23 de septiembre de 2026. |
| Tren México–Querétaro | 215 | 136.4 mil millones · 2.7 años · 60,705 personas | 94.1 mil millones · 7.5 años | En obra: 32 % al 31 de octubre de 2026. |
| Tren Querétaro–Irapuato | 124 | 53.9 mil millones · 4.5 años · 14,213 personas | 37.2 mil millones · 12.7 años | En obra: 22 % al 23 de septiembre de 2026. |
| Tren Saltillo–Monterrey–Nuevo Laredo | 366 | 129.4 mil millones · 3.2 años · 48,649 personas | 89.3 mil millones · 8.9 años | En obra: 10 % al 23 de septiembre de 2026. |
| Tren Irapuato–León–Guadalajara | 392 | 188.3 mil millones · 2.6 años · 86,244 personas | 129.9 mil millones · 7.3 años | Anunciado; arranque de obra prometido para finales de 2026. |
| Tren Querétaro–San Luis Potosí–Saltillo | 619 | 297.6 mil millones · 3.5 años · 100,222 personas | 205.3 mil millones · 10.0 años | En licitación (septiembre–octubre de 2026). |
| Tren Mazatlán–Los Mochis | 455 | 218.8 mil millones · 3.3 años · 79,709 personas | 150.9 mil millones · 9.2 años | Ingeniería básica (septiembre de 2026). |
| Tren Guadalajara–Tepic | 233 | 111.9 mil millones · 2.6 años · 51,427 personas | 77.2 mil millones · 7.3 años | En planeación (fase 3 del plan de la SICT). |
| Tren Los Mochis–Guaymas | 371 | 178.3 mil millones · 3.1 años · 68,843 personas | 123 mil millones · 8.7 años | En planeación (fase 3 del plan de la SICT). |
| Tren Guaymas–Hermosillo | 147 | 70.6 mil millones · 2.3 años · 36,683 personas | 48.7 mil millones · 6.4 años | En planeación (fase 3 del plan de la SICT). |
| Tren Tepic–Mazatlán | 304 | 146.1 mil millones · 2.8 años · 61,400 personas | 100.8 mil millones · 8.0 años | Anunciado (fase 4); sin actividades en 2026. |
| Tren Hermosillo–Nogales | 270 | 129.9 mil millones · 2.8 años · 54,422 personas | 89.6 mil millones · 8.0 años | Anunciado (fase 4); sin actividades en 2026. |
| Tren El Insurgente: México–Toluca | 69 | 120.2 mil millones · 1.8 años · 80,746 personas | 82.9 mil millones · 5.0 años | Completo desde el 2 de febrero de 2026 (Zinacantepec–Observatorio). |

**Rehabilitar vías muertas.** Vías fuera de operación desde antes de 2018: vuelven al servicio y pasan al Estado.

| Obra | km | 4 cuadrillas (ritmo del gobierno) | 1 cuadrilla | En la realidad |
| --- | ---: | --- | --- | --- |
| México–Cuernavaca–Balsas y Puebla–Cuautla | 519 | 72.1 mil millones · 3.7 años · 23,393 personas | 49.7 mil millones · 10.3 años | Fuera de operación desde antes de 2018. |
| Ciudad Juárez–Casas Grandes–La Junta | 505 | 70.2 mil millones · 3.6 años · 22,925 personas | 48.4 mil millones · 10.3 años | Fuera de operación desde antes de 2018. |
| Durango–Tepehuanes y vías hacia la sierra | 465 | 64.6 mil millones · 3.5 años · 21,662 personas | 44.6 mil millones · 10.0 años | Fuera de operación desde antes de 2018. |
| Saltillo–Parras–Torreón | 446 | 62 mil millones · 3.5 años · 21,026 personas | 42.8 mil millones · 9.9 años | Fuera de operación desde antes de 2018. |
| San Luis Potosí–San Miguel de Allende | 184 | 25.6 mil millones · 2.7 años · 11,310 personas | 17.6 mil millones · 7.6 años | Fuera de operación desde antes de 2018. |
| Ramal de Sierra Mojada (Coahuila) | 171 | 23.8 mil millones · 2.6 años · 10,750 personas | 16.4 mil millones · 7.4 años | Fuera de operación desde antes de 2018. |
| Jiménez–Parral (Chihuahua) | 157 | 21.8 mil millones · 2.6 años · 10,097 personas | 15 mil millones · 7.2 años | Fuera de operación desde antes de 2018. |
| Ramales de Pachuca y Tulancingo | 126 | 17.5 mil millones · 2.4 años · 8,675 personas | 12.1 mil millones · 6.8 años | Fuera de operación desde antes de 2018. |
| Ramal de El Mante (Tamaulipas) | 125 | 17.4 mil millones · 2.4 años · 8,642 personas | 12 mil millones · 6.8 años | Fuera de operación desde antes de 2018. |
| Yurécuaro–Zamora–Los Reyes | 122 | 16.9 mil millones · 2.4 años · 8,475 personas | 11.7 mil millones · 6.7 años | Fuera de operación desde antes de 2018. |
| Rodríguez Clara–San Andrés Tuxtla | 102 | 14.1 mil millones · 2.3 años · 7,445 personas | 9.7 mil millones · 6.4 años | Fuera de operación desde antes de 2018. |
| Guadalajara–Etzatlán | 91 | 12.7 mil millones · 2.2 años · 6,938 personas | 8.8 mil millones · 6.1 años | Fuera de operación desde antes de 2018. |
| Ramal de Ocotlán (Oaxaca) | 91 | 12.7 mil millones · 2.2 años · 6,912 personas | 8.7 mil millones · 6.1 años | Fuera de operación desde antes de 2018. |
| Oriental–Teziutlán | 85 | 11.9 mil millones · 2.1 años · 6,632 personas | 8.2 mil millones · 6.0 años | Fuera de operación desde antes de 2018. |
| Ramal de Pánuco (Veracruz) | 77 | 10.8 mil millones · 2.1 años · 6,181 personas | 7.4 mil millones · 5.8 años | Fuera de operación desde antes de 2018. |
| Maravatío–Zitácuaro | 77 | 10.8 mil millones · 2.1 años · 6,181 personas | 7.4 mil millones · 5.8 años | Fuera de operación desde antes de 2018. |

Todo el catálogo: 41 obras, 9,630 km, 2,865.8 mil millones al ritmo del gobierno.

Lo que el Tren Maya costó de verdad incluye trenes, estaciones y talleres (Presidencia: "un
poco más de 500 mil millones"); el juego solo cobra la vía.

**El dinero marca el ritmo.** Las obras se pagan del presupuesto del Estado, que llega cada
mes (ver [El presupuesto del Estado](#el-presupuesto-del-estado)). Si el ritmo elegido cuesta
más al mes de lo que llega, la obra se detiene cuando se vacía la caja y sigue con cada
mensualidad. La ficha avisa cuánto tardaría de verdad al paso del dinero, con el presupuesto
real de cada año y si no hay otras obras: México–Querétaro, empezada al arrancar la partida
con 4 cuadrillas, tardaría unos 4 años 5 meses en vez de 2 años 8, porque 2019 y 2020 fueron
años flacos y 2022 uno muy gordo. Del 1 de diciembre de 2018 al 31 de diciembre de 2027 llegan
unos 981 mil millones: alcanza para un tercio del catálogo.

---

## 7. Servicios de tren

El tablero arranca con **8 servicios de carga** sobre corredores reales. Solo se definen las
paradas: el camino entre ellas lo calcula el juego (la ruta más rápida por la red).
"Marcha" es el tiempo en movimiento por sentido; la vuelta completa suma ida, regreso y las
esperas de carga en cada parada. Los tiempos ya cuentan lo que frenan las vías cargadas al
arrancar (ver [Tráfico y capacidad](#tráfico-y-capacidad)); entre paréntesis, el tiempo con
la vía libre cuando es distinto.

| Servicio | Paradas | km por sentido | Marcha por sentido | Vuelta completa | Corredor |
| --- | --- | ---: | ---: | ---: | --- |
| Manzanillo ⇄ CDMX | Manzanillo → Guadalajara → Ciudad de México | 907 | 17.3 h (15.1) | 42.6 h (38.2) | Del Pacífico al centro |
| Lázaro Cárdenas ⇄ Nuevo Laredo | Lázaro Cárdenas → San Luis Potosí → Monterrey → Nuevo Laredo | 1,449 | 30.0 h (25.3) | 70.0 h (60.6) | Del Pacífico a la frontera con Texas |
| Veracruz ⇄ CDMX | Veracruz → Puebla → Ciudad de México | 452 | 8.0 h | 24.1 h | Del Golfo al centro |
| CDMX ⇄ Ciudad Juárez | Ciudad de México → Querétaro → Torreón → Chihuahua → Ciudad Juárez | 1,910 | 34.0 h (31.8) | 80.0 h (75.7) | Corredor central, hacia El Paso |
| Guadalajara ⇄ Nogales | Guadalajara → Mazatlán → Hermosillo → Nogales | 1,702 | 28.4 h | 66.7 h | Línea del Pacífico, hacia Arizona |
| Altamira ⇄ Monterrey | Altamira → Monterrey | 507 | 12.6 h | 31.3 h | Del puerto industrial del Golfo a Monterrey |
| Coatzacoalcos ⇄ Salina Cruz | Coatzacoalcos → Salina Cruz | 274 | 4.6 h | 15.1 h | El Istmo de Tehuantepec, de océano a océano |
| Coatzacoalcos ⇄ Progreso | Coatzacoalcos → Mérida → Progreso | 909 | 15.1 h | 38.3 h | Del Istmo a la península de Yucatán |

Detalle por tramo (ida):

- **Manzanillo ⇄ CDMX**: Manzanillo–Guadalajara 332 km (5.5 h) · Guadalajara–CDMX 575 km
  (11.8 h).
- **Lázaro Cárdenas ⇄ Nuevo Laredo**: Lázaro Cárdenas–San Luis Potosí 703 km (13.9 h) · San
  Luis Potosí–Monterrey 477 km (10.6 h) · Monterrey–Nuevo Laredo 269 km (5.5 h).
- **Veracruz ⇄ CDMX**: Veracruz–Puebla 270 km (5.0 h) · Puebla–CDMX 182 km (3.1 h).
- **CDMX ⇄ Ciudad Juárez**: CDMX–Querétaro 215 km (5.8 h) · Querétaro–Torreón 863 km
  (14.4 h) · Torreón–Chihuahua 478 km (8.0 h) · Chihuahua–Ciudad Juárez 355 km (5.9 h).
- **Guadalajara ⇄ Nogales**: Guadalajara–Mazatlán 534 km (8.9 h) · Mazatlán–Hermosillo
  897 km (14.9 h) · Hermosillo–Nogales 270 km (4.5 h).
- **Altamira ⇄ Monterrey**: 507 km (12.6 h), toda por vía secundaria.
- **Coatzacoalcos ⇄ Salina Cruz**: 274 km (4.6 h).
- **Coatzacoalcos ⇄ Progreso**: Coatzacoalcos–Mérida 873 km (14.6 h) · Mérida–Progreso
  36 km (0.6 h).

Además, el jugador puede crear trenes nuevos eligiendo estaciones en el mapa (*＋ Nuevo
tren*). Los trenes del jugador son del Estado y no llevan nombre de empresa; las vías por
donde pasan sí dicen de quién son (ver [Dueños](#dueños)).

---

## 8. Rutas marítimas

### Cómo se calculan

Ninguna ruta de barco se dibujó a mano. `npm run datos` las calcula entre **cada par** de los
15 puertos y las 2 salidas al mundo (136 rutas):

1. **La tierra en una malla.** La misma tierra 1:10m del tablero (estados y países vecinos)
   se pasa a una malla de 0.05° (unos 5.5 km por celda) que va de 122° a 70° O y de 5° a 34°
   N: más ancha que el tablero, para que las rutas puedan salir hacia Asia y hacia el
   Atlántico, y hasta Panamá por el sur. Una celda es tierra si su centro cae en tierra
   **o si la toca una costa**, así ninguna isla o barra angosta se cuela.
2. **El Canal de Panamá se abre a mano**, sobre su trazo real: la entrada frente a Balboa,
   las esclusas de Miraflores y Pedro Miguel, el corte Culebra, Gamboa, el lago Gatún, las
   esclusas de Gatún y la bahía Limón. Es el único paso entre las dos costas de México.
3. **La ruta más corta por mar**, sin cortar esquinas de tierra en diagonal y con un
   sobrecosto por navegar a menos de ~22 km de la costa: así las rutas van mar adentro, como
   los carriles reales, y solo se acercan a tierra al llegar a un puerto.
4. **Se endereza** en tramos rectos mientras la línea de vista quede en mar abierto, con un
   recorrido exacto de celdas para que ninguna recta pise tierra. Mar abierto y canal se
   enderezan por separado: una recta que saliera del canal directo al mar cruzaría Colón.
5. **Auditoría**: cada ruta se revisa cada 0.5 km contra una malla 5 veces más fina. Fuera de
   los primeros y últimos 8 km (la entrada a cada puerto) y del Canal, **ninguna de las 136
   rutas pisa tierra**.

### Cifras

| | |
| --- | --- |
| Rutas | 136 (todas las parejas de 17 puntos) |
| Pasan por el Canal de Panamá | 72 (las que unen el Pacífico con el Golfo o con la salida a Europa) |
| Malla | 603,200 celdas de 0.05° |

Algunas distancias, comparadas con las reales en millas náuticas (mn):

| Ruta | En el juego | Real aproximada |
| --- | ---: | ---: |
| Manzanillo → Lázaro Cárdenas | 299 km (162 mn) | ~160 mn |
| Veracruz → Progreso | 721 km (389 mn) | ~400 mn |
| Manzanillo → Veracruz, por Panamá | 5,975 km (3,226 mn) | ~3,200 mn |

**El Istmo de Tehuantepec, en números.** De Salina Cruz a Coatzacoalcos hay **4,825 km por
mar** (rodeando por Panamá) y **274 km por tren**. Esa diferencia es la razón de ser del
corredor interoceánico, y está en el juego tal cual.

### Salidas al mundo y travesías oceánicas

Dos "puertas" en el borde del tablero. Cada una representa un **puerto lejano**: un barco que
sale por ella **cruza el océano de verdad** hasta ese puerto, hace escala allá 48 h y vuelve
por el mismo camino. En el tablero se pierde de vista al pasar la puerta; en las vistas del
mundo (mapa plano y globo) se le ve navegar toda la travesía.

| Salida | Dónde | Puerto lejano | Océano |
| --- | --- | --- | --- |
| Asia | Pacífico, 23.5° N · 118.2° O | Shanghái, terminal de aguas profundas de Yangshan (30.627° N, 122.067° E) | Pacífico |
| Europa | Atlántico, al norte de las Bahamas, 29.5° N · 77° O | Róterdam, Maasvlakte (51.95° N, 4.05° E) | Atlántico |

**Cómo se calculan las travesías** (`scripts/travesias.mjs`, dentro de `npm run datos`). Con
el mismo método que las rutas de México, pero sobre el mundo entero:

1. **La tierra** es la 1:50m de world-atlas, la misma que dibujan las vistas del mundo al
   acercarse: así ningún barco cruza una costa que se vea.
2. **Una malla de 0.1°** (unos 11 km por celda, 4,860,000 celdas) de 60° S a 75° N que **da
   la vuelta al mundo**: la columna de 180° E es vecina de la de 180° O, porque la travesía
   a Asia cruza el antimeridiano. Celda de tierra si su centro cae en tierra o si la toca una
   costa.
3. **La ruta más corta por mar**, con el mismo sobrecosto por navegar a menos de ~45 km de la
   costa.
4. **Se endereza en arcos de círculo máximo**, no en rectas del mapa: a escala de océano un
   barco navega el círculo máximo, que en un mapa plano se ve como curva.
5. **Auditoría exacta**: cada kilómetro de cada arco se prueba contra los polígonos 50m (no
   contra una malla). Fuera de los últimos 30 km de llegada al puerto lejano, **ninguna
   travesía pisa tierra**.

| Travesía | Distancia | Gran círculo | Rodeo | Por dónde pasa |
| --- | ---: | ---: | ---: | --- |
| Asia → Shanghái | 11,407 km (6,159 mn) | 11,214 km | +1.7 % | Pacífico norte en arco, al sur de Japón y de Kyushu |
| Europa → Róterdam | 7,108 km (3,838 mn) | 6,881 km | +3.3 % | Al sur de Terranova (cabo Race), el Canal de la Mancha y el estrecho de Dover |

Los vértices del trazo, de la puerta al puerto lejano:

- **Asia**: 118.2° O 23.5° N → 139.45° E 32.65° N → 130.15° E 29.85° N → Yangshan.
- **Europa**: 77° O 29.5° N → 56.75° O 46.25° N → 52.55° O 46.45° N → 4.75° O 49.65° N →
  1.15° E 50.65° N → 2.45° E 51.95° N → 3.95° E 51.95° N → Róterdam.

Tiempo de cada travesía, solo de ida (a la velocidad de la clase):

| Travesía | Portacontenedores y ro-ro | Buque tanque | Granelero |
| --- | ---: | ---: | ---: |
| Asia → Shanghái | 14.3 d | 18.3 d | 19.7 d |
| Europa → Róterdam | 8.9 d | 11.4 d | 12.3 d |

De puerto mexicano a puerto lejano, en portacontenedor: **Manzanillo → Shanghái 13,005 km
(7,022 mn), 16.3 días**; **Veracruz → Róterdam 9,515 km (5,137 mn), 11.9 días**. Las
distancias reales rondan las 7,000 y las 5,100 mn.

La salida a Europa está pasado el estrecho de Florida, así que la ruta desde el Golfo cruza
el estrecho antes de salir del tablero.

---

## 9. Barcos

### Clases

| Clase | Velocidad | Horas en cada puerto |
| --- | --- | ---: |
| Portacontenedores | 18 nudos (33 km/h) | 18 |
| Buque tanque | 14 nudos (26 km/h) | 24 |
| Granelero | 13 nudos (24 km/h) | 36 |
| Ro-ro de autos | 18 nudos (33 km/h) | 14 |

Las velocidades parten de las clases de `logistica-oceanica` (Neopanamax 22 nudos, feeder 18,
petrolero 15, granelero 14), bajadas un poco al promedio de "navegación lenta" que las navieras
mantienen en la práctica. En el Canal de Panamá todo barco va a 9 km/h: unos 80 km de esclusas,
corte y lago en cerca de 9 horas.

### Servicios iniciales

Los barcos hacen **circuitos**: recorren sus escalas en orden y vuelven a la primera, como
los servicios regulares de las navieras.

| Barco | Clase | Circuito | Por vuelta | En el tablero | Ciclo completo |
| --- | --- | --- | ---: | ---: | ---: |
| Mar de Cortés | Portacontenedores | Shanghái → Manzanillo → Lázaro Cárdenas → Shanghái | 26,578 km | 3,764 km | 36.7 d |
| Cabo Corrientes | Portacontenedores | Róterdam → Veracruz → Altamira → Róterdam | 19,472 km | 5,256 km | 27.8 d |
| Arrecife Alacranes | Buque tanque | Salina Cruz → Lázaro Cárdenas → Manzanillo → Mazatlán → Guaymas → Salina Cruz | 4,781 km | 4,781 km | 12.7 d |
| Isla Tiburón | Buque tanque | Coatzacoalcos → Dos Bocas → Progreso → Coatzacoalcos | 1,311 km | 1,311 km | 5.1 d |
| Bahía de Banderas | Ro-ro de autos | Lázaro Cárdenas → Veracruz → Lázaro Cárdenas, por Panamá | 11,396 km | 11,396 km | 16.1 d |
| Laguna de Términos | Granelero | Guaymas → Shanghái → Guaymas | 25,838 km | 3,024 km | 48.2 d |

"Por vuelta" es todo el circuito, travesías incluidas; "en el tablero", la parte entre las
salidas al mundo. El ciclo completo suma la navegación y todas las escalas. Una escala en
"Asia" o "Europa" es una escala en Shanghái o Róterdam. Qué representan:

- **Mar de Cortés y Cabo Corrientes**: las líneas regulares de contenedores, que escalan donde
  esos tráficos escalan en la realidad (Asia en Manzanillo y Lázaro Cárdenas; Europa en
  Veracruz y Altamira).
- **Arrecife Alacranes**: la distribución de combustibles por la costa del Pacífico desde la
  refinería de Salina Cruz.
- **Isla Tiburón**: el reparto de combustibles por el Golfo.
- **Bahía de Banderas**: autos de costa a costa por el Canal, el rodeo largo que el corredor
  del Istmo existe para acortar.
- **Laguna de Términos**: graneles minerales de Sonora hacia Asia.

Detalle por tramo:

- **Mar de Cortés**: Shanghái–Manzanillo 13,005 km (16.3 d, de ellos 11,407 km de
  travesía) · Manzanillo–Lázaro Cárdenas 299 km (9 h) · Lázaro Cárdenas–Shanghái 13,273 km
  (16.6 d).
- **Cabo Corrientes**: Róterdam–Veracruz 9,515 km (11.9 d, de ellos 7,108 km de travesía) ·
  Veracruz–Altamira 419 km (13 h) · Altamira–Róterdam 9,538 km (11.9 d).
- **Arrecife Alacranes**: Salina Cruz–Lázaro Cárdenas 850 km (1.4 d) · Lázaro Cárdenas–
  Manzanillo 299 km (12 h) · Manzanillo–Mazatlán 570 km (22 h) · Mazatlán–Guaymas 721 km
  (1.2 d) · Guaymas–Salina Cruz 2,341 km (3.8 d).
- **Isla Tiburón**: Coatzacoalcos–Dos Bocas 157 km (6 h) · Dos Bocas–Progreso 516 km (20 h) ·
  Progreso–Coatzacoalcos 638 km (1.0 d).
- **Bahía de Banderas**: Lázaro Cárdenas–Veracruz 5,698 km (7.5 d), y de regreso igual.
- **Laguna de Términos**: Guaymas–Shanghái 12,919 km (22.4 d, de ellos 11,407 km de
  travesía), y de regreso igual.

Los **nombres de los barcos** son inventados, tomados de mares, islas y costas de México
(Mar de Cortés, Cabo Corrientes, Arrecife Alacranes…). Ninguno es, ni pretende ser, un barco
real.

El jugador puede crear barcos nuevos (*＋ Nuevo* en la pestaña Barcos): elige la clase y
las escalas en el mapa, en orden; el circuito se cierra solo de vuelta a la primera. Una
salida al mundo cuenta como escala en su puerto lejano. En las vistas del mundo, *＋ Nuevo*
lleva al tablero con el trazado de un barco ya abierto.

### En las vistas del mundo

El mapa plano y el globo muestran **todos los barcos**, con su circuito completo como una
línea tenue de su color: la del barco elegido (o bajo el cursor) se ilumina. Ahí también
están Shanghái y Róterdam. Un clic en un barco, o en la lista de la izquierda, lo elige y
lleva la cámara hasta él; *Seguir* lo mantiene al centro (en el globo, a la altura que tengas;
arrastrar lo suelta, la rueda no). En el tablero, cuando un barco elegido pasa la salida, su
ficha cambia *Seguir* por **Ver en el globo**, que abre el globo siguiéndolo a medio océano;
la cámara del tablero se queda esperándolo en la salida.

---

## 10. Reglas de la simulación

| Regla | Valor |
| --- | --- |
| Inicio de la partida | 1 de diciembre de 2018, 06:00, el día en que empezó el sexenio: la red es la de 2018 y lo que sigue lo construye el jugador |
| Reloj | 1× = 1 hora de juego por segundo; velocidades: pausa, ¼×, 1×, 4×, 16×; la barra espaciadora pausa |
| Cuándo corre | Con cualquier vista del juego abierta: el tablero o las dos vistas del mundo (donde también navegan los barcos) |
| Velocidad en vía primaria | 60 km/h |
| Velocidad en vía secundaria | 40 km/h |
| Espera en terminales | 3 h (carga y descarga completa) |
| Espera en paradas intermedias | 1 h |
| Largo de un tren | 1.8 km (unos 100 carros); en pantalla nunca menos de 18 px |
| Cómo se elige la ruta | La más rápida en tiempo, no la más corta (algoritmo de Dijkstra) |
| Servicio | Ida y vuelta entre sus paradas, sin fin: A → B → C → B → A… |
| Velocidad comercial resultante | ~42 km/h promedio contando las esperas y la saturación (medida en 500 h simuladas con los 8 servicios) |
| Vías fuera de operación | Sin trenes ni estaciones; la ruta no las usa |
| Capacidad de una vía | 16 trenes al día en vía sencilla, 30 con control centralizado, 75 en vía doble |
| Uso de una vía | (trenes privados + trenes del jugador al día) ÷ capacidad |
| Saturación | Hasta 60 % de uso, velocidad completa; 60 % de la velocidad al 100 % de uso; 30 % al 150 %; nunca menos de 25 % |
| Cómo elige camino un tren del jugador | El menor tiempo con el uso actual de cada vía; a igual tiempo, la vía del Estado |
| Obras del Estado | 41 en el catálogo; de 1 a 4 cuadrillas; 4 = costo y tiempo oficiales |
| Al terminarse una obra | La red se reconstruye, nacen estaciones y todos los trenes rehacen su ruta |

Las velocidades son promedios de marcha de un tren de carga, no velocidades máximas. Elegir
la ruta por tiempo hace que un tren prefiera una vía primaria aunque un ramal sea más corto,
como lo haría un despachador.

**Barcos:**

| Regla | Valor |
| --- | --- |
| Velocidad | La de su clase (13 a 18 nudos); 9 km/h dentro del Canal de Panamá |
| Escala en un puerto | La de su clase (14 a 36 h) |
| Salida al mundo | Escala en su puerto lejano: el barco navega la travesía calculada a la velocidad de su clase, hace 48 h de escala allá (sea cual sea la clase) y vuelve |
| Servicio | Circular: A → B → C → A… |
| Cómo se elige la ruta | La ruta marítima calculada para ese par de puntos, más la travesía si un extremo es una salida (ver [Rutas marítimas](#8-rutas-marítimas)) |
| En pantalla | Un casco con proa, orientado a su rumbo, con estela; del mismo tamaño en pantalla a cualquier zoom en el globo, y un poco mayor al acercarte en los mapas planos |
| Resultado medido | En 3,000 h simuladas con los 6 barcos: 166 escalas (10 de ellas en Shanghái o Róterdam), 40 % del tiempo fuera del tablero |

**Polos del Bienestar:** el jugador los construye (ver [Construirlos](#construirlos)). Por
construir o en obra no son parada de nada; ya operando, si tienen vía a 15 km o menos, tienen
estación y son parada de trenes como cualquier ciudad. Nunca son escala de barcos. Todavía no
producen ni piden carga.

| Regla | Valor |
| --- | --- |
| Dinero | El presupuesto del Estado, que llega cada mes; polos y vías se pagan de la misma caja |
| Cuadrillas | 1 a 4; cada una extra acorta la obra y la encarece 15 % |
| Pago | Conforme avanza la obra; sin dinero, la obra se detiene |
| Estación | Al terminarse, si hay vía a 15 km o menos |
| Ocupación | 0 a 100 % en 3 años, solo con tren |
| Marcador | Barra a lo largo de la parte de arriba: presupuesto, caja de la CFE, empleos (permanentes y en obra), obras y el catálogo |

Los trenes y los barcos comparten el mismo motor de servicios (`domain/servicio.ts`): un
vehículo recorre sus piernas, espera en cada parada lo que le toca y sigue. Solo cambia cómo
se traza cada pierna (red ferroviaria o rutas marítimas) y cuánto espera.

### El presupuesto del Estado

El jugador es el Estado y su dinero es el de verdad. La partida empieza el **1 de diciembre
de 2018**, el día en que empezó el sexenio, y cada año recibe:

1. **El presupuesto federal para ferrocarriles de ese año.** Todo lo que la federación gastó
   en la subfunción «Transporte por Ferrocarril» (SICT y Defensa: trenes de pasajeros, El
   Insurgente, vías de carga), más el Tren Maya (Fonatur y Tren Maya S.A. de C.V.) y el
   Ferrocarril del Istmo de Tehuantepec. De 2018 a 2025 es **lo ejercido**, según la Cuenta
   Pública: lo que de verdad se gastó, con las ampliaciones que hubo en el año. De 2018 solo
   llega la doceava parte de diciembre. 2026 es lo
   aprobado en el Presupuesto de Egresos (su Cuenta Pública sale en 2027) y 2027 es el
   proyecto que envió el Ejecutivo. De 2028 en adelante se repite 2027.
2. **El derecho de las concesionarias.** Las cuatro privadas (Ferromex, Ferrosur, Kansas City
   de México y Coahuila–Durango) pagan por usar la vía un porcentaje de sus ingresos: 1.25 %
   (todas tienen más de 15 años de concesión), y 3 % desde el 1 de enero de 2027 por la
   reforma del DOF del 13 de noviembre de 2026. Los ingresos son los reales de cada año (los
   de 2018, del Anuario Estadístico Ferroviario 2019); de 2026 en adelante se repiten los de
   2025.

El año llega en **doce mensualidades iguales**, el día 1 de cada mes, como el calendario de
gasto de Hacienda. **Lo que no se gasta se acumula.** Polos y vías se pagan **de la misma
caja**. Los impuestos que pagan las concesionarias (ISR) quedan fuera por ahora: no hay cifra
pública por empresa.

Millones de pesos de cada año (calculado con el código del juego):

| Año | Trenes: presupuesto federal | De dónde | Derecho de las concesionarias | Total al año | Cada mes |
| --- | ---: | --- | ---: | ---: | ---: |
| 2018 (solo diciembre) | 26,847 | Ejercido (Cuenta Pública) | 775 (1.25 %) | 27,622 | 2,302 |
| 2019 | 11,039 | Ejercido (Cuenta Pública) | 816 (1.25 %) | 11,855 | 988 |
| 2020 | 13,426 | Ejercido (Cuenta Pública) | 803 (1.25 %) | 14,228 | 1,186 |
| 2021 | 37,722 | Ejercido (Cuenta Pública) | 875 (1.25 %) | 38,597 | 3,216 |
| 2022 | 185,244 | Ejercido (Cuenta Pública) | 958 (1.25 %) | 186,201 | 15,517 |
| 2023 | 115,723 | Ejercido (Cuenta Pública) | 1,024 (1.25 %) | 116,748 | 9,729 |
| 2024 | 207,392 | Ejercido (Cuenta Pública) | 1,115 (1.25 %) | 208,507 | 17,376 |
| 2025 | 99,225 | Ejercido (Cuenta Pública) | 1,171 (1.25 %) | 100,396 | 8,366 |
| 2026 | 146,395 | Aprobado (PEF) | 1,171 (1.25 %) | 147,566 | 12,297 |
| 2027 | 152,120 | Proyecto (PPEF) | 2,810 (3 %) | 154,931 | 12,911 |
| 2028 en adelante | 152,120 | Se repite 2027 | 2,810 (3 %) | 154,931 | 12,911 |

Lo que se suma cada año, también en millones de pesos de cada año:

| Año | Lo aprobado | Lo ejercido | Tren Maya | Ferrocarril del Istmo | SICT y Defensa (subfunción ferrocarril) |
| --- | ---: | ---: | ---: | ---: | ---: |
| 2018 | 21,046 | 26,847 | 0 | 746 | 26,101 |
| 2019 | 14,310 | 11,039 | 0 | 1,207 | 9,832 |
| 2020 | 6,731 | 13,426 | 7,509 | 1,572 | 4,345 |
| 2021 | 45,192 | 37,722 | 33,802 | 1,097 | 2,823 |
| 2022 | 78,358 | 185,244 | 179,728 | 2,613 | 2,903 |
| 2023 | 155,523 | 115,723 | 108,053 | 3,534 | 4,136 |
| 2024 | 139,139 | 207,392 | 164,064 | 30,932 | 12,396 |
| 2025 | 158,115 | 99,225 | 28,387 | 3,754 | 67,084 |
| 2026 | 146,395 | — | 30,744 | 23,052 | 92,600 |
| 2027 | 152,120 (proyecto) | — | 18,180 | 25,147 | 108,793 |

Cómo se leen: en 2019 se aprobaron 5,820 millones para el Tren Maya que no se ejercieron; en
2022 el Tren Maya recibió más del doble de lo aprobado. La subfunción ferrocarril de 2025 en
adelante crece por los trenes de pasajeros. No entran las pensiones de Ferrocarriles
Nacionales de México, la Agencia del Corredor Interoceánico (sus puertos y polos) ni la
empresa de la Defensa que opera el Tren Maya y aeropuertos.

**Cómo se calculó.** Con las bases de datos abiertos de Hacienda (una fila por clave
presupuestaria): se suma la subfunción «Transporte por Ferrocarril» de todos los ramos, las
unidades del Tren Maya en sus programas ferroviarios y el Ferrocarril del Istmo. Los ingresos
de las concesionarias son los de carga de la tabla A36 del anuario ferroviario 2025.
`npm run al-dia` avisa cuando Hacienda ya debió publicar una cifra mejor: la Cuenta Pública
de un año sale a finales de abril del siguiente, el presupuesto se aprueba a más tardar el 15
de noviembre del año anterior y el proyecto se presenta el 8 de septiembre.

En la barra de arriba, junto al saldo va cuánto llega cada mes; al
pasar el cursor, de dónde sale.

### La energía

Los polos necesitan electricidad. El país se divide en las **regiones del sistema eléctrico**
que opera el CENACE; cada estado va con su región, y varios están partidos por municipio (la
Laguna de Coahuila va con el Norte; el norte de Veracruz, el oriente de San Luis Potosí y la
Huasteca de Hidalgo con el Noreste; San Luis Río Colorado con Baja California). Baja California
Sur tiene **dos sistemas aislados**, sin enlace entre ellos: el de La Paz y Los Cabos, que es la
región *Baja California Sur*, y el de **Mulegé**, en el norte del estado (Santa Rosalía, Guerrero
Negro), que el juego lleva aparte.

**El margen de reserva.** Es cuánta capacidad disponible sobra en la hora de más demanda:
(capacidad disponible − demanda máxima) ÷ demanda máxima. El PRODESEN lo mide en dos picos: el
de la **tarde**, donde la solar ayuda, y el de la **noche**, donde no está. Una región está:

| Nivel | Margen (el menor de los dos picos) | Qué pasa |
| --- | --- | --- |
| Holgada | Arriba de la reserva de planeación (21.3 %; 20.9 % en Baja California y 35 % en Baja California Sur y Mulegé) | Nada |
| Justa | Entre el mínimo para operar y la reserva de planeación | Nada todavía, pero va hacia abajo |
| Crítica | Debajo del mínimo para operar (6 %; 11 % en los tres sistemas aislados de la península) | **Los polos de la región no se llenan**: no llegan empresas hasta que haya más generación |

**Cómo se mueve.** Cada región arranca el 1 de julio de 2019 con sus márgenes oficiales de ese
año. Desde ahí:

- **La demanda** crece al ritmo real de la región de 2018 a 2024 (y sigue igual después), más
  lo que piden los polos operando: sus MW por qué tan llenos están.
- **La capacidad** crece con las **centrales privadas** en su fecha real, según la lista de
  permisos de la Comisión Nacional de Energía (las que entraron de 2019 a 2026 y las que están
  en construcción para 2025–2031; las que ni siquiera empezaron obras no entran, porque la
  mitad de los permisos nunca se construye), y con las **centrales de la CFE** que construya el
  jugador. El jugador no controla las privadas: aparecen solas en el mapa.
- **Cada tecnología cuenta distinto en cada pico** (estimación del juego: la metodología
  oficial usa la disponibilidad horaria de cinco años y no publica un porcentaje fijo): las
  firmes (térmicas, hidroeléctricas, nuclear, geotérmicas) cuentan 90 % en los dos picos; la
  eólica, 25 %; la solar, 35 % en la tarde y nada en la noche. El 35 % sale de la diferencia
  entre los márgenes oficiales de la tarde (23.4 %) y la noche (20.6 %) del sistema
  interconectado en 2019, unos 1,300 MW, entre los ~3,600 MW solares de ese año.
- **El almacenamiento deja que una central cuente de noche** (estimación del juego): una
  termosolar con 11 horas de sales fundidas cuenta como firme, 90 % en los dos picos; las
  baterías cuentan sus MW completos en los dos picos.

Las regiones, en megawatts (calculado con el código del juego). Mulegé sale del PRODESEN
2019–2033: 29 MW de demanda máxima en 2018 (tabla 6.5) y 98 MW de capacidad (tabla 5.1), casi
toda firme: combustibles y la geotérmica de Las Tres Vírgenes; 34 MW en 2024 (Plan de Desarrollo
2025–2039, tabla A1.6). El PRODESEN no publica
su margen: el juego lo calcula con su capacidad al 90 % contra su demanda de 2019.

| Región | Estados (con partes de otros) | Demanda máxima 2018 → 2024 (MW) | Crece al año | Margen 2019, tarde / noche | Privadas que entran 2019–2026 (MW) | Privadas en construcción 2025–2031 (MW) |
| --- | --- | --- | ---: | --- | ---: | ---: |
| Central | CDMX, MEX, HGO | 8,805 → 8,848 | 0.1 % | 14.3 % / 14.6 % | 969 | 138 |
| Oriental | CHIS, GRO, MOR, OAX, PUE, TAB, TLAX, VER | 7,594 → 9,034 | 2.9 % | 41 % / 27.3 % | 1,377 | 916 |
| Occidental | AGS, COL, GTO, JAL, MICH, NAY, QRO, ZAC, SLP | 10,373 → 11,834 | 2.2 % | 15.9 % / 15.9 % | 3,327 | 513 |
| Noroeste | SIN, SON | 4,759 → 5,909 | 3.7 % | 24.3 % / 22.7 % | 3,426 | 184 |
| Norte | CHIH, DGO | 4,639 → 5,540 | 3 % | 19.3 % / 15.1 % | 2,386 | 213 |
| Noreste | NL, TAMPS, COAH | 9,202 → 11,109 | 3.2 % | 25.4 % / 26.6 % | 6,113 | 748 |
| Peninsular | CAMP, QROO, YUC | 2,061 → 2,969 | 6.3 % | 35.8 % / 23.7 % | 589 | 149 |
| Baja California | BC | 2,863 → 3,635 | 4.1 % | -4.5 % / -4.5 % | 747 | 236 |
| Baja California Sur | BCS (sin Mulegé) | 500 → 689 | 5.5 % | 35.4 % / 32.6 % | 272 | 0 |
| Mulegé | BCS (municipio de Mulegé) | 29 → 34 | 2.7 % | 196.2 % / 196.2 % (calculado) | 0 | 0 |

Si el jugador no construye ninguna central, el margen mínimo de cada región va así (✗: crítica,
los polos se detienen):

| Región | Margen mínimo, julio de 2021 | 2023 | 2025 | 2027 | 2027, con todas las centrales de la CFE |
| --- | ---: | ---: | ---: | ---: | ---: |
| Central | 23 % | 23 % | 23.3 % | 23.8 % | 29.6 % |
| Oriental | 22.6 % | 17.2 % | 10.6 % | 7.5 % | 19.4 % |
| Occidental | 18.9 % | 13.8 % | 9.2 % | 5.1 % ✗ | 19.5 % |
| Noroeste | 34.6 % | 25.3 % | 29.3 % | 20.6 % | 20.6 % |
| Norte | 25.7 % | 18.5 % | 12.2 % | 6 % ✗ | 11.2 % |
| Noreste | 38.9 % | 35.6 % | 29.6 % | 23 % | 23 % |
| Peninsular | 12.4 % | -0.5 % ✗ | -11.9 % ✗ | -20.9 % ✗ | 20 % |
| Baja California | -6.7 % ✗ | -13.1 % ✗ | -19.6 % ✗ | -22.4 % ✗ | 22.1 % |
| Baja California Sur | 19.2 % | 9 % ✗ | 17.7 % | 5.8 % ✗ | 39.6 % |
| Mulegé | 180.9 % | 166.4 % | 152.6 % | 139.5 % | 193.8 % |

La península cae en 2023, como en la realidad (los apagones de Yucatán de 2023–2024). Baja
California empieza 2019 ya debajo del mínimo. La solar no levanta el margen nocturno: por eso
el Noroeste queda igual con Puerto Peñasco. Baja California Sur cae en 2023, se recupera con una
turbogás privada de 159 MW que entra en La Paz en noviembre de ese año y vuelve a caer en 2027.
Mulegé no cae nunca: tiene tres veces la capacidad que pide.

**La caja de la CFE.** Las centrales de la CFE no se pagan con el presupuesto federal de
trenes: la CFE las paga con recursos propios (su Fideicomiso Maestro de Inversión). Su
Programa de Desarrollo 2026–2030 destina 132 mil millones de pesos en cinco años a proyectos
propios de generación: **26,400 millones al año**, que llegan en mensualidades a una caja
aparte. Para 2019–2025 no hay una cifra anual oficial comparable y se usa la misma. Los
dólares se pasan a pesos con el tipo de cambio promedio de 2024: 18.33 (Cuenta Pública 2024,
con datos de Banxico).

**Las centrales de la CFE**, en el catálogo de obras (grupo *Energía (CFE)*), con cuadrillas
como las vías; 4 cuadrillas son el costo oficial. El tiempo es una estimación del juego: 36
meses un ciclo combinado, 12 una solar o unas unidades de emergencia, 48 una hidroeléctrica y
24 el Proyecto Oasis; las termosolares, 42, a la mitad de los 36 a 48 meses que dio la
Presidencia.

| Central | Región | MW | Costo con 4 cuadrillas | Tiempo | De dónde sale el costo | En la realidad |
| --- | --- | ---: | ---: | ---: | --- | --- |
| Ciclo combinado Tula (paquetes 1 y 2) | Central | 567 | 5.7 mil millones | 36 meses | Permiso de la CNE | Proyecto de la administración anterior (contrato de 2014), sin terminar en 2018; en operación comercial desde el 28 de noviembre de 2020. |
| Ciclo combinado Salamanca | Occidental | 958 | 11.3 mil millones | 36 meses | Permiso de la CNE | Obra desde el 30 de septiembre de 2021; en operación desde el 14 de febrero de 2025. |
| Ciclo combinado El Sauz II | Occidental | 269 | 4.2 mil millones | 36 meses | Costo por kW de su tecnología | Obra desde el 30 de septiembre de 2021; en operación desde el 12 de septiembre de 2025, con 268.97 MW. |
| Ciclo combinado San Luis Potosí (Villa de Reyes) | Occidental | 449 | 6.9 mil millones | 36 meses | Costo por kW de su tecnología | Obra desde el 30 de septiembre de 2021; en operación desde el 5 de julio de 2025. |
| Ciclo combinado Manzanillo III | Occidental | 346 | 5.3 mil millones | 36 meses | Costo por kW de su tecnología | Obra desde el 8 de marzo de 2022; en operación comercial desde el 17 de abril de 2026, con 346 MW. |
| Ciclo combinado González Ortega (Mexicali) | Baja California | 641 | 15.6 mil millones | 36 meses | Informe Anual CFE 2024 | Obra desde el 26 de enero de 2022; en operación desde el 15 de mayo de 2026. |
| Ciclo combinado Mérida (Elvia Carrillo Puerto) | Peninsular | 499 | 10 mil millones | 36 meses | Informe Anual CFE 2024 | Obra desde el 18 de enero de 2022; en operación comercial desde el 12 de mayo de 2026. |
| Ciclo combinado Tuxpan, fase I | Oriental | 1,057 | 16.6 mil millones | 36 meses | Informe Anual CFE 2024 | Obra desde el 17 de febrero de 2022, 84.8 % al cierre de 2024; la CFE la espera entre 2026 y 2028. |
| Ciclo combinado Riviera Maya (Valladolid IV) | Peninsular | 1,020 | 16.7 mil millones | 36 meses | Informe Anual CFE 2024 | Obra desde el 20 de enero de 2022, 92.3 % al cierre de 2024; la CFE la espera entre 2026 y 2028. |
| Ciclo combinado San Luis Río Colorado | Baja California | 648 | 14.5 mil millones | 36 meses | Informe Anual CFE 2024 | Obra desde el 26 de enero de 2022, 89.9 % al cierre de 2024; su permiso la espera a finales de 2027. |
| Ciclo combinado Lerdo | Norte | 350 | 5.4 mil millones | 36 meses | Costo por kW de su tecnología | Obra desde el 29 de abril de 2022, 89 % al cierre de 2024; la CFE la espera entre 2026 y 2028. |
| Parque solar Puerto Peñasco, etapas I y II | Noroeste | 457 | 15 mil millones | 12 meses | Permiso de la CNE | Primera etapa (120 MW) en operación desde el 17 de febrero de 2023; la segunda (300 MW), empezada en septiembre de 2022, desde el 11 de septiembre de 2024. |
| Parque solar Puerto Peñasco, etapas III y IV | Noroeste | 580 | 10.8 mil millones | 12 meses | Costo por kW de su tecnología | Programada para 2028. |
| Unidades de combustión interna y turbogás en Mexicali y San Luis Río Colorado | Baja California | 735 | 12.6 mil millones | 12 meses | Permiso de la CNE | Mexicali Oriente ya operaba en julio de 2024; la CNE registra las unidades en operación de marzo a junio de 2025. |
| Turbogás de emergencia en Los Cabos | Baja California Sur | 154 | 2.8 mil millones | 12 meses | Permiso de la CNE | En operación desde el 12 de junio de 2025. |
| Turbogás aeroderivadas Riviera Maya | Peninsular | 100 | 2 mil millones | 12 meses | Costo por kW de su tecnología | La primera, Nizuc (36.9 MW, Cancún), en operación desde el 14 de octubre de 2026; Cancún 1 y 2 y Chankanaab (Cozumel), en obra. |
| Termosolares de Baja California Sur, primera etapa (2 de 50 MW) | Baja California Sur | 100 | 6.7 mil millones | 42 meses | Estimación con IRENA | Anunciadas el 26 de agosto de 2025: dos centrales de torre central con almacenamiento térmico, 100 MW y 11 horas de operación continua. Primeras de su tipo en México; la CFE aún busca los sitios y las quiere operando al cierre del sexenio. |
| Termosolar de Baja California Sur, segunda etapa (50 MW) | Baja California Sur | 50 | 3.4 mil millones | 42 meses | Estimación con IRENA | Anunciada el 26 de agosto de 2025 como segunda etapa: «una más de 50 megawatts» para descarbonizar el sistema de Baja California Sur. |
| Proyecto Oasis: solar, baterías e hidrógeno verde en Mulegé | Mulegé | 60 | 2.4 mil millones | 24 meses | Estimación con el plan de la SENER e IRENA | Anunciado por la CFE el 10 de septiembre de 2026: el primer proyecto en México que combina solar, baterías e hidrógeno verde en un sistema eléctrico aislado. Abastecerá 40 mil hogares, evitará 23 mil m³ de diésel y combustóleo y 93 mil toneladas de CO₂ al año. En evaluación. |
| Hidroeléctrica Chicoasén II | Oriental | 240 | 15 mil millones | 48 meses | Costo por kW de su tecnología | En construcción; la CFE la espera a finales de 2028. Turbinas de tipo bulbo: la de mayor capacidad con esa tecnología en Latinoamérica. |

**Las obras limpias de Baja California Sur, y Chicoasén II.** Ninguna tiene costo oficial
publicado; el juego lo **estima** y lo dice en la ficha:

- **Termosolares** (Presidencia, 26 de agosto de 2025): de torre central, con 11 horas de
  almacenamiento en sales fundidas, las primeras de México. Una primera etapa de dos centrales de
  50 MW y una segunda de 50 MW más. Costo: 3,677 dólares por kW, el promedio mundial de 2024
  (IRENA). La CFE aún busca los sitios: el juego pone la primera etapa en La Paz y la segunda en
  Los Cabos, los dos centros de consumo del sistema.
- **Proyecto Oasis** (CFE, boletín 179/26): en Mulegé, 60 MW solares, 20 MW de almacenamiento
  (baterías e hidrógeno verde, con electrolizador y celdas de combustible), para 40 mil hogares;
  evitaría 23 mil m³ de diésel y combustóleo y 93 mil toneladas de CO₂ al año. Está en
  evaluación. Costo: la solar y las baterías de 4 horas al costo por kW del plan oficial (1,017 y
  1,449 dólares), el electrolizador a unos 1,000 dólares por kW (IRENA) y las celdas de
  combustible supuestas del mismo costo: unos 130 millones de dólares. Cuenta 41 MW en la tarde
  (35 % de la solar más el almacenamiento) y 20 en la noche.
- **Chicoasén II** (CFE, boletín 095/26): hidroeléctrica de 240 MW en Chiapas, con turbinas de
  bulbo; la CFE la espera a finales de 2028. Costo: 3,406 dólares por kW, el de la hidroeléctrica
  en el plan oficial.

En el juego Oasis casi no se nota: Mulegé ya tiene margen de sobra y no tiene polos. Lo que
cambia en la realidad es el diésel y el combustóleo que deja de quemar, y el juego todavía no
mide combustibles ni emisiones.

**Lo que piden los polos.** Solo cinco tienen cifra oficial:

| Polo | MW con el polo lleno | De dónde |
| --- | ---: | --- |
| Reserva Zapotlán | 20 | Declaratoria (DOF): «en su etapa madura… una demanda de electricidad de 20 MW». |
| Nezahualcóyotl | 7.7 | Declaratoria (DOF): «crecimiento en su demanda de electricidad de 5 a 7.7 MW de 2027 a 2030». |
| Huamantla | 8 | Portal de los Polos de Desarrollo, Secretaría de Economía: «Energía: 8 MW». |
| Tuxpan | 4 | Declaratoria (DOF): «en su etapa madura… una demanda de electricidad de 4 MW». |
| Hermosillo | 7 | Declaratoria (DOF): «una demanda de electricidad de 1 MW a 7 MW de 2026 a 2030». |

Los demás usan la proporción de esos cinco: 46.7 MW entre 1,813.7 hectáreas, **0.0257 MW por
hectárea**. Los 32 polos juntos piden unos 223 MW: poco frente a una región, así que lo que
decide es el margen de la región, no el polo.

**En el mapa**, el botón *Energía* pinta cada estado con el nivel de su región y muestra las
centrales por tecnología (llenas las de la CFE, como anillo las privadas; punteadas las obras
en curso). Mulegé se pinta aparte, con una línea punteada donde termina: su límite con Comondú
y Loreto, del Marco Geoestadístico del INEGI. Al pasar el cursor por un estado, su región (o
Mulegé) dice sus márgenes y su demanda; por una central, su capacidad, dueño y fecha. La ficha de cada polo dice si su región tiene energía.

### El modo Realidad

El tablero tiene dos modos, con el interruptor *Juego / Realidad* del reloj. En **Realidad** no
se juega: el tablero muestra lo que de verdad pasó con cada obra de vía, cada central de la CFE
y cada Polo del Bienestar, hoy o en
cualquier fecha desde el 1 de diciembre de 2018, el mismo arranque de la partida (la línea de
tiempo del reloj). La partida queda guardada y sigue
donde estaba al volver a *Juego*.

Cada obra tiene sus fechas reales, con fuente (`datos/obras-via-real.json` y
`datos/centrales-real.json`): cuándo se anunció, cuándo arrancó, sus avances oficiales y cuándo
entró en operación. En la fecha elegida, una vía está:

| Etapa | En el mapa |
| --- | --- |
| Sin anunciar, o sin proyecto oficial (las vías muertas por rehabilitar) | No se dibuja |
| Anunciada | Línea de puntos tenue |
| En obra | Línea punteada, con su avance en la ficha |
| En operación | Vía del Estado; la red y sus km cambian |

Y una central de la CFE (con la capa *Energía*):

| Etapa | En el mapa |
| --- | --- |
| Sin anunciar, o sin datos (la CFE no publica cuándo empezó) | No se dibuja |
| Anunciada | Círculo de puntos tenue |
| En obra | Círculo punteado, con su avance en la ficha |
| En operación | Círculo lleno; cuenta en el margen de su región |

Las fechas de las centrales salen sobre todo de la CFE: su Informe Anual 2024 da el inicio de
obra y el avance físico al cierre de 2024 de cada ciclo combinado y de Chicoasén II; su Programa
de Desarrollo 2026–2030 y sus boletines, el día en que cada una entró en operación; la lista de
permisos de la CNE, las que faltan. Donde la CFE no publica el inicio (Tula, Puerto Peñasco, las
unidades de emergencia), la central se ve en obra desde la primera fecha en que una fuente la
reporta así: Tula, por ejemplo, era un proyecto sin terminar de la administración anterior.

**El avance entre dos datos es una estimación.** El gobierno publica avances en fechas sueltas
(«32 % al 31 de octubre de 2026»). Entre el arranque (0 %), cada dato oficial y la apertura
(100 %), el visor interpola en línea recta y lo marca con «≈». Después del último dato se queda
en él: no adivina.

**Las fechas tienen la precisión de su fuente:** un día, un mes o solo un año (entonces cuenta
desde el día 1). El tramo 5 Sur del Tren Maya no tiene fecha exacta de apertura en fuente
oficial: se toma la del circuito completo, el 15 de diciembre de 2024.

Y un Polo del Bienestar:

| Etapa | En el mapa |
| --- | --- |
| Sin declaratoria | No se dibuja |
| Declarado (desde su declaratoria en el DOF) | Hexágono punteado |
| En operación | Hexágono lleno |

De los polos solo entra lo que una fuente oficial dice de cada uno: su declaratoria, el fallo de
su licitación (cinco del Istmo, de noviembre de 2023 a julio de 2025) y su inauguración. Al 20 de
noviembre de 2026 opera uno, **Huamantla**, desde el 12 de abril de 2026. El Corredor reporta
que en 2026 solo cinco polos del Istmo siguen concesionados (tres concesionarios incumplieron y
uno renunció), pero no dice cuáles; la ficha de esos cinco lo advierte. Cuántas empresas tiene
cada polo no se publica: en Realidad no hay ocupación, ni empleos, ni demanda eléctrica de los
polos, ni ramal a la vía.

La barra de arriba cambia: el presupuesto federal real para ferrocarriles de ese
año, cuántas obras y km están en operación, en obra y anunciadas, y cuántas centrales de la CFE
operan (con sus MW) y cuántas están en obra. No hay trenes ni barcos: los del juego son
servicios inventados. También dice cuántos polos operan y cuántos están declarados sin abrir, y
cuánta carga aérea movió el país ese año.

**El margen de cada región es una estimación.** La capa *Energía* pinta las regiones con el
modelo del juego: los márgenes oficiales de 2019, la demanda creciendo a su ritmo real y las
centrales que entraron de verdad, privadas y de la CFE. No cuenta la transmisión entre
regiones ni las obras que no están en el catálogo, así que puede quedar más bajo que el real:
hoy marca crítica la península, aun con Mérida operando. La leyenda lo dice.

No es una transmisión en vivo: no hay fuente oficial en línea del avance de las obras. Los datos
tienen fecha de corte, a la vista bajo la línea de tiempo.

### Las exportaciones y las aduanas

Los trenes del jugador **exportan**. Es la primera carga del juego, con un enfoque mixto: la
carga nacional se medirá como número, pero una exportación va de un **origen** a una **salida**
del país, y eso es lo que el juego mide.

- **Las salidas** son las aduanas a las que llega un tren: los cruces fronterizos, los puertos y
  los aeropuertos con aduana propia (ANAM), más los puertos por los que el anuario ferroviario
  cuenta exportaciones por tren (Topolobampo). En el mapa llevan un cuadrito ámbar en la esquina.
  Las aduanas interiores de una ciudad (Puebla, Aguascalientes) despachan mercancía que todavía
  tiene que salir por una frontera o un puerto: no son salidas.
- **Los orígenes** son todas las demás estaciones. Cada estado genera carga de exportación a un
  ritmo que es una **estimación del juego**: su parte del valor que exporta el país (INEGI) por
  las toneladas que salen del país por tren ese año (anuario ferroviario). La carga espera en las
  estaciones del estado, hasta un mes de ella; la partida abre con una semana esperando.
- **Un tren** carga en los orígenes en los que para hasta la carga neta promedio de un tren de
  carga mexicano, **2,436 toneladas** (SNIF 2022), y descarga en la primera salida a
  la que llega: eso es una exportación. Un tren que solo une salidas (Coatzacoalcos–Salina Cruz)
  no exporta.

La barra de arriba dice cuántas toneladas exportaron los trenes del jugador en el año; la ficha
de cada tren, cuánta carga lleva y cuánto ha exportado; la de cada salida, su aduana, lo que
recaudó y lo que salió por tren en 2025. En el modo Realidad la barra da las toneladas que de
verdad salieron por tren cada año.

**El valor en dólares todavía no**: el INEGI mide dólares y el anuario ferroviario toneladas, y
para unirlos falta un valor por tonelada. La fuente natural es la de cruces fronterizos de
Estados Unidos (BTS), cuyo sitio no deja descargar sus datos automáticamente.

Lo que exportó cada estado en 2025 (INEGI, millones de dólares; cifras preliminares) y la carga
que genera en el juego (toneladas al día, estimación):

| Estado | Exportó en 2025 (MUSD) | Del país | Carga de exportación en el juego (t/día) |
| --- | ---: | ---: | ---: |
| Chihuahua | 109,505 | 18.2 % | 11,461 |
| Coahuila | 65,505 | 10.9 % | 6,856 |
| Nuevo León | 59,065 | 9.8 % | 6,182 |
| Baja California | 56,626 | 9.4 % | 5,927 |
| Jalisco | 52,577 | 8.7 % | 5,503 |
| Guanajuato | 37,988 | 6.3 % | 3,976 |
| Tamaulipas | 36,297 | 6.0 % | 3,799 |
| Sonora | 28,612 | 4.7 % | 2,995 |
| San Luis Potosí | 26,096 | 4.3 % | 2,731 |
| Estado de México | 21,488 | 3.6 % | 2,249 |

Lo que salió del país por tren en 2025 (anuario ferroviario, tabla A13, millones de toneladas):
20.53 por fronteras y 2.5 por puertos.

| Salida | Tipo | Mt en 2025 |
| --- | --- | ---: |
| Piedras Negras | Frontera | 6.95 |
| Nuevo Laredo | Frontera | 6.18 |
| Nogales | Frontera | 2.62 |
| Matamoros | Frontera | 2.35 |
| Mexicali | Frontera | 1.32 |
| Ciudad Juarez | Frontera | 1.12 |
| Guaymas | Puerto | 0.59 |
| Mazatlan | Puerto | 0.39 |
| Coatzacoalcos | Puerto | 0.35 |
| Veracruz | Puerto | 0.34 |
| Tampico | Puerto | 0.21 |
| Lazaro Cardenas | Puerto | 0.21 |
| Manzanillo | Puerto | 0.20 |
| Altamira | Puerto | 0.12 |
| Topolobampo | Puerto | 0.10 |

**Las aduanas.** La Agencia Nacional de Aduanas de México (ANAM) se creó por decreto el 14 de
julio de 2021 y opera desde el 1 de enero de 2022, separada del SAT. En 2025 recaudó unos 1.45
billones de pesos. Las que tienen sitio en el tablero (recaudación de 2025, miles de millones de
pesos):

| Aduana | Tipo | Recaudó en 2025 | ¿Salida? |
| --- | --- | ---: | --- |
| Nuevo Laredo | Fronteriza | 215.2 | Sí |
| Manzanillo | Marítima | 185.6 | Sí |
| Veracruz | Marítima | 141 | Sí |
| Lázaro Cárdenas | Marítima | 137.7 | Sí |
| Tuxpan | Marítima | 94.3 | Sí |
| Ciudad Juárez | Fronteriza | 64.2 | Sí |
| AIFA | Interior | 62.4 | Sí |
| Altamira | Marítima | 47.7 | Sí |
| AICM | Interior | 41.8 | Sí |
| Ensenada | Marítima | 38.6 | Sí |
| Mazatlán | Marítima | 36 | Sí |
| Puebla | Interior | 34.1 | No (aduana interior de ciudad) |
| Reynosa | Fronteriza | 32.4 | Sí |
| Toluca | Interior | 31 | Sí |
| Matamoros | Fronteriza | 30 | Sí |
| Coatzacoalcos | Marítima | 25.6 | Sí |
| Tijuana | Fronteriza | 23.9 | Sí |
| Guadalajara | Interior | 16.9 | Sí |
| Mexicali | Fronteriza | 15.8 | Sí |
| Nogales | Fronteriza | 15.2 | Sí |
| Piedras Negras | Fronteriza | 13.7 | Sí |
| Guaymas | Marítima | 12.3 | Sí |
| Progreso | Marítima | 12.2 | Sí |
| México | Interior | 12.2 | No (aduana interior de ciudad) |
| Aguascalientes | Interior | 12.1 | No (aduana interior de ciudad) |
| Querétaro | Interior | 11.5 | Sí |
| Monterrey | Interior | 11.3 | Sí |
| Dos Bocas | Marítima | 8 | Sí |
| Tampico | Marítima | 6.3 | Sí |
| Chihuahua | Interior | 1.3 | No (aduana interior de ciudad) |
| Torreón | Interior | 0.8 | No (aduana interior de ciudad) |
| Salina Cruz | Marítima | 0.5 | Sí |

---

## 11. Decisiones de diseño

- **La red base es la anterior a 2018; lo posterior lo construye el jugador.** *(19 nov
  2026.)* Las vías hechas de 2018 en adelante no están en el mapa a propósito: construirlas
  será parte del juego. Ejemplos: el Tren Maya y las líneas nuevas del Corredor
  Interoceánico. Por eso Cancún y Chetumal, hoy sin vía, son candidatas naturales. Los
  trazos, fechas y longitudes de esas obras se documentarán aquí cuando se diseñe la mecánica
  de construcción. Los dos tramos trazados a mano (Cuyutlán–Manzanillo y el ramal de
  Altamira) son anteriores a 2018, así que respetan la regla.
- **Las vías originales siguen siendo privadas; las que construye el jugador son del
  Estado.** *(20 nov 2026.)* Así está pasando en la realidad: las líneas nuevas de pasajeros
  van paralelas a las de carga concesionadas, y las opera el Estado. Con las estatales el
  Estado gana más; de las privadas solo cobra impuestos y derechos. Las privadas tienen dos
  razones de ser: dan impuestos y dan el servicio de transporte a los polos y a los puertos.
- **Las privadas tienen su propio tráfico, y los trenes del jugador pueden usarlas pagando.**
  *(20 nov 2026.)* Los trenes de las concesionarias no los controla el jugador, pero llenan la
  vía. Usar vía ajena cuesta: la ley dice que el que pide pasar le paga al dueño (derecho de
  paso, reforma del DOF del 16 de julio de 2025). El cobro entrará junto con el dinero.
- **Capacidad por tramo, no escapes.** *(20 nov 2026.)* Cada vía aguanta cierto número de
  trenes al día; pasado eso, todos van más lento y la vía se pinta de rojo. Es una
  abstracción: no se ve al tren esperando en el escape, pero se siente cuándo un corredor se
  satura. Se puede convertir después en escapes de verdad sin tirar nada.
- **Las vías muertas se ven apagadas y rehabilitarlas es obra del Estado.** *(20 nov 2026.)*
- **Sin trazo libre: obras preestablecidas, el jugador decide cuáles y cuándo.** *(19 nov
  2026.)* Las grandes obras van por el trazo oficial del gobierno, y el catálogo incluye todos
  los trenes anunciados, aunque estén en planeación. Tuxpan espera a que haya un proyecto
  oficial.
- **El Tren Maya, por tramos**, como lo licitó y construyó el gobierno. *(20 nov 2026.)*
- **Costos de Presidencia**, los más recientes; los de la cartera de Hacienda, más altos, se
  anotan aparte. *(20 nov 2026.)*
- **Cuatro cuadrillas son el ritmo del gobierno.** *(20 nov 2026.)* El costo y el tiempo
  oficiales de una obra son los de 4 cuadrillas; con menos sale más barata y más lenta.
- **Dueños por OpenStreetMap**, corregido a 2018 y cotejado con el anuario oficial.
  *(20 nov 2026.)* El gobierno publica la red con su concesionario, pero su servidor no
  permite la descarga automática; OpenStreetMap cuadra con los km oficiales.
- **El presupuesto es el real.** *(20 nov 2026.)* La partida empieza el 1 de diciembre de 2018 y
  cada año llega el presupuesto federal para ferrocarriles de ese año (lo ejercido, mientras
  haya Cuenta Pública), más el derecho de las concesionarias, en mensualidades. Lo que no se
  gasta se acumula, y polos y vías salen de una sola caja. Así el jugador vive el mismo margen
  que tuvo el gobierno: años flacos al principio y muy gordos con el Tren Maya.
- **La energía, en dos capas.** *(20 nov 2026.)* Primero la electricidad como requisito de los
  polos, por región del sistema eléctrico, con centrales que el Estado construye; después, las
  refinerías como origen de carga, junto con la carga.
- **Las privadas, en el mapa en su fecha real.** *(20 nov 2026.)* El jugador no las controla
  (como los trenes privados), pero las ve llegar. Las de antes de 2019 cuentan completas en la
  capacidad inicial.
- **Dos márgenes, tarde y noche.** *(20 nov 2026.)* La región necesita los dos arriba del
  mínimo: explica por qué la solar sola no basta y hubo apagones en Yucatán y Baja California.
- **La partida empieza el 1 de diciembre de 2018.** *(20 nov 2026.)* El día en que empezó el
  sexenio: da un mes más de juego, y el modo Realidad arranca el mismo día (ahí se ve el anuncio
  del Tren Maya, el 16 de diciembre). Diciembre trae la doceava parte del presupuesto de 2018.
- **Las exportaciones, con un enfoque mixto.** *(20 nov 2026.)* El usuario quiere medir
  exportaciones. La carga nacional será un número; la exportación va de un origen a una salida.
  Se mide en toneladas; el valor en dólares espera un valor por tonelada de fuente oficial.
- **Las aduanas son las salidas.** *(20 nov 2026.)* El usuario preguntó por las aduanas, que se
  reorganizaron (la ANAM, desde 2022): las de frontera, puertos y aeropuertos son por donde sale
  lo que se exporta, con su recaudación real. Modernizarlas como obra espera datos de tiempos de
  cruce.
- **Los aeropuertos, puertos secos.** *(20 nov 2026.)* Con vía cerca tienen estación y son paradas
  de tren; la carga que pase por ellos queda para el diseño de la carga.
- **El panel del Estado, una barra arriba.** *(20 nov 2026.)* Pedido del usuario: el presupuesto,
  la CFE, los empleos y las obras van en una fila a lo largo de la parte de arriba, del reloj al
  librito; las fichas de la derecha empiezan debajo.
- **Las toneladas de los aeropuertos, año por año en Realidad.** *(20 nov 2026.)* Con la serie
  mensual de la AFAC desde 2018.
- **Los aeropuertos de carga, en el tablero.** *(20 nov 2026.)* El usuario preguntó si todos los
  aeropuertos son de carga: no, la carga se concentra en pocos. Entran los diez primeros de la
  AFAC, como sitios con sus toneladas; serán puertos secos cuando se diseñe la carga.
- **Los polos, también en Realidad, solo con lo que se publica de cada uno.** *(20 nov 2026.)*
  Declaratoria, fallo de su licitación e inauguración. Un avance general («90 % de avance») que
  no dice de qué polo es no se asigna a ninguno.
- **Las centrales de la CFE, también en Realidad.** *(20 nov 2026.)* Con sus fechas oficiales y
  la capa de energía encendida; el margen de las regiones se marca como estimado, porque es el
  modelo del juego con las centrales reales.
- **Dos modos: Juego y Realidad.** *(20 nov 2026.)* El usuario vio que el tablero también sirve
  como visor de lo que se va haciendo de verdad. El mismo mapa, con las mismas obras: en un modo
  decides tú, en el otro se ve lo que pasó. Empieza por las obras de vía, con línea de tiempo.
- **La CFE tiene su propia caja.** *(20 nov 2026.)* Es una empresa del Estado con presupuesto
  propio; sus centrales no se pagan con el dinero de los trenes.
- **Las obras limpias de la península, con costo estimado.** *(20 nov 2026.)* El usuario pidió
  revisar los planes de Baja California Sur: entran al catálogo las termosolares (dos etapas), el
  Proyecto Oasis y Chicoasén II. La CFE no ha publicado el costo de ninguna; el juego lo estima
  con el costo por kW oficial o el de IRENA y lo marca como estimación. Mulegé se separa como
  sistema aislado propio, y el almacenamiento hace que una central cuente de noche.
- **El jugador es el Estado.** *(19 nov 2026.)* Tiene un presupuesto que debe usar
  sabiamente. Construir cuesta tiempo y dinero, y lo que se mide no es solo el dinero: también
  los **empleos generados**, que son de valor para el jugador.
- **Cuadrillas: tiempo contra costo.** *(19 nov 2026.)* Más cuadrillas terminan antes pero
  cuestan más.
- **Un polo no arranca lleno.** *(19 nov 2026.)* Se va ocupando con empresas, y solo empieza a
  llenarse cuando hay vía para llegar.
- **Cifras reales, simplificadas, de fuentes oficiales.** *(19 nov 2026.)* Y un mecanismo para
  mantenerlas al día (`npm run al-dia`), porque la realidad cambia con el tiempo.
- **Los Polos del Bienestar los construye el jugador; el juego solo dice dónde estarán.**
  *(19 nov 2026.)* Es la misma regla que las vías: lo hecho de 2018 en adelante es del
  jugador. Cada polo está donde lo pone su declaratoria en el DOF (el centroide de su
  polígono), no en el centro de su municipio. Solo entran los declarados: un polo anunciado
  sin declaratoria no tiene terreno todavía.
- **Puertos en la terminal o en la bocana**, no en el centro de la ciudad: es a donde llegan
  los barcos.
- **El juego es México; el mundo entra por dos salidas.** Los barcos que van a Asia o a
  Europa salen del tablero por una "puerta" y cruzan el océano de verdad hasta Shanghái o
  Róterdam: el tablero solo los pierde de vista, las vistas del mundo los siguen. Allá hacen
  una escala fija de 48 h; lo que pasa en esos puertos (qué cargan, quién lo pide) no se
  simula.
- **Las travesías se calculan como las rutas de México, no se dibujan.** Es el mismo método
  (malla, ruta más corta lejos de la costa, enderezado, auditoría), solo que sobre el mundo
  y enderezado en círculos máximos. *(19 nov 2026; reemplaza el tiempo fijo "gran círculo +
  10 %" que se usaba mientras el barco no se veía.)*
- **El mapa plano del mundo se centra en 130° O**, no en Greenwich. México queda en medio,
  con Asia a la izquierda y Europa a la derecha, y las dos travesías se ven enteras en vez
  de cortarse en el borde. Se corrió al oeste de México para que Shanghái no quede debajo
  del panel de barcos.
- **Los trenes van y vuelven; los barcos hacen circuitos.** Así operan una línea de
  ferrocarril y un servicio regular de navieras.
- **Nombres de barco inventados**, de la geografía de México, para no imitar barcos reales.
- **Rutas calculadas, no dibujadas.** Un servicio solo define sus paradas; el camino lo da
  la red. Si la red cambia (por ejemplo, porque el jugador construye una vía), las rutas
  cambian solas.
- **Los trenes del jugador no llevan nombre de empresa; las vías sí dicen de quién son.**
  *(20 nov 2026; antes no aparecía ninguna empresa.)* Los trenes son del Estado. Las vías
  dicen su dueño porque eso decide qué gana el Estado y cuánto le cuesta pasar.
- **El color significa algo.** Lo marítimo es cian (cada barco tiene su propio tono frío), lo
  ferroviario es ámbar (cada tren tiene su propio tono cálido), las ciudades son tinta clara y
  los Polos del Bienestar, rosa guinda (el color del programa, aclarado para leerse sobre el
  mar oscuro), punteados mientras no se construyan. Coloreada por dueño, la vía del Estado es
  blanca (es la del jugador) y cada concesionaria tiene su tono; coloreada por uso, verde,
  ámbar y rojo.
- **Las estaciones llegan hasta 15 km.** Más lejos, el sitio no tiene servicio de tren y su
  ficha dice a cuántos km queda la vía.

---

## 12. Bitácora de correcciones a los datos

Todo lo que se cambió respecto a las fuentes, y por qué.

### 20 de noviembre de 2026

- **Centrales de la CFE, con sus cifras oficiales.** El Sauz II y Manzanillo III tenían MW
  sacados de restar otras centrales a un total de la CFE (203 y 540 MW); la CFE publica 268.97
  MW (El Sauz II, Programa de Desarrollo 2026–2030) y 346 MW (Manzanillo III, boletín del 17 de
  abril de 2026). Puerto Peñasco decía primera etapa en febrero de 2024 y segunda en septiembre
  de 2025: fueron el 17 de febrero de 2023 y el 11 de septiembre de 2024 (boletín de la CFE e
  Informe Anual 2024). Las demás centrales ya en operación tienen ahora su fecha exacta.
- **Tren Maya, tramos 1 y 2.** Decían «inaugurado el 15 de diciembre de 2023», que fue la ruta
  Campeche–Cancún. Palenque–Campeche (el tramo 1 y el resto del 2) entró en servicio el 1 de
  enero de 2024.
- **Baja California Sur, en dos sistemas.** La región sumaba el sistema de La Paz y Los Cabos y el
  de Mulegé (529 MW de demanda en 2018 y 837 MW de capacidad). Ahora van aparte, como los publica
  el PRODESEN: Baja California Sur con 500 MW y 739 MW, Mulegé con 29 MW y 98 MW. Los márgenes
  oficiales de 2019 (35.4 % y 32.6 %) se quedan con Baja California Sur.
- **Dueño de cada tramo.** OpenStreetMap describe 2026; se corrigió a 2018:
  - Coatzacoalcos–Medias Aguas (líneas Z, ZA y FA) era de Ferrosur; pasó al Ferrocarril del
    Istmo por decreto (DOF del 19 de mayo de 2023). En el juego queda dentro del tramo largo
    Mérida–Medias Aguas, que es del Istmo: sus primeros ~95 km eran de Ferrosur en 2018.
  - Puebla–Oaxaca al sur de Tehuacán (línea E) pasó de Ferrosur al Istmo el 23 de febrero de
    2018.
  - Chiapas–Mayab: Genesee & Wyoming dejó la concesión en 2007 y desde entonces la opera el
    Ferrocarril del Istmo; su título se modificó en el DOF del 23 de febrero de 2018 (Cuenta
    Pública 2022 del FIT). Hoy OpenStreetMap la marca abandonada o reemplazada por el Tren
    Maya, pero en 2018 funcionaba.
- **3,590 km fuera de operación.** Las vías que OpenStreetMap marca abandonadas o en desuso y
  que no son de las líneas que se sabe que funcionaban en 2018. Incluye 26 km cerca de
  Saltillo (tramos 69 y 70 del archivo) que no casan con ninguna vía de OpenStreetMap.
- **Cuernavaca pierde su estación**: la única vía que le pasa cerca, México–Cuernavaca–Iguala,
  está fuera de operación.
- **Catálogo de obras.** Los trazos del Tren Maya (relación 13196595 de OpenStreetMap) y del
  ramal a Dos Bocas se simplificaron a 150 m y se partieron en Palenque, Escárcega, Calkiní,
  Izamal, Cancún, Playa del Carmen, Tulum y Chetumal. Sus km cuadran con los oficiales (tramo 1:
  225 contra 226 de Fonatur; Dos Bocas: 96 contra 92). Las vías muertas se agruparon en líneas
  por las que se tocan; las 16 de 75 km o más son obras de rehabilitación, con un nombre puesto
  por sus puntas (aproximado en los ramales de Sierra Mojada, El Mante, Ocotlán y Pánuco). En la
  línea de Durango, Natural Earth trae vías hacia la sierra que nunca se terminaron. Tres puntos
  fijos (Palenque, Ixtepec y Ciudad Hidalgo) parten su línea en dos para que las líneas FA y K
  puedan modernizarse por separado.
- **Estimado, no dato:** el tráfico de la troncal Monterrey–Ciudad de México (14 trenes al
  día) y la capacidad de 30 de los corredores de Nuevo Laredo y Piedras Negras. Ver
  [Tráfico y capacidad](#tráfico-y-capacidad).

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
- Los puertos pasaron de código a `src/lib/domain/datos/puertos.json`, para que el script de
  datos los lea y calcule las rutas marítimas.
- **Topolobampo** se movió a la boca de su bahía (25.555° N, 109.105° O), unos 6 km al
  suroeste del muelle. Su bahía se abre al mar por una boca angosta que, a la escala de la
  malla de rutas, queda cerrada: ninguna ruta podía salir del muelle sin cruzar la barra. Su
  estación de tren quedó a 8.7 km (antes 1.8 km).

**Rutas marítimas**

- **Canal de Panamá abierto a mano** sobre su trazo real (ver [Rutas marítimas](#8-rutas-marítimas)):
  en la fuente, y a esta escala, el istmo es tierra continua.
- **Salidas al mundo** definidas a mano en `puertas.json`: Asia en 23.5° N · 118.2° O (se
  movió desde 119.5° O para que quede a la vista junto al panel de la izquierda) y Europa en
  29.5° N · 77° O, pasado el estrecho de Florida.
- **Shanghái pasó del centro de la ciudad a la terminal de Yangshan** (30.627° N,
  122.067° E), el puerto de contenedores de aguas profundas en las islas frente a la bahía de
  Hangzhou. Al volverse destino real de las travesías, el punto tenía que estar donde llegan
  los barcos (la misma regla que los puertos de México), no en el centro de la ciudad, a
  88 km de la terminal (antes: 31.23° N, 121.47° E).
- **Cada salida dice qué océano cruza** (`oceano` en `puertas.json`): Pacífico o Atlántico.
- **Travesías calculadas** de cada salida a su puerto lejano (ver
  [Salidas al mundo y travesías oceánicas](#salidas-al-mundo-y-travesías-oceánicas)). Las 136
  rutas de México no cambiaron.

**Polos del Bienestar**

- Se ubicaron con el **cuadro de construcción de su declaratoria** (ver
  [Polos del Bienestar](#5-polos-del-bienestar)).
- **Erratas del DOF descartadas**: el vértice 81 de Ciudad Ixtepec (un dígito de más en el
  norte lo mandaba 20 km fuera) y el vértice de cierre de Matías Romero (1A repetido con
  y = 1,847,912.785 en lugar de 1,905,075.739: 57 km al sur).
- **Ciudad Ixtepec y Santa María Mixtequilla**, en coordenadas TME sin meridiano publicado: la
  longitud se fijó contra la autopista MEX-185D de OpenStreetMap.
- **Economía Circular Quintana Roo**: cuadro transcrito de la imagen del DOF.
- **San Jerónimo**: el marcador se bajó 750 m para quedar del lado mexicano de la frontera del
  tablero (la de Natural Earth corre ahí ~1 km al sur de la real).
- **Topolobampo**: se usa el polígono del acuerdo que modificó su declaratoria (29 abr 2026).
- **Reserva Zapotlán**: su nota aclaratoria (29 jul 2025) corrige la superficie a 9,108,169.94
  m² (910.82 ha) y el municipio a Zapotlán de Juárez; el polígono calculado da exactamente eso.
- **Capital de la Tecnología y la Sostenibilidad** (Puebla): su nota aclaratoria (29 jul 2025)
  le quita el "Futura" del nombre.
- **Parque Hidalgo** (economía circular, Tlaxcoapan y Atitalaquia, 275 ha), declarado el 1 de
  agosto de 2025, **no está**: su declaratoria se abrogó el 23 de julio de 2026.

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

## 13. Glosario

- **Nodo**: punto de la red donde algo cambia: un entronque, el final de una línea o el
  punto donde una vía pasa de primaria a secundaria.
- **Tramo**: la vía entre dos nodos.
- **Estación**: el punto de la vía que da servicio a un sitio; puede partir un tramo en dos.
- **Sitio**: una ciudad, un puerto, una salida al mundo o un Polo del Bienestar. Cada uno
  tiene una clave única, como `puerto:veracruz`, `ciudad:veracruz`, `puerta:asia` o
  `polo:tuxpan`.
- **Polo del Bienestar**: parque industrial declarado por el gobierno federal en el DOF; en el
  juego, un sitio por construir.
- **Declaratoria**: el acuerdo publicado en el DOF que crea un polo y delimita su terreno.
- **Concesión**: el título con el que el gobierno le dio a una empresa una línea de
  ferrocarril para operarla (casi toda la red, desde 1997). La vía sigue siendo de la nación;
  la empresa la opera y paga un derecho por usarla.
- **Derecho de paso**: el permiso para que los trenes de una empresa circulen por la vía de
  otra, pagándole.
- **Capacidad**: cuántos trenes al día caben en una vía.
- **Uso**: los trenes que de verdad pasan por una vía al día, entre su capacidad. Pasado el
  60 %, los trenes empiezan a esperarse.
- **Corredor**: una ruta de mucho tráfico (por ejemplo, Nuevo Laredo–Monterrey) cuyas vías
  llevan más trenes que el promedio de su empresa.
- **Fuera de operación**: vía que sigue en el mapa pero no tenía trenes en 2018.
- **PEF**: el Presupuesto de Egresos de la Federación, lo que la Cámara de Diputados aprueba
  gastar en el año. **PPEF**: el proyecto que envía el Ejecutivo antes de aprobarse.
- **Cuenta Pública**: el informe de lo que de verdad se gastó en el año (lo **ejercido**), que
  puede ser más o menos que lo aprobado.
- **Derecho por uso de vía**: lo que paga cada concesionaria al Estado por operar la vía, un
  porcentaje de sus ingresos.
- **Salida de exportación**: aduana a la que llega un tren (cruce fronterizo, puerto o aeropuerto
  con aduana propia); la carga que descarga ahí cuenta como exportación.
- **Margen de reserva**: cuánta capacidad disponible sobra sobre la demanda máxima de una
  región, en porcentaje. Se mide en el pico de la tarde y en el de la noche.
- **Región del sistema eléctrico**: cada zona que opera un centro de control del CENACE
  (Central, Oriental, Occidental, Noroeste, Norte, Noreste, Peninsular, Baja California y Baja
  California Sur). Mulegé, en el norte de Baja California Sur, es un sistema aparte.
- **Sistema aislado**: red eléctrica sin enlace con la red nacional. En el juego son tres: Baja
  California, Baja California Sur y Mulegé.
- **Termosolar**: central que concentra el sol con espejos sobre una torre y guarda el calor en
  sales fundidas, con lo que también genera de noche.
- **Central firme**: la que puede generar cuando se le pide (térmica, hidroeléctrica, nuclear,
  geotérmica), a diferencia de la solar y la eólica, que dependen del sol y del viento.
- **Obra del Estado**: vía que construye el jugador desde el catálogo: nueva, paralela,
  modernizada o rehabilitada. Siempre es del Estado.
- **Doble vía paralela**: la vía del Estado junto a una vía concesionada; los trenes del
  jugador ya no compiten con los privados.
- **Cuadrilla**: un equipo de obra. Más cuadrillas en un polo lo terminan antes y cuestan más.
- **Ocupación**: qué tanto de un polo operando ya tienen las empresas; da los empleos
  permanentes.
- **Calibración**: las cifras reales que mueven la mecánica, con su fuente y fecha
  (`datos/calibracion.json`).
- **Cuadro de construcción**: la tabla de una declaratoria con los vértices del polígono del
  terreno: rumbos, distancias y coordenadas.
- **TME (Transversal Modificado Ejidal)**: sistema de coordenadas del Registro Agrario
  Nacional, con el meridiano central de cada ejido.
- **Servicio**: la lista de paradas que recorre un vehículo. Un tren las recorre de ida y de
  vuelta; un barco, en circuito.
- **Escala**: una parada de barco en un puerto.
- **Salida al mundo (puerta)**: punto del borde del tablero por donde un barco sale hacia
  Asia o Europa. Como escala, representa a su puerto lejano.
- **Puerto lejano**: el puerto al que lleva una salida: Shanghái (Yangshan) o Róterdam.
- **Travesía**: el cruce del océano entre una salida y su puerto lejano. Fuera del tablero,
  pero a la vista en el mapa plano y en el globo.
- **Ruta marítima**: el camino por mar, ya calculado, entre dos puertos o salidas.
- **Pieza conectada**: un conjunto de vías unidas entre sí; un tren no puede pasar de una
  pieza a otra.
- **Marcha**: el tiempo que un tren pasa en movimiento, sin contar las esperas.
- **Vuelta completa**: ida, regreso y todas las esperas de un servicio.
