import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { areas, formatAddress, marks } from '@enumeratio/address';
import type { Plugin } from 'vite-plus';
import { escapeHtml } from './src/html.ts';

/** What the shell needs from a page: the same fields `renderPage` returns. */
export interface Prerendered {
  title: string;
  canonical?: string;
  body: { value: string };
}

/**
 * The shell with one page written into it: `#app` filled, the title replaced, the canonical link
 * added. Pure; the title and the canonical URL are escaped as attribute and text.
 */
export function injectPage(shell: string, page: Prerendered): string {
  const app = '<div id="app"></div>';
  if (!shell.includes(app)) throw new Error('the shell has no empty #app element');
  let out = shell.replace(app, () => `<div id="app">${page.body.value}</div>`);
  out = out.replace(/<title>[^]*?<\/title>/, () => `<title>${escapeHtml(page.title)}</title>`);
  // The page is real content now; the fallback for a missing script is not needed.
  out = out.replace(/<noscript>[^]*?<\/noscript>\s*/, '');
  out = out.replace(/<link rel="canonical"[^>]*>\s*/, '');
  if (page.canonical !== undefined) {
    const canonical = `<link rel="canonical" href="${escapeHtml(page.canonical)}" />`;
    out = out.replace('</head>', () => `  ${canonical}\n  </head>`);
  }
  return out;
}

/**
 * The pages written as static HTML at build time: each leaf area, from the same `renderPage` the
 * client uses. The root is not among them: `index.html` is also what every deep address falls
 * back to, so it stays the bare shell and the script draws the home page.
 */
export const prerendered: readonly string[] = [areas.atlas, areas.about, areas.contribute];

export function prerenderPlugin(): Plugin {
  let outDir = '';
  let root = '';
  return {
    name: 'enumeratio-prerender',
    apply: 'build',
    configResolved(config) {
      root = config.root;
      outDir = join(config.root, config.build.outDir);
    },
    async closeBundle() {
      // Runs inside a Vite server, since the pages import the route file as raw text.
      const { createServer } = await import('vite-plus');
      const server = await createServer({
        root,
        configFile: false,
        logLevel: 'silent',
        server: { middlewareMode: true },
        appType: 'custom',
      });
      try {
        const { renderPage } = (await server.ssrLoadModule(
          '/src/pages.ts',
        )) as typeof import('./src/pages.ts');
        const shell = readFileSync(join(outDir, 'index.html'), 'utf8');
        for (const area of prerendered) {
          const address = formatAddress({ area, chain: [], query: [] });
          const page = renderPage(address, '');
          const file = join(outDir, ...address.split(marks.segment).filter(Boolean), 'index.html');
          mkdirSync(dirname(file), { recursive: true });
          writeFileSync(file, injectPage(shell, page));
        }
      } finally {
        await server.close();
      }
    },
  };
}
