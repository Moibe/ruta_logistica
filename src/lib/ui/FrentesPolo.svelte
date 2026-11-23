<script lang="ts">
  import {
    capacidadMw,
    conEnergia,
    conEspuela,
    cuadrillasUrbanas,
    ESPUELA,
    fuenteInterior,
    frentesDe,
    interior,
    maxCuadrillas,
    MVA_BANCO,
    planFrente,
    SUBESTACION,
    SUBESTACION_DATOS,
    urbanizado,
  } from '$lib/domain/interior';
  import { MAX_CUADRILLAS, HORAS_POR_MES } from '$lib/domain/obras';
  import { PROGRAMAS_POLO, POLOS } from '$lib/domain/sitios';
  import { clavePolo } from '$lib/domain/realidad';
  import { fechaLarga } from '$lib/domain/calendario';
  import { sim } from '$lib/state/simulacion.svelte';
  import { mdp, meses, personas } from './formato';
  import LotesPolo from './LotesPolo.svelte';
  import { untrack } from 'svelte';

  /**
   * Inside a polo, on the right, in two tabs. **Obra**: its work by fronts.
   * Each front takes crews from the polo's four (0 stops it where it is); the
   * panel says what that costs, how long it takes and what's been paid. The
   * spur gives the polo its station; the substation, enlarged bank by bank,
   * is the CFE's and paid from its till. **Lotes** (`LotesPolo`): its company
   * lots and the sector each is promoted for. In Realidad it shows how the
   * real polo stood, with nothing to play.
   */
  let { id, loteSel = $bindable(null) }: { id: string; loteSel?: number | null } = $props();

  const polo = $derived(POLOS.find((p) => p.id === id)!);
  const datos = $derived(interior(id)!);

  const vista = $derived.by(() => {
    sim.horas;
    sim.obras;
    const o = sim.obras.get(id);
    if (!o?.frentes) return null;
    const frentes = frentesDe(id).map((f) => {
      const e = o.frentes![f.id];
      const n = e.cuadrillas;
      const plan = planFrente(polo, f.id, Math.max(1, n));
      return {
        ...f,
        e,
        plan,
        hecho: f.id !== SUBESTACION && e.avance >= 1,
        faltaMeses: plan && n > 0 ? ((1 - e.avance) * plan.horas) / HORAS_POR_MES : null,
        max: maxCuadrillas(o, id, f.id),
      };
    });
    const alMesDe = (cfe: boolean) =>
      frentes.reduce((s, f) => s + ((f.id === SUBESTACION) === cfe && f.e.cuadrillas > 0 && !f.hecho && f.plan ? f.plan.costoMdp / f.plan.meses : 0), 0);
    return {
      o,
      frentes,
      alMes: alMesDe(false),
      alMesCfe: alMesDe(true),
      pagadoCfe: o.frentes[SUBESTACION]?.pagadoMdp ?? 0,
      bancos: o.bancos ?? 0,
      capacidad: capacidadMw(o, id),
      conEnergia: conEnergia(o),
      urbanizado: urbanizado(o, id),
      espuela: conEspuela(o),
      urbanas: cuadrillasUrbanas(o, id),
    };
  });

  const realidad = $derived(sim.modo === 'realidad');
  const real = $derived(realidad ? sim.real.get(clavePolo(id)) : null);

  function poner(frente: string, n: number) {
    sim.cuadrillasEnFrente(id, frente, n);
  }

  const estadoTexto = $derived.by(() => {
    const v = vista;
    if (!v) return '';
    if (realidad) return real?.etapa === 'en-operacion' ? 'En operación' : real?.etapa === 'en-obra' ? 'En obra' : 'Declarado, sin obra reportada';
    if (v.o.fase === 'por-construir') return 'Por construir: pon cuadrillas en sus frentes';
    if (v.o.fase === 'en-obra') return v.o.detenida ? 'Obra detenida: se acabó el presupuesto' : `En obra · ${Math.round(v.o.avance * 100)} % urbanizado`;
    if (!sim.conectado(id)) return v.espuela ? 'Urbanizado · la estación llega con la red' : 'Urbanizado, sin tren: falta la espuela';
    return `Operando · ${Math.round(v.o.ocupacion * 100)} % ocupado`;
  });

  /** The work tab until the polo is urbanized, then its lots. */
  let pestaña = $state<'obra' | 'lotes'>(untrack(() => (sim.obras.get(id)?.fase === 'operando' ? 'lotes' : 'obra')));
  // A lot picked on the map shows the lots.
  $effect(() => {
    if (loteSel !== null) pestaña = 'lotes';
  });

  const fuentes = $derived(datos.fuentesLista.map((k) => fuenteInterior(k)).filter((f) => f?.url));
</script>

{#if vista}
  <section class="frentes panel">
    <header>
      <span class="label">Polo del Bienestar · {PROGRAMAS_POLO[polo.programa]}</span>
      <h2>{polo.nombre}</h2>
      <p class="donde">{datos.lugar} · {personas(polo.hectareas)} ha</p>
    </header>

    <p
      class="status"
      class:operando={vista.o.fase === 'operando' && !realidad}
      class:detenida={vista.o.detenida && !realidad}
      class:por-construir={vista.o.fase === 'por-construir' && !realidad}
    >
      {estadoTexto}{realidad ? ` · al ${fechaLarga(sim.horas)}` : ''}
    </p>

    <div class="pestañas" role="tablist">
      <button role="tab" class:activa={pestaña === 'obra'} aria-selected={pestaña === 'obra'} onclick={() => (pestaña = 'obra')}>Obra</button>
      <button role="tab" class:activa={pestaña === 'lotes'} aria-selected={pestaña === 'lotes'} onclick={() => (pestaña = 'lotes')}>Lotes y empresas</button>
    </div>

    {#if pestaña === 'lotes'}
      <LotesPolo {id} bind:loteSel />
    {:else}
    {#if !realidad && !vista.urbanizado}
      <p class="cupo">
        Cuadrillas del polo <b class="mono">{vista.urbanas} de {MAX_CUADRILLAS}</b>
        <span>· repártelas entre sus frentes</span>
      </p>
    {/if}
    <ol class="lista">
      {#each vista.frentes as f (f.id)}
        <li class:hecho={f.hecho} class:espuela={f.id === ESPUELA} class:cfe={f.id === SUBESTACION}>
          <div class="fila">
            <span class="nombre" title={f.parte ? `${f.nombre}: ${Math.round(f.parte * 100)} % del costo del polo` : f.nombre}>{f.corto}</span>
            {#if f.hecho}
              <span class="listo">Terminado</span>
            {:else if !realidad}
              <span class="paso" role="group" aria-label="Cuadrillas en {f.nombre}">
                <button class="ctl" onclick={() => poner(f.id, f.e.cuadrillas - 1)} disabled={f.e.cuadrillas <= 0} aria-label="Una cuadrilla menos">−</button>
                <span class="mono n" class:cero={f.e.cuadrillas === 0}>{f.e.cuadrillas}</span>
                <button class="ctl" onclick={() => poner(f.id, f.e.cuadrillas + 1)} disabled={f.e.cuadrillas >= f.max || sim.estado !== 'lista'} aria-label="Una cuadrilla más">+</button>
              </span>
            {/if}
          </div>
          <div class="barra"><span style:width="{f.e.avance * 100}%" class:parada={f.e.detenida}></span></div>
          {#if f.id === SUBESTACION}
            <p class="detalle cfe">
              Da {vista.capacidad.toLocaleString('es-MX', { maximumFractionDigits: 1 })} MVA a sus empresas{vista.bancos ? ` (${vista.bancos} banco${vista.bancos > 1 ? 's' : ''} de la CFE)` : ''}.
            </p>
          {/if}
          <p class="detalle">
            {#if realidad}
              {f.id === ESPUELA ? 'No se ha reportado' : f.id === SUBESTACION ? 'No se ha reportado una ampliación' : f.hecho ? 'Lo que costó cada parte no se publica' : `${Math.round(f.e.avance * 100)} % (el avance de toda la obra)`}
            {:else if f.id === SUBESTACION && !vista.conEnergia}
              Se amplía cuando esté terminado el frente de energía.
            {:else if f.hecho}
              Pagado {mdp(f.e.pagadoMdp)}
            {:else if f.e.cuadrillas > 0 && f.plan}
              {f.e.detenida ? `Detenido: no hay dinero${f.id === SUBESTACION ? ' en la caja de la CFE' : ''} · ` : ''}{Math.round(f.e.avance * 100)} % · termina en {meses(f.faltaMeses ?? 0)} · {mdp(f.plan.costoMdp / f.plan.meses)}/mes{f.id === SUBESTACION ? ' de la CFE' : ''}
            {:else if f.plan}
              {f.e.avance > 0 ? `${Math.round(f.e.avance * 100)} %, parado · ` : ''}Con 1 cuadrilla: {mdp(f.plan.costoMdp * (1 - f.e.avance))} en {meses(f.plan.meses * (1 - f.e.avance))}{f.id === SUBESTACION ? `, de la CFE: +${MVA_BANCO} MVA` : ''}
            {/if}
          </p>
        </li>
      {/each}
    </ol>

    {#if !realidad}
      <dl>
        <div><dt>Pagado por el Estado</dt><dd class="mono">{mdp(vista.o.pagadoMdp)}</dd></div>
        {#if vista.pagadoCfe > 0}
          <div><dt>Pagado por la CFE</dt><dd class="mono">{mdp(vista.pagadoCfe)}</dd></div>
        {/if}
        <div><dt>Trabajando en la obra</dt><dd class="mono">{personas(vista.o.plan?.personasEnObra ?? 0)}</dd></div>
        {#if vista.alMes > 0}
          <div><dt>Gasto al mes</dt><dd class="mono">{mdp(vista.alMes)}</dd></div>
        {/if}
        {#if vista.alMesCfe > 0}
          <div><dt>Gasto al mes de la CFE</dt><dd class="mono">{mdp(vista.alMesCfe)}</dd></div>
        {/if}
        {#if vista.o.fase === 'operando'}
          <div><dt>Empleos permanentes</dt><dd class="mono">{personas(vista.o.ocupacion * (vista.o.plan?.empleosLleno ?? 0))}</dd></div>
        {/if}
      </dl>
      {#if vista.alMes > 0 && sim.dinero < vista.alMes}
        <p class="aviso">Quedan {mdp(sim.dinero)} en la caja del Estado: a este ritmo la obra se detendrá antes de fin de mes.</p>
      {/if}
      {#if vista.alMesCfe > 0 && sim.dineroCfe < vista.alMesCfe}
        <p class="aviso">Quedan {mdp(sim.dineroCfe)} en la caja de la CFE: la subestación se detendrá antes de fin de mes.</p>
      {/if}
      <p class="nota">
        El polo tiene 4 cuadrillas para calles, agua, energía y servicios (con ese esfuerzo se hizo Huamantla en 8.5 meses); la espuela es obra de vía y lleva las suyas, y la subestación es de la CFE: sus cuadrillas y su dinero. En frentes distintos trabajan a la vez; varias en un mismo frente rinden cada vez menos; al terminar un frente, sus cuadrillas quedan libres. Se paga conforme avanza; con 0 el frente se detiene donde va.
      </p>
    {:else}
      <p class="nota">
        {datos.realNota}
      </p>
    {/if}
    {/if}

    <details class="mas">
      <summary>Datos del polo</summary>
      <p>{datos.energia.dato}</p>
      <p>{SUBESTACION_DATOS.dato}</p>
      <p>{datos.espuela.dato}</p>
      <p>{datos.lotes.dato}</p>
      <p>{datos.frentesDato.dato}</p>
      <p><b>Vocaciones (DOF):</b> {datos.vocaciones.join(', ')}.</p>
    </details>
    <details class="mas">
      <summary>Fuentes</summary>
      {#each fuentes as f (f.url)}
        <p><a href={f.url} target="_blank" rel="noopener noreferrer">{f.fuente}</a></p>
      {/each}
    </details>
  </section>
{/if}

<style>
  .frentes {
    position: fixed;
    top: 5.2rem;
    right: 1rem;
    bottom: 1rem;
    z-index: 30;
    width: 320px;
    padding: 0.85rem 0.95rem 0.95rem;
    border-top: 2px solid var(--polo);
    overflow-y: auto;
  }

  .pestañas {
    display: flex;
    gap: 0.25rem;
    margin: 0 0 0.7rem;
    padding: 0.2rem;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--line);
  }

  .pestañas button {
    flex: 1;
    padding: 0.28rem 0.4rem;
    border: none;
    border-radius: 8px;
    background: none;
    font-size: 0.72rem;
    color: var(--muted);
    cursor: pointer;
  }

  .pestañas button.activa {
    background: rgba(244, 114, 182, 0.16);
    color: #ffe4f1;
  }

  header h2 {
    margin: 0.15rem 0 0;
    font-size: 1.1rem;
    font-weight: 600;
  }

  .donde {
    margin: 0.1rem 0 0.6rem;
    font-size: 0.72rem;
    color: var(--muted);
  }

  .status {
    margin: 0 0 0.7rem;
    padding: 0.3rem 0.55rem;
    border-radius: 8px;
    font-size: 0.72rem;
    background: rgba(244, 114, 182, 0.14);
    color: #ffd6ea;
  }

  .status.por-construir {
    background: none;
    border: 1px dashed rgba(244, 114, 182, 0.5);
    color: #f9c6dd;
  }

  .status.detenida {
    background: rgba(248, 113, 113, 0.12);
    color: #ffc2c2;
  }

  .cupo {
    margin: 0 0 0.55rem;
    font-size: 0.72rem;
    color: var(--muted);
  }

  .cupo b {
    color: #ffe4f1;
    font-weight: 500;
  }

  .cupo span {
    color: var(--dim);
  }

  .lista {
    list-style: none;
    margin: 0 0 0.7rem;
    padding: 0;
    display: grid;
    gap: 0.55rem;
  }

  .detalle.cfe {
    color: #fde68a;
  }

  .lista li.espuela {
    padding-top: 0.55rem;
    border-top: 1px solid var(--line);
  }

  .fila {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .nombre {
    font-size: 0.78rem;
  }

  .hecho .nombre {
    color: var(--muted);
  }

  .listo {
    font-size: 0.68rem;
    color: #b7f5cf;
  }

  .paso {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
  }

  .paso .ctl {
    padding: 0.1rem 0.45rem;
    font-size: 0.8rem;
    line-height: 1.2;
  }

  .paso .ctl:disabled {
    opacity: 0.35;
    cursor: default;
  }

  .n {
    min-width: 1.1rem;
    text-align: center;
    font-size: 0.8rem;
    color: #ffe4f1;
  }

  .n.cero {
    color: var(--dim);
  }

  .barra {
    height: 4px;
    margin: 0.3rem 0 0.25rem;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.08);
    overflow: hidden;
  }

  .barra span {
    display: block;
    height: 100%;
    background: var(--polo);
  }

  .barra span.parada {
    background: #f87171;
  }

  .hecho .barra span {
    background: #6ee7b7;
  }

  .detalle {
    margin: 0;
    font-size: 0.66rem;
    line-height: 1.35;
    color: var(--muted);
  }

  dl {
    margin: 0;
    display: grid;
    gap: 0.3rem;
    padding-top: 0.6rem;
    border-top: 1px solid var(--line);
  }

  dl > div {
    display: flex;
    justify-content: space-between;
    gap: 0.6rem;
    font-size: 0.74rem;
  }

  dt {
    color: var(--muted);
  }

  dd {
    margin: 0;
  }

  .nota,
  .aviso {
    margin: 0.6rem 0 0;
    font-size: 0.66rem;
    line-height: 1.4;
    color: var(--muted);
  }

  .aviso {
    color: #ffc2c2;
  }

  .mas {
    margin-top: 0.6rem;
    font-size: 0.66rem;
    line-height: 1.45;
    color: var(--muted);
  }

  .mas summary {
    cursor: pointer;
    color: var(--dim);
  }

  .mas p {
    margin: 0.35rem 0 0;
  }

  .mas b {
    color: var(--ink);
    font-weight: 500;
  }

  .mas a {
    color: var(--accent);
  }
</style>
