<script lang="ts">
  import { onMount } from 'svelte';
  import { DUEÑOS } from '$lib/domain/red';
  import { COLOR_DUEÑO, COLOR_USO } from '$lib/map/simbolos';
  import { Plegable } from '$lib/state/plegable.svelte';
  import { sim } from '$lib/state/simulacion.svelte';
  import { tablero } from '$lib/state/tablero.svelte';

  /**
   * The track's legend, in the left column under the trains' roster: what the
   * track's colour says (class, owner or use) and what each line means. Folds
   * to its title like the other panels of the column.
   */
  const MODOS = [
    { id: 'clase', label: 'Clase' },
    { id: 'dueño', label: 'Dueño' },
    { id: 'uso', label: 'Uso' },
  ] as const;
  const panel = new Plegable('leyenda-vias');
  onMount(() => panel.recordar());
</script>

<section class="vias panel" class:plegado={panel.plegado} aria-label="Vías férreas">
  <button
    class="plegar"
    aria-expanded={!panel.plegado}
    title={panel.plegado ? 'Mostrar la leyenda de las vías' : 'Plegar la leyenda de las vías'}
    onclick={() => panel.alternar()}
  >
    <span class="label">Vías férreas</span>
    <svg class="flecha" viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path d="M2.5 7.5 6 4l3.5 3.5" /></svg>
  </button>
  {#if !panel.plegado}
    <div class="modos" role="group" aria-label="Color de las vías">
      {#each MODOS as m (m.id)}
        <button class="modo" aria-pressed={tablero.modoVias === m.id} onclick={() => (tablero.modoVias = m.id)}>{m.label}</button>
      {/each}
    </div>
    <ul class="leyenda">
      {#if tablero.modoVias === 'dueño'}
        {#each Object.entries(DUEÑOS) as [id, d] (id)}
          {#if id !== 'ADMICARGA' && id !== 'EST'}
            <li><span class="raya" style:background={COLOR_DUEÑO[id]}></span>{id === 'FIT' ? 'Del Estado (Istmo)' : d.nombre}</li>
          {/if}
        {/each}
      {:else if tablero.modoVias === 'uso'}
        <li><span class="raya" style:background={COLOR_USO.holgada}></span>Holgada · hasta 60 %</li>
        <li><span class="raya" style:background={COLOR_USO.cargada}></span>Cargada · los trenes frenan</li>
        <li><span class="raya" style:background={COLOR_USO.saturada}></span>Saturada · más de lo que cabe</li>
      {/if}
      <li><span class="raya estado"></span>Obra del Estado{sim.modo === 'realidad' ? ' en operación' : ''}</li>
      {#if sim.modo === 'realidad'}
        <li><span class="raya en-obra"></span>En obra</li>
        <li><span class="raya anunciada"></span>Anunciada</li>
      {/if}
      <li><span class="raya muerta"></span>Fuera de operación</li>
    </ul>
  {/if}
</section>

<style>
  .vias {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 0.5rem 0.55rem 0.55rem;
    font-size: 0.7rem;
  }

  .plegar {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.1rem 0.15rem;
    border: 0;
    background: none;
    color: var(--muted);
    cursor: pointer;
  }

  .plegar .label {
    flex: 1;
    text-align: left;
    font-size: 0.62rem;
  }

  .plegar:hover {
    color: var(--ink);
  }

  .flecha {
    flex: none;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
    transition: transform 0.15s;
  }

  .plegado .flecha {
    transform: rotate(180deg);
  }

  .modos {
    display: flex;
    gap: 0.25rem;
    padding: 0.2rem;
    border-radius: 9px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--line);
  }

  .modo {
    flex: 1;
    padding: 0.25rem 0;
    border: 0;
    border-radius: 7px;
    background: none;
    font-size: 0.68rem;
    color: var(--muted);
    cursor: pointer;
  }

  .modo:hover {
    color: var(--ink);
  }

  .modo[aria-pressed='true'] {
    background: rgba(255, 209, 102, 0.14);
    color: #fff1cc;
  }

  .leyenda {
    list-style: none;
    margin: 0;
    padding: 0 0.15rem;
    display: grid;
    gap: 0.28rem;
    color: var(--muted);
  }

  .leyenda li {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .raya {
    flex: none;
    width: 16px;
    height: 3px;
    border-radius: 2px;
  }

  .raya.estado {
    height: 4px;
    background: #f4f1de;
    box-shadow: 0 0 0 1px rgba(244, 241, 222, 0.35);
  }

  .raya.en-obra {
    height: 0;
    border-top: 2px dashed rgba(244, 241, 222, 0.85);
  }

  .raya.anunciada {
    height: 0;
    border-top: 2px dotted rgba(244, 241, 222, 0.5);
  }

  .raya.muerta {
    height: 0;
    border-top: 2px dashed rgba(138, 164, 194, 0.55);
    border-radius: 0;
  }
</style>
