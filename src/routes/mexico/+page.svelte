<script lang="ts">
  import MexicoMap from '$lib/map/MexicoMap.svelte';
  import Capas from '$lib/ui/Capas.svelte';
  import CatalogoObras from '$lib/ui/CatalogoObras.svelte';
  import Erario from '$lib/ui/Erario.svelte';
  import FichaPolo from '$lib/ui/FichaPolo.svelte';
  import Flota from '$lib/ui/Flota.svelte';
  import Reloj from '$lib/ui/Reloj.svelte';
  import Trazado from '$lib/ui/Trazado.svelte';
  import { sim } from '$lib/state/simulacion.svelte';
  import { tablero } from '$lib/state/tablero.svelte';
</script>

<svelte:head>
  <title>Ruta Logística · México</title>
</svelte:head>

<MexicoMap />
<Reloj />
<Erario />
<!-- The left column, under the clock: the layers, and the fleet when trains or ships are on. -->
<div class="columna">
  <Capas />
  {#if sim.modo === 'juego' && (tablero.capas.trenes || tablero.capas.barcos)}
    <Flota />
  {/if}
</div>
{#if sim.modo === 'juego'}
  <Trazado />
{/if}
<FichaPolo />
<CatalogoObras />

<style>
  /* No backdrop or transform here: the vehicle card inside Flota is fixed to the window. */
  .columna {
    position: fixed;
    top: 6.55rem;
    left: 1rem;
    bottom: calc(1rem + var(--vistas-alto) + 0.6rem);
    z-index: 30;
    width: 260px;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    pointer-events: none;
  }

  .columna > :global(*) {
    pointer-events: auto;
  }

  /* Both folded, the roster would sit on Tijuana's label: it drops below it. */
  .columna:has(:global(nav.capas.plegado)) > :global(aside.flota.plegado) {
    margin-top: 3.75rem;
  }
</style>
