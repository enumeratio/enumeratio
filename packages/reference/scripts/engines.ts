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
import { declareCombinatorics } from "@enumeratio/combinatorics/src";
import {
  declareDomainElement,
  declareDomainPlurals,
  declareMaps,
  DOMAINS,
} from "@enumeratio/combinatorics/domains/src";
import { ALL_STATISTICS, declareStatistics } from "@enumeratio/statistics/src";
import { declareDiagrams } from "@enumeratio/diagram/src";
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
import { declareStructures } from "@enumeratio/structures/src";

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
  // Last: adeles' Fibonacci/LucasL widening (`(integer | value) -> integer | value`, no
  // second argument) would otherwise clobber this package's wider signature for the real
  // index and the two-argument polynomial form -- `widenSignature` just assigns the
  // operator's `signature` field, so whichever call runs last wins.
  declareNumberTheory,
  // The statistics and maps, as the site has them, so `CombinatorialStat` and
  // `CombinatorialMap` answer here too (a collection's distributions are its examples).
  // `declareMaps` stays out of `declareCombinatorics` and here, LAST: it widens `Inverse`
  // rather than minting it, and has to run after structures/groupalgebra/modular declare
  // their own `Inverse` so its permutation-carrier overload is the one left standing (see
  // @enumeratio/combinatorics' src/index.ts).
  (ce: ComputeEngine) => {
    declareStatistics(ce, ALL_STATISTICS, { domainTypes: Object.fromEntries(DOMAINS.map((d) => [d.name, d.type])) });
    declareMaps(ce, Object.fromEntries(DOMAINS.map((d) => [d.type, d.name])));
  },
  // Combinatorics' own carriers mint their plural type-space names and `Element` membership
  // LAST, same as every other host (CLI, site, census): `declareCollections`, above, has
  // already had first claim on any plural a real family enumerates (`Permutations`,
  // `DyckPaths`, …), so this only mints the leftover carriers' `set<...>` symbols. Every other
  // library's carriers fold this into their own `declare*` call already (`declareCarriers`'
  // default); this is the one still-separate step, so the reference engine now runs it too —
  // it used to skip it entirely.
  (ce: ComputeEngine) => {
    declareDomainPlurals(ce);
    declareDomainElement(ce);
  },
];

/** Every library we ship, in the order the reference tests declare them. */
export const DECLARATIONS = [declareEvaluation, ...LIBRARY_DECLARATIONS];

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
