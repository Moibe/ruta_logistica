<script lang="ts">
  import { onMount } from 'svelte';
  import { Plegable } from '$lib/state/plegable.svelte';
  import { sim } from '$lib/state/simulacion.svelte';
  import { tablero, type Capa } from '$lib/state/tablero.svelte';
  import { AEROPUERTO, AVION_SVG, COMBUSTIBLE, GAS, GOTA_SVG, INDUSTRIA, MINERIA, PLATAFORMA, POLO, REFINERIA } from '$lib/map/simbolos';

  /**
   * The board's layers, in a bar along the bottom edge from the views pill to
   * the zoom strip, each with its name and the mark the map draws it with.
   * Three groups: what moves (trains and ships, only in the game: Realidad has
   * no fleet), the territory, and energy and oil.
   */
  type Entrada = { capa: Capa; nombre: string };
  const GRUPOS: { titulo: string; capas: Entrada[]; soloJuego?: boolean }[] = [
    {
      titulo: 'Movimiento',
      soloJuego: true,
      capas: [
        { capa: 'trenes', nombre: 'Trenes' },
        { capa: 'barcos', nombre: 'Barcos' },
      ],
    },
    {
      titulo: 'Territorio',
      capas: [
        { capa: 'estados', nombre: 'Estados' },
        { capa: 'vias', nombre: 'Vías férreas' },
        { capa: 'puertos', nombre: 'Puertos' },
        { capa: 'aeropuertos', nombre: 'Aeropuertos' },
        { capa: 'ciudades', nombre: 'Ciudades' },
        { capa: 'polos', nombre: 'Polos' },
        { capa: 'industrias', nombre: 'Industrias' },
        { capa: 'mineria', nombre: 'Minería' },
      ],
    },
    {
      titulo: 'Energía y petróleo',
      capas: [
        { capa: 'energia', nombre: 'Energía' },
        { capa: 'refinerias', nombre: 'Refinerías' },
        { capa: 'plataformas', nombre: 'Plataformas' },
        { capa: 'ductos', nombre: 'Ductos' },
        { capa: 'combustibles', nombre: 'Combustibles' },
      ],
    },
  ];

  /** The bar folds to its title. */
  const panel = new Plegable('capas');
  const grupos = $derived(GRUPOS.filter((g) => !g.soloJuego || sim.modo === 'juego'));

  /**
   * How much the bar says, richest first: group and layer names, layer names,
   * group names and icons, icons only (a layer's name then shows on hover). It
   * says the most that fits. Hidden copies of the bar, one per level, give each
   * level's width, so a new layer or another window size needs no breakpoint.
   */
  const NIVELES = ['todo', 'nombres', 'grupos', 'iconos'] as const;
  let nivel = $state<(typeof NIVELES)[number]>('nombres');
  let linea: HTMLElement;
  const copias: HTMLElement[] = [];

  onMount(() => {
    panel.recordar();
    const elegir = () => {
      const libre = linea.getBoundingClientRect().width;
      const i = copias.findIndex((c) => c.getBoundingClientRect().width <= libre);
      nivel = NIVELES[i === -1 ? NIVELES.length - 1 : i];
    };
    // The line changes with the window; the copies with the layers on offer (Juego or Realidad) and the fonts.
    const observador = new ResizeObserver(elegir);
    observador.observe(linea);
    for (const c of copias) observador.observe(c);
    return () => observador.disconnect();
  });
</script>

{#snippet marca(capa: Capa)}
  {#if capa === 'trenes'}
    <svg class="sw" width="14" height="8" viewBox="0 0 14 8" aria-hidden="true">
      <rect x="0.5" y="2" width="4" height="4" rx="0.8" fill="#ffd166" />
      <rect x="5" y="2" width="4" height="4" rx="0.8" fill="#ffd166" opacity="0.75" />
      <rect x="9.5" y="2" width="4" height="4" rx="0.8" fill="#ffd166" opacity="0.5" />
    </svg>
  {:else if capa === 'barcos'}
    <svg class="sw" width="14" height="9" viewBox="0 0 14 9" aria-hidden="true">
      <path d="M1 4.5h12l-2 3.5H3z" fill="#4cc9ff" />
      <rect x="5" y="1" width="4" height="3" rx="0.5" fill="#4cc9ff" opacity="0.7" />
    </svg>
  {:else if capa === 'estados'}
    <span class="sw sw-estados"></span>
  {:else if capa === 'vias'}
    <span class="sw sw-vias"></span>
  {:else if capa === 'puertos'}
    <span class="sw sw-puertos"></span>
  {:else if capa === 'aeropuertos'}
    <svg class="sw" width="12" height="12" viewBox="-1.2 -1.2 2.4 2.4" aria-hidden="true">
      <path d={AVION_SVG} fill={AEROPUERTO} transform="rotate(45)" />
    </svg>
  {:else if capa === 'ciudades'}
    <span class="sw sw-ciudades"></span>
  {:else if capa === 'polos'}
    <svg class="sw" width="12" height="11" viewBox="0 0 12 11" aria-hidden="true">
      <polygon
        points="11,5.5 8.5,9.8 3.5,9.8 1,5.5 3.5,1.2 8.5,1.2"
        fill="rgba(244, 114, 182, 0.16)"
        stroke={POLO}
        stroke-width="1.3"
        stroke-dasharray="2 1.4"
      />
    </svg>
  {:else if capa === 'industrias'}
    <svg class="sw" width="13" height="11" viewBox="0 0 13 11" aria-hidden="true">
      <path d="M1 10V1.5l3.7 3.4V1.5l3.6 3.4V1.5L12 4.9V10z" fill={INDUSTRIA} />
    </svg>
  {:else if capa === 'mineria'}
    <svg class="sw" width="13" height="10" viewBox="0 0 13 10" aria-hidden="true">
      <path d="M0.5 9.5 4.5 0.8 7 5 8.8 2.8 12.5 9.5z" fill={MINERIA} />
    </svg>
  {:else if capa === 'energia'}
    <svg class="sw" width="10" height="13" viewBox="0 0 10 13" aria-hidden="true">
      <path d="M6 0 0 7.5h4L3 13l7-8H6z" fill="#facc15" />
    </svg>
  {:else if capa === 'refinerias'}
    <svg class="sw" width="10" height="13" viewBox="-1 -1.3 2 2.6" aria-hidden="true">
      <path d={GOTA_SVG} fill={REFINERIA} />
    </svg>
  {:else if capa === 'plataformas'}
    <svg class="sw" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M3 7 1.8 11.5M9 7l1.2 4.5" stroke={PLATAFORMA} stroke-width="1.3" fill="none" />
      <rect x="1" y="3" width="10" height="4" fill={PLATAFORMA} />
    </svg>
  {:else if capa === 'ductos'}
    <svg class="sw" width="14" height="10" viewBox="0 0 14 10" aria-hidden="true">
      <path d="M1 3h12" stroke={GAS} stroke-width="1.8" />
      <path d="M1 7.5h12" stroke={REFINERIA} stroke-width="1.4" />
    </svg>
  {:else if capa === 'combustibles'}
    <svg class="sw" width="12" height="13" viewBox="0 0 12 13" aria-hidden="true">
      <rect x="1" y="1" width="6.5" height="11" rx="1" fill={COMBUSTIBLE} />
      <rect x="2.3" y="2.4" width="3.9" height="3" rx="0.5" fill="rgba(3, 9, 18, 0.85)" />
      <path d="M7.5 4.2h1.6l1.4 1.5v4.6a0.9 0.9 0 0 1-1.8 0V7.6H7.5" fill="none" stroke={COMBUSTIBLE} stroke-width="1.1" />
    </svg>
  {/if}
{/snippet}

{#snippet contenido(plegado: boolean)}
  <button
    class="plegar"
    aria-expanded={!plegado}
    title={plegado ? 'Mostrar las capas' : 'Plegar las capas'}
    onclick={() => panel.alternar()}
  >
    <span class="label">Capas</span>
    <svg class="flecha" viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path d="M4.5 2.5 8 6l-3.5 3.5" /></svg>
  </button>
  {#if !plegado}
    {#each grupos as g (g.titulo)}
      <!-- Extra room goes to every button alike: each group grows by its number of layers. -->
      <div class="grupo" role="group" aria-label={g.titulo} style:flex-grow={g.capas.length}>
        <span class="label titulo">{g.titulo}</span>
        {#each g.capas as c (c.capa)}
          <button class="ctl" aria-pressed={tablero.capas[c.capa]} aria-label={c.nombre} onclick={() => tablero.alternar(c.capa)}>
            {@render marca(c.capa)}
            <span class="txt">{c.nombre}</span>
          </button>
        {/each}
      </div>
    {/each}
  {/if}
{/snippet}

<div class="linea" bind:this={linea}>
  <nav class="capas panel {nivel}" class:plegado={panel.plegado} aria-label="Capas del mapa">
    {@render contenido(panel.plegado)}
  </nav>
  <!-- One unfolded copy per level, never seen, only measured. -->
  <div class="copias" aria-hidden="true" inert>
    {#each NIVELES as n, i (n)}
      <div class="capas panel {n}" bind:this={copias[i]}>{@render contenido(false)}</div>
    {/each}
  </div>
</div>

<style>
  /* Along the whole bottom edge. */
  .linea {
    position: fixed;
    left: 1rem;
    right: 1rem;
    bottom: 1rem;
    z-index: 30;
    height: var(--vistas-alto);
    pointer-events: none;
  }

  .capas {
    display: flex;
    align-items: stretch;
    width: 100%;
    height: 100%;
    padding: 0.3rem 0.35rem;
    white-space: nowrap;
    pointer-events: auto;
  }

  /* Folded, only its title. */
  .capas.plegado {
    width: max-content;
  }

  .copias {
    position: absolute;
    left: 0;
    bottom: 0;
    visibility: hidden;
    pointer-events: none;
  }

  .copias .capas {
    position: absolute;
    left: 0;
    bottom: 0;
    width: max-content;
  }

  /* The title folds and unfolds the bar, with the arrow of «Vistas» turned on its side. */
  .plegar {
    flex: none;
    display: flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0 0.6rem 0 0.4rem;
    border: 0;
    background: none;
    color: var(--muted);
    cursor: pointer;
    font: inherit;
  }

  .plegar:hover {
    color: var(--ink);
  }

  .flecha {
    flex: none;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
    transform: rotate(180deg);
    transition: transform 0.15s;
  }

  .plegado .flecha {
    transform: none;
  }

  /* The groups, split by the same hairline as the cells of the Erario bar. */
  .grupo {
    flex: 1 0 auto;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0 0.45rem;
    border-left: 1px solid var(--line);
  }

  .grupo:last-child {
    padding-right: 0;
  }

  .titulo {
    flex: none;
    margin-right: 0.3rem;
    font-size: 0.58rem;
  }

  .grupo .ctl {
    position: relative;
    flex: 1 0 auto;
    justify-content: center;
    gap: 0.4rem;
    padding: 0.22rem 0.5rem;
    font-size: 0.72rem;
  }

  /* The levels: «todo» says everything, the others drop the group names, the layer names or both. */
  .nombres .titulo,
  .iconos .titulo {
    display: none;
  }

  .grupos .txt,
  .iconos .txt {
    display: none;
  }

  /* Without its name on the button, a layer says it above, in the panels' glass, on hover. */
  .grupos .ctl::after,
  .iconos .ctl::after {
    content: attr(aria-label);
    position: absolute;
    left: 50%;
    bottom: calc(100% + 0.7rem);
    padding: 0.28rem 0.55rem;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--glass-strong);
    color: var(--ink);
    font-size: 0.68rem;
    white-space: nowrap;
    pointer-events: none;
    opacity: 0;
    transform: translate(-50%, 4px);
    transition:
      opacity 0.12s,
      transform 0.12s;
  }

  .grupos .ctl:hover::after,
  .grupos .ctl:focus-visible::after,
  .iconos .ctl:hover::after,
  .iconos .ctl:focus-visible::after {
    opacity: 1;
    transform: translate(-50%, 0);
  }

  .ctl[aria-pressed='false'] {
    color: var(--dim);
  }

  .ctl[aria-pressed='false'] .sw {
    opacity: 0.3;
  }

  .sw {
    flex: none;
    display: inline-block;
  }

  .sw-estados {
    width: 11px;
    height: 9px;
    border: 1px solid rgba(126, 190, 255, 0.55);
    background: #0e2035;
    border-radius: 2px;
  }

  .sw-vias {
    width: 14px;
    height: 2px;
    background: var(--warn);
    box-shadow: 0 0 0 1px rgba(255, 209, 102, 0.18);
  }

  .sw-puertos {
    width: 7px;
    height: 7px;
    margin: 0 2px;
    background: var(--accent);
    transform: rotate(45deg);
    box-shadow: 0 0 8px var(--accent);
  }

  .sw-ciudades {
    width: 7px;
    height: 7px;
    margin: 0 2px;
    border-radius: 50%;
    background: var(--ink);
  }
</style>
