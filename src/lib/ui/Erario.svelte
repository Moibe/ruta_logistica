<script lang="ts">
  import { sim } from '$lib/state/simulacion.svelte';
  import { tablero } from '$lib/state/tablero.svelte';
  import { añoCompleto, FEDERAL } from '$lib/domain/presupuesto';
  import { CAJA_CFE_MES, ENERGIA } from '$lib/domain/energia';
  import { km, mdp, personas } from './formato';
  import { añoDe } from '$lib/domain/calendario';
  import { OBRAS_VIA } from '$lib/domain/obrasVia';
  import { OBRAS_ENERGIA } from '$lib/domain/energia';
  import { AÑOS_AEROPUERTOS, POLOS, SERIE_AEROPUERTOS } from '$lib/domain/sitios';
  import { EXPORTACIONES } from '$lib/domain/exportaciones';
  import { clavePolo } from '$lib/domain/realidad';
  import { DEMANDA_COMBUSTIBLES, PETROLEO, totalReal } from '$lib/domain/petroleo';

  /** The last year with a real figure: later years repeat it. */
  const ULTIMO_AÑO = FEDERAL.años[FEDERAL.años.length - 1].año;

  /**
   * The State's ledger, always in view as a bar along the top of the screen,
   * between the clock and the book: the money in the till and what comes
   * in each month, the jobs the player's works have made, and the way into the
   * catalog of works. Permanent jobs are the ones that last (companies in the
   * polos); jobs on site end with the work. Reads the clock so it moves as
   * works are paid and polos fill.
   */
  const cuenta = $derived.by(() => {
    sim.horas;
    const obras = [...sim.obras.values()];
    return {
      dinero: sim.dinero,
      permanentes: sim.empleosPermanentes,
      enObra: sim.empleosEnObra,
      enCurso: obras.filter((o) => o.fase === 'en-obra').length,
      detenidas: obras.filter((o) => o.fase === 'en-obra' && o.detenida).length,
      operando: obras.filter((o) => o.fase === 'operando').length,
      viasEnObra: [...sim.obrasVia.values()].filter((o) => o.fase === 'en-obra').length,
      viasDetenidas: [...sim.obrasVia.values()].filter((o) => o.fase === 'en-obra' && o.detenida).length,
      viasEnServicio: [...sim.obrasVia.values()].filter((o) => o.fase === 'en-servicio').length,
    };
  });

  /** In Realidad: the year's real rail budget and where the catalog's rail works really stand. */
  const real = $derived.by(() => {
    if (sim.modo !== 'realidad') return null;
    const a = añoCompleto(añoDe(sim.horas));
    const cuenta = { anunciadas: 0, enObra: 0, enOperacion: 0, kmObra: 0, kmOperacion: 0 };
    for (const o of OBRAS_VIA) {
      const e = sim.real.get(o.id)?.etapa;
      const largo = sim.medidas.get(o.id)?.km ?? 0;
      if (e === 'anunciada') cuenta.anunciadas++;
      else if (e === 'en-obra') (cuenta.enObra++, (cuenta.kmObra += largo));
      else if (e === 'en-operacion') (cuenta.enOperacion++, (cuenta.kmOperacion += largo));
    }
    const cfe = { enOperacion: 0, mwOperacion: 0, enObra: 0 };
    for (const o of OBRAS_ENERGIA) {
      const e = sim.real.get(o.id)?.etapa;
      if (e === 'en-operacion') (cfe.enOperacion++, (cfe.mwOperacion += o.mw));
      else if (e === 'en-obra') cfe.enObra++;
    }
    const polos = { declarados: 0, operando: 0 };
    for (const p of POLOS) {
      const e = sim.real.get(clavePolo(p.id))?.etapa;
      if (e === 'en-operacion') polos.operando++;
      else if (e === 'anunciada' || e === 'en-obra') polos.declarados++;
    }
    const serie = a.repetido ? 'sin dato aún: el último publicado' : a.serie === 'ejercido' ? 'ejercido' : a.serie === 'aprobado' ? 'aprobado' : 'proyecto';
    // Air cargo in the date's year (the series' last year is still running).
    const añoCarga = Math.min(Math.max(a.año, AÑOS_AEROPUERTOS[0]), AÑOS_AEROPUERTOS[AÑOS_AEROPUERTOS.length - 1]);
    const parcial = añoCarga === SERIE_AEROPUERTOS.parcial.año;
    const carga = { año: añoCarga, t: SERIE_AEROPUERTOS.totalPais[String(añoCarga)], parcial };
    // Rail exports that year (ATTRAPI), when the yearbook has it.
    const ferro = EXPORTACIONES.ferrocarril.exportacion[String(a.año)] ?? null;
    const ferroNacional = EXPORTACIONES.ferrocarril.nacional[String(a.año)] ?? null;
    // Crude the refineries really ran that year.
    const refino = totalReal(a.año);
    return { ...cuenta, cfe, polos, carga, ferro, ferroNacional, refino, año: a.año, federal: a.federal, serie };
  });

  /** This month's payment and the year it comes from, with the sources in words. */
  const llegada = $derived.by(() => {
    const m = sim.ultimaMensualidad;
    if (!m) return null;
    const a = añoCompleto(m.año);
    const serie = m.repetido
      ? `se repite el último dato, el de ${ULTIMO_AÑO}`
      : m.serie === 'ejercido'
        ? 'lo que se ejerció'
        : m.serie === 'aprobado'
          ? 'lo aprobado'
          : 'el proyecto de presupuesto';
    const detalle =
      `Presupuesto federal para ferrocarriles de ${m.año} (${serie}): ${mdp(a.federal)} al año.\n` +
      `Derecho de las concesionarias (${(a.tasa * 100).toLocaleString('es-MX')} % de sus ingresos): ${mdp(a.derecho)} al año.\n` +
      'Llega en doce partes, el día 1 de cada mes; lo que no se gasta se acumula.';
    return { total: m.total, año: m.año, detalle };
  });

  /** "+988/mes", "+15.5 mil/mes": a monthly payment, short (millions of pesos, like the till; the tooltip says so). */
  const alMes = (n: number) =>
    `+${n >= 1000 ? (n / 1000).toLocaleString('es-MX', { maximumFractionDigits: 1 }) + ' mil' : Math.round(n).toLocaleString('es-MX')}/mes`;

  const detalleCfe =
    `La CFE paga sus centrales con recursos propios, no con el presupuesto federal: ${mdp(ENERGIA.cajaCfeMdpAño)} al año ` +
    '(Programa de Desarrollo CFE 2026–2030, proyectos propios de generación). Solo las centrales de la CFE se pagan de aquí.';

  const detallePemex =
    'Pemex paga sus refinerías con lo que el Gobierno Federal le transfiere para refinación: 6.1 mil millones al mes de 2019 a 2024 ' +
    '(391 mil millones de enero de 2019 a abril de 2024) y 2.2 mil millones desde 2025 (Plan de Trabajo 2025–2030). Solo las obras de Pemex se pagan de aquí.';

  /** Millions of pesos, short for the two-till cell: "2.20 mil M", "850 M". */
  const corto = (n: number) =>
    Math.abs(n) >= 1000
      ? `${(n / 1000).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} mil M`
      : `${Math.round(n).toLocaleString('es-MX')} M`;

  const enObraCfe = $derived.by(() => {
    sim.horas;
    return [...sim.obrasEnergia.values(), ...sim.obrasPemex.values()].filter((o) => o.fase === 'en-obra').length;
  });
  const hechasCfe = $derived([...sim.obrasEnergia.values(), ...sim.obrasPemex.values()].filter((o) => o.fase === 'en-servicio').length);

  /** What Pemex's refineries run and make in the game, for the bar. */
  const refino = $derived.by(() => {
    const r = sim.refinacion;
    if (!r) return null;
    const pct = Math.round(r.autosuficiencia * 100);
    const deerPark = r.procesoDeerPark > 0 ? `, más ${Math.round(r.procesoDeerPark)} en Deer Park` : '';
    return {
      proceso: Math.round(r.proceso),
      pct,
      detalle:
        `Crudo que procesan las refinerías de Pemex en México: ${Math.round(r.proceso)} mil barriles diarios${deerPark}.\n` +
        `Hacen ${Math.round(r.combustibles)} mil barriles diarios de gasolina, diésel y turbosina: el ${pct} % de los ` +
        `${DEMANDA_COMBUSTIBLES.toLocaleString('es-MX')} mil que el país usaba en diciembre de 2018. El resto se importa.`,
    };
  });

  /** What the player's trains have exported this game year, and in all. */
  const exportado = $derived.by(() => {
    sim.horas;
    const año = añoDe(sim.horas);
    return { año, t: sim.exportacion.porAño[String(año)] ?? 0, total: sim.exportacion.total };
  });
  /** Tonnes, short enough for the bar as they grow: "9,790", "262 mil", "2.6 M". */
  const toneladas = (n: number) =>
    n < 1e5 ? personas(n) : n < 1e6 ? `${Math.round(n / 1e3).toLocaleString('es-MX')} mil` : `${(n / 1e6).toLocaleString('es-MX', { maximumFractionDigits: 1 })} M`;

  /** The domestic cargo the player's trains delivered this game year: tonnes and tonne-km. */
  const nacional = $derived.by(() => {
    sim.horas;
    const año = String(añoDe(sim.horas));
    return { t: sim.cargaNacional.porAño[año] ?? 0, tkm: sim.cargaNacional.tkmPorAño[año] ?? 0, total: sim.cargaNacional.total };
  });

  const obrasEnCurso = $derived(cuenta.enCurso + cuenta.viasEnObra + enObraCfe);
  const obrasDetenidas = $derived(cuenta.detenidas + cuenta.viasDetenidas);
  const obrasHechas = $derived(cuenta.operando + cuenta.viasEnServicio + hechasCfe);
</script>

<div class="erario panel">
  {#if real}
    <div class="celda caja" title={`Presupuesto federal para ferrocarriles de ese año: ${mdp(real.federal)} de pesos (Cuenta Pública y Presupuesto de Egresos): subfunción de transporte por ferrocarril, Tren Maya y Ferrocarril del Istmo.`}>
      <span class="label">Trenes {real.año} · {real.serie}</span>
      <span class="valor"><b class="mono">{corto(real.federal)}</b></span>
    </div>
    <div class="celda doble" title={`Vías del catálogo en su etapa real. Además, ${real.anunciadas} vías anunciadas sin obra.`}>
      <span class="label">Vías operando</span>
      <span class="valor"><b class="mono">{real.enOperacion}</b> · <b class="mono">{km(real.kmOperacion)}</b></span>
      <span class="label">En obra</span>
      <span class="valor"><b class="mono">{real.enObra}</b> · <b class="mono">{km(real.kmObra)}</b></span>
    </div>
    <div class="celda doble" title={`Centrales de la CFE del catálogo en su etapa real: ${real.cfe.enOperacion} en operación, ${real.cfe.enObra} en obra. Polos del Bienestar con declaratoria en el DOF, y los que ya operan.`}>
      <span class="label cfe">Centrales CFE</span>
      <span class="valor"><b class="mono">{personas(real.cfe.mwOperacion)}</b> MW <span class="dim">· {real.cfe.enObra} en obra</span></span>
      <span class="label">Polos</span>
      <span class="valor"><b class="mono">{real.polos.operando}</b> de {real.polos.operando + real.polos.declarados} operando</span>
    </div>
    <div class="celda opcional" class:doble={real.ferro !== null && real.ferroNacional !== null} title="Millones de toneladas que llevó el tren ese año: las que salieron del país por fronteras y puertos, y la carga nacional (ATTRAPI)">
      {#if real.ferro !== null && real.ferroNacional !== null}
        <span class="label export">Tren · exportado</span>
        <span class="valor"><b class="mono">{real.ferro.toLocaleString('es-MX')}</b> Mt</span>
        <span class="label">Tren · nacional</span>
        <span class="valor"><b class="mono">{real.ferroNacional.toLocaleString('es-MX')}</b> Mt</span>
      {:else}
        <span class="label export">Carga por tren {real.año}</span>
        <span class="valor dim">sin dato aún</span>
      {/if}
    </div>
    <div class="celda doble opcional" title={`${PETROLEO.totales.dato}${real.refino?.parcial ? `\n${real.año}: ${real.refino.parcial}.` : ''}\nCarga aérea de todo el país (AFAC)${real.carga.parcial ? ', de enero a septiembre' : ''}.`}>
      <span class="label pemex">Refinación {real.año}{real.refino?.parcial ? '*' : ''}</span>
      <span class="valor">{#if real.refino}<b class="mono">{Math.round(real.refino.mbd).toLocaleString('es-MX')}</b> mil b/d{:else}<span class="dim">sin dato aún</span>{/if}</span>
      <span class="label aereo">Carga aérea {real.carga.año}{real.carga.parcial ? '*' : ''}</span>
      <span class="valor"><b class="mono">{toneladas(real.carga.t)}</b> t</span>
    </div>
    <button class="celda obras-via" class:abierto={tablero.catalogo} onclick={() => (tablero.catalogo ? tablero.cerrarCatalogo() : tablero.abrirCatalogo())}>
      <span class="label">Obras</span>
      <span class="valor ir">Ver todas {tablero.catalogo ? '×' : '→'}</span>
    </button>
  {:else}
    <div class="celda caja" title={`En caja: ${mdp(cuenta.dinero)} de pesos (M: millones).` + (llegada ? String.fromCharCode(10) + llegada.detalle : '')}>
      <span class="label">Presupuesto</span>
      <span class="valor">
        <b class="mono" class:agotado={cuenta.dinero < 1}>{corto(cuenta.dinero)}</b>
        {#if llegada}<span class="mes">{alMes(llegada.total)}</span>{/if}
      </span>
    </div>
    <!-- The two state companies' tills, one over the other. -->
    <div class="celda caja doble tres" title={`${detalleCfe}\n\n${detallePemex}`}>
      <span class="label cfe">CFE</span>
      <b class="mono" class:agotado={sim.dineroCfe < 1}>{corto(sim.dineroCfe)}</b>
      <span class="mes">{alMes(CAJA_CFE_MES)}</span>
      <span class="label pemex">Pemex</span>
      <b class="mono" class:agotado={sim.dineroPemex < 1 && sim.cajaPemexMes > 0}>{corto(sim.dineroPemex)}</b>
      <span class="mes">{alMes(sim.cajaPemexMes)}</span>
    </div>
    <div class="celda doble opcional" title="Permanentes: los que dan las empresas de los polos que operan. En obra: los que trabajan en las obras del Estado mientras duran.">
      <span class="label">Empleos fijos</span>
      <span class="valor"><b class="mono">{personas(cuenta.permanentes)}</b></span>
      <span class="label">En obra</span>
      <span class="valor"><b class="mono">{personas(cuenta.enObra)}</b></span>
    </div>
    <div
      class="celda doble"
      title={`Exportado: lo que tus trenes llevaron de un origen a una salida del país (aduana fronteriza, puerto o aeropuerto); en total, ${personas(exportado.total)} t.\nNacional: lo que entregaron de una parada a la siguiente; este año ${personas(nacional.tkm / 1e6)} millones de toneladas-km, en total ${personas(nacional.total)} t.`}
    >
      <span class="label export">Exportado {exportado.año}</span>
      <span class="valor"><b class="mono export">{toneladas(exportado.t)}</b> t</span>
      <span class="label">Carga nacional</span>
      <span class="valor"><b class="mono">{toneladas(nacional.t)}</b> t</span>
    </div>
    {#if refino}
      <div class="celda doble" title={refino.detalle}>
        <span class="label pemex">Refinación</span>
        <span class="valor"><b class="mono">{refino.proceso}</b> mil b/d</span>
        <span class="label pemex">Combustibles</span>
        <span class="valor"><b class="mono">{refino.pct} %</b> del consumo</span>
      </div>
    {/if}
    <!-- The State's works and the way into their catalog, in one cell. -->
    <button
      class="celda obras-via"
      class:abierto={tablero.catalogo}
      title="Catálogo de obras del Estado"
      onclick={() => (tablero.catalogo ? tablero.cerrarCatalogo() : tablero.abrirCatalogo())}
    >
      <span class="label">Obras del Estado</span>
      <span class="valor">
        <span>
          {obrasEnCurso} en obra{#if obrasDetenidas}<span class="alerta"> ({obrasDetenidas} detenida{obrasDetenidas > 1 ? 's' : ''})</span>{/if}
          · {obrasHechas} hechas
        </span>
        <span class="ir">{tablero.catalogo ? '×' : '→'}</span>
      </span>
    </button>
  {/if}
</div>

<style>
  /* A bar along the top, from the clock to the book. */
  .erario {
    position: fixed;
    top: 1rem;
    left: calc(1rem + 260px + 0.5rem);
    right: calc(1rem + var(--libro) + 0.5rem);
    z-index: 30;
    display: flex;
    align-items: stretch;
    min-height: var(--libro);
    padding: 0.4rem 0.4rem;
    font-size: 0.76rem;
    overflow: hidden;
  }

  .celda {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 0.12rem;
    flex: none;
    padding: 0 0.55rem;
    border-left: 1px solid var(--line);
    white-space: nowrap;
  }

  .celda:first-child {
    border-left: 0;
  }

  .label {
    font-size: 0.6rem;
  }

  .valor {
    display: flex;
    align-items: baseline;
    gap: 0.4rem;
  }

  b {
    font-weight: 600;
  }

  .caja {
    cursor: help;
  }

  .caja b {
    font-size: 0.9rem;
  }

  .mes {
    font-size: 0.68rem;
    color: #b7f5cf;
  }

  .cfe {
    color: #fde68a;
  }

  .pemex {
    color: #e0a458;
  }

  /* Two figures in one cell, label and value on each line (three columns for the tills: label, money, monthly payment). */
  .doble {
    display: grid;
    grid-template-columns: auto auto;
    column-gap: 0.4rem;
    row-gap: 0.12rem;
    align-content: center;
    align-items: baseline;
  }

  .doble.tres {
    grid-template-columns: auto auto auto;
  }

  .doble .valor {
    gap: 0.3rem;
  }

  .doble.caja b {
    font-size: 0.78rem;
  }

  .aereo {
    color: #c7d2fe;
  }

  .export {
    color: #fcd34d;
  }

  .agotado {
    color: #ff9b9b;
  }

  .dim {
    color: var(--muted);
  }

  .alerta {
    color: #ff9b9b;
  }

  /* The way into the catalog, at the far end of the bar. */
  .obras-via {
    margin-left: auto;
    background: none;
    border-top: 0;
    border-bottom: 0;
    border-right: 0;
    color: var(--muted);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .obras-via .ir {
    color: #f4f1de;
  }

  .obras-via:hover .ir,
  .obras-via.abierto .ir {
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  /* Less room: the secondary cells give way, then the bar. */
  @media (max-width: 1400px) {
    .celda.opcional {
      display: none;
    }
  }

  @media (max-width: 1000px) {
    .erario {
      display: none;
    }
  }
</style>
