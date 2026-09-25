import { existsSync, readdirSync, readFileSync, symlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitepress";
import { generate } from "@enumeratio/notatio/generate";
import { notatioMath } from "./notatio-math.ts";
import { notatioSymbols } from "./notatio-symbols.ts";
import { referenceDataPlugin } from "./reference-data.ts";
import { reviewModePlugin } from "./review/plugin.ts";

// The symbols as Vue components are generated here, before the theme is bundled, so
// `@enumeratio/notatio`'s `src/vue-generated.ts` exists for the theme to register.
generate("vue");

// Resolve every @enumeratio/* import (bare and subpaths) to its source, so the docs
// site reads sibling packages directly and never depends on a prior `vp pack` of
// them — dev and build both stay in sync with source, with no stale-dist surprises.
// Each package's exports are read, and any target under dist/ is remapped to the
// matching src/*.ts; exports that already point at src are used as-is.
const pkgsDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../packages");
const srcAliases: { find: RegExp; replacement: string }[] = [];
// Symbol packages sit a level deeper, under packages/symbols/<group>/.
const packageDirs = readdirSync(pkgsDir).flatMap((name) =>
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

// design/speculative/ (gitignored): open design, rendered by `vitepress dev` only. It is
// linked into the site as web/speculative (also gitignored) and left out of builds.
const dev = process.argv.includes("dev");
const webDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const speculativeDir = resolve(webDir, "../design/speculative");
const speculativeLink = resolve(webDir, "speculative");
if (dev && existsSync(speculativeDir) && !existsSync(speculativeLink)) {
  symlinkSync(speculativeDir, speculativeLink, "dir");
}
const speculative =
  dev && existsSync(speculativeLink)
    ? readdirSync(speculativeLink)
        .filter((f) => f.endsWith(".md"))
        .sort()
        .map((f) => ({
          text: f.replace(/\.md$/, ""),
          link: `/speculative/${f.replace(/\.md$/, "")}`,
        }))
    : [];

export default defineConfig({
  vite: {
    resolve: { alias: srcAliases },
    // Review mode: a dev-server-only REST API over a markdown backlog file, for
    // working through shipped features. `apply: "serve"` on the plugin itself
    // keeps it out of `vitepress build`/`preview`; gating it here too means the
    // route never even gets registered outside `vitepress dev`.
    // The repo's `vite` specifier resolves to vite-plus-core (see pnpm-workspace.yaml),
    // while vitepress's `plugins` field types against its own nested real `vite` --
    // two structurally-identical but nominally distinct `Plugin` types.
    plugins: (dev
      ? [reviewModePlugin(webDir), referenceDataPlugin()]
      : [referenceDataPlugin()]) as never,
  },
  title: "enumeratio",
  description:
    "Mathematics you can compute, draw and check — every object with a home, every claim with a test, all live in your browser.",
  lang: "en-US",
  cleanUrls: true,
  // `/review` (review mode) is dev-only, same as `/speculative`.
  srcExclude: dev ? [] : ["speculative/**", "review/**"],
  // Dynamic reference routes carry their name in params; use it as the page title
  // (the raw markdown H1 is `{{ $params.name }}`, which VitePress can't read).
  transformPageData(pageData: { params?: { name?: string }; title?: string }) {
    if (pageData.params?.name) pageData.title = pageData.params.name;
  },
  // `$latex$` / `$$latex$$` render through <notatio-out format="latex">, the same MathLive path the
  // reference pages use — one renderer for the whole site, and no second math library.
  markdown: {
    config: (md) => {
      notatioMath(md);
      notatioSymbols(md);
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
    // The sheets first, then the reading. The playground and the CLI are docs, not
    // destinations: they live under Docs (and its sidebar), not in the top bar.
    nav: [
      { text: "Worksheet", link: "/worksheet/" },
      { text: "Explore", link: "/explore/" },
      { text: "Guides", link: "/guide/" },
      { text: "Reference", link: "/reference/" },
      { text: "Docs", link: "/docs/" },
    ],
    sidebar: [
      {
        text: "The pieces",
        items: [
          { text: "nucleus — the kernel", link: "/nucleus/" },
          { text: "aestimatio — the core", link: "/aestimatio/" },
          { text: "notatio — the notation", link: "/notatio/" },
          { text: "enumeratio — the catalogue", link: "/enumeratio/" },
        ],
      },
      {
        text: "Guides",
        items: [
          { text: "Overview", link: "/guide/" },
          { text: "Ranking and unranking", link: "/guide/collections/" },
          {
            text: "Numeral systems",
            link: "/guide/numerals/",
            items: [{ text: "b-adic numbers", link: "/guide/numerals/adic" }],
          },
          { text: "Adèles and idèles", link: "/guide/adeles/" },
          {
            text: "Hypercomplex algebras",
            link: "/guide/hypercomplex/",
            items: [{ text: "Finite: ℤ/m and the places", link: "/guide/hypercomplex/finite" }],
          },
          { text: "Diagram algebras", link: "/guide/diagram-algebras/" },
          { text: "Hecke algebras", link: "/guide/hecke/" },
          { text: "Incidence algebras", link: "/guide/incidence/" },
          { text: "Path algebras", link: "/guide/quiver/" },
          { text: "Hopf algebras", link: "/guide/hopf/" },
          { text: "Group algebras", link: "/guide/groupalgebra/" },
          { text: "The modular group", link: "/guide/modular/" },
          {
            text: "Knots and braids",
            link: "/guide/braid/",
            items: [
              { text: "Torus knots", link: "/guide/braid/torus-knots" },
              { text: "The Lorenz flow", link: "/guide/braid/lorenz" },
            ],
          },
        ],
      },
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
          { text: "Components", link: "/reference/components/" },
        ],
      },
      {
        text: "Docs",
        items: [
          { text: "Overview", link: "/docs/" },
          { text: "Worksheet", link: "/worksheet/" },
          { text: "Notebook", link: "/notebook/" },
          {
            text: "Command line",
            link: "/docs/cli/",
            items: [
              { text: "REPL (live)", link: "/docs/cli/repl" },
              { text: "One-shot (live)", link: "/docs/cli/command-line" },
            ],
          },
        ],
      },
      {
        text: "Explore",
        items: [
          { text: "Overview", link: "/explore/" },
          {
            text: "The two-argument zeta",
            link: "/explore/zeta/",
            items: [
              { text: "ζ on the GPU: a phase portrait", link: "/explore/zeta/phase-portrait" },
            ],
          },
          { text: "The Lerch transcendent", link: "/explore/lerchphi/" },
          { text: "The polylog and the polygamma", link: "/explore/polylog/" },
          { text: "Fractals", link: "/explore/fractals/" },
        ],
      },
      {
        // Demos of the parts, one page per component -- collapsed, since they are for
        // looking one up, not for reading through.
        text: "Playground",
        collapsed: true,
        items: [
          { text: "Overview", link: "/playground/" },
          { text: "Notebook", link: "/playground/notebook" },
          { text: "Input", link: "/playground/in" },
          { text: "Output", link: "/playground/out" },
          { text: "Cell", link: "/playground/cell" },
          { text: "Verification", link: "/playground/verification" },
          { text: "Figure (glyphs)", link: "/playground/figure" },
          { text: "Plot", link: "/playground/plot" },
          { text: "Plot 3D", link: "/playground/plot-3d" },
          { text: "Contour Plot", link: "/playground/contour-plot" },
          { text: "Density Plot", link: "/playground/density-plot" },
          { text: "Vector & Stream Plot", link: "/playground/vector-plot" },
          { text: "Polar Plot", link: "/playground/polar-plot" },
          { text: "List Plot 3D", link: "/playground/list-plot-3d" },
          { text: "Bar Chart 3D", link: "/playground/bar-chart-3d" },
          { text: "Chart", link: "/playground/chart" },
          { text: "GraphPlot", link: "/playground/graph-plot" },
          { text: "Polytope", link: "/playground/polytope" },
          { text: "Complex Plot", link: "/playground/complex-plot" },
          { text: "Complex Plot 3D", link: "/playground/complex-plot-3d" },
          { text: "Collection table", link: "/playground/collection-table" },
          { text: "Worksheet", link: "/playground/worksheet" },
          { text: "Manipulate", link: "/playground/manipulate" },
          { text: "Controls", link: "/playground/controls" },
          { text: "Environments", link: "/playground/environments" },
          { text: "Terminal", link: "/playground/terminal" },
          {
            text: "Inspirations",
            link: "/playground/inspirations/",
            items: [
              { text: "Compute Engine", link: "/playground/inspirations/compute-engine" },
              { text: "Wolfram Language", link: "/playground/inspirations/wolfram" },
              { text: "SageMath", link: "/playground/inspirations/sage" },
              { text: "Tangle", link: "/playground/inspirations/tangle" },
              { text: "ganja.js", link: "/playground/inspirations/ganja" },
            ],
          },
        ],
      },
      ...(speculative.length > 0 ? [{ text: "Speculative (dev only)", items: speculative }] : []),
    ],
    socialLinks: [{ icon: "github", link: "https://github.com/enumeratio/enumeratio" }],
  },
});
