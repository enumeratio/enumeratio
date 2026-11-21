// What the built site's entry chunk pulls in at first paint, read from the build's own output.
//
// The shell and the reading of the address are drawn first; the kernel (compute-engine and
// notatio's libraries) loads after first paint, in its own chunks and worker. These functions find
// the entry chunks in the built `index.html`, follow their static imports (not `import()`, which
// loads later), and say which chunk in that graph holds compute-engine and how big the entry is.
// `check-built-entry.ts` runs them on `site/dist`; `test/entry-graph.test.ts` tests them.

/**
 * Strings that only compute-engine's code has: its compile fallback's log line, its
 * type-error code, its class. A chunk that contains one holds the engine. A minified chunk has
 * no module names, so a module is recognized by what it says.
 */
export const engineMarkers = [
  'Compilation fallback',
  'incompatible-type',
  'ComputeEngine',
  '@cortex-js/compute-engine',
] as const;

/** Does this chunk's code hold compute-engine? */
export const holdsEngine = (code: string): string | undefined =>
  engineMarkers.find((marker) => code.includes(marker));

/** The module scripts and preloads of a page: the chunks it loads at first paint. */
export function entriesOf(html: string): string[] {
  const out = new Set<string>();
  for (const tag of html.match(/<(?:script|link)\b[^>]*>/g) ?? []) {
    const isScript = /^<script\b[^>]*\btype="module"/.test(tag);
    const isPreload = /^<link\b[^>]*\brel="modulepreload"/.test(tag);
    if (!isScript && !isPreload) continue;
    const at = /\b(?:src|href)="([^"]+)"/.exec(tag)?.[1];
    if (at !== undefined) out.add(at);
  }
  return [...out];
}

/**
 * The files a chunk's code imports statically: `import … from "x"`, `import "x"` and
 * `export … from "x"`. A dynamic `import("x")` is not one: it loads when it is called.
 */
export function staticImports(code: string): string[] {
  const out = new Set<string>();
  const from = /\b(?:import|export)\b[^;()'"`]*?\bfrom\s*(["'])([^"']+)\1/g;
  const bare = /\bimport\s*(["'])([^"']+)\1/g;
  for (const pattern of [from, bare]) {
    for (const found of code.matchAll(pattern)) out.add(found[2] as string);
  }
  return [...out];
}

export interface Chunk {
  /** The chunk's path under the site's root, as the page names it: `assets/index-x.js`. */
  file: string;
  bytes: number;
  /** The engine marker the chunk contains, when it holds compute-engine. */
  engine?: string;
}

export interface EntryGraph {
  /** The chunks the page loads first (its script, its preloads). */
  entries: Chunk[];
  /** Every chunk reachable from them by static imports, the entries included. */
  chunks: Chunk[];
}

const normalize = (path: string): string => {
  const parts: string[] = [];
  for (const part of path.split('/')) {
    if (part === '..') parts.pop();
    else if (part !== '.' && part !== '') parts.push(part);
  }
  return parts.join('/');
};

/** A name as the importing file wrote it, as a path under the site's root. */
export function resolveImport(from: string, name: string): string {
  if (name.startsWith('/')) return normalize(name);
  const directory = from.includes('/') ? from.slice(0, from.lastIndexOf('/')) : '';
  return normalize(`${directory}/${name}`);
}

/**
 * The entry graph of a built site. `read` gives a file's text by its path under the site's root,
 * and undefined for a file that is not there; an import of a file that is not JavaScript or that
 * is not there is not followed.
 */
export function entryGraph(html: string, read: (file: string) => string | undefined): EntryGraph {
  const entries = entriesOf(html).map((name) => resolveImport('index.html', name));
  const seen = new Map<string, Chunk>();
  const queue = [...entries];
  while (queue.length > 0) {
    const file = queue.shift() as string;
    if (seen.has(file) || !file.endsWith('.js')) continue;
    const code = read(file);
    if (code === undefined) continue;
    const engine = holdsEngine(code);
    seen.set(file, {
      file,
      bytes: Buffer.byteLength(code),
      ...(engine === undefined ? {} : { engine }),
    });
    for (const name of staticImports(code)) queue.push(resolveImport(file, name));
  }
  const chunk = (file: string): Chunk => seen.get(file) ?? { file, bytes: 0 };
  return {
    entries: entries.filter((e) => e.endsWith('.js')).map(chunk),
    chunks: [...seen.values()],
  };
}
