<script lang="ts">
  import { alongLinea, paralela, recorrido, type GeoInterior, type Lote, type Pt } from '$lib/domain/interiorGeo';
  import { ESPUELA, interior, MVA_BANCO, sinEnergiaLote, SUBESTACION } from '$lib/domain/interior';
  import { POLOS } from '$lib/domain/sitios';
  import { sim } from '$lib/state/simulacion.svelte';
  import { POLO } from './simbolos';
  import { sector as sectorDe } from '$lib/domain/sectores';

  /**
   * A polo's close-up: its land as the DOF declares it (in pieces, when the
   * declaratoria gives several or rights of way cross it), what's around it
   * (OpenStreetMap) and its work by fronts, drawn as it advances — each
   * piece's main road growing down its axis, one piece after another, the
   * water and power lines along them, the
   * substation, the services centre, the rail spur from the main line — with
   * the crews where each front is being worked. When it operates, its lots
   * fill with companies.
   *
   * SVG in metres (x east, y north; y is flipped where points are written).
   * Drag to pan, wheel to zoom. It reads `sim.horas` to follow the clock.
   */
  let { geo, loteSel = $bindable(null) }: { geo: GeoInterior; loteSel?: number | null } = $props();

  const RIEL = '#ffd166';
  const LUZ = '#fde68a';
  const AGUA = '#60a5fa';
  const CAMINO = 'rgba(138, 164, 194, 0.42)';

  const datos = $derived(interior(geo.id));

  // ---- camera ------------------------------------------------------------------------------

  let ancho = $state(1200);
  let alto = $state(800);
  /** Centre of the view (metres) and metres per pixel. */
  let vista = $state({ cx: 0, cy: 0, mpp: 2 });
  let encuadrado = false;

  /** Room the panels leave: the left column, the fronts panel on the right, the bar on top. */
  const LIBRE = { izq: 290, der: 340, arriba: 96, abajo: 70 };

  function encuadrar() {
    // The land, and its spur when it's short: San Jerónimo's runs 15 km, to Ciudad Juárez.
    const pts: Pt[] = [...geo.piezas.flatMap((q) => q.puntos), ...(geo.espuela.km <= 2.5 ? geo.espuela.puntos : [])];
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const w = Math.max(200, ancho - LIBRE.izq - LIBRE.der);
    const h = Math.max(200, alto - LIBRE.arriba - LIBRE.abajo);
    const mpp = Math.max((x1 - x0) / w, (y1 - y0) / h) * 1.08;
    // Put the polo in the middle of the free area, not of the window.
    const sx = (LIBRE.izq + ancho - LIBRE.der) / 2 - ancho / 2;
    const sy = (LIBRE.arriba + alto - LIBRE.abajo) / 2 - alto / 2;
    vista = { cx: (x0 + x1) / 2 - sx * mpp, cy: (y0 + y1) / 2 + sy * mpp, mpp };
  }

  $effect(() => {
    if (!encuadrado && ancho > 0 && alto > 0) {
      encuadrado = true;
      encuadrar();
    }
  });

  const MPP_MIN = 0.15;
  const mppMax = $derived(Math.max((geo.caja.x1 - geo.caja.x0) / ancho, (geo.caja.y1 - geo.caja.y0) / alto));
  const viewBox = $derived(`${vista.cx - (ancho * vista.mpp) / 2} ${-vista.cy - (alto * vista.mpp) / 2} ${ancho * vista.mpp} ${alto * vista.mpp}`);

  /** Screen pixel to metres. */
  const aMetros = (sx: number, sy: number): Pt => [vista.cx + (sx - ancho / 2) * vista.mpp, vista.cy - (sy - alto / 2) * vista.mpp];

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    const [mx, my] = aMetros(e.offsetX, e.offsetY);
    const mpp = Math.max(MPP_MIN, Math.min(mppMax, vista.mpp * Math.exp(e.deltaY * 0.0015)));
    // Keep the point under the cursor where it is.
    vista = { cx: mx - (e.offsetX - ancho / 2) * mpp, cy: my + (e.offsetY - alto / 2) * mpp, mpp };
  }

  let arrastre = $state<{ x: number; y: number; cx: number; cy: number } | null>(null);
  /** The pointer went down and moved: a drag, not a click on a lot. */
  let arrastrado = false;
  function onDown(e: PointerEvent) {
    arrastre = { x: e.clientX, y: e.clientY, cx: vista.cx, cy: vista.cy };
    arrastrado = false;
  }
  function onMove(e: PointerEvent) {
    puntero = { x: e.clientX, y: e.clientY };
    if (!arrastre) return;
    if (!arrastrado && Math.hypot(e.clientX - arrastre.x, e.clientY - arrastre.y) > 4) {
      // Captured only once it's a drag, so a plain click still reaches the lot under it.
      arrastrado = true;
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    }
    if (!arrastrado) return;
    vista = { ...vista, cx: arrastre.cx - (e.clientX - arrastre.x) * vista.mpp, cy: arrastre.cy + (e.clientY - arrastre.y) * vista.mpp };
  }
  function onUp() {
    arrastre = null;
  }
  function elegirLote(n: number) {
    if (arrastrado || n <= 0) return;
    loteSel = loteSel === n - 1 ? null : n - 1;
  }

  // ---- what to draw --------------------------------------------------------------------------

  const P = (p: Pt) => `${p[0]},${-p[1]}`;
  const linea = (pts: Pt[]) => 'M' + pts.map(P).join('L');
  const anillo = (pts: Pt[]) => linea(pts) + 'Z';

  const caminosMenores = $derived(geo.caminos.filter((c) => !['trunk', 'primary', 'trunk_link', 'primary_link', 'secondary'].includes(c.tipo)));
  const caminosMayores = $derived(geo.caminos.filter((c) => ['trunk', 'primary', 'trunk_link', 'primary_link', 'secondary'].includes(c.tipo)));
  const pathMenores = $derived(caminosMenores.map((c) => linea(c.puntos)).join(''));

  /** One label per named line, at its point nearest the polo. */
  /**
   * Where a lot's label goes: the mean of its corners, or, when that falls outside the lot (one
   * that wraps around a notch, as in Hermosillo), the middle of its longest stretch along that
   * horizontal.
   */
  function rotuloLote(pts: Pt[]): Pt {
    const c: Pt = [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
    const cortes: number[] = [];
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i];
      const [xj, yj] = pts[j];
      if (yi > c[1] !== yj > c[1]) cortes.push(xi + ((c[1] - yi) * (xj - xi)) / (yj - yi));
    }
    cortes.sort((a, b) => a - b);
    let mejor: [number, number] | null = null;
    for (let k = 0; k + 1 < cortes.length; k += 2) {
      if (cortes[k] <= c[0] && c[0] <= cortes[k + 1]) return c;
      if (!mejor || cortes[k + 1] - cortes[k] > mejor[1] - mejor[0]) mejor = [cortes[k], cortes[k + 1]];
    }
    return mejor ? [(mejor[0] + mejor[1]) / 2, c[1]] : c;
  }

  function etiquetaDe(pts: Pt[]): Pt {
    let mejor = pts[0];
    for (const p of pts) if (Math.hypot(...p) < Math.hypot(...mejor)) mejor = p;
    return mejor;
  }
  const etiquetasVia = $derived.by(() => {
    const porNombre = new Map<string, Pt[]>();
    for (const v of geo.vias) if (v.estado === 'rail' && v.nombre) porNombre.set(`${v.nombre}${v.operador ? ` · ${v.operador}` : ''}`, [...(porNombre.get(`${v.nombre}${v.operador ? ` · ${v.operador}` : ''}`) ?? []), ...v.puntos]);
    return [...porNombre].map(([texto, pts]) => ({ texto, p: etiquetaDe(pts) }));
  });
  const etiquetaCarretera = $derived.by(() => {
    const c = geo.carretera ? geo.caminos.filter((x) => (x.ref ?? x.nombre) === geo.carretera) : [];
    // Clear of the polo, which it runs along: about 900 m from its centre.
    const pts = c.flatMap((x) => x.puntos);
    const p = pts.reduce((m, q) => (Math.abs(Math.hypot(...q) - 900) < Math.abs(Math.hypot(...m) - 900) ? q : m), pts[0]);
    return c.length ? { texto: c[0].ref ?? c[0].nombre!, p } : null;
  });

  /** Each piece's road axis, from its entrance; the services' piece first. */
  const ejes = $derived(geo.ejes as [Pt, Pt][]);
  const ejesAgua = $derived(ejes.map((e) => paralela(e, 9)));
  const ejesLuz = $derived(ejes.map((e) => paralela(e, -9)));
  /** The services' piece's road. */
  const eje = $derived(ejes[0]);
  const anguloEje = $derived((Math.atan2(-(eje[1][1] - eje[0][1]), eje[1][0] - eje[0][0]) * 180) / Math.PI);
  /** The spur, from the main track to the polo. */
  const espuela = $derived([geo.espuela.puntos[1], geo.espuela.puntos[0]] as [Pt, Pt]);
  /** The power connection, from the high-voltage line to the substation. */
  const conexion = $derived([geo.conexionElectrica.puntos[1], geo.conexionElectrica.puntos[0]] as [Pt, Pt]);

  const estado = $derived.by(() => {
    sim.horas;
    sim.obras;
    const o = sim.obras.get(geo.id);
    const av = (id: string) => o?.frentes?.[id]?.avance ?? 0;
    const cu = (id: string) => (o?.frentes?.[id]?.avance ?? 0) < 1 ? (o?.frentes?.[id]?.cuadrillas ?? 0) : 0;
    return {
      fase: o?.fase ?? 'por-construir',
      ocupacion: o?.ocupacion ?? 0,
      av: { vialidades: av('vialidades'), agua: av('agua'), energia: av('energia'), servicios: av('servicios'), espuela: av(ESPUELA) },
      cu: { vialidades: cu('vialidades'), agua: cu('agua'), energia: cu('energia'), servicios: cu('servicios'), espuela: cu(ESPUELA), subestacion: cu(SUBESTACION) },
      bancos: o?.bancos ?? 0,
    };
  });
  const urbanizado = $derived(estado.fase === 'operando');
  const realidad = $derived(sim.modo === 'realidad');

  /** Power: the first half of the front is the connection to the line, the second the network inside. */
  const luzConexion = $derived(Math.min(1, estado.av.energia * 2));
  const luzAdentro = $derived(Math.max(0, estado.av.energia * 2 - 1));
  /** Roads, water and the power network inside, built piece after piece. */
  const obraVial = $derived(recorrido(ejes, estado.av.vialidades));
  const obraAgua = $derived(recorrido(ejesAgua, estado.av.agua));
  const obraLuz = $derived(recorrido(ejesLuz, luzAdentro));

  /** Each company lot now: how far its company has moved in, and the sector it's promoted for. In Realidad, all sold. */
  const ocupado = $derived.by(() => {
    sim.horas;
    const o = sim.obras.get(geo.id);
    const polo = POLOS.find((p) => p.id === geo.id);
    const lotes = o?.lotes ?? [];
    const m = new Map<Lote, { lleno: number; sector: string | null; sinEnergia: boolean }>();
    for (const [i, l] of geo.lotes.filter((x) => x.tipo === 'empresa').entries()) {
      const e = lotes[i];
      m.set(
        l,
        realidad
          ? { lleno: urbanizado ? 1 : 0, sector: null, sinEnergia: false }
          : { lleno: e?.lleno ?? 0, sector: e?.sector ?? null, sinEnergia: !!(o && polo && sinEnergiaLote(o, polo, i)) }
      );
    }
    return m;
  });

  /** Where each front's crews are working now. */
  const cuadrillas = $derived.by(() => {
    const c = estado.cu;
    const av = estado.av;
    const lugar: [number, Pt][] = [
      [c.vialidades, obraVial.punta],
      [c.agua, obraAgua.punta],
      [c.energia, av.energia < 0.5 ? alongLinea(conexion, luzConexion) : obraLuz.punta],
      [c.servicios, geo.servicios.centro],
      [c.espuela, alongLinea(espuela, av.espuela)],
      [c.subestacion, geo.servicios.subestacion],
    ];
    return lugar.flatMap(([n, p], f) => Array.from({ length: n }, (_, i) => ({ f, i, p })));
  });

  /** Lamp posts every 45 m on both sides of each road, once they're lit. */
  const faroles = $derived(
    ejes.flatMap((e) => {
      const n = Math.max(1, Math.floor(Math.hypot(e[1][0] - e[0][0], e[1][1] - e[0][1]) / 45));
      return [paralela(e, 14), paralela(e, -14)].flatMap((l) => Array.from({ length: n + 1 }, (_, i) => alongLinea(l, i / n)));
    })
  );

  // ---- hover --------------------------------------------------------------------------------

  let puntero = $state({ x: 0, y: 0 });
  let tip = $state<{ titulo: string; lineas: string[] } | null>(null);
  const ver = (titulo: string, ...lineas: string[]) => () => (tip = { titulo, lineas: lineas.filter(Boolean) });
  const salir = () => (tip = null);

  /** The services front's own name («Centro de negocios, comedor y CECI» in Huamantla). */
  const nombreServicios = $derived(datos?.frentes.find((f) => f.id === 'servicios')?.nombre ?? 'Servicios');
  const nombreLote = (l: Lote, i: number) =>
    l.tipo === 'servicios' ? nombreServicios : l.tipo === 'reserva' ? 'Área común y reserva' : realidad ? (l.empresa ?? `Lote ${i}`) : `Lote ${i}`;
  const numeroLote = $derived(new Map(geo.lotes.filter((l) => l.tipo === 'empresa').map((l, i) => [l, i + 1])));

  // ---- the scale bar ------------------------------------------------------------------------
  const escala = $derived.by(() => {
    const objetivo = 120 * vista.mpp;
    const paso = [50, 100, 200, 250, 500, 1000, 2000].find((m) => m >= objetivo * 0.6) ?? 2000;
    return { m: paso, px: paso / vista.mpp };
  });

  const fs = $derived(vista.mpp);
</script>

<div class="host" bind:clientWidth={ancho} bind:clientHeight={alto}>
  <svg
    class="entrar"
    class:arrastrando={arrastre !== null}
    {viewBox}
    role="application"
    aria-label="Vista del polo por dentro"
    onwheel={onWheel}
    onpointerdown={onDown}
    onpointermove={onMove}
    onpointerup={onUp}
    onpointercancel={onUp}
    onpointerleave={() => (tip = null)}
  >
    <!-- Land use around: the industrial city next door and the towns. -->
    {#each geo.suelo as s, i (i)}
      <path
        d={anillo(s.puntos)}
        class="suelo {s.uso}"
        role="presentation"
        onpointerenter={ver(s.nombre ?? (s.uso === 'industrial' ? 'Zona industrial' : 'Zona habitacional'), s.uso === 'industrial' ? 'Uso industrial · OpenStreetMap' : 'Uso habitacional · OpenStreetMap')}
        onpointerleave={salir}
      />
    {/each}
    {#each geo.agua as a, i (i)}
      <path d={linea(a.puntos)} class="agua-cauce" />
    {/each}

    <!-- The international border, for a polo by it (San Jerónimo). -->
    {#if geo.frontera}
      {@const f = geo.frontera}
      {#each f.lineas as l, i (i)}
        <path d={linea(l)} class="frontera" role="presentation" onpointerenter={ver(`Frontera con ${f.con}`, 'OpenStreetMap')} onpointerleave={salir} />
      {/each}
    {/if}

    <!-- Streets and roads. -->
    <path d={pathMenores} class="camino" stroke={CAMINO} />
    {#each caminosMayores as c, i (i)}
      <path
        d={linea(c.puntos)}
        class="camino mayor"
        class:troncal={c.tipo === 'trunk' || c.tipo === 'primary'}
        role="presentation"
        onpointerenter={ver(c.ref ? `Carretera ${c.ref}` : (c.nombre ?? 'Carretera'), c.nombre && c.ref ? c.nombre : '', 'OpenStreetMap')}
        onpointerleave={salir}
      />
    {/each}

    <!-- Power lines and the CFE's substations. -->
    {#each geo.lineas as l, i (i)}
      <path
        d={linea(l.puntos)}
        class="linea-electrica"
        role="presentation"
        onpointerenter={ver('Línea de transmisión', l.kv ? `${Number(l.kv) / 1000} kV` : '', 'OpenStreetMap')}
        onpointerleave={salir}
      />
    {/each}
    {#each geo.subestaciones as s, i (i)}
      <rect
        x={s.x - 6 * fs}
        y={-s.y - 6 * fs}
        width={12 * fs}
        height={12 * fs}
        class="subestacion-cfe"
        role="presentation"
        onpointerenter={ver(`Subestación ${s.nombre}`, s.operador, s.kv ? `${s.kv.split(';').map((v) => `${Number(v) / 1000}`).join(' / ')} kV` : '', 'OpenStreetMap')}
        onpointerleave={salir}
      />
      <text x={s.x + 9 * fs} y={-s.y + 4 * fs} font-size={10 * fs} class="rotulo luz">{s.nombre}</text>
    {/each}

    <!-- Track. -->
    {#each geo.vias as v, i (i)}
      <path
        d={linea(v.puntos)}
        class="via"
        class:abandonada={v.estado !== 'rail'}
        class:ladero={v.servicio === 'siding'}
        role="presentation"
        onpointerenter={ver(
          v.estado === 'rail' ? (v.nombre ?? 'Vía férrea') : `${v.estado === 'construction' ? 'Vía en obra' : 'Vía abandonada'}${v.nombre ? ` · ${v.nombre}` : ''}`,
          v.operador ? `Opera ${v.operador}` : '',
          v.servicio === 'siding' ? 'Ladero' : '',
          'OpenStreetMap'
        )}
        onpointerleave={salir}
      />
    {/each}

    <!-- The polo. -->
    {#each geo.piezas as q, i (i)}
      <path
        d={anillo(q.puntos)}
        class="terreno"
        class:urbanizado
        style:--polo={POLO}
        role="presentation"
        onpointerenter={q.nombre ? ver(q.nombre, `${q.ha.toLocaleString('es-MX')} ha`, 'Predio del polo según su declaratoria (DOF)') : undefined}
        onpointerleave={q.nombre ? salir : undefined}
      />
    {/each}
    {#each geo.lotes as l, i (i)}
      {@const n = numeroLote.get(l) ?? 0}
      {@const o = ocupado.get(l)}
      {@const lleno = o?.lleno ?? 0}
      {@const sec = sectorDe(o?.sector)}
      <path
        d={anillo(l.puntos)}
        class="lote {l.tipo}"
        class:urbanizado
        class:promovido={!!sec}
        class:sin-energia={o?.sinEnergia}
        class:sel={n > 0 && loteSel === n - 1}
        style:--lleno={lleno}
        style:--c={sec?.color ?? '#f472b6'}
        role="presentation"
        onclick={() => elegirLote(n)}
        onpointerenter={ver(
          nombreLote(l, n),
          `${l.ha.toLocaleString('es-MX')} ha${sec ? ` · ${sec.nombre}` : ''}`,
          l.tipo === 'empresa'
            ? realidad
              ? l.empresa
                ? 'Vendido (Presidencia, inauguración del 12 de abril de 2026). Dónde queda en el polo es del juego.'
                : 'Sin empresa reportada. El lote y su lugar son del juego.'
              : `${lleno >= 1 ? 'Con empresa' : lleno > 0 ? 'Instalándose una empresa' : o?.sinEnergia ? 'Promovido, pero no cabe: al polo no le alcanza la energía' : sec ? 'Promovido' : 'Sin promover'}. Clic para verlo. ${l.empresa ? `En la realidad lo compró ${l.empresa} (Presidencia); dónde queda es del juego.` : 'Su tamaño y su lugar son del juego.'}`
            : l.tipo === 'servicios'
              ? 'Su tamaño y lugar son del juego'
              : 'Lo que queda del terreno'
        )}
        onpointerleave={salir}
      />
      {#if l.tipo === 'empresa' && l.puntos.length}
        {@const c = rotuloLote(l.puntos)}
        <!-- Only where it fits: a lot about 50 px across or more on screen. -->
        {#if Math.sqrt(l.ha * 1e4) / vista.mpp > 50}
          <text x={c[0]} y={-c[1]} font-size={10 * fs} class="rotulo lote-rotulo" text-anchor="middle">
            {realidad && l.empresa ? l.empresa : `Lote ${n}`} · {sec ? sec.corto : `${l.ha.toLocaleString('es-MX')} ha`}
          </text>
        {/if}
      {/if}
    {/each}

    <!-- Rights of way: left out of the land (a highway, a track) or crossing it (a pipeline). -->
    {#each geo.franjas as f, i (i)}
      <path
        d={anillo(f.puntos)}
        class="franja {f.tipo}"
        role="presentation"
        onpointerenter={ver(f.nombre, `${f.ha.toLocaleString('es-MX')} ha`, `${f.nota}.`)}
        onpointerleave={salir}
      />
    {/each}

    <!-- Front: roads and lighting. Each piece's axis is its main road, planned until built. -->
    {#each geo.vialidades as v, i (i)}
      <path d={anillo(v)} class="vialidad-plan" />
    {/each}
    {#each obraVial.hechos as h, i (i)}
      <path d={linea(h)} class="vialidad" />
    {/each}
    {#if estado.av.vialidades >= 1}
      {#each faroles as f, i (i)}
        <circle cx={f[0]} cy={-f[1]} r={1.6 * fs} class="farol" />
      {/each}
    {/if}

    <!-- Front: water and drainage. -->
    {#each obraAgua.hechos as h, i (i)}
      <path d={linea(h)} class="tubo" stroke={AGUA} />
    {/each}
    <circle
      cx={geo.servicios.tanque[0]}
      cy={-geo.servicios.tanque[1]}
      r={9}
      class="tanque"
      class:hecho={estado.av.agua >= 1}
      style:--c={AGUA}
      role="presentation"
      onpointerenter={ver('Tanque de agua', estado.av.agua >= 1 ? 'Agua potable y drenaje: terminado' : `Agua potable y drenaje: ${Math.round(estado.av.agua * 100)} %`)}
      onpointerleave={salir}
    />

    <!-- Front: power. The connection to the CFE's line, then the network inside. -->
    <path d={linea(conexion)} class="plan-linea" stroke={LUZ} />
    {#if luzConexion > 0}
      <path d={linea([conexion[0], alongLinea(conexion, luzConexion)])} class="cable" stroke={LUZ} />
    {/if}
    {#each obraLuz.hechos as h, i (i)}
      <path d={linea(h)} class="cable" stroke={LUZ} />
    {/each}
    <rect
      x={geo.servicios.subestacion[0] - 8}
      y={-geo.servicios.subestacion[1] - 8}
      width="16"
      height="16"
      class="subestacion"
      class:hecho={estado.av.energia >= 1}
      style:--c={LUZ}
      role="presentation"
      onpointerenter={ver(
        'Subestación del polo',
        `${(datos?.energia.mva ?? 0).toLocaleString('es-MX')} MVA disponibles (${datos?.energia.fuenteCorta ?? ''})`,
        `Energía: ${estado.av.energia >= 1 ? 'terminada' : `${Math.round(estado.av.energia * 100)} %`}`,
        `Se conecta a la línea de ${Number(geo.conexionElectrica.kv) / 1000 || 115} kV a ${geo.conexionElectrica.km.toLocaleString('es-MX')} km`
      )}
      onpointerleave={salir}
    />

    <!-- The CFE's banks added to the substation, one square each beside it. -->
    {#each Array.from({ length: estado.bancos }, (_, i) => i) as b (b)}
      <rect
        x={geo.servicios.subestacion[0] + 12 + b * 12}
        y={-geo.servicios.subestacion[1] - 5}
        width="10"
        height="10"
        class="banco"
        role="presentation"
        onpointerenter={ver(`Banco ${b + 1} de la CFE`, `${MVA_BANCO} MVA más para las empresas del polo`)}
        onpointerleave={salir}
      />
    {/each}

    <!-- Front: the services centre. -->
    <rect
      x={geo.servicios.centro[0] - 32}
      y={-geo.servicios.centro[1] - 16}
      width="64"
      height="32"
      transform="rotate({anguloEje} {geo.servicios.centro[0]} {-geo.servicios.centro[1]})"
      class="edificio"
      style:--av={estado.av.servicios}
      role="presentation"
      onpointerenter={ver(nombreServicios, `${Math.round(estado.av.servicios * 100)} % construido`)}
      onpointerleave={salir}
    />

    <!-- Front: the rail spur, from the main line. -->
    <path d={linea(espuela)} class="plan-linea" stroke={RIEL} />
    {#if estado.av.espuela > 0}
      <path d={linea([espuela[0], alongLinea(espuela, estado.av.espuela)])} class="espuela-fondo" />
      <path d={linea([espuela[0], alongLinea(espuela, estado.av.espuela)])} class="espuela" stroke={RIEL} />
    {/if}
    <path
      d={linea(espuela)}
      class="tocar"
      role="presentation"
      onpointerenter={ver(
        `Espuela a la ${geo.espuela.via}`,
        `${geo.espuela.km.toLocaleString('es-MX')} km · ${geo.espuela.operador}`,
        estado.av.espuela >= 1 ? 'Construida: el polo tiene estación' : `${Math.round(estado.av.espuela * 100)} % construida`
      )}
      onpointerleave={salir}
    />

    <!-- The crews at work. -->
    {#each cuadrillas as c (`${c.f}-${c.i}`)}
      <circle
        cx={c.p[0] + Math.cos(c.i * 2.1 + c.f) * 9 * fs}
        cy={-c.p[1] + Math.sin(c.i * 2.1 + c.f) * 9 * fs}
        r={4.2 * fs}
        class="cuadrilla"
        class:quieta={!sim.corriendo}
        style:animation-delay="{c.i * 0.17 + c.f * 0.05}s"
      />
    {/each}

    <!-- Names. -->
    {#each etiquetasVia as e (e.texto)}
      <text x={e.p[0] + 10 * fs} y={-e.p[1] - 8 * fs} font-size={11 * fs} class="rotulo riel">{e.texto}</text>
    {/each}
    {#if etiquetaCarretera}
      <text x={etiquetaCarretera.p[0] + 10 * fs} y={-etiquetaCarretera.p[1]} font-size={11 * fs} class="rotulo carretera">{etiquetaCarretera.texto}</text>
    {/if}
    {#each geo.lugares as l, i (i)}
      <text x={l.x} y={-l.y} font-size={(l.tipo === 'town' ? 13 : 10) * fs} class="rotulo lugar" class:pueblo={l.tipo === 'town'} text-anchor="middle">{l.nombre}</text>
    {/each}
    {#if geo.frontera}
      <text x={geo.frontera.rotulo.x} y={-geo.frontera.rotulo.y} font-size={12 * fs} class="rotulo pais" text-anchor="middle">{geo.frontera.rotulo.texto}</text>
    {/if}
    {#each geo.edificios as b, i (i)}
      <circle cx={b.x} cy={-b.y} r={3 * fs} class="edificio-osm" />
      <text x={b.x + 6 * fs} y={-b.y + 3.5 * fs} font-size={9.5 * fs} class="rotulo lugar">{b.nombre}</text>
    {/each}
  </svg>

  <div class="escala">
    <span class="barra-escala" style:width="{escala.px}px"></span>
    <span class="mono">{escala.m >= 1000 ? `${escala.m / 1000} km` : `${escala.m} m`}</span>
  </div>
  <div class="norte" aria-hidden="true">N<span>↑</span></div>
  <p class="atribucion">Terreno: DOF · Alrededores: © colaboradores de OpenStreetMap</p>
</div>

{#if tip}
  <div class="tip panel" style:left="{puntero.x}px" style:top="{puntero.y}px" class:flip={puntero.x > ancho - 300}>
    <strong>{tip.titulo}</strong>
    {#each tip.lineas as l (l)}<span>{l}</span>{/each}
  </div>
{/if}

<style>
  .host {
    position: fixed;
    inset: 0;
    background: radial-gradient(1200px 800px at 50% 45%, #0b1b2c 0%, #07111d 60%, #04080f 100%);
  }

  svg {
    width: 100%;
    height: 100%;
    display: block;
    cursor: grab;
    touch-action: none;
  }

  svg.arrastrando {
    cursor: grabbing;
  }

  /* Coming in from the board: the close-up opens out of the dive. */
  .entrar {
    animation: acercar 700ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  @keyframes acercar {
    from {
      transform: scale(0.3);
      opacity: 0;
    }
  }

  path,
  rect,
  circle {
    vector-effect: non-scaling-stroke;
  }

  .suelo {
    stroke: none;
  }

  .suelo.industrial {
    fill: rgba(165, 180, 252, 0.08);
  }

  .suelo.residential,
  .suelo.commercial {
    fill: rgba(138, 164, 194, 0.07);
  }

  .agua-cauce {
    fill: none;
    stroke: rgba(96, 165, 250, 0.35);
    stroke-width: 1;
  }

  .frontera {
    fill: none;
    stroke: rgba(248, 113, 113, 0.7);
    stroke-width: 1.6;
    stroke-dasharray: 10 4 2 4;
  }

  .camino {
    fill: none;
    stroke-width: 1;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .camino.mayor {
    stroke: rgba(170, 192, 216, 0.55);
    stroke-width: 2;
  }

  .camino.troncal {
    stroke: rgba(214, 228, 243, 0.7);
    stroke-width: 3.2;
  }

  .linea-electrica {
    fill: none;
    stroke: rgba(253, 230, 138, 0.45);
    stroke-width: 1;
    stroke-dasharray: 6 4;
  }

  .subestacion-cfe {
    fill: rgba(253, 230, 138, 0.2);
    stroke: #fde68a;
    stroke-width: 1.2;
  }

  .via {
    fill: none;
    stroke: #ffd166;
    stroke-width: 2.4;
    stroke-linecap: round;
  }

  .via.ladero {
    stroke-width: 1.4;
  }

  .via.abandonada {
    stroke: rgba(255, 209, 102, 0.35);
    stroke-width: 1.2;
    stroke-dasharray: 4 4;
  }

  .terreno {
    fill: rgba(244, 114, 182, 0.05);
    stroke: var(--polo);
    stroke-width: 2;
    stroke-dasharray: 7 5;
  }

  .terreno.urbanizado {
    stroke-dasharray: none;
  }

  .lote {
    fill: rgba(244, 114, 182, calc(0.04 + 0.32 * var(--lleno, 0)));
    stroke: rgba(244, 114, 182, 0.45);
    stroke-width: 1;
    stroke-dasharray: 3 3;
    cursor: pointer;
  }

  /* Promoted for a sector: its colour, filling in as its company moves in. */
  .lote.empresa.promovido {
    fill: color-mix(in srgb, var(--c) calc(10% + 50% * var(--lleno, 0)), transparent);
    stroke: var(--c);
  }

  .lote.empresa.sin-energia {
    stroke: #f87171;
    stroke-dasharray: 6 4;
  }

  .lote.sel {
    stroke: #fff;
    stroke-width: 2.4;
    stroke-dasharray: none;
  }

  .lote.urbanizado {
    stroke-dasharray: none;
  }

  .lote.servicios {
    fill: rgba(126, 190, 255, 0.1);
    stroke: rgba(126, 190, 255, 0.45);
  }

  .lote.reserva {
    fill: rgba(110, 231, 183, 0.06);
    stroke: rgba(110, 231, 183, 0.3);
  }

  .lote:hover {
    stroke: #ffe4f1;
    stroke-width: 1.6;
  }

  .franja {
    fill: rgba(214, 228, 243, 0.07);
    stroke: rgba(214, 228, 243, 0.45);
    stroke-width: 1;
    stroke-dasharray: 3 3;
  }

  .franja.via {
    fill: rgba(255, 209, 102, 0.08);
    stroke: rgba(255, 209, 102, 0.5);
  }

  .franja.ducto {
    fill: rgba(251, 146, 60, 0.16);
    stroke: rgba(251, 146, 60, 0.65);
  }

  .franja.reserva {
    fill: rgba(110, 231, 183, 0.06);
    stroke: rgba(244, 114, 182, 0.6);
  }

  .franja.parcela {
    fill: rgba(167, 139, 250, 0.1);
    stroke: rgba(167, 139, 250, 0.55);
  }

  .franja:hover {
    stroke-width: 1.6;
    filter: brightness(1.5);
  }

  .vialidad-plan {
    fill: rgba(214, 228, 243, 0.04);
    stroke: rgba(214, 228, 243, 0.3);
    stroke-width: 1;
    stroke-dasharray: 4 4;
  }

  /* Built road: as wide as the real road (metres, so it scales). */
  .vialidad {
    fill: none;
    stroke: rgba(201, 214, 230, 0.72);
    stroke-width: 24;
    vector-effect: none;
  }

  .farol {
    fill: #fff3c4;
    stroke: none;
  }

  .tubo {
    fill: none;
    stroke-width: 2.4;
    stroke-linecap: round;
  }

  .plan-linea {
    fill: none;
    stroke-width: 1.2;
    stroke-dasharray: 5 5;
    opacity: 0.55;
  }

  /* Built track: solid amber over a dark casing, like the main lines. */
  .espuela {
    fill: none;
    stroke-width: 3;
    stroke-linecap: round;
  }

  .espuela-fondo {
    fill: none;
    stroke: rgba(4, 8, 15, 0.9);
    stroke-width: 6;
    stroke-linecap: round;
  }

  /* Power: dashed, like the CFE's lines around. */
  .cable {
    fill: none;
    stroke-width: 2;
    stroke-dasharray: 9 3;
  }

  .tocar {
    fill: none;
    stroke: transparent;
    stroke-width: 14;
  }

  .tanque,
  .subestacion {
    fill: transparent;
    stroke: var(--c);
    stroke-width: 1.4;
    stroke-dasharray: 3 3;
  }

  .tanque.hecho,
  .subestacion.hecho {
    fill: color-mix(in srgb, var(--c) 45%, transparent);
    stroke-dasharray: none;
  }

  .banco {
    fill: color-mix(in srgb, #fde68a 55%, transparent);
    stroke: #fde68a;
    stroke-width: 1.2;
  }

  .edificio {
    fill: rgba(126, 190, 255, calc(0.08 + 0.5 * var(--av)));
    stroke: rgba(126, 190, 255, 0.7);
    stroke-width: 1.2;
  }

  .cuadrilla {
    fill: #fff1f8;
    stroke: var(--polo);
    stroke-width: 1.6;
    animation: trabajo 0.9s ease-in-out infinite alternate;
  }

  .cuadrilla.quieta {
    animation-play-state: paused;
  }

  @keyframes trabajo {
    to {
      opacity: 0.45;
    }
  }

  .edificio-osm {
    fill: rgba(214, 228, 243, 0.6);
  }

  .rotulo {
    fill: var(--muted);
    paint-order: stroke;
    stroke: rgba(4, 8, 15, 0.85);
    stroke-width: 3;
    stroke-linejoin: round;
    pointer-events: none;
    font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
  }

  .rotulo.lugar {
    font-style: italic;
  }

  .rotulo.pueblo {
    fill: var(--ink);
    font-style: normal;
  }

  .rotulo.riel {
    fill: #ffd166;
  }

  .rotulo.luz {
    fill: #fde68a;
  }

  .rotulo.carretera {
    fill: #d6e4f3;
    font-weight: 600;
  }

  .rotulo.pais {
    fill: rgba(248, 113, 113, 0.85);
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  .rotulo.lote-rotulo {
    fill: #ffd6ea;
  }

  .escala {
    position: fixed;
    right: calc(1rem + 340px);
    bottom: 1.2rem;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.68rem;
    color: var(--muted);
    pointer-events: none;
  }

  .barra-escala {
    height: 5px;
    border: 1px solid var(--muted);
    border-top: none;
  }

  .norte {
    position: fixed;
    right: calc(1rem + 340px);
    top: 6.2rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    font-size: 0.66rem;
    color: var(--muted);
    pointer-events: none;
  }

  .atribucion {
    position: fixed;
    left: calc(1rem + var(--vistas) + 0.6rem);
    bottom: 1.2rem;
    margin: 0;
    font-size: 0.62rem;
    color: var(--dim);
    pointer-events: none;
  }

  .tip {
    position: fixed;
    z-index: 35;
    pointer-events: none;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    max-width: 18rem;
    padding: 0.5rem 0.7rem;
    background: var(--glass-strong);
    transform: translate(16px, 14px);
    font-size: 0.72rem;
    color: var(--muted);
  }

  .tip.flip {
    transform: translate(calc(-100% - 16px), 14px);
  }

  .tip strong {
    font-size: 0.86rem;
    font-weight: 600;
    color: var(--ink);
  }
</style>
