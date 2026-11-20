<script lang="ts">
  import { nombreCorto } from '$lib/domain/sitios';
  import {
    avanceDePierna,
    horasAProxima,
    kmDelServicio,
    paradaActual,
    proximaParada,
    velocidad,
  } from '$lib/domain/trenes';
  import { sim } from '$lib/state/simulacion.svelte';
  import { tablero } from '$lib/state/tablero.svelte';
  import { duracion, estadoTren, horaDeJuego, km } from './formato';

  /**
   * The fleet: a roster on the left (every train, where it is, how far along
   * its leg) and, for the selected one, a card on the right. Both read
   * `sim.horas` so they refresh as the trains move — trains are mutated in
   * place and aren't reactive on their own.
   */

  const filas = $derived.by(() => {
    sim.horas;
    return sim.trenes.map((t) => ({
      id: t.id,
      nombre: t.nombre,
      color: t.color,
      linea: estadoTren(t),
      avance: avanceDePierna(t),
      parado: t.estado === 'estacion',
    }));
  });

  const ficha = $derived.by(() => {
    sim.horas;
    const t = sim.seleccionado;
    if (!t) return null;
    const aqui = paradaActual(t);
    const proxima = proximaParada(t);
    const enH = horasAProxima(t);
    // Where the train is on its timetable, as an index into the stop list:
    // the round trip A→B→C→B→A maps back onto A, B, C.
    const n = t.paradas.length;
    const destino = t.pierna % (2 * (n - 1));
    const idaDe = destino < n - 1;
    return {
      t,
      aqui,
      proxima,
      enH,
      llegada: horaDeJuego(sim.horas + enH),
      velocidad: velocidad(t),
      kmServicio: kmDelServicio(t),
      sentido: idaDe ? 'ida' : 'vuelta',
      paradas: t.paradas.map((clave) => ({
        clave,
        nombre: nombreCorto(clave),
        actual: clave === aqui,
        proxima: clave === proxima,
      })),
    };
  });

  function abrir(id: string) {
    if (tablero.trazando) tablero.cancelar();
    sim.seleccionar(id);
    tablero.volarA(id);
  }

  function seguir() {
    sim.siguiendo = !sim.siguiendo;
    if (sim.siguiendo && sim.seleccion) tablero.volarA(sim.seleccion);
  }

  // Retiring a train is the one destructive action here: a second click
  // confirms, inside the card (never the browser's confirm()).
  let confirmando = $state(false);
  let reloj: ReturnType<typeof setTimeout> | undefined;

  function retirar() {
    const id = sim.seleccion;
    if (!id) return;
    if (!confirmando) {
      confirmando = true;
      clearTimeout(reloj);
      reloj = setTimeout(() => (confirmando = false), 3500);
      return;
    }
    clearTimeout(reloj);
    confirmando = false;
    sim.retirar(id);
  }

  $effect(() => {
    // A different train in the card starts the confirmation over.
    sim.seleccion;
    confirmando = false;
  });
</script>

<aside class="flota panel">
  <header>
    <span class="label">Trenes</span>
    <span class="label mono">{sim.trenes.length}</span>
    <button class="ctl nuevo" onclick={() => tablero.empezar()} disabled={sim.estado !== 'lista' || tablero.trazando}>
      ＋ Nuevo tren
    </button>
  </header>
  {#if sim.estado === 'cargando'}
    <p class="vacio">Cargando la red ferroviaria…</p>
  {:else if sim.estado === 'error'}
    <p class="vacio err">No se pudo cargar la red ferroviaria</p>
  {:else if !filas.length}
    <p class="vacio">Sin trenes. Crea uno con «Nuevo tren».</p>
  {/if}
  <ul>
    {#each filas as f (f.id)}
      <li>
        <button class="row" class:is-selected={sim.seleccion === f.id} onclick={() => abrir(f.id)}>
          <span class="swatch" class:parado={f.parado} style:--c={f.color}></span>
          <span class="names">
            <span class="nombre">{f.nombre}</span>
            <span class="linea">{f.linea}</span>
            <span class="barra"><span style:width="{f.avance * 100}%" style:background={f.color}></span></span>
          </span>
          <span class="id mono">{f.id}</span>
        </button>
      </li>
    {/each}
  </ul>
</aside>

{#if ficha}
  <section class="ficha panel" style:--c={ficha.t.color}>
    <header>
      <span class="nombre">{ficha.t.nombre}</span>
      <button class="close" onclick={() => sim.seleccionar(null)} aria-label="Cerrar">×</button>
    </header>
    <p class="label">{ficha.t.id} · carga · {km(ficha.kmServicio)} por sentido</p>

    {#if ficha.aqui}
      <p class="status parado">En {nombreCorto(ficha.aqui)} · cargando, sale en {duracion(ficha.t.espera)}</p>
    {:else}
      <p class="status ruta">En ruta ({ficha.sentido}) → {nombreCorto(ficha.proxima)}</p>
    {/if}

    <ol class="paradas">
      {#each ficha.paradas as p (p.clave)}
        <li class:actual={p.actual} class:proxima={p.proxima}>{p.nombre}</li>
      {/each}
    </ol>

    <dl>
      <div><dt>Velocidad</dt><dd class="mono">{ficha.velocidad} km/h</dd></div>
      <div><dt>Próxima parada</dt><dd>{nombreCorto(ficha.proxima)}</dd></div>
      <div><dt>Llega en</dt><dd class="mono">{duracion(ficha.enH)}</dd></div>
      <div><dt>Hora de llegada</dt><dd class="mono">{ficha.llegada}</dd></div>
      <div><dt>Recorrido</dt><dd class="mono">{km(ficha.t.odometro)}</dd></div>
    </dl>

    <div class="acciones">
      <button class="ctl" aria-pressed={sim.siguiendo} title="Seguir el tren con la cámara" onclick={seguir}>
        {sim.siguiendo ? 'Siguiendo' : 'Seguir'}
      </button>
      <button class="ctl retirar" class:confirmando onclick={retirar}>
        {confirmando ? '¿Retirar? Clic otra vez' : 'Retirar'}
      </button>
    </div>
  </section>
{/if}

<style>
  .flota {
    position: fixed;
    top: 4.6rem;
    left: 1rem;
    z-index: 30;
    width: 260px;
    max-height: calc(100vh - 4.6rem - 4.8rem);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .flota header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.6rem 0.6rem 0.55rem 0.85rem;
    border-bottom: 1px solid var(--line);
  }

  .nuevo {
    margin-left: auto;
    padding: 0.28rem 0.6rem;
    font-size: 0.7rem;
    border-color: rgba(255, 209, 102, 0.45);
    color: #fff1cc;
    background: rgba(255, 209, 102, 0.08);
  }

  .nuevo:hover:not(:disabled) {
    background: rgba(255, 209, 102, 0.16);
    border-color: rgba(255, 209, 102, 0.6);
  }

  .nuevo:disabled {
    opacity: 0.45;
    cursor: default;
  }

  .vacio {
    margin: 0;
    padding: 0.8rem 0.85rem;
    font-size: 0.74rem;
    color: var(--muted);
  }

  .vacio.err {
    color: var(--warn);
  }

  ul {
    margin: 0;
    padding: 0.35rem;
    list-style: none;
    overflow-y: auto;
  }

  .row {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.55rem;
    padding: 0.42rem 0.5rem;
    border: 1px solid transparent;
    border-radius: 9px;
    background: none;
    cursor: pointer;
    text-align: left;
  }

  .row:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  .row.is-selected {
    background: rgba(255, 209, 102, 0.1);
    border-color: rgba(255, 209, 102, 0.38);
  }

  .swatch {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex: none;
    background: var(--c);
    box-shadow: 0 0 8px var(--c);
  }

  /* Stopped at a station: a ring instead of a lit dot. */
  .swatch.parado {
    background: transparent;
    box-shadow: inset 0 0 0 1.5px var(--c);
  }

  .names {
    display: flex;
    flex-direction: column;
    gap: 0.12rem;
    min-width: 0;
    flex: 1;
  }

  .nombre {
    font-size: 0.8rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .linea {
    font-size: 0.62rem;
    color: var(--muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .barra {
    height: 2px;
    border-radius: 2px;
    background: rgba(255, 255, 255, 0.07);
    overflow: hidden;
  }

  .barra span {
    display: block;
    height: 100%;
  }

  .id {
    font-size: 0.6rem;
    color: var(--dim);
    align-self: flex-start;
    margin-top: 0.1rem;
  }

  .ficha {
    position: fixed;
    top: 5.6rem;
    right: 1rem;
    z-index: 30;
    width: 272px;
    padding: 0.8rem 0.9rem 0.9rem;
    border-top: 2px solid var(--c);
  }

  .ficha header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .ficha .nombre {
    font-size: 0.98rem;
    white-space: normal;
  }

  .close {
    border: none;
    background: none;
    font-size: 1.1rem;
    line-height: 1;
    color: var(--muted);
    cursor: pointer;
  }

  .close:hover {
    color: var(--ink);
  }

  .ficha > p.label {
    margin: 0.15rem 0 0.6rem;
  }

  .status {
    margin: 0 0 0.6rem;
    padding: 0.3rem 0.55rem;
    border-radius: 8px;
    font-size: 0.72rem;
  }

  .status.ruta {
    background: rgba(255, 209, 102, 0.1);
    color: #ffe2a3;
  }

  .status.parado {
    background: rgba(203, 213, 225, 0.1);
    color: #dbe4ef;
  }

  .paradas {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 0.1rem;
    margin: 0 0 0.7rem;
    padding: 0;
    list-style: none;
    font-size: 0.68rem;
    color: var(--muted);
  }

  .paradas li:not(:last-child)::after {
    content: '—';
    margin: 0 0.3rem;
    color: var(--dim);
  }

  .paradas li.proxima {
    color: var(--ink);
  }

  .paradas li.actual {
    color: var(--c);
    font-weight: 600;
  }

  dl {
    margin: 0;
    display: grid;
    gap: 0.32rem;
  }

  dl > div {
    display: flex;
    justify-content: space-between;
    gap: 0.6rem;
    font-size: 0.76rem;
  }

  dt {
    color: var(--muted);
  }

  dd {
    margin: 0;
    text-align: right;
  }

  .acciones {
    display: flex;
    gap: 0.4rem;
    margin-top: 0.85rem;
    padding-top: 0.7rem;
    border-top: 1px solid var(--line);
  }

  .acciones .ctl {
    flex: 1;
    justify-content: center;
    padding: 0.35rem 0.5rem;
    font-size: 0.72rem;
  }

  .retirar:hover {
    background: rgba(248, 113, 113, 0.12);
    border-color: rgba(248, 113, 113, 0.45);
  }

  .retirar.confirmando {
    background: rgba(248, 113, 113, 0.18);
    border-color: rgba(248, 113, 113, 0.6);
    color: #ffd0d0;
  }

  @media (max-width: 900px) {
    .flota,
    .ficha {
      display: none;
    }
  }
</style>
