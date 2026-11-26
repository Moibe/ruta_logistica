<script lang="ts">
  import { untrack } from 'svelte';
  import { T, useTask, useThrelte } from '@threlte/core';
  import { HTML } from '@threlte/extras';
  import {
    AdditiveBlending,
    BufferAttribute,
    BufferGeometry,
    Color,
    DoubleSide,
    Group,
    Line,
    LineBasicMaterial,
    Matrix4,
    Mesh,
    MeshBasicMaterial,
    PerspectiveCamera,
    RingGeometry,
    Shape,
    ShapeGeometry,
    SphereGeometry,
    Vector3,
    type Object3D,
  } from 'three';
  import type { Barco } from '$lib/domain/barcos';
  import { distanceKm, interpolate, toVector3 } from '$lib/domain/geo';
  import { piernasDelRecorrido, posicion, trayectoActual } from '$lib/domain/servicio';
  import { PUERTAS } from '$lib/domain/sitios';
  import { kmEnHoras } from '$lib/domain/petroleros';
  import { puntoEn } from '$lib/domain/trayecto';
  import { sim } from '$lib/state/simulacion.svelte';

  /**
   * The ships on the globe: each one's whole loop as a faint line in its
   * colour, and the ships themselves — a flat hull lying on the sea, pointing
   * where it's headed, with a glow and a fading wake — plus Shanghái and
   * Róterdam, where the crossings end.
   *
   * Sizes are kept constant on screen, like the 2D map's icons: every frame the
   * hull is scaled to the world-units-per-pixel at the camera's height, so a
   * ship is the same few pixels from orbit and from close in.
   *
   * The three.js objects are built imperatively, one group per ship, and moved
   * in place every frame — sixty reactive updates a second through Svelte would
   * buy nothing. Hit-testing is done on screen, like the 2D views: each ship's
   * projected position is kept, and the nearest within reach of the pointer is
   * the one under it.
   */
  let {
    ocean,
    hoverBarco = $bindable(null),
  }: {
    /** The ocean sphere: labels behind it are hidden. */
    ocean?: Object3D;
    hoverBarco?: Barco | null;
  } = $props();

  const R = { ruta: 1.0035, puerto: 1.004, estela: 1.0045, barco: 1.006 };
  /** On-screen sizes, px. */
  const CASCO_PX = 11;
  const BRILLO_PX = 13;
  const ESTELA_PX = 46;
  const ALCANCE_PX = 12;
  /** Vertices per wake: fixed, so its buffer is allocated once and rewritten in place. */
  const MUESTRAS_ESTELA = 40;
  /** Densify route segments to this, so long straight runs don't cut under the surface. */
  const PASO_RUTA_KM = 60;

  const { camera, size, invalidate, dom } = useThrelte();

  // ---- shared resources ----------------------------------------------------------------

  /** A hull of length 1, bow at the origin pointing +X, lying in the XY plane. */
  const cascoGeom = (() => {
    const f = new Shape();
    f.moveTo(0, 0);
    f.lineTo(-0.3, -0.21);
    f.lineTo(-1, -0.21);
    f.lineTo(-1, 0.21);
    f.lineTo(-0.3, 0.21);
    f.closePath();
    return new ShapeGeometry(f);
  })();
  /** The bridge block aft, pale over the hull colour. */
  const puenteGeom = (() => {
    const f = new Shape();
    f.moveTo(-0.9, -0.126);
    f.lineTo(-0.72, -0.126);
    f.lineTo(-0.72, 0.126);
    f.lineTo(-0.9, 0.126);
    f.closePath();
    return new ShapeGeometry(f);
  })();
  const puenteMat = new MeshBasicMaterial({ color: '#ffffff', side: DoubleSide, transparent: true, opacity: 0.9 });
  const brilloGeom = new SphereGeometry(1, 16, 12);
  const anilloGeom = new RingGeometry(0.85, 1, 48);
  const puertoGeom = new RingGeometry(0.0045, 0.0068, 32);
  const puertoMat = new MeshBasicMaterial({ color: '#4cc9ff', side: DoubleSide, transparent: true, opacity: 0.9 });

  // ---- one group per ship ------------------------------------------------------------------

  type Vista = {
    barco: Barco;
    ruta: Line;
    rutaMat: LineBasicMaterial;
    estela: Line;
    estelaPos: Float32Array;
    casco: Mesh;
    cascoMat: MeshBasicMaterial;
    brillo: Mesh;
    brilloMat: MeshBasicMaterial;
    anillo: Mesh;
    anilloMat: MeshBasicMaterial;
    /** Screen position last frame, or null when it's behind the globe. */
    pantalla: { x: number; y: number } | null;
  };

  const raiz = new Group();
  let vistas = $state.raw<Vista[]>([]);

  function lineaDeRuta(b: Barco): BufferGeometry {
    const pos: number[] = [];
    for (const leg of piernasDelRecorrido(b)) {
      const pts = leg.puntos;
      pos.push(...toVector3(pts[0], R.ruta));
      for (let i = 1; i < pts.length; i++) {
        const n = Math.ceil(distanceKm(pts[i - 1], pts[i]) / PASO_RUTA_KM);
        for (let s = 1; s < n; s++) pos.push(...toVector3(interpolate(pts[i - 1], pts[i], s / n), R.ruta));
        pos.push(...toVector3(pts[i], R.ruta));
      }
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
    return g;
  }

  function crearVista(b: Barco): Vista {
    const color = new Color(b.color);
    const rutaMat = new LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.3,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    const ruta = new Line(lineaDeRuta(b), rutaMat);

    // Wake: fades to black rather than to alpha 0 — under additive blending a
    // black vertex adds nothing, so it's a true per-vertex falloff.
    const estelaPos = new Float32Array(MUESTRAS_ESTELA * 3);
    const colores = new Float32Array(MUESTRAS_ESTELA * 3);
    for (let i = 0; i < MUESTRAS_ESTELA; i++) {
      const f = (i / (MUESTRAS_ESTELA - 1)) ** 2 * 0.8;
      colores[i * 3] = color.r * f;
      colores[i * 3 + 1] = color.g * f;
      colores[i * 3 + 2] = color.b * f;
    }
    const estelaGeom = new BufferGeometry();
    estelaGeom.setAttribute('position', new BufferAttribute(estelaPos, 3));
    estelaGeom.setAttribute('color', new BufferAttribute(colores, 3));
    const estela = new Line(
      estelaGeom,
      new LineBasicMaterial({ vertexColors: true, transparent: true, blending: AdditiveBlending, depthWrite: false })
    );
    estela.frustumCulled = false;

    const cascoMat = new MeshBasicMaterial({ color, side: DoubleSide });
    const casco = new Mesh(cascoGeom, cascoMat);
    const puente = new Mesh(puenteGeom, puenteMat);
    puente.position.z = 0.02;
    casco.add(puente);

    const brilloMat = new MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.32,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    const brillo = new Mesh(brilloGeom, brilloMat);

    const anilloMat = new MeshBasicMaterial({ color, side: DoubleSide, transparent: true, opacity: 0.85, depthWrite: false });
    const anillo = new Mesh(anilloGeom, anilloMat);
    anillo.visible = false;

    raiz.add(ruta, estela, brillo, casco, anillo);
    return { barco: b, ruta, rutaMat, estela, estelaPos, casco, cascoMat, brillo, brilloMat, anillo, anilloMat, pantalla: null };
  }

  function soltarVista(v: Vista) {
    raiz.remove(v.ruta, v.estela, v.brillo, v.casco, v.anillo);
    v.ruta.geometry.dispose();
    v.rutaMat.dispose();
    v.estela.geometry.dispose();
    (v.estela.material as LineBasicMaterial).dispose();
    v.cascoMat.dispose();
    v.brilloMat.dispose();
    v.anilloMat.dispose();
  }

  $effect(() => {
    // A ship put in service or retired: rebuild the set (ships never change their route).
    const barcos = sim.barcos;
    const nuevas = barcos.map(crearVista);
    vistas = nuevas;
    untrack(() => {
      if (hoverBarco && !barcos.includes(hoverBarco)) hoverBarco = null;
    });
    invalidate();
    return () => nuevas.forEach(soltarVista);
  });

  $effect(() => {
    // Selecting or hovering lights a ship's loop and dims the rest.
    const foco = hoverBarco?.id ?? sim.seleccion;
    for (const v of vistas) {
      const lit = v.barco.id === foco;
      v.rutaMat.opacity = lit ? 0.85 : foco ? 0.12 : 0.3;
    }
    invalidate();
  });

  // ---- the buyers' tankers (`petroleros.ts`): plain hulls in a light crude tone, reused frame to frame ----

  const petroleroMat = new MeshBasicMaterial({ color: new Color('#e3935a'), side: DoubleSide });
  const petroleroBrilloMat = new MeshBasicMaterial({
    color: new Color('#e3935a'),
    transparent: true,
    opacity: 0.28,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  const petroleros: { casco: Mesh; brillo: Mesh }[] = [];
  function cascosPetroleros(n: number) {
    while (petroleros.length < n) {
      const casco = new Mesh(cascoGeom, petroleroMat);
      const brillo = new Mesh(brilloGeom, petroleroBrilloMat);
      raiz.add(brillo, casco);
      petroleros.push({ casco, brillo });
    }
    petroleros.forEach((p, i) => (p.casco.visible = p.brillo.visible = i < n));
  }

  // ---- every frame ----------------------------------------------------------------

  const P = new Vector3();
  const N = new Vector3();
  const F = new Vector3();
  const L = new Vector3();
  const A = new Vector3();
  const B = new Vector3();
  const ojo = new Vector3();
  const base = new Matrix4();
  /** The selected ship's name follows it. */
  const etiqueta = new Group();
  let etiquetaVisible = $state(false);
  let reloj = 0;

  /** Point the object's +X along the heading, +Z out of the sphere. */
  function orientar(o: Object3D) {
    base.makeBasis(F, L, N);
    o.quaternion.setFromRotationMatrix(base);
  }

  useTask(
    (delta) => {
      reloj += delta;
      const cam = camera.current as PerspectiveCamera;
      const alto = Math.max(1, size.current.height);
      const ancho = Math.max(1, size.current.width);
      // World units per screen pixel at the sea surface under the camera.
      const pxUnidad = (2 * Math.tan((cam.fov * Math.PI) / 360) * Math.max(0.03, cam.position.length() - 1)) / alto;
      let haySeleccion = false;

      for (const v of vistas) {
        const b = v.barco;
        const leg = trayectoActual(b);
        P.set(...toVector3(posicion(b), R.barco));
        N.copy(P).normalize();
        // Heading: a short stretch behind the bow (ahead of it, right out of port).
        const d = 20;
        A.set(...toVector3(puntoEn(leg, b.km > d ? b.km - d : b.km), 1));
        B.set(...toVector3(puntoEn(leg, b.km > d ? b.km : b.km + d), 1));
        F.subVectors(B, A);
        F.addScaledVector(N, -F.dot(N));
        if (F.lengthSq() > 1e-14) {
          F.normalize();
          L.crossVectors(N, F);
          orientar(v.casco);
          orientar(v.anillo);
        }

        const sel = sim.seleccion === b.id;
        const hot = hoverBarco?.id === b.id;
        const k = sel || hot ? 1.25 : 1;
        v.casco.position.copy(P);
        v.casco.scale.setScalar(CASCO_PX * pxUnidad * k);
        v.brillo.position.copy(P);
        v.brillo.scale.setScalar(BRILLO_PX * pxUnidad * k * 0.5);
        v.brilloMat.opacity = sel || hot ? 0.55 : 0.32;

        // Selected: a pulsing ring round the hull.
        v.anillo.visible = sel;
        if (sel) {
          v.anillo.position.copy(P).addScaledVector(F, -CASCO_PX * pxUnidad * 0.5);
          v.anillo.scale.setScalar((CASCO_PX * 0.95 + Math.sin(reloj * 4) * 1.2) * pxUnidad);
          etiqueta.position.copy(P);
          haySeleccion = true;
        }

        // Wake along the lane behind the stern.
        v.estela.visible = b.estado === 'ruta';
        if (v.estela.visible) {
          const largo = ESTELA_PX * pxUnidad * 6371;
          for (let s = 0; s < MUESTRAS_ESTELA; s++) {
            const km = b.km - largo + (largo * s) / (MUESTRAS_ESTELA - 1);
            const [x, y, z] = toVector3(puntoEn(leg, Math.max(0, km)), R.estela);
            v.estelaPos[s * 3] = x;
            v.estelaPos[s * 3 + 1] = y;
            v.estelaPos[s * 3 + 2] = z;
          }
          v.estela.geometry.attributes.position.needsUpdate = true;
        }

        // Where it is on screen, for the pointer; nowhere when the globe hides it.
        ojo.subVectors(cam.position, P);
        if (ojo.dot(N) > 0) {
          A.copy(P).project(cam);
          v.pantalla = { x: ((A.x + 1) / 2) * ancho, y: ((1 - A.y) / 2) * alto };
        } else {
          v.pantalla = null;
        }
      }

      const enMar = sim.petroleros;
      cascosPetroleros(enMar.length);
      enMar.forEach((p, i) => {
        const t = p.trayecto;
        const km = kmEnHoras(t, sim.horas - p.salida);
        P.set(...toVector3(puntoEn(t, km), R.barco));
        N.copy(P).normalize();
        A.set(...toVector3(puntoEn(t, km > 20 ? km - 20 : km), 1));
        B.set(...toVector3(puntoEn(t, km > 20 ? km : km + 20), 1));
        F.subVectors(B, A);
        F.addScaledVector(N, -F.dot(N));
        const v = petroleros[i];
        if (F.lengthSq() > 1e-14) {
          F.normalize();
          L.crossVectors(N, F);
          orientar(v.casco);
        }
        v.casco.position.copy(P);
        v.casco.scale.setScalar(CASCO_PX * pxUnidad * 0.8);
        v.brillo.position.copy(P);
        v.brillo.scale.setScalar(BRILLO_PX * pxUnidad * 0.4);
      });

      if (haySeleccion !== etiquetaVisible) etiquetaVisible = haySeleccion;
      // Keep frames coming while ships move; paused, the camera alone asks for them.
      if (sim.corriendo && (vistas.length || sim.petroleros.length)) invalidate();
      else if (haySeleccion) invalidate();
    },
    { autoInvalidate: false }
  );

  // ---- pointer -----------------------------------------------------------------

  /** The ship drawn under a point of the canvas, if any. */
  function barcoEn(x: number, y: number): Barco | null {
    let mejor: Barco | null = null;
    let mejorD = ALCANCE_PX;
    for (const v of vistas) {
      if (!v.pantalla) continue;
      const d = Math.hypot(v.pantalla.x - x, v.pantalla.y - y);
      if (d < mejorD) {
        mejorD = d;
        mejor = v.barco;
      }
    }
    return mejor;
  }

  $effect(() => {
    const el = dom;
    let abajo: { x: number; y: number } | null = null;
    const local = (e: PointerEvent | MouseEvent) => {
      const r = el.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const mover = (e: PointerEvent) => {
      if (e.buttons) return;
      const { x, y } = local(e);
      const b = barcoEn(x, y);
      if (b !== hoverBarco) {
        hoverBarco = b;
        invalidate();
      }
    };
    const salir = () => {
      if (hoverBarco) hoverBarco = null;
    };
    const bajar = (e: PointerEvent) => {
      abajo = local(e);
    };
    // A drag to orbit the globe ends in a click too; that one isn't a pick.
    const clic = (e: MouseEvent) => {
      const { x, y } = local(e);
      if (abajo && Math.hypot(x - abajo.x, y - abajo.y) > 5) return;
      const b = barcoEn(x, y);
      if (b) {
        sim.seleccionar(b.id);
        invalidate();
      }
    };
    el.addEventListener('pointermove', mover);
    el.addEventListener('pointerleave', salir);
    el.addEventListener('pointerdown', bajar);
    el.addEventListener('click', clic);
    return () => {
      el.removeEventListener('pointermove', mover);
      el.removeEventListener('pointerleave', salir);
      el.removeEventListener('pointerdown', bajar);
      el.removeEventListener('click', clic);
    };
  });

  $effect(() => () => {
    vistas.forEach(soltarVista);
    vistas = [];
    for (const g of [cascoGeom, puenteGeom, brilloGeom, anilloGeom, puertoGeom]) g.dispose();
    puenteMat.dispose();
    puertoMat.dispose();
  });

  const lejanos = PUERTAS.map((p) => {
    const pos = new Vector3(...toVector3(p.haciaLonLat, R.puerto));
    const anillo = new Mesh(puertoGeom, puertoMat);
    anillo.position.copy(pos);
    anillo.lookAt(pos.clone().multiplyScalar(2));
    return { id: p.id, hacia: p.hacia, pos: pos.toArray() as [number, number, number], anillo };
  });

  const seleccionado = $derived(sim.seleccionado?.tipo === 'barco' ? sim.seleccionado : null);
</script>

<T is={raiz} />

{#each lejanos as p (p.id)}
  <T is={p.anillo} />
  <T.Group position={p.pos}>
    <HTML occlude={ocean ? [ocean] : false} pointerEvents="none">
      <span class="lejano">{p.hacia}</span>
    </HTML>
  </T.Group>
{/each}

<T is={etiqueta}>
  {#if etiquetaVisible && seleccionado}
    <HTML occlude={ocean ? [ocean] : false} pointerEvents="none">
      <span class="nombre" style:color={seleccionado.color}>{seleccionado.nombre}</span>
    </HTML>
  {/if}
</T>

<style>
  .lejano,
  .nombre {
    display: block;
    white-space: nowrap;
    font: 600 10px Inter, 'Segoe UI', system-ui, sans-serif;
    letter-spacing: 1px;
    transform: translate(9px, -50%);
    text-shadow:
      0 0 3px rgba(3, 9, 18, 0.95),
      0 0 6px rgba(3, 9, 18, 0.8);
    user-select: none;
  }

  .lejano {
    color: #cfeaff;
  }

  .nombre {
    transform: translate(16px, -50%);
  }
</style>
