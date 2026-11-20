<script lang="ts">
  import { sim, VELOCIDADES } from '$lib/state/simulacion.svelte';
  import { fechaLarga, horasDeFecha, horasDeHoy, INICIO } from '$lib/domain/calendario';
  import { CORTE_REAL, fechaEnPalabras, HORAS_DEL_CORTE } from '$lib/domain/realidad';

  /**
   * The clock, and the switch between the two ways of looking at the board.
   *
   * In the game: date and time (from 1 December 2018) and how fast it runs; 1×
   * is one game hour per second, and the space bar pauses and resumes.
   *
   * In Realidad the clock doesn't run: it shows a date, today by default, and
   * a timeline from 1 December 2018 to today to see how things stood on any other day.
   */
  const etiqueta = (v: number) => (v === 0 ? '❚❚' : v === 0.25 ? '¼×' : `${v}×`);
  const ayuda = (v: number) => (v === 0 ? 'Pausa (espacio)' : `${v} h de juego por segundo`);

  const realidad = $derived(sim.modo === 'realidad');
  /** Today in game hours, fixed while the panel is up. */
  const hoy = horasDeHoy();
  const dias = Math.floor(hoy / 24);
  const dia = $derived(Math.min(dias, Math.floor(sim.horas / 24)));
  const enHoy = $derived(dia >= dias);
  /** The years along the timeline, each at its 1 January (the first one falls a month in). */
  const años = Array.from({ length: new Date().getUTCFullYear() - INICIO.año + 1 }, (_, i) => INICIO.año + i)
    .map((a) => ({ año: a, pos: (horasDeFecha(String(a)) / 24 / dias) * 100 }))
    .filter((a) => a.pos >= 0);

  function onKey(event: KeyboardEvent) {
    if (event.code !== 'Space' || event.repeat || realidad) return;
    // Space already "clicks" a focused button or types in a field: leave those alone.
    const el = event.target as HTMLElement | null;
    if (el?.closest('button, input, textarea, select, [contenteditable]')) return;
    event.preventDefault();
    sim.alternarPausa();
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="reloj panel" class:realidad>
  <div class="modos" role="radiogroup" aria-label="Modo">
    <button class="ctl" role="radio" aria-checked={!realidad} class:is-active={!realidad} onclick={() => sim.salirRealidad()}>Juego</button>
    <button
      class="ctl"
      role="radio"
      aria-checked={realidad}
      class:is-active={realidad}
      title="Lo que de verdad se ha anunciado, está en obra y ya opera"
      disabled={sim.estado !== 'lista'}
      onclick={() => sim.entrarRealidad()}
    >
      Realidad
    </button>
  </div>

  {#if realidad}
    <div class="tiempo">
      <span class="label fecha">{enHoy ? 'Hoy' : 'Así estaba el'}</span>
      <span class="mono big">{fechaLarga(dia * 24)}</span>
    </div>
    <div class="linea">
      <input
        type="range"
        min="0"
        max={dias}
        step="1"
        value={dia}
        aria-label="Fecha"
        oninput={(e) => sim.irA(+e.currentTarget.value * 24 + 12)}
      />
      <div class="años" aria-hidden="true">
        {#each años as a (a.año)}
          <span style:left="{a.pos}%">{String(a.año).slice(2)}</span>
        {/each}
      </div>
    </div>
    <div class="pie">
      <span class="dim">Datos al {fechaEnPalabras(CORTE_REAL)}{hoy > HORAS_DEL_CORTE + 24 * 45 ? ' (por actualizar)' : ''}</span>
      <button class="ctl" disabled={enHoy} onclick={() => sim.irA(hoy)}>Hoy</button>
    </div>
  {:else}
    <div class="juego">
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
  {/if}
</div>

<style>
  .reloj {
    position: fixed;
    top: 1rem;
    left: 1rem;
    z-index: 30;
    width: 260px;
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    padding: 0.5rem 0.6rem 0.5rem 0.8rem;
  }

  .modos {
    display: flex;
    gap: 0.2rem;
  }

  .modos .ctl {
    flex: 1;
    justify-content: center;
    padding: 0.22rem 0.4rem;
    font-size: 0.68rem;
  }

  .juego {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.6rem;
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

  .linea {
    position: relative;
    padding-bottom: 0.85rem;
  }

  .linea input {
    width: 100%;
    margin: 0;
    accent-color: #ffd166;
    cursor: pointer;
  }

  .años span {
    position: absolute;
    bottom: 0;
    transform: translateX(-10%);
    font-size: 0.56rem;
    opacity: 0.55;
    font-variant-numeric: tabular-nums;
  }

  .pie {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    font-size: 0.62rem;
  }

  .pie .dim {
    opacity: 0.6;
  }

  .pie .ctl {
    padding: 0.2rem 0.55rem;
    font-size: 0.66rem;
  }

  @media (max-width: 900px) {
    .reloj {
      display: none;
    }
  }
</style>
