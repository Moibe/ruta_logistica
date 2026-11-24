<script lang="ts">
  import { onMount } from 'svelte';
  import { Plegable } from '$lib/state/plegable.svelte';
  import { sim } from '$lib/state/simulacion.svelte';
  import { tablero, type Capa } from '$lib/state/tablero.svelte';
  import { AEROPUERTO, AVION_SVG, COMBUSTIBLE, GAS, GOTA_SVG, INDUSTRIA, PLATAFORMA, POLO, REFINERIA } from '$lib/map/simbolos';

  /**
   * The board's layers, top left under the clock, each with its name and the
   * mark the map draws it with. Three groups: what moves (trains and ships,
   * only in the game: Realidad has no fleet), the territory, and energy and
   * oil.
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

  /** The panel folds to its title, which then says how many layers are on. */
  const panel = new Plegable('capas');
  onMount(() => panel.recordar());
  const visibles = $derived(GRUPOS.filter((g) => !g.soloJuego || sim.modo === 'juego').flatMap((g) => g.capas));
  const encendidas = $derived(visibles.filter((c) => tablero.capas[c.capa]).length);
</script>

<nav class="capas panel" class:plegado={panel.plegado} aria-label="Capas del mapa">
  <button
    class="plegar"
    aria-expanded={!panel.plegado}
    title={panel.plegado ? 'Mostrar las capas' : 'Plegar las capas'}
    onclick={() => panel.alternar()}
  >
    <span class="label">Capas</span>
    {#if panel.plegado}
      <span class="cuenta mono">{encendidas} de {visibles.length}</span>
    {/if}
    <svg class="flecha" viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path d="M2.5 7.5 6 4l3.5 3.5" /></svg>
  </button>
  {#each GRUPOS as g (g.titulo)}
    {#if !panel.plegado && (!g.soloJuego || sim.modo === 'juego')}
      <span class="label titulo">{g.titulo}</span>
      <div class="grupo">
        {#each g.capas as c (c.capa)}
          <button class="ctl" aria-pressed={tablero.capas[c.capa]} onclick={() => tablero.alternar(c.capa)}>
            {#if c.capa === 'trenes'}
              <svg class="sw" width="14" height="8" viewBox="0 0 14 8" aria-hidden="true">
                <rect x="0.5" y="2" width="4" height="4" rx="0.8" fill="#ffd166" />
                <rect x="5" y="2" width="4" height="4" rx="0.8" fill="#ffd166" opacity="0.75" />
                <rect x="9.5" y="2" width="4" height="4" rx="0.8" fill="#ffd166" opacity="0.5" />
              </svg>
            {:else if c.capa === 'barcos'}
              <svg class="sw" width="14" height="9" viewBox="0 0 14 9" aria-hidden="true">
                <path d="M1 4.5h12l-2 3.5H3z" fill="#4cc9ff" />
                <rect x="5" y="1" width="4" height="3" rx="0.5" fill="#4cc9ff" opacity="0.7" />
              </svg>
            {:else if c.capa === 'estados'}
              <span class="sw sw-estados"></span>
            {:else if c.capa === 'vias'}
              <span class="sw sw-vias"></span>
            {:else if c.capa === 'puertos'}
              <span class="sw sw-puertos"></span>
            {:else if c.capa === 'aeropuertos'}
              <svg class="sw" width="12" height="12" viewBox="-1.2 -1.2 2.4 2.4" aria-hidden="true">
                <path d={AVION_SVG} fill={AEROPUERTO} transform="rotate(45)" />
              </svg>
            {:else if c.capa === 'ciudades'}
              <span class="sw sw-ciudades"></span>
            {:else if c.capa === 'polos'}
              <svg class="sw" width="12" height="11" viewBox="0 0 12 11" aria-hidden="true">
                <polygon
                  points="11,5.5 8.5,9.8 3.5,9.8 1,5.5 3.5,1.2 8.5,1.2"
                  fill="rgba(244, 114, 182, 0.16)"
                  stroke={POLO}
                  stroke-width="1.3"
                  stroke-dasharray="2 1.4"
                />
              </svg>
            {:else if c.capa === 'industrias'}
              <svg class="sw" width="13" height="11" viewBox="0 0 13 11" aria-hidden="true">
                <path d="M1 10V1.5l3.7 3.4V1.5l3.6 3.4V1.5L12 4.9V10z" fill={INDUSTRIA} />
              </svg>
            {:else if c.capa === 'energia'}
              <svg class="sw" width="10" height="13" viewBox="0 0 10 13" aria-hidden="true">
                <path d="M6 0 0 7.5h4L3 13l7-8H6z" fill="#facc15" />
              </svg>
            {:else if c.capa === 'refinerias'}
              <svg class="sw" width="10" height="13" viewBox="-1 -1.3 2 2.6" aria-hidden="true">
                <path d={GOTA_SVG} fill={REFINERIA} />
              </svg>
            {:else if c.capa === 'plataformas'}
              <svg class="sw" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                <path d="M3 7 1.8 11.5M9 7l1.2 4.5" stroke={PLATAFORMA} stroke-width="1.3" fill="none" />
                <rect x="1" y="3" width="10" height="4" fill={PLATAFORMA} />
              </svg>
            {:else if c.capa === 'ductos'}
              <svg class="sw" width="14" height="10" viewBox="0 0 14 10" aria-hidden="true">
                <path d="M1 3h12" stroke={GAS} stroke-width="1.8" />
                <path d="M1 7.5h12" stroke={REFINERIA} stroke-width="1.4" />
              </svg>
            {:else if c.capa === 'combustibles'}
              <svg class="sw" width="12" height="13" viewBox="0 0 12 13" aria-hidden="true">
                <rect x="1" y="1" width="6.5" height="11" rx="1" fill={COMBUSTIBLE} />
                <rect x="2.3" y="2.4" width="3.9" height="3" rx="0.5" fill="rgba(3, 9, 18, 0.85)" />
                <path d="M7.5 4.2h1.6l1.4 1.5v4.6a0.9 0.9 0 0 1-1.8 0V7.6H7.5" fill="none" stroke={COMBUSTIBLE} stroke-width="1.1" />
              </svg>
            {/if}
            <span class="txt">{c.nombre}</span>
          </button>
        {/each}
      </div>
    {/if}
  {/each}
</nav>

<style>
  .capas {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.5rem 0.55rem 0.55rem;
  }

  .titulo {
    font-size: 0.58rem;
    padding: 0.2rem 0.15rem 0;
  }

  .capas.plegado {
    padding-bottom: 0.5rem;
  }

  /* The title row folds and unfolds the panel, with the same arrow as «Vistas». */
  .plegar {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.1rem 0.15rem;
    border: 0;
    background: none;
    color: var(--muted);
    cursor: pointer;
    font: inherit;
  }

  .plegar .label {
    flex: 1;
    text-align: left;
    font-size: 0.62rem;
  }

  .plegar:hover {
    color: var(--ink);
  }

  .cuenta {
    font-size: 0.62rem;
  }

  .flecha {
    flex: none;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
    transition: transform 0.15s;
  }

  .plegado .flecha {
    transform: rotate(180deg);
  }

  .grupo {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.25rem;
  }

  .grupo .ctl {
    justify-content: flex-start;
    gap: 0.45rem;
    padding: 0.26rem 0.5rem;
    font-size: 0.72rem;
    min-width: 0;
  }

  .txt {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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
