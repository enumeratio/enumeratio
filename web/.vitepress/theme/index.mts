import type { EnhanceAppContext } from "vitepress";
import { defineAsyncComponent } from "vue";
import { registerNotatio } from "@enumeratio/notatio/vue";
import DefaultTheme from "vitepress/theme";
import { applyEngineLibraries } from "./engine-libraries.ts";
import { createSessionSharedWorker, createSessionWorker } from "./worker-factories.ts";

// Every custom theme component is loaded lazily. They pull the heavy graphs —
// @enumeratio/notatio-lit (the whole element + compute-engine tree) via Playground, and
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
const ReferencePage = defineAsyncComponent(() => import("./components/ReferencePage.vue"));
const Story = defineAsyncComponent(() => import("./components/Story.vue"));
const CliReference = defineAsyncComponent(() => import("./components/CliReference.vue"));
const SymbolRef = defineAsyncComponent(() => import("./components/Symbol.vue"));
const ComponentIndex = defineAsyncComponent(() => import("./components/ComponentIndex.vue"));
const ComponentPage = defineAsyncComponent(() => import("./components/ComponentPage.vue"));
const EnvironmentPreview = defineAsyncComponent(
  () => import("./components/EnvironmentPreview.vue"),
);

// The symbols as Vue components -- `<Plot>`, `<Histogram>`, `<Cell>`, `<Notatio>`, … --
// from @enumeratio/notatio/vue, generated there from the element sources.

export default {
  extends: DefaultTheme,
  enhanceApp({ app }: EnhanceAppContext) {
    app.component("Playground", Playground);
    app.component("ElementsDemo", ElementsDemo);
    app.component("ReferencePage", ReferencePage);
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
    registerNotatio(app);
    // Client only: register the custom elements (they call customElements.define)
    // and declare the extension libraries against the shared engine so their heads
    // evaluate in the playground and docs -- collections (Combinations/Subsets/…),
    // analytic (HurwitzZeta, the two-argument Zeta), and the hypercomplex families.
    if (!import.meta.env.SSR) {
      // Publish the readiness promise synchronously (before any element mounts) so
      // the shared engine waits for these libraries to be declared before its first
      // evaluation — see `loadEngine` in @enumeratio/notatio-lit. The imports resolve
      // from source here, which is slower than a prebuilt dist, so this gate is what
      // keeps cells/plots from rendering before their heads exist.
      const startEngine = async (): Promise<void> => {
        const [
          { configureEngine, configureLatex },
          { declareCollections },
          { ALL_STATISTICS, declareStatistics },
          { declareDomains, declareMaps, DOMAINS },
          { declareAnalytic, declareFractals },
          { declareGraphics },
          { declareHypercomplex },
          { declareGeometric },
          { declareDiagrams },
          { declareResidues, RESIDUES_LATEX },
          { declareNumerals },
          { declareHecke },
          { declareIncidence },
          { declareQuiver },
          { declareHopf },
          { declareGroupAlgebra },
          { declareModular },
          { declareNumberTheory },
          { declareAdeles },
          { declareBraid },
          { declareAestimatio },
        ] = await Promise.all([
          import("@enumeratio/notatio-lit"),
          import("@enumeratio/collections"),
          import("@enumeratio/statistics"),
          import("@enumeratio/domains"),
          import("@enumeratio/analytic"),
          import("@enumeratio/formats"),
          import("@enumeratio/hypercomplex"),
          import("@enumeratio/geometric"),
          import("@enumeratio/diagram"),
          import("@enumeratio/residues"),
          import("@enumeratio/numerals"),
          import("@enumeratio/hecke"),
          import("@enumeratio/incidence"),
          import("@enumeratio/quiver"),
          import("@enumeratio/hopf"),
          import("@enumeratio/groupalgebra"),
          import("@enumeratio/modular"),
          import("@enumeratio/number-theory"),
          import("@enumeratio/adeles"),
          import("@enumeratio/braid"),
          import("@enumeratio/aestimatio"),
        ]);
        // Notation has to be in before the engine is built: its dictionary is fixed then.
        configureLatex(RESIDUES_LATEX);
        applyEngineLibraries(configureEngine, {
          declareCollections,
          declareStatistics,
          ALL_STATISTICS,
          declareDomains,
          declareMaps,
          DOMAINS,
          declareAnalytic,
          declareFractals,
          declareGraphics,
          declareHypercomplex,
          declareGeometric,
          declareDiagrams,
          declareResidues,
          declareNumerals,
          declareHecke,
          declareIncidence,
          declareQuiver,
          declareHopf,
          declareGroupAlgebra,
          declareModular,
          declareNumberTheory,
          declareAdeles,
          declareBraid,
        });
        configureEngine(declareAestimatio);
      };
      // The promise is assigned synchronously (any element's loadEngine awaits it), but
      // the heavy 15-package source import is deferred to browser idle, so the initial
      // page shell paints before ~all of the monorepo source is transformed.
      (globalThis as { __notatioEngineReady?: Promise<unknown> }).__notatioEngineReady =
        new Promise<void>((resolve, reject) => {
          const kick = (): void => void startEngine().then(resolve, reject);
          const ric = (
            globalThis as {
              requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void;
            }
          ).requestIdleCallback;
          if (ric) ric(kick, { timeout: 2000 });
          else setTimeout(kick, 0);
        });
      // Points an `Evaluator -> "Worker"` `<notatio-dynamic-module>` at the module
      // whose `configure(ce)` declares this page's own libraries into its
      // `@enumeratio/aestimatio/browser` session -- `notatio-dynamic-module.ts`'s own
      // `#openSession` reads this the same way `loadEngine` reads
      // `__notatioEngineReady` above. A `URL` (not a bare specifier) so the worker's
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
