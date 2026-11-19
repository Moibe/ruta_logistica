<script lang="ts">
  import '../app.css';
  import ViewNav from '$lib/ui/ViewNav.svelte';

  let { children } = $props();
</script>

<ViewNav />

{@render children()}
