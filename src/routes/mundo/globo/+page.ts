// Client-only: a WebGL globe has nothing to server-render.
//
// It is also a second guard against a dev-only bug fixed at the root by the
// `cssHash` in svelte.config.js: when the server and the browser compute
// different scoped-CSS classes for Threlte's pre-bundled <Canvas> (a Windows
// drive-letter case mismatch), the hydrated wrapper loses its `height: 100%`
// and the globe renders squashed into the top of the screen, silently, on a
// direct load of this URL only. Without SSR there is no second class to
// disagree with.
export const ssr = false;
