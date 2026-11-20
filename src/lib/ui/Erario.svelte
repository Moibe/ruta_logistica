<script lang="ts">
  import { sim } from '$lib/state/simulacion.svelte';
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
</div>

<style>
  .erario {
    position: fixed;
    top: 1rem;
    right: 1rem;
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

  @media (max-width: 1200px) {
    .erario {
      display: none;
    }
  }
</style>
