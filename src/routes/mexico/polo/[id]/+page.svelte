<script lang="ts">
  import { goto } from '$app/navigation';
  import InteriorPolo from '$lib/map/InteriorPolo.svelte';
  import CatalogoObras from '$lib/ui/CatalogoObras.svelte';
  import Erario from '$lib/ui/Erario.svelte';
  import FrentesPolo from '$lib/ui/FrentesPolo.svelte';
  import Reloj from '$lib/ui/Reloj.svelte';
  import { cargarInterior, type GeoInterior } from '$lib/domain/interiorGeo';
  import { POLOS } from '$lib/domain/sitios';
  import { sim } from '$lib/state/simulacion.svelte';
  import { tablero } from '$lib/state/tablero.svelte';
  import { POLO } from '$lib/map/simbolos';

  /**
   * A polo from inside: its close-up (`InteriorPolo`) and its work by fronts
   * (`FrentesPolo`), with the clock and the State's money as on the board —
   * the game keeps running in here.
   */
  let { data } = $props();
  const id = $derived(data.id);
  const polo = $derived(POLOS.find((p) => p.id === id)!);

  let geo = $state<GeoInterior | null>(null);
  let error = $state<string | null>(null);

  $effect(() => {
    const actual = id;
    geo = null;
    cargarInterior(actual)
      .then((g) => {
        if (actual === id) geo = g;
      })
      .catch((e) => (error = String(e)));
  });

  // The game, loaded and running here too (a direct link lands here first).
  $effect(() => {
    sim.cargar();
  });
  $effect(() => sim.attach());

  function volver() {
    tablero.salirPolo(id);
    goto('/mexico');
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape' && !tablero.catalogo) volver();
  }
</script>

<svelte:head>
  <title>Ruta Logística · {polo.nombre} por dentro</title>
</svelte:head>

<svelte:window onkeydown={onKey} />

{#if geo}
  <InteriorPolo {geo} />
{:else}
  <p class="cargando">{error ?? 'Entrando al polo…'}</p>
{/if}
<Reloj />
<Erario />
<div class="columna">
  <nav class="migas panel" style:--polo={POLO}>
    <button class="ctl volver" onclick={volver}>← México</button>
    <p class="label">Polo del Bienestar</p>
    <p class="nombre">{polo.nombre} <span>por dentro</span></p>
    <ul class="leyenda">
      <li><span class="m terreno"></span>Terreno del DOF</li>
      <li><span class="m lote"></span>Lote (se llena con empresas)</li>
      <li><span class="m via"></span>Vía férrea · espuela</li>
      <li><span class="m luz"></span>Energía · líneas de la CFE (a trazos)</li>
      <li><span class="m agua"></span>Agua y drenaje</li>
      <li><span class="m gente"></span>Cuadrilla trabajando</li>
    </ul>
    <p class="ayuda">Arrastra para moverte, la rueda acerca. Esc vuelve al tablero.</p>
  </nav>
</div>
<FrentesPolo {id} />
<CatalogoObras />

<style>
  .cargando {
    position: fixed;
    inset: 0;
    display: grid;
    place-items: center;
    margin: 0;
    color: var(--muted);
    font-size: 0.85rem;
  }

  .columna {
    position: fixed;
    top: 6.55rem;
    left: 1rem;
    z-index: 30;
    width: 260px;
  }

  .migas {
    padding: 0.75rem 0.85rem 0.8rem;
    border-top: 2px solid var(--polo);
  }

  .volver {
    padding: 0.3rem 0.65rem;
    font-size: 0.74rem;
    margin-bottom: 0.6rem;
  }

  .migas .label {
    margin: 0;
  }

  .nombre {
    margin: 0.1rem 0 0.55rem;
    font-size: 1rem;
    font-weight: 600;
  }

  .nombre span {
    font-weight: 400;
    color: var(--muted);
  }

  .leyenda {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.28rem;
    font-size: 0.7rem;
    color: var(--muted);
  }

  .leyenda li {
    display: flex;
    align-items: center;
    gap: 0.45rem;
  }

  .m {
    flex: none;
    width: 16px;
    height: 10px;
    border-radius: 2px;
  }

  .m.terreno {
    border: 1.5px dashed var(--polo);
  }

  .m.lote {
    background: rgba(244, 114, 182, 0.36);
    border: 1px solid rgba(244, 114, 182, 0.6);
  }

  .m.via {
    height: 3px;
    background: #ffd166;
  }

  .m.luz {
    height: 0;
    border-top: 2px dashed #fde68a;
  }

  .m.agua {
    height: 3px;
    background: #60a5fa;
  }

  .m.gente {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: #fff1f8;
    border: 1.5px solid var(--polo);
  }

  .ayuda {
    margin: 0.6rem 0 0;
    font-size: 0.64rem;
    line-height: 1.4;
    color: var(--dim);
  }
</style>
