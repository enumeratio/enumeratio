import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitepress";
import { notatioMath } from "./notatio-math.ts";
import { notatioSymbols } from "./notatio-symbols.ts";

// Resolve every @enumeratio/* import (bare and subpaths) to its source, so the docs
// site reads sibling packages directly and never depends on a prior `vp pack` of
// them — dev and build both stay in sync with source, with no stale-dist surprises.
// Each package's exports are read, and any target under dist/ is remapped to the
// matching src/*.ts; exports that already point at src are used as-is.
const pkgsDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../packages");
const srcAliases: { find: RegExp; replacement: string }[] = [];
for (const d of readdirSync(pkgsDir, { withFileTypes: true })) {
  const manifest = resolve(pkgsDir, d.name, "package.json");
  if (!d.isDirectory() || !existsSync(manifest)) continue;
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
    const abs = resolve(pkgsDir, d.name, srcRel);
    if (!existsSync(abs)) continue;
    const spec = sub === "." ? pkg.name : pkg.name + sub.slice(1);
    srcAliases.push({
      find: new RegExp(`^${spec.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`),
      replacement: abs,
    });
  }
}

export default defineConfig({
  vite: { resolve: { alias: srcAliases } },
  title: "enumeratio",
  description:
    "enumeratio: a family of mathematical symbol definitions on the Cortex compute-engine and Epsil, collections first. notatio: the notebook and explorer around it.",
  lang: "en-US",
  cleanUrls: true,
  // Dynamic reference routes carry their name in params; use it as the page title
  // (the raw markdown H1 is `{{ $params.name }}`, which VitePress can't read).
  transformPageData(pageData: { params?: { name?: string }; title?: string }) {
    if (pageData.params?.name) pageData.title = pageData.params.name;
  },
  // `$latex$` / `$$latex$$` render through <notatio-tex>, the same MathLive path the
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
    nav: [
      { text: "Guides", link: "/guide/" },
      { text: "Reference", link: "/reference/" },
      { text: "Playground", link: "/playground/" },
      { text: "Explore", link: "/explore/" },
      { text: "CLI", link: "/cli/" },
    ],
    sidebar: [
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
        text: "Playground",
        items: [
          { text: "Overview", link: "/playground/" },
          { text: "Notebook", link: "/playground/notebook" },
          { text: "Input", link: "/playground/in" },
          { text: "Output", link: "/playground/out" },
          { text: "Cell", link: "/playground/cell" },
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
          { text: "Collection table", link: "/playground/collection-table" },
          { text: "Worksheet", link: "/playground/worksheet" },
          { text: "Manipulate", link: "/playground/manipulate" },
          { text: "REPL (terminal)", link: "/playground/repl" },
          { text: "Command line", link: "/playground/cli" },
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
        text: "CLI",
        items: [{ text: "Overview", link: "/cli/" }],
      },
    ],
    socialLinks: [{ icon: "github", link: "https://github.com/enumeratio/notatio" }],
  },
});
