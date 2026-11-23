<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { Plegable } from '$lib/state/plegable.svelte';
  import { CLASES_BARCO, enElCanal, enTravesia, KM_POR_MILLA } from '$lib/domain/barcos';
  import {
    avanceDePierna,
    horasAProxima,
    kmDelRecorrido,
    paradaActual,
    proximaParada,
    velocidad,
  } from '$lib/domain/servicio';
  import { nombreCorto } from '$lib/domain/sitios';
  import { CARGA_POR_TREN } from '$lib/domain/exportaciones';
  import { BARRILES_POR_TANQUE } from '$lib/domain/combustibles';
  import { TONELADAS_ABASTECEDOR } from '$lib/domain/plataformas';
  import { cargaDeClase, NOMBRE_CARGA, toneladasDeClase } from '$lib/domain/comercioMar';
  import { refineria } from '$lib/domain/petroleo';
  import { sim, type Unidad } from '$lib/state/simulacion.svelte';
  import { tablero, type TipoUnidad } from '$lib/state/tablero.svelte';
  import { duracion, estadoUnidad, horaDeJuego, km, nudos } from './formato';

  /**
   * The fleet: a roster on the left, trains or ships by tab (each one, where
   * it is, how far along its leg) and, for the selected one, a card on the
   * right. Both read `sim.horas` so they refresh as vehicles move — they're
   * mutated in place and aren't reactive on their own.
   *
   * On the world views (`vista="mundo"`) it lists the ships only — trains
   * are a board thing — and nothing is off the map there: a ship on an ocean
   * crossing is followed like any other. On the board, a ship beyond a gateway
   * offers to be watched on the globe instead.
   */
  let { vista = 'tablero' }: { vista?: 'tablero' | 'mundo' } = $props();

  const mundo = $derived(vista === 'mundo');
  /** Folded, the roster keeps its header (tabs and «＋ Nuevo») and hides the list. */
  const panel = new Plegable('flota');
  onMount(() => panel.recordar());
  const tipo = $derived<TipoUnidad>(mundo ? 'barco' : tablero.pestaña);
  const lista = $derived<Unidad[]>(tipo === 'tren' ? sim.trenes : sim.barcos);

  const filas = $derived.by(() => {
    sim.horas;
    return lista.map((u) => ({
      id: u.id,
      nombre: u.nombre,
      color: u.color,
      linea: estadoUnidad(u),
      avance: avanceDePierna(u),
      parado: u.estado === 'parada',
      fuera: !mundo && u.tipo === 'barco' && enTravesia(u) !== null,
    }));
  });

  const ficha = $derived.by(() => {
    sim.horas;
    const u = sim.seleccionado;
    if (!u || (mundo && u.tipo !== 'barco')) return null;
    const aqui = paradaActual(u);
    const proxima = proximaParada(u);
    const enH = horasAProxima(u);
    const travesia = u.tipo === 'barco' ? enTravesia(u) : null;
    const fuera = !mundo && travesia !== null;
    let estado: { clase: string; texto: string };
    if (travesia && travesia.tramo !== 'alla') {
      estado = {
        clase: mundo ? 'ruta' : 'fuera',
        texto: `Cruzando el ${travesia.puerta.oceano} → ${nombreCorto(proxima)}${mundo ? '' : ', fuera del tablero'}`,
      };
    } else if (aqui) {
      const verbo = u.tipo === 'tren' ? 'sale' : 'zarpa';
      estado = { clase: 'parado', texto: `En ${nombreCorto(aqui)} · cargando, ${verbo} en ${duracion(u.espera)}` };
    } else if (u.tipo === 'barco' && enElCanal(u)) {
      estado = { clase: 'canal', texto: `Cruzando el Canal de Panamá → ${nombreCorto(proxima)}` };
    } else if (u.tipo === 'barco') {
      estado = { clase: 'ruta', texto: `Navegando → ${nombreCorto(proxima)}` };
    } else {
      // Where the train is on its timetable: the round trip A→B→C→B→A maps
      // back onto A, B, C.
      const n = u.paradas.length;
      const ida = u.pierna % (2 * (n - 1)) < n - 1;
      estado = { clase: 'ruta', texto: `En ruta (${ida ? 'ida' : 'vuelta'}) → ${nombreCorto(proxima)}` };
    }
    const v = velocidad(u);
    return {
      u,
      estado,
      proxima,
      enH,
      fuera,
      llegada: horaDeJuego(sim.horas + enH),
      velocidad: u.tipo === 'barco' ? (v ? `${nudos(v)} (${Math.round(v)} km/h)` : '0 nudos') : `${Math.round(v)} km/h`,
      descripcion:
        u.tipo === 'barco'
          ? `${u.id} · ${CLASES_BARCO[u.clase].nombre} · ${km(kmDelRecorrido(u))} por vuelta`
          : `${u.id} · carga · ${km(kmDelRecorrido(u))} por sentido`,
      recorrido:
        u.tipo === 'barco'
          ? `${km(u.odometro)} · ${Math.round(u.odometro / KM_POR_MILLA).toLocaleString('es-MX')} mn`
          : km(u.odometro),
      paradas: u.paradas.map((clave) => ({
        clave,
        nombre: nombreCorto(clave),
        actual: clave === aqui,
        proxima: clave === proxima,
      })),
    };
  });

  function pestaña(tipo: TipoUnidad) {
    if (tablero.pestaña === tipo) return;
    if (tablero.trazando) tablero.cancelar();
    tablero.pestaña = tipo;
  }

  function abrir(id: string) {
    if (tablero.trazando) tablero.cancelar();
    sim.seleccionar(id);
    tablero.volarA(id);
  }

  function seguir() {
    sim.siguiendo = !sim.siguiendo;
    if (sim.siguiendo && sim.seleccion) tablero.volarA(sim.seleccion);
  }

  /** From a world view: lay out a new ship on the board, where stops are picked. */
  function nuevoEnElTablero() {
    tablero.pestaña = 'barco';
    tablero.empezar();
    goto('/mexico');
  }

  /** A ship beyond a gateway can't be seen on the board: follow it on the globe. */
  function verEnElGlobo() {
    sim.siguiendo = true;
    goto('/mundo/globo');
  }

  /** Barrels, whole: "19,805". */
  const barriles = (n: number) => Math.round(n).toLocaleString('es-MX');

  // Retiring a vehicle is the one destructive action here: a second click
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
    // A different vehicle in the card starts the confirmation over.
    sim.seleccion;
    confirmando = false;
  });

  $effect(() => {
    // Selecting a vehicle on the map shows its tab.
    const u = sim.seleccionado;
    if (!mundo && u && u.tipo !== tablero.pestaña && !tablero.trazando) tablero.pestaña = u.tipo;
  });
</script>

<aside class="flota panel" class:en-columna={!mundo} class:plegado={panel.plegado}>
  <header>
    {#if mundo}
      <span class="titulo">Barcos <span class="mono">{sim.barcos.length}</span></span>
      <button
        class="ctl nuevo mar"
        title="Los barcos se trazan en el tablero"
        onclick={nuevoEnElTablero}
        disabled={sim.estado !== 'lista'}
      >
        ＋ Nuevo
      </button>
    {:else}
    <!-- A tab for each of the two layers that's on. -->
    <div class="pestañas" role="tablist">
      {#if tablero.capas.trenes}
        <button
          role="tab"
          class:activa={tablero.pestaña === 'tren'}
          aria-selected={tablero.pestaña === 'tren'}
          onclick={() => pestaña('tren')}
        >
          Trenes <span class="mono">{sim.trenes.length}</span>
        </button>
      {/if}
      {#if tablero.capas.barcos}
        <button
          role="tab"
          class:activa={tablero.pestaña === 'barco'}
          aria-selected={tablero.pestaña === 'barco'}
          onclick={() => pestaña('barco')}
        >
          Barcos <span class="mono">{sim.barcos.length}</span>
        </button>
      {/if}
    </div>
    <button
      class="ctl nuevo"
      class:mar={tablero.pestaña === 'barco'}
      title={tablero.pestaña === 'tren' ? 'Nuevo tren' : 'Nuevo barco'}
      onclick={() => tablero.empezar()}
      disabled={sim.estado !== 'lista' || tablero.trazando}
    >
      ＋ Nuevo
    </button>
    {/if}
    <button
      class="plegar"
      aria-expanded={!panel.plegado}
      aria-label={panel.plegado ? 'Mostrar la lista' : 'Plegar la lista'}
      title={panel.plegado ? 'Mostrar la lista' : 'Plegar la lista'}
      onclick={() => panel.alternar()}
    >
      <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path d="M2.5 7.5 6 4l3.5 3.5" /></svg>
    </button>
  </header>
  {#if panel.plegado}
    <!-- Folded: only the header. -->
  {:else if sim.estado === 'cargando'}
    <p class="vacio">Cargando las rutas…</p>
  {:else if sim.estado === 'error'}
    <p class="vacio err">No se pudieron cargar las rutas</p>
  {:else if !filas.length}
    <p class="vacio">Sin {tipo === 'tren' ? 'trenes' : 'barcos'}. Crea uno con «＋ Nuevo» en el tablero.</p>
  {/if}
  <ul hidden={panel.plegado}>
    {#each filas as f (f.id)}
      <li>
        <button
          class="row"
          class:is-selected={sim.seleccion === f.id}
          class:mar={tipo === 'barco'}
          onclick={() => abrir(f.id)}
        >
          <span class="swatch" class:parado={f.parado} class:fuera={f.fuera} style:--c={f.color}></span>
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
  <section class="ficha panel" style:--c={ficha.u.color}>
    <header>
      <span class="nombre">{ficha.u.nombre}</span>
      <button class="close" onclick={() => sim.seleccionar(null)} aria-label="Cerrar">×</button>
    </header>
    <p class="label">{ficha.descripcion}</p>

    <p class="status {ficha.estado.clase}">{ficha.estado.texto}</p>

    <ol class="paradas" class:circular={ficha.u.recorrido === 'circular'}>
      {#each ficha.paradas as p (p.clave)}
        <li class:actual={p.actual} class:proxima={p.proxima}>{p.nombre}</li>
      {/each}
    </ol>

    <dl>
      <div><dt>Velocidad</dt><dd class="mono">{ficha.velocidad}</dd></div>
      <div><dt>{ficha.u.tipo === 'barco' ? 'Próxima escala' : 'Próxima parada'}</dt><dd>{nombreCorto(ficha.proxima)}</dd></div>
      <div><dt>Llega en</dt><dd class="mono">{duracion(ficha.enH)}</dd></div>
      <div><dt>Hora de llegada</dt><dd class="mono">{ficha.llegada}</dd></div>
      <div><dt>Recorrido</dt><dd class="mono">{ficha.recorrido}</dd></div>
      {#if ficha.u.tipo === 'tren'}
        <div>
          <dt>Carga de exportación</dt>
          <dd class="mono">{Math.round(ficha.u.carga).toLocaleString('es-MX')} de {CARGA_POR_TREN.toLocaleString('es-MX')} t</dd>
        </div>
        <div><dt>Ha exportado</dt><dd class="mono">{Math.round(ficha.u.exportado).toLocaleString('es-MX')} t</dd></div>
        <div><dt>Carga nacional</dt><dd class="mono">{Math.round(ficha.u.cargaNacional).toLocaleString('es-MX')} t a bordo</dd></div>
        <div><dt>Ha movido</dt><dd class="mono">{Math.round(ficha.u.movidoNacional).toLocaleString('es-MX')} t nacionales</dd></div>
        {#if ficha.u.importacion > 0 || ficha.u.importado > 0}
          <div>
            <dt>Importación</dt>
            <dd class="mono">{barriles(ficha.u.importacion)} t a bordo{#if ficha.u.importacionDe}{` · de ${nombreCorto(ficha.u.importacionDe)}`}{/if}</dd>
          </div>
          <div><dt>Ha llevado</dt><dd class="mono">{barriles(ficha.u.importado)} t importadas</dd></div>
        {/if}
      {/if}
      {#if ficha.u.tipo === 'barco' && cargaDeClase(ficha.u.clase)}
        {@const tipoCarga = cargaDeClase(ficha.u.clase)!}
        {#if ficha.u.paradas.some((p) => p.startsWith('puerta:'))}
          <div><dt>Carga</dt><dd>{NOMBRE_CARGA[tipoCarga]}, <span class="mono">{barriles(toneladasDeClase(ficha.u.clase))}</span> t</dd></div>
          <div><dt>Exportación</dt><dd class="mono">{barriles(ficha.u.exportacion)} t a bordo</dd></div>
          <div><dt>Importación</dt><dd class="mono">{barriles(ficha.u.importacion)} t a bordo</dd></div>
          <div><dt>Ha exportado</dt><dd class="mono">{barriles(ficha.u.exportado)} t</dd></div>
          <div><dt>Ha importado</dt><dd class="mono">{barriles(ficha.u.importado)} t</dd></div>
        {:else}
          <div class="aviso-carga">Sin salida al mundo en su vuelta: no lleva comercio exterior (el cabotaje entre puertos del país aún no cuenta).</div>
        {/if}
      {/if}
      {#if ficha.u.tipo === 'barco' && ficha.u.clase === 'abastecedor'}
        <div><dt>Abasto</dt><dd class="mono">{barriles(ficha.u.abasto)} de {barriles(TONELADAS_ABASTECEDOR)} t a bordo</dd></div>
        <div><dt>Ha entregado</dt><dd class="mono">{barriles(ficha.u.entregadoAbasto)} t a las plataformas</dd></div>
      {/if}
      {#if ficha.u.tipo === 'tren' || ficha.u.clase === 'tanque'}
        <div>
          <dt>Combustible</dt>
          <dd class="mono">
            {barriles(ficha.u.combustible)}{ficha.u.tipo === 'barco' ? ` de ${barriles(BARRILES_POR_TANQUE)}` : ''} b a bordo{#if ficha.u.combustibleDe}{` · de ${refineria(ficha.u.combustibleDe)?.corto}`}{/if}
          </dd>
        </div>
        <div><dt>Ha llevado</dt><dd class="mono">{barriles(ficha.u.entregadoCombustible)} b de combustible del país</dd></div>
      {/if}
    </dl>

    <div class="acciones">
      {#if ficha.fuera}
        <button class="ctl globo" title="Está más allá de la salida: síguelo en el globo" onclick={verEnElGlobo}>
          Ver en el globo ›
        </button>
      {:else}
        <button class="ctl" aria-pressed={sim.siguiendo} title="Seguir con la cámara" onclick={seguir}>
          {sim.siguiendo ? 'Siguiendo' : 'Seguir'}
        </button>
      {/if}
      <button class="ctl retirar" class:confirmando onclick={retirar}>
        {confirmando ? '¿Retirar? Clic otra vez' : 'Retirar'}
      </button>
    </div>
  </section>
{/if}

<style>
  .flota {
    position: fixed;
    top: 6.55rem;
    left: 1rem;
    z-index: 30;
    width: 260px;
    max-height: calc(100vh - 4.6rem - 4.8rem);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* On the board it sits in the left column, under the layers, and takes what height is left. */
  .flota.en-columna {
    position: static;
    width: auto;
    max-height: none;
    flex: 0 1 auto;
    min-height: 0;
  }

  .flota header {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.5rem 0.55rem 0.5rem 0.55rem;
    border-bottom: 1px solid var(--line);
  }

  .titulo {
    font-size: 0.76rem;
    padding-left: 0.3rem;
  }

  .titulo .mono {
    font-size: 0.64rem;
    color: var(--muted);
    margin-left: 0.15rem;
  }

  .pestañas {
    display: flex;
    gap: 0.2rem;
    padding: 0.15rem;
    border-radius: 9px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--line);
  }

  .pestañas button {
    border: none;
    background: none;
    padding: 0.28rem 0.5rem;
    border-radius: 7px;
    font-size: 0.72rem;
    color: var(--muted);
    cursor: pointer;
    white-space: nowrap;
  }

  .pestañas button .mono {
    font-size: 0.64rem;
    color: var(--dim);
    margin-left: 0.15rem;
  }

  .pestañas button.activa {
    background: rgba(255, 255, 255, 0.08);
    color: var(--ink);
  }

  .pestañas button.activa .mono {
    color: var(--muted);
  }

  .nuevo {
    margin-left: auto;
    white-space: nowrap;
    padding: 0.28rem 0.55rem;
    font-size: 0.7rem;
    border-color: rgba(255, 209, 102, 0.45);
    color: #fff1cc;
    background: rgba(255, 209, 102, 0.08);
  }

  .nuevo:hover:not(:disabled) {
    background: rgba(255, 209, 102, 0.16);
    border-color: rgba(255, 209, 102, 0.6);
  }

  /* Ships are sea things: cyan, not the rail amber. */
  .nuevo.mar {
    border-color: rgba(76, 201, 255, 0.45);
    color: #d6f2ff;
    background: rgba(76, 201, 255, 0.08);
  }

  .nuevo.mar:hover:not(:disabled) {
    background: rgba(76, 201, 255, 0.16);
    border-color: rgba(76, 201, 255, 0.6);
  }

  .nuevo:disabled {
    opacity: 0.45;
    cursor: default;
  }

  /* Folds the list away, with the same arrow as «Vistas». */
  .plegar {
    flex: none;
    display: grid;
    place-items: center;
    width: 1.4rem;
    height: 1.4rem;
    margin-right: -0.15rem;
    padding: 0;
    border: 0;
    border-radius: 6px;
    background: none;
    color: var(--muted);
    cursor: pointer;
  }

  .plegar:hover {
    color: var(--ink);
    background: rgba(255, 255, 255, 0.05);
  }

  .plegar svg {
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
    transition: transform 0.15s;
  }

  .plegado .plegar svg {
    transform: rotate(180deg);
  }

  .flota.plegado header {
    border-bottom: 0;
  }

  ul[hidden] {
    display: none;
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

  .row.mar.is-selected {
    background: rgba(76, 201, 255, 0.1);
    border-color: rgba(76, 201, 255, 0.38);
  }

  .swatch {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex: none;
    background: var(--c);
    box-shadow: 0 0 8px var(--c);
  }

  /* Stopped at a station or in port: a ring instead of a lit dot. */
  .swatch.parado {
    background: transparent;
    box-shadow: inset 0 0 0 1.5px var(--c);
  }

  /* Off the map on an ocean crossing: a faint dashed ring. */
  .swatch.fuera {
    box-shadow: none;
    border: 1.5px dashed var(--c);
    opacity: 0.6;
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
    top: 5.2rem;
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
    background: color-mix(in srgb, var(--c) 12%, transparent);
    color: color-mix(in srgb, var(--c) 55%, white);
  }

  .status.parado {
    background: rgba(203, 213, 225, 0.1);
    color: #dbe4ef;
  }

  .status.canal {
    background: rgba(76, 201, 255, 0.14);
    color: #bfeaff;
  }

  .status.fuera {
    background: rgba(255, 255, 255, 0.05);
    color: var(--muted);
    border: 1px dashed var(--line);
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

  /* A loop closes back on its first stop. */
  .paradas.circular li:last-child::after {
    content: '↻';
    margin-left: 0.35rem;
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

  dl > .aviso-carga {
    display: block;
    color: var(--muted);
    font-size: 0.72rem;
    line-height: 1.35;
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

  .acciones .ctl:disabled {
    opacity: 0.4;
    cursor: default;
  }

  /* To the globe: cyan, the sea and the world views. */
  .acciones .globo {
    border-color: rgba(76, 201, 255, 0.45);
    color: #d6f2ff;
    background: rgba(76, 201, 255, 0.08);
  }

  .acciones .globo:hover {
    background: rgba(76, 201, 255, 0.16);
    border-color: rgba(76, 201, 255, 0.6);
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
