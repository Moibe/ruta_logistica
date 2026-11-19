<script lang="ts">
  import { T, useTask } from '@threlte/core';
  import { interactivity, OrbitControls } from '@threlte/extras';
  import {
    AdditiveBlending,
    BackSide,
    BufferGeometry,
    LineBasicMaterial,
    MeshBasicMaterial,
    PerspectiveCamera,
    PointsMaterial,
    SphereGeometry,
    Vector3,
  } from 'three';
  import { geoContains } from 'd3-geo';
  import { goto } from '$app/navigation';
  import { fromVector3, toVector3 } from '$lib/domain/geo';
  import { CENTRO_MEXICO } from '$lib/domain/sitios';
  import { loadWorld } from './world';
  import { loadMexico, type MexicoGeometry } from './mexico';
  import { dotGrid, lineOutlines, roundDot, starField } from './globeGeometry';

  /**
   * The globe. Same coastlines as the flat view — the only thing that changes
   * is that a [lon, lat] becomes a point on a sphere instead of a point on a
   * projection.
   *
   * Radii are stacked in fixed shells so nothing z-fights: ocean at 1.000,
   * coastline and borders at 1.002, Mexico's dots at 1.0025 and its outline at
   * 1.003, the atmosphere shell at 1.045. Moving things (ships, trains) take
   * the shells in between, as in logistica-oceanica (1.004–1.012).
   *
   * Every material is unlit (Basic/LineBasic/Points), so the scene needs no
   * lights. Threlte renders on demand: with nothing animating, frames are only
   * drawn while the camera moves.
   *
   * Opens looking at Mexico. Clicking Mexico (or `entering` from the panel)
   * flies the camera down onto it and hands over to the board.
   */
  let {
    autoRotate = false,
    entering = $bindable(false),
    hoverMexico = $bindable(false),
  }: { autoRotate?: boolean; entering?: boolean; hoverMexico?: boolean } = $props();

  const R = {
    ocean: 1,
    coast: 1.002,
    dots: 1.0025,
    mexico: 1.003,
    atmosphere: 1.045,
  };

  const START_DISTANCE = 3.3;
  const LAND_DISTANCE = 1.42;
  const FLY_MS = 1300;

  interactivity();

  let camera = $state.raw<PerspectiveCamera>();
  let coastGeometry = $state.raw<BufferGeometry | null>(null);
  let borderGeometry = $state.raw<BufferGeometry | null>(null);
  let mexicoOutline = $state.raw<BufferGeometry | null>(null);
  let mexicoDots = $state.raw<BufferGeometry | null>(null);
  let mexico: MexicoGeometry | null = null;

  $effect(() => {
    let cancelled = false;
    loadWorld('110m').then((world) => {
      if (cancelled) return;
      coastGeometry = lineOutlines(world.coastline, R.coast);
      borderGeometry = lineOutlines(world.borders, R.coast);
    });
    loadMexico().then((m) => {
      if (cancelled) return;
      mexico = m;
      mexicoOutline = lineOutlines(
        { type: 'MultiLineString', coordinates: [...m.costa.coordinates, ...m.frontera.coordinates] },
        R.mexico
      );
      mexicoDots = dotGrid(m.pais, 0.32, R.dots);
    });
    return () => {
      cancelled = true;
    };
  });

  // ---- flight ----------------------------------------------------------------

  let fly: { from: Vector3; start: number } | null = null;
  const target = new Vector3(...toVector3(CENTRO_MEXICO, 1));

  const { start: startFly, stop: stopFly } = useTask(
    () => {
      if (!camera || !fly) return;
      const u = Math.min(1, (performance.now() - fly.start) / FLY_MS);
      const e = u < 0.5 ? 4 * u ** 3 : 1 - (-2 * u + 2) ** 3 / 2;
      // Direction slerps across the sphere, distance eases in: the camera
      // swings round to face Mexico while it descends, never through the globe.
      const dir = fly.from.clone().normalize();
      const angle = dir.angleTo(target);
      if (angle > 1e-6) {
        const axis = new Vector3().crossVectors(dir, target).normalize();
        dir.applyAxisAngle(axis, angle * e);
      }
      const d = fly.from.length() + (LAND_DISTANCE - fly.from.length()) * e;
      camera.position.copy(dir.multiplyScalar(d));
      camera.lookAt(0, 0, 0);
      if (u >= 1) {
        fly = null;
        stopFly();
        goto('/mexico');
      }
    },
    { autoStart: false }
  );

  $effect(() => {
    if (entering && camera && !fly) {
      fly = { from: camera.position.clone(), start: performance.now() };
      startFly();
    }
  });

  // ---- hover & click on the ocean sphere ---------------------------------------

  function isMexicoAt(point: Vector3): boolean {
    return !!mexico && geoContains(mexico.pais, fromVector3([point.x, point.y, point.z]));
  }

  // ---- static scene resources -------------------------------------------
  // three.js materials and geometries are expensive to churn and none of these
  // depend on reactive state, so they are built once per component instance.

  const oceanGeometry = new SphereGeometry(R.ocean, 96, 96);
  const atmosphereGeometry = new SphereGeometry(R.atmosphere, 64, 64);
  const starGeometry = starField(1400, 14);

  const coastMaterial = new LineBasicMaterial({ color: '#6fc7ff', transparent: true, opacity: 0.75 });
  const borderMaterial = new LineBasicMaterial({ color: '#2f5f8f', transparent: true, opacity: 0.4 });
  // Normal blending, not additive: Mexico's outline lies right on top of the
  // world's cyan coastline, and amber *added* to cyan comes out white.
  const mexicoLineMaterial = new LineBasicMaterial({
    color: '#ffd166',
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });
  const mexicoDotMaterial = new PointsMaterial({
    color: '#ffc94d',
    map: roundDot(),
    alphaTest: 0.3,
    size: 0.0085,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const oceanMaterial = new MeshBasicMaterial({ color: '#061627' });
  const atmosphereMaterial = new MeshBasicMaterial({
    color: '#2d8fd6',
    transparent: true,
    opacity: 0.11,
    side: BackSide,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  const starMaterial = new PointsMaterial({
    color: '#9fc4e8',
    size: 0.012,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.6,
  });

  $effect(() => {
    const hot = hoverMexico || entering;
    mexicoDotMaterial.opacity = hot ? 0.9 : 0.55;
    mexicoLineMaterial.opacity = hot ? 1 : 0.9;
  });
</script>

<T.PerspectiveCamera
  makeDefault
  bind:ref={camera}
  position={toVector3(CENTRO_MEXICO, START_DISTANCE)}
  fov={38}
>
  <!-- Unmounted during the flight so its damping can't fight the animation. -->
  {#if !entering}
    <OrbitControls
      enableDamping
      dampingFactor={0.06}
      minDistance={1.25}
      maxDistance={7}
      {autoRotate}
      autoRotateSpeed={0.28}
      enablePan={false}
    />
  {/if}
</T.PerspectiveCamera>

<T.Points geometry={starGeometry} material={starMaterial} />

<!-- Ocean sphere (also the hit target for Mexico) + a back-side shell that fakes atmospheric scattering. -->
<T.Mesh
  geometry={oceanGeometry}
  material={oceanMaterial}
  onpointermove={(e: { point: Vector3 }) => (hoverMexico = isMexicoAt(e.point))}
  onpointerleave={() => (hoverMexico = false)}
  onclick={(e: { point: Vector3; delta: number }) => {
    // `delta` is how far the pointer travelled since pointerdown: a drag to
    // orbit the globe ends with a click event too, and that one isn't a click.
    if (e.delta < 5 && isMexicoAt(e.point)) entering = true;
  }}
/>
<T.Mesh geometry={atmosphereGeometry} material={atmosphereMaterial} />

{#if borderGeometry}
  <T.LineSegments geometry={borderGeometry} material={borderMaterial} />
{/if}
{#if coastGeometry}
  <T.LineSegments geometry={coastGeometry} material={coastMaterial} />
{/if}
{#if mexicoDots}
  <T.Points geometry={mexicoDots} material={mexicoDotMaterial} />
{/if}
{#if mexicoOutline}
  <T.LineSegments geometry={mexicoOutline} material={mexicoLineMaterial} />
{/if}
