<script lang="ts">
  import { page } from '$app/state';

  /**
   * Two scales of the same geography. "Mundo" is where Mexico sits — the flat
   * projection and the sphere from the `global` project, fed by the same
   * coastline data. "México" is the board the game is played on.
   */
  const MUNDO = [
    { href: '/mundo/canvas', label: 'Canvas 2D', hint: 'd3-geo · plano' },
    { href: '/mundo/globo', label: 'Globo 3D', hint: 'three · esfera' },
  ];
  const MEXICO = { href: '/mexico', label: 'México', hint: 'el tablero' };
</script>

<nav class="panel">
  <a class="brand" href="/">
    <span class="dot"></span>
    <span class="mono">RUTA LOGÍSTICA</span>
  </a>
  <div class="group">
    <span class="label scale">Mundo</span>
    {#each MUNDO as view (view.href)}
      <a class="ctl" class:is-active={page.url.pathname === view.href} href={view.href}>
        <span>{view.label}</span>
        <span class="hint">{view.hint}</span>
      </a>
    {/each}
  </div>
  <div class="group board">
    <a class="ctl" class:is-active={page.url.pathname === MEXICO.href} href={MEXICO.href}>
      <span>{MEXICO.label}</span>
      <span class="hint">{MEXICO.hint}</span>
    </a>
  </div>
  <a
    class="libro"
    class:is-active={page.url.pathname === '/enciclopedia'}
    href="/enciclopedia"
    title="Enciclopedia: de dónde sale cada dato y con qué reglas se juega"
    aria-label="Enciclopedia"
  >
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path d="M12 6.5C10.2 5.2 7.6 4.6 4 4.75v13.5c3.6-.15 6.2.45 8 1.75 1.8-1.3 4.4-1.9 8-1.75V4.75c-3.6-.15-6.2.45-8 1.75Z" />
      <path d="M12 6.5V20" />
    </svg>
  </a>
</nav>

<style>
  nav {
    position: fixed;
    top: 1rem;
    left: 50%;
    transform: translateX(-50%);
    z-index: 40;
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.5rem 0.75rem 0.5rem 1rem;
  }

  .brand {
    flex: none;
    white-space: nowrap;
    display: flex;
    align-items: center;
    gap: 0.55rem;
    font-size: 0.68rem;
    letter-spacing: 0.2em;
    color: var(--muted);
    padding-right: 1rem;
    border-right: 1px solid var(--line);
  }

  .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--warn);
    box-shadow: 0 0 10px var(--warn);
  }

  .group {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .board {
    padding-left: 1rem;
    border-left: 1px solid var(--line);
  }

  .scale {
    margin-right: 0.2rem;
  }

  .group .ctl {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.1rem;
    padding: 0.35rem 0.7rem;
    font-size: 0.8rem;
    /* Never let a card shrink below its label: squeezed, the hint wraps onto a
       third line and the whole bar grows taller instead of wider. */
    flex: none;
    white-space: nowrap;
  }

  /* The board is the destination: amber, the rail colour, instead of cyan. */
  .board .ctl.is-active {
    background: rgba(255, 209, 102, 0.12);
    border-color: rgba(255, 209, 102, 0.5);
    color: #fff1cc;
  }

  .board .ctl:hover {
    background: rgba(255, 209, 102, 0.1);
    border-color: rgba(255, 209, 102, 0.4);
  }

  /* The encyclopedia: a book at the end of the bar, present in every view. */
  .libro {
    flex: none;
    display: grid;
    place-items: center;
    width: 2.2rem;
    height: 2.2rem;
    margin-left: -0.2rem;
    border-radius: 10px;
    border: 1px solid var(--line);
    color: var(--muted);
    transition:
      color 0.15s,
      background 0.15s,
      border-color 0.15s;
  }

  .libro svg {
    fill: none;
    stroke: currentColor;
    stroke-width: 1.6;
    stroke-linejoin: round;
    stroke-linecap: round;
  }

  .libro:hover {
    color: var(--ink);
    background: rgba(126, 190, 255, 0.08);
  }

  .libro.is-active {
    color: var(--accent);
    background: var(--accent-soft);
    border-color: rgba(76, 201, 255, 0.45);
  }

  .hint {
    font-size: 0.58rem;
    letter-spacing: 0.08em;
    color: var(--muted);
  }

  @media (max-width: 820px) {
    .brand,
    .scale,
    .hint {
      display: none;
    }
  }
</style>
