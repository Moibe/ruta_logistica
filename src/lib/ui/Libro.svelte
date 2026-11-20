<script lang="ts">
  import { page } from '$app/state';

  /**
   * The encyclopedia's door: a little book in the top-right corner, in every
   * view. On the board it sits just right of the State's ledger (`Erario`,
   * which leaves room for it).
   */
  const aqui = $derived(page.url.pathname === '/enciclopedia');
</script>

<a
  class="libro panel"
  class:is-active={aqui}
  href="/enciclopedia"
  title="Enciclopedia: de dónde sale cada dato y con qué reglas se juega"
  aria-label="Enciclopedia"
>
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
    <path d="M12 6.5C10.2 5.2 7.6 4.6 4 4.75v13.5c3.6-.15 6.2.45 8 1.75 1.8-1.3 4.4-1.9 8-1.75V4.75c-3.6-.15-6.2.45-8 1.75Z" />
    <path d="M12 6.5V20" />
  </svg>
</a>

<style>
  .libro {
    position: fixed;
    top: 1rem;
    right: 1rem;
    z-index: 30;
    display: grid;
    place-items: center;
    width: var(--libro);
    height: var(--libro);
    color: var(--muted);
    transition:
      color 0.15s,
      background 0.15s,
      border-color 0.15s;
  }

  svg {
    fill: none;
    stroke: currentColor;
    stroke-width: 1.6;
    stroke-linejoin: round;
    stroke-linecap: round;
  }

  .libro:hover {
    color: var(--ink);
    border-color: rgba(126, 190, 255, 0.3);
  }

  .libro.is-active {
    color: var(--accent);
    background: var(--accent-soft);
    border-color: rgba(76, 201, 255, 0.45);
  }
</style>
