import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitepress";
import { notatioMarkup, useLibraryParams } from "./notatio-markup.ts";
import { libraryParams } from "./theme/libraries.ts";
import { notatioMath } from "./notatio-math.ts";
import { notatioSymbols } from "./notatio-symbols.ts";
import { notationEntriesPlugin } from "./notation-entries.ts";
import { docRoute, docsSidebar, workspacePackages } from "./data/repo-docs.ts";
import { loaderWatchPlugin } from "./loader-watch.ts";
import { fillPrerendered } from "./data/prerender.ts";
import { fillMarkup } from "./data/prerender-markup.ts";
import { chunksIn, pageTags, preloads, prerenderMarkup } from "./prerender-markup.ts";
import { writeServiceWorker } from "./host/service-worker.ts";
import { referenceDataPlugin } from "./reference-data.ts";
import { CATALOGUE } from "./theme/worker-catalogue.ts";
import { reviewModePlugin } from "./review/plugin.ts";

// Resolve every @enumeratio/* import (bare and subpaths) to its source, so the docs
// site reads sibling packages directly and never depends on a prior `vp pack` of
// them — dev and build both stay in sync with source, with no stale-dist surprises.
// Each package's exports are read, and any target under dist/ is remapped to the
// matching src/*.ts; exports that already point at src are used as-is.
// SITE_FROM_PACKAGES=1 turns them off: the site resolves `@enumeratio/*` through whatever is installed,
// as it would from the registry (tools/tarball-check builds it that way, from packed tarballs).
// A library installed beside the tree's packages has no alias: web/ resolves it through node_modules.
const fromPackages = process.env.SITE_FROM_PACKAGES === "1";
const pkgsDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../packages");
const srcAliases: { find: RegExp; replacement: string }[] = [];
// Symbol packages sit a level deeper, under packages/symbols/<group>/.
const packageDirs = (fromPackages ? [] : readdirSync(pkgsDir)).flatMap((name) =>
  name === "symbols"
    ? readdirSync(resolve(pkgsDir, name)).flatMap((group) =>
        readdirSync(resolve(pkgsDir, name, group)).map((pkg) => `${name}/${group}/${pkg}`),
      )
    : [name],
);
for (const dir of packageDirs) {
  const manifest = resolve(pkgsDir, dir, "package.json");
  if (!existsSync(manifest)) continue;
  const pkg = JSON.parse(readFileSync(manifest, "utf8")) as {
    name?: string;
    exports?: Record<string, unknown>;
  };
  if (!pkg.name?.startsWith("@enumeratio/") || !pkg.exports) continue;
  for (const [sub, entry] of Object.entries(pkg.exports)) {
    const target = typeof entry === "string" ? entry : (entry as { import?: string })?.import;
    if (typeof target !== "string") continue;
    const srcRel = target.includes("/dist/")
      ? target.replace("/dist/", "/src/").replace(/\.(m|c)?js$/, ".ts")
      : target.startsWith("./src/")
        ? target
        : undefined;
    if (!srcRel) continue;
    const abs = resolve(pkgsDir, dir, srcRel);
    if (!existsSync(abs)) continue;
    const spec = sub === "." ? pkg.name : pkg.name + sub.slice(1);
    srcAliases.push({
      find: new RegExp(`^${spec.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`),
      replacement: abs,
    });
  }
}

// `@enumeratio/combinatorics` keeps its `collections` area (https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible)
// under its own nested `<area>/src/index.ts` rather than a package-root `src/`, so the
// generic dist->src rewrite above (which only swaps the `/dist/` segment) can't find it.
// So are the other entries whose source isn't `src/<entry>.ts`; alias them by hand.
const sourceEntries: [specifier: string, source: string][] = fromPackages
  ? []
  : [
      ["@enumeratio/combinatorics/collections", "symbols/combinatorics/combinatorics/collections/src/index.ts"],
      ["@enumeratio/combinatorics/findstat", "symbols/combinatorics/combinatorics/findstat/src/findstat-data.ts"],
      ["@enumeratio/catalog/records", "catalog/src/catalog-records-data.ts"],
      ["@enumeratio/ce-patches/wgsl-complex", "ce-patches/src/compute-engine/compilation/wgsl-complex.ts"],
    ];
for (const [specifier, source] of sourceEntries) {
  const abs = resolve(pkgsDir, source);
  if (!existsSync(abs)) continue;
  srcAliases.push({ find: new RegExp(`^${specifier}$`), replacement: abs });
}

const dev = process.argv.includes("dev");
const webDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Pages that moved into package docs keep their old URLs as redirects: Pages hosting has no
// server-side redirects, so each is a static page that forwards.
const moved: [string, string][] = [
  ["/guide/collections/", "/docs/combinatorics/ranking-and-unranking"],
  ["/guide/numerals/adic", "/docs/numerals/adic"],
  ["/guide/numerals/", "/docs/numerals/numeral-systems"],
  ["/guide/adeles/", "/docs/adeles/adeles-and-ideles"],
  ["/guide/hypercomplex/finite", "/docs/hypercomplex/finite"],
  ["/guide/hypercomplex/", "/docs/hypercomplex/hypercomplex-algebras"],
  ["/guide/diagram-algebras/", "/docs/diagram/diagram-algebras"],
  ["/guide/hecke/", "/docs/hecke/hecke-algebras"],
  ["/guide/incidence/", "/docs/incidence/incidence-algebras"],
  ["/guide/quiver/", "/docs/quiver/path-algebras"],
  ["/guide/hopf/", "/docs/hopf/hopf-algebras"],
  ["/guide/groupalgebra/", "/docs/groupalgebra/group-algebras"],
  ["/guide/modular/", "/docs/modular/modular-group"],
  ["/guide/braid/torus-knots", "/docs/braid/torus-knots"],
  ["/guide/braid/lorenz", "/docs/braid/lorenz"],
  ["/guide/braid/", "/docs/braid/knots-and-braids"],
  ["/packages/", "/docs/"],
  ...workspacePackages().map((p): [string, string] => [`/packages/${p.slug}`, docRoute(p.slug)]),
];

function writeRedirects(outDir: string): void {
  for (const [from, to] of moved) {
    const file = resolve(outDir, from.endsWith("/") ? `.${from}index.html` : `.${from}.html`);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(
      file,
      `<!doctype html><meta charset="utf-8"><title>Moved</title>` +
        `<link rel="canonical" href="${to}"><meta http-equiv="refresh" content="0; url=${to}">` +
        `<p>Moved to <a href="${to}">${to}</a>.</p>\n`,
    );
  }
}

// The published libraries' parameter names, for markup that gives a library symbol's slots by
// name. Offline, markup still reads; only named slots on library heads stay pairs.
useLibraryParams(
  await libraryParams().catch((error: unknown) => {
    console.warn(`libraries: no parameter names (${String(error)})`);
    return {};
  }),
);

type SidebarItem = { text: string; link?: string; items?: SidebarItem[]; collapsed?: boolean };

function learnSidebar(): SidebarItem[] {
  return [
    {
      text: "Guides",
      items: [
        { text: "Overview", link: "/guide/" },
        { text: "Ranking and unranking", link: "/docs/combinatorics/ranking-and-unranking" },
        {
          text: "Numeral systems",
          link: "/docs/numerals/numeral-systems",
          items: [{ text: "b-adic numbers", link: "/docs/numerals/adic" }],
        },
        { text: "Adèles and idèles", link: "/docs/adeles/adeles-and-ideles" },
        {
          text: "Hypercomplex algebras",
          link: "/docs/hypercomplex/hypercomplex-algebras",
          items: [{ text: "Finite: ℤ/m and the places", link: "/docs/hypercomplex/finite" }],
        },
        { text: "Diagram algebras", link: "/docs/diagram/diagram-algebras" },
        { text: "Hecke algebras", link: "/docs/hecke/hecke-algebras" },
        { text: "Incidence algebras", link: "/docs/incidence/incidence-algebras" },
        { text: "Path algebras", link: "/docs/quiver/path-algebras" },
        { text: "Hopf algebras", link: "/docs/hopf/hopf-algebras" },
        { text: "Group algebras", link: "/docs/groupalgebra/group-algebras" },
        { text: "The modular group", link: "/docs/modular/modular-group" },
        {
          text: "Knots and braids",
          link: "/docs/braid/knots-and-braids",
          items: [
            { text: "Torus knots", link: "/docs/braid/torus-knots" },
            { text: "The Lorenz flow", link: "/docs/braid/lorenz" },
          ],
        },
      ],
    },
    {
      text: "Packages",
      collapsed: true,
      items: [
        { text: "Overview", link: "/docs/" },
        {
          text: "Command line",
          link: "/docs/cli/",
          items: [
            { text: "REPL (live)", link: "/docs/cli/repl" },
            { text: "One-shot (live)", link: "/docs/cli/command-line" },
          ],
        },
        ...docsSidebar(),
      ],
    },
  ];
}

function referenceSidebar(): SidebarItem[] {
  return [
    {
      // Formats and components are catalogues -- their own index pages enumerate
      // them, so the sidebar links the entry point and stops there.
      text: "Reference",
      items: [
        { text: "Overview", link: "/reference/" },
        { text: "Symbols", link: "/reference/symbol/" },
        { text: "Statistics", link: "/reference/statistics/" },
        { text: "Maps", link: "/reference/maps/" },
        { text: "Collections", link: "/reference/collections/" },
        { text: "Domains", link: "/reference/domains/" },
        { text: "Formats", link: "/reference/formats/" },
        { text: "Components", link: "/reference/component/" },
      ],
    },
    {
      text: "Components, drawn",
      collapsed: true,
      items: [
        { text: "Plot", link: "/reference/component/Plot" },
        { text: "Plot 3D", link: "/reference/component/Plot3D" },
        { text: "Contour Plot", link: "/reference/component/ContourPlot" },
        { text: "Density Plot", link: "/reference/component/DensityPlot" },
        { text: "Vector & Stream Plot", link: "/reference/component/VectorPlot" },
        { text: "Polar Plot", link: "/reference/component/PolarPlot" },
        { text: "List Plot 3D", link: "/reference/component/ListPlot3D" },
        { text: "Bar Chart 3D", link: "/reference/component/BarChart3D" },
        { text: "Chart", link: "/reference/component/Chart" },
        { text: "GraphPlot", link: "/reference/component/GraphPlot" },
        { text: "Complex Plot", link: "/reference/component/ComplexPlot" },
        { text: "Complex Plot 3D", link: "/reference/component/ComplexPlot3D" },
        { text: "Collection table", link: "/reference/component/CollectionTable" },
      ],
    },
  ];
}

function exploreSidebar(): SidebarItem[] {
  return [
    {
      text: "Explore",
      items: [
        { text: "Overview", link: "/explore/" },
        {
          text: "The two-argument zeta",
          link: "/explore/zeta/",
          items: [{ text: "ζ on the GPU: a phase portrait", link: "/explore/zeta/phase-portrait" }],
        },
        { text: "The Lerch transcendent", link: "/explore/lerchphi/" },
        { text: "The polylog and the polygamma", link: "/explore/polylog/" },
        { text: "Fractals", link: "/explore/fractals/" },
      ],
    },
  ];
}

function playgroundSidebar(): SidebarItem[] {
  return [
    {
      text: "The sheets",
      items: [
        { text: "Overview", link: "/playground/" },
        { text: "Worksheet", link: "/playground/worksheet" },
        { text: "Notebook", link: "/playground/notebook" },
        { text: "Manipulate", link: "/playground/manipulate" },
        { text: "Controls", link: "/playground/controls" },
        { text: "Environments", link: "/playground/environments" },
        { text: "Terminal", link: "/playground/terminal" },
      ],
    },
    {
      text: "Cells",
      items: [
        { text: "Input", link: "/playground/in" },
        { text: "Output", link: "/playground/out" },
        { text: "Cell", link: "/playground/cell" },
        { text: "Verification", link: "/playground/verification" },
      ],
    },
    {
      text: "Pictures",
      items: [
        { text: "Figure (glyphs)", link: "/playground/figure" },
        { text: "Polytope", link: "/playground/polytope" },
        { text: "Plots and charts", link: "/reference/component/" },
      ],
    },
    {
      text: "Inspirations",
      link: "/playground/inspirations/",
      collapsed: true,
      items: [
        { text: "Compute Engine", link: "/playground/inspirations/compute-engine" },
        { text: "Wolfram Language", link: "/playground/inspirations/wolfram" },
        { text: "SageMath", link: "/playground/inspirations/sage" },
        { text: "Mathlib", link: "/playground/inspirations/mathlib" },
        { text: "Tangle", link: "/playground/inspirations/tangle" },
        { text: "ganja.js", link: "/playground/inspirations/ganja" },
      ],
    },
  ];
}

const config = defineConfig({
  // The page map in one shared file, not inlined into every page's HTML.
  metaChunk: true,
  vite: {
    resolve: { alias: srcAliases },
    // Module workers: a session kernel imports each library as its own chunk, which the
    // default (IIFE) worker bundle can't split.
    // The worker reads every package's notation through `virtual:notation-entries`.
    worker: { format: "es", plugins: () => [notationEntriesPlugin()] as never },
    // Review mode: a dev-server-only REST API over a markdown backlog file, for
    // working through shipped features. `apply: "serve"` on the plugin itself
    // keeps it out of `vitepress build`/`preview`; gating it here too means the
    // route never even gets registered outside `vitepress dev`.
    // The repo's `vite` specifier resolves to vite-plus-core (see pnpm-workspace.yaml),
    // while vitepress's `plugins` field types against its own nested real `vite` --
    // two structurally-identical but nominally distinct `Plugin` types.
    plugins: (dev
      ? [reviewModePlugin(webDir), referenceDataPlugin(dev), notationEntriesPlugin(), loaderWatchPlugin()]
      : [referenceDataPlugin(dev), notationEntriesPlugin()]) as never,
  },
  title: "enumeratio",
  description:
    "Mathematics you can compute, draw and check — every object with a home, every claim with a test, all live in your browser.",
  lang: "en-US",
  cleanUrls: true,
  // `/review` (review mode) is dev-only.
  srcExclude: dev ? [] : ["review/**"],
  // Dynamic reference routes carry their name in params; use it as the page title
  // (the raw markdown H1 is `{{ $params.name }}`, which VitePress can't read).
  buildEnd: (site: { outDir: string }) => {
    writeRedirects(site.outDir);
    // The host: a service worker that caches the kernel's libraries on install (host/).
    writeServiceWorker(site.outDir, { libraries: CATALOGUE.map((library) => library.name) });
  },
  transformPageData(pageData: { params?: { name?: string }; title?: string }) {
    if (pageData.params?.name) pageData.title = pageData.params.name;
  },
  // A reference page's examples, and any page's own cells and plots, rendered at build
  // (data/prerender.ts, data/prerender-markup.ts) into their placeholders.
  async transformHtml(
    code: string,
    _id: string,
    ctx: { pageData: { relativePath: string; params?: { name?: string } } },
  ) {
    const name = ctx.pageData.params?.name;
    const page =
      name !== undefined && ctx.pageData.relativePath.startsWith("reference/symbol/")
        ? fillPrerendered(code, name)
        : code;
    return fillMarkup(page, ctx.pageData.relativePath);
  },
  // The chunks a page's cells and plots load (lazy.ts loads them at idle), fetched with the page.
  // The client bundle is written before any page renders, so its chunks are on disk.
  transformHead(ctx: { siteConfig: { outDir: string }; pageData: { relativePath: string } }) {
    const tags = pageTags(ctx.pageData.relativePath);
    if (tags.size === 0) return [];
    return chunksIn(ctx.siteConfig.outDir)
      .filter((asset) => preloads(asset, tags))
      .map((href) => ["link", { rel: "modulepreload", href }] as [string, Record<string, string>]);
  },

  // `$latex$` / `$$latex$$` typeset by KaTeX at build (notatio-math.ts), as cells are at runtime;
  // cells and plots marked for the build to render (prerender-markup.ts).
  markdown: {
    config: (md) => {
      notatioMath(md);
      notatioMarkup(md);
      notatioSymbols(md);
      prerenderMarkup(md);
    },
  },
  vue: {
    template: {
      compilerOptions: {
        // notatio-* and MathLive's math-field are custom elements, not Vue components.
        isCustomElement: (tag: string) => tag.startsWith("notatio-") || tag === "math-field",
      },
    },
  },
  themeConfig: {
    // One sidebar per section (matched by path prefix), not one list of everything:
    // Learn (guides and package docs), Reference (lookup), Explore (dials), Sheets (the tools),
    // and Playground (the interface parts, one page each).
    nav: [
      { text: "Learn", link: "/docs/", activeMatch: "^/(docs|guide)/" },
      { text: "Reference", link: "/reference/", activeMatch: "^/reference/" },
      { text: "Explore", link: "/explore/", activeMatch: "^/explore/" },
      {
        text: "Sheets",
        activeMatch: "^/(worksheet|notebook)/",
        items: [
          { text: "Worksheet", link: "/worksheet/" },
          { text: "Notebook", link: "/notebook/" },
          { text: "Command line", link: "/docs/cli/" },
        ],
      },
      { text: "Playground", link: "/playground/", activeMatch: "^/playground/" },
    ],
    sidebar: {
      "/guide/": learnSidebar(),
      "/docs/": learnSidebar(),
      "/reference/": referenceSidebar(),
      "/explore/": exploreSidebar(),
      "/playground/": playgroundSidebar(),
    },
    socialLinks: [{ icon: "github", link: "https://github.com/enumeratio/enumeratio" }],
  },
});

export default config;
