import { areas, formatAddress } from '@enumeratio/address';
import { expect, test } from 'vite-plus/test';
import { injectPage, prerendered } from '../prerender.ts';
import { h } from '../src/html.ts';

const shell = `<!doctype html>
<html lang="en">
  <head>
    <title>enumeratio</title>
    <link rel="canonical" href="https://example.invalid/old" />
  </head>
  <body>
    <div id="app"></div>
    <noscript><main>fallback</main></noscript>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>`;

test('a page is injected into the shell: body, title and canonical', () => {
  const out = injectPage(shell, {
    title: 'Atlas | enumeratio',
    canonical: 'https://example.invalid/atlas',
    body: h`<main><h1>Atlas</h1></main>`,
  });
  expect(out).toContain('<div id="app"><main><h1>Atlas</h1></main></div>');
  expect(out).toContain('<title>Atlas | enumeratio</title>');
  expect(out.match(/<link rel="canonical"/g)).toHaveLength(1);
  expect(out).toContain('href="https://example.invalid/atlas"');
  expect(out).not.toContain('fallback');
  expect(out).toContain('<script type="module" src="/src/main.ts"></script>');
});

test('a title is escaped, and a page without a canonical has no canonical link', () => {
  const out = injectPage(shell, {
    title: '</title><script>alert(1)</script>',
    body: h`<main></main>`,
  });
  expect(out).not.toContain('<script>alert');
  expect(out).toContain('<title>&#60;/title&#62;&#60;script&#62;alert(1)&#60;/script&#62;</title>');
  expect(out).not.toContain('rel="canonical"');
});

test('a shell with no empty #app is refused', () => {
  expect(() => injectPage('<html></html>', { title: '', body: h`` })).toThrow();
});

test('the prerendered pages are the leaf areas, not the root', () => {
  const root = formatAddress({ area: '', chain: [], query: [] });
  expect(prerendered).toEqual([areas.atlas, areas.about, areas.contribute]);
  expect(prerendered).not.toContain(root);
});
