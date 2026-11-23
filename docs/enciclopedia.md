# Enciclopedia de Ruta Logística

Referencia de lo que hay en el juego: qué contiene, de dónde sale cada dato, qué se corrigió a
mano y por qué, y con qué reglas se mueve. Vive también dentro del juego: el librito de la esquina
superior derecha, junto al presupuesto, abre esta misma página (`/enciclopedia`), que se arma con este archivo.

> **Cifras al 23 de noviembre de 2026, con trenes, barcos, travesías oceánicas, los Polos del
> Bienestar, los dueños, el tráfico y la capacidad de cada vía, las obras del Estado, su
> presupuesto, la electricidad, el petróleo, los ductos, los combustibles, el comercio por mar y veintiséis polos por dentro.** No están escritas de memoria: se calcularon ejecutando el mismo código del juego
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
| Curaduría propia | Los 18 puertos, las 2 salidas al mundo y sus puertos lejanos (Shanghái y Róterdam), dos tramos de vía, el trazo del Canal de Panamá, nombres en español, abreviaturas de estados y varias correcciones (ver la [bitácora](#12-bitácora-de-correcciones-a-los-datos)) | — | Del proyecto |
| Cálculo propio sobre Natural Earth | Las 276 rutas marítimas entre puertos, salidas y complejos de plataformas, y las 2 travesías oceánicas de las salidas a sus puertos lejanos (ver [Rutas marítimas](#8-rutas-marítimas)) | Tierra 1:10m del tablero para las rutas; 1:50m del mundo para las travesías | Del proyecto |
| `logistica-oceanica` (proyecto hermano) | Velocidades de referencia de las clases de barco | — | Del proyecto |
| [Diario Oficial de la Federación](https://dof.gob.mx) | Las declaratorias de los 32 Polos del Bienestar vigentes: polígono, superficie, municipio y fecha de cada uno (ver [Polos del Bienestar](#5-polos-del-bienestar)) | Declaratorias del 12 de mayo de 2023 al 7 de agosto de 2026, con sus notas aclaratorias y modificaciones; consultadas el 19 de noviembre de 2026 | Documento oficial público |
| Secretaría de Economía | Lámina "Polos de Desarrollo Económico para el Bienestar" (22 de mayo de 2025): los polos anunciados por etapa | — | Documento oficial público |
| [OpenStreetMap](https://www.openstreetmap.org/copyright) | El trazo de la autopista MEX-185D, para ubicar dos polos cuyas coordenadas no traen meridiano (ver la nota ¹ de los polos); el operador y el estado (en uso, en desuso, abandonada) de cada vía, para saber de quién es cada tramo de la red | Consultado el 19 y el 20 de noviembre de 2026 | ODbL, © colaboradores de OpenStreetMap |
| [ARTF, Anuario Estadístico Ferroviario 2018](https://www.gob.mx/cms/uploads/attachment/file/1099335/Anuario_2018.pdf) | Los km de vía de cada empresa en 2018, para comprobar el reparto de dueños; la gasolina, el diésel y el combustóleo que movió el tren en 2018 (tabla 6-4); las toneladas de cada producto (tablas 6-1 y 6-2) y lo exportado (tabla 10), para la carga de las empresas de un polo | 2019 | Documento oficial público |
| [INEGI, Censos Económicos 2019, datos abiertos nacionales](https://www.inegi.org.mx/contenidos/programas/ce/2019/Datosabiertos/ce2019_nac_csv.zip) | Personal ocupado y gasto en electricidad y en agua de cada subsector de la manufactura en 2018: lo que pide una empresa de cada sector en un polo | 2020 | Dato oficial público |
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
| [ATTRAPI, Anuario Estadístico Ferroviario 2025, tablas A9 a A13](https://www.gob.mx/cms/uploads/attachment/file/1100990/Anuario_2025.pdf) | Toneladas que salen del país por tren cada año (2017–2025), por frontera y por puerto; las que entran por tren por cada puerto (tabla A12); el tráfico interior (carga nacional); la gasolina, el diésel y el combustóleo por tren en 2025 (carga por producto, p. 72) | 2026 | Documento oficial público |
| Pemex, Form 20-F ante la SEC de [2018](https://www.sec.gov/Archives/edgar/data/0000932782/000119312519129698/d632951d20f.htm), [2019](https://www.sec.gov/Archives/edgar/data/932782/000119312520136835/d850870d20f.htm) y [2020](https://www.sec.gov/Archives/edgar/data/932782/000119312521162651/d106092d20f.htm) | Crudo procesado por cada refinería de 2018 a 2020 y su estado en 2018; el inicio del Programa de Rehabilitación; la Olmeca autorizada; la coquizadora de Tula suspendida | 2019–2021 | Documento oficial público |
| [ASF, auditoría 2021-0219, Programa de Rehabilitaciones del Sistema Nacional de Refinación](https://www.asf.gob.mx/Trans/Informes/IR2021c/Documentos/Auditorias/2021_0219_a.pdf) | Capacidad de diseño, utilizada en 2021 y óptima de cada refinería; lo que el programa requería, lo que se le dio y lo que cubrió | Cuenta Pública 2021 (enero de 2023) | Documento oficial público |
| [Pemex, Informe Anual 2023](https://gaceta.diputados.gob.mx/PDF/65/2024/may/Pemex-20240514.pdf) (enviado al Congreso) | Proceso de 2022 y 2023; Tula, Salina Cruz y Minatitlán en 2023; Deer Park en 2022 y 2023; la producción que sustenta la Olmeca; lo que movió en 2023 por ducto, por tierra y por mar, y su flota | Mayo de 2024 | Documento oficial público |
| [Presidencia, presentación de resultados de Pemex](https://www.gob.mx/cms/uploads/attachment/file/913864/CPM_Pemex_resultados_03may24.pdf) | Combustibles producidos y déficit desde diciembre de 2018; transferencias del Gobierno Federal a Pemex 2019–abril de 2024; costo de la Olmeca y de las coquizadoras | 3 de mayo de 2024 | Documento oficial público |
| Pemex, comunicados en la Bolsa Mexicana de Valores: [24/2019](https://www.bmv.com.mx/docs-pub/eventemi/eventemi_928185_1.pdf), [159/2021](https://www.bmv.com.mx/docs-pub/eventemi/eventemi_1102962_1.pdf), [6/2022](https://www.bmv.com.mx/docs-pub/eventemi/eventemi_1159261_1.pdf), [38/2022](https://www.bmv.com.mx/docs-pub/eventemi/eventemi_1202976_1.pdf), [9/2025](https://www.bmv.com.mx/docs-pub/eventemi/eventemi_1440766_1.pdf), [11/2025](https://www.bmv.com.mx/docs-pub/eventemi/eventemi_1444789_1.pdf), [37/2025](https://www.bmv.com.mx/docs-pub/eventemi/eventemi_1501814_1.pdf), [51/2026](https://www.bmv.com.mx/docs-pub/eventemi/eventemi_1560083_1.pdf) y [87/2026](https://www.bmv.com.mx/docs-pub/eventemi/eventemi_1602784_1.pdf) | Arranque de la Olmeca; compra de Deer Park; acuerdos de las coquizadoras; Plan de Trabajo 2025–2030; proceso de 2024; avance de las coquizadoras; Deer Park en 2026 | 2019–2026 | Comunicado oficial |
| [Primer](https://gaceta.diputados.gob.mx/PDF/66/2025/sep/primer-informe-de-gobierno.pdf) y [Segundo Informe de Gobierno](https://gaceta.diputados.gob.mx/PDF/66/2026/sep/segundo-informe-de-gobierno.pdf) | Crudo procesado por cada refinería, mes por mes, de octubre de 2024 a junio de 2026 (SENER con datos de Pemex); en el anexo estadístico del segundo, la producción y la exportación de crudo y la gasolina, el diésel y la turbosina que Pemex produjo e importó cada año, y el crudo de cada bloque de producción (Cantarell, Ku-Maloob-Zaap, Abkatún-Pol-Chuc, Litoral de Tabasco y los de tierra) | Septiembre de 2025 y de 2026 | Documento oficial público |
| [SEMAR, Cuaderno de Faros del Golfo de México y Mar Caribe](https://www.gob.mx/cms/uploads/attachment/file/908970/CDF_GOLFO_MARZO_2024.pdf) | La posición de los complejos Akal-C y Pol-A, del rebombeo del Litoral y de la terminal de Cayo Arcas | Marzo de 2024 | Documento oficial público |
| CNH, dictámenes técnicos de los campos [Sinán](https://www.gob.mx/cms/uploads/attachment/file/856365/II.9_Dictamen_Tecnico_Mod_Plan_Desarrollo_Campo_Sinan.pdf), May, Koban y [Maloob](https://www.gob.mx/cms/uploads/attachment/file/524951/Dictamen_Tecnico_MPD_Maloob.pdf) | Los ductos del Centro de Proceso Litoral-A, para ubicarlo; el campo Maloob | 2019–2023 | Documento oficial público |
| ASF, auditorías [2017-0485](https://www.asf.gob.mx/trans/informes/ir2017c/Documentos/Auditorias/2017_0485_d.pdf) y [2017-0486](https://www.asf.gob.mx/trans/informes/ir2017c/Documentos/Auditorias/2017_0486_a.pdf) | Qué bloque de producción de Pemex era Cantarell y cuál Ku-Maloob-Zaap | Cuenta Pública 2017 | Documento oficial público |
| [OurAirports, radioayudas](https://davidmegginson.github.io/ourairports-data/navaids.csv) | La posición del complejo Ku, por su radiofaro: a falta de una oficial | Consultado el 22 de noviembre de 2026 | Dominio público (no oficial) |
| [La Jornada Maya, «Son bombas de tiempo las 240 plataformas de Pemex en la Sonda de Campeche»](https://www.lajornadamaya.mx/campeche/217526/son-bombas-de-tiempo-las-240-plataformas-de-pemex-en-la-sonda-de-campeche-hernandez-perez) | Cuántas plataformas hay en la Sonda de Campeche, con datos de la SEMAR: 43 tripuladas y unas 200 satélite, con cerca de 17 mil trabajadores | 2020 | Prensa |
| [OpenStreetMap](https://www.openstreetmap.org/) | El predio de cada refinería | Consultado el 20 de noviembre de 2026 | ODbL, © colaboradores de OpenStreetMap |
| CNH, capas de ductos [integrados y no integrados al SISTRANGAS y de importación (2019)](https://idegeo.centrogeo.org.mx/geoserver/ows?service=wfs&version=1.0.0&request=GetCapabilities), [de 2018](https://agsserver.sigsa.info/arcgis/rest/services/Monitoreo_de_flujo_en_tiempo_real_MIL1/MapServer/4) y de [poliductos de Chihuahua](https://services6.arcgis.com/th3TMn162i37A876/ArcGIS/rest/services/AppMote/FeatureServer/14) | El trazo aproximado de los gasoductos (del Estado, privados y de importación) y de los poliductos de Pemex del centro, el golfo y Chihuahua, con capacidad, inversión, permiso y fecha de cada gasoducto privado. La CNH ya no existe y su mapa no responde: se usan las copias en el GeoNode de CentroGeo y en otros servidores | 2018 y 2019 | Documento oficial público (CNH con información de SENER, CENAGAS, CRE y CFE) |
| [CFE, Plan de Negocios 2021–2025](https://www.cfe.gob.mx/finanzas/Documents/Plan%20de%20Negocios%20CFE%202021.pdf) | La red de gasoductos de la CFE con capacidad y longitud; los que entraron en 2018 y 2019, los detenidos y dónde falta gas | 2021 | Documento oficial público |
| [CFE, Programa de Desarrollo 2026–2030, tabla 2](https://www.cfe.gob.mx/finanzas/Documents/ProgramaDesarrollo-26.pdf) y [Informe Anual 2024](https://www.cfe.gob.mx/finanzas/reportes-financieros/Reportes%20Anuales%20Documentos/Informe%20Anual%202024.pdf) | Los gasoductos en desarrollo (Cuxtal II, Centauro del Norte, ramales de Puerta al Sureste); Puerta al Sureste en operación desde mayo de 2025; la fase I del Cuxtal II; la aportación de la CFE a la alianza con TC Energy | 2025 y 2026 | Documento oficial público |
| [SENER, Plan de Desarrollo del Sector Hidrocarburos](https://dof.gob.mx/nota_detalle_popup.php?codigo=5798065) | La red de ductos de 2024 (21,149 km de gas, 9,582 de petrolíferos); los proyectos de la CFE, del CENAGAS y de Pemex con su avance; lo que usó el país de gasolina, diésel y turbosina de 2010 a 2024 (tabla 2.24) | 4 de agosto de 2026 | Documento oficial público |
| [SENER, mapa «Infraestructura Nacional de Petrolíferos, 2018»](http://web.archive.org/web/20220326183525/https://www.gob.mx/cms/uploads/attachment/file/416897/Mapa_log_stica_Sener_8_Reg_31-10-2018_Nueva_numeraci_n_VF.pdf) | Las 73 terminales de almacenamiento y las 5 marítimas de Pemex, con su capacidad y su medio de suministro, y los poliductos de cada región. Ya no está en gob.mx: se usa la copia del Internet Archive | 31 de octubre de 2018 | Documento oficial público |
| [CNH, capa de terminales de almacenamiento de Pemex](https://geomaticasig1.semarnat.gob.mx/arcgis/rest/services/Hosted/Terminal_de_almacenamiento_Pemex/FeatureServer/1) | La ubicación de cada terminal (copia en el servidor de la SEMARNAT) | 2016 | Documento oficial público |
| [CNE, datos abiertos de petrolíferos](https://www.gob.mx/cne/articulos/consulta-de-datos-abiertos) | Litros de gasolina y diésel vendidos en las gasolineras de cada estado y de turbosina entregados en sus aeródromos: el consumo de cada estado | Abril a diciembre de 2018 | Dato oficial público |
| ASF, auditorías [474-DE](https://www.asf.gob.mx/Trans/Informes/IR2018c/Documentos/Auditorias/2018_0474_a.pdf) y [476](https://www.asf.gob.mx/Trans/Informes/IR2018c/Documentos/Auditorias/2018_0476_a.pdf) a Pemex Logística | Lo que movió Pemex en 2018 por ducto, autotanque, carro tanque y buque tanque; su flota al cierre de 2018 | Cuenta Pública 2018 | Documento oficial público |
| [SEMAR, Anuario Estadístico de los Puertos de México 2024](https://www.gob.mx/asuntosmaritimosyportuarios/documentos/anuario-estadistico-de-los-puertos-de-mexico-2024) | Petróleo y derivados por puerto en 2018 y 2024: importación, exportación y cabotaje; la carga que sale de Dos Bocas y Ciudad del Carmen a las plataformas y cuántos barcos la llevan; el crudo que exporta Cayo Arcas; lo que cada puerto exportó e importó por mar en 2024 por tipo de carga (contenerizada, granel agrícola y mineral, general suelta) y en cuántos barcos | 2025 | Documento oficial público |
| [EIA (gobierno de EUA), unidades de International Energy Statistics](https://www.eia.gov/cfapps/ipdbproject/docs/unitswithpetro.php) | Barriles por tonelada de gasolina, diésel y turbosina, para pasar a toneladas lo que cabe en un tren | Consultado el 22 de noviembre de 2026 | Dato oficial público (gobierno de EUA) |
| [Pemex, boletines regionales de Tampico 2019-004 y 2024-005](https://www.pemex.com/saladeprensa/boletines_regionales/Paginas/2024-005_tampico.aspx) | Lo que carga un buque tanque de su flota: 320 mil barriles. El sitio de Pemex no deja leerlos automáticamente; la cifra es la que muestra el buscador | 2019 y 2024 | Comunicado oficial |
| Proyectos México, fichas [0770](https://www.proyectosmexico.gob.mx/proyecto_inversion/770-cfe-gasoducto-sur-de-texas-tuxpan-marino/), [0771](https://www.proyectosmexico.gob.mx/proyecto_inversion/771-cfe-gasoducto-la-laguna-aguascalientes/) y [0767](https://www.proyectosmexico.gob.mx/proyecto_inversion/767-cfe-gasoducto-samalayuca-sasabe/) y [ciclo de inversión en hidrocarburos](https://www.proyectosmexico.gob.mx/como-invertir-en-mexico/ciclo-inversion/ciclos-hidrocarburos/) | Inicio de operación del Sur de Texas–Tuxpan, La Laguna–Aguascalientes y Samalayuca–Sásabe; kilómetros de oleoductos y poliductos de Pemex | 2021 y 2026 | Documento oficial público |
| [La Jornada, «Opera gasoducto que provocó una controversia entre CFE y privados»](https://www.jornada.com.mx/2020/10/03/economia/018n1eco) | El Villa de Reyes–Aguascalientes–Guadalajara entró en operación el 1 de octubre de 2020, según la CFE y Fermaca | 3 de octubre de 2020 | Prensa |
| EIA (gobierno de EUA), [régimen térmico de los ciclos combinados](https://www.eia.gov/electricity/annual/html/epa_08_02.html) y [poder calorífico del gas](https://www.eia.gov/tools/faqs/faq.php?id=45&t=8) | Cuánto gas quema un ciclo combinado por MW: 7,627 Btu por kWh (2018) y 1,037 Btu por pie cúbico | 2025 | Dato oficial público (gobierno de EUA) |
| [OpenStreetMap](https://www.openstreetmap.org/) | El trazo del oleoducto Nuevo Teapa–Salina Cruz | Consultado el 22 de noviembre de 2026 | ODbL, © colaboradores de OpenStreetMap |
| [INEGI, PIB por Entidad Federativa, base 2018](https://www.inegi.org.mx/programas/pibent/2018/) | Valor agregado de las actividades primarias y secundarias de cada estado y de la extracción de petróleo, 2018–2023 (2023 preliminar): el reparto de la carga nacional | 2024 | Dato oficial público |
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
| Empleos de los polos: [Presidencia, 26 jun 2025](https://www.gob.mx/presidencia/prensa/plan-mexico-presidenta-claudia-sheinbaum-pone-en-marcha-los-primeros-15-polos-de-desarrollo-economico-para-el-bienestar-en-14-estados?idiom=es-MX) (los primeros 15 polos, 300 mil empleos), [Gobierno de Nezahualcóyotl, 26 jun 2025](https://www.neza.gob.mx/prensa_2025/single.php?id=100) (4,500 empleos directos en la primera etapa), [Presidencia, 19 ago 2026](https://www.gob.mx/presidencia/prensa/presidenta-destaca-inversion-de-10-mil-106-mdp-para-el-podecobi-de-zapotlan-hidalgo-que-ya-reune-147-mil-mdp-en-proyectos) (Zapotlán: 5,100 de DEWA en su primera fase; los 191 mil de 130 proyectos del estado) y [Gobierno de Michoacán, 30 ene 2026](https://michoacan.gob.mx/noticias/entrega-bedolla-a-herso-y-citelis-primeras-areas-de-desarrollo-del-parque-bajio-invertiran-6-mil-300-mdp/) (27 mil empleos dentro del Parque Bajío en 10 años) | Cuántos empleos da un polo lleno: su propia cifra o la densidad del conjunto. Se revisaron también los anuncios de [Quintana Roo](https://qroo.gob.mx/firma-quintana-roo-el-polo-de-desarrollo-economico-para-el-bienestar-mas-empleo-inversion-y-una-economia-justa-para-chetumal/) y [Sinaloa](https://sinaloa.gob.mx/topolobampo-entre-los-cinco-polos-de-desarrollo-economico-para-el-bienestar-con-mayor-inversion/), que suman proyectos de fuera del polo | 2025 y 2026 | Comunicado oficial |
| Presidencia de la República y Gobierno de Tlaxcala | Tiempos y empleos del polo de Huamantla, el único terminado: su ritmo de obra y su proyección de empleos; en la [versión estenográfica de su inauguración](https://www.gob.mx/presidencia/es/articulos/version-estenografica-inauguracion-del-polo-de-desarrollo-economico-para-el-bienestar-podecobi-huamantla?idiom=es), los siete lotes vendidos con su superficie, las obras que hizo el estado y cómo se paga la urbanización | Comunicados del 14 oct 2025 al 12 abr 2026 | Documento oficial público |
| [CFE, Programas y Proyectos de Inversión 2024](https://portales-transparencia.cfe.mx/corporativo/31%20Informe%20presupuestl%20balance%20general%20y%20estado%20fi/Direcci%C3%B3n%20Corporativa%20de%20Finanzas/Gerencia%20de%20Presupuestos/2024/Cartera%20de%20CFE%20pre%20cierre%20DIC%2010012025%204o%20trim.pdf) | Cada proyecto de inversión de la CFE con sus MVA, km-c, fechas y costo total: el costo por MVA de las subestaciones de distribución y lo que tardaron las subestaciones Kantenah y Leona Vicario, para ampliar la subestación de un polo | Cierre de diciembre de 2024 | Documento oficial público |
| Secretaría de Economía, [ficha del polo Huamantla](https://podecobi.economia.gob.mx/polos-de-desarrollo) y [nota del 18 de diciembre de 2025](https://podecobi.economia.gob.mx/en/news/plan-mexico-avanza-polo-de-desarrollo-economico-en-tlaxcala/) | Energía disponible (8 MVA), agua, gas a 3 km, conexión ferroviaria y superficie total (61.8 ha) de Huamantla; su CECI y su fecha de término | 2025 | Documento oficial público |
| [OpenStreetMap](https://www.openstreetmap.org/copyright), vía Overpass y el extracto de México de [Geofabrik](https://download.geofabrik.de/north-america/mexico.html) | Los alrededores de cada polo con vista por dentro: calles, carreteras, vías y su operador, líneas de alta tensión y subestaciones de la CFE, ríos, poblados y zonas industriales | Consultado el 22 y el 23 de noviembre de 2026 (el extracto, cortado el 22 de noviembre) | ODbL, © colaboradores de OpenStreetMap |

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

Los **18 puertos se curaron a mano**: la capa de puertos de Natural Earth no trae Lázaro
Cárdenas (el segundo del país en contenedores) ni Altamira (el cuarto). Las coordenadas son las de
la terminal; en los puertos de río (Altamira, Tampico, Tuxpan) y en Topolobampo, al fondo de
una bahía, el marcador va en la bocana, que es a donde llega un barco. La Paz y Acapulco
entraron con los combustibles: los dos estados se surten solo por mar. Ciudad del Carmen entró
con las plataformas: es base de abasto costa afuera.

★ = principal: los cuatro puertos que mueven la mayor parte de los contenedores del país
(Manzanillo, Lázaro Cárdenas, Veracruz, Altamira). En el mapa llevan un rombo más grande.

| Puerto | Estado | Litoral | Lat, lon | Tren |
| --- | --- | --- | --- | --- |
| Ensenada | Baja California | Pacífico | 31.855, -116.625 | Sin vía (a 68 km) |
| Guaymas | Sonora | Pacífico | 27.915, -110.860 | Estación |
| Topolobampo | Sinaloa | Pacífico | 25.555, -109.105 | Estación a 8.7 km |
| La Paz | Baja California Sur | Pacífico | 24.264, -110.327 | Sin vía (a 198 km) |
| Mazatlán | Sinaloa | Pacífico | 23.195, -106.405 | Estación a 4.2 km |
| Manzanillo ★ | Colima | Pacífico | 19.065, -104.305 | Estación |
| Lázaro Cárdenas ★ | Michoacán | Pacífico | 17.945, -102.175 | Estación |
| Acapulco | Guerrero | Pacífico | 16.848, -99.904 | Sin vía (a 129 km) |
| Salina Cruz | Oaxaca | Pacífico | 16.165, -95.195 | Estación |
| Puerto Chiapas | Chiapas | Pacífico | 14.705, -92.405 | Estación a 12.5 km |
| Altamira ★ | Tamaulipas | Golfo | 22.480, -97.840 | Estación |
| Tampico | Tamaulipas | Golfo | 22.258, -97.780 | Estación a 6.4 km |
| Tuxpan | Veracruz | Golfo | 20.955, -97.280 | Sin vía (a 99 km) |
| Veracruz ★ | Veracruz | Golfo | 19.205, -96.135 | Estación |
| Coatzacoalcos | Veracruz | Golfo | 18.140, -94.410 | Estación |
| Dos Bocas | Tabasco | Golfo | 18.430, -93.180 | Sin vía (a 89 km) |
| Ciudad del Carmen | Campeche | Golfo | 18.665, -91.795 | Sin vía (a 93 km) |
| Progreso | Yucatán | Golfo | 21.285, -89.665 | Estación |

"Estación" sin distancia significa que la vía pasa a 3 km o menos.

### Notas por puerto

- **Ensenada** — Puerto de Baja California. La única vía de la península en los datos
  (Tijuana–Tecate) no llega aquí ni conecta con la red nacional.
- **Guaymas** — Llega el tren por Empalme, cruzando la bahía. Ese cruce se había perdido al
  recortar las vías con la costa y se recuperó (ver bitácora).
- **Topolobampo** — Extremo del Pacífico de la línea Chihuahua al Pacífico. El marcador está en
  la boca de la bahía, unos 6 km al suroeste del muelle (ver bitácora).
- **La Paz** — El marcador está en Pichilingue, el puerto comercial de la bahía. Baja
  California Sur no tiene tren: todo su combustible llega por mar, a la terminal de Pemex de La Paz.
- **Mazatlán** — Sobre la línea del Pacífico (Guadalajara–Nogales).
- **Manzanillo ★** — El puerto de contenedores más grande de México. La fuente dejaba su vía
  a 34 km del puerto; el tramo Cuyutlán–Manzanillo se trazó a mano (ver bitácora).
- **Lázaro Cárdenas ★** — El segundo en contenedores. Arranque del corredor hacia Nuevo
  Laredo.
- **Acapulco** — Sin vía en los datos. En 2018 recibió 1.23 millones de toneladas de
  petrolíferos por cabotaje (SEMAR): la terminal de Pemex de Guerrero se surte por mar.
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
- **Dos Bocas** — Puerto petrolero de Tabasco y la base principal del abasto a las plataformas. Sin
  vía en los datos.
- **Ciudad del Carmen** — En la isla del Carmen. Todo lo que mueve es cabotaje: el abasto a las
  plataformas (207 mil toneladas salieron en 2018). Sin vía en los datos.
- **Progreso** — El puerto de Mérida, a 36 km por vía.

**Ciudades portuarias.** Diez puertos comparten nombre con una ciudad del juego (Ensenada,
Guaymas, La Paz, Mazatlán, Manzanillo, Lázaro Cárdenas, Acapulco, Salina Cruz, Tampico,
Veracruz). En el mapa son un solo lugar: la etiqueta es la del puerto y su ficha muestra la
población de la ciudad.

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
  (Transversal Modificado Ejidal)** del Registro Agrario. Una nota al pie de cada cuadro da su
  meridiano central, 95°15' O, con factor de escala 1.0. La latitud es exacta. La longitud del
  marcador se fijó poniendo el vértice sur de cada polígono sobre la autopista MEX-185D (trazo de
  OpenStreetMap), que es donde lo muestran los croquis de las declaratorias.
  - **Mixtequilla:** con el meridiano de su nota, su borde corre 3.7 km sobre la MEX-190D y casi
    1 km sobre la MEX-185D, como dice su declaratoria; su vista por dentro lo usa, y su centro
    queda a 506 m del marcador.
  - **Ixtepec:** el mismo meridiano lo manda 17.7 km al oeste de su croquis. Su vista por dentro
    usa el meridiano 95.0828° O, que pone 2.2 km de su borde sobre la MEX-185D; su centro queda a
    446 m del marcador.
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
| Capital de la Tecnología y la Sostenibilidad | San José Chiapa y Nopalucan, Puebla | 218 ha | [1 jul 2025](https://dof.gob.mx/nota_detalle.php?codigo=5761567&fecha=01/07/2025) | 2 km |
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

Total: 32 polos, 8,590 ha.

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
   *Construir* pide confirmación. Huamantla, que tiene vista por dentro, se construye por
   frentes desde adentro (ver [Huamantla por dentro](#huamantla-por-dentro)).
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
| Empleos permanentes | Los del polo lleno × ocupación. Con cifra oficial propia, esa; sin ella, **61.2 por hectárea** | Huamantla: «más de 5 mil empleos directos e indirectos» en 53 ha (Presidencia, 12 abr 2026). Nezahualcóyotl: «4 mil 500 empleos directos» en su primera etapa, 68.4 ha (su gobierno municipal, 26 jun 2025). Los demás: los «300 mil empleos» de los primeros 15 polos del Plan México (Presidencia, 26 jun 2025) entre las 4,905 ha de los 14 que tiene el juego (ver [Cuántos empleos da un polo](#cuántos-empleos-da-un-polo)) |
| Ocupación | de 0 a 100 % en 3 años, solo con tren | Supuesto del juego: no hay cifra oficial de cuánto tarda un polo en llenarse |
| Dinero para construir | El presupuesto del Estado: llega cada mes (ver [El presupuesto del Estado](#el-presupuesto-del-estado)) | Presupuesto federal real para ferrocarriles y derecho de las concesionarias |

Ejemplos (calculados con el código del juego):

| Polo | Superficie | Cuadrillas | Costo | Duración | Gente en la obra | Empleos lleno |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Huamantla | 53 ha | 1 | 291 millones | 24 meses | 173 | 5,000 |
| Huamantla | 53 ha | 4 | 422 millones | 8.5 meses | 707 | 5,000 |
| Tuxpan | 235 ha | 1 | 1,291 millones | 37.5 meses | 490 | 14,213 |
| Tuxpan | 235 ha | 4 | 1,872 millones | 13.3 meses | 2,006 | 14,213 |
| Reserva Zapotlán | 911 ha | 1 | 5,000 millones | 56.3 meses | 1,264 | 55,064 |
| Reserva Zapotlán | 911 ha | 4 | 7,251 millones | 20 meses | 5,177 | 55,064 |
| Altamira | 1,638 ha | 1 | 8,991 millones | 67.2 meses | 1,907 | 99,013 |
| Altamira | 1,638 ha | 4 | 13,038 millones | 23.8 meses | 7,806 | 99,013 |

**Lo que se sabe y lo que no.** El costo sale de un solo polo (Zapotlán). Los empleos
permanentes son proyecciones oficiales e incluyen indirectos. La razón de empleos de obra es la
de la construcción en Veracruz, no la nacional. Cuando el
gobierno publique más polos terminados, se recalibra (ver *Mantener el juego al día* en
[Fuentes](#1-fuentes)). Dato de contexto del informe 2025–2026 del Corredor Interoceánico: sus
polos se concesionan a desarrolladores privados, y de nueve concesionados en 2025 quedaron cinco
en 2026 (tres concesionarios incumplieron y uno renunció).

### Cuántos empleos da un polo

Los empleos del polo lleno salen de las cifras oficiales. Se buscaron en las 32 declaratorias (no
traen ninguna), en los comunicados de Presidencia y de Economía, en los Informes de Gobierno y
en los gobiernos estatales y municipales.

**Cifras de un polo, de su propio terreno:**

| Polo | Hectáreas | Empleos | Por hectárea | Qué son |
| --- | ---: | ---: | ---: | --- |
| Huamantla | 53 | 5,000 | 94 | «Más de 5 mil empleos directos e indirectos» con el polo vendido (Presidencia; Segundo Informe) |
| Nezahualcóyotl | 68.4 | 4,500 | 66 | «4 mil 500 empleos directos» en su primera etapa (la gobernadora, en el boletín del municipio) |
| Parque Industrial Bajío | 342.1 | 27,000 | 79 | «27 mil empleos formales y especializados» dentro del parque en sus primeros 10 años (la Secretaría de Desarrollo Económico de Michoacán, 30 ene 2026) |
| Reserva Zapotlán | 910.8 | 5,100 | — | Los de su desarrollador, DEWA, en la primera de cinco fases: la urbanización y las dos primeras naves (Presidencia, 19 ago 2026) |

**Cifras que no son de un polo, aunque se anuncien con él:**
- **Zapotlán, 191 mil:** son los 130 proyectos de Hidalgo que el gobernador sumó al polo, con la
  cementera de Cruz Azul en Tula (14,200 empleos), que está fuera de él.
- **Chetumal, 16 mil:** son el polo, el Recinto Fiscalizado Estratégico y un tianguis.
- **Topolobampo, 30 mil:** son toda la región norte de Sinaloa.

**La cifra de conjunto:** los primeros 15 polos del Plan México generarán **300 mil empleos en
esta administración** (Presidencia, 26 de junio de 2025; Primer Informe de Gobierno). El juego
tiene 14 de ellos, con 4,905 ha; el 15.º, de economía circular en Hidalgo, no tiene superficie
publicada. Eso da **61.2 empleos por hectárea**, cerca de los 66 de Nezahualcóyotl. (Eran 60.5
mientras el juego tuvo las 275.2 ha con que se declaró Capital de la Tecnología; su nota
aclaratoria las bajó a 217.68.)

**Cómo los usa el juego:**
- **Un polo con cifra oficial de su terreno la usa:** Huamantla 5,000, Nezahualcóyotl 4,500 y
  Parque Industrial Bajío 27,000.
- **Los demás usan los 61.2 por hectárea del gobierno**, una estimación del juego con la cifra
  oficial de conjunto.
- **Por qué por hectárea:** a diferencia de la electricidad, los empleos sí crecen con el terreno,
  porque las empresas ocupan lotes. Las cifras de primera fase se parecen (unos 5 mil), pero un
  polo lleno no es su primera fase.
- **Antes** todos usaban los 94.3 por hectárea de Huamantla, un polo chico y vendido completo. Así
  Altamira daba 154 mil empleos y los 32 polos, 815 mil. Ahora Altamira da 100 mil y los 32, 534
  mil (531 mil con los 60.5 por hectárea, y 525 mil antes de usar la cifra de Bajío, que con la
  densidad daba 20,681).

### Huamantla por dentro

Un polo puede tener **vista por dentro**: en su ficha, *Entrar al polo ›* lleva la cámara del
tablero hasta él y abre su acercamiento (`/mexico/polo/huamantla`). Por ahora la tienen
Huamantla, [Coatzacoalcos I](#coatzacoalcos-i-por-dentro), [Texistepec](#texistepec-por-dentro),
[Altamira](#altamira-por-dentro), [Nezahualcóyotl](#nezahualcóyotl-por-dentro),
[Reserva Zapotlán](#reserva-zapotlán-por-dentro), [San Jerónimo](#san-jerónimo-por-dentro),
[Parque Industrial Bajío](#parque-industrial-bajío-por-dentro), [Hermosillo](#hermosillo-por-dentro),
[Topolobampo](#topolobampo-por-dentro), [Puerta Logística del Bajío](#puerta-logística-del-bajío-por-dentro),
[Durango](#durango-por-dentro), [Salina Cruz](#salina-cruz-por-dentro), [Arriaga](#arriaga-por-dentro),
[Tapachula I](#tapachula-i-por-dentro), [Tapachula II](#tapachula-ii-por-dentro), [Teapa](#teapa-por-dentro),
[San Blas Atempa](#san-blas-atempa-por-dentro), [San Juan Evangelista](#san-juan-evangelista-por-dentro),
[Matías Romero](#matías-romero-avendaño-por-dentro), [Mixtequilla](#santa-maría-mixtequilla-por-dentro),
[Ciudad Ixtepec](#ciudad-ixtepec-por-dentro), [Asunción Ixtaltepec](#asunción-ixtaltepec-por-dentro),
[Economía Circular Puebla](#economía-circular-puebla-por-dentro),
[Economía Circular Tlaxcala](#economía-circular-tlaxcala-por-dentro) y
[Capital de la Tecnología](#capital-de-la-tecnología-y-la-sostenibilidad-por-dentro).
El reloj sigue corriendo adentro, con el
presupuesto arriba; *← México* o Esc vuelven al tablero, encima del polo.

**Qué se ve.** El terreno tal como lo declara el DOF, y lo que hay alrededor según
OpenStreetMap: la carretera federal MEX 136, que corre por su costado; la **Línea S de
Ferrosur**, a 1.04 km al suroeste; la Línea V de CPKC, al norte; las líneas de 115 kV de la CFE
y sus subestaciones Huamantla 2000 y Cuauhtémoc; los poblados, y la Ciudad Industrial
Xicohténcatl II, su vecina. Adentro, los lotes, la avenida principal y las obras de cada frente
según avanzan, con las cuadrillas trabajando donde va cada frente. Al operar, los lotes se
llenan de empresas al ritmo de la ocupación.

**El terreno**, de la declaratoria (DOF, 14 de agosto de 2025): un cuadro de construcción de 37
vértices en UTM zona 14. Convertido con el código del juego, el área da exactamente los
530,000 m² declarados, el perímetro los 3,310.8 m y el vértice 1 cae a 0.00 m de las
coordenadas geográficas que también da el DOF. El dibujo usa la cuadrícula UTM, cuyo norte se
aparta 0.35° del norte verdadero ahí.

**Los lotes.** En la inauguración (12 de abril de 2026), el Gobierno de Tlaxcala dijo quién
compró y cuánto: Gravity 20 ha, El Charrito 11, Sonavox 6.9, Rebelbox 2.5, Grupo Caná 2,
Geometrika 1000 1.5 y Color Link 1; en total 44.9 ha, «totalmente vendido». Dónde queda cada
lote no se publica: el acomodo es del juego, con una avenida de 26 m a lo largo del polo y
accesos de 14 m entre lotes. Al centro de negocios, comedor y estancia infantil (CECI) que tiene
el polo (Presidencia, Economía) el juego le da 1.2 ha, a la entrada; lo que sobra es área común
y reserva. En el juego los lotes se llaman *Lote 1* a *Lote 7*; en Realidad llevan el nombre de
su empresa. Después se compraron otras 7.8 ha, ya vendidas, que no están en la declaratoria.

**La obra por frentes.** El Gobierno de Tlaxcala se comprometió a «la energía, las vialidades,
la iluminación, todo lo necesario para que se instalen las empresas», y el polo tiene centro
de negocios, comedor y estancia infantil; la ficha de Economía da 8 MVA de energía, agua con
disponibilidad confirmada, gas natural a 3 km y conexión ferroviaria. El juego lo arma en
cinco frentes (`domain/interior.ts`):

| Frente | Parte del costo y del tiempo del polo | 1 cuadrilla | 2 cuadrillas | 4 cuadrillas |
| --- | ---: | ---: | ---: | ---: |
| Vialidades e iluminación | 40 % | 116 millones, 9.6 meses | 134 millones, 5.7 meses | 169 millones, 3.4 meses |
| Agua potable y drenaje | 25 % | 73 millones, 6.0 meses | 84 millones, 3.6 meses | 106 millones, 2.1 meses |
| Energía eléctrica | 25 % | 73 millones, 6.0 meses | 84 millones, 3.6 meses | 106 millones, 2.1 meses |
| Centro de negocios, comedor y CECI | 10 % | 29 millones, 2.4 meses | 34 millones, 1.4 meses | 42 millones, 0.9 meses |
| Espuela de tren (1.04 km) | aparte | 47 millones, 5.7 meses | 54 millones, 3.4 meses | 68 millones, 2.0 meses |

- **Las cuatro partes** (40, 25, 25 y 10 %) son **estimación del juego**: nadie publica cuánto
  costó cada parte. Juntas suman lo que cuesta el polo entero con las fórmulas de arriba.
- **El polo tiene 4 cuadrillas** para sus cuatro frentes urbanos, las mismas que el polo entero
  tenía antes: el jugador decide cómo repartirlas. En frentes distintos trabajan a la vez; varias
  en un mismo frente rinden cada vez menos (el mismo exponente de 0.75). Al terminar un frente,
  sus cuadrillas quedan libres para otro. Bien repartidas (2 en vialidades, 1 en agua, 1 en
  energía y, al acabar las calles, las 2 libres en servicios) Huamantla queda en unos 7 meses y
  313 millones, cerca del récord real de 8.5 meses.
- **La espuela** es obra de vía, con cuadrillas propias (hasta 4). Va de la Línea S de Ferrosur
  al polo, 1.04 km en línea recta (OpenStreetMap), al costo por km del ramal a Dos Bocas (65.8
  millones, SICT) y a su paso, 5.6 km al mes con 4 cuadrillas, con un mínimo de 2 meses:
  estimación del juego. **El polo recibe su estación solo con la espuela**: sin ella queda
  urbanizado pero sin tren, y sin tren no llegan empresas. No se ha reportado que el polo real
  tenga espuela; la ficha de Economía solo dice «conexión ferroviaria».
- **La energía**: la primera mitad del frente es la conexión a la línea de 115 kV más cercana
  (0.71 km, OpenStreetMap) y su subestación; la segunda, la red adentro del polo.
- Se paga conforme avanza, como cualquier obra del Estado; si se acaba el dinero, el frente se
  detiene donde va. Con 0 cuadrillas también.

El polo está **urbanizado** (operando) cuando terminan sus cuatro frentes urbanos. En el modo
Realidad la vista muestra el polo real: urbanizado desde su inauguración (o al avance real
mientras estaba en obra), con los lotes a nombre de sus empresas y sin espuela.

#### Los lotes y sus empresas

Ya urbanizado, el polo necesita empresas, y el Estado las atrae: en la pestaña *Lotes y empresas*
el jugador **promueve** cada lote para uno de los ocho sectores que la declaratoria le da al polo
como vocaciones productivas. Solo llegan empresas a un lote promovido.

- **Cuándo llegan.** Como antes: con el polo operando, con tren (la espuela) y con electricidad
  en la región, el interés de las empresas crece en tres años. Ese interés, en hectáreas, se
  reparte entre los lotes promovidos **en el orden en que se promovieron**; el último en llenarse
  va a medias mientras su empresa se instala. Un lote sin promover se queda vacío, y el interés
  que no encuentra lote espera: si el jugador promueve tarde, las empresas llegan de golpe.
- **La energía del polo es un tope.** La ficha de Economía le da al polo 8 MVA. **Cada empleo
  pide 1.6 kW** al promedio de la manufactura (los 8 MW de Huamantla entre sus 5 mil empleos),
  por cuánto gasta su sector en electricidad contra ese promedio. Así un trabajador pide lo mismo
  en cualquier polo.
  - **Comprobación:** con el gasto del censo (24,753 pesos por trabajador en 2018), 1.6 kW todo
    el año es un kWh de unos 1.77 pesos, un precio industrial razonable.
  - **Un lote cuya empresa no cabe en lo que queda se queda sin ella:** una metalúrgica en el lote
    de 20 ha pediría 15 MW.
  - Los lotes se acomodan en el orden en que se promovieron, y uno que no cabe no aparta nada.
- **Cada empresa da empleo**: los del polo lleno, repartidos por la superficie de los lotes (en
  Huamantla, sus 5 mil empleos entre sus 44.9 ha de lotes: un lote de 20 ha, 2,227 empleos). Los
  mismos para todos los sectores: el censo no dice cuántos trabajadores caben por hectárea en
  cada uno.
- **Y manda carga por tren**: sus trabajadores por las toneladas que el tren movió de los
  productos de su sector por trabajador en 2018. La parte de exportación espera en la estación
  del polo a un tren que la lleve a una salida del país; la nacional, a uno que la deje en su
  siguiente parada. Esperan hasta un mes; los trenes la cargan antes que la del resto del
  estado.
- **El agua** se muestra para comparar, sin tope: la declaratoria dice que hay y la ficha de
  Economía, que su disponibilidad está confirmada, sin cifra.

Lo que pide cada sector (`domain/sectores.ts`, datos en `src/lib/domain/datos/sectores.json`,
que arma `scripts/polos/gen-sectores.mjs`). Luz y agua: gasto por trabajador contra el promedio
de la manufactura (INEGI, Censos Económicos 2019, con datos de 2018). Toneladas: lo que movió el
tren de sus productos en 2018 entre su personal ocupado, y qué parte salió del país (ARTF,
anuario 2018, tablas 6-1, 6-2 y 10). Las dos últimas columnas son una empresa en el lote de
20 ha:

| Sector | SCIAN | Personal ocupado (2018) | Luz | Agua | t por trabajador al año | Exporta | MW | t al año por tren |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Industria textil | 313, 314 | 215,967 | 0.87× | 0.24× | 1.49* | 30 % | 3.1 MW | 3,318 t |
| Industrias metálicas básicas | 331 | 137,249 | 4.32× | 1.78× | 67.83 | 16 % | 15.4 MW | 151,069 t |
| Fabricación de productos metálicos | 332 | 454,118 | 0.65× | 0.26× | 1.49* | 30 % | 2.3 MW | 3,318 t |
| Maquinaria y equipo | 333 | 192,577 | 1.17× | 0.52× | 1.49* | 30 % | 4.2 MW | 3,318 t |
| Equipo de computación y electrónico | 334 | 377,625 | 0.73× | 0.79× | 1.49* | 30 % | 2.6 MW | 3,318 t |
| Aparatos eléctricos | 335 | 241,221 | 0.99× | 0.53× | 1.91** | 45 % | 3.5 MW | 4,254 t |
| Equipo de transporte | 336 | 1,292,372 | 1.22× | 1.50× | 5.03 | 83 % | 4.3 MW | 11,203 t |
| Bebidas y tabaco | 312 | 188,656 | 0.92× | 2.77× | 18.94 | 98 % | 3.3 MW | 42,183 t |

- **Productos de cada sector en el anuario**: equipo de transporte, los vehículos armados (5.43
  millones de toneladas), el material de ensamble, los vehículos desarmados y las ruedas;
  bebidas, la cerveza (3.53) y los vinos y licores; metálicas básicas, las láminas y planchas de
  acero (6.47), el fierro para construcción (2.65), el aluminio, el zinc y el plomo; aparatos
  eléctricos, los aparatos para uso doméstico (0.10).
- \* **Sin productos propios en el anuario**, un sector manda su carga en contenedores: le tocan
  las toneladas de contenedores (9.68 millones en 2018) por trabajador de toda la manufactura, y
  la parte de ellas que salió del país (2.9 millones). Es **estimación del juego**. \*\* Aparatos
  eléctricos suma sus aparatos domésticos y los contenedores.
- Los empleos del polo son «directos e indirectos» en Huamantla (Presidencia) y en la cifra de
  conjunto. El juego los toma como personal ocupado del censo, así que la carga y la
  electricidad pueden quedar algo altas.

#### La subestación del polo

Lo que el polo da a sus empresas es su cifra oficial de electricidad (o la mediana de las siete
oficiales, 8 MW): su subestación en la primera fase. Cuando no alcanza, **la CFE la amplía**. En
la pestaña *Obra* está el frente *Subestación*, que se abre cuando el frente de energía está
terminado.

- **Cada ampliación es un banco de 30 MVA**, un tamaño común en las subestaciones de distribución
  de la CFE (estimación del juego). Suma 30 MVA a lo que el polo da a sus empresas; el juego toma un
  MVA por MW. Se pueden pedir los bancos que se quiera, uno tras otro.
- **La paga la CFE, de su caja**, como sus centrales; la caja del Estado no se toca.
- **Lleva cuadrillas propias**, de 1 a 4, aparte de las 4 del polo.
- **Cuesta 1.64 millones de pesos por MVA:** unos 49 millones el banco con 4 cuadrillas. Es la
  mediana de nueve proyectos de subestaciones de distribución terminados de la cartera de
  inversión de la CFE de 2024, los que tienen pocas líneas (menos de 0.2 km-c por MVA). Van de 0.54
  a 5.4 millones por MVA, en pesos del año de cada proyecto, sin actualizar.
- **Tarda 16 meses con 4 cuadrillas:** lo que tardaron Kantenah y Leona Vicario, las dos
  subestaciones nuevas de la Riviera Maya en la misma cartera (de abril y mayo de 2024 a agosto de
  2025). Con menos cuadrillas, como cualquier obra del Estado:

| Cuadrillas | Costo del banco | Meses | Al mes |
| ---: | ---: | ---: | ---: |
| 1 | 33.9 millones | 45.2 | 0.75 millones |
| 2 | 39.0 millones | 26.9 | 1.45 millones |
| 3 | 44.1 millones | 19.8 | 2.22 millones |
| 4 | 49.2 millones | 16.0 | 3.07 millones |

Un banco basta para una petroquímica de 25 ha en Coatzacoalcos I (13.5 MW). En el mapa, cada banco
terminado es un cuadrito amarillo junto a la subestación. En Realidad no se ha reportado ninguna
ampliación.

En el mapa, cada lote promovido toma el color de su sector y se llena conforme llega su empresa;
uno que no cabe se marca en rojo. Un clic en un lote lo abre en el panel. En Realidad los lotes
llevan el nombre de su empresa: su giro no se publica.

Los datos del interior los arma `scripts/polos/gen-interior.mjs`: el contorno de cada polo en
`static/data/polos/<polo>.json` (lo baja la vista al entrar) y los frentes y sus fuentes en
`src/lib/domain/datos/interiores.json`. Lo de OpenStreetMap sale del extracto de México de
Geofabrik, leído en dos pasadas (`scripts/polos/osm-local.py`), o, si no está bajado, de
Overpass en partes chicas (la consulta completa da error 502); se guarda en `.cache/osm/`.

### Coatzacoalcos I por dentro

El segundo polo con vista por dentro (`/mexico/polo/coatzacoalcos-i`), del Corredor
Interoceánico: 257.71 ha al sureste de Coatzacoalcos, entre la carretera MEX-180 y el complejo
petroquímico de Braskem-Idesa. Funciona igual que Huamantla; lo que cambia son sus datos.

**El terreno**, de su declaratoria (DOF, 12 de mayo de 2023): un cuadro de construcción en UTM
zona 15 que da, además de cada vértice, el rumbo y la distancia de cada lado. Con ellos se
corrigieron dos erratas (ver la [bitácora](#12-bitácora-de-correcciones-a-los-datos)); así el
área da 257.62 ha contra las 257.71 declaradas, y el centro cae a 123 m del marcador que el
juego ya tenía.

**Lo que dice la declaratoria**:
- **Tren:** está «a 3.1 km de la vía férrea, línea Z, en su tramo Medias Aguas–Coatzacoalcos».
- **Carretera, puerto y aeropuerto:** tiene frente sobre la MEX-180, y está a 9 km del puerto y a
  41.5 km del aeropuerto de Minatitlán.
- **Uso de suelo:** el 76.46 % del terreno es industrial, unas 197 ha.
- **Propietario:** es del Corredor Interoceánico.
- **Vocaciones:** son once, con fuerte peso de la petroquímica, que ya domina la zona.

**Lo que es del juego**:
- **Los lotes:** no hay lotes ni empresas publicados. El juego parte las 197 ha industriales en
  12 lotes de 8 a 30 ha. A los servicios les da 3 ha a la entrada, sobre la MEX-180. Lo demás,
  38 ha, es área común y reserva.
- **La espuela** va a la vía principal más cercana según OpenStreetMap. Es la **Línea FA de
  Ferroistmo**, a 2.14 km en línea recta, más cerca que la Línea Z que mide el DOF.
- **Los frentes** son los mismos que en Huamantla, con las mismas partes del costo. La
  declaratoria no dice qué obras necesita el polo.
- **La energía:** no hay cifra oficial. Le toca la de un polo sin cifra, la mediana de los siete
  que la tienen: **8 MW**, lo que da su subestación en su primera fase.
  - Sus empresas piden lo mismo por empleo que en Huamantla, 1.6 kW al promedio. Lleno de
    industria promedio (sus 15,763 empleos, 61.2 por hectárea), el polo pediría **25 MW**.
  - Con 8 MW caben unos tres lotes de 20 ha de industria promedio. Una petroquímica o una
    metalúrgica de ese tamaño (11 MW) no caben.
  - Es lo que dicen las cifras oficiales: los polos arrancan con 4 a 20 MW, y uno grande necesita
    que la CFE amplíe su subestación para llenarse (ver
    [La subestación del polo](#la-subestación-del-polo)): con cuatro bancos, 128 MVA.

Lo que pide cada uno de sus sectores en un lote de 20 ha (1,600 empleos: los 15,763 del polo
repartidos en sus 197 ha de lotes):

| Sector | SCIAN | Personal ocupado (2018) | Luz | Agua | t por trabajador al año | Exporta | MW | t al año por tren |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Equipo de computación y electrónico | 334 | 377,625 | 0.73× | 0.79× | 1.49* | 30 % | 1.9 MW | 2,357 t |
| Semiconductores (componentes electrónicos) | 3344 | 196,205 | 0.67× | 0.96× | 1.49* | 30 % | 1.7 MW | 2,357 t |
| Equipo de transporte | 336 | 1,292,372 | 1.22× | 1.50× | 5.03 | 83 % | 3.1 MW | 7,956 t |
| Dispositivos médicos | 3391 | 172,298 | 0.46× | 0.37× | 1.49* | 30 % | 1.2 MW | 2,357 t |
| Farmacéutica | 3254 | 88,699 | 0.84× | 0.89× | 1.49* | 30 % | 2.1 MW | 2,357 t |
| Agroindustria (industria alimentaria) | 311 | 1,092,943 | 0.66× | 0.57× | 2.70 | 3 % | 1.7 MW | 4,271 t |
| Equipo de generación y distribución de electricidad | 3353 | 74,641 | 0.87× | 0.35× | 1.49* | 30 % | 2.2 MW | 2,357 t |
| Maquinaria y equipo | 333 | 192,577 | 1.17× | 0.52× | 1.49* | 30 % | 3.0 MW | 2,357 t |
| Industrias metálicas básicas | 331 | 137,249 | 4.32× | 1.78× | 67.83 | 16 % | 11.1 MW | 107,288 t |
| Petroquímica (química básica y resinas) | 3251, 3252 | 56,630 | 4.28× | 2.92× | 150.31 | 11 % | 11.0 MW | 237,749 t |

- **Agroindustria** es la industria alimentaria (SCIAN 311). En el anuario ferroviario de 2018
  sus productos son el jarabe de maíz (1.29 millones de toneladas), los aceites y grasas
  vegetales, las harinas, el azúcar, los lácteos y otros. Solo el azúcar sale del país.
- **Petroquímica** es la química básica y las resinas (3251 y 3252). Por tren mueve:
  - polietileno, 2.33 millones de toneladas;
  - productos químicos industriales, 1.42;
  - carbonato de sodio, 1.32;
  - polipropileno, 0.88;
  - ácido sulfúrico, 0.70;
  - y otros ácidos, cloro, cloruro de vinilo, sosa cáustica y resinas.

  Por trabajador es lo más pesado del juego: 150 toneladas al año. Un lote de 25 ha de
  petroquímica manda unas 297 mil toneladas al año, unos 120 trenes.
- **Farmacéutica** (3254), **dispositivos médicos** (3391), **semiconductores** (3344) y **equipo
  eléctrico** (3353) no tienen productos propios en el anuario: van en contenedores.
- **Tecnologías de la información** no es manufactura, así que el juego no la ofrece para un lote.
- \* En contenedores (estimación del juego, como en Huamantla).

**En la realidad**, la Presidenta dijo el 19 de febrero de 2025 que Coatzacoalcos I, Coatzacoalcos
II y Salina Cruz ya estaban licitados y concesionados a Desarrolladora Multimodal del Istmo, para
distribuir vehículos y autopartes, con 90 % de avance en sus estudios (versión estenográfica de
Presidencia). En 2026 el Corredor reporta solo cinco polos del Istmo concesionados, sin decir
cuáles. No se ha reportado obra: en Realidad sus lotes dicen «Sin empresa reportada».

### Un polo en varias piezas

Huamantla y Coatzacoalcos I son un solo polígono. Otros polos no:
- **Texistepec:** el DOF le quita a un polígono general los derechos de vía de una autopista y de
  una vía que lo cruzan, y quedan tres predios separados.
- **Altamira:** son tres polígonos a varios kilómetros uno de otro.
- **Nezahualcóyotl:** son cuatro lotes catastrales del estado, separados por calles y por una vía.
- **Parque Industrial Bajío:** son tres polígonos a los dos lados de una autopista, más el camino
  de acceso que los une, que también es del polo.
- **Hermosillo:** son tres secciones; una de ellas, el PIAT, llena una muesca de otra.
- **Topolobampo:** son dos polígonos; un tercero, una donación, salió del polo cuando se modificó
  su declaratoria.
- **Puerta Logística del Bajío:** son tres polígonos separados por una calle curva; el más chico
  (0.29 ha) queda de reserva, sin lotes.
- **Durango:** son un polígono y cuatro «reservas» al norte, que el juego deja sin lotes.
- **Tapachula I:** como en Texistepec, el DOF le quita a una poligonal general los derechos de vía
  del ramal KA y de una línea eléctrica de la CFE, que la cruzan de lado a lado: quedan tres
  predios.
- **Asunción Ixtaltepec:** son cuatro polígonos (A, B, C y uno adyacente al B); el derecho de vía
  de Pemex cruza el B y le deja una esquina de 2.18 ha, que el juego deja sin lotes.
- **Economía Circular Puebla:** son tres polígonos separados.
- **Economía Circular Tlaxcala:** son dos polígonos de 10 ha, uno junto al otro.
- **Capital de la Tecnología:** son cinco polígonos en dos grupos a 5 km uno de otro.

El juego arma cada pieza como un polo chico:
- **Calle y lotes:** cada pieza lleva su calle a lo largo, desde el extremo más cercano a la
  carretera, con sus lotes a los dos lados.
- **Servicios:** la pieza que los tiene (la subestación, el tanque de agua y el centro de
  servicios) va primero.
- **Obra:** los frentes de vialidades, agua y energía avanzan por las calles una tras otra, en ese
  orden; las cuadrillas trabajan donde va cada frente.
- **Franjas:** se dibujan los derechos de vía excluidos. Si una franja cruza una pieza (el
  gasoducto de Altamira, el camino de Bajío), ningún lote se pone encima: el lote que no cabe
  antes de ella va después. Un camino que la declaratoria da por su eje se dibuja con su ancho, y
  cuenta en la superficie si es parte del polo.
- **Comprobación:** el generador compara cada tabla con su área declarada (el polígono general,
  cada franja y la suma de las piezas).

### Texistepec por dentro

El tercer polo con vista por dentro (`/mexico/polo/texistepec`), del Corredor Interoceánico:
462.39 ha entre Texistepec y Jáltipan, Veracruz, donde la autopista La Tinaja–Cosoleacaque
(MEX-145D) cruza la línea Z del Ferrocarril del Istmo.

**El terreno**, de su declaratoria (DOF, 12 de mayo de 2023): cuatro cuadros de construcción en
UTM zona 15, con el rumbo y la distancia de cada lado y el centro y el radio de cada curva.
- **El polígono general:** 484.99 ha calculadas, contra 484.94 declaradas.
- **Las franjas que se le quitan:** el derecho de vía de la autopista 145D (8.54 ha) y el de la
  línea Z (14.05 ha calculadas, contra 14.00 declaradas).
- **Las tres piezas que quedan:**

  | Predio | Superficie |
  | --- | ---: |
  | Al sur de la autopista | 192.77 ha |
  | Al norte de la autopista | 167.58 ha |
  | Al oeste de la vía | 102.04 ha |

- **Resultado:** las tres suman 462.3944 ha contra las 462.3909 declaradas.
- **Correcciones:** se corrigió una errata del vértice 10A y se usó el radio que dan los vértices
  y el centro de la curva grande de la vía (ver la
  [bitácora](#12-bitácora-de-correcciones-a-los-datos)).
- **La vía Z:** cruza el polo con una curva de 88° y 330 a 400 m de radio.
- **El marcador:** el que el juego ya tenía cae dentro del terreno.

**Lo que dice la declaratoria**:
- **Tren y carretera:** es «aledaño a la línea Z, en su tramo Medias Aguas–Coatzacoalcos» y tiene
  frente sobre la MEX-145D.
- **Puerto y aeropuerto:** está a 37 km del puerto de Coatzacoalcos y a 39.6 km del aeropuerto de
  Minatitlán.
- **Uso de suelo:** es reserva territorial industrial.
- **Propietario:** el Corredor Interoceánico, que lo compró en diciembre de 2020.
- **Vocaciones:** las mismas once que Coatzacoalcos I.

**Lo que es del juego**:
- **Los lotes:** no hay lotes ni empresas publicados. El juego les da la parte del terreno que
  Coatzacoalcos I tiene de uso industrial (76.46 %): **353 ha en 18 lotes de 8 a 30 ha**.
  - Por predio: 8 lotes al sur de la autopista, 6 al norte y 4 al oeste de la vía.
  - Los servicios tienen 4 ha a la entrada del predio sur, junto a la autopista.
  - Lo demás, 72 ha, es área común y reserva.
- **Las calles:** tres, una por predio, de 3.2, 2.3 y 1.6 km.
- **La espuela:** como la línea Z pasa entre sus predios, son **0.03 km**: el tramo de la vía al
  predio más cercano, con su cambio de vía.
  - Al precio por km del ramal a Dos Bocas cuesta 2 millones con 4 cuadrillas y tarda el
    mínimo, 2 meses.
  - Es el polo más barato de conectar al tren.
- **La energía:** no hay cifra oficial; le tocan los **8 MW** de un polo sin cifra.
  - La línea de 115 kV más cercana pasa al norte, a 3.86 km de su subestación (OpenStreetMap).
  - Lleno de industria promedio (28,282 empleos, 61.2 por hectárea) pediría 45.3 MW.
  - Un lote de 20 ha da 1,602 empleos y pide lo mismo que en Coatzacoalcos I (ver la tabla de
    arriba): de 1.2 MW si es de dispositivos médicos a 11.1 MW si es una metalúrgica.
- **Los frentes y su costo:** son los de Huamantla.
  - Su obra completa cuesta 2,539 millones con una cuadrilla.
  - Las vialidades solas: 1,015 millones en 18.4 meses con una cuadrilla, o 1,472 millones en
    6.5 con cuatro.

**En la realidad**:
- **Licitación:** la ganó el consorcio de Profharmax y Transportadora Comexsa (fallo del 17 de
  noviembre de 2023, DOF).
- **Concesión:** la Presidenta lo dio por concesionado el 19 de febrero de 2025.
- **2026:** el Corredor reporta solo cinco polos del Istmo concesionados, sin decir cuáles.
- **Obra:** no se ha reportado obra ni empresas.

### Altamira por dentro

El cuarto polo con vista por dentro (`/mexico/polo/altamira`), del Plan México y el más grande:
1,637.78 ha junto al puerto industrial de Altamira, Tamaulipas.

**El terreno**, de su declaratoria (DOF, 21 de octubre de 2025): tres polígonos en UTM zona 14,
cuyas áreas calculadas dan las declaradas.

| Polígono | Superficie |
| --- | ---: |
| GOB 3, al norte | 955.16 ha |
| PRODET | 37.74 ha |
| GOB 2, al sur | 644.88 ha |

- **Su tamaño:** de punta a punta mide **18 km de norte a sur**, y GOB 3 y GOB 2 tienen de 0.7 a
  1.7 km de ancho.
- **El gasoducto:** la declaratoria trae además la servidumbre de paso de la interconexión al
  gasoducto Texas–Tuxpan (2.34 ha), que cruza GOB 3 de lado a lado. El texto dice que se resta,
  pero su resumen no la resta (ver la [bitácora](#12-bitácora-de-correcciones-a-los-datos)). El
  juego la dibuja y no pone lotes en ella.
- **El marcador:** el que el juego ya tenía cae dentro de GOB 3.

**Lo que dice la declaratoria**:
- **Carretera y aeropuerto:** está a 7 km de la carretera federal 80 y a 17 km del aeropuerto de
  Tampico.
- **Tren y puerto:** tiene el puerto de Altamira, de 13.5 m de calado, y dos ferrocarriles que lo
  sirven, Ferromex y CPKC.
- **Uso de suelo y servicios:** el uso de suelo es industrial y el polígono ya «dispone de
  vialidades, energía eléctrica, agua potable, drenaje y conectividad», con «opciones
  identificadas para ampliar la disponibilidad de energía en el mediano plazo».
- **Propietario:** el Gobierno de Tamaulipas.
- **Vocaciones:** automotriz, química, farmacéutica, petroquímica, eléctrica-electrónica,
  metalmecánica, manufactura avanzada y logística.

**Lo que es del juego**:
- **Las entradas:** en OpenStreetMap no hay carretera federal junto al polo. Cada polígono se
  abre hacia las troncales del puerto: el Boulevard de los Ríos (TAM 113) y el Libramiento Luis
  Donaldo Colosio (TAM 143), al sur.
- **Los lotes:** el juego les da la misma parte que Coatzacoalcos I (76.46 %): **1,218 ha en 28
  lotes de 14 a 80 ha**, del tamaño de las plantas químicas del puerto.
  - Por polígono: 14 lotes en GOB 3, 2 en PRODET y 12 en GOB 2.
  - Los servicios tienen 6 ha a la entrada de GOB 3.
  - Lo demás, 337 ha, es área común y reserva.
- **Las calles:** tres, de 6.8, 0.9 y 8.5 km.
- **La espuela:** va de la **Línea MB de Ferromex**, la vía principal más cercana, a GOB 2:
  **0.32 km**. Cuesta 21 millones con 4 cuadrillas y tarda el mínimo, 2 meses.
- **La energía:** no hay cifra oficial; le tocan los **8 MW** de un polo sin cifra.
  - Su subestación queda a 1.43 km de la línea de 115 kV de las subestaciones del puerto (Puerto
    5 Norte, la más cercana).
  - Lleno de industria promedio (100,174 empleos) pediría 160 MW: necesitará muchos bancos de
    la CFE.
- **Los frentes y su costo:** son los de Huamantla. Su obra completa cuesta 8,991 millones con
  una cuadrilla; las vialidades solas tardan 26.9 meses con una cuadrilla y 9.5 con cuatro.

Lo que pide cada uno de sus sectores en un lote de 40 ha (3,290 empleos: los 100,174 del polo
repartidos en sus 1,218 ha de lotes):

| Sector | SCIAN | Personal ocupado (2018) | Luz | Agua | t por trabajador al año | Exporta | MW | t al año por tren |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Equipo de transporte | 336 | 1,292,372 | 1.22× | 1.50× | 5.03 | 83 % | 6.4 MW | 16,356 t |
| Química (fertilizantes, pinturas, jabones y otros) | 3253, 3255, 3256, 3259 | 122,757 | 1.21× | 1.72× | 4.73 | 0 % | 6.4 MW | 15,380 t |
| Farmacéutica | 3254 | 88,699 | 0.84× | 0.89× | 1.49* | 30 % | 4.4 MW | 4,845 t |
| Petroquímica (química básica y resinas) | 3251, 3252 | 56,630 | 4.28× | 2.92× | 150.31 | 11 % | 22.5 MW | 488,757 t |
| Equipo de computación y electrónico | 334 | 377,625 | 0.73× | 0.79× | 1.49* | 30 % | 3.8 MW | 4,845 t |
| Aparatos eléctricos | 335 | 241,221 | 0.99× | 0.53× | 1.91* | 45 % | 5.2 MW | 6,211 t |
| Fabricación de productos metálicos | 332 | 454,118 | 0.65× | 0.26× | 1.49* | 30 % | 3.4 MW | 4,845 t |
| Maquinaria y equipo | 333 | 192,577 | 1.17× | 0.52× | 1.49* | 30 % | 6.2 MW | 4,845 t |

- **Química** es un sector nuevo, con el resto de la industria química del censo: fertilizantes
  (3253), pinturas y adhesivos (3255), jabones y cosméticos (3256) y otros productos químicos
  (3259).
  - **Lo que gasta:** 1.21 veces la luz y 1.72 veces el agua del promedio de la manufactura.
  - **Por tren** (ARTF, 2018) mueve sus fertilizantes (552 mil toneladas), el amoniaco
    fertilizante (23 mil) y el jabón en polvo (5 mil).
  - **Exporta:** ninguno de los tres está entre los 20 productos que más se exportan por tren.
- **Las vocaciones del DOF en sectores:** la petroquímica sigue siendo la química básica y las
  resinas; metalmecánica son los productos metálicos y la maquinaria, y la eléctrica-electrónica,
  el equipo electrónico y los aparatos eléctricos.
- **Lo que el juego no ofrece:** manufactura avanzada no es un sector del censo y logística no
  es manufactura, así que no se ofrecen para un lote.
- **La petroquímica:** un lote de 40 ha manda casi medio millón de toneladas al año, unos 200
  trenes, y pide 22 MW, casi tres veces lo que el polo da al arrancar.
- \* En contenedores (estimación del juego, como en Huamantla).

**En la realidad**, el 18 de febrero de 2026 Tamaulipas y la federación firmaron el convenio del
polo. En marzo seguía en su fase de formalización, la primera de tres (formalización,
desarrollo, inversión productiva), rumbo a su fideicomiso (Gobierno municipal de Altamira). No
se ha reportado obra ni empresas.

### Nezahualcóyotl por dentro

El quinto polo con vista por dentro (`/mexico/polo/nezahualcoyotl`), del Plan México y el único
dentro de una ciudad: 68.37 ha junto al Bordo de Xochiaca, al lado de la Ciudad de México y del
aeropuerto.

**El terreno**, de su declaratoria (DOF, 7 de agosto de 2025): cuatro lotes catastrales del
Gobierno del Estado de México, en UTM zona 14 (el DOF no dice la zona; el estado está en ella).

| Lote | Superficie |
| --- | ---: |
| 3-C | 29.21 ha |
| 3-B | 21.05 ha |
| 7-D | 15.55 ha |
| 7-E | 2.56 ha |

- **Resultado:** suman 683,749 m² calculados contra los 683,683.11 declarados.
- **Una errata:** la tabla del 3-B cierra con un renglón que se deja fuera (ver la
  [bitácora](#12-bitácora-de-correcciones-a-los-datos)).
- **El marcador:** el que el juego ya tenía cae dentro del terreno.

**Lo que dice la declaratoria**:
- **Servicios:** adentro del predio ya hay gas, electricidad y red férrea, e «infraestructura
  urbana básica».
- **Vialidades:** tiene acceso a vialidades primarias.
- **Energía:** la Secretaría de Energía calcula que su demanda crecerá de 5 a 7.7 MW de 2027 a
  2030. La subestación de distribución más cercana está a 1.8 km; en alta tensión se conectaría a
  la subestación Nezahualcóyotl (85 kV) con una línea de unos 0.2 km.
- **Vocaciones:** logística, economía digital, servicios tecnológicos, electrónica, industria
  ligera, y farmacéutico y dispositivos médicos.

**Lo que es del juego**:
- **Los lotes:** la parte de uso industrial de Coatzacoalcos I (76.46 %): **52 ha en 14 lotes de
  1.5 a 6 ha**, chicos como los de una ciudad.
  - Los servicios tienen 1.5 ha a la entrada del lote 3-C.
  - Lo demás, 6.7 ha, es área común y reserva.
  - Sus calles son más angostas que las de un polo en el campo (22 m) y son cuatro, una por lote
    catastral.
- **Los empleos:** los que anunció el municipio para su primera etapa, 4,500 (ver
  [Cuántos empleos da un polo](#cuántos-empleos-da-un-polo)). Un lote de 5 ha da 433, y pide de
  0.3 MW (dispositivos médicos) a 0.6 MW (textil o farmacéutica).
- **La espuela:** la **Línea VK de Ferrovalle** pasa entre sus lotes, así que son **0.01 km**: 1
  millón con 4 cuadrillas y el mínimo de 2 meses.
- **La energía:** los **7.7 MW** de la Secretaría de Energía. Lleno, a 1.6 kW por empleo, pide
  7.2 MW: cabe entero en su energía de arranque, sin bancos de la CFE. La línea de 85 kV más
  cercana a su subestación queda a 1.27 km (OpenStreetMap).
- **Los frentes:** son los de Huamantla. Su obra completa cuesta 375 millones con una cuadrilla;
  las vialidades, 150 millones en 10.4 meses.
- **Las vocaciones en sectores:**
  - Electrónica es el equipo de computación y electrónico.
  - Industria ligera es la textil y la alimentaria (estimación del juego).
  - Farmacéutico y dispositivos médicos son sus dos sectores.
  - Logística, economía digital y servicios tecnológicos no son manufactura: no se ofrecen para un
    lote.

**En la realidad** no se ha reportado obra ni empresas. El municipio anunció, para su primera
etapa, unos 800 millones de pesos de inversión y 4,500 empleos directos.

### Reserva Zapotlán por dentro

El sexto polo con vista por dentro (`/mexico/polo/reserva-zapotlan`), del Plan México: 910.82 ha
en Zapotlán de Juárez, Hidalgo, al sur de Pachuca y junto al parque industrial QUMA.

**El terreno**, de su declaratoria (DOF, 30 de junio de 2025): un polígono de 40 vértices en UTM
zona 14.
- **Resultado:** el área calculada da los 9,108,169.94 m² de su tabla.
- **Una errata:** el artículo que lo declara dice otra superficie, 9,222,019.79 m² (ver la
  [bitácora](#12-bitácora-de-correcciones-a-los-datos)).
- **El marcador:** el que el juego ya tenía cae dentro del terreno.

**Lo que dice la declaratoria**:
- **Carreteras y aeropuertos:** tiene acceso a las autopistas 85D y 40 (el Arco Norte) y está a
  27 km del AIFA.
- **Ductos:** tiene ductos de Pemex a 150 m y un gasoducto del CENAGAS a 4 km.
- **La obra que necesita:** «requiere obras de infraestructura, previamente identificadas por el
  estado de Hidalgo, de alrededor de 5 mil millones de pesos». De ahí sale el costo por hectárea
  de todos los polos del juego.
- **Energía:** en su etapa madura pedirá 20 MW (de 8 a 12 MW entre 2028 y 2030).
  - La subestación de distribución más cercana está a 20 km.
  - En alta tensión se conectaría a la de Tizayuca, a unos 24 km.
- **Vocaciones:** logística, manufactura, farmacéutico y dispositivos médicos, automotriz y
  aeroespacial.

**Lo que es del juego**:
- **Los lotes:** la parte de uso industrial de Coatzacoalcos I (76.46 %): **680 ha en 20 lotes de
  15 a 60 ha**.
  - Los servicios tienen 6 ha a la entrada, del lado de la carretera México–Pachuca.
  - Lo demás, 182 ha, es área común y reserva, sobre todo el extremo suroeste, el más ancho.
  - Su calle mide 6.5 km.
- **La espuela:** en OpenStreetMap no hay vía en servicio cerca, solo líneas abandonadas y el
  ferrocarril México–Pachuca, que pasa junto al polo y se rehace para el tren de pasajeros.
  - En la red del juego de 2018 esa vía es de Ferrosur y está en servicio.
  - La espuela va a ella: **0.01 km**, 1 millón con 4 cuadrillas y el mínimo de 2 meses.
- **La energía:** los **20 MW** de la declaratoria, la cifra oficial más alta junto con San
  Jerónimo.
  - En OpenStreetMap no hay ninguna línea ni subestación a menos de 4.5 km. La conexión va a la
    subestación que nombra la declaratoria, **Tizayuca** (230 kV, 180 MVA en OpenStreetMap), a
    **24.45 km** de la subestación del juego, casi los 24 del DOF.
  - Lleno de industria promedio (55,710 empleos) pediría 89 MW. Un lote de 20 ha da 1,639 empleos
    y pide de 1.2 MW (dispositivos médicos) a 3.2 MW (equipo de transporte).
- **Los frentes:** son los de Huamantla. Su obra completa cuesta **5,000 millones** con una
  cuadrilla, la cifra de su propia declaratoria. Las vialidades solas: 2,000 millones en 22.5
  meses, o 2,900 en 8 con cuatro cuadrillas.
- **Las vocaciones en sectores:**
  - Automotriz y aeroespacial son el equipo de transporte.
  - Manufactura, a secas, son los productos metálicos, la maquinaria, los aparatos eléctricos y
    la electrónica (estimación del juego).
  - Farmacéutico y dispositivos médicos son sus dos sectores.
  - Logístico no es manufactura: no se ofrece para un lote.

**En la realidad**, el 19 de agosto de 2026 la Presidencia anunció que la desarrolladora DEWA
invertirá **10,106 millones** para urbanizarlo en cinco fases. La primera:
- **Urbanización:** 1,277 millones.
- **Naves:** 2,000 millones para sus dos primeras naves.
- **Arranque y empleos:** obra desde septiembre y 5,100 empleos directos e indirectos.

No se ha reportado que la obra empezara. El juego no usa esos 5,100 como sus empleos: son los de
una fase de cinco (ver [Cuántos empleos da un polo](#cuántos-empleos-da-un-polo)).


### San Jerónimo por dentro

El séptimo polo con vista por dentro (`/mexico/polo/san-jeronimo`), del Plan México y el único en
la frontera norte: junto al cruce San Jerónimo–Santa Teresa, en Juárez, Chihuahua, frente a
Nuevo México.

**El terreno**, de su declaratoria (DOF, 30 de junio de 2025): la fracción B-3B, un cuadro de
ocho vértices y dos curvas en UTM zona 13 (el DOF no dice la zona; Juárez está en ella).
- **Resultado:** cada lado cuadra con su rumbo y su distancia, y cada curva con su delta, su
  longitud y su subtangente. El polígono encierra **56.46 ha**.
- **Una errata:** su cuadro y el artículo declaran 60.32 ha, 6.4 % más de lo que dan sus
  vértices (ver la [bitácora](#12-bitácora-de-correcciones-a-los-datos)). El juego dibuja el
  cuadro y usa las 60.32 ha para el costo y los empleos.
- **Sus orillas:** el lado norte sigue la carretera estatal CHIH 174, San Jerónimo–Anapra, y la
  frontera corre a unos metros (OpenStreetMap). La vista dibuja la frontera, con Estados Unidos
  del otro lado.
- **El marcador:** el del tablero está 750 m al sur del terreno, para quedar del lado mexicano
  de la frontera dibujada (ver la nota ³ de [Cómo se ubicaron](#cómo-se-ubicaron)).

**Lo que dice la declaratoria**:
- **Ubicación:** al pie de la frontera, junto al cruce internacional Santa Teresa–San Jerónimo,
  «a 15 km de la red férrea y a 800 m de la zona urbana de Ciudad Juárez»; el aeropuerto queda a
  25.3 km.
- **Servicios:** uso de suelo industrial, «infraestructura urbana básica», y gas y electricidad
  dentro del predio.
- **Vocaciones:** logística, centro de innovación industrial, automotriz, electromovilidad,
  dispositivos médicos y servicios tecnológicos.
- **Propiedad:** el Gobierno de Chihuahua.

**Lo que es del juego**:
- **Los lotes:** la parte de uso industrial de Coatzacoalcos I (76.46 % de las 60.32 ha): **46 ha
  en 8 lotes de 2 a 10 ha**.
  - Los servicios tienen 1.5 ha a la entrada.
  - Como el cuadro tiene menos terreno del que declara, la reserva es chica: 2.7 ha.
- **Los empleos:** 61.2 por hectárea, 3,689. Un lote de 10 ha da 802 y pide de 0.6 MW
  (dispositivos médicos) a 1.6 MW (equipo de transporte).
- **La espuela**, la más larga de los polos con vista:
  - La vía más cercana es la UP Lordsburg Subdivision de Union Pacific, a 4.24 km, del otro lado
    de la frontera (OpenStreetMap). Las terminales de Union Pacific y BNSF que el gobierno de
    Chihuahua cuenta entre sus ventajas están en Estados Unidos.
  - La del juego va a la más cercana de México, la **Línea A de Ferromex** en Ciudad Juárez:
    **15.33 km**, casi los 15 de la declaratoria.
  - Cuesta 696 millones con una cuadrilla (7.7 meses) o 1,009 con cuatro (2.7 meses): dos o tres
    veces el polo entero. Alejando la vista se ve llegar a Juárez.
- **La energía:** los **20 MW** de Economía. Lleno pide 5.9 MW: le sobra. La línea de 115 kV más
  cercana queda a 0.35 km de su subestación (OpenStreetMap).
- **Los frentes:** son los de Huamantla. Su obra completa cuesta 331 millones con una cuadrilla;
  las vialidades, 132 millones en 10 meses, o 192 en 3.5 con cuatro.
- **Las vocaciones en sectores:**
  - Automotriz es el equipo de transporte.
  - Electromovilidad es el equipo de transporte y los aparatos eléctricos, donde están las
    baterías (estimación del juego).
  - Dispositivos médicos es su sector.
  - Logística, centro de innovación industrial y servicios tecnológicos no son manufactura: no se
    ofrecen para un lote.

**En la realidad**, el Gobierno de Chihuahua lo propuso en un predio suyo:
- **22 de mayo de 2025:** Ciudad Juárez se incorpora al Plan México como polo.
- **26 de junio:** la gobernadora firma el acuerdo en Palacio Nacional y pide a la Presidenta
  apoyo para renovar el cruce San Jerónimo–Santa Teresa, asegurar la energía y «adaptar la
  infraestructura ferroviaria».
- **30 de junio:** sale la declaratoria (DOF).
- **1 de marzo de 2026:** en su 4.º Informe, la gobernadora anuncia 315 millones del estado para
  el polo.

No se ha reportado obra ni empresas.

### Parque Industrial Bajío por dentro

El octavo polo con vista por dentro (`/mexico/polo/parque-industrial-bajio`), del Plan México:
342.08 ha en Zinapécuaro, Michoacán, por Estación Queréndaro, a los dos lados de la autopista
México–Morelia (MEX 15D) y junto a la vía de CPKC.

**El terreno**, de su declaratoria (DOF, 7 de julio de 2025): cinco cuadros de construcción en
UTM zona 14 (el DOF no dice la zona; Michoacán está en ella), cada lado con su rumbo y su
distancia.

| Cuadro | Superficie | Dónde |
| --- | ---: | --- |
| Polígono 1 | 201.40 ha | Al norte de la autopista |
| Polígono 2 | 49.34 ha | Al sur de la autopista |
| Polígono 3 | 85.59 ha | Más al sur, pegado a la vía |
| Camino de acceso | 5.92 ha | Un eje de 1,988 m con dos curvas, de unos 30 m de ancho, que llega desde el sur |
| Parcela | 1.00 ha | Junto al polígono 3; la declaratoria no dice qué es |

- **Resultado:** los tres polígonos y el camino suman 342.25 ha contra las 342.08 declaradas. La
  parcela no entra en esa suma (con ella serían 343.25): el juego la dibuja y no la cuenta.
- **Dos erratas:** el vértice 328, con dos dígitos invertidos, y el 200, que abre y cierra su tabla
  con 20 cm de diferencia (ver la [bitácora](#12-bitácora-de-correcciones-a-los-datos)).
- **Se enciman:** el camino cruza el polígono 3, la punta del 2 y la parcela, y los cuadros no lo
  restan. El juego dibuja el camino con su ancho y no pone lotes sobre él.
- **El marcador:** el que el juego ya tenía cae dentro del polígono 1.

**Lo que dice la declaratoria**:
- **Conectividad:** la carretera federal 15 y la autopista México–Morelia–Guadalajara, el
  aeropuerto de Morelia a poco más de 7 km y «acceso directo a la red férrea a cargo de Kansas
  City Southern de México», hoy CPKC.
- **Servicios:** «dispone de vialidades, energía eléctrica, agua potable, drenaje y
  conectividad». El portal de Economía añade 12.9 MW de origen hidroeléctrico y geotérmico,
  1.15 millones de m³ de agua y gas natural a 19 km.
- **Vocaciones:** agroindustrial, automotriz y autopartes, electrodomésticos, logístico, y
  maquinaria y equipo.
- **Propiedad:** el Gobierno de Michoacán.

**Lo que es del juego**:
- **Los lotes:** la parte de uso industrial de Coatzacoalcos I (76.46 %): **257 ha en 20 lotes de
  5 a 30 ha**.
  - Por polígono: 10 lotes en el 1 (154 ha), 4 en el 2 (38 ha) y 6 en el 3 (65 ha).
  - Los servicios tienen 4 ha a la entrada del polígono 1, del lado de la autopista.
  - Lo demás es área común y reserva.
- **Los empleos:** los **27,000** que calcula la Sedeco de Michoacán dentro del parque para sus
  primeros 10 años: el tercer polo con cifra propia, después de Huamantla y Nezahualcóyotl (ver
  [Cuántos empleos da un polo](#cuántos-empleos-da-un-polo)). Con la densidad del conjunto
  serían 20,681. Un lote de 30 ha da 3,152 empleos y pide de 3.3 MW (agroindustria) a 6.2 MW
  (equipo de transporte).
- **La espuela:** la **Línea N de CPKC** corre pegada al polígono 3, así que la espuela es solo
  su cambio de vía. Como el juego la cobra por km, no cuesta nada; tarda los 2 meses mínimos con
  cuatro cuadrillas.
- **La energía:** los **12.9 MW** de Economía. Lleno, a 1.6 kW por empleo, pide 43.2 MW:
  necesitará uno o dos bancos de 30 MVA de la CFE, según sus sectores. La línea de 115 kV más
  cercana queda a 2.51 km de su subestación (OpenStreetMap).
- **Los frentes:** son los de Huamantla. Su obra completa cuesta 1,878 millones con una
  cuadrilla; las vialidades, 751 millones en 16.8 meses, o 1,089 en 5.9 con cuatro.
  - La cifra oficial de su obra es mayor: la Presidencia estima 9,310 millones para su
    infraestructura y su conexión con la carretera federal 120, y sus dos desarrolladores
    anunciaron más de 6,300 millones en sus áreas.
  - El juego no la usa: el costo por hectárea es el mismo en todos los polos (el de Zapotlán).
- **Las vocaciones en sectores:**
  - Agroindustrial es la industria alimentaria.
  - Automotriz y autopartes es el equipo de transporte.
  - Electrodomésticos son los aparatos eléctricos.
  - Maquinaria y equipo es su sector.
  - Logístico no es manufactura: no se ofrece para un lote.

**En la realidad**:
- **7 de julio de 2025:** sale su declaratoria (DOF), en terrenos del Gobierno de Michoacán.
- **7 de agosto:** Citelis anuncia su primera inversión, mil millones, en la conferencia de la
  Presidenta.
- **30 de enero de 2026:** el estado entrega sus dos primeras áreas de desarrollo a Grupo Herso y
  a Citelis, que harán obras de infraestructura por más de 6,300 millones.
- **6 de febrero:** la SCOP termina su infraestructura base: un tanque de agua de 200 m³, el cerco y
  la línea eléctrica de media tensión.
- **20 de agosto:** se firma su fideicomiso.
- **Noviembre:** según la Presidencia (4 de noviembre), empieza su obra de infraestructura y su
  conexión con la carretera federal 120.

No se han reportado empresas instaladas: sus lotes y su acomodo son del juego. En el modo
Realidad aparece en obra desde noviembre de 2026.

### Hermosillo por dentro

El noveno polo con vista por dentro (`/mexico/polo/hermosillo`), del Plan México: el Polo de
Desarrollo Económico para el Bienestar e Innovación de Hermosillo, 546.46 ha en la orilla norte
de la ciudad, a los dos lados de la carretera federal 15.

**El terreno**, de su declaratoria (DOF, 26 de agosto de 2025): tres cuadros en UTM zona 12 (el
DOF no dice la zona; Sonora está en ella), con coma decimal.

| Sección | Superficie | Dónde |
| --- | ---: | --- |
| Lado A | 298.97 ha | Al este de la carretera federal 15 |
| Lado B | 226.86 ha | Al oeste de la carretera |
| PIAT | 20.63 ha | En una muesca del Lado A, con el que comparte tres lados |

- **Resultado:** suman 547.18 ha calculadas contra las 546.46 declaradas. El Lado B da 0.3 % más
  que su cuadro, y su columna de rumbos no son rumbos (ver la
  [bitácora](#12-bitácora-de-correcciones-a-los-datos)).
- **El marcador:** el que el juego ya tenía cae dentro del Lado A.

**Lo que dice la declaratoria**:
- **Conectividad:** «a solo 650 metros de la carretera Hermosillo-Guaymas y conectado por la
  Carretera Federal 15», con acceso ferroviario a 2 km y el aeropuerto a 17 km. En OpenStreetMap
  la federal 15 pasa entre el Lado A y el Lado B, en su tramo a Nogales.
- **Energía:** la Secretaría de Energía calcula una demanda de 1 a 7 MW de 2026 a 2030, servida
  desde la subestación Hermosillo Tres (115 kV) con una línea de unos 3.6 km; en 2038 esa
  subestación tendría un segundo banco de 40 MVA. El gas, hasta 75 millones de m³ al año, lo da
  Energas de México.
- **Suelo:** uso industrial, con licencia para el Lado A y en trámite para el B; su manifestación
  de impacto ambiental se aprobó en julio de 2024.
- **Vocaciones:** automotriz, semiconductores y electrónica especializada, agroindustrial,
  energía, logística, y dispositivos médicos y de medición.
- **Propiedad:** el Gobierno de Sonora.

**Lo que es del juego**:
- **Los lotes:** la parte de uso industrial de Coatzacoalcos I (76.46 %): **411 ha en 19 lotes de
  8 a 40 ha**.
  - Por sección: 9 lotes en el Lado A (225 ha), 8 en el B (170 ha) y 2 de 8 ha en el PIAT.
  - Los servicios tienen 5 ha a la entrada del Lado A, al sur.
  - Lo demás es área común y reserva, sobre todo las puntas norte de los dos lados.
- **Los empleos:** 61.2 por hectárea, 33,424. Un lote de 20 ha da 1,626 y pide de 1.2 MW
  (dispositivos médicos) a 3.2 MW (equipo de transporte).
- **La espuela:** la **Línea T de Ferromex** corre al este del polo: **1.94 km**, casi los 2 de
  la declaratoria. Cuesta 88 millones con una cuadrilla (5.6 meses) o 128 con cuatro (2 meses).
  La vía queda fuera de la caja de la vista; el generador la busca hasta 6 km más allá, como
  hace con la luz.
- **La energía:** los **7 MW** de la Secretaría de Energía. Lleno, a 1.6 kW por empleo, pide
  52.9 MW: necesitará dos bancos de 30 MVA de la CFE. En OpenStreetMap la subestación Hermosillo
  3 (230/115 kV) queda a 2.5 km de la subestación del juego, y la línea de 115 kV más cercana, a
  0.4 km.
- **Los frentes:** son los de Huamantla. Su obra completa cuesta 3,000 millones con una
  cuadrilla; las vialidades, 1,200 millones en 19.3 meses, o 1,740 en 6.8 con cuatro.
- **Las vocaciones en sectores:**
  - Automotriz es el equipo de transporte.
  - Semiconductores y electrónica especializada son los semiconductores y la electrónica.
  - Agroindustrial es la industria alimentaria.
  - Energía es el equipo de generación y distribución de electricidad.
  - Dispositivos médicos y de medición son los dispositivos médicos (estimación del juego).
  - Logística no es manufactura: no se ofrece para un lote.

**En la realidad**:
- **Junio de 2025:** el gobernador anuncia en la conferencia matutina su incorporación al
  programa, con «más de 100 hectáreas disponibles».
- **26 de agosto:** sale la declaratoria (DOF), con 546.
- **5 de abril de 2026:** el Gobierno de Sonora presenta el polo con su alianza con Arizona y
  Taiwán, para atraer inversión y formar talento en semiconductores y electromovilidad.

No se ha reportado obra ni empresas.

### Topolobampo por dentro

El décimo polo con vista por dentro (`/mexico/polo/topolobampo`), del Plan México: 277.58 ha en
Ahome, Sinaloa, junto al puerto de Topolobampo y a la vía del Chihuahua–Pacífico.

**El terreno**, del acuerdo que modificó su declaratoria (DOF, 29 de abril de 2026): dos
polígonos en UTM zona 12, el 2 (216.16 ha) y el 1 (61.42 ha).
- **Resultado:** suman 277.5776 ha, exactamente lo declarado.
- **La donación:** la declaratoria del 20 de marzo traía además un «polígono de donación a
  Rosendo G. Castro» (3.77 ha) pegado al polígono 1, que el acuerdo de abril dejó fuera (ver la
  [bitácora](#12-bitácora-de-correcciones-a-los-datos)). El juego la dibuja aparte; junto a ella
  está la colonia Rosendo G. Castro (OpenStreetMap).
- **El marcador:** el que el juego ya tenía cae dentro del terreno.

**Lo que dice la declaratoria**:
- **Conectividad:** el puerto de Topolobampo, de 8 a 12 m de calado, carretera y conexión
  ferroviaria; en OpenStreetMap la carretera estatal SIN 124 pasa entre los dos polígonos.
- **Servicios:** «dispone de vialidades, energía eléctrica, agua potable, drenaje y
  conectividad, con opciones identificadas para ampliar la disponibilidad de energía en el
  mediano plazo», y gas en el predio.
- **Vocaciones:** manufactura avanzada, logística, industria química y petroquímica
  (fertilizantes), industria del plástico y del hule, e industrias metálicas básicas.
- **Propiedad:** el estado de Sinaloa.

**Lo que es del juego**:
- **Los lotes:** la parte de uso industrial de Coatzacoalcos I (76.46 %): **212 ha en 12 lotes de
  10 a 30 ha**: 8 en el polígono 2 (160 ha) y 4 en el 1 (52 ha).
  - Los servicios tienen 4 ha a la entrada del polígono 2, por la SIN 124.
  - Lo demás es área común y reserva.
- **Los empleos:** 61.2 por hectárea, 16,978.
- **La espuela:** la **Línea Q de Ferromex** corre pegada al polígono 2: **0.02 km**, 1 millón
  con cuatro cuadrillas y el mínimo de 2 meses.
- **La energía:** no tiene cifra oficial: la mediana, **8 MW** (estimación del juego). Lleno de
  industria promedio pide 27.2 MW: un banco de la CFE. Pero sus vocaciones gastan mucho: un lote
  de petroquímica o de metálicas básicas de 20 ha pide 11 MW. La línea de 230 kV más
  cercana queda a 0.52 km de su subestación (OpenStreetMap).
- **Los frentes:** son los de Huamantla. Su obra completa cuesta 1,524 millones con una
  cuadrilla; las vialidades, 610 millones en 15.8 meses, o 884 en 5.6 con cuatro.

Lo que pide cada uno de sus sectores en un lote de 20 ha (1,602 empleos):

| Sector | SCIAN | Personal ocupado (2018) | Luz | Agua | t por trabajador al año | Exporta | MW | t al año por tren |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Química (fertilizantes, pinturas, jabones y otros) | 3253, 3255, 3256, 3259 | 122,757 | 1.21× | 1.72× | 4.73 | 0 % | 3.1 MW | 7,488 t |
| Petroquímica (química básica y resinas) | 3251, 3252 | 56,630 | 4.28× | 2.92× | 150.31 | 11 % | 11.0 MW | 237,959 t |
| Industria del plástico y del hule | 326 | 381,838 | 1.30× | 0.34× | 1.49* | 30 % | 3.3 MW | 2,359 t |
| Industrias metálicas básicas | 331 | 137,249 | 4.32× | 1.78× | 67.83 | 16 % | 11.1 MW | 107,383 t |

- **Plástico y hule** es un sector nuevo (SCIAN 326, INEGI). Gasta 1.30 veces la luz y 0.34
  veces el agua del promedio de la manufactura. El anuario ferroviario no trae productos suyos
  (los gránulos de plástico son resinas, de la petroquímica), así que su carga va en contenedores.
- **Las vocaciones en sectores:** química y petroquímica son dos sectores (los fertilizantes
  están en la química). Manufactura avanzada no es un sector del censo y logística no es
  manufactura: no se ofrecen para un lote.

**En la realidad**:
- **3 de septiembre de 2025:** el Gobierno de Sinaloa dice que el polo tiene 275 hectáreas
  desarrollables y, a sus alrededores, cuatro proyectos grandes: Pacífico Mexinol (metanol), Gas
  y Petroquímica de Occidente (amoniaco, metanol y urea), DH2 Energy (hidrógeno verde) y una
  terminal de gas de Sempra.
- **20 de noviembre de 2025:** la planta de amoniaco de Proman-GPO pasa del 50 % de su obra, con
  1,700 empleos directos, y producirá a finales de 2027 (Gobierno de Sinaloa). OpenStreetMap no la
  tiene, así que el juego no la ubica.
- **20 de marzo de 2026:** sale la declaratoria (DOF).
- **29 de abril:** el acuerdo que la modifica deja fuera la donación.

No se ha reportado obra ni empresas en el polo. Los 30 mil empleos que se anuncian con él son de
todo el norte de Sinaloa (ver [Cuántos empleos da un polo](#cuántos-empleos-da-un-polo)).

### Puerta Logística del Bajío por dentro

El undécimo polo con vista por dentro (`/mexico/polo/puerta-logistica-bajio`), del Plan México:
52.41 ha en Celaya, Guanajuato, para un puerto seco donde se cruzan Ferromex y CPKC.

**El terreno**, de su declaratoria (DOF, 21 de julio de 2025): tres polígonos en UTM zona 14 (el
DOF no dice la zona; Celaya está en ella), con sus curvas.

| Polígono | Superficie | Dónde |
| --- | ---: | --- |
| II | 48.83 ha | Una franja de 1.7 km de norte a sur, que rodea un rectángulo de 1.2 ha que no incluye |
| I | 3.29 ha | Al sur, del otro lado de una calle curva de 25 m |
| III | 0.29 ha | Un triángulo en la punta norte |

- **Resultado:** cada lado cuadra con su rumbo y su distancia; suman 52.41 ha, lo declarado.
- **La calle curva:** las curvas del I y del II giran alrededor de los mismos centros, a 25 m una
  de otra.
- **El marcador:** el que el juego ya tenía cae dentro del terreno.

**Lo que dice la declaratoria**:
- **Conectividad:** a 5 km de la carretera 51 y a 2 km de la 45D, con «acceso directo a vías
  férreas (CPKC y Ferromex)» y a 15 km del aeropuerto de Celaya; el tren Querétaro–Irapuato
  tendrá estación en Celaya.
- **Servicios:** «dispone de vialidades, energía eléctrica, agua potable, drenaje y
  conectividad».
- **Vocaciones:** industria, manufacturera avanzada, logística y transporte, agroindustria de
  valor agregado, tecnologías de la información y servicios empresariales, automotriz y
  aeroespacial.
- **Propiedad:** el Gobierno de Guanajuato.

**Lo que es del juego**:
- **Los lotes:** la parte de uso industrial de Coatzacoalcos I (76.46 %): **40 ha en 10 lotes de 2
  a 6 ha**, del tamaño de las bodegas de un puerto seco: 9 en el polígono II y 1 en el I.
  - Los servicios tienen 1.5 ha a la entrada, en la punta norte.
  - El polígono III queda de reserva.
- **Los empleos:** 61.2 por hectárea, 3,206. Un lote de 5 ha da 401 y pide de 0.4 MW (productos
  metálicos o agroindustria) a 0.8 MW (equipo de transporte).
- **La espuela:** pegados a su lado oeste corren ramales de vía sin nombre (OpenStreetMap). La
  espuela va a la línea principal más cercana, la **Línea AM de Ferromex**: **1.09 km**, 50
  millones con una cuadrilla (5.6 meses) o 72 con cuatro (2 meses).
- **La energía:** no tiene cifra oficial: la mediana, **8 MW** (estimación del juego). Lleno pide
  5.1 MW: le sobra. La línea de 115 kV más cercana queda a 0.08 km de su subestación
  (OpenStreetMap).
- **Los frentes:** son los de Huamantla. Su obra completa cuesta 288 millones con una cuadrilla;
  las vialidades, 115 millones en 9.6 meses, o 167 en 3.4 con cuatro.
- **Las vocaciones en sectores:**
  - Automotriz y aeroespacial son el equipo de transporte.
  - Agroindustria es la industria alimentaria.
  - Industria, a secas, son los productos metálicos, la maquinaria, los aparatos eléctricos y la
    electrónica, como la manufactura de Zapotlán (estimación del juego).
  - Manufactura avanzada no es un sector del censo, y logística y tecnologías de la información
    no son manufactura: no se ofrecen para un lote.

**En la realidad**:
- **Agosto de 2024:** el Gobierno de Guanajuato firma en Celaya el puerto seco con el grupo español
  AZVI, CPKC y Ferromex, con 2 mil millones en su primera etapa (municipio de Celaya).
- **26 de junio de 2025:** la gobernadora firma en Palacio Nacional la carta de intención que lo
  hace polo; la primera etapa ocupa 51 ha y puede crecer a 200, y por Celaya pasa el 23 % de la
  carga ferroviaria del país (Gobierno de Guanajuato).
- **21 de julio:** sale la declaratoria (DOF).
- **Marzo de 2026:** el director de Guanajuato Puerto Interior dice a El Economista que la obra
  empezaría ese año y operaría en 2027, con 2,500 millones de Cointer México (Grupo AZVI), 12 km de
  vías y siete naves.

No se ha reportado que su obra empezara. Junto al polo, OpenStreetMap marca en obra la Línea NBA
de CPKC y un patio de vías, fuera del terreno.

### Durango por dentro

El duodécimo polo con vista por dentro (`/mexico/polo/durango`), del Plan México: el Centro
Logístico e Industrial de Durango, 315.42 ha en la orilla de la ciudad, junto a la autopista 40D
y a la vía de la Línea Coahuila Durango.

**El terreno**, de su declaratoria (DOF, 26 de agosto de 2025): cinco cuadros en UTM zona 13 (el
DOF no dice la zona; Durango está en ella), con números en formato europeo (2.674.973,1107).

| Cuadro | Superficie |
| --- | ---: |
| Polígono 1 | 272.16 ha |
| Reserva 1 | 21.50 ha |
| Reserva 2 | 6.28 ha |
| Reserva 4 | 9.93 ha |
| Reserva 5 | 5.54 ha |

- **Resultado:** cada lado cuadra con su rumbo y su distancia; suman 315.42 ha, lo declarado. No
  hay reserva 3.
- **El marcador:** el que el juego ya tenía cae dentro del polígono 1.

**Lo que dice la declaratoria**:
- **Conectividad:** «a pie de paso de la carretera 40D, así como de la vía férrea existente», a
  780 m de la zona urbana Cinco de Mayo y a 4 km del aeropuerto.
- **Servicios:** «dispone de vialidades, energía eléctrica, agua potable, drenaje y
  conectividad».
- **Vocaciones:** movilidad eléctrica, industria cinematográfica, autopartes, electrónica
  especializada, manufactura avanzada, industria textil, industria del papel y automotriz.
- **Propiedad:** el estado de Durango.

**Lo que es del juego**:
- **Los lotes:** en el polígono 1, la parte de uso industrial de Coatzacoalcos I (76.46 % de él):
  **212 ha en 11 lotes de 10 a 30 ha**, con 4 ha de servicios a la entrada. Las cuatro reservas
  quedan como reserva, sin lotes.
- **Los empleos:** 61.2 por hectárea, 19,292. Un lote de 20 ha da 1,820 y pide de 2.1 MW
  (electrónica) a 4 MW (papel).
- **La espuela:** la **Línea DA de la Línea Coahuila Durango** corre pegada al polígono 1:
  **0.04 km**, 3 millones con cuatro cuadrillas y el mínimo de 2 meses.
- **La energía:** no tiene cifra oficial: la mediana, **8 MW** (estimación del juego). Lleno pide
  30.9 MW: un banco de la CFE. La línea de 115 kV más cercana queda a 0.31 km de su subestación
  (OpenStreetMap).
- **Los frentes:** son los de Huamantla. Su obra completa cuesta 1,732 millones con una
  cuadrilla; las vialidades, 693 millones en 16.4 meses, o 1,004 en 5.8 con cuatro.
- **Las vocaciones en sectores:**
  - Movilidad eléctrica es el equipo de transporte y los aparatos eléctricos, donde están las
    baterías; autopartes y automotriz, el equipo de transporte; electrónica especializada, la
    electrónica (estimación del juego).
  - La textil y la del papel, sus sectores.
  - **Papel** es un sector nuevo (SCIAN 322, INEGI): gasta 1.39 veces la luz y 0.89 veces el agua
    del promedio de la manufactura, y el tren mueve su celulosa (551 mil toneladas en 2018), su
    cartón (267 mil) y su papel (165 mil), sin exportar (ARTF). Un lote de 20 ha de papel mueve 12
    mil toneladas al año por tren. Su desperdicio de papel no cuenta: es materia prima, como el
    desperdicio de fierro.
  - Manufactura avanzada no es un sector del censo y la industria cinematográfica no es
    manufactura: no se ofrecen para un lote.

**En la realidad**:
- **26 de agosto de 2025:** sale la declaratoria (DOF), en terrenos públicos del estado.
- **21 de abril de 2026:** el Congreso de Durango autoriza donar 50 ha del Centro Logístico
  Industrial a Fermaca Digital para un centro de datos de unos 2,700 millones de dólares y por lo
  menos mil empleos directos. La nota no dice si esas hectáreas quedan dentro del polígono del
  polo.

No se ha reportado obra del polo; sus lotes y su acomodo son del juego.

### Salina Cruz por dentro

El decimotercer polo con vista por dentro (`/mexico/polo/salina-cruz`), del Corredor
Interoceánico: 82.09 ha en Salina Cruz, Oaxaca, junto a la refinería Antonio Dovalí, a 8 km del
puerto.

**El terreno**, de su declaratoria (DOF, 12 de mayo de 2023): un polígono en UTM zona 15 con tres
curvas, con su centro y su radio.
- **Resultado:** cada lado cuadra con su rumbo y su distancia; con las curvas da 820,867 m² contra
  los 820,864 declarados.
- **El marcador:** el que el juego ya tenía cae dentro del terreno.

**Lo que dice la declaratoria**:
- **Conectividad:** a 3 km de la línea Z, a pie de la carretera estatal a San Antonio Monterrey y
  de la avenida Oleoducto, a 2.5 km de la MEX-185, a 8 km del puerto y a 36.8 km del aeropuerto de
  Ixtepec.
- **Vocaciones:** las mismas once de Coatzacoalcos I.
- **Propiedad:** el INDAABIN la aportó al Corredor Interoceánico (DOF, 5 de enero de 2021).

**Lo que es del juego**:
- **Los lotes:** la parte de uso industrial de Coatzacoalcos I (76.46 %): **63 ha en 8 lotes de 4 a
  12 ha**, con 2 ha de servicios a la entrada. La entrada mira a la avenida Oleoducto: no hay
  carretera con número a menos de 2 km.
- **Los empleos:** 61.2 por hectárea, 5,021. Un lote de 10 ha da 797 y pide de 0.6 MW
  (dispositivos médicos) a 5.5 MW (metálicas básicas o petroquímica).
- **La espuela:** la **Línea Z de Ferroistmo** queda al oeste: **2.26 km** (el DOF dice 3; el
  desarrollador, 2). Cuesta 103 millones con una cuadrilla (5.6 meses) o 149 con cuatro (2 meses).
- **La energía:** no tiene cifra oficial: la mediana, **8 MW** (estimación del juego). Lleno pide
  8.0 MW: cabe justo. La línea de 115 kV más cercana queda a 1.07 km de su subestación
  (OpenStreetMap).
- **Los frentes:** son los de Huamantla. Su obra completa cuesta 451 millones con una cuadrilla;
  las vialidades, 180 millones en 10.9 meses, o 261 en 3.9 con cuatro.

**En la realidad**:
- **28 de noviembre de 2023:** fallo de su licitación (DOF); la gana Desarrolladora Multimodal del
  Istmo.
- **19 de septiembre de 2024:** el Gobierno de Oaxaca presenta sus avances con el arranque de sus
  obras; el consorcio invertirá más de 5 mil millones en su primera etapa.
- **19 de febrero de 2025:** la Presidenta lo da por concesionado, con 90 % de avance en sus
  estudios.

En el modo Realidad aparece en obra desde septiembre de 2024. En 2026 el Corredor reporta solo
cinco polos del Istmo concesionados, sin decir cuáles. No se han reportado empresas.

### Arriaga por dentro

El decimocuarto polo con vista por dentro (`/mexico/polo/arriaga`), del Corredor Interoceánico:
48.83 ha en Arriaga, Chiapas, pegado a la Línea K.

**El terreno**, de su declaratoria (DOF, 8 de junio de 2026): la Finca Rústica El Cocal, un
polígono de nueve vértices en UTM zona 15, con rumbos escritos «NW 84°…».
- **Resultado:** cada lado cuadra con su rumbo y su distancia; da 48.76 ha contra las 48.83
  declaradas (ver la [bitácora](#12-bitácora-de-correcciones-a-los-datos)).
- **El marcador:** el que el juego ya tenía cae dentro del terreno.

**Lo que dice la declaratoria**:
- **Conectividad:** colindante con la Línea K y a 3 km de la estación Arriaga, a 3.5 km de la
  ciudad, a pie del libramiento Arriaga–Tapanatepec y a 5 km de la MEX-200.
- **Vocaciones:** agroindustria, equipo de generación y distribución de energía eléctrica, y
  metales, «enunciativas y no limitativas».
- **Propiedad:** el ayuntamiento la aportó al Corredor Interoceánico (Periódico Oficial de
  Chiapas, 23 de julio de 2025).

**Lo que es del juego**:
- **Los lotes:** la parte de uso industrial de Coatzacoalcos I (76.46 %): **37 ha en 6 lotes de 3 a
  10 ha**, con 1.5 ha de servicios a la entrada, del lado de la MEX-200.
- **Los empleos:** 61.2 por hectárea, 2,987. Un lote de 10 ha da 807 y pide de 0.8 MW
  (agroindustria) a 5.6 MW (metálicas básicas).
- **La espuela:** la **Línea K de Ferroistmo** corre pegada a su lado suroeste: **0.02 km**, 1
  millón con cuatro cuadrillas y el mínimo de 2 meses.
- **La energía:** no tiene cifra oficial: la mediana, **8 MW** (estimación del juego). Lleno pide
  4.8 MW; un lote de metálicas básicas ya pide 5.6. La línea de 115 kV más cercana queda a 0.68 km
  de su subestación (OpenStreetMap).
- **Los frentes:** son los de Huamantla. Su obra completa cuesta 268 millones con una cuadrilla;
  las vialidades, 107 millones en 9.4 meses, o 156 en 3.3 con cuatro.
- **Las vocaciones en sectores:** agroindustria es la industria alimentaria; el equipo eléctrico,
  su sector, y metales, las metálicas básicas.

**En la realidad**: el ayuntamiento aportó el terreno en julio de 2025 y la declaratoria salió el 8
de junio de 2026 (DOF). No se ha reportado licitación ni obra.

### Tapachula I por dentro

El decimoquinto polo con vista por dentro (`/mexico/polo/tapachula-i`), del Corredor
Interoceánico: 263.17 ha en Tapachula, Chiapas, junto a la autopista a Puerto Chiapas.

**El terreno**, de su declaratoria (DOF, 8 de abril de 2025): una poligonal general «A» en UTM zona
15 menos los derechos de vía del ramal KA y de una línea eléctrica de la CFE, que la cruzan de lado
a lado. Quedan tres predios: el sur (168.50 ha), el norte (55.88) y el central (38.84).
- **Resultado:** con tres erratas corregidas, la poligonal da 268.78 ha contra 268.73 y los predios
  263.22 contra 263.17 (ver la [bitácora](#12-bitácora-de-correcciones-a-los-datos)). Las dos franjas
  dan exactamente lo de sus cuadros.
- **El marcador:** el que el juego ya tenía cae dentro del terreno.

**Lo que dice la declaratoria**:
- **Conectividad:** aledaño a la línea KA y a 9.57 km de la línea K, con frente a la MEX-225
  (la autopista Tapachula–Puerto de San Benito), a 5.22 km de Puerto Chiapas y a 5.98 km del
  aeropuerto de Tapachula.
- **Vocaciones:** las mismas once de Coatzacoalcos I.
- **Propiedad:** el INDAABIN la aportó al Corredor Interoceánico (DOF, 16 de octubre de 2024).

**Lo que es del juego**:
- **Los lotes:** la parte de uso industrial de Coatzacoalcos I (76.46 %): **200 ha en 17 lotes de 5 a
  25 ha**, con 4 ha de servicios a la entrada del predio sur. Cada predio lleva su calle; se hacen
  uno tras otro, el sur primero.
- **Los empleos:** 61.2 por hectárea, 16,097. Un lote de 10 ha da 805 y pide de 0.6 MW
  (dispositivos médicos) a 5.6 MW (metálicas básicas).
- **La espuela:** el ramal KA de Ferroistmo lo cruza: **0.01 km**, menos de un millón con cuatro
  cuadrillas y el mínimo de 2 meses.
- **La energía:** no tiene cifra oficial: la mediana, **8 MW** (estimación del juego). Lleno pide
  25.8 MW: un banco de la CFE. La línea de 115 kV más cercana queda a 0.12 km de su subestación
  (OpenStreetMap).
- **Los frentes:** son los de Huamantla. Su obra completa cuesta 1,445 millones con una cuadrilla;
  las vialidades, 578 millones en 15.5 meses, o 838 en 5.5 con cuatro.

**En la realidad**:
- **16 de octubre de 2024:** el INDAABIN aporta el terreno al Corredor Interoceánico (DOF).
- **11 de junio de 2025:** el Corredor convoca a su licitación internacional (LPIBI-013AYH-PODEBI-2-2025),
  para concesionarlo 30 años, prorrogables 20.
- **17 de septiembre de 2025:** una segunda nota aclaratoria reabre el registro de interesados, del
  19 al 30 de septiembre.

No se ha publicado un fallo ni se ha reportado obra: en el modo Realidad sigue anunciado, con su
convocatoria entre sus hitos.

### Tapachula II por dentro

El decimosexto polo con vista por dentro (`/mexico/polo/tapachula-ii`), del Corredor
Interoceánico: 149.72 ha en Tapachula, Chiapas, a 0.59 km de Puerto Chiapas.

**El terreno**, de su declaratoria (DOF, 8 de abril de 2025): el polígono «C» en UTM zona 15, con
dos curvas cuyo centro va en el mismo renglón que el vértice donde terminan.
- **Resultado:** cada lado cuadra con su rumbo y su distancia; con las curvas da 149.72 ha, lo
  declarado.
- **El marcador:** el que el juego ya tenía cae dentro del terreno.

**Lo que dice la declaratoria**:
- **Conectividad:** a 0.75 km de la línea KA y a 14.16 km de la línea K, a pie de la carretera
  estatal a Playa Linda, a 2.74 km de la MEX-225, a 0.59 km de Puerto Chiapas y a 11.40 km del
  aeropuerto de Tapachula.
- **Vocaciones:** las mismas once de Coatzacoalcos I.
- **Propiedad:** el INDAABIN la aportó al Corredor Interoceánico (DOF, 16 de octubre de 2024).

**Lo que es del juego**:
- **Los lotes:** la parte de uso industrial de Coatzacoalcos I (76.46 %): **111 ha en 9 lotes de 6 a
  20 ha**, con 3 ha de servicios a la entrada. La entrada mira al camino que corre a su pie, que
  OpenStreetMap llama Ramal a Escolleras y marca como MEX-225; ninguno se llama Playa Linda.
- **Los empleos:** 61.2 por hectárea, 9,157. Un lote de 10 ha da 825 y pide de 0.6 MW
  (dispositivos médicos) a 5.7 MW (metálicas básicas).
- **La espuela:** la **Línea KA de Ferroistmo** queda a **0.47 km** (el DOF dice 0.75). Cuesta 21
  millones con una cuadrilla (5.6 meses) o 31 con cuatro (2 meses).
- **La energía:** no tiene cifra oficial: la mediana, **8 MW** (estimación del juego). Lleno pide
  14.7 MW: un banco de la CFE. La línea de 115 kV más cercana queda a 0.39 km de su subestación
  (OpenStreetMap).
- **Los frentes:** son los de Huamantla. Su obra completa cuesta 822 millones con una cuadrilla;
  las vialidades, 329 millones en 13.1 meses, o 477 en 4.6 con cuatro.

**En la realidad**:
- **16 de octubre de 2024:** el INDAABIN aporta el terreno al Corredor Interoceánico (DOF).
- **11 de junio de 2025:** el Corredor convoca a su licitación internacional (LPIBI-013AYH-PODEBI-3-2025),
  para concesionarlo 30 años, prorrogables 20.
- **17 de septiembre de 2025:** una segunda nota aclaratoria reabre el registro de interesados, del
  19 al 30 de septiembre.

No se ha publicado un fallo ni se ha reportado obra: en el modo Realidad sigue anunciado, con su
convocatoria entre sus hitos.

### Teapa por dentro

El decimoséptimo polo con vista por dentro (`/mexico/polo/teapa`), del Corredor Interoceánico y el
único en Tabasco: 96.14 ha en Teapa.

**El terreno**, de su declaratoria (DOF, 8 de junio de 2026): un polígono de 171 vértices en UTM
zona 15, cada uno también en latitud y longitud.
- **Resultado:** da 961,359 m² contra los 961,361 declarados.
- **La conversión:** el primer vértice de la tabla cae a 0.01 m de sus coordenadas geográficas.

**Lo que dice la declaratoria**:
- **Conectividad:** «aledaño a la línea FA» y, un párrafo después, a 4 km de ella (ver la
  [bitácora](#12-bitácora-de-correcciones-a-los-datos)); a 6 km de la MEX-195
  Villahermosa–Escopetazo, a 8 km de la ciudad de Teapa y a 75 km del aeropuerto de Villahermosa.
- **Vocaciones:** agroindustria, petroquímica, y comercio y logística, «enunciativas y no
  limitativas».
- **Propiedad:** el Gobierno de Tabasco la aportó al Corredor Interoceánico (Periódico Oficial de
  Tabasco, 30 de abril de 2025); se protocolizó el 16 de febrero de 2026.

**Lo que es del juego**:
- **Los lotes:** la parte de uso industrial de Coatzacoalcos I (76.46 %): **73 ha en 8 lotes de 5 a
  15 ha**, con 2 ha de servicios a la entrada. A su alrededor solo hay caminos sin nombre ni número
  en OpenStreetMap: la vista no rotula carretera.
- **Los empleos:** 61.2 por hectárea, 5,880. Un lote de 10 ha da 805 y pide 0.8 MW (agroindustria)
  o 5.5 MW (petroquímica).
- **La espuela:** la **Línea FA de Ferroistmo** queda al sur: **1.43 km** en línea recta. Cuesta
  65 millones con una cuadrilla (5.6 meses) o 94 con cuatro (2 meses).
- **La energía:** no tiene cifra oficial: la mediana, **8 MW** (estimación del juego). Lleno pide
  9.4 MW: un banco de la CFE. La línea de 115 kV más cercana queda a 1.32 km de su subestación
  (OpenStreetMap).
- **Los frentes:** son los de Huamantla. Su obra completa cuesta 528 millones con una cuadrilla;
  las vialidades, 211 millones en 11.5 meses, o 306 en 4.1 con cuatro.
- **Las vocaciones en sectores:** agroindustria es la industria alimentaria y petroquímica, su
  sector. Comercio y logística no son manufactura: no se ofrecen para un lote.

**En la realidad**: Tabasco aportó el terreno en abril de 2025 y la declaratoria salió el 8 de
junio de 2026 (DOF). No se ha reportado licitación ni obra.

### San Blas Atempa por dentro

El decimoctavo polo con vista por dentro (`/mexico/polo/san-blas-atempa`), del Corredor
Interoceánico: 331.54 ha en San Blas Atempa, Oaxaca, a pie de la MEX-185.

**El terreno**, de su declaratoria (DOF, 12 de mayo de 2023): un polígono de 11 vértices en UTM
zona 15.
- **Resultado:** cada lado cuadra con su rumbo y su distancia; da 3,315,377 m² contra los 3,315,375
  declarados.
- **El marcador:** el que el juego ya tenía cae dentro del terreno.

**Lo que dice la declaratoria**:
- **Conectividad:** a 4.7 km de la línea Z, a pie de la MEX-185 Juchitán–Tehuantepec, a 18.4 km del
  aeropuerto de Ixtepec y a 25 km del puerto de Salina Cruz.
- **Vocaciones:** las mismas once de Coatzacoalcos I.
- **Propiedad:** el Corredor Interoceánico la compró (protocolizada el 22 de abril de 2022).

**Lo que es del juego**:
- **Los lotes:** la parte de uso industrial de Coatzacoalcos I (76.46 %): **255 ha en 13 lotes de 10
  a 30 ha**, con 4 ha de servicios a la entrada, del lado de la MEX-185.
- **Los empleos:** 61.2 por hectárea, 20,278. Un lote de 10 ha da 795 y pide de 0.6 MW
  (dispositivos médicos) a 5.5 MW (metálicas básicas).
- **La espuela:** la **Línea Z de Ferroistmo** queda a **2.67 km** en línea recta (el DOF dice 4.7).
  Cuesta 121 millones con una cuadrilla (5.6 meses) o 176 con cuatro (2 meses).
- **La energía:** no tiene cifra oficial: la mediana, **8 MW** (estimación del juego). Lleno pide
  32.4 MW: un banco de la CFE. La línea de 115 kV más cercana queda a 0.02 km de su subestación
  (OpenStreetMap).
- **Los frentes:** son los de Huamantla. Su obra completa cuesta 1,820 millones con una
  cuadrilla; las vialidades, 728 millones en 16.6 meses, o 1,056 en 5.9 con cuatro.

**En la realidad**:
- **16 de julio de 2025:** fallo de su licitación (DOF).

En 2026 el Corredor reporta solo cinco polos del Istmo concesionados, sin decir cuáles. No se
ha reportado obra.

### San Juan Evangelista por dentro

El decimonoveno polo con vista por dentro (`/mexico/polo/san-juan-evangelista`), del Corredor
Interoceánico: 360.25 ha en Veracruz, junto a la línea Z, cerca del nodo
ferroviario de Medias Aguas.

**El terreno**, de su declaratoria (DOF, 12 de mayo de 2023): un polígono de diez vértices en UTM
zona 15 que cierra con una curva; el centro de la curva viene en el renglón que sigue al cierre.
- **Resultado:** cada lado cuadra con su rumbo y su distancia; con la curva da 3,602,513 m² contra
  los 3,602,505 declarados.
- **El marcador:** el que el juego ya tenía cae dentro del terreno.

**Lo que dice la declaratoria**:
- **Conectividad:** aledaño a la línea Z, a 3.5 km del nodo ferroviario de Medias Aguas, donde la
  vía transístmica cruza la que va al centro del país, y a 7.5 km de la MEX-185.
- **Vocaciones:** las mismas once de Coatzacoalcos I.
- **Propiedad:** el Corredor Interoceánico la compró (instrumentos del 6 de diciembre de 2021 y del
  29 de marzo de 2023).

**Lo que es del juego**:
- **Los lotes:** la parte de uso industrial de Coatzacoalcos I (76.46 %): **270 ha en 13 lotes de 10
  a 30 ha**, con 4 ha de servicios a la entrada. No hay carretera con número en su vista: la
  MEX-185 queda a 7.5 km.
- **Los empleos:** 61.2 por hectárea, 22,035. Un lote de 10 ha da 816 y pide de 0.6 MW
  (dispositivos médicos) a 5.6 MW (metálicas básicas).
- **La espuela:** la **Línea Z de Ferroistmo** corre pegada a su lado este: **0.03 km**, 2 millones
  con cuatro cuadrillas y el mínimo de 2 meses.
- **La energía:** no tiene cifra oficial: la mediana, **8 MW** (estimación del juego). Lleno pide
  35.3 MW: un banco de la CFE. La línea de 400 kV más cercana queda a 2.63 km de su subestación
  (OpenStreetMap).
- **Los frentes:** son los de Huamantla. Su obra completa cuesta 1,978 millones con una
  cuadrilla; las vialidades, 791 millones en 17.1 meses, o 1,147 en 6.0 con cuatro.

**En la realidad**:
- **30 de mayo de 2024:** fallo de su licitación (DOF).
- **19 de febrero de 2025:** la Presidenta lo da por concesionado a Proistmo y Profharmax, con
  Texistepec, Matías Romero y Mixtequilla.

En 2026 el Corredor reporta solo cinco polos del Istmo concesionados, sin decir cuáles. No se
ha reportado obra.

### Matías Romero Avendaño por dentro

El vigésimo polo con vista por dentro (`/mexico/polo/matias-romero`), del Corredor Interoceánico:
179.27 ha en Matías Romero Avendaño, Oaxaca, entre la línea Z y la MEX-185.

**El terreno**, de su declaratoria (DOF, 11 de octubre de 2023): un polígono en UTM zona 15 con cinco
curvas; el centro de cada una viene en el renglón que sigue al lado que dobla.
- **Resultado:** da 1,792,643 m² contra los 1,792,746 declarados (0.006 % menos). La tabla cierra con
  un vértice 1A cuyo norte está 57 km al sur (ver la [bitácora](#12-bitácora-de-correcciones-a-los-datos)).
- **El marcador:** el que el juego ya tenía cae dentro del terreno, a 1.4 km de su centro: el polo
  es una franja de 2.8 km de largo.

**Lo que dice la declaratoria**:
- **Conectividad:** aledaño a la línea Z y a unos 110 m de la MEX-185. El Corredor agrega que en el
  municipio se construye una nueva estación ferroviaria y su complejo logístico.
- **Vocaciones:** las mismas once de Coatzacoalcos I.
- **Propiedad:** el INDAABIN la aportó al Corredor Interoceánico (DOF, 23 de enero de 2023).

**Lo que es del juego**:
- **Los lotes:** la parte de uso industrial de Coatzacoalcos I (76.46 %): **137 ha en 10 lotes de 8
  a 20 ha**, con 3 ha de servicios a la entrada, del lado de la vía y la carretera.
- **Los empleos:** 61.2 por hectárea, 10,965. Un lote de 10 ha da 800 y pide de 0.6 MW
  (dispositivos médicos) a 5.5 MW (metálicas básicas).
- **La espuela:** la **Línea Z de Ferroistmo** pasa por su entrada: **0.03 km**, 2 millones con
  cuatro cuadrillas y el mínimo de 2 meses.
- **La energía:** no tiene cifra oficial: la mediana, **8 MW** (estimación del juego). Lleno pide
  17.5 MW: un banco de la CFE. La línea de 115 kV más cercana queda a 0.41 km de su subestación
  (OpenStreetMap).
- **Los frentes:** son los de Huamantla. Su obra completa cuesta 984 millones con una
  cuadrilla; las vialidades, 394 millones en 13.8 meses, o 571 en 4.9 con cuatro.

**En la realidad**:
- **30 de octubre de 2023:** el Corredor publica la convocatoria a su licitación internacional.
- **19 de febrero de 2025:** la Presidenta lo da por concesionado a Proistmo y Profharmax, con
  Texistepec, San Juan Evangelista y Mixtequilla.

En 2026 el Corredor reporta solo cinco polos del Istmo concesionados, sin decir cuáles. No se
ha reportado obra.

### Santa María Mixtequilla por dentro

El vigesimoprimer polo con vista por dentro (`/mexico/polo/mixtequilla`), del Corredor
Interoceánico: 502.43 ha en Santa María Mixtequilla, Oaxaca, en el cruce de la MEX-185D con la
MEX-190D.

**El terreno**, de su declaratoria (DOF, 11 de octubre de 2023): 113 vértices en coordenadas TME
(Transversal Modificado Ejidal), con meridiano central 95°15' O y factor de escala 1.0, según la nota
de su cuadro.
- **La conversión:** con ese meridiano, su borde corre 3.7 km sobre la MEX-190D y casi 1 km sobre
  la MEX-185D de OpenStreetMap, como dice la declaratoria (2.8 y 1.5 km de frente). El juego lo
  pasa a UTM zona 15; ahí mide 502.74 ha, 0.06 % más, por la escala de UTM a 2.25° de su meridiano.
- **Resultado:** con el vértice 33 corregido (ver la
  [bitácora](#12-bitácora-de-correcciones-a-los-datos)), su cuadro da 5,024,261 m² contra los
  5,024,260 declarados.
- **El marcador:** cae dentro del terreno, a 506 m de su centro.

**Lo que dice la declaratoria**:
- **Conectividad:** a 4.6 km de la línea Z, con unos 1.5 km de frente a la MEX-185D (Salina
  Cruz–La Ventosa) y 2.8 km a la MEX-190D (Mitla–Tehuantepec), a 33 km del aeropuerto de Ixtepec.
- **Vocaciones:** las mismas once de Coatzacoalcos I.
- **Propiedad:** se expropió a la comunidad de Santa María Mixtequilla a favor del Corredor
  Interoceánico (DOF, 2 de febrero de 2023).

**Lo que es del juego**:
- **Los lotes:** la parte de uso industrial de Coatzacoalcos I (76.46 %): **380 ha en 14 lotes de 10
  a 40 ha**, con 5 ha de servicios a la entrada.
- **Los empleos:** 61.2 por hectárea, 30,731. Un lote de 10 ha da 809 y pide de 0.6 MW
  (dispositivos médicos) a 5.6 MW (metálicas básicas).
- **La espuela:** la **Línea Z de Ferroistmo** queda a **4.5 km** en línea recta. Cuesta 204
  millones con una cuadrilla (5.6 meses) o 296 con cuatro (2 meses).
- **La energía:** no tiene cifra oficial: la mediana, **8 MW** (estimación del juego). Lleno pide
  49.2 MW: 2 bancos de la CFE. OpenStreetMap no tiene líneas ni subestaciones a menos de 5 km: la
  línea de 115 kV más cercana queda a 8.48 km de su subestación, y la vista se abre hasta ella.
- **Los frentes:** son los de Huamantla. Su obra completa cuesta 2,758 millones con una
  cuadrilla; las vialidades, 1,103 millones en 18.8 meses, o 1,600 en 6.7 con cuatro.

**En la realidad**:
- **30 de octubre de 2023:** el Corredor publica la convocatoria a su licitación internacional.
- **19 de febrero de 2025:** la Presidenta lo da por concesionado a Proistmo y Profharmax, con
  Texistepec, San Juan Evangelista y Matías Romero.

En 2026 el Corredor reporta solo cinco polos del Istmo concesionados, sin decir cuáles. No se
ha reportado obra.

### Ciudad Ixtepec por dentro

El vigesimosegundo polo con vista por dentro (`/mexico/polo/ciudad-ixtepec`), del Corredor
Interoceánico: 412.54 ha en Ciudad Ixtepec, Oaxaca, junto a la MEX-185D.

**El terreno**, de su declaratoria (DOF, 11 de octubre de 2023): 150 vértices en coordenadas TME.
- **La conversión:** su nota da el mismo meridiano que la de Mixtequilla, 95°15' O, pero con él
  queda 17.7 km al oeste de su croquis. El juego usa el meridiano 95.0828° O, que
  pone 2.2 km de su borde sobre la MEX-185D de OpenStreetMap (la declaratoria dice 1.5 km de
  frente), y lo pasa a UTM zona 15.
- **Resultado:** con dos vértices corregidos (ver la
  [bitácora](#12-bitácora-de-correcciones-a-los-datos)), su cuadro da 4,125,444 m², lo declarado.
- **El marcador:** cae dentro del terreno, a 446 m de su centro.

**Lo que dice la declaratoria**:
- **Conectividad:** a 3.5 km de la línea Z, con unos 1.5 km de frente a la MEX-185D y cerca de la
  carretera estatal Ixtepec–Guevea de Humboldt (la OAX 49).
- **Vocaciones:** las mismas once de Coatzacoalcos I.
- **Propiedad:** se expropió a la comunidad de Ciudad Ixtepec a favor del Corredor Interoceánico
  (DOF, 2 de febrero de 2023).

**Lo que es del juego**:
- **Los lotes:** la parte de uso industrial de Coatzacoalcos I (76.46 %): **315 ha en 13 lotes de 10
  a 40 ha**, con 4 ha de servicios a la entrada, del lado de la MEX-185D.
- **Los empleos:** 61.2 por hectárea, 25,233. Un lote de 10 ha da 801 y pide de 0.6 MW
  (dispositivos médicos) a 5.5 MW (metálicas básicas).
- **La espuela:** la **Línea Z de Ferroistmo** queda a **3.22 km** en línea recta (el DOF dice 3.5).
  Cuesta 146 millones con una cuadrilla (5.6 meses) o 212 con cuatro (2 meses).
- **La energía:** no tiene cifra oficial: la mediana, **8 MW** (estimación del juego). Lleno pide
  40.4 MW: 2 bancos de la CFE. OpenStreetMap no tiene líneas ni subestaciones a menos de 5 km: la
  línea de 115 kV más cercana queda a 7.41 km de su subestación.
- **Los frentes:** son los de Huamantla. Su obra completa cuesta 2,265 millones con una
  cuadrilla; las vialidades, 906 millones en 17.8 meses, o 1,314 en 6.3 con cuatro.

**En la realidad**:
- **30 de octubre de 2023:** el Corredor publica la convocatoria a su licitación internacional.
- **30 de noviembre de 2023:** se cancela su licitación (DOF).

No se ha reportado otra licitación ni obra.

### Asunción Ixtaltepec por dentro

El vigesimotercer polo con vista por dentro (`/mexico/polo/ixtaltepec`), del Corredor
Interoceánico: 246.08 ha en Asunción Ixtaltepec, Oaxaca, con unos 2 km de frente a la MEX-185.

**El terreno**, de su declaratoria (DOF, 16 de octubre de 2023): cuatro polígonos en UTM zona 15 (ver
[Un polo en varias piezas](#un-polo-en-varias-piezas)).
- **A:** 10.68 ha.
- **B:** 145.42 ha menos el derecho de vía de Pemex (0.48 ha), que lo cruza y le deja una esquina de
  2.18 ha; en el juego, el resto (142.77 ha) lleva lotes y la esquina queda de reserva.
- **C:** 78.19 ha.
- **Adyacente:** 12.27 ha, pegado al B.
- **Resultado:** con dos vértices del B corregidos (ver la
  [bitácora](#12-bitácora-de-correcciones-a-los-datos)), cada tabla da su área y el polo suma
  2,460,807 m² contra los 2,460,802 declarados.
- **El marcador:** cae dentro del terreno.

**Lo que dice la declaratoria**:
- **Conectividad:** a 1 km de la línea Z, con unos 2 km de frente a la MEX-185, a 47 km del
  aeropuerto de Ixtepec.
- **Vocaciones:** las mismas once de Coatzacoalcos I.
- **Propiedad:** el 95.01 % es del Corredor Interoceánico; del resto dice que «es viable para su
  consideración en la presente Declaratoria».

**Lo que es del juego**:
- **Los lotes:** la parte de uso industrial de Coatzacoalcos I (76.46 %): **187 ha en 16 lotes de 4
  a 20 ha**, con 4 ha de servicios a la entrada del polígono B. Cada polígono lleva su calle.
- **Los empleos:** 61.2 por hectárea, 15,051. Un lote de 10 ha da 805 y pide de 0.6 MW
  (dispositivos médicos) a 5.6 MW (metálicas básicas).
- **La espuela:** la **Línea Z de Ferroistmo** queda al oeste: **0.99 km**. Cuesta 45 millones con
  una cuadrilla (5.6 meses) o 65 con cuatro (2 meses).
- **La energía:** no tiene cifra oficial: la mediana, **8 MW** (estimación del juego). Lleno pide
  24.1 MW: un banco de la CFE. La línea de 400 kV más cercana queda a 0.04 km de su subestación
  (OpenStreetMap).
- **Los frentes:** son los de Huamantla. Su obra completa cuesta 1,351 millones con una
  cuadrilla; las vialidades, 540 millones en 15.2 meses, o 784 en 5.4 con cuatro.

**En la realidad**:
- **10 de septiembre de 2024:** fallo de su licitación (DOF).

En 2026 el Corredor reporta solo cinco polos del Istmo concesionados, sin decir cuáles. No se
ha reportado obra.

### Economía Circular Puebla por dentro

El vigesimocuarto polo con vista por dentro (`/mexico/polo/circular-puebla`) y el primero de
economía circular, de la Semarnat: 40.43 ha en San José Chiapa, Puebla, junto a la planta de Audi
y a 80 m del polo Capital de la Tecnología.

**El terreno**, de su declaratoria (DOF, 2 de marzo de 2026): tres polígonos en UTM zona 14, dos
llamados BET (28.42 y 5.23 ha) y uno CERHAN (6.78 ha).
- **Resultado:** cada tabla da su área; suman exactamente las 40.4280 ha declaradas.
- **El marcador:** queda a 232 m del centro del terreno.

**Lo que dice la declaratoria**:
- **Conectividad:** sus vialidades son el Boulevard Industria Automotriz, la carretera
  Teziutlán–Acajete, la autopista Cuapiaxtla–Cuacnopalan y el Circuito Audi, y cuenta con agua,
  drenaje, electricidad y telecomunicaciones. No habla de vías.
- **Vocaciones:** no las enumera: el polo es para empresas de economía circular, que aprovechan
  residuos.
- **Propiedad:** el Gobierno de Puebla, que lo propuso.

**Lo que es del juego**:
- **Los lotes:** la parte de uso industrial de Coatzacoalcos I (76.46 %): **31 ha en 8 lotes de 2 a 8 ha**, con 1.5 ha de servicios en el
  polígono 1. Cada polígono lleva su calle.
- **Los sectores:** las industrias que usan material reciclado como materia prima: plástico y hule,
  papel y cartón, y metálicas básicas, con chatarra de fierro (estimación del juego).
- **Los empleos:** 61.2 por hectárea, 2,473. Un lote de 8 ha da 638 y pide de 1.3 MW (plástico) a
  4.4 MW (metálicas básicas).
- **La espuela:** la **Línea VB de Ferrosur** queda a **0.46 km**. Cuesta 21 millones con una
  cuadrilla (5.6 meses) o 30 con cuatro (2 meses).
- **La energía:** no tiene cifra oficial: la mediana, **8 MW** (estimación del juego). Lleno pide
  4.0 MW: alcanza. La línea de 230 kV más cercana queda a 1.1 km de su subestación (OpenStreetMap).
- **Los frentes:** son los de Huamantla. Su obra completa cuesta 222 millones con una cuadrilla;
  las vialidades, 89 millones en 8.9 meses, o 129 en 3.1 con cuatro.

**En la realidad**: declarado el 2 de marzo de 2026 (DOF). No se ha reportado obra.

### Economía Circular Tlaxcala por dentro

El vigesimoquinto polo con vista por dentro (`/mexico/polo/circular-tlaxcala`), de economía
circular, de la Semarnat: 20 ha en la ex hacienda de San Pedro Ecatepec, Atlangatepec, Tlaxcala.

**El terreno**, de su declaratoria (DOF, 8 de junio de 2026): dos polígonos de 10 ha en UTM zona 14.
- **Resultado:** cada tabla da su área; suman las 20.00014 ha declaradas.
- **El marcador:** el que el juego ya tenía cae dentro del terreno.

**Lo que dice la declaratoria**:
- **Conectividad:** «cerca de localidades y con accesibilidad funcional dentro de la región»; no
  nombra carreteras ni vías. En OpenStreetMap solo hay caminos sin número a su alrededor.
- **Vocaciones:** no las enumera, como la de Puebla.
- **Propiedad:** el Fideicomiso de la Ciudad Industrial de Xicoténcatl, del Gobierno de Tlaxcala,
  por una donación.

**Lo que es del juego**:
- **Los lotes:** la parte de uso industrial de Coatzacoalcos I (76.46 %): **15 ha en 4 lotes de 3 y 4 ha**, con 1 ha de servicios.
- **Los sectores:** los mismos que en Puebla (estimación del juego).
- **Los empleos:** 61.2 por hectárea, 1,223. Un lote de 4 ha da 326 y pide de 0.7 MW (plástico) a
  2.2 MW (metálicas básicas).
- **La espuela:** la **Línea V de CPKC** queda a **0.46 km**. Cuesta 21 millones con una cuadrilla
  (5.6 meses) o 30 con cuatro (2 meses).
- **La energía:** no tiene cifra oficial: la mediana, **8 MW** (estimación del juego). Lleno pide
  2.0 MW: alcanza. La línea de 230 kV más cercana queda a 0.92 km de su subestación
  (OpenStreetMap).
- **Los frentes:** son los de Huamantla. Su obra completa cuesta 110 millones con una cuadrilla;
  las vialidades, 44 millones en 7.2 meses, o 64 en 2.5 con cuatro.

**En la realidad**: declarado el 8 de junio de 2026 (DOF). No se ha reportado obra.

### Capital de la Tecnología y la Sostenibilidad por dentro

El vigesimosexto polo con vista por dentro (`/mexico/polo/capital-tecnologia`), del Plan México:
217.68 ha en San José Chiapa y Nopalucan, Puebla, junto a la planta de Audi.

**El terreno**, de su declaratoria (DOF, 1 de julio de 2025): cinco cuadros en UTM zona 14, con el
norte antes que el este.
- **Las piezas:** al norte, el Rancho de Lima (63.63 ha), el Rancho Minillas (65.62) y la Parcela 423
  (18.24); 5 km al suroeste, las superficies A (58.06) y B (12.16) del polígono sur.
- **Resultado:** cada tabla da su área y suman 217.71 ha. La declaratoria decía 275.2; su nota
  aclaratoria (DOF, 29 de julio de 2025) las corrige a 217.68 (ver la
  [bitácora](#12-bitácora-de-correcciones-a-los-datos)).
- **El marcador:** cae dentro del terreno, en el grupo norte, a 5 km del centro de la vista.

**Lo que dice la declaratoria**:
- **Conectividad:** cerca de la autopista Amozoc–Perote y del Arco Norte, a menos de 70 km de la
  ciudad de Puebla. Ya dispone de vialidades, energía, agua, drenaje y conectividad. No habla de
  vías.
- **Vocaciones:** manufactura avanzada, automotriz, textil especializada, electrónica, química, y
  plástico y hule.
- **Propiedad:** sus predios están en un fideicomiso bajo control del Gobierno de Puebla.

**Lo que es del juego**:
- **Los lotes:** la parte de uso industrial de Coatzacoalcos I (76.46 %): **165 ha en 17 lotes de 4 a
  15 ha**, con 4 ha de servicios en el Rancho de Lima. Cada polígono lleva su calle.
- **Los empleos:** 61.2 por hectárea, 13,314. Un lote de 10 ha da 807 y pide de 0.9 MW
  (electrónica) a 1.7 MW (plástico y hule).
- **La espuela:** la **Línea VB de Ferrosur** toca el polígono sur: **0 km**, sin costo.
- **La energía:** no tiene cifra oficial del polo: la mediana, **8 MW** (estimación del juego). Lleno
  pide 21.3 MW: un banco de la CFE. La línea de 230 kV más cercana queda a 2.34 km de su
  subestación (OpenStreetMap).
- **La subestación de Puebla:** el estado construye en San José Chiapa una de 60 MVA para el polo y
  la fábrica de baterías de Olinia. El juego aún no la cuenta como cifra del polo: hacerlo cambiaría
  la mediana de las cifras oficiales, y con ella la energía de los polos que no tienen cifra.
- **Los frentes:** son los de Huamantla. Su obra completa cuesta 1,195 millones con una cuadrilla;
  las vialidades, 478 millones en 14.7 meses, o 693 en 5.2 con cuatro.
- **Las vocaciones en sectores:** la automotriz es el equipo de transporte; la electrónica, el equipo
  de computación y electrónico, y la química, la de fertilizantes, pinturas y jabones. La manufactura
  avanzada no es un sector del censo.

**En la realidad**:
- **21 de noviembre de 2025:** el Gobierno de Puebla construye la subestación de San José Chiapa,
  de 60 MVA, con 591 millones de pesos del estado.
- **30 de junio de 2026:** el gobernador recorre la subestación, para el polo, la industria del Café
  y Maíz del Bienestar y la fábrica de Olinia.

No se han reportado empresas en el polo.

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

**En el mapa.** El panel de vías, abajo junto a la columna de capas, cambia el color de la red:
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
18 puertos, las 2 salidas al mundo y los 4 complejos de plataformas (276 rutas):

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
   los primeros y últimos 8 km (la entrada a cada puerto) y del Canal, **ninguna de las 276
   rutas pisa tierra**.

### Cifras

| | |
| --- | --- |
| Rutas | 276 (todas las parejas de 24 puntos) |
| Pasan por el Canal de Panamá | 143 (las que unen el Pacífico con el Golfo o con la salida a Europa) |
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
| Barco abastecedor | 12 nudos (22 km/h) | 8 |

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
| Bahía de Banderas | Ro-ro de autos | Lázaro Cárdenas → Veracruz → Shanghái → Lázaro Cárdenas, de costa a costa por Panamá | 37,888 km | 15,074 km | 51.2 d |
| Laguna de Términos | Granelero | Guaymas → Shanghái → Guaymas | 25,838 km | 3,024 km | 48.2 d |

"Por vuelta" es todo el circuito, travesías incluidas; "en el tablero", la parte entre las
salidas al mundo. El ciclo completo suma la navegación y todas las escalas. Una escala en
"Asia" o "Europa" es una escala en Shanghái o Róterdam. Qué representan:

- **Mar de Cortés y Cabo Corrientes**: las líneas regulares de contenedores, que escalan donde
  esos tráficos escalan en la realidad (Asia en Manzanillo y Lázaro Cárdenas; Europa en
  Veracruz y Altamira). Traen importaciones y se llevan exportaciones (ver
  [El comercio por mar](#el-comercio-por-mar)).
- **Arrecife Alacranes**: la distribución de combustibles por la costa del Pacífico desde la
  refinería de Salina Cruz. Sale cargado con lo que le sobra a Salina Cruz (ver
  [Los combustibles](#los-combustibles)).
- **Isla Tiburón**: el reparto de combustibles por el Golfo. Empieza vacío: en 2018 ni Minatitlán
  ni Dos Bocas tenían qué mandar. Se llena cuando opera la Olmeca o cuando a la zona del centro le
  sobra combustible.
- **Diez barcos abastecedores** llevan el abasto a los complejos de plataformas desde Dos Bocas y
  Ciudad del Carmen (ver [Las plataformas del Golfo](#las-plataformas-del-golfo)).
- **Bahía de Banderas**: trae autos de Asia a los dos litorales y se lleva carga general de
  Lázaro Cárdenas y Veracruz. De un litoral al otro va por el Canal, el rodeo largo que el
  corredor del Istmo existe para acortar. Hasta el 22 de noviembre de 2026 iba y venía entre
  Lázaro Cárdenas y Veracruz sin tocar una salida al mundo; ahora sigue a Shanghái, porque
  entre puertos del país sería cabotaje, y el cabotaje aún no cuenta.
- **Laguna de Términos**: graneles minerales y agrícolas de Sonora hacia Asia.

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
- **Bahía de Banderas**: Lázaro Cárdenas–Veracruz 5,698 km (7.5 d) · Veracruz–Shanghái 18,917
  km (24.0 d, de ellos 11,407 km de travesía; sale por Panamá) · Shanghái–Lázaro Cárdenas 13,273
  km (16.6 d).
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

**Lo que piden los polos.** Siete tienen cifra oficial. Las declaratorias dan lo que pedirán y el
portal de Economía lo que tendrán disponible, siempre en su primera fase; el juego toma una u
otra como la electricidad del polo:

| Polo | Hectáreas | MW | MW por hectárea | De dónde |
| --- | ---: | ---: | ---: | --- |
| Reserva Zapotlán | 910.8 | 20 | 0.022 | Declaratoria (DOF): «en su etapa madura… una demanda de electricidad de 20 MW»; portal de Economía: «producción desde 20 MW en primera fase». |
| Hermosillo | 546.5 | 7 | 0.013 | Declaratoria (DOF): «una demanda de electricidad de 1 MW a 7 MW de 2026 a 2030». |
| Parque Industrial Bajío | 342.1 | 12.9 | 0.038 | Portal de Economía: «Energía: 12.9 MW disponible (hidroeléctrica y geotérmica)». |
| Tuxpan | 235.1 | 4 | 0.017 | Declaratoria (DOF): «en su etapa madura… una demanda de electricidad de 4 MW». |
| Nezahualcóyotl | 68.4 | 7.7 | 0.113 | Declaratoria (DOF): «crecimiento en su demanda de electricidad de 5 a 7.7 MW de 2027 a 2030». |
| San Jerónimo | 60.3 | 20 | 0.332 | Portal de Economía: «Energía: Disponibilidad de hasta 20MW». |
| Huamantla | 53 | 8 | 0.151 | Portal de Economía: «Energía: 8 MW». |

**La cifra no crece con la superficie.** Va de 4 a 20 MW en polos de 53 a 911 hectáreas. Por
hectárea cambia 25 veces de uno a otro, y su correlación con el tamaño es nula (0.10 en escala
logarítmica). Por eso **un polo sin cifra recibe la mediana de los siete: 8 MW**, sin importar
su tamaño (estimación del juego).

- **Antes** el juego daba a cada polo sin cifra 0.0257 MW por hectárea (la razón de los primeros
  cinco). Así Altamira (1,638 ha) pedía 42 MW y Arriaga (49 ha) 1.3, con una precisión que las
  cifras oficiales no sostienen.
- **Con el cambio**, los 32 polos juntos piden unos 280 MW: poco frente a una región. Lo que
  decide es el margen de la región, no el polo.
- **Adentro de un polo** la electricidad se cuenta por empleo (ver
  [Los lotes y sus empresas](#los-lotes-y-sus-empresas)). La cifra del polo es lo que da su
  subestación en su primera fase. Un polo grande lleno de empresas pediría mucho más de lo que su
  primera fase trae.

**En el mapa**, el botón *Energía* pinta cada estado con el nivel de su región y muestra las
centrales por tecnología (llenas las de la CFE, como anillo las privadas; punteadas las obras
en curso). Mulegé se pinta aparte, con una línea punteada donde termina: su límite con Comondú
y Loreto, del Marco Geoestadístico del INEGI. Al pasar el cursor por un estado, su región (o
Mulegé) dice sus márgenes y su demanda; por una central, su capacidad, dueño y fecha. La ficha de cada polo dice si su región tiene energía.

### El petróleo

La segunda capa de la energía son las refinerías de Pemex. El juego mide lo que el gobierno se
propuso arreglar: **cuánto crudo refina el país** (en miles de barriles diarios, Mbd) y **qué
parte de la gasolina, el diésel y la turbosina que usa hace él mismo**. Lo demás se importa.

**Cómo estaban en 2018.** Las seis refinerías del Sistema Nacional de Refinación procesaron
611.9 Mbd de 1,640 de capacidad: el 37 %. Madero y Minatitlán casi no trabajaban (Pemex, 20-F
2018). El Programa de Rehabilitaciones empezó en septiembre de 2019 (Pemex, 20-F 2019).
Requería 65,692 millones de pesos de 2019 a 2021, pero se le dieron 27,425, el 41.7 %, y cubrió
el 29.7 % de las reparaciones mayores (ASF). En mayo de 2022 cada refinería declaró a la ASF su
**capacidad óptima**, lo que puede procesar con sus plantas en orden. Eso es lo que el juego
alcanza al rehabilitarla:

| Refinería | Lugar | Capacidad (Mbd) | Proceso 2018 | Del total | Capacidad óptima | Rehabilitarla cuesta |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Cadereyta | Nuevo León | 275 | 118.0 | 43 % | 180 | 6,742 millones |
| Madero | Tamaulipas | 190 | 19.2 | 10 % | 120 | 10,961 millones |
| Minatitlán | Veracruz | 285 | 26.2 | 9 % | 246 | 23,902 millones |
| Salamanca | Guanajuato | 245 | 140.5 | 57 % | 170 | 3,208 millones |
| Salina Cruz | Oaxaca | 330 | 165.2 | 50 % | 260 | 10,309 millones |
| Tula | Hidalgo | 315 | 142.8 | 45 % | 240 | 10,570 millones |

**Las obras de Pemex** (en el catálogo, en su propia sección):

- **Rehabilitar** cada una de las seis lleva su proceso de lo de 2018 a su capacidad óptima,
  conforme avanza la obra. Cuesta lo que el programa 2019–2021 requería repartido por lo que
  recupera cada una: unos 109 millones de pesos por cada mil barriles diarios recuperados, una
  **estimación del juego** con cifras oficiales. Tarda 36 meses con 4 cuadrillas, lo que se
  planeó que durara el programa.
- **La refinería Olmeca** (Dos Bocas): 16,816 millones de dólares de inversión actualizada a
  marzo de 2024 (Presidencia), 308 mil millones de pesos. Tarda 60 meses, del arranque de la obra
  (2 de junio de 2019) a su arranque como refinería (junio de 2024). Terminada, procesa 263 Mbd,
  su mejor mes: diciembre de 2025, el 77 % de su capacidad (Segundo Informe de Gobierno).
- **Las coquizadoras** convierten el combustóleo que sobra en gasolina y diésel. La de **Tula**
  cuesta 5,146 millones de dólares y suma 80 Mbd de combustibles; tarda 36 meses, de los
  acuerdos del 1 de julio de 2022 a su puesta en marcha en julio de 2025. La de **Salina Cruz**
  cuesta 3,501 millones de dólares y suma 74 Mbd; el Plan de Trabajo 2025–2030 la esperaba en
  2026, así que el juego cuenta 53 meses. En 2018 la de Tula estaba 63 % construida y suspendida
  por falta de presupuesto (Pemex, 20-F 2020).
- **Deer Park**, en Texas: desde 1993 Pemex tiene el 49.995 % y Shell el resto. Lo que produce no
  cuenta para el país hasta **comprar la parte de Shell**: 23 mil millones de pesos de la caja de
  Pemex, de una vez. Es lo que el Gobierno Federal transfirió para esa compra: 596 millones de
  dólares por las acciones y otros 596 por la deuda que le tocaba a Pemex (Pemex, comunicado
  6/2022; Presidencia). Ya comprada, se puede **mejorar su confiabilidad**: de 267 a 309 Mbd, lo
  que procesó de enero a septiembre de 2026, 15.6 % más que cuando la compró (Pemex, comunicado
  87/2026). No hay un costo oficial: el juego usa el mismo costo por barril recuperado (4,567
  millones) y un año de obra, **estimaciones del juego**.

Los costos en dólares se pasan a pesos a 18.33, el promedio de 2024.

**Los combustibles.** Cada refinería da gasolina, diésel y turbosina por barril de crudo:

- **Las seis:** 0.55. Es un cálculo del juego: 1,933 Mbd producidos sobre 3,503 procesados de
  2019 a 2023, con cifras de Presidencia.
- **La Olmeca:** 0.844. Sus 340 Mbd sustentan 165 de gasolina y 122 de diésel (Informe Anual
  2023 de Pemex).
- **Deer Park:** 0.93. En 2023 sacó 239 Mbd de combustibles de 259 de crudo, y en 2026, 289 de
  309; también procesa otros insumos.

El consumo del país queda fijo en el de diciembre de 2018: 1,231 Mbd, los 304 que hacía el
sistema más los 927 que se importaban (Presidencia).

| | Crudo en México (Mbd) | Combustibles (Mbd) | Del consumo |
| --- | ---: | ---: | ---: |
| Al empezar la partida | 612 | 337 | 27 % |
| Todo hecho, sin Deer Park | 1,479 | 1,045 | 85 % |
| Todo hecho, con Deer Park | 1,479 | 1,332 | 108 % |

Cálculos del juego. En la realidad, el sistema con la Olmeca procesó 1,015 Mbd en 2025.

**La caja de Pemex.** Pemex paga sus obras con lo que el Gobierno Federal le transfiere para
refinación, aparte del presupuesto de trenes y de la caja de la CFE:

- **De 2019 a 2024:** 6,109 millones al mes. De enero de 2019 a abril de 2024 le transfirió 391
  mil millones de pesos para infraestructura: 320 para la Olmeca, 48 para las refinerías y los
  fertilizantes y 23 para Deer Park (Presidencia). Son 64 meses; el juego sigue a ese paso hasta
  diciembre de 2024.
- **Desde 2025:** 2,181 millones al mes. El Plan de Trabajo 2025–2030 destina 105 mil millones
  a rehabilitar las seis refinerías y 52 mil millones a las coquizadoras (Pemex, comunicado
  9/2025).

Todas las obras juntas cuestan más de lo que llega. Hacerlo todo pide escoger un orden, como
pasó en la realidad.

**En el mapa**, el botón *Refinerías* muestra cada una como una gota, del tamaño del crudo que
procesa. La Olmeca está hueca y punteada hasta que opera. Deer Park está tenue mientras sea de
los dos socios. Al pasar el cursor, cada refinería dice su proceso, su parte de la capacidad, sus
combustibles y sus obras; un clic abre su ficha en el catálogo.

**La barra de arriba** junta las cajas de la CFE y de Pemex en una celda de dos líneas. Una
celda *Refinación* dice el crudo y qué parte de los combustibles que usan los estados llegó del
país (ver [Los combustibles](#los-combustibles)).

**En Realidad**, la ficha y el cursor dicen lo que cada refinería procesó de verdad:

- **De 2018 a 2020**, por año (Pemex, 20-F).
- **2021:** la capacidad que usaron sus plantas primarias (ASF).
- **De octubre de 2024 a junio de 2026**, mes por mes, salvo julio y agosto de 2025 (Primer y
  Segundo Informe de Gobierno, con datos de Pemex).

De 2022 a septiembre de 2024 no hay cifras publicadas por refinería en las fuentes consultadas,
solo del sistema, y la ficha lo dice. Las de Pemex no se pueden bajar automáticamente.

La barra da el total de cada año:

| Año | Crudo procesado (Mbd) | Fuente |
| --- | ---: | --- |
| 2018 | 611.9 | Pemex, 20-F |
| 2019 | 592.0 | Pemex, 20-F |
| 2020 | 590.6 | Pemex, 20-F |
| 2021 | 711.6 | ASF |
| 2022 | 815.8 | Pemex, Informe Anual 2023 |
| 2023 | 792.0 | Pemex, Informe Anual 2023 |
| 2024 | 906 | Pemex, comunicado 11/2025 (con la Olmeca) |
| 2025 | 1,014.9 | Promedio de los diez meses de los Informes de Gobierno (faltan julio y agosto) |
| 2026 | 1,075.3 | Enero a junio, Segundo Informe de Gobierno |

Las obras de Pemex tienen su etapa real:

- **Las seis rehabilitaciones:** en obra desde septiembre de 2019, y siguen.
- **La Olmeca:** autorizada el 7 de diciembre de 2018, en obra desde el 2 de junio de 2019, en
  operación desde junio de 2024.
- **La coquizadora de Tula:** en obra desde julio de 2022, en operación desde julio de 2025.
- **La de Salina Cruz:** en obra, con 80.1 % de avance en junio de 2026.
- **Deer Park:** de Pemex desde el 20 de enero de 2022.

### Los ductos

El botón *Ductos* del tablero dibuja tres redes:

- **los gasoductos**, en verde;
- **los poliductos de Pemex**, que llevan gasolina, diésel y turbosina, en el café dorado de las refinerías;
- **el oleoducto de crudo** Nuevo Teapa–Salina Cruz, en un café más oscuro.

Los trazos son aproximados, como los publicó la Comisión Nacional de Hidrocarburos (CNH) con
información de la SENER, el CENAGAS, la CRE y la CFE. Un gasoducto en obra va punteado; uno fuera
de operación, punteado y tenue. Los de importación, del lado de Estados Unidos, van tenues.

**El gas.** En 2024 la red de transporte de gas natural tenía 21,149 km (SENER):

- **El SISTRANGAS**, el único sistema integrado, suma 9,732 km: 8,386 del Sistema Nacional de
  Gasoductos, del Estado, y 1,346 de privados integrados (Los Ramones, Morelos, Tamaulipas,
  Bajío, Zacatecas).
- **El CENAGAS** opera 8,741 km, y el 94 % tiene más de 45 años.
- **El resto** son gasoductos privados que contrató sobre todo la CFE para sus centrales.

El tablero traza unos 16,700 km en México.

**Lo que llegó después de 2018.** Casi todos los gasoductos de estos años los construyeron
transportistas privados con contratos de la CFE. En el juego llegan en su fecha real, como las
centrales privadas, y en Realidad se ven en su etapa.

| Gasoducto | Km | Millones de pies cúbicos diarios | Llegó | Fuente |
| --- | ---: | ---: | --- | --- |
| Sur de Texas–Tuxpan (marino) | 800 | 2,600 | 17 de septiembre de 2019 | Proyectos México; CFE |
| La Laguna–Aguascalientes | 452 | 1,189 | 22 de junio de 2019 | Proyectos México |
| Villa de Reyes–Aguascalientes–Guadalajara | 374 | 886 | 1 de octubre de 2020 | La Jornada, con la CFE y Fermaca |
| Samalayuca–Sásabe | 614 | 472 | febrero de 2021 | Proyectos México |
| Puerta al Sureste (Tuxpan–Coatzacoalcos–Paraíso, marino) | 707 | 1,348 | mayo de 2025 | CFE |
| Tuxpan–Tula | 276 | 886 | sin terminar | CFE |
| Tula–Villa de Reyes | 438 | 886 | sin terminar | CFE |
| Centauro del Norte (Sásabe–San Luis Río Colorado–Mexicali) | 442 | 400 | en obra: 7.12 % en agosto de 2026 | CFE; SENER |
| Cuxtal II (ampliación del Mayakan) | 695 | 547 | fase I en diciembre de 2024; el resto, en el segundo semestre de 2027 | CFE; SENER |

Lo demás de esos años:

- **El Encino–Topolobampo y El Encino–La Laguna** entraron en 2018, antes de la partida, y ya
  están desde el principio.
- **Guaymas–El Oro** está fuera de operación desde 2017 por el conflicto con la comunidad yaqui
  de Loma de Bácum; la CFE planea rodearla con un nuevo trazo para 2029.
- **Tuxpan–Tula y Tula–Villa de Reyes** siguen sin un tramo por Puebla e Hidalgo; la CFE busca
  una ruta alterna.
- **Puerta al Sureste y Centauro del Norte** son alianzas en las que la CFE es socia: en la
  primera aportó 340 millones de dólares y 71 en especie, el 13.01 % de las acciones.
- **Los trazos de Puerta al Sureste y Centauro del Norte** los dibuja el juego por los puntos
  que dicen las fuentes. El primero va por el mar, comprobado contra la costa del tablero.

**La península y el Cuxtal II.** A la península de Yucatán el gas solo le llega por el Mayakan:
240 millones de pies cúbicos diarios (CFE). En 2018 la región tenía 1,261 MW de ciclos combinados
(PRODESEN). Para saber cuánto gas queman se necesita el régimen térmico, y la CFE no publica el de
sus centrales. El juego usa los del gobierno de Estados Unidos: un ciclo combinado a plena carga
quema 7,627 Btu por kWh y un pie cúbico de gas da 1,037 Btu (EIA). Cada MW pide así 0.1765
millones de pies cúbicos diarios (cálculo del juego).

Con eso:

| | Millones de pies cúbicos diarios | Ciclos combinados nuevos que alcanzan gas |
| --- | ---: | ---: |
| Con el Mayakan | 240 | unos 99 MW |
| Lo que queman los ciclos de 2018 | 223 | |
| Con el Cuxtal II | 547 | unos 1,838 MW |

La regla del juego: en la península, **los ciclos combinados nuevos solo cuentan hasta donde les
alcanza el gas**. Los de la CFE son Mérida (499 MW) y Riviera Maya (1,020): sin el Cuxtal II
cuentan juntos 99 MW; con él, completos.

El Cuxtal II es la obra de gas del Estado en el catálogo, en la sección de energía:

- **Se paga** con la caja de la CFE.
- **Cuesta** unos 1,715 millones de dólares, estimación del juego: sus 695 km a 2.47 millones de
  dólares por km, el promedio de los siete gasoductos que la CNH registraba en construcción en
  2018 (8,657 millones en 3,507 km).
- **Tarda** unos 40 meses, también estimación: la CFE lo formalizó en 2024 y lo espera para el
  segundo semestre de 2027.

En Realidad la regla también aplica:

- **Hoy:** el ciclo combinado de Mérida entró en operación en mayo de 2026, pero el gas que
  duplica el Cuxtal II llega hasta 2027. Así que cuenta 99 de sus 499 MW, y el margen estimado
  de la península queda debajo del mínimo.
- **Lo que dice la CFE:** que a la península le falta gas. En 2024 subió 23 % el transporte de
  combustóleo a las centrales de Lerma, Mérida II y Valladolid, y rentó un buque tanque de
  contingencia en Progreso (Informe Anual 2024).

Solo la península tiene tope:

- **Baja California** recibe gas de Estados Unidos por el gasoducto Rosarito, de 1,434 millones de
  pies cúbicos diarios (CNH), más de lo que piden sus centrales. La CFE justifica el Centauro del
  Norte por precio («a precios competitivos»), no por falta.
- **El resto del país** se abastece del sistema nacional, y las fuentes oficiales no dan un tope
  por región. La CFE sí señaló en 2021 dónde faltaba gas: primero el sureste, luego el centro y
  el golfo, luego el centro-occidente, por los gasoductos atrasados.

**Los petrolíferos y el crudo.** Pemex tiene 8,926 km de poliductos, 5,777 de oleoductos y 73
terminales de almacenamiento (Proyectos México, 2026). Los ductos de petrolíferos sumaban 9,582
km y 4,586 Mbd autorizados en 2024 (SENER). Por ducto se mueve mucho más que por mar: en 2023
Pemex movió 2,082 Mbd por ducto y 166 en buque tanque. Por eso, en [Los
combustibles](#los-combustibles), lo que va por ducto llega solo, y los trenes y los barcos llevan
lo que sobra.

El tablero traza:

- **los poliductos del centro, el golfo y Chihuahua**, unos 4,200 km (CNH);
- **los demás poliductos del mapa de la SENER de 2018**, 25 líneas y 3,595 km. Las capas de la CNH
  no los traen, así que el juego los dibuja uniendo las terminales que el mapa dice que unen y los
  pueblos de en medio; la longitud y la capacidad son las de sus tablas. Son:
  - en el noroeste, los que salen de Rosarito (a Mexicali y Ensenada), de Guaymas (a Hermosillo y
    Ciudad Obregón) y de Topolobampo (a Culiacán, con el ramal a Guamúchil);
  - en el noreste, Cadereyta–Santa Catarina, Cadereyta–Reynosa–Brownsville, los dos Santa
    Catarina–Gómez Palacio con el ramal a Saltillo y Santa Catarina–Monclova–Sabinas;
  - en el occidente, los que salen de Salamanca a Irapuato (cinco, uno por producto), León,
    Morelia, Aguascalientes–Zacatecas y Guadalajara, con el ramal de Degollado a Zamora;
  - en el Golfo, Minatitlán–Salina Cruz, los tres de Minatitlán a Pajaritos, Minatitlán–Villahermosa
    y el ramal de Castañito a Dos Bocas;
  - en el sureste, los dos de Progreso a Mérida;
- **el oleoducto Nuevo Teapa–Salina Cruz** (OpenStreetMap).

En total, unos 7,800 km de petrolíferos, de los 9,582 que la SENER contaba en 2024. Faltan los
oleoductos troncales, que no están en las fuentes abiertas que se encontraron, y las líneas internas
de la refinería de Salina Cruz y los ramales de menos de 2 km del mapa de 2018, que no se verían.

**Cómo se generan.** Todo lo arma `scripts/ductos/gen-ductos.mjs`:

- **Lee** las capas descargadas una vez: las de la CNH y la de OpenStreetMap.
- **Escribe** `src/lib/domain/datos/ductos.json`, con las líneas, la obra y el gas de la península,
  y `ductos-real.json`, con las fechas reales de cada gasoducto posterior a 2018.

### Los combustibles

La gasolina, el diésel y la turbosina son carga. El juego mide **cómo le llegan al país**: de sus
refinerías, por ducto o en los trenes y buques tanque del jugador, o del extranjero. Producir no
basta: el combustible que una refinería hace de más tiene que llegar a donde falta.

**Lo que usa cada estado.** El país usa 1,231 Mbd, lo de diciembre de 2018 (el mismo consumo contra
el que se mide la refinación). Cada estado usa su parte de lo que se vendió de abril a diciembre de
2018 según la CNE: la gasolina y el diésel de sus gasolineras y la turbosina de sus aeródromos,
ponderados con lo que el país usó de cada uno ese año (787, 387 y 86 Mbd, SENER). Es una
**estimación del juego** con datos oficiales. Del diésel solo cuenta el que se vende en
gasolineras, el 60 % del total: el de la industria, la minería y el campo no está por estado.
Enero a marzo de 2018 se deja fuera porque al registro le faltan reportes del norte.

| Estado | Del país | Usa (Mbd) |
| --- | ---: | ---: |
| Estado de México | 10.6 % | 131 |
| Ciudad de México | 8.2 % | 101 |
| Jalisco | 7.8 % | 96 |
| Nuevo León | 5.2 % | 64 |
| Veracruz | 5.1 % | 62 |
| Guanajuato | 4.4 % | 54 |
| Baja California | 4.3 % | 53 |
| Chihuahua | 4.2 % | 52 |
| Tamaulipas | 3.5 % | 43 |
| Sonora | 3.5 % | 43 |

**Cómo se surte cada estado.** Sale del mapa de la SENER «Infraestructura Nacional de
Petrolíferos, 2018». Trae las 73 terminales de almacenamiento y las 5 terminales marítimas de
Pemex, cada una con su capacidad y su medio de suministro, y los poliductos de cada región con su
origen y destino. Con eso, cada terminal se surte de una de cinco maneras:

- **Por los ductos de una zona de refinerías.** Son tres zonas:
  - *Centro, Golfo y Occidente*: Tula, Salamanca y Minatitlán, unidas por sus poliductos
    (Tula–Salamanca, Minatitlán–México, Minatitlán–Puebla), con Tuxpan, la terminal de
    importación, a la cabeza del Tuxpan–Azcapotzalco y del Tuxpan–Tula.
  - *Noreste y Norte*: Cadereyta y Madero, unidas por su bidireccional. Por Santa Catarina–Gómez
    Palacio y Gómez Palacio–Chihuahua llegan a la Laguna y a Chihuahua.
  - *Salina Cruz*: surte por carretera a Oaxaca y Chiapas.
- **Por mar.** Las terminales que reciben buque tanque y las que se surten por ducto desde una
  terminal marítima: Mexicali y Ensenada desde Rosarito, Hermosillo y Ciudad Obregón desde
  Guaymas, Culiacán y Guamúchil desde Topolobampo, Mérida desde Progreso.
- **Por tren.** Durango y Ciudad Valles reciben carro tanque.
- **Por carretera.** La terminal que se surte en autotanque toma el medio de la terminal más
  cercana de su región que no se surte así; por ejemplo, Nogales y Magdalena de Hermosillo, y
  Tuxtla Gutiérrez y Tapachula de Salina Cruz.
- **Sin terminal.** Tlaxcala se surte de Puebla y Quintana Roo de Mérida.

Dentro de un estado, cada terminal pesa por su capacidad operativa, porque el mapa no da sus
ventas. El reparto es una **estimación del juego**:

| Zona | Refinerías | Estados (la parte que alcanzan sus ductos) | Usa (Mbd) |
| --- | --- | --- | ---: |
| Centro, Golfo y Occidente | Tula, Salamanca, Minatitlán (y Deer Park, por Tuxpan) | Aguascalientes, Ciudad de México, Estado de México, Guanajuato, Hidalgo, Jalisco, Michoacán (30 %), Morelos, Puebla, Querétaro, San Luis Potosí (46 %), Tabasco, Tlaxcala, Veracruz, Zacatecas | 651 |
| Noreste y Norte | Cadereyta, Madero | Chihuahua, Coahuila, Durango (87 %), Nuevo León, San Luis Potosí (17 %), Tamaulipas (98 %) | 214 |
| Salina Cruz | Salina Cruz | Chiapas, Oaxaca | 54 |
| Por mar | — | Baja California, Baja California Sur, Campeche, Colima, Guerrero, Michoacán (70 %), Nayarit, Quintana Roo, Sinaloa, Sonora, Yucatán | 297 |
| Por tren | — | Durango (13 %), San Luis Potosí (37 %), Tamaulipas (3 %) | 15 |

La Olmeca no tiene zona. Dos Bocas está unida a la red del Golfo por un ramal, pero en 2026 su
combustible sale sobre todo por mar: Dos Bocas mandó 4.24 millones de toneladas por cabotaje de
enero a octubre (SEMAR, cifras preliminares). En el juego todo lo que hace va a su patio.

**Cada hora del juego:**

1. **Ductos.** Lo que hacen las refinerías de una zona llega por ducto a sus estados, hasta lo que
   usan. Si la zona no alcanza, a todos les falta en la misma proporción.
2. **El patio.** Lo que la zona no usa espera en el patio de sus refinerías, repartido por lo que
   produce cada una. Cabe hasta 15 días de lo que produce la refinería; pasado eso, ya no tiene
   salida, y la barra lo avisa.
3. **Las terminales.** Lo que a un estado le falta lo cubre el combustible que tus trenes y buques
   tanque dejaron en sus terminales. Cuando se acaba, **se importa**.

Los 15 días son reglas del juego, no cifras oficiales.

**Los trenes y los buques tanque.**

- **Dónde cargan.** Las refinerías con estación son paradas de tren: Cadereyta, Madero,
  Minatitlán, Salamanca, Salina Cruz y Tula. La Olmeca queda a 88 km de la vía. Las de la costa
  cargan también en su puerto, trenes y buques tanque:
  - Salina Cruz en Salina Cruz;
  - Minatitlán en Coatzacoalcos (Pajaritos);
  - Madero en Tampico;
  - la Olmeca en Dos Bocas.
- **Cuánto cabe.**
  - Un tren lleva su carga neta promedio, 2,436 toneladas: unos **19,800 barriles** con los
    barriles por tonelada de la EIA (8.53 de gasolina, 7.46 de diésel, 7.93 de turbosina,
    ponderados por lo que usa el país). Las exportaciones van primero, luego el combustible, y la
    carga nacional llena lo que queda.
  - Un buque tanque lleva **320 mil barriles**, lo que carga uno de los de Pemex.
  - Solo los buques tanque llevan combustible; las demás clases todavía van vacías.
- **Dónde descargan.** En la primera parada cuyo estado tenga falta, hasta 15 días de lo que no le
  traen sus ductos, y nunca de vuelta en la refinería de donde salió. Progreso surte también a
  Campeche y Quintana Roo, y Mazatlán a Nayarit. Un vehículo lleva el combustible de una sola
  refinería a la vez.

**Cómo empieza la partida.** Las refinerías hacen 337 Mbd, el 27 % de lo que usa el país, y 299
llegan por ducto. Solo a la zona de Salina Cruz le sobra combustible, unos 37 Mbd. Lo llevan el
buque tanque *Arrecife Alacranes* por el Pacífico y el tren Coatzacoalcos ⇄ Salina Cruz por el
Istmo. El *Isla Tiburón* empieza vacío: en 2018 Minatitlán no tenía qué mandar, y el Golfo y la
península se surtían con importaciones. El país importa unos 895 Mbd.

Lo que se puede llegar a hacer (cálculos del juego):

| | Hacen las refinerías | Llega por ducto | Sobra para trenes y barcos | Importación mínima |
| --- | ---: | ---: | ---: | ---: |
| Al empezar (2018) | 337 (27 %) | 299 | 37 (Salina Cruz) | 895 |
| Todo rehabilitado, coquizadoras y Olmeca | 1,045 (85 %) | 660 | 385 (Salina Cruz 163, Olmeca 222) | 186 |
| Además, Deer Park comprado y mejorado | 1,332 (108 %) | 870 | 432 | 0 |

La importación mínima es la que queda si todo el sobrante llega a donde falta. Sin trenes ni buques
tanque, el sobrante se queda en los patios y la importación no baja.

**En la realidad**, Pemex movió en 2018 1,743 Mbd por ducto, 341 en autotanque, 77 en carro tanque y
183 en buque tanque, crudo y petrolíferos juntos (ASF). En buque tanque fueron 95.6 de gasolina, 62.9
de destilados y 20.8 de combustóleo. Tenía 16 buques tanque (2 propios), 1,485 autotanques y 511
carros tanque, y su flota podía mover 294 Mbd. Por puerto (SEMAR, millones de toneladas de petróleo
y derivados en 2018):

| Puerto | Recibió por cabotaje | Mandó por cabotaje | Importó |
| --- | ---: | ---: | ---: |
| Coatzacoalcos (con Pajaritos) | — | 3.73 | 11.27 |
| Salina Cruz | 0.01 | 3.55 | 0.03 |
| Progreso | 2.51 | — | 0.61 |
| Acapulco | 1.23 | — | — |
| Lázaro Cárdenas | 0.67 | 0.39 | 0.53 |
| Guaymas | 0.61 | — | 1.74 |
| Manzanillo | 0.56 | 0.05 | 2.60 |
| La Paz | 0.45 | — | 0.70 |
| Mazatlán | 0.43 | — | 1.98 |
| Topolobampo | 0.33 | 0.05 | 1.60 |
| Tuxpan | 0.04 | — | 10.13 |

Baja California recibe su combustible por la terminal de Rosarito, que no es puerto del tablero:
2.49 millones de toneladas importadas en 2018. En el juego, Ensenada la representa.

Por tren se movieron (ATTRAPI, millones de toneladas):

| | 2018 | 2025 |
| --- | ---: | ---: |
| Gasolina | 1.61 | 4.78 |
| Diésel | 3.19 | 3.04 |
| Combustóleo | 1.64 | 3.23 |

**El crudo.** La producción de crudo de Pemex sigue su serie real en los dos modos; de 2027 en
adelante se repite la de 2026. Lo que no procesan las refinerías del país se exporta, en los barcos
de los compradores. Al empezar se exportan 1,221 Mbd; en 2018 se exportaron de verdad 1,184.

| Año | Crudo producido | Crudo exportado | Combustibles que hizo Pemex | Combustibles que importó Pemex |
| --- | ---: | ---: | ---: | ---: |
| 2018 | 1,833 | 1,184 | 359 | 877 |
| 2019 | 1,701 | 1,103 | 363 | 749 |
| 2020 | 1,705 | 1,120 | 317 | 511 |
| 2021 | 1,756 | 1,018 | 379 | 462 |
| 2022 | 1,785 | 953 | 451 | 631 |
| 2023 | 1,875 | 1,033 | 424 | 616 |
| 2024 | 1,759 | 806 | 504 | 563 |
| 2025 | 1,636 | 581 | 627 | 435 |
| 2026 (enero a junio) | 1,655 | 453 | 697 | 400 |

Miles de barriles diarios; combustibles son gasolinas, diésel y querosenos (anexo estadístico del
Segundo Informe de Gobierno, SENER y Pemex). No incluye lo que importan los privados: en 2024 eran
cerca del 15 % de lo que se vende (SENER).

**En el mapa**, el botón *Combustibles* pinta cada estado según la parte de lo que usó este año que
vino del país, y dibuja las 78 terminales de Pemex en el color de cómo les llega el combustible:

- ámbar, por los ductos de una zona;
- azul, por mar;
- lila, por tren.

Al pasar el cursor:

- **un estado** dice lo que usa, cómo se surte, lo que le traen hoy sus ductos y lo que le falta;
- **una terminal** dice cómo se surte, según el mapa de la SENER;
- **un puerto** da su petróleo y derivados de 2018 (de 2024 en Realidad, desde ese año);
- **una refinería** dice cuánto espera en su patio.

La leyenda da las cifras del país en el año. La capa no se puede ver junto con la de Energía: las
dos pintan los estados. En Realidad no hay cifras por estado; la leyenda da las del país.

**La barra de arriba.** En la celda *Refinación*, la segunda línea dice qué parte de los
combustibles que usaron los estados este año vino del país. Al pasar el cursor da cuánto se
importó, cuánto llegó por ducto, en tren y en barco, y el crudo exportado. En Realidad dice qué
parte de lo que vendió Pemex hizo él mismo: lo que produjo entre lo que produjo más lo que importó.

**Las fichas** de cada tren y cada buque tanque dicen cuánto combustible llevan, de qué refinería y
cuánto han entregado.

**Lo que falta o es estimación:**

- **El consumo por estado:** el diésel de fuera de las gasolineras no está por estado.
- **El reparto entre terminales:** pesa por capacidad, porque el mapa no da sus ventas.
- **El buque de 320 mil barriles:** la cifra de los boletines de Pemex, que su sitio no deja leer.
- **Los patios y las terminales:** los 15 días son reglas del juego.
- **La carga nacional:** el tráfico interior por tren de la ATTRAPI ya incluye algo de combustible,
  así que cuenta un poco doble.
- **Lo que no está todavía:** el combustóleo, el gas LP y la turbosina como carga aparte, y la
  logística de las importaciones (en el juego llegan solas).

**Cómo se generan.** `scripts/combustibles/gen-combustibles.mjs` escribe
`src/lib/domain/datos/combustibles.json` con todo lo de arriba y la fuente de cada cifra. Es
autocontenido: las cifras se leyeron una vez de sus fuentes y viven en el script.

### Las plataformas del Golfo

En la Sonda de Campeche hay entre 200 y 250 plataformas de Pemex: según la SEMAR, 43 tripuladas y
unas 200 satélite, con cerca de 17 mil trabajadores (La Jornada Maya, 2020). El juego las junta como
Pemex reporta su producción: **un complejo por activo**, cada uno en su centro de proceso.

**El crudo no viaja en barco.** De las plataformas llega a tierra por ductos submarinos, a Dos Bocas
y a Atasta, o se carga en altamar, en **Cayo Arcas**, en los barcos de los compradores: 26.9
millones de toneladas exportadas ahí en 2018 y 15.8 en 2024 (SEMAR). En el juego eso es automático.
Lo que sí va y viene en barco es **el abasto**: gente, diésel, agua, tubería y equipo. Esa es la
logística del jugador.

| Complejo | Bloque de Pemex | Crudo 2018 (Mbd) | 2025 | Abasto que pide en 2018 (t/día) |
| --- | --- | ---: | ---: | ---: |
| Ku-Maloob-Zaap | AS01-02 | 874.7 | 530.5 | 3,610 |
| Litoral de Tabasco | AS02-04 | 291.1 | 277.4 | 1,201 |
| Abkatún-Pol-Chuc | AS02-03 | 183.8 | 123.4 | 759 |
| Cantarell | AS01-01 | 161.2 | 114.0 | 665 |

La producción es la real de cada año (anexo del Segundo Informe de Gobierno). Pemex ya no la reporta
por el nombre del activo sino por bloque. La ASF dice qué bloque era Cantarell («AS01-01, antes
Cantarell») y cuál Ku-Maloob-Zaap; un dictamen de la CNH marca el AS02-04 sobre los campos del Litoral
de Tabasco, y el AS02-03 queda por descarte. Las series cuadran: el AS01-01 daba 1,801 Mbd en 2006.

**Dónde están:**

- **Cantarell:** el complejo Akal-C, de 7 plataformas, y **Abkatún-Pol-Chuc**, el complejo Pol-A, de 6,
  en la posición que da la SEMAR en su Cuaderno de Faros del Golfo (marzo de 2024).
- **Ku-Maloob-Zaap:** el complejo Ku, por su radiofaro, de una base de datos de navegación aérea que no es
  oficial. No se encontró una oficial; cuadra con el campo Maloob y sus ductos en el dictamen de la CNH.
- **Litoral de Tabasco:** su Centro de Proceso Litoral-A no tiene coordenada publicada. El juego lo pone
  8 km al sur del rebombeo que da la SEMAR, donde cuadran las longitudes de sus ductos en los
  dictámenes de la CNH: **estimación del juego**, a unos 5 km.
- **Cayo Arcas:** su plataforma de habitación, según la SEMAR. El resto del crudo de Pemex sale de los campos en tierra y sigue su serie
real.

**El abasto:**

- **Cuánto piden:** lo que salió en barco a las plataformas en 2018: 2.07 millones de toneladas de
  carga general de Dos Bocas y 207 mil de Ciudad del Carmen (SEMAR), unas 6,200 al día. El juego lo
  reparte entre los complejos por lo que produce cada uno: **estimación del juego**, porque no hay
  cifra oficial por complejo.
- **Las bases:** Dos Bocas y **Ciudad del Carmen**, que entra como puerto del tablero para esto.
- **El barco abastecedor:** una clase nueva, a 12 nudos y con 8 horas en cada escala. Carga 918
  toneladas, lo que llevó en promedio cada uno de los 2,497 barcos que salieron de Dos Bocas en 2024.
  Carga en una base y descarga en los complejos. Los otros barcos no pueden ir a las plataformas.
- **La reserva:** un complejo guarda hasta 15 días de abasto.
- **Sin abasto, menos crudo.** La producción depende de cómo se surtió el complejo el último mes. Sin
  nada de abasto cae a la mitad: los pozos siguen fluyendo, pero sin mantenimiento ni gente se van
  cerrando plataformas. Ese piso y la memoria de un mes son **reglas del juego**.

**La partida** empieza con 10 barcos abastecedores: seis de Dos Bocas a Ku-Maloob-Zaap, dos de Dos
Bocas al Litoral de Tabasco, y uno de Ciudad del Carmen a cada uno de Abkatún-Pol-Chuc y Cantarell.
Alcanzan con algo de margen para lo que pedían en 2018. Con los años el crudo se mueve, del
Ku-Maloob-Zaap al Litoral de Tabasco, y el abasto con él: hay que mover barcos.

**El crudo exportado** del juego es lo que produce Pemex (sus complejos según su abasto, y lo demás
a su ritmo real) menos lo que procesan sus refinerías. Un complejo mal abastecido baja la
exportación.

**En el mapa,** la capa *Plataformas* dibuja cada complejo como una plataforma del tamaño de su
crudo, y Cayo Arcas como un anillo. Al pasar el cursor, un complejo dice lo que produce, lo que
necesita de abasto, para cuántos días tiene y qué tanto se surtió el último mes. Al trazar un barco
abastecedor, los complejos son escalas. La ficha del barco dice cuánto abasto lleva y cuánto ha
entregado.

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

De los polos solo entra lo que una fuente oficial dice de cada uno:
- **su declaratoria;**
- **el fallo de su licitación:** cinco del Istmo, de noviembre de 2023 a julio de 2025;
- **su concesión**, cuando la anuncia la Presidenta: Coatzacoalcos I y Texistepec, el 19 de
  febrero de 2025;
- **el convenio o el desarrollador que se anuncia:** el de Altamira, el 18 de febrero de 2026, y
  DEWA en Reserva Zapotlán, el 19 de agosto de 2026;
- **su inauguración.** Al 20 de
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

Los trenes del jugador **exportan** y mueven **carga nacional**, con un enfoque mixto: la carga
nacional es un número (ver abajo), pero una exportación va de un **origen** a una **salida** del
país, y eso es lo que el juego mide.

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
| La Paz | Marítima | 5.4 | Sí (sin vía: ningún tren llega) |
| Chihuahua | Interior | 1.3 | No (aduana interior de ciudad) |
| Torreón | Interior | 0.8 | No (aduana interior de ciudad) |
| Acapulco | Marítima | 0.8 | Sí (sin vía: ningún tren llega) |
| Ciudad del Carmen | Marítima | 1.2 | Sí (sin vía: ningún tren llega) |
| Salina Cruz | Marítima | 0.5 | Sí |

### La carga nacional

La carga que no sale del país es un número, no un viaje de un origen a un destino:

- **Cada estado la genera** a un ritmo que es una **estimación del juego**: su parte del valor
  agregado del campo y la industria del país (INEGI, PIB por entidad federativa, actividades
  primarias y secundarias, sin la extracción de petróleo, a precios de 2018) por las toneladas
  de tráfico interior por tren de ese año (anuario ferroviario, tabla A9: 30.55 millones en
  2025). Se quita el petróleo porque el crudo de Campeche y Tabasco no viaja por tren, y con él
  esos dos estados pesarían como los más industriales del país. Los años del PIB llegan a 2023
  (preliminar); después se usa el reparto de 2023 con las toneladas de cada año.
- **Un tren la carga** en cada parada con el espacio que le dejen las exportaciones, que van
  primero, hasta sus 2,436 toneladas, y **la entrega en la siguiente parada**. Se cuenta en
  toneladas y en toneladas-km (las toneladas por los km del tramo). Como la de exportación, la
  carga espera en las estaciones del estado hasta un mes de ella.

La barra de arriba dice, en la misma celda, las toneladas exportadas y las nacionales del año
(el detalle de toneladas-km va al pasar el puntero); la ficha de cada tren, cuánta carga
nacional lleva y cuánta ha movido. En el modo Realidad la barra da las toneladas que de verdad
movieron los trenes del país cada año, exportadas y nacionales.

Los estados que más carga nacional generan (parte de 2023, toneladas al día con el tráfico de
2025, estimación):

| Estado | Del campo y la industria del país | Carga nacional en el juego (t/día) |
| --- | ---: | ---: |
| Nuevo León | 9.6 % | 8,035 |
| Jalisco | 7.8 % | 6,494 |
| Estado de México | 7.7 % | 6,453 |
| Coahuila | 6.1 % | 5,070 |
| Chihuahua | 5.8 % | 4,835 |
| Guanajuato | 5.6 % | 4,718 |
| Baja California | 5.5 % | 4,562 |
| Sonora | 5.3 % | 4,424 |
| Ciudad de México | 4.3 % | 3,617 |
| Veracruz | 4.0 % | 3,359 |
| Puebla | 3.9 % | 3,291 |
| San Luis Potosí | 3.6 % | 3,021 |

Tráfico interior por tren (anuario ferroviario, tabla A9, millones de toneladas): 36.53 en 2018,
36.90 en 2019, 36.16 en 2020, 37.28 en 2021, 36.03 en 2022, 37.49 en 2023, 36.75 en 2024 y 30.55
en 2025.

### El comercio por mar

Los portacontenedores, graneleros y ro-ro del jugador llevan el comercio exterior de los
puertos (`domain/comercioMar.ts`, datos en `src/lib/domain/datos/comercio-mar.json`, que arma
`scripts/comercio/gen-comercio-mar.mjs`). El puerto es el trasbordo entre el tren y el barco.

- **Tres tipos de carga, uno por clase de barco**: el portacontenedores lleva contenedores
  (la carga contenerizada de la SEMAR), el granelero granel (agrícola y mineral) y el ro-ro
  carga general (la suelta: los autos y lo demás). Todo en toneladas.
- **Lo que lleva un barco por escala** es el promedio de 2024 en los puertos de altura (SEMAR):
  **13,972 toneladas** un portacontenedores (59.4 millones de toneladas en 4,249 barcos) y
  **29,920** un granelero (43.1 millones en 1,439). Para el ro-ro la SEMAR no da cuántos barcos
  llevaron la carga general: **8,000 toneladas**, unos 6,000 autos, es **estimación del juego**.
- **Exportaciones.** Cada puerto junta en su patio, por tipo, lo que exportó por mar en 2024.
  Lo que le llega por camión entra solo, a su ritmo real; lo que le llega por tren es lo que
  descargan ahí los trenes del jugador. Su carga de exportación se sigue contando como
  exportada por tren (como antes) y además espera en el patio un barco, como el tipo que más
  exporta ese puerto. Qué parte llega por tren: la de la ATTRAPI de 2025 (tabla A13) entre la
  de la SEMAR de 2024; es **estimación del juego**, por mezclar dos años y dos fuentes.
- **Importaciones.** Cada puerto pide, por tipo, lo que importó por mar en 2024. Un barco carga
  importaciones en la salida al mundo (Shanghái o Róterdam), hasta llenarse, y las deja en los
  puertos de su vuelta que las piden. Lo que sale del puerto por tren (ATTRAPI 2025, tabla
  A12) espera en su patio a los trenes del jugador, que lo llevan tierra adentro y lo entregan
  en su siguiente parada; se cuenta en toneladas y toneladas-km. Ese patio se llena al ritmo
  de lo que entra por tren ese año, traiga quien traiga la carga.
- **En cada escala**, en un puerto: primero baja la importación que ese puerto pide, luego sube
  la exportación de su tipo hasta llenar el barco. En la salida al mundo: lo que lleva de
  exportación se cuenta como **exportado por mar** y carga importaciones. Un barco cuya vuelta
  no toca una salida al mundo no carga nada: entre puertos del país sería cabotaje, que todavía
  no se cuenta.
- **El patio de un puerto guarda hasta un mes** de su exportación, de su importación por tren y
  de lo que pide; la partida abre con una semana. Lo que no cabe se va en los barcos de las
  navieras: no es del jugador.
- **El juego usa 2024 para todos los años.** El anuario de puertos por tipo de carga de 2018
  estaba en sct.gob.mx, que ya no existe.

Los barcos del jugador son pocos al lado de lo que mueve un puerto: Manzanillo importó en 2024
unos 47 mil toneladas de contenedores al día: más de tres portacontenedores diarios. Mar de
Cortés trae una carga cada 37 días. Lo que se gana con más barcos se ve en el puerto: al pasar
el puntero dice cuánto espera barco, cuánto pide por importar, cuánta importación espera tren
y cuánto movieron ahí tus barcos. La barra de arriba da lo que tus barcos exportaron e
importaron en el año (en pantallas de menos de 1,560 px va en el título de la celda de
exportado); la ficha de cada barco, qué lleva y cuánto ha movido; la de cada tren, la
importación a bordo y la que ha llevado.

Lo que exportó e importó cada puerto por mar en 2024 (SEMAR) y lo que entró y salió por tren en
2025 (ATTRAPI), millones de toneladas; la última columna es el tipo en que se convierte la carga
de exportación que llega en tren:

| Puerto | Exp. contenedores | Exp. granel | Exp. general | Imp. contenedores | Imp. granel | Imp. general | Exp. por tren | Imp. por tren | El tren trae |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Ensenada | 0.52 | 0.00 | 0.00 | 1.62 | 0.02 | 0.52 | — | — | contenedores |
| Guaymas | 0.07 | 2.39 | 0.00 | 0.05 | 0.28 | 0.02 | 0.59 | 0.15 | granel |
| Topolobampo | 0.00 | 0.00 | 0.00 | 0.00 | 0.76 | 0.10 | 0.10 | 0.12 | granel |
| Mazatlán | 0.22 | 0.00 | 0.04 | 0.20 | 0.00 | 0.89 | 0.39 | 0.15 | contenedores |
| Manzanillo | 6.27 | 1.45 | 0.00 | 17.31 | 2.96 | 2.07 | 0.20 | 4.89 | contenedores |
| Lázaro Cárdenas | 4.12 | 1.24 | 1.37 | 10.00 | 7.89 | 1.49 | 0.21 | 1.73 | contenedores |
| Salina Cruz | 0.00 | 0.02 | 0.00 | 0.00 | 0.01 | 0.07 | — | — | granel |
| Puerto Chiapas | 0.09 | 0.03 | 0.00 | 0.01 | 0.00 | 0.00 | — | — | contenedores |
| Altamira | 3.27 | 0.87 | 1.00 | 3.89 | 3.72 | 4.54 | 0.12 | 1.50 | contenedores |
| Tampico | 0.14 | 0.44 | 0.10 | 0.03 | 0.34 | 1.11 | 0.21 | 0.46 | granel |
| Tuxpan | 0.21 | 0.00 | 0.15 | 0.07 | 1.93 | 0.15 | — | — | contenedores |
| Veracruz | 3.12 | 0.07 | 1.35 | 7.44 | 12.26 | 1.67 | 0.34 | 8.25 | contenedores |
| Coatzacoalcos | 0.09 | 0.15 | 0.27 | 0.01 | 2.36 | 0.35 | 0.35 | 1.07 | carga general |
| Dos Bocas | 0.00 | 0.22 | 0.00 | 0.00 | 0.01 | 0.00 | — | — | granel |
| Progreso | 0.33 | 0.02 | 0.03 | 0.29 | 3.63 | 0.09 | — | — | contenedores |

En total, los 15 puertos exportaron por mar 29.65 millones de toneladas e importaron 90.15 (sin
petróleo ni derivados, que van en los buques tanque; ver [Los combustibles](#los-combustibles)).
Por tren llegaron a ellos 2.51 millones para exportar y salieron 18.32 importadas. Topolobampo y
Mazatlán reciben por tren más de lo que exportan por mar según la SEMAR: ahí toda la exportación
llega en tren. Puerto Chiapas no es salida de exportación de los trenes. La Paz, Acapulco y
Ciudad del Carmen quedan por ahora sin comercio por mar: la tabla de La Paz no se pudo leer, y
los otros dos aún no se capturan.

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
- **Los ductos antes que los combustibles como carga.** *(22 nov 2026.)* El usuario preguntó por
  los gasoductos y pidió ver las líneas de los ductos en el mapa. Van antes del paso 4 porque:
  - los gasoductos son la tercera capa de la energía;
  - los poliductos dicen cuánto les queda a trenes y barcos;
  - por ducto se mueve casi todo el combustible.
- **Los gasoductos privados llegan en su fecha real; el Estado construye el Cuxtal II.** *(22
  nov 2026.)* Los construyeron transportistas privados con contratos de la CFE, como las centrales
  privadas que el jugador no controla. El Cuxtal II es el gasoducto que el Plan de Hidrocarburos
  2026 liga a las centrales del Estado en la península. El juego lo cobra a la caja de la CFE como
  inversión. En la realidad lo construye Energía Mayakan con contrato de la CFE, y la CFE no
  publica su costo.
- **Solo la península tiene tope de gas.** *(22 nov 2026.)* Es la única región a la que el gas
  llega por un solo ducto con capacidad oficial (el Mayakan) y donde la CFE documenta la falta. En
  Baja California la capacidad de importación oficial sobra. En el resto no hay un tope oficial
  por región.
- **Las capas, arriba a la izquierda; trenes y barcos también son capas.** *(22 nov 2026; reemplaza
  los botones compactos de abajo a la derecha.)* Lo pidió el usuario: los vehículos solo se ven con
  su capa encendida, y su lista aparece debajo de las capas. En una columna los botones llevan
  siempre su nombre. Las leyendas quedaron abajo, junto a esa columna, sobre el Pacífico: abajo a la
  derecha, como se había propuesto, tapaban la península.
- **Los poliductos que faltaban, dibujados por el juego.** *(22 nov 2026.)* El mapa de la SENER de
  2018 trae en tablas cada ducto con su origen, su destino, su longitud y su capacidad, pero no su
  trazo. El juego los une por las terminales y los pueblos de en medio y los marca como aproximados.
- **Los combustibles: producir no basta, hay que llevarlo.** *(22 nov 2026.)* El paso 4 que aprobó
  el usuario. Lo que hacen las refinerías llega solo por ducto a su zona. Lo que les sobra espera en
  su patio a los trenes y buques tanque del jugador, que lo llevan a donde falta. Lo que nadie lleva
  se importa. Así la logística se nota justo donde se notó en la realidad: en Salina Cruz y en la
  Olmeca, que hacen más de lo que su región usa, y en el noroeste y la península, que se surten por mar.
- **Las zonas salen del mapa oficial de 2018, no de las líneas del tablero.** *(22 nov 2026.)* Al
  tablero le faltaban los poliductos del noreste y el occidente, pero el mapa de la SENER dice cómo se
  surtía cada terminal de Pemex y de dónde sale cada ducto. Una terminal surtida por ducto desde una
  terminal marítima (Rosarito, Guaymas, Topolobampo, Progreso) cuenta como surtida por mar.
- **Salina Cruz y la Olmeca, aparte del centro.** *(22 nov 2026.)* Salina Cruz está unida a
  Minatitlán por un poliducto bidireccional, y Dos Bocas por un ramal, pero en la realidad las dos
  sacan su combustible sobre todo por mar: Salina Cruz al Pacífico (3.55 millones de toneladas de
  cabotaje en 2018) y Dos Bocas al Golfo. Juntarlas con el centro, que siempre importa, dejaría
  vacíos a los buques tanque.
- **Las importaciones y el crudo de exportación llegan y se van solos.** *(22 nov 2026.)* Pemex
  importa con barcos fletados y vende su crudo en sus terminales a buques de los compradores. El
  jugador hace lo que hacía la flota de Pemex: llevar el combustible del país por la costa y por el
  Istmo.
- **El tren también carga en el puerto de una refinería de la costa.** *(22 nov 2026.)* Salina
  Cruz, Pajaritos (Coatzacoalcos) y Madero (Tampico) tienen la refinería junto al muelle. Así el
  tren del Istmo de la partida ya lleva combustible de Salina Cruz al Golfo, como el corredor que el
  gobierno usó para eso.
- **La Paz y Acapulco, puertos del tablero.** *(22 nov 2026.)* Baja California Sur y la terminal de
  Acapulco solo se surten por mar. Sin sus puertos, el jugador nunca podría llevarles combustible.
- **Las plataformas, por complejo; el jugador lleva el abasto, no el crudo.** *(22 nov 2026.)* El
  usuario quería la logística de plataforma a puerto. En la realidad el crudo va a tierra por ducto
  submarino o se carga en altamar en Cayo Arcas; lo que va en barco es el abasto. Así que las cerca de
  240 plataformas son 4 complejos, uno por activo, con su crudo real, y los barcos abastecedores del
  jugador deciden cuánto producen.
- **La barra no crece.** *(22 nov 2026.)* La segunda línea de *Refinación* pasó de la parte del
  consumo que hacen las refinerías a la parte que llegó del país; lo importado y el crudo exportado
  van en su tooltip y en la leyenda de la capa. Con menos de 1,500 px, la celda de obras deja solo la
  flecha y la carga aérea de Realidad se esconde.
- **El petróleo, con caja propia de Pemex.** *(20 nov 2026.)* El usuario aprobó el orden
  (fuentes, refinerías como sitios, Pemex y sus obras, y los combustibles como carga junto con los
  barcos) y que Pemex pague con su propia caja, como la CFE. Pidió además dos cosas:
  - Deer Park se puede comprar y mejorar durante el partido.
  - El mal estado de las refinerías en 2018, y lo que se invirtió en rehabilitarlas, son parte
    del juego.

  Lo que se mide es el crudo refinado y la parte del consumo de combustibles que el país hace
  él mismo: es la meta que el gobierno se puso. Los ductos y el robo de combustible se dejan
  fuera: no son ni tren ni barco.
- **Una refinería rehabilitada llega a su capacidad óptima, no a su capacidad de diseño.**
  *(20 nov 2026.)* Es lo que cada una declaró a la ASF que podía procesar con sus plantas en
  orden. Así la meta es la de Pemex y no una que nunca se planteó.
- **Por refinería, solo los años y meses publicados.** *(20 nov 2026.)* En Realidad, donde no hay
  cifra de una refinería (2022 a septiembre de 2024), la ficha lo dice en vez de estimarla.
- **La barra de arriba, en celdas de dos líneas.** *(20 nov 2026.)* Con la caja de Pemex y la
  refinación ya no cabía. Las cifras que van juntas comparten celda: las dos cajas, los dos
  empleos, las dos cargas, el crudo y los combustibles. En Realidad comparten las vías, las
  centrales y los polos, y la refinación y la carga aérea. Abajo de 1,400 px de ancho se ocultan
  las secundarias.
- **La carga nacional, un número.** *(20 nov 2026.)* Pedido del usuario. Cada estado la genera a
  su parte del campo y la industria, sin la extracción de petróleo (que inflaría a Campeche y
  Tabasco, cuyo crudo no viaja por tren). Va de una parada a la siguiente y se cuenta en
  toneladas y toneladas-km; la exportación tiene prioridad sobre el espacio del tren. En la
  barra de arriba, exportado y nacional comparten celda, y los botones de obras se juntaron en
  uno, para que todo quepa.
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
- **Los empleos de un polo salen de cifras oficiales, por hectárea.** *(23 nov 2026.)* Un polo con
  cifra de su propio terreno la usa; los demás, la densidad que da la cifra oficial de los
  primeros 15 polos (300 mil empleos entre su superficie), no la de Huamantla, que es chico y
  denso. Las cifras que el gobierno anuncia junto con un polo pero que suman proyectos de fuera
  (Zapotlán, Chetumal, Topolobampo) no se usan.
- **La subestación de un polo la amplía la CFE.** *(23 nov 2026.)* Es obra de la CFE y se paga de
  su caja, no de la del Estado, como sus centrales. Así la CFE reparte su dinero entre generar
  más (la región) y llevarlo a donde se usa (el polo).
- **La energía de un polo no se reparte por hectárea.** *(22 nov 2026.)* Las cifras oficiales
  (siete polos) van de 4 a 20 MW sin importar si el polo tiene 53 o 911 hectáreas. Un polo sin
  cifra recibe la mediana, 8 MW, y adentro las empresas piden por empleo. Así un polo grande
  arranca con lo que arrancan los demás y necesita más subestación para llenarse.
- **En un polo, las empresas las atrae el Estado.** *(22 nov 2026.)* El jugador no pone
  empresas: promueve cada lote para un sector de las vocaciones de la declaratoria, y las
  empresas llegan solas si hay tren y energía. Cada sector pide distinto (electricidad, agua,
  carga), así que escoger es decidir qué tren y cuánta energía necesitará el polo.
- **Un polo se conecta a la luz donde dice su declaratoria.** *(23 nov 2026.)* La conexión del
  dibujo va a la línea de alta tensión más cercana de OpenStreetMap. Cuando no hay ninguna cerca
  (Reserva Zapotlán), va a la subestación que nombra la declaratoria, aunque quede a 24 km.
- **La espuela va a una vía de México.** *(23 nov 2026.)* La vía más cercana a San Jerónimo
  es la de Union Pacific, del otro lado de la frontera; su espuela va a la de Ferromex en Ciudad
  Juárez, a 15.8 km, como dice su declaratoria («a 15 km de la red férrea»). Un cruce ferroviario
  nuevo con Estados Unidos sería otra obra, con su propio permiso.
- **Si la superficie declarada no sale del cuadro, manda el cuadro.** *(23 nov 2026.)* El dibujo
  es el polígono de la tabla, como en todos los polos; las cifras del polo (costo y empleos)
  siguen con la superficie declarada, que es la oficial. San Jerónimo es el único caso: su
  cuadro encierra 6.4 % menos de lo que declara.
- **La espuela va a la vía que hay.** *(23 nov 2026.)* A la vía principal en servicio más
  cercana; si no hay ninguna, a la línea con nombre más cercana aunque esté en obra o
  abandonada (la México–Pachuca de Zapotlán, que la red del juego de 2018 tiene en servicio).
- **Un polo en varias piezas se arma pieza por pieza.** *(23 nov 2026.)* Cuando la declaratoria
  parte el terreno (franjas que lo cruzan, polígonos separados), cada pieza lleva su calle y sus
  lotes como un polo chico, y la obra avanza por las calles una tras otra. Se dibujan las
  franjas excluidas, y donde una cruza una pieza no va ningún lote. Así el terreno se respeta
  como lo declara el DOF, en vez de dibujar un rectángulo que pase sobre una autopista.
- **Los lugares tienen vista por dentro.** *(22 nov 2026.)* Entrar a un sitio lo muestra de cerca,
  con lo que se puede hacer ahí. Se empezó por un polo, Huamantla, el único terminado en la
  realidad: su obra se maneja por frentes, cada uno con sus cuadrillas, y su tren llega por una
  espuela que hay que construir. Los demás polos se siguen construyendo de una vez desde su
  ficha hasta que tengan su vista. El acercamiento es otra pantalla, no un zoom del tablero: la
  escala cambia de 3,000 km a un kilómetro.
- **En el mar, el jugador es una naviera más.** *(22 nov 2026.)* En el tren, los trenes del
  jugador llevan toda la carga del juego (los privados solo ocupan la vía). En el mar no: un
  puerto como Manzanillo recibe más de tres portacontenedores al día. Por eso cada puerto
  genera su comercio real completo, los barcos del jugador se llevan lo que alcanzan, y lo que
  no cabe en el patio en un mes se va en otros barcos. Crecer la flota se nota en lo que el
  puerto deja de tener esperando.

---

## 12. Bitácora de correcciones a los datos

Todo lo que se cambió respecto a las fuentes, y por qué.

### 23 de noviembre de 2026

**Capital de la Tecnología: su superficie ([nota aclaratoria](https://dof.gob.mx/nota_detalle.php?codigo=5764007&fecha=29/07/2025), DOF)**

- **El error:** el juego tenía las 275.2 ha del artículo segundo de su declaratoria. Su nota
  aclaratoria del 29 de julio de 2025 las corrige a 217.68 ha, lo que dan sus cinco cuadros de
  construcción (217.71 ha); antes solo se había leído el cambio de nombre.
- **El arrastre:** los empleos de un polo sin cifra propia salen de los 300 mil de los primeros 15
  polos del Plan México entre su superficie, y Capital de la Tecnología es uno de ellos. Con 57.5 ha
  menos, la densidad sube de 60.5 a 61.2 empleos por hectárea, y con ella los empleos de cada polo
  lleno (1.2 % más), la gente de cada lote y lo que pide de electricidad. Las cifras de los polos por
  dentro ya son las nuevas; ningún polo cambia de número de bancos de la CFE.

**Ciudad Ixtepec por dentro (DOF)**

- **El meridiano:** la nota de su cuadro da 95°15' O, que lo pone 17.7 km al oeste de su croquis; el
  juego usa 95.0828° O, el que pone su borde sobre la MEX-185D.
- **Dos dígitos:** el vértice 64 dice 1,830,773.588 al norte y sus lados lo ponen en 777.588 (un 3
  por un 7); el 82 dice 1,811,586.468, 20 km al sur, y va en 1,831,586.468. Con los dos, el cuadro
  da lo declarado.
- **Dos rumbos:** los lados 39→40 y 45→46 dicen W donde sus vértices dan E. No mueven nada.

**Santa María Mixtequilla por dentro (DOF)**

- **Un dígito:** el vértice 33 dice 499,399.965 al este; sus lados desde el 32 y hacia el 34 lo
  ponen en 499,999.965 (un 3 por un 9). Con él, el cuadro da lo declarado.

**Asunción Ixtaltepec por dentro (DOF)**

- **Dos dígitos en el polígono B:** el vértice 1B dice 1,848,167.788 al norte, y sus lados y la
  tabla del polígono adyacente lo ponen en 1,849,167.788; el 30B dice 1,848,315.216 y sus dos lados
  lo ponen en 312.216. Con ellos, el B da sus 145.42 ha y el derecho de vía de Pemex sus 0.48.
- **Un rumbo:** el lado 18B→19B dice S 78°37' W; sus vértices dan S 76°32' W (la distancia cuadra).
- **La superficie:** el Corredor da 234.10 ha en la ficha del polo; la declaratoria, 246.08.

**Matías Romero por dentro (DOF)**

- **El cierre:** la tabla vuelve al 1A con un norte de 1,847,912.785, 57 km al sur (es el del 1A
  de Ixtaltepec); el juego cierra en el 1A del primer renglón. Su área queda 0.006 % abajo de la
  declarada.

**Teapa por dentro (DOF)**

- **La vía, a dos distancias:** la declaratoria lo pone «aledaño a la línea FA» en su criterio de
  macro localización y, en el siguiente, a 4 km de la vía de la línea FA. En OpenStreetMap la vía
  queda a 1.43 km en línea recta; el juego usa esa.

**Tapachula I por dentro (DOF)**

- **Un dígito cambiado:** el vértice J de la franja de la línea eléctrica de la CFE dice
  565,969.702 al este; sus lados desde el I y hacia el E lo ponen en 565,989.702 (un 6 por un 8).
  Con él, la franja da exactamente sus 1.9434 ha.
- **Tres vértices fuera de su lugar:** el 55, el 56 y el 57 quedan a unos 6.7 m de donde los ponen
  sus rumbos y distancias desde el 21, y de ahí salen 0.29 ha de más. El juego los toma de los
  rumbos.
- **Un rumbo:** el lado del 61 al 1 dice N 33°34' E; sus vértices dan N 38°34' (la distancia
  cuadra). No mueve nada.
- **El resultado:** la poligonal general da 268.78 ha contra las 268.73 declaradas, y los tres
  predios 263.22 contra 263.17 (0.02 % más). Las dos franjas dan lo de sus cuadros.

**Arriaga por dentro (DOF)**

- **Una fecha imposible:** la declaratoria, publicada el 8 de junio de 2026, cita el oficio
  DES/285/2025 de la CONANP «de fecha 16 de julio de 2026», un mes después. Por su número es de
  2025. No cambia nada del juego.
- **El área:** su cuadro da 48.76 ha contra las 48.83 declaradas (0.15 % menos); todos sus lados
  cuadran con su rumbo y su distancia.

**Puerta Logística del Bajío por dentro (DOF)**

- **Dos renglones con otra etiqueta:** el lado que va del vértice 360 al 332 (una curva) pone sus
  coordenadas bajo el nombre 362, y el polígono III cierra con un lado «3282 → 3275» sin que el
  3282 aparezca. Ninguno cambia el área: los tres polígonos dan lo de sus cuadros.
- **Un hueco:** la tabla del polígono II entra a un rectángulo de 1.2 ha y sale por el mismo lado
  (del 2107 al 2106 y de regreso), así que el rectángulo queda fuera del polo.

**Durango por dentro (DOF)**

- **Las vocaciones:** la declaratoria numera nueve y repite «manufactura avanzada» (la 5 y la 9).
- **Las reservas:** son la 1, la 2, la 4 y la 5; no hay reserva 3. Con ellas y el polígono 1
  suman exactamente las 315.42 ha declaradas.

**Hermosillo por dentro (DOF)**

- **El Lado B:** su columna de «rumbo» trae ángulos que no son los rumbos de sus lados; las
  distancias sí cuadran con sus vértices, así que no se mueve ninguno. Un renglón dice «216 -
  217» donde el lado va del 215 al 216.
- **El resultado:** el Lado A da 298.97 ha y el PIAT 20.63, lo de sus cuadros; el Lado B da 227.57
  contra 226.86 (0.3 % más). Las tres suman 547.18 ha contra las 546.46 declaradas.

**Topolobampo por dentro (DOF)**

- **La donación:** la declaratoria del 20 de marzo de 2026 traía tres cuadros, los polígonos 1 y
  2 y un «polígono de donación a Rosendo G. Castro» (3.77 ha, pegado al polígono 1), que sumaban
  281.35 ha contra 277.58 declaradas. El acuerdo del 29 de abril, para «precisar las coordenadas
  de los polígonos», dejó solo los dos primeros, que suman exactamente lo declarado. El juego ya
  usaba el polígono corregido; ahora dibuja la donación fuera del polo.

**San Jerónimo por dentro (DOF)**

- **La superficie:** el cuadro de la fracción B-3B y el artículo que la declara dicen 603,190.225
  m² (60.32 ha), pero el cuadro encierra 564,641 m² (56.46 ha), 6.4 % menos. No es un vértice
  equivocado: cada lado cuadra con su rumbo y su distancia, y cada curva con su delta, su
  longitud y su subtangente. El juego dibuja el cuadro y conserva las 60.32 ha para sus cifras
  (costo y empleos). Con cuerdas en lugar de curvas da 57.29 ha, lo que se leyó al ubicar los
  32 polos.

**Parque Industrial Bajío por dentro (DOF)**

- **Vértice 328 del polígono 3:** dice 2,199,839.737 de norte, pero sus dos lados lo ponen en
  2,199,837.937: dos dígitos invertidos. Con él, el polígono da 85.5912 ha, lo de su cuadro.
- **Vértice 200 del polígono 2:** abre su tabla en 2,200,214.54 de norte y la cierra en
  2,200,214.34, que es donde termina el lado que llega desde el vértice 231. Se usa el segundo.
- **Números con puntos por comas:** «2.201,054.262» y «294.706.584» (vértices 124 y 157 del
  polígono 1) se leen como los números que son; el renglón del polígono 2 que dice «222 → 225»
  va del 222 al 223.
- **La suma:** los tres polígonos y el camino de acceso dan 342.25 ha contra las 342.08
  declaradas. La parcela de 1 ha, que también trae su cuadro, no entra en esa suma (con ella
  serían 343.25): el juego la dibuja y no la cuenta. Los cuadros tampoco restan dónde se
  enciman: el camino cruza el polígono 3, la punta del 2 y la parcela.

**Nezahualcóyotl por dentro (DOF)**

- **Lote 3-B:** su tabla cierra con un renglón «R100» de 4,999,867.778 de este (un 9 de más) que
  repite las coordenadas de R27. Se deja fuera; sin él, el área del lote da exactamente los
  210,484.94 m² declarados.

**Reserva Zapotlán por dentro (DOF)**

- **La superficie:** el artículo segundo declara 9,222,019.79 m², pero su cuadro de construcción
  dice 9,108,169.941 m², y eso dan sus vértices. El juego usa el cuadro (910.82 ha), como ya lo
  hacía.

**Texistepec por dentro (DOF)**

- **Vértice 10A del derecho de vía de la línea Z:** dice 1´982,986.5187 de norte, pero el lado
  que llega a él desde el vértice 10 («S 16°32'50.56" W, 3.1184 m») termina en 1,981,986.52. Es
  un dígito equivocado; con el número original la franja hacía un pico de un kilómetro y medía
  12.03 ha en vez de 14.00.
- **La curva grande de la vía:** los dos bordes de la franja giran alrededor del mismo centro
  (CT2), a 329.82 m el de adentro y a 399.82 m el de afuera. El renglón de la curva de afuera
  dice 477.819 m de radio y 13°20' de ángulo, lo que no cuadra con sus propios vértices ni con su
  centro; se usa el radio que dan ellos.
- **Resultado:** las tres piezas suman 462.3944 ha contra las 462.3909 declaradas.

**Altamira por dentro (DOF)**

- **La servidumbre del gasoducto:** la declaratoria dice que la superficie resulta «de la suma de
  las áreas de los tres polígonos y restando el derecho de vía de la interconexión al gasoducto
  Texas-Tuxpan», pero su resumen no resta nada: 955.16 + 644.88 + 37.74 = 1,637.78 ha, lo
  declarado. La servidumbre (2.34 ha) queda dentro de GOB 3. El juego toma las 1,637.78 ha, la
  dibuja y no pone lotes en ella.

**Coatzacoalcos I en la realidad**

- **Antes** decía que no había licitación reportada.
- **Ahora** dice que la Presidenta lo dio por concesionado a Desarrolladora Multimodal del Istmo
  el 19 de febrero de 2025.

### 22 de noviembre de 2026

**Los empleos de los polos**

- **Antes** todos usaban 94.3 empleos por hectárea, los de Huamantla.
- **Ahora** Huamantla y Nezahualcóyotl usan su propia cifra oficial, y los demás 60.5 por
  hectárea: los 300 mil empleos de los primeros 15 polos entre su superficie. Ver
  [Cuántos empleos da un polo](#cuántos-empleos-da-un-polo).

**La energía de los polos**

- **Dos cifras oficiales que faltaban:** San Jerónimo (20 MW disponibles) y el Parque Industrial
  Bajío (12.9 MW), del portal de Economía. Antes usaban la estimación por hectárea: 1.6 y 8.8 MW.
- **Los polos sin cifra** pasan de 0.0257 MW por hectárea a la mediana de los siete oficiales, 8
  MW. Ver [La energía](#la-energía).

**Coatzacoalcos I por dentro (DOF)**

- **Vértice 9:** dice 1,999,815.5086 de norte, pero el lado que llega a él desde el vértice 8
  («S 04°57'42.44" E, 552.834 m») termina en 1,998,815.51. Es un dígito equivocado; con el número
  original el polígono hacía un pico de un kilómetro.
- **Último renglón:** cierra en «vértice 1» con 357,910.7404 de este, pero el último lado («N
  02°59'51.53" E, 77.381 m») termina en 357,166.74, que es el vértice 1 tal como abre la tabla.
  El renglón repite el vértice 1 con una errata, y se deja fuera.
- **Resultado:** con las dos correcciones el área da 257.62 ha contra las 257.71 declaradas.

**Huamantla por dentro (DOF)**

- **Cuadro de construcción:** cuatro vértices traen un punto donde va la coma (611.268.7407,
  611.576.0324, 611.734.0058 y 2.140,253.4809). Se leen como los números que son; con ellos el
  área da exactamente los 530,000 m² declarados.

**Comercio por mar (anuario de puertos de la SEMAR de 2024)**

- **Tipos de carga.** Contenedores es la «general contenerizada»; granel, la suma del agrícola y
  el mineral; carga general, la «general suelta». El petróleo y sus derivados se dejan fuera:
  ya los llevan los buques tanque.
- **La Paz:** su tabla de carga no se pudo leer del PDF; queda sin comercio por mar.
- **Topolobampo** no exportó nada de altura en 2024 según la SEMAR, pero la ATTRAPI cuenta 0.10
  millones de toneladas que salieron del país por tren por ahí en 2025. Se respeta: el patio
  junta lo que traigan los trenes.

**Puertos**

- **La Paz y Acapulco entran al tablero.** Coordenadas a mano: La Paz en Pichilingue (24.264,
  -110.327) y Acapulco en su muelle (16.848, -99.904). Con ellos hay 171 rutas marítimas; las 136
  de antes salen idénticas.
- **La estación de Cancún, en el script.** Estaba puesta a mano en `ciudades.json` y
  `npm run datos` la borraba al regenerar. Ahora el script la escribe (`ESTACION_APARTE`).

**Terminales de Pemex (mapa de la SENER de 2018)**

- **T.M. Guaymas** dice «Refinería/Buque tanque», pero en Guaymas no hay refinería: cuenta como
  surtida por buque tanque.
- **Ciudad Mante:** su capacidad nominal es de 20,458 barriles en el mapa y de 29,458 en la capa de
  la CNH; se usa la del mapa.
- **Sin coordenadas en la capa de la CNH:** T.M. Pajaritos y T.M. Tuxpan van en su puerto, y
  Tapachula II junto a Tapachula.
- **Fuera del juego:** las cuatro terminales privadas del mapa (Vopak en Veracruz, Glencore en Dos
  Bocas, Gas Natural del Noroeste en San José Iturbide e Hidrosur en Progreso).

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
- **Ciudad Ixtepec y Santa María Mixtequilla**, en coordenadas TME: la longitud del marcador se fijó
  contra la autopista MEX-185D de OpenStreetMap (ver la nota ¹ de la tabla de polos).
- **Economía Circular Quintana Roo**: cuadro transcrito de la imagen del DOF.
- **San Jerónimo**: el marcador se bajó 750 m para quedar del lado mexicano de la frontera del
  tablero (la de Natural Earth corre ahí ~1 km al sur de la real).
- **Topolobampo**: se usa el polígono del acuerdo que modificó su declaratoria (29 abr 2026).
- **Reserva Zapotlán**: su nota aclaratoria (29 jul 2025) corrige la superficie a 9,108,169.94
  m² (910.82 ha) y el municipio a Zapotlán de Juárez; el polígono calculado da exactamente eso.
- **Capital de la Tecnología y la Sostenibilidad** (Puebla): su nota aclaratoria (29 jul 2025)
  le quita el "Futura" del nombre y corrige su superficie de 275.2 a 217.68 ha, lo que dan sus
  cinco cuadros (217.71 ha).
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
- **Mbd**: miles de barriles diarios, la medida del crudo que procesa una refinería y de los
  combustibles que se usan, se mueven o se importan.
- **MMpcd**: millones de pies cúbicos diarios, la medida del gas que transporta un gasoducto.
- **SISTRANGAS**: el Sistema de Transporte y Almacenamiento Nacional Integrado de Gas Natural: el
  Sistema Nacional de Gasoductos del Estado más los privados integrados a él, con una sola tarifa.
- **CENAGAS**: el Centro Nacional de Control del Gas Natural, que opera el Sistema Nacional de
  Gasoductos desde 2015.
- **Gasoducto, poliducto, oleoducto**: ductos de gas natural, de petrolíferos (gasolina, diésel,
  turbosina) y de crudo.
- **Régimen térmico**: la energía de combustible que una central quema por cada kWh que produce.
- **Sistema Nacional de Refinación**: las refinerías de Pemex en México: las seis de antes de
  2018 (Cadereyta, Madero, Minatitlán, Salamanca, Salina Cruz y Tula) y, desde 2024, la Olmeca.
- **Capacidad óptima**: lo que una refinería puede procesar con sus plantas en orden, según lo
  que cada una declaró a la ASF en mayo de 2022.
- **Coquizadora**: planta que convierte el residuo pesado del crudo (el que acaba en combustóleo)
  en coque, gas y destilados como gasolina y diésel.
- **TAD (o TAR)**: terminal de almacenamiento y despacho (o reparto) de Pemex: recibe el
  combustible por ducto, buque tanque, carro tanque o autotanque, lo guarda y de ahí sale en pipas a
  las gasolineras.
- **Terminal marítima**: la de Pemex en la costa que recibe y manda buques tanque (Pajaritos,
  Tuxpan, Madero, Salina Cruz y Guaymas).
- **Cabotaje**: el transporte por mar entre puertos del mismo país.
- **Altura**: el tráfico por mar con otros países: importación y exportación.
- **Carga contenerizada, granel y general suelta**: los tipos de carga de la SEMAR. La
  contenerizada va en contenedores; el granel (agrícola o mineral) va suelto en la bodega; la
  general suelta va en piezas, como los autos de un ro-ro.
- **Frente de obra**: una parte de la obra de un polo que avanza por su lado (las calles, el
  agua, la energía, los servicios, la espuela), con sus propias cuadrillas.
- **Espuela**: el ramal corto de vía que une un polo o una planta con la línea principal.
- **Derecho de vía**: la franja de terreno de una carretera, una vía o un ducto, a los lados de
  la obra. Una declaratoria puede excluirlo del polo (Texistepec).
- **Fideicomiso**: un contrato en el que alguien entrega bienes o dinero a una institución (la
  fiduciaria) para que los administre con un fin. El Parque Industrial Bajío firmó el suyo en
  agosto de 2026; Altamira iba rumbo al suyo en marzo de 2026.
- **Servidumbre de paso**: el derecho de pasar por un terreno ajeno, por ejemplo con un ducto,
  sin ser su dueño (el gasoducto que cruza Altamira).
- **Lote**: el pedazo del polo que compra una empresa para poner su nave.
- **Promover un lote**: en el juego, ofrecerlo a empresas de un sector; solo a un lote promovido
  llega empresa.
- **Banco de transformación**: el transformador de una subestación (o su juego de tres, uno por
  fase); su capacidad se mide en MVA. Ampliar una subestación es ponerle otro banco.
- **Vocación productiva**: un sector para el que la declaratoria dice que el polo es propicio.
- **Personal ocupado**: en los censos del INEGI, todas las personas que trabajaron para un
  establecimiento en el año, contratadas por él o no.
- **Trasbordo**: pasar la carga de un medio a otro; en el juego, del tren al barco en un
  puerto, o del barco al tren.
- **Buque tanque, carro tanque, autotanque**: el barco, el vagón de tren y el camión (la pipa) que
  llevan líquidos.
- **Zona de ductos**: en el juego, las refinerías unidas por sus poliductos y la parte de cada
  estado a la que llegan.
- **Complejo (costa afuera)**: un conjunto de plataformas alrededor de un centro de proceso, que
  separa el crudo y el gas y los manda a tierra por ducto submarino.
- **Barco abastecedor**: el que lleva a las plataformas gente, diésel, agua, tubería y equipo desde
  una base en la costa.
- **Patio**: en el juego, lo que una refinería hace y su zona no usa, esperando un tren o un buque
  tanque.
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
  Nacional, con el meridiano central de cada ejido y factor de escala 1.
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
