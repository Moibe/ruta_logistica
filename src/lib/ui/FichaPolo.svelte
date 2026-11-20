<script lang="ts">
  import { ESTACION_MAX_KM } from '$lib/domain/red';
  import { MAX_CUADRILLAS, presupuestar } from '$lib/domain/obras';
  import { PROGRAMAS_POLO, POLOS } from '$lib/domain/sitios';
  import { sim } from '$lib/state/simulacion.svelte';
  import { tablero } from '$lib/state/tablero.svelte';
  import { mdp, meses, personas } from './formato';

  /**
   * The card of the selected Polo del Bienestar, at the right like a train's.
   * Its content follows the polo's life:
   *
   * - **por construir**: pick how many crews to send and see what it costs,
   *   how long it takes and the jobs it makes; *Construir* asks to confirm in
   *   a dialog of the site's own (never the browser's confirm()).
   * - **en obra**: progress, money paid, people on site; stopped when the
   *   money runs out.
   * - **operando**: occupancy and permanent jobs — which only grow while a
   *   train can get there.
   */

  const HORAS_POR_MES = (365 * 24) / 12;

  let cuadrillas = $state(1);
  let confirmando = $state(false);

  const polo = $derived(tablero.poloSel ? (POLOS.find((p) => p.id === tablero.poloSel) ?? null) : null);

  // Another polo, or none: start over at one crew, no dialog open.
  $effect(() => {
    tablero.poloSel;
    cuadrillas = 1;
    confirmando = false;
  });

  // A train or ship picked elsewhere takes the card's place.
  $effect(() => {
    if (sim.seleccion) tablero.poloSel = null;
  });

  const ficha = $derived.by(() => {
    sim.horas;
    sim.versionRed;
    const p = polo;
    if (!p) return null;
    const obra = sim.obras.get(p.id);
    if (!obra) return null;
    const km = sim.red?.aLaVia.get(`polo:${p.id}`);
    const alcanzable = km !== undefined && km <= ESTACION_MAX_KM;
    return { p, obra, km, alcanzable, conectado: sim.conectado(p.id) };
  });

  const plan = $derived(polo ? presupuestar(polo, cuadrillas) : null);

  function construir() {
    if (!polo) return;
    sim.construirPolo(polo.id, cuadrillas);
    confirmando = false;
  }

  function onKey(event: KeyboardEvent) {
    if (confirmando && event.key === 'Escape') confirmando = false;
  }
</script>

<svelte:window onkeydown={onKey} />

{#if ficha}
  {@const { p, obra } = ficha}
  <section class="ficha panel">
    <header>
      <span class="nombre">{p.nombre}</span>
      <button class="close" onclick={() => (tablero.poloSel = null)} aria-label="Cerrar">×</button>
    </header>
    <p class="label">Polo del Bienestar · {PROGRAMAS_POLO[p.programa]} · {personas(p.hectareas)} ha</p>
    <p class="donde">{p.municipio}</p>

    {#if obra.fase === 'por-construir' && plan}
      <p class="status por-construir">Por construir</p>
      <div class="cuadrillas" role="radiogroup" aria-label="Cuadrillas">
        <span class="label">Cuadrillas</span>
        {#each Array.from({ length: MAX_CUADRILLAS }, (_, i) => i + 1) as n (n)}
          <button
            class="ctl"
            class:is-active={cuadrillas === n}
            role="radio"
            aria-checked={cuadrillas === n}
            onclick={() => (cuadrillas = n)}
          >
            {n}
          </button>
        {/each}
      </div>
      <dl>
        <div><dt>Costo</dt><dd class="mono">{mdp(plan.costoMdp)}</dd></div>
        <div><dt>Duración</dt><dd class="mono">{meses(plan.meses)}</dd></div>
        <div><dt>Empleos en obra</dt><dd class="mono">{personas(plan.personasEnObra)}</dd></div>
        <div><dt>Empleos con el polo lleno</dt><dd class="mono">{personas(plan.empleosLleno)}</dd></div>
      </dl>
      {#if !ficha.alcanzable}
        <p class="aviso">
          La vía más cercana está a {personas(ficha.km ?? 0)} km. Construido, no llegarán empresas hasta que llegue el tren.
        </p>
      {:else}
        <p class="nota">Vía férrea a {personas(ficha.km ?? 0)} km: al terminarse tendrá su estación.</p>
      {/if}
      {#if plan.costoMdp > sim.dinero}
        <p class="aviso">
          El presupuesto ({mdp(sim.dinero)}) no alcanza: la obra se detendrá al
          {personas((sim.dinero / plan.costoMdp) * 100)} %.
        </p>
      {/if}
      <div class="acciones">
        <button class="ctl construir" onclick={() => (confirmando = true)} disabled={sim.estado !== 'lista'}>
          Construir · {mdp(plan.costoMdp)}
        </button>
      </div>
    {:else if obra.fase === 'en-obra' && obra.plan}
      {@const faltanMeses = ((1 - obra.avance) * obra.plan.horas) / HORAS_POR_MES}
      <p class="status" class:detenida={obra.detenida} class:en-obra={!obra.detenida}>
        {obra.detenida ? 'Obra detenida: se acabó el presupuesto' : `En obra · ${obra.plan.cuadrillas} cuadrilla${obra.plan.cuadrillas > 1 ? 's' : ''}`}
      </p>
      <div class="barra"><span style:width="{obra.avance * 100}%"></span></div>
      <dl>
        <div><dt>Avance</dt><dd class="mono">{(obra.avance * 100).toFixed(1)} %</dd></div>
        <div><dt>Termina en</dt><dd class="mono">{meses(faltanMeses)}</dd></div>
        <div><dt>Pagado</dt><dd class="mono">{mdp(obra.pagadoMdp)} de {mdp(obra.plan.costoMdp)}</dd></div>
        <div><dt>Trabajando en la obra</dt><dd class="mono">{personas(obra.detenida ? 0 : obra.plan.personasEnObra)}</dd></div>
      </dl>
    {:else if obra.fase === 'operando'}
      <p class="status" class:operando={ficha.conectado} class:aislado={!ficha.conectado}>
        {ficha.conectado ? 'Operando · llegan empresas' : 'Construido, sin tren: no llegan empresas'}
      </p>
      <div class="barra"><span style:width="{obra.ocupacion * 100}%"></span></div>
      <dl>
        <div><dt>Ocupación</dt><dd class="mono">{(obra.ocupacion * 100).toFixed(0)} %</dd></div>
        <div>
          <dt>Empleos permanentes</dt>
          <dd class="mono">{personas(obra.ocupacion * (obra.plan?.empleosLleno ?? 0))} de {personas(obra.plan?.empleosLleno ?? 0)}</dd>
        </div>
        <div>
          <dt>Tren</dt>
          <dd>{ficha.conectado ? `Estación a ${personas(ficha.km ?? 0)} km` : `Vía a ${personas(ficha.km ?? 0)} km`}</dd>
        </div>
      </dl>
    {/if}
  </section>

  {#if confirmando && plan}
    <div class="fondo-modal" role="presentation" onclick={() => (confirmando = false)}>
      <div
        class="modal panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-construir"
        tabindex="-1"
        onclick={(e) => e.stopPropagation()}
        onkeydown={(e) => e.stopPropagation()}
      >
        <p class="label">Construir polo</p>
        <h2 id="titulo-construir">{p.nombre}</h2>
        <p>
          Con {plan.cuadrillas} cuadrilla{plan.cuadrillas > 1 ? 's' : ''}: <b>{mdp(plan.costoMdp)}</b> en
          <b>{meses(plan.meses)}</b>, con {personas(plan.personasEnObra)} personas trabajando. Se paga conforme avanza.
        </p>
        {#if plan.costoMdp > sim.dinero}
          <p class="aviso">Con el presupuesto actual la obra se detendrá antes de terminarse.</p>
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
  .ficha {
    position: fixed;
    top: 7.6rem;
    right: 1rem;
    z-index: 30;
    width: 272px;
    padding: 0.8rem 0.9rem 0.9rem;
    border-top: 2px solid var(--polo);
  }

  header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .nombre {
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

  .ficha > p.label {
    margin: 0.15rem 0 0;
  }

  .donde {
    margin: 0.1rem 0 0.6rem;
    font-size: 0.72rem;
    color: var(--muted);
  }

  .status {
    margin: 0 0 0.6rem;
    padding: 0.3rem 0.55rem;
    border-radius: 8px;
    font-size: 0.72rem;
  }

  .status.por-construir {
    border: 1px dashed rgba(244, 114, 182, 0.5);
    color: #f9c6dd;
  }

  .status.en-obra,
  .status.operando {
    background: rgba(244, 114, 182, 0.14);
    color: #ffd6ea;
  }

  .status.detenida,
  .status.aislado {
    background: rgba(248, 113, 113, 0.12);
    color: #ffc2c2;
  }

  .cuadrillas {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    margin-bottom: 0.6rem;
  }

  .cuadrillas .label {
    margin-right: auto;
  }

  .cuadrillas .ctl {
    padding: 0.22rem 0.55rem;
    font-size: 0.72rem;
  }

  .cuadrillas .ctl.is-active {
    background: rgba(244, 114, 182, 0.18);
    border-color: rgba(244, 114, 182, 0.6);
    color: #ffe4f1;
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
    background: var(--polo);
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
    border-color: rgba(244, 114, 182, 0.5);
    background: rgba(244, 114, 182, 0.12);
    color: #ffe4f1;
  }

  .construir:hover:not(:disabled) {
    background: rgba(244, 114, 182, 0.22);
    border-color: rgba(244, 114, 182, 0.7);
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
    width: min(380px, calc(100vw - 2rem));
    padding: 1rem 1.1rem 1.1rem;
    background: var(--glass-strong);
    border-top: 2px solid var(--polo);
  }

  .modal h2 {
    margin: 0.2rem 0 0.6rem;
    font-size: 1.05rem;
    font-weight: 600;
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

  @media (max-width: 900px) {
    .ficha {
      display: none;
    }
  }
</style>
