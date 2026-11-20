<script lang="ts">
  import { page } from '$app/state';

  /**
   * The views, kept out of the way: a small pill in the bottom-left corner that
   * says where you are and opens the list upward on click. Two scales of the
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
    <svg class="ojo" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
      <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" />
      <circle cx="12" cy="12" r="2.8" />
    </svg>
    <span class="nombre">{actual}</span>
    <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path d="M2.5 7.5 6 4l3.5 3.5" /></svg>
  </button>
</nav>

<style>
  .vistas {
    position: fixed;
    left: 1rem;
    bottom: 1rem;
    z-index: 40;
  }

  .pastilla {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    width: var(--vistas);
    height: var(--vistas-alto);
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
  }

  .pastilla .ojo circle {
    fill: var(--warn);
    stroke: none;
  }

  .pastilla.abierto .ojo {
    transform: none;
  }

  .pastilla svg {
    flex: none;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
    transition: transform 0.15s;
  }

  .pastilla.abierto svg {
    transform: rotate(180deg);
  }

  .dot {
    flex: none;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--warn);
    box-shadow: 0 0 8px var(--warn);
  }

  /* ---- the open list, growing upward from the pill ------------------------ */

  .menu {
    position: absolute;
    left: 0;
    bottom: calc(100% + 0.5rem);
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
