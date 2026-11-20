import { marked } from 'marked';
import fuente from '../../docs/enciclopedia.md?raw';

/**
 * The encyclopedia page, built from `docs/enciclopedia.md` — the one document
 * that stays the source of truth (it reads fine on GitHub too). The page
 * imports it raw, so editing the file is all it takes to update the page.
 *
 * Headings get the same ids GitHub gives them, so the document's own links
 * (`[bitácora](#12-bitácora-de-correcciones-a-los-datos)`) work unchanged.
 */

export type Seccion = { id: string; texto: string; nivel: 2 | 3 };

const ENTIDADES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };

const textoPlano = (html: string) =>
  html.replace(/<[^>]+>/g, '').replace(/&(amp|lt|gt|quot|#39);/g, (e) => ENTIDADES[e]);

/** GitHub's heading anchor: lowercase, punctuation out, spaces to hyphens. */
function slug(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s/g, '-');
}

function construir() {
  const usados = new Map<string, number>();
  const indice: Seccion[] = [];
  let titulo = 'Enciclopedia';

  let html = marked.parse(fuente, { async: false }) as string;

  html = html.replace(/<h([1-4])>([\s\S]*?)<\/h\1>/g, (_, n: string, dentro: string) => {
    const texto = textoPlano(dentro);
    const base = slug(texto);
    const vez = usados.get(base) ?? 0;
    usados.set(base, vez + 1);
    const id = vez ? `${base}-${vez}` : base;
    const nivel = Number(n);
    if (nivel === 1) titulo = texto;
    if (nivel === 2 || nivel === 3) indice.push({ id, texto, nivel });
    return `<h${n} id="${id}">${dentro}</h${n}>`;
  });

  // Wide tables scroll sideways inside the column instead of the whole page.
  html = html.replace(/<table>/g, '<div class="tabla"><table>').replace(/<\/table>/g, '</table></div>');
  // Sources open outside the game.
  html = html.replace(/<a href="(https?:[^"]+)"/g, '<a href="$1" target="_blank" rel="noopener noreferrer"');

  return { html, indice, titulo };
}

export const ENCICLOPEDIA = construir();
