<script lang="ts">
  import { onMount } from 'svelte';
  import { ENCICLOPEDIA } from '$lib/enciclopedia';

  /**
   * The encyclopedia, inside the game. The whole app is a fixed, non-scrolling
   * console, so this page brings its own scroller; in-page links are steered to
   * it by hand (a plain `#id` jump would try to scroll the window).
   */

  const { html, indice, titulo } = ENCICLOPEDIA;

  let scroller: HTMLElement;
  let actual = $state(indice[0]?.id ?? '');

  function ir(id: string, suave = true) {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: suave ? 'smooth' : 'auto', block: 'start' });
    history.replaceState(history.state, '', `#${id}`);
    actual = id;
  }

  /** Any `#anchor` link — the table of contents or the document's own cross-references. */
  function alClic(e: MouseEvent) {
    const a = (e.target as HTMLElement).closest('a');
    const href = a?.getAttribute('href');
    if (!href?.startsWith('#')) return;
    e.preventDefault();
    ir(decodeURIComponent(href.slice(1)));
  }

  onMount(() => {
    const hash = decodeURIComponent(location.hash.slice(1));
    if (hash) ir(hash, false);

    // Highlight, in the index, the section being read: the last heading that
    // has crossed the top quarter of the view.
    const titulos = indice.map((s) => document.getElementById(s.id)).filter((el): el is HTMLElement => !!el);
    const marcar = () => {
      // At the very bottom the last sections can never reach that line, so
      // the whole view counts.
      const alFondo = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 4;
      const tope = scroller.getBoundingClientRect().top + scroller.clientHeight * (alFondo ? 0.6 : 0.25);
      let id = titulos[0]?.id ?? '';
      for (const el of titulos) {
        if (el.getBoundingClientRect().top <= tope) id = el.id;
        else break;
      }
      actual = id;
    };
    scroller.addEventListener('scroll', marcar, { passive: true });
    return () => scroller.removeEventListener('scroll', marcar);
  });
</script>

<svelte:head>
  <title>{titulo} · Ruta Logística</title>
</svelte:head>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="scroller" bind:this={scroller} onclick={alClic}>
  <div class="hoja">
    <aside class="indice panel">
      <span class="label">Contenido</span>
      <ol>
        {#each indice as s (s.id)}
          <li class:sub={s.nivel === 3} class:on={s.id === actual}>
            <a href={`#${s.id}`}>{s.texto}</a>
          </li>
        {/each}
      </ol>
    </aside>

    <article class="doc">
      {@html html}
    </article>
  </div>
</div>

<style>
  .scroller {
    position: fixed;
    inset: 0;
    overflow-y: auto;
    scroll-padding-top: 6rem;
  }

  .hoja {
    display: grid;
    grid-template-columns: 250px minmax(0, 860px);
    justify-content: center;
    gap: 2.5rem;
    padding: 6rem 1.5rem 5rem;
  }

  /* ---- index ------------------------------------------------------------- */

  .indice {
    position: sticky;
    top: 6rem;
    align-self: start;
    max-height: calc(100vh - 7.5rem);
    overflow-y: auto;
    padding: 0.9rem 0.6rem 0.9rem 0.9rem;
  }

  .indice ol {
    list-style: none;
    margin: 0.6rem 0 0;
    padding: 0;
  }

  .indice li a {
    display: block;
    padding: 0.28rem 0.5rem;
    border-radius: 8px;
    font-size: 0.78rem;
    line-height: 1.3;
    color: var(--muted);
  }

  .indice li.sub a {
    padding-left: 1.3rem;
    font-size: 0.72rem;
    color: var(--dim);
  }

  .indice li a:hover {
    color: var(--ink);
    background: rgba(126, 190, 255, 0.07);
  }

  .indice li.on a {
    color: var(--accent);
    background: var(--accent-soft);
  }

  /* ---- the document (rendered markdown, hence :global) ------------------- */

  .doc {
    min-width: 0;
    font-size: 0.92rem;
    line-height: 1.65;
    color: #d3e3f5;
  }

  .doc :global(h1) {
    margin: 0 0 1rem;
    font-size: 2rem;
    line-height: 1.2;
    font-weight: 650;
    letter-spacing: -0.01em;
    color: var(--ink);
  }

  .doc :global(h2) {
    margin: 2.8rem 0 0.9rem;
    padding-bottom: 0.45rem;
    border-bottom: 1px solid var(--line);
    font-size: 1.4rem;
    font-weight: 620;
    color: var(--ink);
  }

  .doc :global(h3) {
    margin: 2rem 0 0.6rem;
    font-size: 1.08rem;
    font-weight: 620;
    color: var(--warn);
  }

  .doc :global(h4) {
    margin: 1.5rem 0 0.4rem;
    font-size: 0.95rem;
    color: var(--ink);
  }

  .doc :global(p),
  .doc :global(ul),
  .doc :global(ol) {
    margin: 0 0 0.9rem;
  }

  .doc :global(li) {
    margin: 0.2rem 0;
  }

  .doc :global(strong) {
    color: var(--ink);
    font-weight: 620;
  }

  .doc :global(a) {
    color: var(--accent);
    text-decoration: underline;
    text-decoration-color: rgba(76, 201, 255, 0.35);
    text-underline-offset: 2px;
  }

  .doc :global(a:hover) {
    text-decoration-color: var(--accent);
  }

  .doc :global(code) {
    font-family: 'JetBrains Mono', 'Cascadia Mono', ui-monospace, monospace;
    font-size: 0.82em;
    padding: 0.1em 0.35em;
    border-radius: 5px;
    background: rgba(126, 190, 255, 0.09);
    color: #bfe6ff;
  }

  .doc :global(pre) {
    overflow-x: auto;
    padding: 0.8rem 1rem;
    border-radius: 10px;
    background: var(--glass-strong);
    border: 1px solid var(--line);
  }

  .doc :global(pre code) {
    padding: 0;
    background: none;
  }

  .doc :global(blockquote) {
    margin: 0 0 1rem;
    padding: 0.7rem 1rem;
    border-left: 3px solid var(--accent);
    border-radius: 0 10px 10px 0;
    background: var(--accent-soft);
  }

  .doc :global(blockquote p:last-child) {
    margin-bottom: 0;
  }

  .doc :global(hr) {
    margin: 2.5rem 0;
    border: 0;
    border-top: 1px solid var(--line);
  }

  .doc :global(.tabla) {
    overflow-x: auto;
    margin: 0 0 1.1rem;
    border: 1px solid var(--line);
    border-radius: 10px;
    background: var(--glass);
  }

  .doc :global(table) {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8rem;
    line-height: 1.45;
    font-variant-numeric: tabular-nums;
  }

  .doc :global(th),
  .doc :global(td) {
    padding: 0.45rem 0.7rem;
    border-bottom: 1px solid var(--line);
    vertical-align: top;
  }

  .doc :global(th) {
    text-align: left;
    font-size: 0.68rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
    background: rgba(126, 190, 255, 0.05);
    white-space: nowrap;
  }

  .doc :global(th[align='right']),
  .doc :global(td[align='right']) {
    text-align: right;
  }

  .doc :global(th[align='center']),
  .doc :global(td[align='center']) {
    text-align: center;
  }

  .doc :global(tr:last-child td) {
    border-bottom: 0;
  }

  .doc :global(tbody tr:hover) {
    background: rgba(126, 190, 255, 0.04);
  }

  @media (max-width: 1100px) {
    .hoja {
      grid-template-columns: minmax(0, 860px);
    }

    .indice {
      display: none;
    }
  }

  @media (max-width: 600px) {
    .hoja {
      padding: 5.5rem 1rem 4rem;
    }
  }
</style>
