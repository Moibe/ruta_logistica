<script lang="ts">
  import { Canvas } from '@threlte/core';
  import GlobeScene from './GlobeScene.svelte';

  /**
   * Thin shell around the Threlte canvas: it owns the DOM element and the
   * couple of controls that belong to the camera rather than to the world. All
   * the actual scene graph lives in `GlobeScene`, which must be a child of
   * `<Canvas>` to reach Threlte's context.
   *
   * Rotation starts off here (it was on in `global`): the globe opens looking
   * at Mexico and should stay there until you move it.
   */
  let autoRotate = $state(false);
  let entering = $state(false);
  let hoverMexico = $state(false);
</script>

<div class="host" class:pointing={hoverMexico}>
  <Canvas>
    <GlobeScene {autoRotate} bind:entering bind:hoverMexico />
  </Canvas>
</div>

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
