// Checks that the built site's entry does not carry the kernel.
//
//   node site/check-built-entry.ts
//
// The shell and the reading of the address are drawn first, and the kernel loads after first
// paint, in its own chunks and worker. This reads `site/dist` and fails when
//   1. any chunk in the entry's static import graph holds compute-engine, or
//   2. the entry chunk is bigger than its budget.
// Run after the site build. It does not start a browser.

import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { type Chunk, entryGraph, holdsEngine } from './entry-graph.ts';

/**
 * The entry chunk's size in bytes on the commit before any parser was added to the pages
 * (the first pass's main bundle, built from that commit).
 */
export const entryBaselineBytes = 196_057;
/**
 * What the entry may grow by from that, in bytes: a few kilobytes for the pages' own growth. The
 * case this is here for is the compute-engine on the main thread, which added about 6.3 MB; a
 * budget this close to the baseline says so at once.
 */
export const entryMarginBytes = 8_000;
/** The most the entry chunk may be. */
export const entryBudgetBytes = entryBaselineBytes + entryMarginBytes;

const dist = resolve(import.meta.dirname, 'dist');
const read = (file: string): string | undefined => {
  try {
    return readFileSync(join(dist, file), 'utf8');
  } catch {
    return undefined;
  }
};

const html = read('index.html');
if (html === undefined) throw new Error('No built site: build it first.');
const graph = entryGraph(html, read);
if (graph.entries.length === 0) throw new Error('The built index.html names no entry script.');

let bad = 0;
const fail = (message: string): void => {
  bad++;
  console.error(`FAIL ${message}`);
};

for (const chunk of graph.chunks) {
  if (chunk.engine !== undefined) {
    fail(
      `${chunk.file} is in the entry's static import graph and holds compute-engine ("${chunk.engine}")`,
    );
  }
}
const total = graph.chunks.reduce((sum, c: Chunk) => sum + c.bytes, 0);
for (const entry of graph.entries) {
  const over = entry.bytes > entryBudgetBytes;
  if (over) {
    fail(
      `${entry.file} is ${entry.bytes} bytes, over its budget of ${entryBudgetBytes} (the baseline ${entryBaselineBytes} and ${entryMarginBytes} of margin)`,
    );
  } else {
    console.log(`ok   ${entry.file}: ${entry.bytes} of ${entryBudgetBytes} bytes`);
  }
}
console.log(`ok   static graph: ${graph.chunks.length} chunk(s), ${total} bytes`);

// The check is only worth something where the engine can be found: it is in some chunk of the build.
const assets = join(dist, 'assets');
const engineChunks = readdirSync(assets).filter(
  (f) => f.endsWith('.js') && holdsEngine(readFileSync(join(assets, f), 'utf8')) !== undefined,
);
if (engineChunks.length === 0) {
  fail('no chunk of the build holds compute-engine, so the markers no longer find it');
} else {
  console.log(`ok   the engine is in ${engineChunks.join(', ')}, outside the entry's graph`);
}

if (bad > 0) process.exit(1);
console.log('the built entry does not carry the kernel');
