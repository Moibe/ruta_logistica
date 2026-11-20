<script lang="ts">
  import { sim } from '$lib/state/simulacion.svelte';
  import { tablero } from '$lib/state/tablero.svelte';
  import { mdp, personas } from './formato';

  /**
   * The State's ledger, always in view: the money left and the jobs the
   * player's works have made. Permanent jobs are the ones that last (companies
   * in the polos); jobs on site end with the work. Reads the clock so it moves
   * as works are paid and polos fill.
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
      viasEnServicio: [...sim.obrasVia.values()].filter((o) => o.fase === 'en-servicio').length,
    };
  });
</script>

<div class="erario panel">
  <div class="fila">
    <span class="label">Presupuesto</span>
    <b class="mono" class:agotado={cuenta.dinero < 1}>{mdp(cuenta.dinero)}</b>
  </div>
  <div class="fila">
    <span class="label">Empleos</span>
    <span><b class="mono">{personas(cuenta.permanentes)}</b> permanentes</span>
    <span class="dim">· <b class="mono">{personas(cuenta.enObra)}</b> en obra</span>
  </div>
  {#if cuenta.enCurso || cuenta.operando}
    <div class="fila obras">
      <span class="label">Polos</span>
      <span>
        {cuenta.enCurso} en obra{#if cuenta.detenidas}<span class="alerta"> ({cuenta.detenidas} detenida{cuenta.detenidas > 1 ? 's' : ''})</span>{/if}
        · {cuenta.operando} operando
      </span>
    </div>
  {/if}
  <button class="fila obras-via" class:abierto={tablero.catalogo} onclick={() => (tablero.catalogo ? tablero.cerrarCatalogo() : tablero.abrirCatalogo())}>
    <span class="label">Vías</span>
    <span>{cuenta.viasEnObra} en obra · {cuenta.viasEnServicio} en servicio</span>
    <span class="ir">Obras del Estado {tablero.catalogo ? '×' : '→'}</span>
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

  .obras {
    color: #f9c6dd;
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
