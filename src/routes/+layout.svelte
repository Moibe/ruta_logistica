<script lang="ts">
  import '../app.css';
  import ViewNav from '$lib/ui/ViewNav.svelte';
  import Libro from '$lib/ui/Libro.svelte';

  let { children } = $props();
</script>

<ViewNav />
<Libro />

{@render children()}
