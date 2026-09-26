// The declare ORDER and OPTIONS shared by two engines that must mean the same thing:
// `./index.mts`'s page engine (`@enumeratio/notatio`'s `configureEngine`, dynamic
// imports for bundle-splitting) and `./worker-engine-setup.ts`'s
// `@enumeratio/aestimatio/browser` session engine (a plain `ComputeEngine`, static
// imports since `openSession`'s `configure(ce)` runs synchronously). Each side does its
// own importing -- this only owns the sequence and the options each `declare*` call
// takes, so the two library sets can't quietly drift apart the way they had (the
// session was missing nothing, but a future addition to one list and not the other
// would have gone unnoticed the same way `Notebook`'s own signature bug did).
//
// `apply` is the seam: `./index.mts` passes `configureEngine` itself (register-or-apply,
// since the page's engine may not exist yet), `./worker-engine-setup.ts` passes a plain
// `(fn) => fn(ce)` (the session's engine already exists by the time `configure` runs).

import type { ComputeEngine } from "@cortex-js/compute-engine";

// Each library's own `typeof`, not a hand-copied signature: a `declare*` whose real
// type doesn't match what this module expects fails to typecheck at the `apply(...)`
// call sites below, rather than silently accepting a wrong signature the way a loose
// `(ce: ComputeEngine) => void` would.
export interface EngineLibraries {
  readonly declareCollections: typeof import("@enumeratio/collections").declareCollections;
  readonly declareStatistics: typeof import("@enumeratio/statistics").declareStatistics;
  readonly ALL_STATISTICS: typeof import("@enumeratio/statistics").ALL_STATISTICS;
  readonly declareDomainTypes: typeof import("@enumeratio/domains").declareDomainTypes;
  readonly declareDomainConstructors: typeof import("@enumeratio/domains").declareDomainConstructors;
  readonly declareMaps: typeof import("@enumeratio/domains").declareMaps;
  readonly DOMAINS: typeof import("@enumeratio/domains").DOMAINS;
  readonly declareAnalytic: typeof import("@enumeratio/analytic").declareAnalytic;
  readonly declareFractals: typeof import("@enumeratio/analytic").declareFractals;
  readonly declareGraphics: typeof import("@enumeratio/formats").declareGraphics;
  readonly declareHypercomplex: typeof import("@enumeratio/hypercomplex").declareHypercomplex;
  readonly declareGeometric: typeof import("@enumeratio/geometric").declareGeometric;
  readonly declareDiagrams: typeof import("@enumeratio/diagram").declareDiagrams;
  readonly declareResidues: typeof import("@enumeratio/residues").declareResidues;
  readonly declareNumerals: typeof import("@enumeratio/numerals").declareNumerals;
  readonly declareHecke: typeof import("@enumeratio/hecke").declareHecke;
  readonly declareIncidence: typeof import("@enumeratio/incidence").declareIncidence;
  readonly declareQuiver: typeof import("@enumeratio/quiver").declareQuiver;
  readonly declareHopf: typeof import("@enumeratio/hopf").declareHopf;
  readonly declareGroupAlgebra: typeof import("@enumeratio/groupalgebra").declareGroupAlgebra;
  readonly declareModular: typeof import("@enumeratio/modular").declareModular;
  readonly declareNumberTheory: typeof import("@enumeratio/number-theory").declareNumberTheory;
  readonly declareAdeles: typeof import("@enumeratio/adeles").declareAdeles;
  readonly declareBraid: typeof import("@enumeratio/braid").declareBraid;
}

/**
 * Declares every library the page ships, in dependency order, via `apply` -- either
 * `configureEngine` (deferred until the engine exists) or a direct `(fn) => fn(ce)`.
 * Does NOT include `@enumeratio/aestimatio` itself or the LaTeX dictionary
 * (`configureLatex(RESIDUES_LATEX)`): the page engine needs both, but a session's
 * engine already has aestimatio declared before `configure` runs (see
 * `browser-session-worker.ts`) and never parses LaTeX at all (see
 * `worker-engine-setup.ts`'s own comment) -- both callers handle those two on their own.
 */
export function applyEngineLibraries(apply: (fn: (ce: ComputeEngine) => void) => void, libs: EngineLibraries): void {
  // Carrier TYPES first: everything below declares heads OVER these minted types, so they
  // have to exist before a signature can name one.
  const constructorFor = Object.fromEntries(libs.DOMAINS.map((d) => [d.type, d.name]));
  // SetPartitions is held back: domains treats it as a restricted growth string while
  // every set-partition definition works in blocks -- typing those heads over the
  // carrier would be a wrong answer rather than a type error.
  const domainTypes = Object.fromEntries(
    libs.DOMAINS.filter((d) => d.name !== "SetPartitions").map((d) => [d.name, d.type]),
  );
  apply(libs.declareDomainTypes);
  // A combinatorial statistic is a function of a carrier, so that is what these heads
  // take. The ones that are ALSO plain list functions accept a bare list too.
  apply((ce) => libs.declareCollections(ce, { permutationType: "permutation" }));
  // The carrier NAME comes after collections, not before: a carrier and its plain
  // collection are the same head now (Permutations, SetPartitions, ...), so collections
  // has to declare that name first and domains' own constructor layers onto it, rather
  // than the two colliding over who's first.
  apply(libs.declareDomainConstructors);
  // Collections already declares the fast permutation heads under the same names, so
  // those are skipped here — one head, one owner.
  apply((ce) => libs.declareStatistics(ce, libs.ALL_STATISTICS, { skipDeclared: true, domainTypes }));
  apply((ce) => libs.declareMaps(ce, constructorFor));
  apply(libs.declareAnalytic);
  apply(libs.declareFractals);
  apply(libs.declareGraphics);
  apply(libs.declareHypercomplex);
  // The geometric-algebra layer sits ON hypercomplex: its heads read the generators
  // and the ordered product that library declares, so it has to come after.
  apply(libs.declareGeometric);
  apply(libs.declareDiagrams);
  apply(libs.declareResidues);
  apply(libs.declareNumerals);
  apply(libs.declareHecke);
  apply(libs.declareIncidence);
  apply(libs.declareQuiver);
  apply(libs.declareHopf);
  apply(libs.declareGroupAlgebra);
  apply(libs.declareModular);
  apply(libs.declareNumberTheory);
  apply(libs.declareAdeles);
  apply(libs.declareBraid);
}
