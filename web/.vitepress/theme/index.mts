import type { EnhanceAppContext } from "vitepress";
import { defineAsyncComponent } from "vue";
import DefaultTheme from "vitepress/theme";
import "katex/dist/katex.min.css";
import "./prerendered.css";
import type { ComputeEngine } from "@cortex-js/compute-engine";
import type { PackageNotation } from "@enumeratio/boxes";
import type { Resolver } from "@enumeratio/manifest";
import Layout from "./Layout.vue";
import NotatioPrerendered from "./components/NotatioPrerendered.vue";
import { createSessionSharedWorker, createSessionWorker } from "./worker-factories.ts";

// Every custom theme component is loaded lazily. They pull the heavy graphs —
// @enumeratio/components (the whole element + compute-engine tree) via Playground, and
// @enumeratio/reference (all the entry data) via the reference/component pages — which,
// resolved from source, is ~all of the monorepo. Keeping them out of the initial theme
// bundle lets a page's shell paint immediately; each page pulls only the components it
// actually uses, on demand.
const SourceOutput = defineAsyncComponent(() => import("./components/SourceOutput.vue"));
const ElementsDemo = defineAsyncComponent(() => import("./components/ElementsDemo.vue"));
const GlyphGallery = defineAsyncComponent(() => import("./components/GlyphGallery.vue"));
const LiveInput = defineAsyncComponent(() => import("./components/LiveInput.vue"));
const Playground = defineAsyncComponent(() => import("./components/Playground.vue"));
const ReferenceIndex = defineAsyncComponent(() => import("./components/ReferenceIndex.vue"));
const ReferenceCatalog = defineAsyncComponent(() => import("./components/ReferenceCatalog.vue"));
const FieldPage = defineAsyncComponent(() => import("./components/FieldPage.vue"));
const ReferencePage = defineAsyncComponent(() => import("./components/ReferencePage.vue"));
const Story = defineAsyncComponent(() => import("./components/Story.vue"));
const CliReference = defineAsyncComponent(() => import("./components/CliReference.vue"));
const SymbolRef = defineAsyncComponent(() => import("./components/Symbol.vue"));
const ComponentIndex = defineAsyncComponent(() => import("./components/ComponentIndex.vue"));
const ComponentPage = defineAsyncComponent(() => import("./components/ComponentPage.vue"));
const BenchViewer = defineAsyncComponent(() => import("./components/bench/BenchViewer.vue"));
const EnvironmentPreview = defineAsyncComponent(() => import("./components/EnvironmentPreview.vue"));

export default {
  extends: DefaultTheme,
  // Mounts the dev-only review sidebar on every page (see ./Layout.vue and
  // web/review/index.md, excluded from `vitepress build`).
  Layout,
  enhanceApp({ app }: EnhanceAppContext) {
    app.component("Playground", Playground);
    app.component("ElementsDemo", ElementsDemo);
    app.component("ReferencePage", ReferencePage);
    app.component("FieldPage", FieldPage);
    app.component("ReferenceIndex", ReferenceIndex);
    app.component("ReferenceCatalog", ReferenceCatalog);
    app.component("Story", Story);
    app.component("GlyphGallery", GlyphGallery);
    app.component("LiveInput", LiveInput);
    app.component("SourceOutput", SourceOutput);
    app.component("EnvironmentPreview", EnvironmentPreview);
    app.component("ComponentIndex", ComponentIndex);
    app.component("CliReference", CliReference);
    app.component("Symbol", SymbolRef);
    app.component("ComponentPage", ComponentPage);
    app.component("BenchViewer", BenchViewer);
    // Not async: it must render on the server, where the build fills it.
    app.component("NotatioPrerendered", NotatioPrerendered);
    // Client only: register the custom elements (they call customElements.define)
    // and declare the extension libraries against the shared engine so their heads
    // evaluate in the playground and docs -- collections (Combinations/Subsets/…),
    // analytic (HurwitzZeta, the two-argument Zeta), and the hypercomplex families.
    if (!import.meta.env.SSR) {
      // What every page engine needs before it's built, whatever it declares: the notation
      // (its dictionary is fixed then) and evaluation. Set synchronously, before any element
      // mounts, and run by the first engine a page builds.
      // Every catalogued package's notation, in the kernels' order. Light: boxes and the entries.
      let combined: Promise<Required<PackageNotation>> | undefined;
      const notation = (): Promise<Required<PackageNotation>> =>
        (combined ??= Promise.all([
          import("@enumeratio/boxes"),
          import("virtual:notation-entries"),
          import("./worker-catalogue.ts"),
        ]).then(([{ combineNotation }, entries, { CATALOGUE }]) =>
          combineNotation(CATALOGUE.flatMap((library) => entries.default[library.name] ?? [])),
        ));
      let setup: Promise<void> | undefined;
      (globalThis as { __notatioEngineSetup?: () => Promise<unknown> }).__notatioEngineSetup = () =>
        (setup ??= (async () => {
          const [{ configureEngine, configureLatex }, { declareEvaluation }, { latex }] = await Promise.all([
            import("@enumeratio/frontend/core"),
            import("@enumeratio/evaluation"),
            notation(),
          ]);
          configureLatex(latex);
          configureEngine(declareEvaluation);
        })());
      // The libraries, declared as an element's expression first names them, through the same
      // catalogue the kernels resolve with: a page with a Dynamic over Binomial loads
      // combinatorics, not every library. An element that asks for the whole engine
      // (`loadEngine()`) gets every library, through the same resolver, so none is declared twice.
      let resolver: Promise<Resolver<ComputeEngine>> | undefined;
      const resolve = (): Promise<Resolver<ComputeEngine>> =>
        (resolver ??= Promise.all([import("@enumeratio/manifest"), import("./worker-catalogue.ts")]).then(
          ([{ createResolver }, { CATALOGUE }]) => createResolver(CATALOGUE),
        ));
      (globalThis as { __notatioEngineResolver?: unknown }).__notatioEngineResolver = {
        ensure: async (ce: ComputeEngine, json: unknown) => (await resolve()).ensure(ce, json),
        ensureAll: async (ce: ComputeEngine) => {
          const [{ SYMBOLS }, r] = await Promise.all([import("@enumeratio/manifest"), resolve()]);
          return r.ensure(ce, Object.keys(SYMBOLS));
        },
      };
      // The host: the service worker the build writes (host/service-worker.ts), which caches
      // the kernel's libraries so it starts warm and the site works offline. Not in dev, where
      // there is no build.
      if (import.meta.env.PROD && "serviceWorker" in navigator)
        void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
      // The elements load at idle, so the page paints first, and only those the page uses: a
      // page of cells loads no engine.
      // The packages' macros go first: a page with no engine still typesets their commands.
      const define = (): void =>
        void import("@enumeratio/components/lazy").then((m) => {
          m.configureMacros(notation().then((n) => n.macros));
          m.defineOnUse();
        });
      const idle = (globalThis as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void })
        .requestIdleCallback;
      if (idle) idle(define, { timeout: 2000 });
      else setTimeout(define, 0);
      // Points an `Evaluator -> "Worker"` `<dynamic-module-box>` at the module
      // whose `configure(ce)` declares this page's own libraries into its
      // `@enumeratio/evaluation/browser` session -- `dynamic-module-box.ts`'s own
      // `#openSession` reads this the same way `loadEngine` reads
      // `__notatioEngineSetup` above. A `URL` (not a bare specifier) so the worker's
      // own `import(setup)` -- running in a different module graph -- can resolve it.
      (globalThis as { __notatioWorkerSetup?: string }).__notatioWorkerSetup = new URL(
        "./worker-engine-setup.ts",
        import.meta.url,
      ).href;
      // Hands an `Evaluator -> "Worker"` module the two worker factories
      // `./worker-factories.ts` builds around a literal, Vite-bundleable
      // `new Worker(new URL(...))` / `new SharedWorker(new URL(...))` -- without this,
      // `openSession` falls back to computing the worker's URL itself, which a
      // production build never emits as an asset (see that file's own comment).
      (
        globalThis as {
          __notatioWorkerFactories?: {
            createWorker: typeof createSessionWorker;
            createSharedWorker: typeof createSessionSharedWorker;
          };
        }
      ).__notatioWorkerFactories = {
        createWorker: createSessionWorker,
        createSharedWorker: createSessionSharedWorker,
      };
    }
  },
};
