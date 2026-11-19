import adapter from '@sveltejs/adapter-auto';

/**
 * Scoped-CSS class names (`svelte-xxxxxx`) are a hash of the component's file
 * path, made project-relative only when the path starts with Svelte's
 * `rootDir` (= process.cwd()). That check is case-sensitive, and on Windows the
 * drive letter isn't stable: npm can start the dev server with a cwd of
 * `c:\…` while Vite's dependency pre-bundler hands over canonical `C:\…`
 * paths. A pre-bundled Svelte library (Threlte's <Canvas>) then gets one class
 * when server-rendered and another in the browser, its styles never apply to
 * the hydrated markup, and nothing is logged. Hash a normalised path instead:
 * forward slashes, project-relative, root matched case-insensitively.
 */
const ROOT = process.cwd().replace(/\\/g, '/').toLowerCase();

/** @param {{ hash: (input: string) => string; filename: string; css: string }} input */
function cssHash({ hash, filename, css }) {
	if (!filename || filename === '(unknown)') return `svelte-${hash(css)}`;
	let path = filename.replace(/\\/g, '/');
	if (path.toLowerCase().startsWith(ROOT + '/')) path = path.slice(ROOT.length + 1);
	return `svelte-${hash(path)}`;
}

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true),
		cssHash
	},
	kit: {
		// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapters for a list.
		// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
		// See https://svelte.dev/docs/kit/adapters for more information about adapters.
		adapter: adapter()
	}
};

export default config;
