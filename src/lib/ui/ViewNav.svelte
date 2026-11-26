<script lang="ts">
  import { page } from '$app/state';

  /**
   * The views, kept out of the way: a small pill in the top-right corner, next
   * to the book, that says where you are and opens the list downward on click. Two scales of the
   * same geography — "Mundo" is where Mexico sits (the flat projection and the
   * sphere from the `global` project); "México" is the board the game is
   * played on.
   */
  const MUNDO = [
    { href: '/mundo/canvas', label: 'Canvas 2D', hint: 'd3-geo · plano' },
    { href: '/mundo/globo', label: 'Globo 3D', hint: 'three · esfera' },
  ];
  const MEXICO = { href: '/mexico', label: 'México', hint: 'el tablero' };
  const NOMBRES: Record<string, string> = {
    ...Object.fromEntries([...MUNDO, MEXICO].map((v) => [v.href, v.label])),
    '/enciclopedia': 'Enciclopedia',
  };

  let abierto = $state(false);
  let raiz: HTMLElement;

  const actual = $derived(NOMBRES[page.url.pathname] ?? 'Vistas');

  // Any navigation closes it.
  $effect(() => {
    page.url.pathname;
    abierto = false;
  });

  function fuera(e: PointerEvent) {
    if (abierto && !raiz.contains(e.target as Node)) abierto = false;
  }

  function tecla(e: KeyboardEvent) {
    if (abierto && e.key === 'Escape') abierto = false;
  }
</script>

<svelte:window onpointerdown={fuera} onkeydown={tecla} />

<nav class="vistas" bind:this={raiz}>
  {#if abierto}
    <div class="menu panel">
      <a class="brand" href="/">
        <span class="dot"></span>
        <span class="mono">RUTA LOGÍSTICA</span>
      </a>
      <span class="label">Mundo</span>
      {#each MUNDO as view (view.href)}
        <a class="ctl" class:is-active={page.url.pathname === view.href} href={view.href}>
          <span>{view.label}</span>
          <span class="hint">{view.hint}</span>
        </a>
      {/each}
      <span class="label">Tablero</span>
      <a class="ctl board" class:is-active={page.url.pathname === MEXICO.href} href={MEXICO.href}>
        <span>{MEXICO.label}</span>
        <span class="hint">{MEXICO.hint}</span>
      </a>
    </div>
  {/if}

  <button
    class="pastilla panel"
    class:abierto
    aria-expanded={abierto}
    aria-label="Vistas"
    title="Cambiar de vista"
    onclick={() => (abierto = !abierto)}
  >
    <!-- An eye under a stepped brow: the stepped fret of Mesoamerican temples
         and codices, read as "looking out" over the land. -->
    <svg class="ojo" viewBox="0 0 24 24" width="25" height="25" aria-hidden="true">
      <path d="M3 7.5h3.5v-2h3v-2h5v2h3v2H21" />
      <path d="M2.5 14c3.5-4.6 15.5-4.6 19 0-3.5 4-15.5 4-19 0Z" />
      <circle cx="12" cy="12.9" r="2.7" />
    </svg>
    <span class="nombre">{actual}</span>
    <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path d="M2.5 7.5 6 4l3.5 3.5" /></svg>
  </button>
</nav>

<style>
  .vistas {
    position: fixed;
    top: 1rem;
    right: calc(1rem + var(--libro) + 0.5rem);
    z-index: 40;
  }

  /* As tall as the book beside it. */
  .pastilla {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    width: var(--vistas);
    height: var(--libro);
    padding: 0 0.65rem;
    font-size: 0.72rem;
    color: var(--muted);
    cursor: pointer;
    transition:
      color 0.15s,
      border-color 0.15s;
  }

  .pastilla:hover,
  .pastilla.abierto {
    color: var(--ink);
    border-color: rgba(126, 190, 255, 0.3);
  }

  .nombre {
    flex: 1;
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* "Views": an eye, lit like the brand dot. */
  .pastilla .ojo {
    stroke: var(--warn);
    stroke-width: 1.8;
    filter: drop-shadow(0 0 3px var(--warn));
    transform: none;
  }

  .pastilla .ojo circle {
    fill: var(--warn);
    stroke: none;
  }

  .pastilla.abierto .ojo {
    transform: none;
  }

  /* The chevron points down, where the list opens, and turns up while it's open. */
  .pastilla svg {
    flex: none;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
    transform: rotate(180deg);
    transition: transform 0.15s;
  }

  .pastilla.abierto svg {
    transform: none;
  }

  .dot {
    flex: none;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--warn);
    box-shadow: 0 0 8px var(--warn);
  }

  /* ---- the open list, hanging down from the pill -------------------------- */

  .menu {
    position: absolute;
    right: 0;
    top: calc(100% + 0.5rem);
    width: 12.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    padding: 0.7rem;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.1rem 0.2rem 0.6rem;
    margin-bottom: 0.2rem;
    border-bottom: 1px solid var(--line);
    font-size: 0.62rem;
    letter-spacing: 0.2em;
    color: var(--muted);
  }

  .menu .label {
    margin: 0.35rem 0.2rem 0.05rem;
  }

  .menu .ctl {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.05rem;
    padding: 0.35rem 0.65rem;
    font-size: 0.78rem;
  }

  /* The board is the destination: amber, the rail colour, instead of cyan. */
  .menu .board.is-active {
    background: rgba(255, 209, 102, 0.12);
    border-color: rgba(255, 209, 102, 0.5);
    color: #fff1cc;
  }

  .menu .board:hover {
    background: rgba(255, 209, 102, 0.1);
    border-color: rgba(255, 209, 102, 0.4);
  }

  .hint {
    font-size: 0.56rem;
    letter-spacing: 0.08em;
    color: var(--muted);
  }
</style>
