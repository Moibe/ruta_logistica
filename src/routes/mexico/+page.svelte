<script lang="ts">
  import MexicoMap from '$lib/map/MexicoMap.svelte';
  import Erario from '$lib/ui/Erario.svelte';
  import FichaPolo from '$lib/ui/FichaPolo.svelte';
  import Flota from '$lib/ui/Flota.svelte';
  import Reloj from '$lib/ui/Reloj.svelte';
  import Trazado from '$lib/ui/Trazado.svelte';
</script>

<svelte:head>
  <title>Ruta Logística · México</title>
</svelte:head>

<MexicoMap />
<Reloj />
<Erario />
<Flota />
<FichaPolo />
<Trazado />
