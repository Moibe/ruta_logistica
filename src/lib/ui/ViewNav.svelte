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
