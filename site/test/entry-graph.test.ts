import { describe, expect, test } from 'vite-plus/test';
import {
  engineMarkers,
  entriesOf,
  entryGraph,
  holdsEngine,
  resolveImport,
  staticImports,
} from '../entry-graph.ts';

describe('the entry graph of a built site', () => {
  const html = `<!doctype html><link rel="modulepreload" crossorigin href="/assets/vendor-a.js">
    <link rel="stylesheet" href="/assets/index.css"><script type="module" crossorigin src="/assets/index-a.js"></script>`;

  test('the entries are the module script and the preloads, not the style sheets', () => {
    expect(entriesOf(html)).toEqual(['/assets/vendor-a.js', '/assets/index-a.js']);
  });

  test('static imports are followed, dynamic ones are not', () => {
    const code = `import{a as b}from"./x.js";import "./side.js";export{c}from'../y.js';
      const later = () => import("./lazy.js"); export{d};`;
    expect(staticImports(code).toSorted()).toEqual(['../y.js', './side.js', './x.js']);
  });

  test('a name is resolved against the importing file', () => {
    expect(resolveImport('assets/a.js', './b.js')).toBe('assets/b.js');
    expect(resolveImport('assets/a.js', '../c.js')).toBe('c.js');
    expect(resolveImport('assets/a.js', '/assets/d.js')).toBe('assets/d.js');
  });

  test('an engine in a static import is found, and one behind import() is not', () => {
    const files: Record<string, string> = {
      'assets/index-a.js': 'import{x}from"./shared.js";const k=()=>import("./engine.js");',
      'assets/vendor-a.js': 'export const v=1;',
      'assets/shared.js': 'export const x=1;',
      'assets/engine.js': 'console.warn("Compilation fallback for");',
    };
    const read = (file: string) => files[file];
    const lazy = entryGraph(html, read);
    expect(lazy.chunks.map((c) => c.file).toSorted()).toEqual([
      'assets/index-a.js',
      'assets/shared.js',
      'assets/vendor-a.js',
    ]);
    expect(lazy.chunks.some((c) => c.engine !== undefined)).toBe(false);
    // Put the kernel on the main thread: a static import of the engine, and the check sees it.
    files['assets/index-a.js'] = 'import{x}from"./shared.js";import"./engine.js";';
    const eager = entryGraph(html, read);
    expect(eager.chunks.filter((c) => c.engine !== undefined).map((c) => c.file)).toEqual([
      'assets/engine.js',
    ]);
  });

  test('the engine is found by what its code says, whichever marker', () => {
    for (const marker of engineMarkers) expect(holdsEngine(`x;${marker};y`)).toBe(marker);
    expect(holdsEngine('const answer = 42;')).toBeUndefined();
  });

  test('an entry’s size is its bytes', () => {
    const graph = entryGraph(html, (file) => (file === 'assets/index-a.js' ? 'é'.repeat(10) : ''));
    expect(graph.entries.find((e) => e.file === 'assets/index-a.js')?.bytes).toBe(20);
  });
});
