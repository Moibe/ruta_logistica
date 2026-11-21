<script lang="ts">
  import { MAX_CUADRILLAS, HORAS_POR_MES } from '$lib/domain/obras';
  import { GRUPOS_OBRA, obraVia, OBRAS_VIA, TIPOS_OBRA, type ObraVia } from '$lib/domain/obrasVia';
  import { CAPACIDAD } from '$lib/domain/red';
  import { mesesAlRitmoDelDinero } from '$lib/domain/presupuesto';
  import { aporte, CAJA_CFE_MES, mesesConCajaCfe, OBRAS_ENERGIA, obraEnergia, type ObraEnergia } from '$lib/domain/energia';
  import { fechaLarga, horasDeFecha, mesDe } from '$lib/domain/calendario';
  import {
    COMPRA_DEER_PARK,
    DEER_PARK,
    fuentePetroleo,
    mesesConCajaPemex,
    OBRAS_PEMEX,
    obraPemex,
    procesoReal,
    refineria,
    rendimiento,
    type ObraPemex,
    type Refineria,
  } from '$lib/domain/petroleo';
  import { fechaEnPalabras, fichaReal, HORAS_DEL_CORTE, TEXTO_ETAPA } from '$lib/domain/realidad';
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

  // ---- the CFE's plants ---------------------------------------------------------------------

  const planta = $derived(tablero.obraSel ? obraEnergia(tablero.obraSel) : null);
  const planPlanta = $derived(planta ? sim.presupuestoPlanta(planta.id, cuadrillas) : null);

  const fichaPlanta = $derived.by(() => {
    sim.horas;
    sim.obrasEnergia;
    const o = planta;
    if (!o) return null;
    const estado = sim.obrasEnergia.get(o.id);
    const region = sim.energia.find((e) => e.region.id === o.region);
    if (!estado || !region) return null;
    // What the region's margins would be with the plant in service.
    const con = (e: 'tarde' | 'noche') => ((region.capacidad[e] + aporte(o, e) - region.demanda) / region.demanda) * 100;
    return { o, estado, region, despues: { tarde: con('tarde'), noche: con('noche') } };
  });

  const filasEnergia = $derived.by(() => {
    sim.horas;
    sim.obrasEnergia;
    return OBRAS_ENERGIA.map((o) => ({ o, estado: sim.obrasEnergia.get(o.id), plan: sim.presupuestoPlanta(o.id, MAX_CUADRILLAS) }));
  });

  /** How long a plant really takes when the CFE's till sets the pace. */
  const alRitmoCfe = (p: { costoMdp: number; meses: number }) => mesesConCajaCfe(p.costoMdp, p.meses, sim.dineroCfe);

  const pct = (n: number) => `${n.toLocaleString('es-MX', { maximumFractionDigits: 1 })} %`;
  const nombreTec = (o: ObraEnergia) => o.tecnologia.toLowerCase();

  function construirPlanta() {
    if (!planta) return;
    sim.construirPlanta(planta.id, cuadrillas);
    confirmando = false;
  }

  // ---- Pemex's works ---------------------------------------------------------------------------

  /** Deer Park's purchase isn't a work with crews: its card has an id of its own. */
  const COMPRA = 'deer-park-compra';
  let confirmandoCompra = $state(false);
  $effect(() => {
    tablero.obraSel;
    confirmandoCompra = false;
  });

  const obraP = $derived(tablero.obraSel ? obraPemex(tablero.obraSel) : null);
  const planPemex = $derived(obraP ? sim.presupuestoObraPemex(obraP.id, cuadrillas) : null);

  const fichaPemex = $derived.by(() => {
    sim.horas;
    sim.obrasPemex;
    sim.refinacion;
    sim.deerParkPropia;
    const compra = tablero.obraSel === COMPRA;
    const o = obraP;
    if (!o && !compra) return null;
    const r = refineria(compra ? DEER_PARK : o!.refineria);
    if (!r) return null;
    return { o, r, compra, estado: o ? (sim.obrasPemex.get(o.id) ?? null) : null, ahora: sim.refinacion?.porRefineria.get(r.id) ?? null };
  });

  const filasPemex = $derived.by(() => {
    sim.horas;
    sim.obrasPemex;
    return OBRAS_PEMEX.map((o) => ({ o, estado: sim.obrasPemex.get(o.id), plan: sim.presupuestoObraPemex(o.id, MAX_CUADRILLAS) }));
  });

  /** How long a Pemex work really takes when Pemex's till sets the pace. */
  const alRitmoPemex = (p: { costoMdp: number; meses: number }) => mesesConCajaPemex(p.costoMdp, p.meses, sim.dineroPemex, mesDe(sim.horas));
  /** Thousand barrels a day, short for the card's figures. */
  const mbdCorto = (n: number) => `${Math.round(n).toLocaleString('es-MX')} mil b/d`;
  const mbd = (n: number) => `${Math.round(n).toLocaleString('es-MX')} mil barriles diarios`;

  /** What a Pemex work does, in one sentence. */
  function efectoPemex(o: ObraPemex, r: Refineria): string {
    if (o.tipo === 'rehabilitar')
      return `Lleva la refinería de ${mbd(r.proceso2018)} a ${mbd(r.optima)} conforme avanza la obra: unos ${Math.round((r.optima - r.proceso2018) * rendimiento(r))} mil barriles diarios más de gasolina, diésel y turbosina.`;
    if (o.tipo === 'nueva')
      return `Al terminarla procesa ${mbd(r.optima)} y da unos ${Math.round(r.optima * rendimiento(r))} mil de gasolina y diésel.`;
    if (o.tipo === 'coquizadora')
      return `Al terminarla, la refinería da ${mbd(o.combustiblesExtra ?? 0)} más de gasolina y diésel con el combustóleo que hoy le sobra.`;
    return `Lleva Deer Park de ${mbd(r.proceso2018)} a ${mbd(r.optima)} conforme avanza la obra.`;
  }

  function construirPemex() {
    if (!obraP) return;
    sim.construirObraPemex(obraP.id, cuadrillas);
    confirmando = false;
  }

  function comprarDeerPark() {
    if (sim.comprarDeerPark()) tablero.obraSel = 'deer-park-mejora';
    confirmandoCompra = false;
  }

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
    if (confirmandoCompra) confirmandoCompra = false;
    else if (confirmando) confirmando = false;
    else if (tablero.obraSel) tablero.obraSel = null;
  }
</script>

<svelte:window onkeydown={onKey} />

{#snippet etapaReal(id: string)}
  {@const r = sim.real.get(id)}
  {#if r}
    <span class="fase" class:en-obra={r.etapa === 'en-obra'} class:en-servicio={r.etapa === 'en-operacion'}>
      {TEXTO_ETAPA[r.etapa]}{r.etapa === 'en-obra' && r.avance !== null ? ` ${r.estimado ? '≈ ' : ''}${(r.avance * 100).toFixed(0)} %` : ''}
    </span>
  {/if}
{/snippet}

<!-- Where a work really stood on the date shown, with its dates and sources (Realidad). -->
{#snippet fichaRealidad(id: string)}
  {@const r = sim.real.get(id)}
  {@const fr = fichaReal(id)}
  {#if r}
    <p class="status" class:en-obra={r.etapa === 'en-obra'} class:en-servicio={r.etapa === 'en-operacion'}>
      {TEXTO_ETAPA[r.etapa].charAt(0).toUpperCase() + TEXTO_ETAPA[r.etapa].slice(1)} · al {fechaLarga(sim.horas)}
    </p>
    {#if r.etapa === 'en-obra' && r.avance !== null}
      <div class="barra"><span style:width="{r.avance * 100}%"></span></div>
    {/if}
    <dl>
      {#if r.etapa === 'en-obra' && r.avance !== null}
        <div>
          <dt>Avance{r.estimado ? ' (estimado entre datos oficiales)' : ''}</dt>
          <dd class="mono">{r.estimado ? '≈ ' : ''}{(r.avance * 100).toFixed(r.estimado ? 0 : 1)} %</dd>
        </div>
      {/if}
      {#if r.parcial}<div><dt>Ya abrió una parte</dt><dd>{r.parcial}</dd></div>{/if}
      {#if fr?.anuncio}<div><dt>Anunciada</dt><dd class="mono">{fechaEnPalabras(fr.anuncio)}</dd></div>{/if}
      {#if fr?.inicio}
        <div><dt>Inicio de obra</dt><dd class="mono">{fechaEnPalabras(fr.inicio)}</dd></div>
      {:else if fr?.enObraAl}
        <div>
          <dt>Inicio de obra</dt>
          <dd>no publicado; ya en obra {fr.enObraAl.split('-').length === 3 ? 'el' : 'en'} {fechaEnPalabras(fr.enObraAl)}</dd>
        </div>
      {/if}
      {#each fr?.avances ?? [] as a (a.fecha)}
        <div><dt>Avance oficial al {fechaEnPalabras(a.fecha)}</dt><dd class="mono">{a.pct} %</dd></div>
      {/each}
      {#if fr?.operacion}
        <div>
          <dt>{sim.horas >= horasDeFecha(fr.operacion) ? 'En operación desde' : 'Entró en operación, más adelante, el'}</dt>
          <dd class="mono">{fechaEnPalabras(fr.operacion)}</dd>
        </div>
      {:else if fr?.prevista}
        <div><dt>Apertura prevista</dt><dd class="mono">{fr.prevista}</dd></div>
      {/if}
    </dl>
    {#if fr?.situacion && sim.horas >= HORAS_DEL_CORTE - 24 * 90}<p class="nota">{fr.situacion}</p>{/if}
    {#if fr?.nota}<p class="nota">{fr.nota}</p>{/if}
    {#if !fr}
      <p class="nota">No hay un proyecto oficial para esta obra: está en el catálogo del juego como obra posible.</p>
    {:else}
      <details class="fuentes" open>
        <summary>Fuentes</summary>
        {#each fr.fuentesCitadas as c (c.url + c.fuente)}
          <p><a href={c.url} target="_blank" rel="noopener noreferrer">{c.fuente}</a></p>
        {/each}
      </details>
    {/if}
  {/if}
{/snippet}

<!-- A refinery as it stands: in the game, with the player's works; in Realidad, what it really ran. -->
{#snippet bloqueRefineria(r: Refineria, ahora: { proceso: number; combustibles: number } | null)}
  <dl class="refineria">
    <div><dt>Capacidad</dt><dd class="mono">{mbdCorto(r.capacidad)}</dd></div>
    {#if sim.modo === 'realidad'}
      {@const pr = procesoReal(r, sim.horas)}
      <div>
        <dt>Procesó</dt>
        <dd class="mono">{pr ? `${mbdCorto(pr.mbd)} · ${pr.cuando}` : 'sin dato publicado por refinería'}</dd>
      </div>
    {:else if ahora}
      <div><dt>Procesa hoy</dt><dd class="mono">{mbdCorto(ahora.proceso)} · {Math.round((ahora.proceso / r.capacidad) * 100)} %</dd></div>
      <div>
        <dt>Combustibles para el país</dt>
        <dd class="mono">{r.extranjera && !sim.deerParkPropia ? 'no cuentan: es de Shell y Pemex' : mbdCorto(ahora.combustibles)}</dd>
      </div>
    {/if}
  </dl>
  {#if r.situacion2018}<p class="nota"><b>En 2018:</b> {r.situacion2018}</p>{/if}
{/snippet}

{#if tablero.catalogo}
  <section class="catalogo panel">
    {#if fichaPemex}
      {@const { o, r, compra, estado, ahora } = fichaPemex}
      <header>
        <button class="volver" onclick={() => (tablero.obraSel = null)}>← Obras del Estado</button>
        <button class="close" onclick={() => tablero.cerrarCatalogo()} aria-label="Cerrar">×</button>
      </header>
      <h2>{compra ? 'Comprar la parte de Shell en Deer Park' : o!.nombre}</h2>
      <p class="label pemex">Pemex · {r.nombre}</p>
      {@render bloqueRefineria(r, ahora)}

      {#if compra}
        {#if sim.modo === 'realidad'}
          {@render fichaRealidad(COMPRA)}
          <p class="nota">{COMPRA_DEER_PARK.dato}</p>
        {:else if sim.deerParkPropia}
          <p class="status en-servicio">Ya es toda de Pemex: lo que produce cuenta para el país.</p>
          <div class="acciones">
            <button class="ctl construir" onclick={() => (tablero.obraSel = 'deer-park-mejora')}>Mejorar su confiabilidad →</button>
          </div>
        {:else}
          <p class="efecto">
            Pemex tiene el 49.995 % desde 1993. Con la parte de Shell, lo que Deer Park produce (unos {Math.round(r.proceso2018 * rendimiento(r))} mil
            barriles diarios de gasolina, diésel y turbosina) cuenta para el país, y se puede mejorar.
          </p>
          <p class="real">
            <span class="label">En la realidad</span> Pemex anunció la compra en mayo de 2021 y la cerró el 20 de enero de 2022, cuando el comité de inversión
            extranjera de Estados Unidos la aprobó.
          </p>
          <dl>
            <div><dt>Costo (caja de Pemex)</dt><dd class="mono">{mdp(COMPRA_DEER_PARK.costoMdp)}</dd></div>
            <div><dt>Pemex tiene</dt><dd class="mono">{mdp(sim.dineroPemex)}</dd></div>
          </dl>
          {#if sim.dineroPemex < COMPRA_DEER_PARK.costoMdp}
            <p class="aviso">
              A Pemex le faltan {mdp(COMPRA_DEER_PARK.costoMdp - sim.dineroPemex)}; le llegan {mdp(sim.cajaPemexMes)} al mes, si no las gasta en otras obras.
            </p>
          {/if}
          <details class="fuentes">
            <summary>De dónde salen las cifras</summary>
            <p>
              {COMPRA_DEER_PARK.dato}
              {#each COMPRA_DEER_PARK.fuentes as k (k)}
                <a href={fuentePetroleo(k).url} target="_blank" rel="noopener noreferrer">{fuentePetroleo(k).fuente}</a>.
              {/each}
            </p>
          </details>
          <div class="acciones">
            <button
              class="ctl construir"
              onclick={() => (confirmandoCompra = true)}
              disabled={sim.estado !== 'lista' || sim.dineroPemex < COMPRA_DEER_PARK.costoMdp}
            >
              Comprar · {mdp(COMPRA_DEER_PARK.costoMdp)}
            </button>
          </div>
        {/if}
      {:else if o}
        {#if sim.modo === 'juego'}<p class="efecto">{efectoPemex(o, r)}</p>{/if}
        {#if r.optimaDato && sim.modo === 'juego'}<p class="nota">{r.optimaDato}</p>{/if}
        <p class="real"><span class="label">En la realidad</span> {o.real}</p>

        {#if sim.modo === 'realidad'}
          {@render fichaRealidad(o.id)}
        {:else if estado?.fase === 'por-construir' && r.extranjera && !sim.deerParkPropia}
          <p class="aviso">Primero hay que comprar la parte de Shell: mientras sea de los dos, Pemex no decide sus obras.</p>
          <div class="acciones">
            <button class="ctl construir" onclick={() => (tablero.obraSel = COMPRA)}>Comprar Deer Park →</button>
          </div>
        {:else if estado?.fase === 'por-construir' && planPemex}
          <div class="cuadrillas" role="radiogroup" aria-label="Cuadrillas">
            <span class="label">Cuadrillas</span>
            {#each Array.from({ length: MAX_CUADRILLAS }, (_, i) => i + 1) as n (n)}
              <button class="ctl" class:is-active={cuadrillas === n} role="radio" aria-checked={cuadrillas === n} onclick={() => (cuadrillas = n)}>
                {n}
              </button>
            {/each}
          </div>
          <dl>
            <div><dt>Costo (caja de Pemex)</dt><dd class="mono">{mdp(planPemex.costoMdp)}</dd></div>
            <div><dt>Duración</dt><dd class="mono">{meses(planPemex.meses)}</dd></div>
            <div><dt>Empleos en obra</dt><dd class="mono">{personas(planPemex.personasEnObra)}</dd></div>
          </dl>
          <p class="nota">
            {cuadrillas === MAX_CUADRILLAS
              ? 'Cuatro cuadrillas: el ritmo y el costo del gobierno.'
              : 'Menos cuadrillas que el gobierno: más barata y más lenta.'}
          </p>
          {#if alRitmoPemex(planPemex) > planPemex.meses * 1.02}
            <p class="aviso">
              Ese ritmo cuesta {mdp(planPemex.costoMdp / planPemex.meses)} al mes y a Pemex le llegan {mdp(sim.cajaPemexMes)}: con lo que tiene
              ({mdp(sim.dineroPemex)}), tardaría unos {Number.isFinite(alRitmoPemex(planPemex)) ? meses(alRitmoPemex(planPemex)) : 'sin fin'}, si no
              hay otras obras de Pemex.
            </p>
          {/if}
          <details class="fuentes">
            <summary>De dónde salen las cifras</summary>
            <p><b>Costo:</b> {o.costo.dato} <a href={o.costo.url} target="_blank" rel="noopener noreferrer">{o.costo.fuente}</a></p>
            <p>
              <b>Tiempo:</b>
              {o.tiempo.dato}
              {#if o.tiempo.url}<a href={o.tiempo.url} target="_blank" rel="noopener noreferrer">{o.tiempo.fuente}</a>{/if}
            </p>
          </details>
          <div class="acciones">
            <button class="ctl construir" onclick={() => (confirmando = true)} disabled={sim.estado !== 'lista'}>
              {o.tipo === 'rehabilitar' || o.tipo === 'mejora' ? 'Rehabilitar' : 'Construir'} · {mdp(planPemex.costoMdp)}
            </button>
          </div>
        {:else if estado?.fase === 'en-obra' && estado.plan}
          {@const faltanMeses = ((1 - estado.avance) * estado.plan.horas) / HORAS_POR_MES}
          <p class="status" class:detenida={estado.detenida} class:en-obra={!estado.detenida}>
            {estado.detenida
              ? 'Obra detenida: se acabó el dinero de Pemex'
              : `En obra · ${estado.plan.cuadrillas} cuadrilla${estado.plan.cuadrillas > 1 ? 's' : ''}`}
          </p>
          <div class="barra"><span style:width="{estado.avance * 100}%"></span></div>
          <dl>
            <div><dt>Avance</dt><dd class="mono">{(estado.avance * 100).toFixed(1)} %</dd></div>
            <div><dt>Termina en</dt><dd class="mono">{meses(faltanMeses)}</dd></div>
            <div><dt>Pagado</dt><dd class="mono">{mdp(estado.pagadoMdp)} de {mdp(estado.plan.costoMdp)}</dd></div>
            <div><dt>Trabajando en la obra</dt><dd class="mono">{personas(estado.detenida ? 0 : estado.plan.personasEnObra)}</dd></div>
          </dl>
        {:else if estado?.fase === 'en-servicio'}
          <p class="status en-servicio">Terminada el {horaDeJuego(estado.enServicioDesde ?? 0)}</p>
          <dl>
            <div><dt>Costó</dt><dd class="mono">{mdp(estado.pagadoMdp)}</dd></div>
          </dl>
        {/if}
      {/if}
    {:else if fichaPlanta}
      {@const { o, estado, region, despues } = fichaPlanta}
      <header>
        <button class="volver" onclick={() => (tablero.obraSel = null)}>← Obras del Estado</button>
        <button class="close" onclick={() => tablero.cerrarCatalogo()} aria-label="Cerrar">×</button>
      </header>
      <h2>{o.nombre}</h2>
      <p class="label">Central de la CFE · {o.tecnologia} · {personas(o.mw)} MW</p>
      {#if sim.modo === 'realidad'}
        <p class="efecto">
          {region.region.parteDe ? 'Sistema aislado de' : 'Región'} <b>{region.region.nombre}</b>: margen estimado de {pct(region.margen.tarde)} en
          la tarde y {pct(region.margen.noche)} en la noche al {fechaLarga(sim.horas)}. En operación, la central suma {personas(aporte(o, 'tarde'))} MW
          a la tarde y {personas(aporte(o, 'noche'))} a la noche.
        </p>
      {:else}
      <p class="efecto">
        {region.region.parteDe ? 'Sistema aislado de' : 'Región'} <b>{region.region.nombre}</b>: hoy tiene {pct(region.margen.tarde)} de margen
        en la tarde y {pct(region.margen.noche)} en la noche. La central suma {personas(aporte(o, 'tarde'))} MW a la tarde y
        {personas(aporte(o, 'noche'))} a la noche{o.clase === 'solar' && !o.aporte ? ' (de noche la solar no da)' : ''}: quedaría en
        {pct(despues.tarde)} y {pct(despues.noche)}.
      </p>
      {/if}
      {#if o.aporteDato}
        <p class="nota">{o.aporteDato}</p>
      {/if}
      {#if o.sitioPorDefinir}
        <p class="nota">Sitio por definir: la CFE aún lo busca; el juego la pone en {o.municipio}.</p>
      {/if}
      <p class="real"><span class="label">En la realidad</span> {o.real}</p>

      {#if sim.modo === 'realidad'}
        {@render fichaRealidad(o.id)}
      {:else if estado.fase === 'por-construir' && planPlanta}
        <div class="cuadrillas" role="radiogroup" aria-label="Cuadrillas">
          <span class="label">Cuadrillas</span>
          {#each Array.from({ length: MAX_CUADRILLAS }, (_, i) => i + 1) as n (n)}
            <button class="ctl" class:is-active={cuadrillas === n} role="radio" aria-checked={cuadrillas === n} onclick={() => (cuadrillas = n)}>
              {n}
            </button>
          {/each}
        </div>
        <dl>
          <div><dt>Costo (caja de la CFE)</dt><dd class="mono">{mdp(planPlanta.costoMdp)}</dd></div>
          <div><dt>Duración</dt><dd class="mono">{meses(planPlanta.meses)}</dd></div>
          <div><dt>Empleos en obra</dt><dd class="mono">{personas(planPlanta.personasEnObra)}</dd></div>
        </dl>
        <p class="nota">
          {cuadrillas === MAX_CUADRILLAS
            ? 'Cuatro cuadrillas: el ritmo y el costo del gobierno.'
            : 'Menos cuadrillas que el gobierno: más barata y más lenta.'}
        </p>
        {#if alRitmoCfe(planPlanta) > planPlanta.meses * 1.02}
          <p class="aviso">
            Ese ritmo cuesta {mdp(planPlanta.costoMdp / planPlanta.meses)} al mes y a la CFE le llegan {mdp(CAJA_CFE_MES)}: con lo que tiene
            ({mdp(sim.dineroCfe)}), tardaría unos {meses(alRitmoCfe(planPlanta))}, si no hay otras centrales.
          </p>
        {/if}
        <details class="fuentes">
          <summary>De dónde salen las cifras</summary>
          {#if o.anuncio}
            <p><b>El proyecto:</b> <a href={o.anuncio.url} target="_blank" rel="noopener noreferrer">{o.anuncio.fuente}</a></p>
          {/if}
          <p><b>Costo:</b> {o.costo.dato} <a href={o.costo.url} target="_blank" rel="noopener noreferrer">{o.costo.fuente}</a></p>
          <p>
            <b>Tiempo:</b>
            {o.tiempo.dato}
            {#if o.tiempo.url}<a href={o.tiempo.url} target="_blank" rel="noopener noreferrer">{o.tiempo.fuente}</a>{/if}
          </p>
        </details>
        <div class="acciones">
          <button class="ctl construir" onclick={() => (confirmando = true)} disabled={sim.estado !== 'lista'}>
            Construir · {mdp(planPlanta.costoMdp)}
          </button>
        </div>
      {:else if estado.fase === 'en-obra' && estado.plan}
        {@const faltanMeses = ((1 - estado.avance) * estado.plan.horas) / HORAS_POR_MES}
        <p class="status" class:detenida={estado.detenida} class:en-obra={!estado.detenida}>
          {estado.detenida
            ? 'Obra detenida: se acabó el dinero de la CFE'
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
    {:else if ficha}
      {@const { o, estado } = ficha}
      <header>
        <button class="volver" onclick={() => (tablero.obraSel = null)}>← Obras del Estado</button>
        <button class="close" onclick={() => tablero.cerrarCatalogo()} aria-label="Cerrar">×</button>
      </header>
      <h2>{o.nombre}</h2>
      <p class="label">{TIPOS_OBRA[o.tipo]} · {km(sim.medidas.get(o.id)?.km ?? 0)}</p>
      {#if sim.modo === 'juego'}<p class="efecto">{efecto(o)}</p>{/if}
      <p class="real"><span class="label">En la realidad</span> {o.real}</p>

      {#if sim.modo === 'realidad'}
        {@render fichaRealidad(o.id)}
      {:else if estado.fase === 'por-construir' && plan}
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
        {#if sim.modo === 'realidad'}
          {resumen.enObra} en obra · {resumen.enServicio} en operación · lo que pasó de verdad, al {fechaLarga(sim.horas)}
        {:else}
          {resumen.enObra} en obra · {resumen.enServicio} en servicio · costos con 4 cuadrillas, el ritmo del gobierno
        {/if}
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
                    {#if sim.modo === 'realidad'}
                      {@render etapaReal(o.id)}
                    {:else if estado?.fase === 'en-obra'}
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
        <h3 class="energia">Energía (CFE)</h3>
        <p class="texto">
          {#if sim.modo === 'realidad'}
            Centrales de la CFE desde 2019, en su etapa real. Las que operan cuentan en el margen estimado de su región.
          {:else}
            Centrales de la CFE desde 2019. Se pagan con la caja de la CFE, no con el presupuesto de trenes. Suben el margen de su región;
            sin margen, los polos de la región no se llenan.
          {/if}
        </p>
        <ul>
          {#each filasEnergia as { o, estado, plan } (o.id)}
            <li>
              <button class="obra" onclick={() => (tablero.obraSel = o.id)}>
                <span class="nombre">{o.nombre}</span>
                <span class="datos mono">
                  {#if sim.modo === 'realidad'}
                    {@render etapaReal(o.id)}
                  {:else if estado?.fase === 'en-obra'}
                    <span class="fase en-obra" class:detenida={estado.detenida}>
                      {estado.detenida ? 'detenida' : 'en obra'} {(estado.avance * 100).toFixed(0)} %
                    </span>
                  {:else if estado?.fase === 'en-servicio'}
                    <span class="fase en-servicio">en servicio</span>
                  {:else if plan}
                    {personas(o.mw)} MW {nombreTec(o)} · {mdp(plan.costoMdp)}
                  {/if}
                </span>
              </button>
            </li>
          {/each}
        </ul>
        <h3 class="pemex">Pemex · refinación</h3>
        <p class="texto">
          {#if sim.modo === 'realidad'}
            Las obras de Pemex desde 2018, en su etapa real: la rehabilitación de las seis refinerías, la Olmeca, las coquizadoras y la compra de Deer
            Park.
          {:else}
            Las seis refinerías estaban casi paradas en 2018. Rehabilitarlas, la Olmeca, las coquizadoras y Deer Park se pagan con la caja de Pemex.
            Suben los combustibles que el país hace él mismo.
          {/if}
        </p>
        <ul>
          {#each filasPemex as { o, estado, plan } (o.id)}
            {#if o.id === 'deer-park-mejora'}
              <li>
                <button class="obra" onclick={() => (tablero.obraSel = COMPRA)}>
                  <span class="nombre">Comprar la parte de Shell en Deer Park</span>
                  <span class="datos mono">
                    {#if sim.modo === 'realidad'}
                      {@render etapaReal(COMPRA)}
                    {:else if sim.deerParkPropia}
                      <span class="fase en-servicio">comprada</span>
                    {:else}
                      {mdp(COMPRA_DEER_PARK.costoMdp)}
                    {/if}
                  </span>
                </button>
              </li>
            {/if}
            <li>
              <button class="obra" onclick={() => (tablero.obraSel = o.id)}>
                <span class="nombre">{o.nombre}</span>
                <span class="datos mono">
                  {#if sim.modo === 'realidad'}
                    {@render etapaReal(o.id)}
                  {:else if estado?.fase === 'en-obra'}
                    <span class="fase en-obra" class:detenida={estado.detenida}>
                      {estado.detenida ? 'detenida' : 'en obra'} {(estado.avance * 100).toFixed(0)} %
                    </span>
                  {:else if estado?.fase === 'en-servicio'}
                    <span class="fase en-servicio">terminada</span>
                  {:else if plan}
                    {mdp(plan.costoMdp)}
                  {/if}
                </span>
              </button>
            </li>
          {/each}
        </ul>
      </div>
    {/if}
  </section>

  {#if confirmandoCompra}
    <div class="fondo-modal" role="presentation" onclick={() => (confirmandoCompra = false)}>
      <div
        class="modal panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-compra"
        tabindex="-1"
        onclick={(e) => e.stopPropagation()}
        onkeydown={(e) => e.stopPropagation()}
      >
        <p class="label">Comprar · Pemex</p>
        <h2 id="titulo-compra">La parte de Shell en Deer Park</h2>
        <p>
          <b>{mdp(COMPRA_DEER_PARK.costoMdp)}</b> de la caja de Pemex, de una vez. Desde ese día la refinería es toda de Pemex y lo que produce cuenta
          para el país.
        </p>
        <div class="acciones">
          <button class="ctl" onclick={() => (confirmandoCompra = false)}>Cancelar</button>
          <button class="ctl construir" onclick={comprarDeerPark}>Comprar</button>
        </div>
      </div>
    </div>
  {/if}

  {#if confirmando && planPemex && obraP}
    <div class="fondo-modal" role="presentation" onclick={() => (confirmando = false)}>
      <div
        class="modal panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-pemex"
        tabindex="-1"
        onclick={(e) => e.stopPropagation()}
        onkeydown={(e) => e.stopPropagation()}
      >
        <p class="label">{obraP.tipo === 'rehabilitar' || obraP.tipo === 'mejora' ? 'Rehabilitar' : 'Construir'} · Pemex</p>
        <h2 id="titulo-pemex">{obraP.nombre}</h2>
        <p>
          Con {planPemex.cuadrillas} cuadrilla{planPemex.cuadrillas > 1 ? 's' : ''}: <b>{mdp(planPemex.costoMdp)}</b> de la caja de Pemex en
          <b>{meses(planPemex.meses)}</b>, con {personas(planPemex.personasEnObra)} personas trabajando. Se paga conforme avanza.
        </p>
        {#if alRitmoPemex(planPemex) > planPemex.meses * 1.02}
          <p class="aviso">
            Con el dinero de Pemex no alcanza a ese ritmo: la obra irá al paso de lo que le llega cada mes (unos
            {Number.isFinite(alRitmoPemex(planPemex)) ? meses(alRitmoPemex(planPemex)) : 'sin fin'}).
          </p>
        {/if}
        <div class="acciones">
          <button class="ctl" onclick={() => (confirmando = false)}>Cancelar</button>
          <button class="ctl construir" onclick={construirPemex}>
            {obraP.tipo === 'rehabilitar' || obraP.tipo === 'mejora' ? 'Rehabilitar' : 'Construir'}
          </button>
        </div>
      </div>
    </div>
  {:else if confirmando && planPlanta && planta}
    <div class="fondo-modal" role="presentation" onclick={() => (confirmando = false)}>
      <div
        class="modal panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-planta"
        tabindex="-1"
        onclick={(e) => e.stopPropagation()}
        onkeydown={(e) => e.stopPropagation()}
      >
        <p class="label">Construir · Central de la CFE</p>
        <h2 id="titulo-planta">{planta.nombre}</h2>
        <p>
          Con {planPlanta.cuadrillas} cuadrilla{planPlanta.cuadrillas > 1 ? 's' : ''}: <b>{mdp(planPlanta.costoMdp)}</b> de la caja de la CFE
          en <b>{meses(planPlanta.meses)}</b>, con {personas(planPlanta.personasEnObra)} personas trabajando. Se paga conforme avanza.
        </p>
        {#if alRitmoCfe(planPlanta) > planPlanta.meses * 1.02}
          <p class="aviso">
            Con el dinero de la CFE no alcanza a ese ritmo: la obra irá al paso de lo que le llega cada mes (unos
            {Number.isFinite(alRitmoCfe(planPlanta)) ? meses(alRitmoCfe(planPlanta)) : 'sin fin'}).
          </p>
        {/if}
        <div class="acciones">
          <button class="ctl" onclick={() => (confirmando = false)}>Cancelar</button>
          <button class="ctl construir" onclick={construirPlanta}>Construir</button>
        </div>
      </div>
    </div>
  {:else if confirmando && plan && obra}
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
    top: 5.2rem;
    right: 1rem;
    z-index: 31;
    width: 320px;
    max-height: calc(100vh - 5.2rem - 13rem);
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

  h3.energia {
    color: #fde68a;
  }

  h3.pemex,
  .label.pemex {
    color: #e0a458;
  }

  dl.refineria {
    margin-top: 0.55rem;
  }

  .nota b {
    color: var(--dim);
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
