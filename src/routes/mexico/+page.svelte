<script lang="ts">
  import MexicoMap from '$lib/map/MexicoMap.svelte';
  import Flota from '$lib/ui/Flota.svelte';
  import Reloj from '$lib/ui/Reloj.svelte';
  import Trazado from '$lib/ui/Trazado.svelte';
</script>

<svelte:head>
  <title>Ruta Logística · México</title>
</svelte:head>

<MexicoMap />
<Reloj />
<Flota />
<Trazado />
