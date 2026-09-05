import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitepress'
import katex from '@vscode/markdown-it-katex'
import { enumeratioCore } from '@enumeratio/data/vite'

// One docs site for the whole monorepo. The file tree mirrors the nav, in nav order. Top-level nav items are
// verbs (what you're doing here); their items are nouns (what you'll find). Three top-level items now — Explore,
// Learn, Develop — each either a plain link or a short, genuinely useful dropdown:
//   docs/*.md                    — site-level pages (home)
//   docs/explore/**              — index.md IS the collection atlas (the map, the families, the counting-sequence
//                                  bridges) — the section's own landing page, not a separate sub-item; plus the
//                                  mounted collection/query apps. No Playground here anymore (moved to Develop)
//   docs/learn/**                — index.md is a brief pointer to its two tiers:
//     docs/learn/guides/**       — the beginner guided tour (the former docs/learn/index.md content is now
//                                  guides/index.md, the real "Start here" walkthrough)
//     docs/learn/explorations/** — deep math essays (polytopes, tableaux, …) — workbooks, not reference — with
//                                  their own index.md landing page
//     docs/learn/reference/**    — (stub) wiki-like per-math-concept pages, linked from Explorations, no nav entry
//   docs/develop/**              — index.md is the adapted vision essay — the section's own landing page:
//     docs/develop/api.md        — the generated SQL-surface reference (a direct child now, not nested)
//     docs/develop/data/**       — entity-metadata stubs (collections/functions/maps) plus the two generated
//                                  tables that used to live under a standalone top-level Reference section:
//                                  statistics.md and relations.md (renamed from "mappings" — it's the
//                                  base_reference cross-reference table)
//     docs/develop/sources.md    — the crosswalk of external systems/inspirations (OEIS, FindStat, Sage, …) that
//                                  used to be the standalone top-level Reference/Resources overview page
//     docs/develop/packages/**, docs/develop/contributing/**, docs/develop/playground/** — package docs
//                                  (including the component kitchen sinks), contributor docs, and the interactive
//                                  toys (Helmert projection, session demo) — one Playground entry, not exploded
// Internal design docs (architecture, grading, spikes, roadmap, …) live in the GitHub wiki — staged for that
// move under the top-level `wiki/` folder, outside this docs build.
// Every multi-item nav entry is a NavDropdownLink (docs/.vitepress/components/NavDropdownLink.vue) rather than
// VitePress's own dropdown shape — its own label is a real link to that section's index page (no core VitePress
// support for this: see the component's own header comment), so no dropdown needs a redundant "Overview" row.
// Sidebars get the same treatment natively — VitePress's own SidebarItem allows a group header to carry both
// `link` and `items`, so every section's sidebar group header links to its index page directly.
// The explorer is MOUNTED as a self-contained app owning /explore/collection/*: deep paths fold to the
// /explore/collection page (dev middleware below), and in the built site they 404 → the theme's not-found slot
// renders the Explorer, which self-routes off window.location.pathname. (Pattern borrowed from the numbers repo's
// collection host.) The bare landing (collection list) lives at /explore/collection/ — /explore/ itself is left
// as a reserved umbrella for future sibling explorer surfaces.
export default defineConfig({
  title: 'enumeratio',
  description: 'A home for combinatorial structures — explorable live, and built for people and LLMs alike.',
  cleanUrls: true,
  // The Pascal-lattice mark (numbers-repo heritage, recolored bronze/gold). The favicon carries its own
  // prefers-color-scheme media query; the nav logo is theme-picked by themeConfig.logo below.
  head: [['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }]],
  // Treat the figure custom elements (Lit) as native custom elements, not Vue components: the semantic `*-glyph` /
  // `*-figure` figures, plus the reserved `enumeratio-` prefix for client-backed enumeratio-resource components.
  vue: {
    template: {
      compilerOptions: {
        isCustomElement: (tag: string) => tag.endsWith('-glyph') || tag.endsWith('-figure') || tag.startsWith('enumeratio-'),
      },
    },
  },
  // /explore/collection/<slice> paths are SPA-routed (not pre-generated), so VitePress can't statically verify them.
  ignoreDeadLinks: [/^\/explore\/collection(\/.*)?$/],

  themeConfig: {
    logo: { light: '/logo-light.svg', dark: '/logo-dark.svg' },
    socialLinks: [{ icon: 'github', link: 'https://github.com/enumeratio/enumeratio' }],
    nav: [
      { text: 'Explore', link: '/explore/' },
      {
        component: 'NavDropdownLink',
        props: {
          text: 'Learn', link: '/learn/',
          items: [
            { text: 'Guides', link: '/learn/guides/' },
            { text: 'Explorations', link: '/learn/explorations/' },
          ],
        },
      },
      {
        component: 'NavDropdownLink',
        props: {
          text: 'Develop', link: '/develop/',
          items: [
            { text: 'Packages', link: '/develop/packages/' },
            { text: 'Data Reference', link: '/develop/data/' },
            { text: 'API Reference', link: '/develop/api' },
            { text: 'Sources', link: '/develop/sources' },
            { text: 'Contributing', link: '/develop/contributing/' },
            { text: 'Playground', link: '/develop/playground/' },
          ],
        },
      },
    ],
    sidebar: {
      '/explore/': [
        {
          text: 'Explore', link: '/explore/',
          items: [
            { text: 'Collections', link: '/explore/collection/' },
          ],
        },
      ],
      '/learn/': [
        {
          text: 'Learn', link: '/learn/',
          items: [
            {
              text: 'Guides', link: '/learn/guides/',
              items: [
                { text: 'Permutations', link: '/learn/guides/permutations' },
                { text: 'Subsets & partitions', link: '/learn/guides/subsets-and-partitions' },
                { text: 'Words & compositions', link: '/learn/guides/words-and-compositions' },
                { text: 'Stars and bars', link: '/learn/guides/stars-and-bars' },
                { text: 'Lattice paths & trees', link: '/learn/guides/lattice-paths-and-trees' },
                { text: 'Where next', link: '/learn/guides/where-next' },
              ],
            },
            {
              text: 'Explorations', link: '/learn/explorations/',
              items: [
                { text: 'Polytopes', link: '/learn/explorations/polytopes' },
                { text: 'Tableaux', link: '/learn/explorations/tableaux' },
                { text: 'Set partitions', link: '/learn/explorations/set-partitions' },
                { text: 'Bijections', link: '/learn/explorations/bijections' },
                { text: 'Connections to computer science', link: '/learn/explorations/computer-science' },
                { text: 'Subset sum & q-binomials', link: '/learn/explorations/subset-sum-and-q-binomials' },
              ],
            },
          ],
        },
      ],
      '/develop/': [
        { text: 'Develop', link: '/develop/' },
        {
          text: 'Packages', link: '/develop/packages/',
          items: [
            { text: '@enumeratio/data', link: '/develop/packages/data/' },
            { text: '@enumeratio/client', link: '/develop/packages/client/' },
            {
              text: '@enumeratio/cli',
              link: '/develop/packages/cli/',
              items: [{ text: 'Playground', link: '/develop/packages/cli/playground' }],
            },
            {
              text: '@enumeratio/components',
              link: '/develop/packages/components/',
              collapsed: false,
              items: [
                {
                  text: 'Figures (pure)',
                  collapsed: true,
                  items: [
                    { text: 'svg-figure', link: '/develop/packages/components/svg-figure' },
                  ],
                },
                {
                  text: 'Client-backed',
                  collapsed: true,
                  items: [
                    { text: 'enumeratio-notation', link: '/develop/packages/components/notation' },
                    { text: 'enumeratio-figure', link: '/develop/packages/components/figure' },
                    { text: 'enumeratio-expression', link: '/develop/packages/components/expression' },
                  ],
                },
                {
                  text: 'Polytopes (three.js)',
                  collapsed: true,
                  items: [
                    { text: 'polytope-figure', link: '/develop/packages/components/polytope-figure' },
                    { text: 'polytope-overlay', link: '/develop/packages/components/polytope-overlay' },
                  ],
                },
                {
                  text: 'Testing harness',
                  collapsed: false,
                  items: [
                    { text: 'enumeratio-assert', link: '/develop/packages/components/assert' },
                    { text: 'Expression kitchen sink', link: '/develop/packages/components/expression-examples' },
                    { text: 'Figure kitchen sink', link: '/develop/packages/components/kitchen-sink' },
                  ],
                },
              ],
            },
          ],
        },
        {
          text: 'Data Reference', link: '/develop/data/',
          items: [
            { text: 'Collections', link: '/develop/data/collections' },
            { text: 'Statistics', link: '/develop/data/statistics' },
            { text: 'Maps', link: '/develop/data/maps' },
            { text: 'Relations', link: '/develop/data/relations' },
            { text: 'Functions (stub)', link: '/develop/data/functions' },
          ],
        },
        { text: 'API Reference', link: '/develop/api' },
        { text: 'Sources', link: '/develop/sources' },
        {
          text: 'Contributing', link: '/develop/contributing/',
          items: [
            { text: 'Design system', link: '/develop/contributing/design-system' },
            { text: 'Visual representations', link: '/develop/contributing/visual-representations' },
            { text: 'Adding a collection', link: '/develop/contributing/adding-a-collection' },
            { text: 'Internal design docs (wiki)', link: 'https://github.com/enumeratio/enumeratio/wiki' },
          ],
        },
        { text: 'Playground', link: '/develop/playground/' },
      ],
    },
  },

  // KaTeX (not MathJax) for markdown math — `$inline$` and `$$block$$`. Fast, no reflow. CSS loaded in theme/index.ts.
  markdown: {
    config: (md) => {
      const plugin = (katex as any).default ?? katex // @vscode/markdown-it-katex double-wraps its CJS default
      md.use(plugin)
    },
  },

  vite: {
    resolve: {
      alias: { '@components': fileURLToPath(new URL('./components', import.meta.url)) },
    },
    // pglite runs in the browser (the live components/explorer): ES workers, and keep pglite out of dep
    // pre-bundling (esbuild mangles its emscripten wasm/data fetch otherwise).
    worker: { format: 'es' },
    optimizeDeps: { exclude: ['@electric-sql/pglite'] },
    plugins: [
      // Serve/rebuild the prebuilt DB dump so the browser mounts it (fast) instead of rebuilding the core each load.
      enumeratioCore(),
      {
        // Dev: fold deep /explore/collection/<slice> paths back to /explore/collection/ so the VitePress page (the
        // mounted app) is served and the Explorer self-routes off the real pathname. (Built site relies on the
        // not-found slot.)
        name: 'explorer-path-fallback',
        configureServer(server: any) {
          server.middlewares.use((req: any, _res: any, next: any) => {
            // Only fold NAVIGATIONS (Accept: text/html) for a deep /explore/collection/<slice> hard-load — never
            // asset/module/wasm requests (which would otherwise be served the HTML page → MIME errors, breaking
            // pglite's wasm load).
            const path = (req.url || '').split('?')[0]
            if (/^\/explore\/collection\/.+/.test(path) && (req.headers.accept || '').includes('text/html')) req.url = '/explore/collection/'
            next()
          })
        },
      },
    ],
  },
})
