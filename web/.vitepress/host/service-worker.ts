// Writes the site's service worker (./service-worker.js) into a build: its version, the
// configuration it holds, and the files it caches on install. These are every library chunk
// the kernel worker loads, the worker itself, the shell every page runs, what the page's cells
// and plots load, and the fonts they typeset with.

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** The page's chunks, by name, before the modules they import: the shell every page runs,
 *  and what a cell or a plot loads. */
const PAGE_ROOTS = [
  "theme",
  "framework",
  "metadata",
  "lazy",
  "notatio-cell",
  "notatio-in",
  "notatio-out",
  "notatio-code",
  "graphics-box",
  "plot-view",
  "kernel-client",
  "plot-kernel",
  "katex",
];

const RELATIVE = /["'`]\.\/([\w.-]+\.(?:js|css))["'`]/g;

/** `roots` and every file in `dir` they import, transitively, by `./name` references. */
export function closure(dir: string, roots: readonly string[]): string[] {
  const seen = new Set<string>();
  const queue = [...roots];
  while (queue.length > 0) {
    const file = queue.shift()!;
    if (seen.has(file) || !existsSync(resolve(dir, file))) continue;
    seen.add(file);
    if (!file.endsWith(".js")) continue;
    for (const [, next] of readFileSync(resolve(dir, file), "utf8").matchAll(RELATIVE)) queue.push(next!);
  }
  return [...seen].toSorted();
}

const VENDOR_ON_DEMAND = /^\/vendor\/mathlive@/;

/** The vendor files (`../vendor.ts`) under `outDir`, as URLs; the editor's is fetched when one opens. */
function vendorFiles(outDir: string, dir = "vendor"): string[] {
  const path = resolve(outDir, dir);
  if (!existsSync(path)) return [];
  return readdirSync(path, { withFileTypes: true })
    .flatMap((entry) => (entry.isDirectory() ? vendorFiles(outDir, `${dir}/${entry.name}`) : [`/${dir}/${entry.name}`]))
    .filter((url) => !VENDOR_ON_DEMAND.test(url));
}

/** The files the service worker caches on install, as the URLs pages load them by. */
export function precacheList(outDir: string): string[] {
  const assets = resolve(outDir, "assets");
  const chunks = resolve(assets, "chunks");
  const top = existsSync(assets) ? readdirSync(assets) : [];
  const inChunks = existsSync(chunks) ? readdirSync(chunks) : [];
  const worker = closure(
    assets,
    top.filter((f) => f.startsWith("session-worker-entry-") && f.endsWith(".js")),
  ).map((f) => `/assets/${f}`);
  const roots = inChunks.filter((f) => PAGE_ROOTS.some((name) => f.startsWith(`${name}.`)));
  const page = closure(chunks, roots).map((f) => `/assets/chunks/${f}`);
  const shell = top
    .filter((f) => /^app\.[\w-]+\.js$/.test(f) || /^style\.[\w-]+\.css$/.test(f) || f.endsWith(".woff2"))
    .map((f) => `/assets/${f}`);
  return [...new Set([...worker, ...page, ...shell, ...vendorFiles(outDir)])].toSorted();
}

/** Write `outDir/sw.js`, holding `configuration`, and return how many files it caches. */
export function writeServiceWorker(outDir: string, configuration: Readonly<Record<string, unknown>>): number {
  const precache = precacheList(outDir);
  const version = createHash("sha256").update(precache.join("\n")).digest("hex").slice(0, 12);
  const template = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "service-worker.js"), "utf8");
  const source = template
    .replace('"__VERSION__"', JSON.stringify(version))
    .replace("__PRECACHE__", JSON.stringify(precache))
    .replace("__CONFIGURATION__", JSON.stringify(configuration));
  writeFileSync(resolve(outDir, "sw.js"), source);
  return precache.length;
}
