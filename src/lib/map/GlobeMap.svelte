<script lang="ts">
  import { Canvas } from '@threlte/core';
  import { CLASES_BARCO, type Barco } from '$lib/domain/barcos';
  import { sim } from '$lib/state/simulacion.svelte';
  import { estadoUnidad } from '$lib/ui/formato';
  import GlobeScene from './GlobeScene.svelte';

  /**
   * Thin shell around the Threlte canvas: it owns the DOM element and the
   * couple of controls that belong to the camera rather than to the world. All
   * the actual scene graph lives in `GlobeScene`, which must be a child of
   * `<Canvas>` to reach Threlte's context.
   *
   * Rotation starts off here (it was on in `global`): the globe opens looking
   * at Mexico and should stay there until you move it.
   *
   * The hovered ship's card is DOM, by the cursor, like the 2D views'. Dragging
   * the globe takes the camera back from a followed ship (the wheel doesn't:
   * you can zoom in on the ship you follow).
   */
  let autoRotate = $state(false);
  let entering = $state(false);
  let hoverMexico = $state(false);
  let hoverBarco = $state.raw<Barco | null>(null);
  let pointer = $state({ x: 0, y: 0 });
  let innerWidth = $state(0);
  let abajo: { x: number; y: number } | null = null;

  function onPointerMove(event: PointerEvent) {
    pointer = { x: event.clientX, y: event.clientY };
    if (event.buttons && abajo && sim.siguiendo && Math.hypot(event.clientX - abajo.x, event.clientY - abajo.y) > 4) {
      sim.siguiendo = false;
    }
  }

  // Live line for the hovered ship; reads the clock so it updates as it sails.
  const lineaBarco = $derived.by(() => {
    sim.horas;
    return hoverBarco ? estadoUnidad(hoverBarco) : '';
  });
</script>

<svelte:window bind:innerWidth />

<div
  class="host"
  class:pointing={hoverMexico || hoverBarco !== null}
  role="presentation"
  onpointermove={onPointerMove}
  onpointerdown={(e) => (abajo = { x: e.clientX, y: e.clientY })}
  onpointerup={() => (abajo = null)}
>
  <Canvas>
    <GlobeScene {autoRotate} bind:entering bind:hoverMexico bind:hoverBarco />
  </Canvas>
</div>

{#if hoverBarco}
  <div
    class="tip panel"
    class:flip={pointer.x > innerWidth - 260}
    style:left="{pointer.x}px"
    style:top="{pointer.y}px"
  >
    <span class="label tip-kind" style:color={hoverBarco.color}>
      {CLASES_BARCO[hoverBarco.clase].nombre} · {hoverBarco.id}
    </span>
    <strong>{hoverBarco.nombre}</strong>
    <span class="tip-sub">{lineaBarco}</span>
  </div>
{/if}

<div class="tools panel">
  <button class="ctl enter" onclick={() => (entering = true)} disabled={entering}>Entrar a México ›</button>
  <span class="sep"></span>
  <span class="label">Cámara</span>
  <button class="ctl" aria-pressed={autoRotate} onclick={() => (autoRotate = !autoRotate)}>
    Rotación {autoRotate ? 'auto' : 'libre'}
  </button>
  <span class="sep"></span>
  <span class="label">Arrastra para orbitar · rueda para acercar</span>
</div>

<style>
  .host {
    position: fixed;
    inset: 0;
  }

  .host.pointing {
    cursor: pointer;
  }

  /* The hovered ship's card, by the cursor: the board's tooltip. */
  .tip {
    position: fixed;
    z-index: 35;
    pointer-events: none;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    padding: 0.5rem 0.7rem;
    min-width: 9rem;
    max-width: 17rem;
    background: var(--glass-strong);
    transform: translate(16px, 14px);
  }

  /* Near the right edge the tip opens to the left of the cursor instead. */
  .tip.flip {
    transform: translate(calc(-100% - 16px), 14px);
  }

  .tip strong {
    font-size: 0.92rem;
    font-weight: 600;
  }

  .tip-sub {
    font-size: 0.72rem;
    color: var(--muted);
  }

  .tools {
    position: fixed;
    right: 1rem;
    bottom: 1rem;
    z-index: 30;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.45rem 0.6rem;
  }

  .tools .ctl {
    padding: 0.3rem 0.6rem;
    font-size: 0.72rem;
  }

  /* The way into the board: amber, like Mexico on the globe. */
  .tools .enter {
    border-color: rgba(255, 209, 102, 0.45);
    color: #fff1cc;
    background: rgba(255, 209, 102, 0.08);
  }

  .tools .enter:hover {
    background: rgba(255, 209, 102, 0.16);
    border-color: rgba(255, 209, 102, 0.6);
  }

  .tools .enter:disabled {
    opacity: 0.6;
    cursor: default;
  }

  .sep {
    width: 1px;
    align-self: stretch;
    background: var(--line);
    margin: 0 0.25rem;
  }

  @media (max-width: 900px) {
    .tools {
      display: none;
    }
  }
</style>
