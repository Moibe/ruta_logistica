<script lang="ts">
  import CanvasMap from '$lib/map/CanvasMap.svelte';
  import Flota from '$lib/ui/Flota.svelte';
  import Reloj from '$lib/ui/Reloj.svelte';
</script>

<svelte:head>
  <title>Ruta Logística · Mundo 2D</title>
</svelte:head>

<CanvasMap />
<Reloj />
<Flota vista="mundo" />
