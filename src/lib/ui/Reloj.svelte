<script lang="ts">
  import { sim, VELOCIDADES } from '$lib/state/simulacion.svelte';

  /**
   * The game clock: date and time (from 1 January 2019), and how fast it runs. 1× is one game hour
   * per second; the space bar pauses and resumes.
   */
  const etiqueta = (v: number) => (v === 0 ? '❚❚' : v === 0.25 ? '¼×' : `${v}×`);
  const ayuda = (v: number) => (v === 0 ? 'Pausa (espacio)' : `${v} h de juego por segundo`);

  function onKey(event: KeyboardEvent) {
    if (event.code !== 'Space' || event.repeat) return;
    // Space already "clicks" a focused button or types in a field: leave those alone.
    const el = event.target as HTMLElement | null;
    if (el?.closest('button, input, textarea, select, [contenteditable]')) return;
    event.preventDefault();
    sim.alternarPausa();
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="reloj panel">
  <div class="tiempo">
    <span class="label fecha">{sim.fecha}</span>
    <span class="mono big">{sim.reloj}</span>
  </div>
  <div class="velocidades">
    {#each VELOCIDADES as v, i (v)}
      <button
        class="ctl"
        class:is-active={sim.velocidad === i}
        title={ayuda(v)}
        aria-label={ayuda(v)}
        onclick={() => (sim.velocidad = i)}
      >
        {etiqueta(v)}
      </button>
    {/each}
  </div>
</div>

<style>
  .reloj {
    position: fixed;
    top: 1rem;
    left: 1rem;
    z-index: 30;
    width: 260px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.6rem;
    padding: 0.5rem 0.6rem 0.5rem 0.8rem;
  }

  .tiempo {
    display: flex;
    flex-direction: column;
    gap: 0.05rem;
    white-space: nowrap;
  }

  .big {
    font-size: 1rem;
    line-height: 1.1;
  }

  .fecha {
    font-size: 0.6rem;
  }

  .velocidades {
    display: flex;
    gap: 0.2rem;
  }

  .velocidades .ctl {
    padding: 0.25rem 0.4rem;
    font-size: 0.68rem;
    min-width: 1.9rem;
    justify-content: center;
  }

  @media (max-width: 900px) {
    .reloj {
      display: none;
    }
  }
</style>
