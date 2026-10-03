// The engines the collectors and tests both need — and nothing else.
//
// This file exists because `collect-provenance.ts` writes a file at import time, and the
// provenance test used to import it just to reach `declaredEngine`. Every test run then
// rewrote the generated data and dirtied the tree. Side effects belong in the script that
// is meant to have them; shared setup belongs here.

import { ComputeEngine } from "@cortex-js/compute-engine";
import { declareAdeles } from "@enumeratio/adeles/src";
import { declareEvaluation } from "@enumeratio/evaluation/src";
import { declareAnalytic, declareFractals } from "@enumeratio/analytic/src";
import { declareBraid } from "@enumeratio/braid/src";
import { CARRIERS, declareCombinatorics, declareMaps } from "@enumeratio/combinatorics/src";
import { declareDiagrams } from "@enumeratio/diagram/src";
import { declareGeometric } from "@enumeratio/geometric/src";
import { declareGroupAlgebra } from "@enumeratio/groupalgebra/src";
import { declareHecke } from "@enumeratio/hecke/src";
import { declareHopf } from "@enumeratio/hopf/src";
import { declareHypercomplex } from "@enumeratio/hypercomplex/src";
import { declareIncidence } from "@enumeratio/incidence/src";
import { declareModular } from "@enumeratio/modular/src";
import { declareNumberTheory } from "@enumeratio/number-theory/src";
import { declareNumerals } from "@enumeratio/numerals/src";
import { declareQuiver } from "@enumeratio/quiver/src";
import { declareResidues } from "@enumeratio/residues/src";
import { declareBoxes } from "@enumeratio/boxes/src";
import type { PackageNotation } from "@enumeratio/boxes";
import { type Library, NOTATIONS } from "@enumeratio/manifest";
import {
  declareCarrierElement,
  declareCarrierPlurals,
  declareCompose,
  declareRestricted,
  declareStructures,
} from "@enumeratio/structures/src";

/** Every library we ship BESIDES `@enumeratio/evaluation`, in the order the reference
 * tests declare them. Split out from `DECLARATIONS` so `configure` below (the `setup`
 * module `@enumeratio/evaluation/node`'s isolated evaluator loads into a worker) can
 * declare exactly these — the worker's own engine already declares evaluation itself
 * (redeclaring throws: "already declared in this scope"). */
const LIBRARY_DECLARATIONS = [
  declareBoxes,
  declareAnalytic,
  declareFractals,
  declareHypercomplex,
  declareGeometric,
  declareDiagrams,
  // Carriers, the families typed by them, and the plural type-spaces and Element -- one call
  // (https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible §4 step 3), so the
  // permutation families yield `Permutation` values, as the site's engine has them.
  declareCombinatorics,
  // Note: GlyphKind (frontend's own carrier, https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible §4 step 5) is deliberately NOT declared in this engine — wiring it in would
  // make @enumeratio/reference depend on @enumeratio/frontend, which already devDeps
  // reference for its own tests, a real build cycle. GlyphKind's reference entry states its
  // `library` directly (read, not derived from this engine — see `declaredLibrary` in
  // provenance.ts), so this only affects its `provenance` classification, and it is a stub
  // with no examples either way.
  declareStructures,
  declareResidues,
  declareNumerals,
  declareHecke,
  declareIncidence,
  declareQuiver,
  declareHopf,
  declareGroupAlgebra,
  declareModular,
  declareAdeles,
  declareBraid,
  declareNumberTheory,
  // Maps, as the site has them, so `CombinatorialMap` answers here too (the combinatorial
  // statistics are declared inside `declareCombinatorics` itself now, step 6b). `declareMaps`
  // stays out of `declareCombinatorics` and here, LAST: it widens `Inverse` rather than
  // minting it, and has to run after structures/groupalgebra/modular declare their own
  // `Inverse` so its permutation-carrier overload is the one left standing (see
  // @enumeratio/combinatorics' src/index.ts).
  (ce: ComputeEngine) => {
    declareMaps(ce, Object.fromEntries(CARRIERS.map((c) => [c.type, c.name])));
  },
  // Combinatorics' own carriers mint their plural type-space names and `Element` membership
  // LAST, same as every other host (CLI, site, census): `declareCollections`, above, has
  // already had first claim on any plural a real family enumerates (`Permutations`,
  // `DyckPaths`, …), so this only mints the leftover carriers' `set<...>` symbols. Every other
  // library's carriers fold this into their own `declare*` call already (`declareCarriers`'
  // default); this is the one still-separate step, so the reference engine now runs it too —
  // it used to skip it entirely.
  (ce: ComputeEngine) => {
    declareCarrierPlurals(ce, CARRIERS);
    declareCarrierElement(ce, CARRIERS);
  },
  declareRestricted,
  declareCompose,
];

/** Every library we ship, in the order the reference tests declare them. */
export const DECLARATIONS = [declareEvaluation, ...LIBRARY_DECLARATIONS];

/**
 * The same libraries by package, for the resolver (`@enumeratio/manifest`'s `createResolver`),
 * in the same order. A package is one library: combinatorics brings its maps and its
 * carriers' plurals with it, where `LIBRARY_DECLARATIONS` declares those last.
 */
export const LIBRARIES: readonly Library<ComputeEngine>[] = [
  { name: "boxes", declare: declareBoxes },
  {
    name: "analytic",
    declare: (ce) => {
      declareAnalytic(ce);
      declareFractals(ce);
    },
  },
  { name: "hypercomplex", declare: declareHypercomplex },
  { name: "geometric", declare: declareGeometric },
  { name: "diagram", declare: declareDiagrams },
  {
    name: "combinatorics",
    // `CombinatorialStat`'s table is a registry `declareCombinatorics` adds entries to
    // (each area's own `declareStatistics`) without redeclaring it, which declaring can't
    // see on its own — see `Library.names`. (Moved here from a separate "statistics" entry,
    // step 6b: the combinatorial statistics are declared inside `declareCombinatorics` now.)
    names: ["CombinatorialStat", "Tally"],
    declare: (ce) => {
      declareCombinatorics(ce);
      declareMaps(ce, Object.fromEntries(CARRIERS.map((c) => [c.type, c.name])));
      declareCarrierPlurals(ce, CARRIERS);
      declareCarrierElement(ce, CARRIERS);
    },
  },
  { name: "structures", declare: declareStructures },
  { name: "residues", declare: declareResidues },
  { name: "numerals", declare: declareNumerals },
  { name: "hecke", declare: declareHecke },
  { name: "incidence", declare: declareIncidence },
  { name: "quiver", declare: declareQuiver },
  { name: "hopf", declare: declareHopf },
  { name: "groupalgebra", declare: declareGroupAlgebra },
  { name: "modular", declare: declareModular },
  { name: "adeles", declare: declareAdeles },
  { name: "braid", declare: declareBraid },
  { name: "number-theory", declare: declareNumberTheory },
];

/** Every package's notation entry, as the manifest lists them. Imported from here because this
 *  package depends on every library, so each specifier resolves. */
export const packageNotations = (): Promise<PackageNotation[]> =>
  Promise.all(
    Object.values(NOTATIONS).map(
      async (specifier) => ((await import(specifier)) as { notation: PackageNotation }).notation,
    ),
  );

export const declaredEngine = (): ComputeEngine => {
  const ce = new ComputeEngine();
  for (const declare of DECLARATIONS) declare(ce);
  return ce;
};

/**
 * `configure(ce)` for `@enumeratio/evaluation/node`'s isolated evaluator (`evaluateIsolated`,
 * `openSession`, `runCases`'s `setup` option): declares every library the reference engine
 * declares, so a case evaluated in a worker means the same thing it would in-process. Not
 * `declaredEngine`'s `DECLARATIONS` verbatim — the worker's own engine already declares
 * `@enumeratio/evaluation` before running `setup` (see `worker.ts`/`session-worker.ts`).
 */
export function configure(ce: ComputeEngine): void {
  for (const declare of LIBRARY_DECLARATIONS) declare(ce);
}
