<script lang="ts">
  import GlobeMap from '$lib/map/GlobeMap.svelte';
  import Flota from '$lib/ui/Flota.svelte';
  import Reloj from '$lib/ui/Reloj.svelte';
</script>

<svelte:head>
  <title>Ruta Logística · Globo</title>
</svelte:head>

<GlobeMap />
<Reloj />
<Flota vista="mundo" />
