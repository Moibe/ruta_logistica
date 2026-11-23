<script lang="ts">
  import { capacidadMw, demandaLote, interior, mwEnUso, mwPromovido, sinEnergiaLote } from '$lib/domain/interior';
  import { fuenteSector, SECTORES, SECTORES_DATOS, sector } from '$lib/domain/sectores';
  import { POLOS } from '$lib/domain/sitios';
  import { sim } from '$lib/state/simulacion.svelte';
  import { personas } from './formato';

  /**
   * A polo's company lots (the Lotes tab inside a polo). The State promotes
   * each lot for one of the polo's vocations; companies come only to promoted
   * lots, in the order they were promoted, once the polo operates with a train
   * and electricity. Each sector asks for its own: electricity (and the polo
   * has its substation for all of them), water, and freight by rail, which waits at the
   * polo's station for the player's trains.
   */
  let { id, loteSel = $bindable(null) }: { id: string; loteSel?: number | null } = $props();

  const polo = $derived(POLOS.find((p) => p.id === id)!);
  const datos = $derived(interior(id)!);
  const realidad = $derived(sim.modo === 'realidad');
  /** The sectors this polo's lots can be promoted for: its vocations. */
  const suyos = $derived(SECTORES.filter((x) => datos.sectores.includes(x.id)));

  const vista = $derived.by(() => {
    sim.horas;
    sim.obras;
    const o = sim.obras.get(id);
    if (!o?.lotes) return null;
    const conectado = sim.conectado(id);
    const lotes = datos.lotes.lista.map((l, n) => {
      const e = o.lotes![n];
      const d = demandaLote(polo, n, e.sector);
      let estado: string;
      let clase = '';
      if (realidad) estado = l.empresa ? (o.fase === 'operando' ? 'Vendido · su giro no se publica' : 'Vendido') : 'Sin empresa reportada';
      else if (e.lleno >= 1) {
        estado = 'Con empresa';
        clase = 'lleno';
      } else if (e.lleno > 0) {
        estado = `Instalándose una empresa · ${Math.round(e.lleno * 100)} %`;
        clase = 'llegando';
      } else if (!e.sector) estado = 'Sin promover: no llegan empresas';
      else if (sinEnergiaLote(o, polo, n)) {
        estado = `No cabe: el polo no tiene energía para ${d?.mw.toLocaleString('es-MX', { maximumFractionDigits: 1 })} MW más`;
        clase = 'aviso';
      } else if (o.fase !== 'operando') estado = 'Promovido: las empresas llegan cuando el polo opere';
      else if (!conectado) {
        estado = 'Promovido: sin tren no llegan empresas';
        clase = 'aviso';
      } else estado = 'Promovido: esperando a su empresa';
      return { ...l, n, e, d, estado, clase };
    });
    return {
      o,
      lotes,
      cap: capacidadMw(o, id),
      bancos: o.bancos ?? 0,
      enUso: mwEnUso(o, polo),
      promovido: mwPromovido(o, polo),
      patio: sim.enPatioPolo(id),
      llevado: sim.cargaPolos[id] ?? { exportacion: 0, nacional: 0 },
      sinPromover: lotes.every((l) => !l.e.sector),
    };
  });

  const t = (n: number) => personas(n);
  const mw = (n: number) => n.toLocaleString('es-MX', { maximumFractionDigits: 1 });
  const veces = (n: number) => `${n.toLocaleString('es-MX', { maximumFractionDigits: 1 })}×`;

  function promover(n: number, valor: string) {
    sim.promoverLote(id, n, valor || null);
    loteSel = n;
  }

  // The picked lot's row comes into view.
  let filas: HTMLElement[] = $state([]);
  $effect(() => {
    if (loteSel !== null) filas[loteSel]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
</script>

{#if vista}
  {#if !realidad}
    <div class="energia">
      <div class="fila">
        <span>Energía del polo</span>
        <span class="mono">{mw(vista.enUso)} de {mw(vista.cap)} MVA</span>
      </div>
      <div class="barra-mw">
        <span class="promovido" style:width="{Math.min(100, (vista.promovido / vista.cap) * 100)}%"></span>
        <span class="uso" style:width="{Math.min(100, (vista.enUso / vista.cap) * 100)}%"></span>
      </div>
      <p class="detalle">
        Con todo lo promovido lleno pediría {mw(vista.promovido)} MW. La subestación del polo da {mw(vista.cap)} MVA ({datos.energia.fuenteCorta}{vista.bancos ? `, más ${vista.bancos} banco${vista.bancos > 1 ? 's' : ''} de la CFE` : ''}): un lote que no cabe se queda sin empresa hasta que la CFE la amplíe (pestaña Obra).
      </p>
    </div>
    {#if vista.sinPromover}
      <p class="aviso-lotes">Promueve sus lotes: las empresas solo llegan a un lote promovido para un sector, en el orden en que los promuevas.</p>
    {/if}
  {/if}

  <ol class="lotes">
    {#each vista.lotes as l (l.n)}
      {@const s = sector(l.e.sector)}
      <li bind:this={filas[l.n]} class:sel={loteSel === l.n} style:--c={s?.color ?? 'rgba(244, 114, 182, 0.6)'}>
        <button class="cabeza" onclick={() => (loteSel = loteSel === l.n ? null : l.n)}>
          <span class="muestra" class:vacia={!s} class:lleno={l.e.lleno >= 1}></span>
          <span class="nombre">{realidad && l.empresa ? l.empresa : `Lote ${l.n + 1}`}</span>
          <span class="ha mono">{l.ha.toLocaleString('es-MX')} ha</span>
        </button>
        {#if !realidad}
          <select
            value={l.e.sector ?? ''}
            onchange={(ev) => promover(l.n, ev.currentTarget.value)}
            disabled={l.e.lleno > 0 || sim.estado !== 'lista'}
            aria-label="Sector para el lote {l.n + 1}"
          >
            <option value="">Sin promover</option>
            {#each suyos as x (x.id)}
              <option value={x.id}>{x.nombre}</option>
            {/each}
          </select>
        {/if}
        <p class="estado {l.clase}">{l.estado}</p>
        {#if !realidad && s && l.d}
          <p class="pide">
            {t(l.d.personas)} empleos · {mw(l.d.mw)} MW · {t(l.d.toneladas)} t al año por tren ({Math.round(l.d.exportacion * 100)} % de exportación) · agua {veces(l.d.agua)} el promedio
          </p>
        {/if}
      </li>
    {/each}
  </ol>

  {#if !realidad && (vista.o.ocupacion > 0 || vista.llevado.exportacion + vista.llevado.nacional > 0)}
    <dl>
      <div><dt>En su estación, para exportar</dt><dd class="mono">{t(vista.patio.exportacion)} t</dd></div>
      <div><dt>En su estación, carga nacional</dt><dd class="mono">{t(vista.patio.nacional)} t</dd></div>
      <div><dt>Se la han llevado tus trenes</dt><dd class="mono">{t(vista.llevado.exportacion + vista.llevado.nacional)} t</dd></div>
    </dl>
    <p class="detalle">La carga de sus empresas espera en la estación del polo hasta un mes: lo de exportación va a una salida del país, lo nacional a la siguiente parada del tren.</p>
  {/if}

  <details class="mas">
    <summary>Qué pide cada sector</summary>
    <table>
      <thead>
        <tr><th>Sector</th><th title="Gasto en electricidad por trabajador contra el promedio de la manufactura">Luz</th><th title="Gasto en agua por trabajador contra el promedio">Agua</th><th title="Toneladas por tren al año por trabajador">t/trab.</th><th title="Parte de su carga por tren que sale del país">Exporta</th></tr>
      </thead>
      <tbody>
        {#each suyos as x (x.id)}
          <tr>
            <td><span class="punto" style:background={x.color}></span>{x.corto}</td>
            <td class="mono">{veces(x.energia)}</td>
            <td class="mono">{veces(x.agua)}</td>
            <td class="mono">{x.toneladas.toLocaleString('es-MX', { maximumFractionDigits: 1 })}{x.enContenedores ? '*' : ''}</td>
            <td class="mono">{Math.round(x.exportacion * 100)} %</td>
          </tr>
        {/each}
      </tbody>
    </table>
    <p>{SECTORES_DATOS.dato} * En contenedores.</p>
    {#each SECTORES_DATOS.fuentesDato.map((k) => fuenteSector(k)).filter((f) => f?.url) as f (f.url)}
      <p><a href={f.url} target="_blank" rel="noopener noreferrer">{f.fuente}</a></p>
    {/each}
  </details>
  {#if realidad}
    <p class="detalle">{datos.lotes.dato}</p>
  {/if}
{/if}

<style>
  .energia {
    margin-bottom: 0.7rem;
  }

  .fila {
    display: flex;
    justify-content: space-between;
    font-size: 0.74rem;
  }

  .fila .mono {
    color: #fde68a;
  }

  .barra-mw {
    position: relative;
    height: 6px;
    margin: 0.3rem 0 0.25rem;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.08);
    overflow: hidden;
  }

  .barra-mw span {
    position: absolute;
    inset: 0 auto 0 0;
    border-radius: 4px;
  }

  .barra-mw .promovido {
    background: rgba(253, 230, 138, 0.28);
  }

  .barra-mw .uso {
    background: #fde68a;
  }

  .detalle {
    margin: 0;
    font-size: 0.66rem;
    line-height: 1.4;
    color: var(--muted);
  }

  .aviso-lotes {
    margin: 0 0 0.6rem;
    padding: 0.35rem 0.55rem;
    border-radius: 8px;
    border: 1px dashed rgba(244, 114, 182, 0.5);
    font-size: 0.68rem;
    line-height: 1.4;
    color: #f9c6dd;
  }

  .lotes {
    list-style: none;
    margin: 0 0 0.6rem;
    padding: 0;
    display: grid;
    gap: 0.45rem;
  }

  .lotes li {
    padding: 0.45rem 0.5rem;
    border-radius: 10px;
    border: 1px solid var(--line);
    border-left: 3px solid var(--c);
    background: rgba(255, 255, 255, 0.02);
  }

  .lotes li.sel {
    background: rgba(244, 114, 182, 0.08);
    border-color: rgba(244, 114, 182, 0.45);
    border-left-color: var(--c);
  }

  .cabeza {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    width: 100%;
    padding: 0;
    border: none;
    background: none;
    cursor: pointer;
    text-align: left;
  }

  .muestra {
    width: 10px;
    height: 10px;
    border-radius: 3px;
    background: color-mix(in srgb, var(--c) 45%, transparent);
    border: 1px solid var(--c);
  }

  .muestra.vacia {
    background: none;
    border-style: dashed;
  }

  .muestra.lleno {
    background: var(--c);
  }

  .nombre {
    font-size: 0.78rem;
  }

  .ha {
    margin-left: auto;
    font-size: 0.7rem;
    color: var(--muted);
  }

  select {
    width: 100%;
    margin: 0.35rem 0 0.2rem;
    padding: 0.25rem 0.4rem;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: rgba(8, 20, 36, 0.9);
    color: var(--ink);
    font: inherit;
    font-size: 0.72rem;
  }

  select:disabled {
    opacity: 0.6;
  }

  .estado {
    margin: 0.15rem 0 0;
    font-size: 0.66rem;
    color: var(--muted);
  }

  .estado.lleno {
    color: #b7f5cf;
  }

  .estado.llegando {
    color: #ffd6ea;
  }

  .estado.aviso {
    color: #ffc2c2;
  }

  .pide {
    margin: 0.15rem 0 0;
    font-size: 0.64rem;
    line-height: 1.35;
    color: var(--dim);
  }

  dl {
    margin: 0 0 0.3rem;
    display: grid;
    gap: 0.28rem;
    padding-top: 0.55rem;
    border-top: 1px solid var(--line);
  }

  dl > div {
    display: flex;
    justify-content: space-between;
    gap: 0.6rem;
    font-size: 0.72rem;
  }

  dt {
    color: var(--muted);
  }

  dd {
    margin: 0;
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

  .mas a {
    color: var(--accent);
  }

  table {
    width: 100%;
    margin-top: 0.4rem;
    border-collapse: collapse;
    font-size: 0.66rem;
  }

  th,
  td {
    padding: 0.15rem 0.2rem;
    text-align: right;
    border-bottom: 1px solid var(--line);
  }

  th:first-child,
  td:first-child {
    text-align: left;
  }

  th {
    font-weight: 500;
    color: var(--dim);
  }

  .punto {
    display: inline-block;
    width: 7px;
    height: 7px;
    margin-right: 0.3rem;
    border-radius: 2px;
  }
</style>
