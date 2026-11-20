<script lang="ts">
  import { sim } from '$lib/state/simulacion.svelte';
  import { tablero } from '$lib/state/tablero.svelte';
  import { añoCompleto, FEDERAL } from '$lib/domain/presupuesto';
  import { CAJA_CFE_MES, ENERGIA } from '$lib/domain/energia';
  import { km, mdp, personas } from './formato';
  import { añoDe } from '$lib/domain/calendario';
  import { OBRAS_VIA } from '$lib/domain/obrasVia';
  import { OBRAS_ENERGIA } from '$lib/domain/energia';
  import { POLOS } from '$lib/domain/sitios';
  import { clavePolo } from '$lib/domain/realidad';

  /** The last year with a real figure: later years repeat it. */
  const ULTIMO_AÑO = FEDERAL.años[FEDERAL.años.length - 1].año;

  /**
   * The State's ledger, always in view: the money in the till and what comes
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
    return { ...cuenta, cfe, polos, año: a.año, federal: a.federal, serie };
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

  const enObraCfe = $derived.by(() => {
    sim.horas;
    return [...sim.obrasEnergia.values()].filter((o) => o.fase === 'en-obra').length;
  });
  const hechasCfe = $derived([...sim.obrasEnergia.values()].filter((o) => o.fase === 'en-servicio').length);

  const obrasEnCurso = $derived(cuenta.enCurso + cuenta.viasEnObra + enObraCfe);
  const obrasDetenidas = $derived(cuenta.detenidas + cuenta.viasDetenidas);
  const obrasHechas = $derived(cuenta.operando + cuenta.viasEnServicio + hechasCfe);
</script>

<div class="erario panel">
  {#if real}
  <div class="fila caja" title="Presupuesto federal para ferrocarriles de ese año (Cuenta Pública y Presupuesto de Egresos): subfunción de transporte por ferrocarril, Tren Maya y Ferrocarril del Istmo.">
    <span class="label">Trenes {real.año}</span>
    <b class="mono">{mdp(real.federal)}</b>
    <span class="mes">{real.serie}</span>
  </div>
  <div class="fila">
    <span class="label">En operación</span>
    <span><b class="mono">{real.enOperacion}</b> obra{real.enOperacion === 1 ? '' : 's'} · <b class="mono">{km(real.kmOperacion)}</b></span>
  </div>
  <div class="fila">
    <span class="label">En obra</span>
    <span><b class="mono">{real.enObra}</b> obra{real.enObra === 1 ? '' : 's'} · <b class="mono">{km(real.kmObra)}</b></span>
    <span class="dim">· {real.anunciadas} anunciadas</span>
  </div>
  <div class="fila" title="Centrales de la CFE del catálogo, en su etapa real">
    <span class="label">Centrales CFE</span>
    <span><b class="mono">{real.cfe.enOperacion}</b> operando · <b class="mono">{personas(real.cfe.mwOperacion)}</b> MW</span>
    <span class="dim">· {real.cfe.enObra} en obra</span>
  </div>
  <div class="fila" title="Polos del Bienestar con declaratoria en el DOF, y los que ya operan">
    <span class="label">Polos</span>
    <span><b class="mono">{real.polos.operando}</b> operando</span>
    <span class="dim">· {real.polos.declarados} declarados sin abrir</span>
  </div>
  <button class="fila obras-via" class:abierto={tablero.catalogo} onclick={() => (tablero.catalogo ? tablero.cerrarCatalogo() : tablero.abrirCatalogo())}>
    <span class="label">Obras</span>
    <span>de vía del catálogo</span>
    <span class="ir">Ver todas {tablero.catalogo ? '×' : '→'}</span>
  </button>
  {:else}
  <div class="fila caja" title={llegada?.detalle}>
    <span class="label">Presupuesto</span>
    <b class="mono" class:agotado={cuenta.dinero < 1}>{mdp(cuenta.dinero)}</b>
    {#if llegada}<span class="mes">{alMes(llegada.total)}</span>{/if}
  </div>
  <div class="fila caja cfe" title={detalleCfe}>
    <span class="label">CFE</span>
    <b class="mono" class:agotado={sim.dineroCfe < 1}>{mdp(sim.dineroCfe)}</b>
    <span class="mes">{alMes(CAJA_CFE_MES)}</span>
  </div>
  <div class="fila">
    <span class="label">Empleos</span>
    <span><b class="mono">{personas(cuenta.permanentes)}</b> permanentes</span>
    <span class="dim">· <b class="mono">{personas(cuenta.enObra)}</b> en obra</span>
  </div>
  <button class="fila obras-via" class:abierto={tablero.catalogo} onclick={() => (tablero.catalogo ? tablero.cerrarCatalogo() : tablero.abrirCatalogo())}>
    <span class="label">Obras</span>
    <span>
      {obrasEnCurso} en obra{#if obrasDetenidas}<span class="alerta"> ({obrasDetenidas} detenida{obrasDetenidas > 1 ? 's' : ''})</span>{/if}
      · {obrasHechas} hechas
    </span>
    <span class="ir">Catálogo {tablero.catalogo ? '×' : '→'}</span>
  </button>
  {/if}
</div>

<style>
  .erario {
    position: fixed;
    top: 1rem;
    right: calc(1rem + var(--libro) + 0.5rem);
    z-index: 30;
    width: 360px;
    display: grid;
    gap: 0.25rem;
    padding: 0.55rem 0.8rem;
    font-size: 0.76rem;
  }

  .fila {
    display: flex;
    align-items: baseline;
    gap: 0.45rem;
    white-space: nowrap;
  }

  .fila .label {
    width: 5.6rem;
    flex: none;
  }

  b {
    font-weight: 600;
  }

  .caja {
    cursor: help;
  }

  .caja .mes {
    margin-left: auto;
    font-size: 0.68rem;
    color: #b7f5cf;
  }

  .cfe .label {
    color: #fde68a;
  }

  .caja b {
    font-size: 0.86rem;
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


  /* The way into the State's catalog of rail works. */
  .obras-via {
    margin-top: 0.2rem;
    padding: 0.3rem 0 0;
    border: 0;
    border-top: 1px solid var(--line);
    background: none;
    font-size: 0.74rem;
    color: var(--muted);
    text-align: left;
    cursor: pointer;
  }

  .obras-via .ir {
    margin-left: auto;
    color: #f4f1de;
  }

  .obras-via:hover .ir,
  .obras-via.abierto .ir {
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  /* Between the centred nav bar and the book there is less room on mid-size
     screens: tighter there, and out of the way below that. */
  @media (max-width: 1340px) {
    .erario {
      width: 260px;
    }

    .fila .label {
      width: 4.6rem;
    }
  }

  @media (max-width: 1240px) {
    .erario {
      display: none;
    }
  }
</style>
