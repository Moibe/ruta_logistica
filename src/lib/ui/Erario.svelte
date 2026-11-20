<script lang="ts">
  import { sim } from '$lib/state/simulacion.svelte';
  import { tablero } from '$lib/state/tablero.svelte';
  import { añoCompleto, FEDERAL } from '$lib/domain/presupuesto';
  import { mdp, personas } from './formato';

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

  const obrasEnCurso = $derived(cuenta.enCurso + cuenta.viasEnObra);
  const obrasDetenidas = $derived(cuenta.detenidas + cuenta.viasDetenidas);
  const obrasHechas = $derived(cuenta.operando + cuenta.viasEnServicio);
</script>

<div class="erario panel">
  <div class="fila">
    <span class="label">Presupuesto</span>
    <b class="mono" class:agotado={cuenta.dinero < 1}>{mdp(cuenta.dinero)}</b>
  </div>
  {#if llegada}
    <div class="fila llegada" title={llegada.detalle}>
      <span class="label">Cada mes</span>
      <span><b class="mono">+{mdp(llegada.total)}</b></span>
      <span class="dim">· presupuesto {llegada.año}</span>
    </div>
  {/if}
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
</div>

<style>
  .erario {
    position: fixed;
    top: 1rem;
    right: calc(1rem + var(--libro) + 0.5rem);
    z-index: 30;
    width: 300px;
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

  .fila:first-child b {
    font-size: 0.92rem;
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

  .llegada {
    cursor: help;
  }

  .llegada b {
    color: #b7f5cf;
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
