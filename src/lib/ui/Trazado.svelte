<script lang="ts">
  import { CLASES_BARCO, type ClaseBarco } from '$lib/domain/barcos';
  import { tablero } from '$lib/state/tablero.svelte';
  import { duracion, km } from './formato';

  /**
   * Laying out a new train or ship: click stops on the map, in order, then
   * dispatch. The map does the picking (it knows what's under the cursor);
   * this strip shows the stops so far and the buttons. A ship also takes a
   * class, and its loop closes back on the first port. Keyboard: Enter
   * dispatches, Backspace drops the last stop, Esc cancels.
   */

  const esBarco = $derived(tablero.tipoNuevo === 'barco');
  const clases = Object.entries(CLASES_BARCO) as [ClaseBarco, (typeof CLASES_BARCO)[ClaseBarco]][];

  function despachar() {
    const id = tablero.despachar();
    if (id) tablero.volarA(id);
  }

  function onKey(event: KeyboardEvent) {
    if (!tablero.trazando) return;
    const el = event.target as HTMLElement | null;
    if (el?.closest('input, textarea, select, [contenteditable]')) return;
    if (event.key === 'Escape') tablero.cancelar();
    else if (event.key === 'Enter' && tablero.paradas.length >= 2) {
      event.preventDefault();
      despachar();
    } else if (event.key === 'Backspace') {
      event.preventDefault();
      tablero.quitarUltima();
    }
  }
</script>

<svelte:window onkeydown={onKey} />

{#if tablero.trazando}
  <div class="trazado panel" class:mar={esBarco} role="status">
    {#if esBarco}
      <div class="clases" role="radiogroup" aria-label="Clase de barco">
        {#each clases as [clave, c] (clave)}
          <button
            class="ctl"
            role="radio"
            aria-checked={tablero.claseBarco === clave}
            class:is-active={tablero.claseBarco === clave}
            onclick={() => tablero.cambiarClase(clave)}
          >
            {c.nombre} <span class="mono">{c.nudos} kn</span>
          </button>
        {/each}
      </div>
    {/if}
    <div class="fila">
      <span class="label">{esBarco ? 'Nuevo barco' : 'Nuevo tren'}</span>
      {#if !tablero.paradas.length}
        <span class="ayuda">
          {esBarco ? 'Elige en el mapa el puerto (o la salida al mundo) de origen' : 'Elige en el mapa la estación de origen'}
        </span>
      {:else}
        <ol class="paradas">
          {#each tablero.paradas as clave, i (clave + i)}
            <li><b class="mono">{i + 1}</b>{tablero.nombre(clave)}</li>
          {/each}
        </ol>
        {#if tablero.paradas.length >= 2}
          <span class="mono total">
            {km(tablero.kmElegida)} · {duracion(tablero.horasElegida)}{esBarco ? ' por vuelta, sin escalas' : ''}
          </span>
        {:else}
          <span class="ayuda">{esBarco ? 'Ahora la siguiente escala' : 'Ahora el destino (o más paradas)'}</span>
        {/if}
      {/if}
    </div>
    {#if esBarco && tablero.paradas.length >= 2}
      <p class="nota">Recorre las escalas en ciclo y vuelve a {tablero.nombre(tablero.paradas[0])}.</p>
    {/if}
    {#if tablero.aviso}
      <p class="aviso">{tablero.aviso}</p>
    {/if}
    <div class="botones">
      <button class="ctl" onclick={() => tablero.quitarUltima()} disabled={!tablero.paradas.length}>Deshacer</button>
      <button class="ctl" onclick={() => tablero.cancelar()}>Cancelar</button>
      <button class="ctl despachar" onclick={despachar} disabled={tablero.paradas.length < 2}>
        {esBarco ? 'Zarpar' : 'Despachar tren'}
      </button>
    </div>
  </div>
{/if}

<style>
  .trazado {
    position: fixed;
    top: 5.2rem;
    left: 50%;
    transform: translateX(-50%);
    z-index: 32;
    max-width: min(600px, calc(100vw - 2rem));
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.6rem 0.75rem;
    border-color: rgba(255, 209, 102, 0.4);
  }

  .fila {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.6rem;
  }

  .ayuda {
    font-size: 0.8rem;
    color: #ffe2a3;
  }

  .paradas {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .paradas li {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.15rem 0.5rem 0.15rem 0.2rem;
    border-radius: 999px;
    background: rgba(255, 209, 102, 0.1);
    border: 1px solid rgba(255, 209, 102, 0.3);
    font-size: 0.74rem;
  }

  .paradas b {
    display: inline-grid;
    place-items: center;
    width: 1.1rem;
    height: 1.1rem;
    border-radius: 50%;
    background: var(--warn);
    color: #1a1205;
    font-size: 0.62rem;
  }

  .total {
    font-size: 0.74rem;
    color: var(--muted);
  }

  .aviso {
    margin: 0;
    font-size: 0.72rem;
    color: #ffc1c1;
  }

  .botones {
    display: flex;
    justify-content: flex-end;
    gap: 0.35rem;
  }

  .botones .ctl {
    padding: 0.3rem 0.65rem;
    font-size: 0.72rem;
  }

  .botones .ctl:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .despachar:not(:disabled) {
    border-color: rgba(255, 209, 102, 0.55);
    background: rgba(255, 209, 102, 0.14);
    color: #fff1cc;
  }

  .despachar:not(:disabled):hover {
    background: rgba(255, 209, 102, 0.22);
  }

  /* Laying out a ship: the same strip, in the sea's cyan. */
  .trazado.mar {
    border-color: rgba(76, 201, 255, 0.4);
  }

  .mar .ayuda {
    color: #bfeaff;
  }

  .mar .paradas li {
    background: rgba(76, 201, 255, 0.1);
    border-color: rgba(76, 201, 255, 0.3);
  }

  .mar .paradas b {
    background: var(--accent);
    color: #04121f;
  }

  .mar .despachar:not(:disabled) {
    border-color: rgba(76, 201, 255, 0.55);
    background: rgba(76, 201, 255, 0.14);
    color: #d6f2ff;
  }

  .mar .despachar:not(:disabled):hover {
    background: rgba(76, 201, 255, 0.22);
  }

  .clases {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
  }

  .clases .ctl {
    padding: 0.25rem 0.55rem;
    font-size: 0.7rem;
  }

  .clases .ctl .mono {
    font-size: 0.6rem;
    color: var(--muted);
  }

  .nota {
    margin: 0;
    font-size: 0.7rem;
    color: var(--muted);
  }
</style>
