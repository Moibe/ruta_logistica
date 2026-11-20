<script lang="ts">
  import MexicoMap from '$lib/map/MexicoMap.svelte';
  import CatalogoObras from '$lib/ui/CatalogoObras.svelte';
  import Erario from '$lib/ui/Erario.svelte';
  import FichaPolo from '$lib/ui/FichaPolo.svelte';
  import Flota from '$lib/ui/Flota.svelte';
  import Reloj from '$lib/ui/Reloj.svelte';
  import Trazado from '$lib/ui/Trazado.svelte';
  import { sim } from '$lib/state/simulacion.svelte';
</script>

<svelte:head>
  <title>Ruta Logística · México</title>
</svelte:head>

<MexicoMap />
<Reloj />
<Erario />
{#if sim.modo === 'juego'}
  <Flota />
  <Trazado />
{/if}
<FichaPolo />
<CatalogoObras />
