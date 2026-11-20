<script lang="ts">
  import { MAX_CUADRILLAS, HORAS_POR_MES } from '$lib/domain/obras';
  import { GRUPOS_OBRA, obraVia, OBRAS_VIA, TIPOS_OBRA, type ObraVia } from '$lib/domain/obrasVia';
  import { CAPACIDAD } from '$lib/domain/red';
  import { mesesAlRitmoDelDinero } from '$lib/domain/presupuesto';
  import { sim } from '$lib/state/simulacion.svelte';
  import { tablero } from '$lib/state/tablero.svelte';
  import { horaDeJuego, km, mdp, meses, personas } from './formato';

  /**
   * The State's catalog of rail works, at the right like a polo's card. A list
   * by group (Tren Maya, freight, the Interoceánico, passenger lines, dead
   * lines to bring back), each with what it costs at the government's pace and
   * where it stands; a work opens its card, where the player picks the crews
   * and builds it (confirmed in a dialog of the site's own, never the
   * browser's confirm()). The map shows the line of the work that's open.
   */

  let cuadrillas = $state(4);
  let confirmando = $state(false);

  const obra = $derived(tablero.obraSel ? obraVia(tablero.obraSel) : null);

  // Another work, or none: back to the government's pace, no dialog open.
  $effect(() => {
    tablero.obraSel;
    cuadrillas = 4;
    confirmando = false;
  });

  // A train, a ship or a polo picked elsewhere takes the panel's place.
  $effect(() => {
    if (sim.seleccion || tablero.poloSel) tablero.cerrarCatalogo();
  });

  /** Each work with its state and what it costs, refreshed as the clock runs. */
  const filas = $derived.by(() => {
    sim.horas;
    sim.obrasVia;
    return GRUPOS_OBRA.map((g) => ({
      ...g,
      obras: OBRAS_VIA.filter((o) => o.grupo === g.id).map((o) => ({
        o,
        estado: sim.obrasVia.get(o.id),
        plan: sim.presupuestoVia(o.id, MAX_CUADRILLAS),
      })),
    }));
  });

  const resumen = $derived.by(() => {
    sim.obrasVia;
    const todas = [...sim.obrasVia.values()];
    return { enObra: todas.filter((o) => o.fase === 'en-obra').length, enServicio: todas.filter((o) => o.fase === 'en-servicio').length };
  });

  const ficha = $derived.by(() => {
    sim.horas;
    sim.obrasVia;
    const o = obra;
    if (!o) return null;
    const estado = sim.obrasVia.get(o.id);
    return estado ? { o, estado } : null;
  });

  const plan = $derived(obra ? sim.presupuestoVia(obra.id, cuadrillas) : null);

  const capacidad = (o: ObraVia) =>
    o.capacidad === 'doble'
      ? `vía doble, ${CAPACIDAD.doble} trenes al día`
      : o.capacidad === 'centralizada'
        ? `control centralizado, ${CAPACIDAD.centralizada} trenes al día`
        : `vía sencilla, ${CAPACIDAD.sencilla} trenes al día`;

  /** What the work does to the network, in one sentence. */
  function efecto(o: ObraVia): string {
    if (o.tipo === 'nueva') return `Vía nueva del Estado por el trazo oficial (${capacidad(o)}).`;
    if (o.tipo === 'paralela')
      return `Doble vía del Estado junto a la vía de carga, para tus trenes: no la comparten con los privados (${CAPACIDAD.doble} trenes al día).`;
    if (o.tipo === 'modernizar') return `La vía pasa a ser troncal (60 km/h) y con control centralizado (${CAPACIDAD.centralizada} trenes al día).`;
    return `La vía vuelve al servicio y pasa al Estado (${capacidad(o)}).`;
  }

  /** In its group's list a work drops the group's name: "Tramo 1: Palenque–Escárcega". */
  function corto(nombre: string): string {
    const n = nombre.replace(/^Tren Maya, |^Interoceánico, |^Rehabilitar /, '');
    return n.charAt(0).toUpperCase() + n.slice(1);
  }

/** How long it really takes when the money sets the pace (`presupuesto.ts`). */
  const alRitmo = (p: { costoMdp: number; meses: number }) =>
    mesesAlRitmoDelDinero(p.costoMdp, p.meses, sim.dinero, sim.ultimaMensualidad?.mes ?? 0);

  function construir() {
    if (!obra) return;
    sim.construirObraVia(obra.id, cuadrillas);
    confirmando = false;
  }

  function onKey(event: KeyboardEvent) {
    if (event.key !== 'Escape') return;
    if (confirmando) confirmando = false;
    else if (tablero.obraSel) tablero.obraSel = null;
  }
</script>

<svelte:window onkeydown={onKey} />

{#if tablero.catalogo}
  <section class="catalogo panel">
    {#if ficha}
      {@const { o, estado } = ficha}
      <header>
        <button class="volver" onclick={() => (tablero.obraSel = null)}>← Obras del Estado</button>
        <button class="close" onclick={() => tablero.cerrarCatalogo()} aria-label="Cerrar">×</button>
      </header>
      <h2>{o.nombre}</h2>
      <p class="label">{TIPOS_OBRA[o.tipo]} · {km(sim.medidas.get(o.id)?.km ?? 0)}</p>
      <p class="efecto">{efecto(o)}</p>
      <p class="real"><span class="label">En la realidad</span> {o.real}</p>

      {#if estado.fase === 'por-construir' && plan}
        <div class="cuadrillas" role="radiogroup" aria-label="Cuadrillas">
          <span class="label">Cuadrillas</span>
          {#each Array.from({ length: MAX_CUADRILLAS }, (_, i) => i + 1) as n (n)}
            <button class="ctl" class:is-active={cuadrillas === n} role="radio" aria-checked={cuadrillas === n} onclick={() => (cuadrillas = n)}>
              {n}
            </button>
          {/each}
        </div>
        <dl>
          <div><dt>Costo</dt><dd class="mono">{mdp(plan.costoMdp)}</dd></div>
          <div><dt>Duración</dt><dd class="mono">{meses(plan.meses)}</dd></div>
          <div><dt>Empleos en obra</dt><dd class="mono">{personas(plan.personasEnObra)}</dd></div>
        </dl>
        <p class="nota">
          {cuadrillas === MAX_CUADRILLAS
            ? 'Cuatro cuadrillas: el ritmo y el costo del gobierno.'
            : 'Menos cuadrillas que el gobierno: más barata y más lenta.'}
        </p>
        {#if alRitmo(plan) > plan.meses * 1.02}
          <p class="aviso">
            {Number.isFinite(alRitmo(plan))
              ? `Ese ritmo cuesta ${mdp(plan.costoMdp / plan.meses)} al mes y hoy llegan ${mdp(sim.ultimaMensualidad?.total ?? 0)}: con lo que hay y el presupuesto de cada año, tardaría unos ${meses(alRitmo(plan))}, si no hay otras obras.`
              : `El presupuesto (${mdp(sim.dinero)}) no alcanza: la obra se detendrá al ${personas((sim.dinero / plan.costoMdp) * 100)} %.`}
          </p>
        {/if}
        <details class="fuentes">
          <summary>De dónde salen las cifras</summary>
          <p><b>Costo:</b> {o.costo.dato} <a href={o.costo.url} target="_blank" rel="noopener noreferrer">{o.costo.fuente}</a></p>
          <p><b>Tiempo:</b> {o.tiempo.dato} <a href={o.tiempo.url} target="_blank" rel="noopener noreferrer">{o.tiempo.fuente}</a></p>
        </details>
        <div class="acciones">
          <button class="ctl construir" onclick={() => (confirmando = true)} disabled={sim.estado !== 'lista'}>
            Construir · {mdp(plan.costoMdp)}
          </button>
        </div>
      {:else if estado.fase === 'en-obra' && estado.plan}
        {@const faltanMeses = ((1 - estado.avance) * estado.plan.horas) / HORAS_POR_MES}
        <p class="status" class:detenida={estado.detenida} class:en-obra={!estado.detenida}>
          {estado.detenida
            ? 'Obra detenida: se acabó el presupuesto'
            : `En obra · ${estado.plan.cuadrillas} cuadrilla${estado.plan.cuadrillas > 1 ? 's' : ''}`}
        </p>
        <div class="barra"><span style:width="{estado.avance * 100}%"></span></div>
        <dl>
          <div><dt>Avance</dt><dd class="mono">{(estado.avance * 100).toFixed(1)} %</dd></div>
          <div><dt>Termina en</dt><dd class="mono">{meses(faltanMeses)}</dd></div>
          <div><dt>Pagado</dt><dd class="mono">{mdp(estado.pagadoMdp)} de {mdp(estado.plan.costoMdp)}</dd></div>
          <div><dt>Trabajando en la obra</dt><dd class="mono">{personas(estado.detenida ? 0 : estado.plan.personasEnObra)}</dd></div>
        </dl>
      {:else if estado.fase === 'en-servicio'}
        <p class="status en-servicio">En servicio desde el {horaDeJuego(estado.enServicioDesde ?? 0)}</p>
        <dl>
          <div><dt>Costó</dt><dd class="mono">{mdp(estado.pagadoMdp)}</dd></div>
        </dl>
      {/if}
    {:else}
      <header>
        <span class="titulo">Obras del Estado</span>
        <button class="close" onclick={() => tablero.cerrarCatalogo()} aria-label="Cerrar">×</button>
      </header>
      <p class="sub">
        {resumen.enObra} en obra · {resumen.enServicio} en servicio · costos con 4 cuadrillas, el ritmo del gobierno
      </p>
      <div class="lista">
        {#each filas as g (g.id)}
          <h3>{g.nombre}</h3>
          <p class="texto">{g.texto}</p>
          <ul>
            {#each g.obras as { o, estado, plan } (o.id)}
              <li>
                <button class="obra" onclick={() => (tablero.obraSel = o.id)}>
                  <span class="nombre">{corto(o.nombre)}</span>
                  <span class="datos mono">
                    {#if estado?.fase === 'en-obra'}
                      <span class="fase en-obra" class:detenida={estado.detenida}>
                        {estado.detenida ? 'detenida' : 'en obra'} {(estado.avance * 100).toFixed(0)} %
                      </span>
                    {:else if estado?.fase === 'en-servicio'}
                      <span class="fase en-servicio">en servicio</span>
                    {:else if plan}
                      {km(plan.km)} · {mdp(plan.costoMdp)}
                    {/if}
                  </span>
                </button>
              </li>
            {/each}
          </ul>
        {/each}
      </div>
    {/if}
  </section>

  {#if confirmando && plan && obra}
    <div class="fondo-modal" role="presentation" onclick={() => (confirmando = false)}>
      <div
        class="modal panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-obra"
        tabindex="-1"
        onclick={(e) => e.stopPropagation()}
        onkeydown={(e) => e.stopPropagation()}
      >
        <p class="label">Construir · {TIPOS_OBRA[obra.tipo]}</p>
        <h2 id="titulo-obra">{obra.nombre}</h2>
        <p>
          Con {plan.cuadrillas} cuadrilla{plan.cuadrillas > 1 ? 's' : ''}: <b>{mdp(plan.costoMdp)}</b> en <b>{meses(plan.meses)}</b>, con
          {personas(plan.personasEnObra)} personas trabajando. Se paga conforme avanza.
        </p>
        {#if alRitmo(plan) > plan.meses * 1.02}
          <p class="aviso">
            Con el dinero de hoy no alcanza a ese ritmo: la obra irá al paso de lo que llega cada mes (unos
            {Number.isFinite(alRitmo(plan)) ? meses(alRitmo(plan)) : 'sin fin'}, si no hay otras obras).
          </p>
        {/if}
        <div class="acciones">
          <button class="ctl" onclick={() => (confirmando = false)}>Cancelar</button>
          <button class="ctl construir" onclick={construir}>Construir</button>
        </div>
      </div>
    </div>
  {/if}
{/if}

<style>
  /* The State's works wear ink-white: the colour of the State's track on the map. */
  .catalogo {
    --obra: #f4f1de;
    --obra-suave: rgba(244, 241, 222, 0.12);
    position: fixed;
    top: 7.6rem;
    right: 1rem;
    z-index: 31;
    width: 320px;
    max-height: calc(100vh - 7.6rem - 13rem);
    overflow-y: auto;
    padding: 0.8rem 0.9rem 0.9rem;
    border-top: 2px solid var(--obra);
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .titulo {
    font-size: 0.98rem;
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

  .volver {
    border: none;
    background: none;
    padding: 0;
    font-size: 0.72rem;
    color: var(--muted);
    cursor: pointer;
  }

  .volver:hover {
    color: var(--ink);
  }

  .sub {
    margin: 0.2rem 0 0.4rem;
    font-size: 0.68rem;
    color: var(--muted);
  }

  h2 {
    margin: 0.5rem 0 0.15rem;
    font-size: 0.98rem;
    font-weight: 600;
  }

  h3 {
    margin: 0.85rem 0 0.1rem;
    font-size: 0.74rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--obra);
  }

  .texto {
    margin: 0 0 0.35rem;
    font-size: 0.66rem;
    line-height: 1.35;
    color: var(--dim);
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .obra {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    padding: 0.35rem 0.45rem;
    border: 1px solid transparent;
    border-radius: 8px;
    background: none;
    text-align: left;
    cursor: pointer;
  }

  .obra:hover {
    border-color: var(--line);
    background: rgba(255, 255, 255, 0.03);
  }

  .obra .nombre {
    font-size: 0.76rem;
  }

  .obra .datos {
    font-size: 0.66rem;
    color: var(--muted);
  }

  .fase {
    padding: 0 0.3rem;
    border-radius: 4px;
  }

  .fase.en-obra {
    background: var(--obra-suave);
    color: var(--obra);
  }

  .fase.en-servicio {
    background: rgba(74, 222, 128, 0.14);
    color: #b7f5cf;
  }

  .fase.detenida {
    background: rgba(248, 113, 113, 0.14);
    color: #ffc2c2;
  }

  .efecto,
  .real {
    margin: 0.45rem 0 0;
    font-size: 0.72rem;
    line-height: 1.45;
    color: #d6e4f3;
  }

  .real .label {
    margin-right: 0.25rem;
  }

  .status {
    margin: 0.7rem 0 0.6rem;
    padding: 0.3rem 0.55rem;
    border-radius: 8px;
    font-size: 0.72rem;
  }

  .status.en-obra {
    background: var(--obra-suave);
    color: var(--obra);
  }

  .status.en-servicio {
    background: rgba(74, 222, 128, 0.12);
    color: #b7f5cf;
  }

  .status.detenida {
    background: rgba(248, 113, 113, 0.12);
    color: #ffc2c2;
  }

  .cuadrillas {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    margin: 0.75rem 0 0.6rem;
  }

  .cuadrillas .label {
    margin-right: auto;
  }

  .cuadrillas .ctl {
    padding: 0.22rem 0.55rem;
    font-size: 0.72rem;
  }

  .cuadrillas .ctl.is-active {
    background: var(--obra-suave);
    border-color: rgba(244, 241, 222, 0.55);
    color: #fff;
  }

  .barra {
    height: 4px;
    margin-bottom: 0.6rem;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.08);
    overflow: hidden;
  }

  .barra span {
    display: block;
    height: 100%;
    background: var(--obra);
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

  .nota,
  .aviso {
    margin: 0.6rem 0 0;
    font-size: 0.68rem;
    line-height: 1.4;
  }

  .nota {
    color: var(--muted);
  }

  .aviso {
    color: #ffc2c2;
  }

  .fuentes {
    margin-top: 0.6rem;
    font-size: 0.66rem;
    line-height: 1.45;
    color: var(--muted);
  }

  .fuentes summary {
    cursor: pointer;
    color: var(--dim);
  }

  .fuentes p {
    margin: 0.35rem 0 0;
  }

  .fuentes a {
    color: var(--accent);
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
    padding: 0.38rem 0.5rem;
    font-size: 0.74rem;
  }

  .construir {
    border-color: rgba(244, 241, 222, 0.45);
    background: var(--obra-suave);
    color: #fff;
  }

  .construir:hover:not(:disabled) {
    background: rgba(244, 241, 222, 0.2);
    border-color: rgba(244, 241, 222, 0.7);
  }

  .construir:disabled {
    opacity: 0.45;
    cursor: default;
  }

  /* The confirmation: the site's own glass card over a dimmed board. */
  .fondo-modal {
    position: fixed;
    inset: 0;
    z-index: 60;
    display: grid;
    place-items: center;
    background: rgba(3, 6, 13, 0.55);
  }

  .modal {
    width: min(400px, calc(100vw - 2rem));
    padding: 1rem 1.1rem 1.1rem;
    background: var(--glass-strong);
    border-top: 2px solid #f4f1de;
  }

  .modal h2 {
    margin: 0.2rem 0 0.6rem;
    font-size: 1.05rem;
  }

  .modal p:not(.label) {
    margin: 0 0 0.5rem;
    font-size: 0.8rem;
    line-height: 1.5;
    color: #d6e4f3;
  }

  .modal b {
    color: var(--ink);
  }

  .modal .construir {
    border-color: rgba(244, 241, 222, 0.45);
    background: rgba(244, 241, 222, 0.12);
    color: #fff;
  }

  @media (max-width: 900px) {
    .catalogo {
      display: none;
    }
  }
</style>
