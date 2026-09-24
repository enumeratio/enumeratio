import type { EnhanceAppContext } from "vitepress";
import { defineAsyncComponent } from "vue";
import { registerNotatio } from "@enumeratio/notatio/vue";
import DefaultTheme from "vitepress/theme";

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
        // Carriers first: everything below declares heads OVER these minted types, so they
        // have to exist before a signature can name one.
        const constructorFor = Object.fromEntries(DOMAINS.map((d) => [d.type, d.name]));
        // SetPartition is held back: domains treats it as a restricted growth string while
        // every set-partition definition works in blocks -- typing those heads over the
        // carrier would be a wrong answer rather than a type error.
        const domainTypes = Object.fromEntries(
          DOMAINS.filter((d) => d.name !== "SetPartition").map((d) => [d.name, d.type]),
        );
        // Notation has to be in before the engine is built: its dictionary is fixed then.
        configureLatex(RESIDUES_LATEX);
        configureEngine(declareDomains);
        // A combinatorial statistic is a function of a carrier, so that is what these heads
        // take. The ones that are ALSO plain list functions accept a bare list too.
        configureEngine((ce) => declareCollections(ce, { permutationType: "permutation" }));
        // Collections already declares the fast permutation heads under the same names, so
        // those are skipped here — one head, one owner.
        configureEngine((ce) =>
          declareStatistics(ce, ALL_STATISTICS, { skipDeclared: true, domainTypes }),
        );
        configureEngine((ce) => declareMaps(ce, constructorFor));
        configureEngine(declareAnalytic);
        configureEngine(declareFractals);
        configureEngine(declareGraphics);
        configureEngine(declareHypercomplex);
        // The geometric-algebra layer sits ON hypercomplex: its heads read the generators
        // and the ordered product that library declares, so it has to come after.
        configureEngine(declareGeometric);
        configureEngine(declareDiagrams);
        configureEngine(declareResidues);
        configureEngine(declareNumerals);
        configureEngine(declareHecke);
        configureEngine(declareIncidence);
        configureEngine(declareQuiver);
        configureEngine(declareHopf);
        configureEngine(declareGroupAlgebra);
        configureEngine(declareModular);
        configureEngine(declareNumberTheory);
        configureEngine(declareAdeles);
        configureEngine(declareBraid);
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
    }
  },
};
